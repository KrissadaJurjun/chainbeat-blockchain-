import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePanZoom } from './usePanZoom';

const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 520 }), setPointerCapture: () => undefined } as unknown as SVGSVGElement;
const pointer = (type: 'down' | 'move' | 'up', x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y, currentTarget: svg, type }) as never;

describe('usePanZoom', () => {
  it('zooms in and out within limits and resets to the identity view', () => {
    const { result } = renderHook(() => usePanZoom(800, 520));
    expect(result.current.view).toEqual({ x: 0, y: 0, k: 1 });
    expect(result.current.canReset).toBe(false);
    act(() => result.current.zoomIn());
    expect(result.current.view.k).toBeCloseTo(1.25, 6);
    expect(result.current.canReset).toBe(true);
    for (let i = 0; i < 30; i++) act(() => result.current.zoomIn());
    expect(result.current.view.k).toBe(4);
    for (let i = 0; i < 60; i++) act(() => result.current.zoomOut());
    expect(result.current.view.k).toBe(0.6);
    act(() => result.current.reset());
    expect(result.current.view).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('keeps the point under the cursor fixed while zooming with Ctrl/⌘ + wheel, and ignores a plain wheel', () => {
    const { result } = renderHook(() => usePanZoom(800, 520));
    const wheel = (ctrlKey: boolean) => ({ ctrlKey, metaKey: false, deltaY: -100, clientX: 200, clientY: 100, currentTarget: svg, preventDefault: () => undefined }) as never;
    act(() => result.current.handlers.onWheel(wheel(false)));
    expect(result.current.view.k).toBe(1);
    act(() => result.current.handlers.onWheel(wheel(true)));
    const { x, y, k } = result.current.view;
    expect(k).toBeCloseTo(1.15, 6);
    // the viewBox point (200, 100) must map to the same place before and after
    expect(x + 200 * k).toBeCloseTo(200, 4);
    expect(y + 100 * k).toBeCloseTo(100, 4);
  });

  it('drags to pan, and reports the drag once so the click that ends it can be ignored', () => {
    const { result } = renderHook(() => usePanZoom(800, 520));
    act(() => result.current.zoomIn()); // panning is only meaningful when zoomed
    const before = result.current.view;
    act(() => result.current.handlers.onPointerDown(pointer('down', 100, 100)));
    act(() => result.current.handlers.onPointerMove(pointer('move', 103, 101))); // below the threshold: still a click
    expect(result.current.dragging).toBe(false);
    act(() => result.current.handlers.onPointerMove(pointer('move', 140, 120)));
    expect(result.current.dragging).toBe(true);
    expect(result.current.view.x).toBeGreaterThan(before.x); // dragged right: the drawing follows the pointer
    act(() => result.current.handlers.onPointerUp(pointer('up', 140, 120)));
    expect(result.current.dragging).toBe(false);
    expect(result.current.consumeDrag()).toBe(true);
    expect(result.current.consumeDrag()).toBe(false);
  });

  it('has keyboard shortcuts: + / - zoom, arrows pan, 0 resets', () => {
    const { result } = renderHook(() => usePanZoom(800, 520));
    const key = (k: string) => ({ key: k, preventDefault: () => undefined }) as never;
    act(() => result.current.handlers.onKeyDown(key('+')));
    expect(result.current.view.k).toBeCloseTo(1.25, 6);
    const x0 = result.current.view.x;
    act(() => result.current.handlers.onKeyDown(key('ArrowLeft'))); // "left" moves the drawing right, i.e. the view to the left
    expect(result.current.view.x - x0).toBe(40);
    act(() => result.current.handlers.onKeyDown(key('-')));
    expect(result.current.view.k).toBeCloseTo(1, 6);
    act(() => result.current.handlers.onKeyDown(key('0')));
    expect(result.current.view).toEqual({ x: 0, y: 0, k: 1 });
  });
});
