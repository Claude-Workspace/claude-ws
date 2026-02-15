'use client';

import { useEffect, useRef, useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';

interface DetachableWindowProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  initialSize?: { width: number; height: number };
  footer?: React.ReactNode;
  storageKey?: string;
  title?: React.ReactNode;
  titleCenter?: React.ReactNode;
  headerEnd?: React.ReactNode;
  key?: string;
  /** Dynamic z-index for window layering (default: 60) */
  zIndex?: number;
  /** Callback when window is clicked/focused to bring to front */
  onFocus?: () => void;
}

const DEFAULT_SIZE = { width: 500, height: 800 };
const HEADER_HEIGHT = 48;
const STORAGE_KEY_PREFIX = 'detachable-window-';
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const RESIZE_HANDLE_SIZE = 12;

interface StoredWindowData {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

// Calculate bottom center position
function getBottomCenterPosition(width: number, height: number): { x: number; y: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    x: (viewportWidth - width) / 2,
    y: viewportHeight - height - 20, // 20px padding from bottom
  };
}

// Load window data (position + size) from localStorage
function loadWindowData(
  storageKey: string,
  defaultSize: { width: number; height: number }
): { position: { x: number; y: number }; size: { width: number; height: number } } {
  if (typeof window === 'undefined') {
    return {
      position: getBottomCenterPosition(defaultSize.width, defaultSize.height),
      size: defaultSize,
    };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as StoredWindowData;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Validate size is within reasonable bounds
      const validWidth = Math.max(MIN_WIDTH, Math.min(parsed.width, viewportWidth));
      const validHeight = Math.max(MIN_HEIGHT, Math.min(parsed.height, viewportHeight));

      // Validate position is within viewport
      const validX = Math.max(0, Math.min(parsed.x, viewportWidth - validWidth));
      const validY = Math.max(0, Math.min(parsed.y, viewportHeight - validHeight));

      return {
        position: { x: validX, y: validY },
        size: { width: validWidth, height: validHeight },
      };
    }
  } catch {
    // Ignore storage errors
  }

  return {
    position: getBottomCenterPosition(defaultSize.width, defaultSize.height),
    size: defaultSize,
  };
}

// Save window data (position + size) to localStorage
function saveWindowData(storageKey: string, position: { x: number; y: number }, size: { width: number; height: number }) {
  if (typeof window === 'undefined') return;

  try {
    const data: StoredWindowData = {
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(size.width),
      height: Math.round(size.height),
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + storageKey, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function DetachableWindow({
  isOpen,
  onClose,
  children,
  className,
  initialSize = DEFAULT_SIZE,
  footer,
  storageKey = 'chat',
  title,
  titleCenter,
  headerEnd,
  key,
  zIndex = 60,
  onFocus,
}: DetachableWindowProps) {
  const isMobile = useIsMobileViewport();
  const [{ position, size }, setWindowState] = useState(() =>
    loadWindowData(storageKey, initialSize)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartSize = useRef({ width: 0, height: 0 });
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [isOpenState, setIsOpenState] = useState(isOpen);

  // Sync isOpen prop with internal state
  useEffect(() => {
    setIsOpenState(isOpen);
    // Reload saved position/size when reopening (desktop only)
    if (isOpen && !isMobile) {
      const saved = loadWindowData(storageKey, initialSize);
      setWindowState({ position: saved.position, size: saved.size });
    }
  }, [isOpen, storageKey, initialSize, isMobile]);

  // Reset isOpenState when the component re-renders while in detached mode
  useEffect(() => {
    if (isOpen && !isOpenState) {
      setIsOpenState(true);
    }
  }, [isOpen, isOpenState]);

  const handleClose = () => {
    setIsOpenState(false);
    onClose?.();
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMobile) return;
    // Only drag from header area
    if ((e.target as HTMLElement).closest('[data-no-drag]')) {
      return;
    }

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartPosition.current = { ...position };
    e.preventDefault();
  };

  const handleResizeStart = (direction: ResizeDirection, e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    setResizeDirection(direction);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartSize.current = { ...size };
    dragStartPosition.current = { ...position };
  };

  const updatePosition = (newPosition: { x: number; y: number }) => {
    setWindowState((prev) => ({ ...prev, position: newPosition }));
  };

  const updateSize = (newSize: { width: number; height: number }) => {
    setWindowState((prev) => ({ ...prev, size: newSize }));
  };

  // Handle dragging (desktop only)
  useEffect(() => {
    if (!isDragging || isMobile) return;

    const startPos = dragStartPosition.current;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      updatePosition({
        x: startPos.x + dx,
        y: startPos.y + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Get current state for saving
      setWindowState((current) => {
        saveWindowData(storageKey, current.position, current.size);
        return current;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, storageKey, isMobile]);

  // Handle resizing from all sides/corners (desktop only)
  useEffect(() => {
    if (!resizeDirection || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      let newSize = { ...size };
      let newPos = { ...position };
      const startSize = dragStartSize.current;
      const startPos = dragStartPosition.current;

      // Handle horizontal resizing
      if (resizeDirection.includes('e')) {
        newSize.width = Math.max(MIN_WIDTH, startSize.width + dx);
      }
      if (resizeDirection.includes('w')) {
        const newWidth = Math.max(MIN_WIDTH, startSize.width - dx);
        newSize.width = newWidth;
        newPos.x = startPos.x + (startSize.width - newWidth);
      }

      // Handle vertical resizing
      if (resizeDirection.includes('s')) {
        newSize.height = Math.max(MIN_HEIGHT, startSize.height + dy);
      }
      if (resizeDirection.includes('n')) {
        const newHeight = Math.max(MIN_HEIGHT, startSize.height - dy);
        newSize.height = newHeight;
        newPos.y = startPos.y + (startSize.height - newHeight);
      }

      setWindowState({ position: newPos, size: newSize });
    };

    const handleMouseUp = () => {
      setResizeDirection(null);
      // Get current state for saving
      setWindowState((current) => {
        saveWindowData(storageKey, current.position, current.size);
        return current;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeDirection, storageKey, isMobile]);

  // Ensure window stays within viewport (desktop only)
  useEffect(() => {
    if (!windowRef.current || isMobile) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let needsUpdate = false;
    let newPos = { ...position };
    let newSize = { ...size };

    // Constrain size
    if (size.width > viewportWidth) {
      newSize.width = viewportWidth;
      needsUpdate = true;
    }
    if (size.height > viewportHeight) {
      newSize.height = viewportHeight;
      needsUpdate = true;
    }

    // Constrain position
    if (position.x < 0) {
      newPos.x = 0;
      needsUpdate = true;
    }
    if (position.y < 0) {
      newPos.y =  0;
      needsUpdate = true;
    }
    if (position.x + newSize.width > viewportWidth) {
      newPos.x = Math.max(0, viewportWidth - newSize.width);
      needsUpdate = true;
    }
    if (position.y + newSize.height > viewportHeight) {
      newPos.y = Math.max(0, viewportHeight - newSize.height);
      needsUpdate = true;
    }

    if (needsUpdate) {
      setWindowState({ position: newPos, size: newSize });
      saveWindowData(storageKey, newPos, newSize);
    }
  }, [position, size, storageKey, isMobile]);

  if (!isOpenState) return null;

  // Handle bringing window to front on mousedown
  const handleWindowFocus = () => {
    onFocus?.();
  };

  // Mobile: simple flex container that fills its parent
  if (isMobile) {
    return (
      <div
        ref={windowRef}
        className={cn(
          'flex flex-col flex-1 min-h-0 bg-background',
          className
        )}
      >
        {/* Header - no drag */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 select-none gap-2 relative"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {title || (
              <span className="text-sm font-medium">Chat</span>
            )}
          </div>
          {titleCenter && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground text-center line-clamp-2 max-w-[50%] leading-tight font-medium">
              {titleCenter}
            </div>
          )}
          <div className="flex items-center gap-1 min-w-0" data-no-drag>
            {headerEnd}
            <button
              onClick={handleClose}
              className="p-1 hover:bg-accent rounded transition-colors shrink-0"
              title="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div ref={contentScrollRef} className="flex-1 overflow-auto" data-detached-scroll-container>
            {children}
          </div>
          {footer && (
            <div className="flex-shrink-0 bg-background">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: fixed positioned, draggable, resizable window
  return (
    <div
      ref={windowRef}
      onMouseDown={handleWindowFocus}
      className={cn(
        'fixed bg-background border-2 shadow-lg rounded-lg overflow-hidden flex flex-col',
        isDragging && 'cursor-grabbing',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: zIndex,
      }}
    >
      {/* Draggable Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 cursor-grab hover:bg-muted/50 transition-colors select-none gap-2 relative"
        onMouseDown={handleDragStart}
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {title || (
            <>
              <GripVertical className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">Chat</span>
            </>
          )}
        </div>
        {titleCenter && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground text-center line-clamp-2 max-w-[50%] leading-tight font-medium">
                {titleCenter}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="break-words whitespace-pre-wrap">{String(titleCenter)}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <div className="flex items-center gap-1 min-w-0" data-no-drag>
          {headerEnd}
          <button
            onClick={handleClose}
            className="p-1 hover:bg-accent rounded transition-colors shrink-0"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div ref={contentScrollRef} className="flex-1 overflow-auto" data-detached-scroll-container>
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 bg-background">
            {footer}
          </div>
        )}
      </div>

      {/* Resize Handles - 4 Corners */}
      {/* Top-Left */}
      <div
        className="absolute top-0 left-0 cursor-nwse-resize hover:opacity-100 opacity-50 transition-opacity"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          background: 'linear-gradient(135deg, hsl(var(--border)) 50%, transparent 50%)',
        }}
        onMouseDown={(e) => handleResizeStart('nw', e)}
      />
      {/* Top-Right */}
      <div
        className="absolute top-0 right-0 cursor-nesw-resize hover:opacity-100 opacity-50 transition-opacity"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          background: 'linear-gradient(-135deg, hsl(var(--border)) 50%, transparent 50%)',
        }}
        onMouseDown={(e) => handleResizeStart('ne', e)}
      />
      {/* Bottom-Left */}
      <div
        className="absolute bottom-0 left-0 cursor-nesw-resize hover:opacity-100 opacity-50 transition-opacity"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          background: 'linear-gradient(45deg, hsl(var(--border)) 50%, transparent 50%)',
        }}
        onMouseDown={(e) => handleResizeStart('sw', e)}
      />
      {/* Bottom-Right */}
      <div
        className="absolute bottom-0 right-0 cursor-nwse-resize hover:opacity-100 opacity-50 transition-opacity"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          background: 'linear-gradient(-45deg, hsl(var(--border)) 50%, transparent 50%)',
        }}
        onMouseDown={(e) => handleResizeStart('se', e)}
      />
      {/* Resize Handles - 4 Edges */}
      {/* Top */}
      <div
        className="absolute top-0 left-0 right-0 cursor-ns-resize hover:opacity-100 opacity-0 transition-opacity"
        style={{
          height: '8px',
          marginTop: '-4px',
          background: 'transparent',
        }}
        onMouseDown={(e) => handleResizeStart('n', e)}
      />
      {/* Bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 cursor-ns-resize hover:opacity-100 opacity-0 transition-opacity"
        style={{
          height: '8px',
          marginBottom: '-4px',
          background: 'transparent',
        }}
        onMouseDown={(e) => handleResizeStart('s', e)}
      />
      {/* Left */}
      <div
        className="absolute top-0 bottom-0 left-0 cursor-ew-resize hover:opacity-100 opacity-0 transition-opacity"
        style={{
          width: '8px',
          marginLeft: '-4px',
          background: 'transparent',
        }}
        onMouseDown={(e) => handleResizeStart('w', e)}
      />
      {/* Right */}
      <div
        className="absolute top-0 bottom-0 right-0 cursor-ew-resize hover:opacity-100 opacity-0 transition-opacity"
        style={{
          width: '8px',
          marginRight: '-4px',
          background: 'transparent',
        }}
        onMouseDown={(e) => handleResizeStart('e', e)}
      />
    </div>
  );
}
