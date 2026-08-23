'use client';

import { useState, type CSSProperties } from 'react';

/**
 * The way back to Honeystick, from anywhere in an app that bills through it.
 *
 * It lives in the SDK rather than in each sample for the reason any brand mark
 * does: the point is that it is the *same* mark in every integration, and four
 * copies of it in four stores is four things to drift. A caller who wants a
 * different one is not blocked - this is an ordinary component and the whole
 * thing is 60 lines - but nobody has to build one to get a good default.
 *
 * Self-contained on purpose. No stylesheet to import, no icon file to copy
 * next to it, no CSS custom properties inherited from a host that may not
 * define them: an SDK component that needs three other things installed before
 * it renders correctly is a component people give up on. The mark below is the
 * Honeystick brackets, inline, and the hover state is React rather than a
 * `:hover` rule, because injecting a stylesheet from a component is how two
 * copies of a package start fighting over one selector.
 */

export type HoneystickFabProps = {
  /** where it goes. Defaults to Honeystick's own site. */
  href?: string;
  /** the text that appears alongside the mark on hover */
  label?: string;
  /** which corner it sits in */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** how far from the two edges of that corner, in pixels */
  offset?: number;
  /**
   * Stacking order. High by default because the whole job is being reachable
   * from anywhere - a FAB behind a sticky header is a FAB that does not exist -
   * and lowered rather than raised when an app has a modal that must cover it.
   */
  zIndex?: number;
  style?: CSSProperties;
};

const CORNERS: Record<
  NonNullable<HoneystickFabProps['position']>,
  CSSProperties
> = {
  'bottom-right': { bottom: 0, right: 0, flexDirection: 'row-reverse' },
  'bottom-left': { bottom: 0, left: 0, flexDirection: 'row' },
  'top-right': { top: 0, right: 0, flexDirection: 'row-reverse' },
  'top-left': { top: 0, left: 0, flexDirection: 'row' },
};

/** the Honeystick brackets, as markup rather than as a file to go and fetch */
const Mark = () => (
  <svg
    width="18"
    height="16"
    viewBox="0 0 37.374 33.701"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <g fill="currentColor">
      <rect width="16.314" height="4.897" x="10.53" y="9.574" />
      <rect width="16.314" height="4.897" x="10.53" y="19.163" />
      <path d="M4.9 0H0v33.7h14.75v-4.9H4.9V4.9h9.85V0Z" />
      <path d="M32.478 0H22.352v4.9h10.126v23.9H22.352v4.9h15.022V0Z" />
    </g>
  </svg>
);

export const HoneystickFab = ({
  href = 'https://honeystick.co.za',
  label = 'Billing by Honeystick',
  position = 'bottom-right',
  offset = 24,
  zIndex = 900,
  style,
}: HoneystickFabProps) => {
  const [hovered, setHovered] = useState(false);
  const corner = CORNERS[position];

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        position: 'fixed',
        ...corner,
        // the corner object pins two edges at 0; the offset pushes it off both
        margin: offset,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        gap: hovered ? 8 : 0,
        height: 48,
        padding: hovered ? '0 18px' : 0,
        width: hovered ? 'auto' : 48,
        justifyContent: 'center',
        borderRadius: 999,
        // the same rainbow the stores use, so the mark reads as belonging to
        // the same family without the host having to define a variable
        backgroundImage:
          'linear-gradient(120deg, #6b5ce7, #b45cff 55%, #2f9bff)',
        color: '#ffffff',
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        boxShadow: hovered
          ? '0 12px 28px rgba(43, 36, 64, 0.34)'
          : '0 6px 18px rgba(43, 36, 64, 0.24)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        // `width` and `padding` are in the transition on purpose - without them
        // the label appears by snapping the button to its new size, which reads
        // as a layout bug rather than as an expansion
        transition:
          'width 180ms ease, padding 180ms ease, gap 180ms ease, box-shadow 180ms ease, transform 180ms ease',
        overflow: 'hidden',
        ...style,
      }}
    >
      <Mark />
      {/* rendered only when open, so a collapsed button has nothing to clip
          and screen readers get the label from aria-label either way */}
      {hovered && <span>{label}</span>}
    </a>
  );
};
