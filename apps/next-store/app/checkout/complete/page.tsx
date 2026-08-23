import Link from 'next/link';

import ResetDemo from '@/ui/reset-demo/reset-demo';

import styles from '../checkout.module.css';

/**
 * Where the payment provider returns to.
 *
 * Deliberately does not claim the payment succeeded. A return URL is only
 * evidence that the shopper came back - the provider confirms a payment to
 * Honeystick over its own webhook, and the plan's status is what actually
 * settles. Telling someone "paid" on the strength of a redirect is how a
 * cancelled or failed payment ends up looking complete.
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const orderId = typeof params.order === 'string' ? params.order : null;
  const total = typeof params.total === 'string' ? params.total : null;
  const isDemo = params.demo === '1';
  // a subscription comes back naming its plan; a basket does not
  const plan = typeof params.plan === 'string' ? params.plan : null;
  const frequency =
    typeof params.frequency === 'string' ? params.frequency : null;

  return (
    <div className="responsive-container">
      <div className={styles.wrapper}>
        <h1 className={styles.heading}>
          {plan ? 'Thanks for subscribing' : 'Thanks for your order'}
        </h1>

        {orderId && (
          <section className={styles.summary}>
            <div className={styles.line}>
              <span className={styles.lineTitle}>
                {plan ? 'Subscription' : 'Order'}
              </span>
              <span />
              <span data-testid="order-reference" className={styles.lineTotal}>
                {orderId}
              </span>
            </div>
            {plan && (
              <div className={styles.line}>
                <span className={styles.lineTitle}>Plan</span>
                <span />
                <span data-testid="plan-name" className={styles.lineTotal}>
                  {plan}
                </span>
              </div>
            )}
            {total && (
              <div className={styles.line}>
                <span className={styles.lineTitle}>
                  {frequency ? 'Per ' + frequency : 'Total'}
                </span>
                <span />
                <span className={styles.lineTotal}>R{total}</span>
              </div>
            )}
          </section>
        )}

        <p className={styles.note}>
          {isDemo
            ? 'This store is running on sample data, so no payment was taken. Set HONEYSTICK_SECRET_KEY to check out against Honeystick for real.'
            : 'We are confirming your payment with the provider. Your order updates on its own once that lands - you can close this page.'}
        </p>

        <ResetDemo />

        <p className={styles.empty}>
          <Link href="/">Back to the store</Link>
        </p>
      </div>
    </div>
  );
}
