'use server';

import { revalidatePath } from 'next/cache';

import { counterCount, reset } from './store';

export type ResetResult = {
  ok: true;
  /** how many counters were put back, for the confirmation the button shows */
  counters: number;
};

/**
 * Puts the demo back to its defaults.
 *
 * Only ever touches this store's own in-memory fixtures. Nothing here reaches
 * Honeystick, and it deliberately has no live path: with real keys the numbers
 * that matter are someone's actual billing record, and resetting a demo is a
 * demo-only idea.
 *
 * `revalidatePath` on the layout because stock is read during the server render
 * of the shop floor. Without it the counters are back but the page still shows
 * what it rendered before, which reads as the button not working.
 */
export async function resetDemo(): Promise<ResetResult> {
  reset();
  revalidatePath('/', 'layout');
  return { ok: true, counters: counterCount() };
}
