import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Shrinks a single-line text element's font size, half a pixel at a time, until the text fits its box — never
 * below `min`. Long localised figures ("54,55 Mio. $", "US$5455.45万") then stay fully readable inside a
 * fixed-width card instead of being cut off with an ellipsis; the element keeps `text-overflow: ellipsis` as
 * the last resort below `min`.
 *
 * The element must have a FIXED height (set its line-height in px): the observer watches the element's size,
 * and a font-size change that moved its height would re-trigger the fit in a loop.
 */
export function useFitText<T extends HTMLElement>(text: string, max: number, min: number): RefObject<T | null> {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = max;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, max, min]);
  return ref;
}
