import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { zProductSchema, type Product } from '../types';

/**
 * The cart, on bare React Native.
 *
 * Identical in substance to the Expo store's, because nothing about a cart is
 * Expo's business - which is itself worth seeing in a sample whose whole job is
 * to show that the SDK does not care which React Native you are running.
 *
 * What is kept from the web store, deliberately:
 *
 *   - the reviver. Storage holds whatever shape was current on the day it was
 *     written, and the app has been holding it ever since. A cart that no longer
 *     parses is discarded rather than rendered.
 *   - functional updates throughout, so the setter never closes over the current
 *     value and never has to change identity.
 *   - not writing before the first read completes, which would otherwise flush
 *     an empty cart over a real one on launch.
 */

type CartItem = { product: Product; quantity: number };
type CartState = Record<string, CartItem>;

type CartContextType = {
  cart: CartState;
  cartCount: number;
  cartTotal: number;
  /** false until storage has been read, so a screen can avoid flashing "empty" */
  isLoaded: boolean;
  addToCart: (product: Product) => void;
  increaseProductQuantity: (product: Product) => void;
  decreaseProductQuantity: (product: Product) => void;
  removeFromCart: (extId: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = 'local-cart';

const CartContext = createContext<CartContextType | undefined>(undefined);

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) setCart(raw ? reviveCart(JSON.parse(raw)) : {});
      } catch {
        if (!cancelled) setCart({});
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // held in a ref so the write effect can see "have we finished loading" without
  // the load itself becoming a reason to write
  const loadedRef = useRef(false);
  loadedRef.current = isLoaded;

  useEffect(() => {
    if (!loadedRef.current) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev[product.ext_id];
      return {
        ...prev,
        [product.ext_id]: {
          product,
          quantity: (existing?.quantity ?? 0) + 1,
        },
      };
    });
  }, []);

  const increaseProductQuantity = addToCart;

  const decreaseProductQuantity = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev[product.ext_id];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [product.ext_id]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [product.ext_id]: { product, quantity: existing.quantity - 1 },
      };
    });
  }, []);

  const removeFromCart = useCallback((extId: string) => {
    setCart((prev) => {
      const { [extId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const value = useMemo<CartContextType>(() => {
    const lines = Object.values(cart);
    return {
      cart,
      cartCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      cartTotal: lines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0,
      ),
      isLoaded,
      addToCart,
      increaseProductQuantity,
      decreaseProductQuantity,
      removeFromCart,
      clearCart,
    };
  }, [
    cart,
    isLoaded,
    addToCart,
    increaseProductQuantity,
    decreaseProductQuantity,
    removeFromCart,
    clearCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within <CartProvider/>');
  return context;
}
