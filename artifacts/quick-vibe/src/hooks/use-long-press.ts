import { useRef, useCallback } from "react";

export function useLongPress(callback: () => void, delay = 480) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const firedRef = useRef(false);

  const start = useCallback(() => {
    movedRef.current = false;
    firedRef.current = false;
    timeoutRef.current = setTimeout(() => {
      if (!movedRef.current) {
        firedRef.current = true;
        callback();
      }
    }, delay);
  }, [callback, delay]);

  const stop = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const onMove = useCallback(() => { movedRef.current = true; }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); start(); },
    onTouchEnd: stop,
    onTouchMove: onMove,
  };
}
