'use client';

import type { CSSProperties } from 'react';

import {
  HoneystickBadge,
  type HoneystickBadgeProps,
} from './HoneystickBadge.js';

/**
 * The Honeystick badge, pinned to a corner of the viewport.
 *
 * `HoneystickBadge` with a position on it, and nothing else. The pill, the
 * mark, the colours and the link all live there - which is what lets the same
 * badge sit in a header (see the Depot's) and float over a page without the two
 * being able to drift apart.
 */
export type HoneystickFabProps = Omit<HoneystickBadgeProps, 'style'> & {
  /** which corner it sits in */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /**
   * How far from the two edges of that corner, in pixels. The device's own
   * safe-area inset is added to it rather than replaced by it, so this stays
   * the gap you actually see on a phone with a home indicator.
   */
  offset?: number;
  /**
   * Stacking order. High by default because the whole job is being reachable
   * from anywhere - a FAB behind a sticky header is a FAB that does not exist -
   * and lowered rather than raised when an app has a modal that must cover it.
   */
  zIndex?: number;
  style?: CSSProperties;
};

/**
 * Which corner, and nothing about direction.
 *
 * These used to flip to `row-reverse` on the right-hand corners so that a label
 * expanding on hover grew inward, away from the screen edge. Nothing expands
 * now - the badge is one fixed size - and "Billing by" has to come before the
 * mark it hands off to, in every corner, because reversing it would render the
 * logo first and leave the sentence backwards.
 */
const CORNERS: Record<
  NonNullable<HoneystickFabProps['position']>,
  CSSProperties
> = {
  'bottom-right': { bottom: 0, right: 0 },
  'bottom-left': { bottom: 0, left: 0 },
  'top-right': { top: 0, right: 0 },
  'top-left': { top: 0, left: 0 },
};

export const HoneystickFab = ({
  position = 'bottom-right',
  offset = 24,
  zIndex = 900,
  style,
  ...badge
}: HoneystickFabProps) => (
  <HoneystickBadge
    {...badge}
    style={{
      position: 'fixed',
      ...CORNERS[position],
      /**
       * The corner object pins two edges at 0; these push it off both.
       *
       * `env(safe-area-inset-*)` is added rather than assumed, because the two
       * are answering different questions: `offset` is the gap the design
       * wants, and the inset is the part of the screen the hardware has already
       * taken - a home indicator, a notch, a rounded corner. A FAB that only
       * honours the first sits *under* the home indicator on an iPhone in a
       * standalone PWA, where it is both unreadable and, on the bottom edge,
       * un-tappable because the system claims that gesture.
       *
       * The `0px` fallback matters: `env()` with no fallback resolves to
       * nothing on a browser that does not know the keyword, which makes the
       * whole `calc()` invalid and drops the offset entirely. It is also 0 on
       * any page whose viewport meta lacks `viewport-fit=cover`, which is the
       * host's call to make and not this component's.
       */
      marginTop: `calc(${offset}px + env(safe-area-inset-top, 0px))`,
      marginBottom: `calc(${offset}px + env(safe-area-inset-bottom, 0px))`,
      marginLeft: `calc(${offset}px + env(safe-area-inset-left, 0px))`,
      marginRight: `calc(${offset}px + env(safe-area-inset-right, 0px))`,
      zIndex,
      ...style,
    }}
  />
);
