import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';

export interface PanZoomView {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.6;
const MAX_K = 4;
const IDENTITY: PanZoomView = { x: 0, y: 0, k: 1 };

/**
 * Pan and zoom for an SVG drawn in a `width × height` viewBox. Drag to pan; Ctrl/⌘ + wheel, the `+` / `-` keys or
 * the on-screen buttons to zoom; arrow keys pan; `0` resets. A plain wheel is left alone so the page still scrolls.
 * `consumeDrag()` tells a click handler that the pointer travelled (a pan), so a drag does not also "click" a node.
 */
export function usePanZoom(width: number, height: number) {
  const [view, setView] = useState<PanZoomView>(IDENTITY);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const dragged = useRef(false);

  const clamp = useCallback(
    (v: PanZoomView): PanZoomView => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
      const margin = 0.3;
      return { k, x: Math.min(width * margin, Math.max(width - width * k - width * margin, v.x)), y: Math.min(height * margin, Math.max(height - height * k - height * margin, v.y)) };
    },
    [width, height],
  );

  /** Zoom by `factor`, keeping the viewBox point (px, py) where it is on screen (default: the centre). */
  const zoomBy = useCallback(
    (factor: number, px = width / 2, py = height / 2) =>
      setView((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
        const ratio = k / v.k;
        return clamp({ k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio });
      }),
    [clamp, width, height],
  );
  const panBy = useCallback((dx: number, dy: number) => setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy })), [clamp]);
  const reset = useCallback(() => setView(IDENTITY), []);

  const toViewBox = (e: { clientX: number; clientY: number; currentTarget: Element }): { px: number; py: number; scale: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = width / Math.max(1, rect.width);
    return { px: (e.clientX - rect.left) * scale, py: (e.clientY - rect.top) * scale, scale };
  };

  const handlers = {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      dragged.current = false;
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.moved += Math.abs(dx) + Math.abs(dy);
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.moved < 6) return; // a click, not a drag
      if (!dragged.current) {
        dragged.current = true;
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      const { scale } = toViewBox(e);
      panBy(dx * scale, dy * scale);
    },
    onPointerUp: (e: PointerEvent<SVGSVGElement>) => {
      if (drag.current?.id === e.pointerId) drag.current = null;
      setDragging(false);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDragging(false);
    },
    onWheel: (e: WheelEvent<SVGSVGElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { px, py } = toViewBox(e);
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py);
    },
    onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
      const step = 40;
      const map: Record<string, () => void> = {
        '+': () => zoomBy(1.25),
        '=': () => zoomBy(1.25),
        '-': () => zoomBy(0.8),
        _: () => zoomBy(0.8),
        '0': reset,
        ArrowLeft: () => panBy(step, 0),
        ArrowRight: () => panBy(-step, 0),
        ArrowUp: () => panBy(0, step),
        ArrowDown: () => panBy(0, -step),
      };
      const action = map[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    },
  };

  /** True once after a drag, so the click that ends it can be ignored. */
  const consumeDrag = useCallback((): boolean => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  }, []);

  return { view, dragging, handlers, zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(0.8), reset, consumeDrag, canReset: view.k !== 1 || view.x !== 0 || view.y !== 0 };
}
