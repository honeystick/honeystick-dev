import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { HoneystickFab, HoneystickProvider } from '@honeystick/react';

import { API_URL } from './config';
import { CartProvider } from './hooks/use-cart';
import AccountPage from './pages/account';
import CartPage from './pages/cart';
import CheckoutPage from './pages/checkout';
import ShopPage from './pages/shop';

import './index.css';

/**
 * The Depot, as a plain React SPA.
 *
 * `HoneystickProvider` is `@honeystick/react`'s, the same one the Next store
 * uses through `@honeystick/next/client`. Two props matter here and both are
 * about not being served by the thing you are calling:
 *
 *   - `backendUrl`, because this app is served by Vite on :5173 and the handler
 *     is mounted on the Express server on :4000. The Next store omits it and
 *     resolves `/api/billing` against its own origin; a SPA has no such luck,
 *     which is the same asymmetry that makes it *required* on native.
 *   - `includeCredentials`, because the handler's `identify` is expected to read
 *     a session, and fetch drops cookies cross-origin unless asked. The Express
 *     app answers with `credentials: true` for exactly this.
 *
 * No key anywhere. A Vite bundle is served to every visitor, so a secret key in
 * it is a published key - the same argument as `NEXT_PUBLIC_` and
 * `EXPO_PUBLIC_`, with the same answer: the key lives on the Express server and
 * is attached as calls pass through `/billing`.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HoneystickProvider backendUrl={API_URL} includeCredentials>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ShopPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Routes>
          {/* Every route, from the root. The point of a mark is that it is
              always in the same place - a shopper who noticed it on the account
              page and cannot find it on the shop floor has learnt nothing. */}
          <HoneystickFab />
        </BrowserRouter>
      </CartProvider>
    </HoneystickProvider>
  </StrictMode>,
);
