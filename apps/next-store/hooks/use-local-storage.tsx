"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State backed by localStorage, on a page that is server-rendered first.
 *
 * The stored value is deliberately not read while rendering. Two reasons, and
 * the second is the one that bites: on the server `window` does not exist, and
 * on the client the first render has to produce exactly what the server sent or
 * React throws the tree away as a hydration mismatch. So the first paint is
 * always `initialValue`, and the stored value arrives in an effect a tick later.
 *
 * The setter is stable for the life of the component. That matters more than it
 * looks: a setter that changed identity on every write is a moving dependency
 * for every effect that touches the cart, which is how one add-to-cart turns
 * into a render loop.
 */
function useLocalStorage<T>(
  key: string,
  initialValue: T,
  /**
   * What to make of whatever is actually in storage.
   *
   * Left out, the stored JSON is trusted as `T`, which it is only ever
   * guaranteed to be on the day it was written - a shape that has since changed
   * comes back as something the app no longer knows how to render, and the
   * browser has been holding it the whole time. A caller that can tell good from
   * stale passes this and gets to discard the rest.
   */
  revive?: (raw: unknown) => T,
): [T, (value: T | ((val: T) => T)) => void] {
  const [localState, setLocalState] = useState<T>(initialValue);
  // whether the stored value has been read back yet - persisting before that
  // would flush the empty initial value over a real cart on first mount
  const [isLoaded, setIsLoaded] = useState(false);

  // held in a ref so the read effect does not re-run when a caller passes a
  // fresh object literal as its initial value
  const initialRef = useRef(initialValue);
  // same reason, and read the same way: an inline reviver would otherwise be a
  // new function on every render, re-running the read and setting state again
  const reviveRef = useRef(revive);

  const read = useCallback((raw: string) => {
    const parsed: unknown = JSON.parse(raw);
    return reviveRef.current ? reviveRef.current(parsed) : (parsed as T);
  }, []);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      setLocalState(item !== null ? read(item) : initialRef.current);
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      setLocalState(initialRef.current);
    } finally {
      setIsLoaded(true);
    }
  }, [key, read]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(localState));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, localState, isLoaded]);

  const handleSetState = useCallback((value: T | ((val: T) => T)) => {
    // functional form throughout, so the setter never closes over the current
    // value and never has to change identity
    setLocalState((prev) => (value instanceof Function ? value(prev) : value));
  }, []);

  // another tab is the same cart
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key !== key) return;
      try {
        setLocalState(
          event.newValue ? read(event.newValue) : initialRef.current,
        );
      } catch (error) {
        console.warn(`Error reading storage event for "${key}":`, error);
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, read]);

  return [localState, handleSetState];
}

export { useLocalStorage };
