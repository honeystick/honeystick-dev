"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * How many drawers currently want the page behind them held still, and what the
 * page's own overflow was before the first of them asked.
 *
 * Counted at module scope rather than per hook because the store can have two
 * open at once - a service drawer over the cart. Each setting `overflow` on its
 * own would mean the first one to close unlocks the page while the other is
 * still covering it.
 */
let lockCount = 0;
let previousOverflow = "";

/**
 * The behaviour every drawer in the store shares: Escape closes it, Tab cycles
 * within it, focus returns to whatever opened it, and the page behind it does
 * not scroll.
 *
 * Worth having in one place because none of it is optional. A dialog that lets
 * Tab wander out from behind its own backdrop is a dialog a keyboard cannot
 * get out of.
 */
export function useDialog(
  isOpen: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
) {
  const openerRef = useRef<HTMLElement | null>(null);

  // whatever had focus when this opened is what gets it back on close
  useEffect(() => {
    if (isOpen) openerRef.current = document.activeElement as HTMLElement;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      openerRef.current?.focus();
      return;
    }

    const panel = panelRef.current;
    panel?.focus();

    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return;

      /**
       * Collected on each Tab rather than once when the drawer opened. A
       * drawer's contents move - a button disables while a request is in
       * flight, an error message appears - and a list captured at open time
       * would send focus at an element that is no longer there.
       */
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel?.addEventListener("keydown", trap);
    return () => panel?.removeEventListener("keydown", trap);
  }, [isOpen, panelRef]);

  useEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
}
