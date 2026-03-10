import type { darkTheme, lightTheme } from '@/components/terminal/terminal-themes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TerminalAny = any;

/**
 * Sets up mobile touch handlers for scroll, momentum, and selection mode.
 * Returns a cleanup function to remove all listeners and state.
 */
export function setupTerminalMobileTouchHandlers(
  container: HTMLElement,
  terminal: TerminalAny,
  isDark: boolean,
  selectionModeRef: React.MutableRefObject<boolean>,
  dark: typeof darkTheme,
  light: typeof lightTheme,
): () => void {
  const preventTouchScroll = (e: TouchEvent) => { e.preventDefault(); };
  container.addEventListener('touchmove', preventTouchScroll, { passive: false });

  const screen = container.querySelector('.xterm-screen') as HTMLElement | null;
  if (!screen) {
    return () => { container.removeEventListener('touchmove', preventTouchScroll); };
  }

  let startY = 0;
  let startX = 0;
  let isVertical: boolean | null = null;
  let velocityY = 0;
  let lastMoveTime = 0;
  let momentumRaf = 0;
  let anchor: { col: number; bufferRow: number } | null = null;
  let isDragging = false;
  let cursorEl: HTMLElement | null = null;
  let cursorBlink: ReturnType<typeof setInterval> | null = null;
  let cursorTimeout: ReturnType<typeof setTimeout> | null = null;

  const getCellSize = () => ({
    w: screen.clientWidth / (terminal.cols || 1),
    h: screen.clientHeight / (terminal.rows || 1),
  });

  const screenToCell = (clientX: number, clientY: number) => {
    const rect = screen.getBoundingClientRect();
    const cell = getCellSize();
    return {
      col: Math.max(0, Math.min(terminal.cols - 1, Math.floor((clientX - rect.left) / cell.w))),
      row: Math.max(0, Math.min(terminal.rows - 1, Math.floor((clientY - rect.top) / cell.h))),
    };
  };

  const stopMomentum = () => {
    if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = 0; }
  };

  const emitWheel = (dy: number) => {
    screen.dispatchEvent(new WheelEvent('wheel', {
      deltaY: dy, deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      bubbles: true, cancelable: true,
    }));
  };

  const startMomentum = () => {
    if (Math.abs(velocityY) < 0.3) return;
    let v = -velocityY * 16;
    const friction = 0.95;
    const tick = () => {
      if (Math.abs(v) < 0.5) { momentumRaf = 0; return; }
      emitWheel(v);
      v *= friction;
      momentumRaf = requestAnimationFrame(tick);
    };
    momentumRaf = requestAnimationFrame(tick);
  };

  const removeCursor = () => {
    if (cursorTimeout) { clearTimeout(cursorTimeout); cursorTimeout = null; }
    if (cursorBlink) { clearInterval(cursorBlink); cursorBlink = null; }
    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
  };

  const showCursorAtCell = (col: number, viewportRow: number) => {
    removeCursor();
    const cell = getCellSize();
    const el = document.createElement('div');
    const color = isDark ? dark.cursor : light.cursor;
    el.style.cssText = `position:absolute;width:2px;height:${Math.round(cell.h)}px;background:${color};pointer-events:none;z-index:10;border-radius:1px;`;
    el.style.left = `${Math.round(col * cell.w)}px`;
    el.style.top = `${Math.round(viewportRow * cell.h)}px`;
    screen.appendChild(el);
    cursorEl = el;
    let vis = true;
    cursorBlink = setInterval(() => { vis = !vis; el.style.opacity = vis ? '1' : '0'; }, 530);
    cursorTimeout = setTimeout(removeCursor, 5000);
  };

  const updateSelection = (clientX: number, clientY: number) => {
    if (!anchor) return;
    const { col: endCol, row: endViewportRow } = screenToCell(clientX, clientY);
    const endBufRow = endViewportRow + terminal.buffer.active.viewportY;
    const { col: startCol, bufferRow: startBufRow } = anchor;

    const forward = endBufRow > startBufRow || (endBufRow === startBufRow && endCol >= startCol);
    if (forward) {
      const len = (endBufRow - startBufRow) * terminal.cols + (endCol - startCol) + 1;
      terminal.select(startCol, startBufRow, len);
    } else {
      const len = (startBufRow - endBufRow) * terminal.cols + (startCol - endCol) + 1;
      terminal.select(endCol, endBufRow, len);
    }
  };

  const applyScroll = (dy: number, t: Touch) => {
    const now = Date.now();
    const dt = Math.max(now - lastMoveTime, 1);
    velocityY = 0.6 * velocityY + 0.4 * (dy / dt);
    emitWheel(-dy);
    startY = t.clientY;
    startX = t.clientX;
    lastMoveTime = now;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    stopMomentum();
    const touch = e.touches[0];
    startY = touch.clientY;
    startX = touch.clientX;
    isVertical = null;
    isDragging = false;
    velocityY = 0;
    lastMoveTime = Date.now();

    if (selectionModeRef.current && anchor) {
      removeCursor();
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dy = t.clientY - startY;
    const dx = t.clientX - startX;

    if (selectionModeRef.current) {
      if (isDragging) {
        updateSelection(t.clientX, t.clientY);
        return;
      }

      if (isVertical === null && (Math.abs(dy) > 6 || Math.abs(dx) > 6)) {
        if (anchor) {
          isVertical = false;
          isDragging = true;
          updateSelection(t.clientX, t.clientY);
          return;
        }
        isVertical = true;
      }

      if (isVertical) applyScroll(dy, t);
      return;
    }

    if (isVertical === null && (Math.abs(dy) > 4 || Math.abs(dx) > 4)) {
      isVertical = Math.abs(dy) >= Math.abs(dx);
    }
    if (isVertical) applyScroll(dy, t);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (isVertical) startMomentum();

    if (selectionModeRef.current) {
      const t = e.changedTouches[0];
      if (!t) return;

      if (isDragging) {
        isDragging = false;
        return;
      }

      if (!isVertical) {
        const { col, row } = screenToCell(t.clientX, t.clientY);
        anchor = { col, bufferRow: row + terminal.buffer.active.viewportY };
        showCursorAtCell(col, row);
      }
    }
  };

  screen.addEventListener('touchstart', onTouchStart, { passive: true });
  screen.addEventListener('touchmove', onTouchMove, { passive: true });
  screen.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    container.removeEventListener('touchmove', preventTouchScroll);
    stopMomentum();
    removeCursor();
    anchor = null;
  };
}
