import { useEffect, useState } from 'react';

const STORAGE_KEY = 'claude-kanban-is-touch-device';

/**
 * Hook to detect if the user is on a touch device.
 * Uses localStorage to persist detection across sessions.
 * Registers only ONE global event listener for touch detection.
 */
export function useTouchDetection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    const initialValue = stored === 'true';
    setIsMobile(initialValue);

    let touchTimeout: NodeJS.Timeout | null = null;

    // SINGLE global handler for all components
    const handleTouch = () => {
      if (touchTimeout) clearTimeout(touchTimeout);

      localStorage.setItem(STORAGE_KEY, 'true');
      setIsMobile(true);

      touchTimeout = setTimeout(() => {
        touchTimeout = null;
      }, 500);
    };

    const handleMouseClick = () => {
      if (touchTimeout) return;
      localStorage.setItem(STORAGE_KEY, 'false');
      setIsMobile(false);
    };

    // Register ONCE globally
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('mousedown', handleMouseClick);

    return () => {
      if (touchTimeout) clearTimeout(touchTimeout);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('mousedown', handleMouseClick);
    };
  }, []);

  return isMobile;
}
