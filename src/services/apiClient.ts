/**
 * src/services/apiClient.ts
 *
 * Resilient API client for Responde frontend with:
 * 1. Decoupled In-flight request deduplication (prevents multiple components firing duplicate requests
 *    without letting an unmounting caller cancel shared requests for active callers)
 * 2. Short-term in-memory response cache (8s TTL)
 * 3. Exponential backoff retry on HTTP 429 (Rate Limit) and transient network drops
 * 4. Per-caller AbortSignal integration to cancel only the caller's interest, canceling the underlying
 *    network fetch ONLY when all interested callers have aborted.
 */

export interface ApiClientOptions extends RequestInit {
  /** Maximum number of retry attempts for 429/503 (default: 3) */
  maxRetries?: number;
  /** Initial backoff delay in ms (default: 800ms) */
  initialBackoffMs?: number;
  /** In-memory cache TTL in ms for GET requests (default: 8000ms). Set to 0 to bypass */
  cacheTtlMs?: number;
  /** Force network bypass of cached entries */
  forceRefresh?: boolean;
}

interface CacheEntry<T = any> {
  timestamp: number;
  data: T;
}

interface InFlightSubscriber {
  signal?: AbortSignal | null;
  onAbort?: () => void;
}

interface InFlightEntry<T = any> {
  promise: Promise<T>;
  internalController: AbortController;
  subscribers: Set<InFlightSubscriber>;
}

// In-memory cache for GET responses
const queryCache = new Map<string, CacheEntry>();

// In-flight pending requests map with decoupled subscriber tracking
const inFlightRequests = new Map<string, InFlightEntry>();

export class ApiError extends Error {
  status: number;
  isRateLimit: boolean;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, isRateLimit = false, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isRateLimit = isRateLimit;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Returns API Base URL. In development, Vite proxy handles '', in prod uses VITE_API_URL.
 */
export function getApiBaseUrl(): string {
  return import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
}

/**
 * Invalidate in-memory query cache matching a key or pattern (or everything if omitted)
 */
export function invalidateApiCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
}

/**
 * Sleep helper for exponential backoff
 */
const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

/**
 * Execute a resilient, cached, deduplicated HTTP request.
 */
export async function apiRequest<T = any>(
  path: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialBackoffMs = 800,
    cacheTtlMs = 8000,
    forceRefresh = false,
    signal,
    headers: customHeaders,
    ...restFetchOptions
  } = options;

  const method = (restFetchOptions.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${getApiBaseUrl()}${path}`;

  const token = (() => {
    try {
      return localStorage.getItem('responde_session_token');
    } catch {
      return null;
    }
  })();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((customHeaders as Record<string, string>) || {}),
  };

  const cacheKey = `${method}:${url}:${token ? token.slice(-8) : 'anon'}`;

  // 1. Check in-memory cache for GET
  if (isGet && !forceRefresh && cacheTtlMs > 0) {
    const cached = queryCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < cacheTtlMs) {
      return cached.data as T;
    }
  }

  // If the caller's signal is already aborted before starting, fail fast
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // 2. Manage in-flight deduplication with per-caller abort decoupling
  let entry = isGet ? inFlightRequests.get(cacheKey) : undefined;
  if (entry && entry.internalController.signal.aborted) {
    inFlightRequests.delete(cacheKey);
    entry = undefined;
  }

  if (!entry) {
    const internalController = new AbortController();
    const subscribers = new Set<InFlightSubscriber>();

    // 3. Perform network call with exponential backoff on 429 or 503
    const executeCall = async (): Promise<T> => {
      let attempt = 0;

      while (attempt <= maxRetries) {
        if (internalController.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        try {
          const response = await fetch(url, {
            ...restFetchOptions,
            method,
            headers,
            credentials: 'include',
            signal: internalController.signal,
          });

          if (response.ok) {
            const json = await response.json();
            if (isGet && cacheTtlMs > 0) {
              queryCache.set(cacheKey, { timestamp: Date.now(), data: json });
            }
            return json as T;
          }

          // Handle Rate Limit (HTTP 429) or Service Overload (HTTP 503)
          if (response.status === 429 || response.status === 503) {
            const is429 = response.status === 429;
            const retryAfterHeader = response.headers.get('retry-after');
            const resetHeader = response.headers.get('ratelimit-reset');
            let delayMs = initialBackoffMs * Math.pow(2, attempt) + Math.random() * 300;

            if (retryAfterHeader) {
              const parsedSeconds = parseInt(retryAfterHeader, 10);
              if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
                delayMs = Math.min(parsedSeconds * 1000, 15000);
              }
            } else if (resetHeader) {
              const parsedReset = parseInt(resetHeader, 10);
              if (!isNaN(parsedReset) && parsedReset > 0 && parsedReset < 60) {
                delayMs = Math.min(parsedReset * 1000, 10000);
              }
            }

            if (attempt < maxRetries) {
              attempt++;
              if (import.meta.env.DEV) {
                console.warn(
                  `[apiClient] ${response.status} on ${path}. Retrying in ${Math.round(delayMs)}ms (attempt ${attempt}/${maxRetries})...`
                );
              }
              await wait(delayMs, internalController.signal);
              continue;
            }

            const errBody = await response.json().catch(() => ({}));
            const errMsg =
              errBody.error ||
              (is429 ? 'Too many requests, please try again in a few moments.' : 'Server temporarily unavailable.');
            throw new ApiError(errMsg, response.status, is429);
          }

          // Other HTTP error statuses
          const errJson = await response.json().catch(() => ({}));
          const message = errJson.error || errJson.message || `Request failed with status ${response.status}`;
          throw new ApiError(message, response.status, false);
        } catch (err: any) {
          if (err.name === 'AbortError') {
            throw err;
          }

          // Network connection error - retry once or twice
          if (err.name === 'TypeError' && err.message.includes('fetch') && attempt < maxRetries) {
            attempt++;
            const delay = initialBackoffMs * Math.pow(1.5, attempt);
            await wait(delay, internalController.signal);
            continue;
          }

          throw err;
        }
      }

      throw new ApiError('Request timed out after retries', 429, true);
    };

    const sharedPromise = executeCall().finally(() => {
      if (isGet) {
        inFlightRequests.delete(cacheKey);
      }
    });

    entry = {
      promise: sharedPromise,
      internalController,
      subscribers,
    };

    if (isGet) {
      inFlightRequests.set(cacheKey, entry);
    }
  }

  // Non-GET requests run without subscriber wrapping
  if (!isGet) {
    return entry.promise;
  }

  // Wrap the shared in-flight promise for this specific caller
  return new Promise<T>((resolve, reject) => {
    const currentEntry = entry!;
    let sub: InFlightSubscriber;

    const onAbort = () => {
      currentEntry.subscribers.delete(sub);
      if (import.meta.env.DEV) console.log(`[apiClient:AbortTrace] Caller signal aborted for ${path}. Remaining subscribers: ${currentEntry.subscribers.size}`);
      // Cancel underlying fetch ONLY if all subscribers have aborted
      if (currentEntry.subscribers.size === 0) {
        if (import.meta.env.DEV) console.log(`[apiClient:AbortTrace] All subscribers aborted for ${path} - canceling underlying network fetch`);
        currentEntry.internalController.abort();
        inFlightRequests.delete(cacheKey);
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      sub = { signal, onAbort };
      currentEntry.subscribers.add(sub);
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      sub = { signal: null, onAbort: undefined };
      currentEntry.subscribers.add(sub);
    }

    currentEntry.promise
      .then((result) => {
        if (signal && sub.onAbort) {
          signal.removeEventListener('abort', sub.onAbort);
        }
        currentEntry.subscribers.delete(sub);
        resolve(result);
      })
      .catch((err) => {
        if (signal && sub.onAbort) {
          signal.removeEventListener('abort', sub.onAbort);
        }
        currentEntry.subscribers.delete(sub);
        reject(err);
      });
  });
}
