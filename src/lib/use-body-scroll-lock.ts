import { useEffect, useRef } from "react";

export function useBodyScrollLock(locked: boolean) {
  const originalOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (!locked) {
      if (originalOverflow.current !== null) {
        document.body.style.overflow = originalOverflow.current;
        originalOverflow.current = null;
      }
      return;
    }

    if (originalOverflow.current === null) {
      originalOverflow.current = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";

    return () => {
      if (originalOverflow.current !== null) {
        document.body.style.overflow = originalOverflow.current;
        originalOverflow.current = null;
      }
    };
  }, [locked]);
}
