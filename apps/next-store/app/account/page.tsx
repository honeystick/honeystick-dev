'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { HoneystickError, useCustomer } from '@honeystick/next/client';

import { useStoreEvents } from '@/hooks/use-store-events';
import { useSubscription } from '@/hooks/use-subscription';

import styles from './account.module.css';

/**
 * Where a subscriber manages what they are paying for.
 *
 * Everything on this page is the SDK talking to Honeystick through the store's
 * own /api/billing route. There is no store-specific endpoint behind any of it,
 * and that is the point worth demonstrating: a billing account page is not
 * something an app has to build a backend for.
 *
 * `planId` comes from the browser's own record of the checkout rather than from
 * "the newest subscription on the organization". That distinction is the
 * difference between a demo and a bug: the list is org-wide and newest-first,
 * so on any shared organization the unqualified read hands whoever opens this
 * page the last person's subscription - with a cancel button under it.
 *
 * The back button is a hard cancel, which is a thing no real store should do
 * and this one does on purpose - see `onBack`.
 */
/**
 * `useSearchParams` forces the tree it is in to render on the client, and Next
 * refuses to prerender a page containing one that is not inside a Suspense
 * boundary - it is a build error rather than a warning. The boundary is here
 * rather than around the whole route so the shell still prerenders.
 */
export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  );
}

function AccountView() {
  const router = useRouter();
  const { subscription, forget } = useSubscription();

  /**
   * The sample-data path lands here too.
   *
   * Without keys the subscribe action goes through everything up to the one
   * call that needs an organization, and then stops - so there is no plan id to
   * have remembered. Landing somewhere else would make the demo a different
   * shape from the real thing; saying why the page is empty keeps it the same
   * shape and honest about it.
   */
  const isDemo = useSearchParams().get('demo') === '1';

  const {
    data: plan,
    isLoading,
    error,
    check,
    track,
    cancel,
    updateCard,
    refetch,
  } = useCustomer({
    planId: subscription?.planId,
    // Nothing to ask about until the browser has read its own storage back -
    // and it cannot do that during the first render without breaking
    // hydration, so the first pass here always has no id.
    queryOptions: { enabled: !!subscription?.planId },
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * The stream, and the one thing on this page that is not a request.
   *
   * `payment.settled` is the only event in the system that means money actually
   * moved. Coming back from PayFast proves the shopper came back; this proves
   * the payment cleared, and it arrives whether or not they are still looking
   * at the page. The hook has already invalidated the plan by the time this
   * renders, so the meters and the status below are re-read without anything
   * here asking them to be.
   */
  const { status: streamStatus, lastEvent } = useStoreEvents({
    planId: subscription?.planId,
  });

  /**
   * Held rather than read straight off `lastEvent`, so it survives.
   *
   * `lastEvent` is the most recent frame of any kind. A second event - another
   * settlement, a future event type - would replace it, and the banner
   * confirming this shopper's payment would vanish mid-read. It is also
   * narrowed to *this* plan: the stream is org-wide, so somebody else's payment
   * settling must not tell this shopper theirs did.
   */
  const [settled, setSettled] = useState<{
    reference: string | null;
    status: string | null;
  } | null>(null);

  useEffect(() => {
    if (lastEvent?.name !== 'payment.settled') return;
    const data = lastEvent.data as {
      planId?: number | null;
      reference?: string | null;
      status?: string | null;
    };
    if (!subscription || data?.planId !== subscription.planId) return;
    setSettled({ reference: data.reference ?? null, status: data.status ?? null });
  }, [lastEvent?.at, lastEvent?.name, lastEvent?.data, subscription]);

  const usage = useMemo(
    () =>
      (Array.isArray(plan?.usage) ? plan.usage : []) as {
        feature_ext_id: string;
        name?: string | null;
        used?: number;
        limit?: number | null;
        interval?: string | null;
      }[],
    [plan],
  );

  const status: string | null = plan?.latest_status ?? null;
  const terms = (plan?.plan_type_data ?? {}) as {
    price?: number | null;
    plan_frequency?: string | null;
    current_period_ends_at?: string | null;
  };

  /**
   * Recording a unit against a meter.
   *
   * A 403 here is not a failure - it is the plan's own limit refusing the unit
   * with the counter untouched, which arrives as `HoneystickError.isLimitReached`.
   * Reported as a fact rather than as an error, because it is the branch a
   * metered plan exists to have.
   */
  const onTrack = useCallback(
    async (featureId: string, value: number) => {
      setBusy(featureId);
      setNote(null);
      setFailure(null);
      try {
        const result = (await track({ featureId, value })) as {
          used?: number;
          limit?: number | null;
        };
        setNote(
          `${value > 0 ? 'Recorded' : 'Returned'} ${Math.abs(value)} · ${featureId} is now ${result?.used ?? '?'} of ${result?.limit ?? '∞'}`,
        );
      } catch (cause) {
        if (cause instanceof HoneystickError && cause.isLimitReached) {
          setFailure(
            `${featureId} is at its limit. The server refused the unit and the counter is untouched.`,
          );
        } else {
          setFailure(
            cause instanceof Error ? cause.message : 'Could not record that.',
          );
        }
      } finally {
        setBusy(null);
      }
    },
    [track],
  );

  /**
   * Sends the shopper to the provider to replace their card.
   *
   * A plan that has not been paid for yet has no card on file - the provider
   * issues the token at the first successful payment - and answers 400. That is
   * a state a shopper reaches by subscribing and then backing out of the
   * payment page, so it is worth saying plainly rather than showing as a
   * failure.
   */
  const onUpdateCard = useCallback(async () => {
    setBusy('card');
    setNote(null);
    setFailure(null);
    try {
      window.location.href = await updateCard();
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : 'Could not open the card update page.',
      );
      setBusy(null);
    }
  }, [updateCard]);

  const onCancel = useCallback(async () => {
    setBusy('cancel');
    setNote(null);
    setFailure(null);
    try {
      const { removed } = await cancel();
      setNote(
        removed
          ? 'This plan never started, so it was removed rather than cancelled.'
          : 'Cancelled. It runs to the end of the period you have paid for.',
      );
      if (removed) forget();
    } catch (cause) {
      setFailure(
        cause instanceof Error ? cause.message : 'Could not cancel the plan.',
      );
    } finally {
      setBusy(null);
    }
  }, [cancel, forget]);

  /**
   * Leaving, which also ends the subscription.
   *
   * A real store would never do this, and it is here because a demo has the
   * opposite problem to a real store: every visitor who tries the flow leaves a
   * live recurring plan behind on somebody's actual billing account, and by
   * next week there are two hundred of them still billing. Tying the teardown
   * to the one action that always happens is the only version that reliably
   * cleans up.
   *
   * Cancelled first, forgotten second. The other order leaves a live
   * subscription that nothing points at any more - still billing, and now
   * invisible to the only page that could have stopped it.
   *
   * A cancellation that fails does not block the exit. It is reported, and the
   * handle is deliberately kept so the page can be reopened and the cancel
   * tried again.
   */
  const onBack = useCallback(async () => {
    setBusy('back');
    try {
      if (subscription?.planId) await cancel({ planId: subscription.planId });
      forget();
      router.push('/');
    } catch (cause) {
      setFailure(
        `Leaving, but the subscription could not be cancelled: ${
          cause instanceof Error ? cause.message : 'unknown error'
        }. Reopen this page to try again.`,
      );
      setBusy(null);
    }
  }, [cancel, forget, router, subscription]);

  const header = (
    <div className={styles.head}>
      <button
        type="button"
        className={styles.back}
        onClick={onBack}
        disabled={busy === 'back'}
        data-testid="account-back"
      >
        <span aria-hidden="true">←</span>
        {busy === 'back' ? 'Cancelling…' : 'Back to the store'}
      </button>
      <p className={styles.backNote}>
        Demo behaviour: leaving cancels the subscription you just created, so
        this store does not leave live plans behind.
      </p>
    </div>
  );

  if (!subscription) {
    return (
      <div className="responsive-container">
        <div className={styles.wrapper}>
          {header}
          <h1 className={styles.heading}>
            {isDemo ? 'Nothing to manage yet' : 'No subscription on this browser'}
          </h1>
          <p className={styles.muted}>
            {isDemo
              ? 'This store is running on sample data, so no plan was created and there is nothing for this page to read. Set HONEYSTICK_SECRET_KEY and subscribe again: usage meters, the card update and the cancel button all work against the real plan from here.'
              : 'Subscribing writes the plan id here so this page knows which one to open. Start one from the subscriptions counter on the shop floor.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-container">
      <div className={styles.wrapper}>
        {header}

        <header className={styles.title}>
          <div>
            <p className={styles.eyebrow}>Your subscription</p>
            <h1 className={styles.heading}>
              {plan?.name ?? subscription.planName}
            </h1>
          </div>
          {status && (
            <span className={styles.status} data-status={status}>
              {status.replace(/-/g, ' ')}
            </span>
          )}
        </header>

        {settled && (
          <section className={styles.settled} role="status">
            <span className={styles.settledMark} aria-hidden="true">
              ✓
            </span>
            <div>
              <p className={styles.settledTitle}>Payment received</p>
              <p className={styles.settledNote}>
                Honeystick confirmed this with the payment provider
                {settled.reference ? ` · ${settled.reference}` : ''}. Nothing on
                this page was polled — the notification arrived on its own.
              </p>
            </div>
          </section>
        )}

        <section className={styles.facts}>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Reference</span>
            <span className={styles.factValue}>{subscription.reference}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Billed to</span>
            <span className={styles.factValue}>{subscription.email}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Price</span>
            <span className={styles.factValue}>
              {terms.price != null
                ? `R${Number(terms.price).toFixed(2)} / ${terms.plan_frequency ?? 'month'}`
                : '—'}
            </span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Renews</span>
            <span className={styles.factValue}>
              {terms.current_period_ends_at
                ? new Date(terms.current_period_ends_at).toLocaleDateString()
                : 'After the first payment clears'}
            </span>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Usage this period</h2>
            <div className={styles.panelActions}>
              {/* Whether the page would hear about a payment, shown rather than
                  assumed. A stream that quietly died looks exactly like a quiet
                  one, and this is the difference. */}
              <span className={styles.stream} data-state={streamStatus}>
                {streamStatus}
              </span>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => void refetch()}
              >
                Refresh
              </button>
            </div>
          </div>

          {isLoading && <p className={styles.muted}>Reading the plan…</p>}

          {error && (
            <p className={styles.error} role="alert">
              {error.message}
            </p>
          )}

          {!isLoading && !error && !usage.length && (
            <p className={styles.muted}>
              This plan meters nothing. Usage counters come from the features
              and usage-limit rules attached at checkout, and this organization
              has none of the features the store asked for.
            </p>
          )}

          {usage.map((meter) => {
            const state = check({ featureId: meter.feature_ext_id });
            const limit = state.limit;
            const used = state.used;
            const pct =
              limit && limit > 0
                ? Math.min(100, Math.round((used / limit) * 100))
                : 0;

            return (
              <div key={meter.feature_ext_id} className={styles.meter}>
                <div className={styles.meterHead}>
                  <span className={styles.meterName}>
                    {meter.name ?? meter.feature_ext_id}
                  </span>
                  <span className={styles.meterCount}>
                    {used} / {limit ?? '∞'}
                    {meter.interval ? ` per ${meter.interval}` : ''}
                  </span>
                </div>

                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${pct}%` }}
                    data-full={!state.allowed}
                  />
                </div>

                <div className={styles.meterActions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy === meter.feature_ext_id || used <= 0}
                    onClick={() => void onTrack(meter.feature_ext_id, -1)}
                  >
                    Return one
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy === meter.feature_ext_id}
                    onClick={() => void onTrack(meter.feature_ext_id, 1)}
                  >
                    Use one
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Manage</h2>
          <div className={styles.manage}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void onUpdateCard()}
              disabled={busy === 'card'}
              data-testid="account-update-card"
            >
              {busy === 'card' ? 'Opening…' : 'Update card'}
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={() => void onCancel()}
              disabled={busy === 'cancel'}
              data-testid="account-cancel"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
            </button>
          </div>
          <p className={styles.muted}>
            Both are the SDK: <code>updateCard()</code> answers with a page at
            the payment provider, and <code>cancel()</code> stops the
            subscription there. The card is never seen by this store.
          </p>
        </section>

        {note && <p className={styles.note}>{note}</p>}
        {failure && (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        )}
      </div>
    </div>
  );
}
