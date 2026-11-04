/**
 * src/utils/dateUtils.ts
 * Unified Philippine Standard Time (PST / PHT, UTC+8, 'Asia/Manila') Utilities
 * 
 * Supports:
 * - 12-hour clock with AM/PM (e.g., "9:14 PM", "Oct 16, 2026", "10/16 9:14 PM")
 * - Header live clock with seconds (e.g., "9:14:18 PM")
 * - Full datetime strings (e.g., "Oct 16, 2026, 9:14 PM")
 * - Safe handling of null, undefined, ISO strings, timestamps, and relative time
 */

export const PHILIPPINE_TIMEZONE = 'Asia/Manila';

/**
 * Format date/time to Philippine Standard Time (12-hour format with AM/PM)
 * Example outputs:
 * - "10/16 9:14 PM" (short: numeric month/day + hour:minute AM/PM)
 * - "Oct 16, 2026, 9:14 PM" (when includeYear: true)
 */
export function formatPhilippineDateTime(
  value: string | number | Date | null | undefined,
  options?: {
    includeYear?: boolean;
    includeSeconds?: boolean;
  }
): string {
  if (!value) return '';
  const d = typeof value === 'object' && value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const includeYear = options?.includeYear ?? false;
  const includeSeconds = options?.includeSeconds ?? false;

  const timePart = d.toLocaleTimeString('en-US', {
    timeZone: PHILIPPINE_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });

  if (includeYear) {
    const datePart = d.toLocaleDateString('en-US', {
      timeZone: PHILIPPINE_TIMEZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${datePart}, ${timePart}`;
  }

  // Short month/day format: "10/16 9:14 PM"
  const datePart = d.toLocaleDateString('en-US', {
    timeZone: PHILIPPINE_TIMEZONE,
    month: 'numeric',
    day: 'numeric',
  });

  return `${datePart} ${timePart}`;
}

/**
 * Standard timestamp formatter for feeds, incident tables, and cards in Philippine Time.
 * Example: "10/16 9:14 PM"
 */
export function formatTimestampPHT(ts: string | number | Date | null | undefined): string {
  if (!ts) return '';
  return formatPhilippineDateTime(ts);
}

/**
 * Formats time-only in Philippine Timezone (e.g., "9:14 PM" or "9:14:18 PM").
 */
export function formatPhilippineTimeOnly(
  value: string | number | Date | null | undefined,
  includeSeconds = false
): string {
  if (!value) return '';
  const d = typeof value === 'object' && value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('en-US', {
    timeZone: PHILIPPINE_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });
}

/**
 * Formats date-only in Philippine Timezone (e.g., "Oct 16, 2026").
 */
export function formatPhilippineDateOnly(
  value: string | number | Date | null | undefined,
  style: 'short' | 'long' = 'short'
): string {
  if (!value) return '';
  const d = typeof value === 'object' && value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-US', {
    timeZone: PHILIPPINE_TIMEZONE,
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Extracts the time portion from a combined string (e.g. "10/16 9:14 PM" -> "9:14 PM").
 */
export function extractDisplayTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  // Matches "9:14 PM" or "09:14:18 PM"
  const match = trimmed.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)$/i);
  if (match) return match[1];

  // Matches 24-hour "21:14"
  const match24 = trimmed.match(/(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (match24) return match24[1];

  return trimmed;
}

/**
 * Relative time ago (e.g., "Just now", "5m ago", "2h ago", "Yesterday")
 */
export function formatTimeAgoPHT(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 0) return 'Just now';
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatPhilippineDateOnly(d, 'short');
}

/**
 * Returns current date/time formatted for official action logs (e.g. "10/16 9:14 PM").
 */
export function getPhilippineTimestampNow(): string {
  return formatPhilippineDateTime(new Date());
}
