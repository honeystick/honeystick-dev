import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State backed by localStorage.
 *
 * Simpler than the Next store's version of this, and the difference is worth
 * naming: there is no server render here, so there is no hydration mismatch to
 * avoid. The stored value can be read during the first render rather than
 * arriving an effect later, which means no flash of empty state on load.
 *
 * The reviver is kept, because that reason does apply. Storage holds whatever
 * shape was current on the day it was written and a tab can outlive a deploy -
 * a value that no longer parses is discarded rather than rendered.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  revive?: (raw: unknown) => T,
): [T, (value: T | ((previous: T) => T)) => void] {
  // held in refs so a caller passing an inline object or an inline reviver does
  // not re-run the read on every render
  const initialRef = useRef(initialValue);
  const reviveRef = useRef(revive);
  reviveRef.current = revive;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialRef.current;
      const parsed: unknown = JSON.parse(raw);
      return reviveRef.current ? reviveRef.current(parsed) : (parsed as T);
    } catch {
      return initialRef.current;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // a full or blocked storage is not a reason to break the page
    }
  }, [key, value]);

  /** another tab is the same shopper */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      try {
        const parsed: unknown = event.newValue
          ? JSON.parse(event.newValue)
          : null;
        setValue(
          event.newValue
            ? reviveRef.current
              ? reviveRef.current(parsed)
              : (parsed as T)
            : initialRef.current,
        );
      } catch {
        setValue(initialRef.current);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  // functional form throughout, so the setter never closes over the current
  // value and never has to change identity
  const set = useCallback(
    (next: T | ((previous: T) => T)) =>
      setValue((previous) =>
        next instanceof Function ? next(previous) : next,
      ),
    [],
  );

  return [value, set];
}
