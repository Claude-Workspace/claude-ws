import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Viewport-based mobile detection hook.
 * Returns true when window width is below 768px.
 * Uses resize listener to update reactively.
 *
 * This is viewport-based (not touch-based like useTouchDetection)
 * because layout decisions depend on screen width, not input method.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
