import { useEffect } from 'react';

/** Set the browser tab title for the current page (suffix is the product name). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ChainBeat` : 'ChainBeat — Blockchain Explorer';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
