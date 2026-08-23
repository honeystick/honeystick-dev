import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { zProductSchema, type Product } from '../types';
import { useLocalStorage } from './use-local-storage';

/**
 * The basket, in localStorage.
 *
 * The same shape as the other three stores. Nothing about a cart is Honeystick's
 * business - it is the store's own state right up until checkout prices it
 * server-side, which is the point the SDK first appears.
 */
type CartItem = { product: Product; quantity: number };
type CartState = Record<string, CartItem>;

type CartContextValue = {
  cart: CartState;
  cartCount: number;
  cartTotal: number;
  addToCart: (product: Product) => void;
  decreaseProductQuantity: (product: Product) => void;
  removeFromCart: (extId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** anything in storage that is no longer a product is dropped, not rendered */
const reviveCart = (raw: unknown): CartState => {
  if (!raw || typeof raw !== 'object') return {};
  const revived: CartState = {};
  for (const [key, line] of Object.entries(raw as Record<string, unknown>)) {
    if (!line || typeof line !== 'object') continue;
    const { product, quantity } = line as Partial<CartItem>;
    const parsed = zProductSchema.safeParse(product);
    if (!parsed.success) continue;
    if (typeof quantity !== 'number' || quantity < 1) continue;
    revived[key] = { product: parsed.data, quantity };
  }
  return revived;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useLocalStorage<CartState>(
    'local-cart',
    {},
    reviveCart,
  );

  const addToCart = useCallback(
    (product: Product) =>
      setCart((previous) => ({
        ...previous,
        [product.ext_id]: {
          product,
          quantity: (previous[product.ext_id]?.quantity ?? 0) + 1,
        },
      })),
    [setCart],
  );

  const decreaseProductQuantity = useCallback(
    (product: Product) =>
      setCart((previous) => {
        const existing = previous[product.ext_id];
        if (!existing) return previous;
        if (existing.quantity <= 1) {
          const { [product.ext_id]: _gone, ...rest } = previous;
          return rest;
        }
        return {
          ...previous,
          [product.ext_id]: { product, quantity: existing.quantity - 1 },
        };
      }),
    [setCart],
  );

  const removeFromCart = useCallback(
    (extId: string) =>
      setCart((previous) => {
        const { [extId]: _gone, ...rest } = previous;
        return rest;
      }),
    [setCart],
  );

  const clearCart = useCallback(() => setCart({}), [setCart]);

  const value = useMemo<CartContextValue>(() => {
    const lines = Object.values(cart);
    return {
      cart,
      cartCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      cartTotal: lines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0,
      ),
      addToCart,
      decreaseProductQuantity,
      removeFromCart,
      clearCart,
    };
  }, [cart, addToCart, decreaseProductQuantity, removeFromCart, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within <CartProvider/>');
  return context;
}
