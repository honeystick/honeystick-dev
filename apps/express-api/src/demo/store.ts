import { defaultSeats, defaultStock, DEMO_SEATS, DEMO_STOCK } from './defaults';

/**
 * The demo's inventory, in memory.
 *
 * The same file as the Next store's `lib/demo/store.ts`, minus its
 * `server-only` import - there is no client bundle here for that guard to
 * protect, and the guard itself is a Next construct.
 *
 * Plain stock levels, seeded from the defaults. Not Honeystick usage: a product
 * here is bought once through a one-time-payment plan, and what a metered
 * feature counts is how much of a live plan's allowance has been spent. Those
 * are different questions, and a basket is not the place to ask the second one.
 *
 * One difference from the Next store that is worth knowing rather than
 * discovering: a long-lived Express process keeps these counters for as long as
 * it runs, where a Worker isolate discards them on its own. Here the reset is
 * the only thing that puts them back, which makes it the more load-bearing of
 * the two.
 */

/** ext_id -> units taken */
const stockTaken = new Map<string, number>();

/** ext_id -> seats taken */
const seatsTaken = new Map<string, number>();

/** how many of a product are left */
export function stockLeft(extId: string): number {
  return Math.max(defaultStock(extId) - (stockTaken.get(extId) ?? 0), 0);
}

/** how many seats a subscription has left, or null when it is not limited */
export function seatsLeft(extId: string): number | null {
  const limit = defaultSeats(extId);
  if (limit === null) return null;
  return Math.max(limit - (seatsTaken.get(extId) ?? 0), 0);
}

/**
 * Claiming a seat on a subscription.
 *
 * Returns false when there is none left rather than throwing, because being
 * fully booked is an answer the caller renders, not a fault. Nothing is taken on
 * a refusal, so the same call is safe to make again after a reset.
 *
 * There is no product equivalent on purpose. A basket's stock is settled at
 * checkout, and decrementing on add-to-cart would let a visitor empty the shop
 * without ever buying anything.
 */
export function takeSeat(extId: string): boolean {
  const left = seatsLeft(extId);
  if (left === null) return true;
  if (left <= 0) return false;
  seatsTaken.set(extId, (seatsTaken.get(extId) ?? 0) + 1);
  return true;
}

/** back to the defaults - every counter to zero */
export function reset(): void {
  stockTaken.clear();
  seatsTaken.clear();
}

/** how many things the reset put back, for the confirmation it reports */
export function counterCount(): number {
  return Object.keys(DEMO_STOCK).length + Object.keys(DEMO_SEATS).length;
}
