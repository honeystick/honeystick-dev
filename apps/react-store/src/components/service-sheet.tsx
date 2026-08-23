import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { startSubscription } from '../api';
import { useSubscription } from '../hooks/use-subscription';
import type { Service } from '../types';

/**
 * What a service costs and what it does, before anyone commits to it.
 *
 * A native `<dialog>` rather than a hand-built modal: it gives focus trapping,
 * Escape-to-close and an inert background for free, all of which a modal has to
 * have and none of which is interesting to write again.
 */
export default function ServiceSheet({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const { remember } = useSubscription();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (service && !dialog.open) {
      dialog.showModal();
      // a fresh sheet asks fresh questions - a stale error from a previous
      // attempt reads as a failure of this one
      setError(null);
      setPending(false);
    }
    if (!service && dialog.open) dialog.close();
  }, [service]);

  const onSubscribe = async () => {
    if (!service) return;
    setPending(true);
    setError(null);

    /**
     * The plan reference and who is subscribing, and nothing about the price.
     * The figure shown below is for the shopper to read - the server looks the
     * price up again from the catalogue, because a price arriving from a
     * browser is a price the browser could have chosen.
     */
    const result = await startSubscription({
      ext_id: service.ext_id,
      email,
      name,
    }).catch((cause: unknown) => ({
      ok: false as const,
      error: cause instanceof Error ? cause.message : 'Could not subscribe.',
    }));

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    /**
     * Written down before the shopper leaves, not after they come back.
     *
     * The next line hands them to PayFast and everything this page is holding
     * is gone the moment it does. The account page they return to has no other
     * way to know which plan is theirs - the return url could not carry an id
     * that did not exist yet when it was sent.
     */
    if (result.plan_id) {
      remember({
        planId: result.plan_id,
        customerId: result.customer_id,
        reference: result.reference,
        planName: service.title,
        email: email.trim().toLowerCase(),
      });
    }

    onClose();
    setPending(false);

    // A relative URL is the server's sample-data path, which creates nothing.
    // Anything absolute is the provider's hosted page.
    if (result.redirect_url.startsWith('/')) {
      void navigate('/account?demo=1');
      return;
    }
    window.location.href = result.redirect_url;
  };

  const canSubscribe = !pending && email.trim().length > 0;

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      {service && (
        <div style={{ padding: 'var(--spacing)', display: 'grid', gap: 10 }}>
          <div className="row">
            <div>
              <p className="eyebrow">{service.category}</p>
              <h2 style={{ margin: 0 }}>{service.title}</h2>
            </div>
            <button onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <p className="muted">{service.description}</p>

          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            {service.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>

          {service.metered.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', padding: 12 }}>
              <p className="eyebrow">Included each period</p>
              {service.metered.map((meter) => (
                <p key={meter.ext_id} style={{ margin: '2px 0' }}>
                  {meter.limit} × {meter.name} per {meter.interval}
                </p>
              ))}
            </div>
          )}

          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <p className="muted">
            This address is the customer. Honeystick matches an existing one or
            registers a new one from it, in the same call that creates the plan.
          </p>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button
            className="primary"
            onClick={() => void onSubscribe()}
            disabled={!canSubscribe}
          >
            {pending
              ? 'Starting…'
              : `Subscribe — R${service.price.toFixed(2)}/${service.frequency}`}
          </button>
          <p className="muted" style={{ textAlign: 'center' }}>
            Billed through Payfast.
          </p>
        </div>
      )}
    </dialog>
  );
}
