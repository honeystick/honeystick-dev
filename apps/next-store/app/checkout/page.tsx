'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useCart } from '@/hooks/use-cart';
import { startCheckout } from '@/lib/checkout/actions';
import ResetDemo from '@/ui/reset-demo/reset-demo';

import styles from './checkout.module.css';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => Object.values(cart ?? {}), [cart]);
  const total = useMemo(
    () =>
      lines.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [lines],
  );

  const onPay = async () => {
    setPending(true);
    setError(null);

    /**
     * Only the product reference and how many. The price shown below is for
     * the shopper's benefit - the server prices the basket again from the
     * catalogue, because a total arriving from a browser is a total the
     * browser could have chosen.
     */
    const result = await startCheckout({
      email,
      name,
      items: lines.map((item) => ({
        ext_id: item.product.ext_id,
        quantity: item.quantity,
      })),
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // the basket has become an order; leaving it filled would let a refresh
    // buy it twice
    clearCart();

    if (result.redirect_url.startsWith('/')) {
      router.push(result.redirect_url);
      return;
    }
    // the provider's own hosted checkout, on their origin
    window.location.href = result.redirect_url;
  };

  if (!lines.length) {
    return (
      <div className="responsive-container">
        <div className={styles.wrapper}>
          <h1 className={styles.heading}>Checkout</h1>
          <ResetDemo />
          <p className={styles.empty}>
            Your cart is empty. <Link href="/">Back to the store</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-container">
      <div className={styles.wrapper}>
        <h1 className={styles.heading}>Checkout</h1>
        <ResetDemo />

        <section className={styles.summary}>
          {lines.map((item) => (
            <div key={item.product.id} className={styles.line}>
              <span className={styles.lineTitle}>{item.product.title}</span>
              <span className={styles.lineQty}>&times;{item.quantity}</span>
              <span className={styles.lineTotal}>
                R{(item.product.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className={`${styles.line} ${styles.grandTotal}`}>
            <span className={styles.lineTitle}>Total</span>
            <span />
            <span data-testid="checkout-total" className={styles.lineTotal}>
              R{total.toFixed(2)}
            </span>
          </div>
        </section>

        <section className={styles.fields}>
          <label className={styles.label}>
            Name
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>
        </section>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <button
          className={styles.pay}
          data-testid="checkout-pay"
          onClick={onPay}
          disabled={pending || !email.trim()}
          aria-disabled={pending || !email.trim()}
        >
          <h2>{pending ? 'Starting checkout…' : `Pay R${total.toFixed(2)}`}</h2>
        </button>

        <p className={styles.note}>
          Billed through Payfast
        </p>
      </div>
    </div>
  );
}
