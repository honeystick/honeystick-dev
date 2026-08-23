import { Link } from 'react-router-dom';

import { useCart } from '../hooks/use-cart';
import { useSubscription } from '../hooks/use-subscription';

/** the same three destinations on every page, so nothing is a dead end */
export default function Nav() {
  const { cartCount } = useCart();
  const { subscription } = useSubscription();

  return (
    <nav className="nav">
      <Link to="/">
        <h1>The Depot</h1>
      </Link>
      <span style={{ display: 'flex', gap: 'var(--spacing)' }}>
        {/* The way back into a subscription that already exists. Without it the
            account page is reachable only in the moments right after a
            checkout, which is exactly when it matters least. */}
        {subscription && <Link to="/account">Your subscription</Link>}
        <Link to="/cart">Cart{cartCount > 0 ? ` (${cartCount})` : ''}</Link>
      </span>
    </nav>
  );
}
