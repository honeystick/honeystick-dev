/**
 * The Depot's palette, as the web store's CSS custom properties define it.
 *
 * Kept as one object rather than scattered through StyleSheets so the two stores
 * can be held side by side and seen to be the same shop. React Native has no
 * cascade to inherit these from, so they are passed by hand - which is why there
 * is exactly one place to change them.
 */
export const theme = {
  bgPrimary: '#ffffff',
  bgSecondary: '#faf7ff',
  bgMuted: '#241b3a',
  colorPrimary: '#2b2440',
  colorSecondary: '#4b3f9e',
  colorAlt: '#7c5cc4',
  colorLight: '#ffffff',
  danger: '#b3261e',
  /** a payment that cleared - the one green thing in the shop */
  success: '#2fd07a',
  spacing: 16,
} as const;

/** what a price looks like in this shop */
export const money = (amount: number) => `R${amount.toFixed(2)}`;
