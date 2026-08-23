import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { startCheckout } from '../api';
import Nav from '../components/nav';
import { useCart } from '../hooks/use-cart';

/**
 * Paying for the basket.
 *
 * The same division of trust as the other three stores: this sends the product
 * reference and how many, and nothing about the price. The total below is for
 * the shopper to read - the server prices the basket again from the catalogue,
 * because a total arriving from a browser is a total the browser could have
 * chosen.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart);

  const onPay = async () => {
    setPending(true);
    setError(null);

    const result = await startCheckout({
      email,
      name,
      items: lines.map(({ product, quantity }) => ({
        ext_id: product.ext_id,
        quantity,
      })),
    }).catch((cause: unknown) => ({
      ok: false as const,
      error: cause instanceof Error ? cause.message : 'Checkout failed.',
    }));

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // the basket has become an order; leaving it filled would let a refresh
    // buy it twice
    clearCart();
    setPending(false);

    if (result.redirect_url.startsWith('/')) {
      void navigate('/');
      return;
    }
    window.location.href = result.redirect_url;
  };

  if (!lines.length) {
    return (
      <div className="container">
        <Nav />
        <h2>Checkout</h2>
        <p className="muted">
          Your cart is empty. <Link to="/">Back to the store</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <Nav />
      <h2>Checkout</h2>

      <div className="panel">
        {lines.map(({ product, quantity }) => (
          <div key={product.ext_id} className="row">
            <span>{product.title}</span>
            <span className="muted">×{quantity}</span>
            <span className="price">
              R{(product.price * quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div className="row">
          <strong>Total</strong>
          <strong>R{cartTotal.toFixed(2)}</strong>
        </div>
      </div>

      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
      </label>
      <label>
        Email
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          required
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button
        className="primary"
        onClick={() => void onPay()}
        disabled={pending || !email.trim()}
      >
        {pending ? 'Starting checkout…' : `Pay R${cartTotal.toFixed(2)}`}
      </button>
      <p className="muted">Billed through Payfast.</p>
    </div>
  );
}
