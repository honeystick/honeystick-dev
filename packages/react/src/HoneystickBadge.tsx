'use client';

import { useState, type CSSProperties } from 'react';

/**
 * "Billing by [logo]", as a link back to Honeystick.
 *
 * The pill itself, with no opinion about where it sits. `HoneystickFab` is this
 * component pinned to a corner of the viewport; drop this one into a header, a
 * footer, or beside your own wordmark and it flows with the rest of the page.
 *
 * It lives in the SDK rather than in each sample for the reason any brand mark
 * does: the point is that it is the *same* mark in every integration, and four
 * copies of it in four stores is four things to drift.
 *
 * Self-contained on purpose. No stylesheet to import, no icon file to copy next
 * to it, no CSS custom properties inherited from a host that may not define
 * them: an SDK component that needs three other things installed before it
 * renders correctly is a component people give up on. The mark is inline SVG,
 * and the hover state is React rather than a `:hover` rule, because injecting a
 * stylesheet from a component is how two copies of a package start fighting
 * over one selector.
 */

/**
 * Where the mark points, when the caller does not say.
 *
 * `HS_APP_URL`: the Honeystick **app** - honeystick.co.za in production,
 * dev.honeystick.co.za on the preview deployment, localhost:8081 when it is
 * running on your machine. One per environment, so hard-coding it here would
 * make every integration override the same prop for the same reason.
 *
 * Three names that are easy to confuse, so all three in one place:
 *
 *   - `HS_APP_URL`     - the Honeystick app. Where this badge goes.
 *   - `HONEYSTICK_URL` - the Honeystick **API**. Server-side only, and never
 *                        somewhere a badge would send a person.
 *   - a demo store URL - demo.honeystick.co.za. Not this: a badge on the demo
 *                        store pointing at the demo store is a link to the page
 *                        you are already on.
 *
 * Only statically-named keys are read, because that is the whole mechanism:
 * Next and Expo *substitute* `process.env.NEXT_PUBLIC_X` at build time rather
 * than looking it up at runtime, so a computed key would resolve to nothing.
 * Vite uses `import.meta.env` instead, which cannot be touched from a file
 * Metro also has to parse - so a Vite app passes `href` from its own config,
 * which is what react-store does.
 *
 * The guard is not defensive padding. `process` genuinely does not exist in a
 * browser bundle that nobody shimmed it into, and reading through it unguarded
 * is a ReferenceError that takes the whole page rather than just the badge.
 */
export const honeystickAppUrl = (): string | undefined => {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return (
    process.env.NEXT_PUBLIC_HS_APP_URL ??
    process.env.EXPO_PUBLIC_HS_APP_URL ??
    process.env.HS_APP_URL
  );
};

export type HoneystickBadgeProps = {
  /**
   * Where it goes. Defaults to `HS_APP_URL` from the environment, and to
   * Honeystick's own site when that is unset.
   */
  href?: string;
  /**
   * The accessible name, for screen readers.
   *
   * Not the same string as what is drawn. On screen the badge reads
   * "Billing by" followed by the Honeystick logo, and a logo announces nothing
   * - so the name has to spell out the word the mark is standing in for, or
   * the control is read aloud as "Billing by" and then silence.
   */
  label?: string;
  /**
   * The words in front of the mark. The logo finishes the sentence.
   *
   * Separate from `label` because they are different jobs: this is read, that
   * is announced. Set it to an empty string for the mark on its own.
   */
  caption?: string;
  /**
   * Overall scale. The pill, the type and the mark move together, so a badge
   * tucked beside a wordmark can be smaller without being redrawn.
   */
  size?: 'sm' | 'md';
  /**
   * Lift and shadow on hover. On by default, and worth turning off for a badge
   * sitting inside a header that already has its own surface.
   */
  elevated?: boolean;
  style?: CSSProperties;
  className?: string;
};

/**
 * The Honeystick mark: three cells of honeycomb, drawn rather than fetched.
 *
 * Traced from `assets/logo.svg` in the Honeystick app - the same three
 * hexagons, the same 140x140 viewBox, the same round joins - so this is the
 * brand mark and not an impression of it.
 *
 * `stroke` rather than `fill`, because the artwork is outlines: filling these
 * polygons would produce three solid blobs with no honeycomb left in them.
 * `currentColor` so the mark takes the pill's colour and there is one place to
 * change it.
 *
 * The stroke is widened from the artwork's 6 because this renders at badge
 * size: at 20px on a 140 viewBox, a 6-unit stroke lands under one device pixel
 * and the outlines disappear into a grey smudge.
 */
const Mark = ({ size = 22 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 140 140"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <g fill="none" stroke="currentColor" strokeWidth={10} strokeLinejoin="round">
      {/* two cells above, one centred below - the arrangement is the mark */}
      <polygon points="35,12 59.25,26 59.25,54 35,68 10.75,54 10.75,26" />
      <polygon points="105,12 129.25,26 129.25,54 105,68 80.75,54 80.75,26" />
      <polygon points="70,72 94.25,86 94.25,114 70,128 45.75,114 45.75,86" />
    </g>
  </svg>
);

const SIZES = {
  sm: { height: 32, padding: '0 12px', fontSize: 11, mark: 16, gap: 6 },
  md: { height: 44, padding: '0 16px', fontSize: 13, mark: 22, gap: 8 },
} as const;

export const HoneystickBadge = ({
  href = honeystickAppUrl() ?? 'https://honeystick.co.za',
  label = 'Billing by Honeystick',
  caption = 'Billing by',
  size = 'md',
  elevated = true,
  style,
  className,
}: HoneystickBadgeProps) => {
  const [hovered, setHovered] = useState(false);
  const scale = SIZES[size];

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: scale.gap,
        height: scale.height,
        padding: scale.padding,
        borderRadius: 999,
        /**
         * Honeystick's own colours, not the host's.
         *
         * The ground is Honeystick black and the mark is #facc15, the
         * `--color-primary` the Honeystick app itself runs on, so the badge
         * looks the same wherever it is embedded as it does in the product it
         * points at. A badge that takes on the surrounding site's palette is a
         * badge that has stopped saying who is doing the billing.
         */
        backgroundColor: '#000000',
        color: '#facc15',
        textDecoration: 'none',
        fontSize: scale.fontSize,
        fontWeight: 600,
        fontFamily: 'inherit',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        // a faint honey rim, so a black pill on a dark page still has an edge
        border: '1px solid rgba(250, 204, 21, 0.28)',
        boxShadow: elevated
          ? hovered
            ? '0 12px 28px rgba(0, 0, 0, 0.42)'
            : '0 6px 18px rgba(0, 0, 0, 0.32)'
          : 'none',
        transform: elevated && hovered ? 'translateY(-2px)' : 'none',
        /**
         * Only the lift and the shadow move. Size is deliberately not animated:
         * an interactive element that changes shape under the cursor is a
         * moving target for anyone on a trackpad or with a tremor - and on a
         * touch screen there is no hover at all, so anything revealed by one
         * would simply never appear.
         */
        transition: 'box-shadow 180ms ease, transform 180ms ease',
        ...style,
      }}
    >
      {/* "Billing by" in white, then the logo in honey finishing it. Both are
          always drawn; `aria-hidden` keeps the caption out of the accessibility
          tree so the control is announced once, from `aria-label`, rather than
          as "Billing by Billing by Honeystick". */}
      {caption ? (
        <span aria-hidden="true" style={{ color: '#ffffff' }}>
          {caption}
        </span>
      ) : null}
      <Mark size={scale.mark} />
    </a>
  );
};
