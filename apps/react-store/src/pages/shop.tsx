import { useCallback, useEffect, useState } from 'react';

import { useListPlans } from '@honeystick/react';

import { getStorefront, resetDemo } from '../api';
import Nav from '../components/nav';
import ServiceSheet from '../components/service-sheet';
import { API_URL, imageUrl } from '../config';
import { useCart } from '../hooks/use-cart';
import type { Service, Storefront } from '../types';

/**
 * The shop floor.
 *
 * Two different reads, on purpose, because they demonstrate two halves of the
 * integration:
 *
 *   - the storefront comes from the Express app's `/api/storefront`, which is
 *     the store's own shaped view of the catalogue - artwork, categories, stock
 *   - `useListPlans` comes from the SDK, over the proxy transport, through
 *     `/billing/plans` on that same server. No key is in this bundle, and that
 *     call working from a browser on another origin is the thing worth seeing.
 */
export default function ShopPage() {
  const { cart, addToCart, decreaseProductQuantity } = useCart();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Service | null>(null);
  const [resetting, setResetting] = useState(false);

  const plans = useListPlans();

  const load = useCallback(async () => {
    try {
      setError(null);
      setStorefront(await getStorefront());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load the store.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onReset = useCallback(async () => {
    setResetting(true);
    try {
      await resetDemo();
      await Promise.all([load(), plans.refetch()]);
    } catch {
      // a reset that fails leaves the shelves where they were, which the next
      // load will show - not worth an error screen
    } finally {
      setResetting(false);
    }
  }, [load, plans]);

  if (error) {
    return (
      <div className="container">
        <Nav />
        <h2>Cannot reach the store</h2>
        <p className="muted">{error}</p>
        <p className="muted">
          This app points at {API_URL}. Start it with{' '}
          <code>npm run dev -w @honeystick/express-api</code>, or set
          VITE_API_URL.
        </p>
        <button onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="container">
        <Nav />
        <p className="muted">Loading the catalogue…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Nav />

      <div className="row">
        <p className="muted">
          {plans.isLoading
            ? 'Reading the catalogue from Honeystick…'
            : plans.error
              ? `Honeystick: ${plans.error.message}`
              : `${plans.data?.length ?? 0} plans, read with the SDK via /billing — the secret key stays on the API.`}
        </p>
        <button onClick={() => void onReset()} disabled={resetting}>
          {resetting ? 'Resetting…' : 'Reset demo data'}
        </button>
      </div>

      <section>
        <h2>Products</h2>
        <div className="grid">
          {storefront.products.map((product) => {
            const quantity = cart[product.ext_id]?.quantity ?? 0;
            const soldOut = product.stock <= 0;
            return (
              <article key={product.ext_id} className="card">
                <img src={imageUrl(product.image)} alt={product.title} />
                <p className="eyebrow">{product.category}</p>
                <p className="title">{product.title}</p>
                <div className="row">
                  <span className="price">R{product.price.toFixed(2)}</span>
                  <span className="eyebrow">
                    {soldOut ? 'Sold out' : `${product.stock} left`}
                  </span>
                </div>
                {quantity > 0 ? (
                  <div className="row">
                    <button onClick={() => decreaseProductQuantity(product)}>
                      −
                    </button>
                    <span>{quantity}</span>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={soldOut}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="primary"
                    onClick={() => addToCart(product)}
                    disabled={soldOut}
                  >
                    {soldOut ? 'Sold out' : 'Add to cart'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {storefront.services.length > 0 && (
        <section>
          {/* Deliberately outside the product grid. The shop floor sells goods
              bought once; the services counter sells subscriptions, and a
              delivery plan is not a kind of jewellery. */}
          <h2>Subscriptions</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {storefront.services.map((service) => {
              const soldOut = service.seats !== null && service.seats <= 0;
              return (
                <article key={service.ext_id} className="card">
                  <div className="row">
                    <div>
                      <p className="eyebrow">{service.category}</p>
                      <p className="title">{service.title}</p>
                      <p className="muted">{service.description}</p>
                      {service.metered.length > 0 && (
                        <p className="note">
                          Meters{' '}
                          {service.metered.map((m) => m.name).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="price">R{service.price.toFixed(2)}</p>
                      <p className="eyebrow">per {service.frequency}</p>
                      <button
                        className="primary"
                        disabled={soldOut}
                        onClick={() => setActive(service)}
                      >
                        {soldOut ? 'Full' : 'Subscribe'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <ServiceSheet service={active} onClose={() => setActive(null)} />
    </div>
  );
}
