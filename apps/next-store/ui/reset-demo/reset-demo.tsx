'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useCart } from '@/hooks/use-cart';
import { resetDemo } from '@/lib/demo/actions';

import styles from './reset-demo.module.css';

/**
 * Putting the demo back.
 *
 * The Depot's shelves and its subscription seats are small fixtures held in
 * memory, so a visitor can empty them - which is the point, and also why there
 * has to be a way back. It belongs on every page rather than tucked into one:
 * whichever page you exhausted is the page you want to refill from.
 *
 * Three things move together, and missing any one of them looks like the button
 * not working:
 *
 *   1. the server's counters, which is the actual reset
 *   2. the server render, since stock is read while rendering the shop floor
 *   3. the cart, because a basket full of lines for stock that has just been
 *      handed back would disagree with the shelves the moment the page settled
 */
export default function ResetDemo() {
  const router = useRouter();
  const { clearCart } = useCart();

  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const onReset = useCallback(() => {
    setDone(false);
    startTransition(async () => {
      await resetDemo();
      clearCart();
      router.refresh();
      setDone(true);
    });
  }, [clearCart, router]);

  return (
    <div className={styles.wrapper} data-testid="reset-demo">
      <p className={styles.note}>
        Sample data. Stock and seats are small on purpose, and start over from
        here.
      </p>
      <button
        type="button"
        className={styles.button}
        onClick={onReset}
        disabled={pending}
        aria-disabled={pending}
        data-testid="reset-demo-button"
      >
        {pending ? 'Resetting…' : done ? 'Reset ✓' : 'Reset demo data'}
      </button>
    </div>
  );
}
