'use client';

import { useEffect, useState, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  /** Characters per frame (default: 8) */
  speed?: number;
  /** Frame interval in ms (default: 16 for ~60fps) */
  interval?: number;
  /** Skip animation for this text */
  skipAnimation?: boolean;
  className?: string;
}

/**
 * Typewriter effect for streaming text
 * Reveals text gradually to avoid sudden large blocks appearing
 */
export function TypewriterText({
  text,
  speed = 8,
  interval = 16,
  skipAnimation = false,
  className,
}: TypewriterTextProps) {
  const [visibleLength, setVisibleLength] = useState(0);
  const prevTextRef = useRef('');
  const animatingRef = useRef(false);

  useEffect(() => {
    // If skipping animation, show full text immediately
    if (skipAnimation) {
      setVisibleLength(text.length);
      prevTextRef.current = text;
      return;
    }

    // If text is shorter or same (user scrolled back, etc), show immediately
    if (text.length <= prevTextRef.current.length) {
      setVisibleLength(text.length);
      prevTextRef.current = text;
      return;
    }

    // New text added - animate from current position
    const startFrom = visibleLength;
    const targetLength = text.length;

    // Already fully visible
    if (startFrom >= targetLength) {
      prevTextRef.current = text;
      return;
    }

    // Prevent multiple animations
    if (animatingRef.current) return;
    animatingRef.current = true;

    let currentLength = startFrom;
    const timer = setInterval(() => {
      currentLength = Math.min(currentLength + speed, targetLength);
      setVisibleLength(currentLength);

      if (currentLength >= targetLength) {
        clearInterval(timer);
        animatingRef.current = false;
        prevTextRef.current = text;
      }
    }, interval);

    return () => {
      clearInterval(timer);
      animatingRef.current = false;
    };
  }, [text, speed, interval, skipAnimation, visibleLength]);

  // Show visible portion of text
  const visibleText = text.slice(0, visibleLength);

  return <span className={className}>{visibleText}</span>;
}
