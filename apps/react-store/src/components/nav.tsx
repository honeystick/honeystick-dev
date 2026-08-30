import { Link } from 'react-router-dom';

import { HoneystickBadge } from '@honeystick/react';

import { HONEYSTICK_APP_URL } from '../config';
import { useCart } from '../hooks/use-cart';
import { useSubscription } from '../hooks/use-subscription';

/** the same three destinations on every page, so nothing is a dead end */
export default function Nav() {
  const { cartCount } = useCart();
  const { subscription } = useSubscription();

  return (
    <nav className="nav">
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing)' }}>
        <Link to="/">
          <h1>Honeystick Example App</h1>
        </Link>
        {/* Beside the store's own name - this is a shop, and Honeystick is who
            takes the money in it. `href` is passed rather than resolved inside
            the SDK because Vite publishes through `import.meta.env`, which a
            file Metro also parses cannot touch. */}
        <HoneystickBadge size="sm" elevated={false} href={HONEYSTICK_APP_URL} />
      </span>
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
