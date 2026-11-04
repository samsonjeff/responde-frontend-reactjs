import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

export interface AnimatedNumberProps {
  /** Target number to animate to */
  value: number;
  /** Duration of the count-up animation in seconds (default: 3.0s) */
  duration?: number;
  /** Delay in seconds before counting begins (default: 0.05s) */
  delay?: number;
  /** Optional CSS classes for the container span */
  className?: string;
  /** Custom formatter function (defaults to locale integer formatting) */
  formatter?: (val: number) => string;
}

/**
 * AnimatedNumber
 *
 * Smoothly counts from 0 to the target maximum number over a 3-second duration
 * whenever entering or reloading the page.
 */
export default function AnimatedNumber({
  value,
  duration = 2,
  delay = 0.05,
  className = '',
  formatter = (v) => Math.round(v).toLocaleString(),
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    prevValueRef.current = value;

    if (ref.current && start === 0) {
      ref.current.textContent = formatter(0);
    }

    let lastRendered = '';

    const controls = animate(start, end, {
      duration,
      delay,
      // Smooth continuous roll across the full 3 seconds
      ease: [0.16, 0.84, 0.44, 1],
      onUpdate(latest) {
        if (ref.current) {
          const formatted = formatter(latest);
          if (formatted !== lastRendered) {
            lastRendered = formatted;
            ref.current.textContent = formatted;
          }
        }
      },
    });

    return () => controls.stop();
  }, [value, duration, delay, formatter]);

  return (
    <span ref={ref} className={className}>
      {formatter(0)}
    </span>
  );
}
