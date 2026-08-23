/**
 * What the demo starts with, and what "Reset" puts back.
 *
 * The numbers are small on purpose. A demo where the last daypack is 120 adds
 * to the cart away is a demo where nothing ever runs out, so the interesting
 * half of the shop floor - the count reaching zero, the plus going dead - is
 * never reachable by clicking. Single digits mean a visitor sees it in under a
 * minute.
 *
 * Deliberately not modelled as metered Honeystick features. Goods here are
 * bought once, through a one-time-payment plan, and usage metering answers a
 * different question - how much of an allowance a live plan has spent. Stock is
 * inventory, and conflating the two would put a `track` call in the middle of a
 * basket flow where it has no business being.
 */

/**
 * Stock on hand per product, keyed on `ext_id` - the identifier the store
 * chooses and Honeystick preserves, so this survives a catalogue rebuild in a
 * way that row ids would not.
 */
export const DEMO_STOCK: Record<string, number> = {
  'trail-daypack': 5,
  'slim-fit-tee': 8,
  'cotton-jacket': 4,
  'casual-slim-shirt': 6,
  'dragon-chain-bracelet': 2,
  'micropave-band': 3,
  'princess-solitaire': 3,
  'rose-gold-earrings': 9,
};

/** seats per subscription - a service can be fully booked too */
export const DEMO_SEATS: Record<string, number> = {
  'depot-insiders': 3,
  'depot-delivery': 2,
};

/**
 * Anything the catalogue returns that these fixtures have never heard of.
 *
 * A live organization can add a plan at any time and the store has to keep
 * selling it, so an unknown `ext_id` gets a stock figure rather than a zero -
 * which would read as sold out on a product that has never been sold.
 */
export const DEMO_FALLBACK_STOCK = 5;

/** the stock a product starts with, fixture or not */
export function defaultStock(extId: string): number {
  return DEMO_STOCK[extId] ?? DEMO_FALLBACK_STOCK;
}

/** the seats a service starts with, or null when it is not seat-limited */
export function defaultSeats(extId: string): number | null {
  return DEMO_SEATS[extId] ?? null;
}
