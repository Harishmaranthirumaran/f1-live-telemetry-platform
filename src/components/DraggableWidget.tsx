import React, { useState, useRef, useEffect } from 'react';

interface DraggableWidgetProps {
  id: string;
  title: string;
  defaultX: number;
  defaultY: number;
  width?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  onClose?: () => void;
  children: React.ReactNode;
}

const LAYOUT_VERSION = 'f1-hud-v4';
const VIEWPORT_PADDING = 16;
const VIEWPORT_BOTTOM_PADDING = 48;

type WidgetLayout = {
  x: number;
  y: number;
  width: number;
  height?: number;
};

export default function DraggableWidget({
  id,
  title,
  defaultX,
  defaultY,
  width,
  defaultHeight,
  minWidth = 260,
  minHeight = 160,
  onClose,
  children,
}: DraggableWidgetProps) {
  const storageKey = `hud_widget_${LAYOUT_VERSION}_${id}`;
  const defaultWidth = width ?? 360;
  const [layout, setLayout] = useState<WidgetLayout>({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; initialWidth: number; initialHeight: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef(layout);
  const hasSavedPositionRef = useRef(false);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  function getViewportCoordinateBounds(widgetWidth: number, widgetHeight: number) {
    const parentRect = widgetRef.current?.offsetParent instanceof HTMLElement
      ? widgetRef.current.offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };

    const minX = VIEWPORT_PADDING - parentRect.left;
    const maxX = window.innerWidth - parentRect.left - widgetWidth - VIEWPORT_PADDING;
    const minY = VIEWPORT_PADDING - parentRect.top;
    const maxY = window.innerHeight - parentRect.top - widgetHeight - VIEWPORT_BOTTOM_PADDING;

    return {
      minX,
      maxX: Math.max(minX, maxX),
      minY,
      maxY: Math.max(minY, maxY),
    };
  }

  function clampToViewport(value: number, min: number, max: number) {
    return Math.max(min, Math.min(value, max));
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const frameId = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<WidgetLayout>;
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const widgetWidth = typeof parsed.width === 'number' ? parsed.width : defaultWidth;
            const boundedWidth = Math.max(minWidth, Math.min(widgetWidth, window.innerWidth - VIEWPORT_PADDING * 2));
            const boundedHeight = typeof parsed.height === 'number'
              ? Math.max(minHeight, Math.min(parsed.height, window.innerHeight - VIEWPORT_PADDING - VIEWPORT_BOTTOM_PADDING))
              : defaultHeight;
            const bounds = getViewportCoordinateBounds(boundedWidth, boundedHeight ?? minHeight);
            const boundedX = clampToViewport(parsed.x, bounds.minX, bounds.maxX);
            const boundedY = clampToViewport(parsed.y, bounds.minY, bounds.maxY);
            hasSavedPositionRef.current = true;
            setLayout({ x: boundedX, y: boundedY, width: boundedWidth, height: boundedHeight });
            return;
          }
        } catch {
          // Ignore invalid saved positions and fall back to this layout version.
        }
      }

      hasSavedPositionRef.current = false;
      setLayout({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [defaultHeight, defaultWidth, defaultX, defaultY, minHeight, minWidth, storageKey]);

  useEffect(() => {
    if (hasSavedPositionRef.current) return;
    if (typeof window === 'undefined') return;
    const frameId = window.requestAnimationFrame(() => {
      if (hasSavedPositionRef.current) return;
      setLayout({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [defaultHeight, defaultWidth, defaultX, defaultY]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: layout.x,
      initialY: layout.y
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: layout.width,
      initialHeight: layout.height ?? minHeight,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      // Snap to 20px grid
      const newX = Math.round((dragRef.current.initialX + dx) / 20) * 20;
      const newY = Math.round((dragRef.current.initialY + dy) / 20) * 20;

      const widgetWidth = layoutRef.current.width;
      const widgetHeight = layoutRef.current.height ?? minHeight;
      const bounds = getViewportCoordinateBounds(widgetWidth, widgetHeight);
      const boundedX = clampToViewport(newX, bounds.minX, bounds.maxX);
      const boundedY = clampToViewport(newY, bounds.minY, bounds.maxY);

      setLayout((current) => ({ ...current, x: boundedX, y: boundedY }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Save position when dragging ends
      if (typeof window !== 'undefined') {
        hasSavedPositionRef.current = true;
        window.localStorage.setItem(storageKey, JSON.stringify(layoutRef.current));
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minHeight, storageKey]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      const nextWidth = Math.round((resizeRef.current.initialWidth + dx) / 20) * 20;
      const nextHeight = Math.round((resizeRef.current.initialHeight + dy) / 20) * 20;
      const boundedWidth = Math.max(minWidth, Math.min(nextWidth, window.innerWidth - VIEWPORT_PADDING * 2));
      const boundedHeight = Math.max(minHeight, Math.min(nextHeight, window.innerHeight - VIEWPORT_PADDING - VIEWPORT_BOTTOM_PADDING));

      setLayout((current) => {
        const bounds = getViewportCoordinateBounds(boundedWidth, boundedHeight);
        return {
          ...current,
          x: clampToViewport(current.x, bounds.minX, bounds.maxX),
          y: clampToViewport(current.y, bounds.minY, bounds.maxY),
          width: boundedWidth,
          height: boundedHeight,
        };
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (typeof window !== 'undefined') {
        hasSavedPositionRef.current = true;
        window.localStorage.setItem(storageKey, JSON.stringify(layoutRef.current));
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minHeight, minWidth, storageKey]);

  return (
    <div
      ref={widgetRef}
      className={`hud-widget ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: collapsed ? 'auto' : layout.height,
      }}
    >
      <div
        className="hud-widget-header"
        onMouseDown={handleMouseDown}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', userSelect: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginLeft: '6px' }}>
          <button
            type="button"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px 5px',
              fontSize: '13px',
              lineHeight: 1,
              borderRadius: '3px',
            }}
          >
            {collapsed ? '+' : '−'}
          </button>
          {onClose && (
            <button
              type="button"
              aria-label={`Close ${title}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 5px',
                fontSize: '13px',
                lineHeight: 1,
                borderRadius: '3px',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="hud-widget-content" style={{ padding: '12px' }}>
            {children}
          </div>
          <button
            type="button"
            className="hud-widget-resize"
            aria-label={`Resize ${title}`}
            onMouseDown={handleResizeMouseDown}
          />
        </>
      )}
    </div>
  );
}
