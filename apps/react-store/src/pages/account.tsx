import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { HoneystickError, useCustomer } from '@honeystick/react';

import Nav from '../components/nav';
import { useStoreEvents } from '../hooks/use-store-events';
import { useSubscription } from '../hooks/use-subscription';

/**
 * Where a subscriber manages what they are paying for.
 *
 * Everything here is the SDK talking to Honeystick through the handler mounted
 * on the Express server. There is no store endpoint behind any of it, and no
 * key in this bundle - which is the whole point of the page.
 *
 * `planId` comes from the browser's own record of the checkout rather than from
 * "the newest subscription on the organization". That distinction is the
 * difference between a demo and a bug: the list is org-wide and newest-first,
 * so an unqualified read hands whoever opens this page the last person's
 * subscription, with a cancel button under it.
 */
export default function AccountPage() {
  const navigate = useNavigate();
  const { subscription, forget } = useSubscription();
  const isDemo = useSearchParams()[0].get('demo') === '1';

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
   * the payment cleared, and it arrives whether or not they are still looking.
   */
  const { status: streamStatus, lastEvent } = useStoreEvents();

  /**
   * Held rather than read straight off `lastEvent`, so it survives a later
   * frame - and narrowed to *this* plan, because the Express stream is org-wide
   * and somebody else's payment must not tell this shopper theirs settled.
   */
  const [settled, setSettled] = useState<{ reference: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (lastEvent?.name !== 'payment.settled') return;
    const data = lastEvent.data as {
      planId?: number | null;
      reference?: string | null;
    };
    if (!subscription || data?.planId !== subscription.planId) return;
    setSettled({ reference: data.reference ?? null });
  }, [lastEvent?.at, lastEvent?.name, lastEvent?.data, subscription]);

  const usage = (Array.isArray(plan?.usage) ? plan.usage : []) as {
    feature_ext_id: string;
    name?: string | null;
    interval?: string | null;
  }[];

  const status: string | null = plan?.latest_status ?? null;
  const terms = (plan?.plan_type_data ?? {}) as {
    price?: number | null;
    plan_frequency?: string | null;
  };

  /**
   * A 403 here is not a failure - it is the plan's own limit refusing the unit
   * with the counter untouched, which arrives as
   * `HoneystickError.isLimitReached`. Reported as a fact, because it is the
   * branch a metered plan exists to have.
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
   * A plan that has not been paid for has no card on file - the provider issues
   * the token at the first successful payment - and answers 400. That is a
   * state a shopper reaches by subscribing and then backing out of the payment
   * page, so it is worth saying plainly rather than showing as a failure.
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
   * A real store would never do this. A demo has the opposite problem: every
   * visitor who tries the flow otherwise leaves a live recurring plan on
   * somebody's actual billing account, and by next week there are two hundred
   * of them still billing.
   *
   * Cancelled first, forgotten second - the other order leaves a live
   * subscription that nothing points at any more. A failed cancellation does
   * not block the exit; it is reported and the handle is kept so the page can
   * be reopened and retried.
   */
  const onBack = useCallback(async () => {
    setBusy('back');
    try {
      if (subscription?.planId) await cancel({ planId: subscription.planId });
      forget();
      void navigate('/');
    } catch (cause) {
      setFailure(
        `Leaving, but the subscription could not be cancelled: ${
          cause instanceof Error ? cause.message : 'unknown error'
        }. Reopen this page to try again.`,
      );
      setBusy(null);
    }
  }, [cancel, forget, navigate, subscription]);

  const header = (
    <>
      <Nav />
      <div>
        <button onClick={() => void onBack()} disabled={busy === 'back'}>
          ← {busy === 'back' ? 'Cancelling…' : 'Back to the store'}
        </button>
        <p className="muted">
          Demo behaviour: leaving cancels the subscription you just created, so
          this store does not leave live plans behind.
        </p>
      </div>
    </>
  );

  if (!subscription) {
    return (
      <div className="container">
        {header}
        <h2>{isDemo ? 'Nothing to manage yet' : 'No subscription here'}</h2>
        <p className="muted">
          {isDemo
            ? 'The API is running on sample data, so no plan was created and there is nothing for this page to read. Set HONEYSTICK_SECRET_KEY on the Express server and subscribe again.'
            : 'Subscribing writes the plan id to this browser so the page knows which plan to open. Start one from the subscriptions counter.'}
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      {header}

      <div className="row">
        <div>
          <p className="eyebrow">Your subscription</p>
          <h2 style={{ margin: 0 }}>{plan?.name ?? subscription.planName}</h2>
        </div>
        {status && <span className="pill">{status.replace(/-/g, ' ')}</span>}
      </div>

      {settled && (
        <div className="settled" role="status">
          <span>✓</span>
          <div>
            <strong>Payment received</strong>
            <p className="muted">
              Honeystick confirmed this with the payment provider
              {settled.reference ? ` · ${settled.reference}` : ''}. Nothing on
              this page polled — the notification arrived on its own.
            </p>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="row">
          <span className="eyebrow">Reference</span>
          <span>{subscription.reference || '—'}</span>
        </div>
        <div className="row">
          <span className="eyebrow">Billed to</span>
          <span>{subscription.email || '—'}</span>
        </div>
        <div className="row">
          <span className="eyebrow">Price</span>
          <span>
            {terms.price != null
              ? `R${Number(terms.price).toFixed(2)} / ${terms.plan_frequency ?? 'month'}`
              : '—'}
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <h3 style={{ margin: 0, fontSize: '0.85rem' }}>Usage this period</h3>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Whether the page would hear about a payment, shown rather than
                assumed. A stream that quietly died looks exactly like a quiet
                one, and this is the difference. */}
            <span className="pill" data-state={streamStatus}>
              {streamStatus}
            </span>
            <button onClick={() => void refetch()}>Refresh</button>
          </span>
        </div>

        {isLoading && <p className="muted">Reading the plan…</p>}
        {error && (
          <p className="error" role="alert">
            {error.message}
          </p>
        )}

        {!isLoading && !error && !usage.length && (
          <p className="muted">
            This plan meters nothing. Usage counters come from the features and
            usage-limit rules attached at checkout, and this organization has
            none of the features the store asked for.
          </p>
        )}

        {usage.map((meter) => {
          const state = check({ featureId: meter.feature_ext_id });
          const pct =
            state.limit && state.limit > 0
              ? Math.min(100, Math.round((state.used / state.limit) * 100))
              : 0;
          return (
            <div key={meter.feature_ext_id} style={{ display: 'grid', gap: 6 }}>
              <div className="row">
                <span>{meter.name ?? meter.feature_ext_id}</span>
                <span className="muted">
                  {state.used} / {state.limit ?? '∞'}
                  {meter.interval ? ` per ${meter.interval}` : ''}
                </span>
              </div>
              <div className="bar">
                <div
                  style={{ width: `${pct}%` }}
                  data-full={!state.allowed}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={busy === meter.feature_ext_id || state.used <= 0}
                  onClick={() => void onTrack(meter.feature_ext_id, -1)}
                >
                  Return one
                </button>
                <button
                  disabled={busy === meter.feature_ext_id}
                  onClick={() => void onTrack(meter.feature_ext_id, 1)}
                >
                  Use one
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3 style={{ margin: 0, fontSize: '0.85rem' }}>Manage</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="primary"
            onClick={() => void onUpdateCard()}
            disabled={busy === 'card'}
          >
            {busy === 'card' ? 'Opening…' : 'Update card'}
          </button>
          <button
            className="danger"
            onClick={() => void onCancel()}
            disabled={busy === 'cancel'}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
          </button>
        </div>
        <p className="muted">
          Both are the SDK: <code>updateCard()</code> answers with a page at the
          payment provider, and <code>cancel()</code> stops the subscription
          there. The card is never seen by this store.
        </p>
      </div>

      {note && <p className="note">{note}</p>}
      {failure && (
        <p className="error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
