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

import { zProductSchema, type zProductType } from '@/types/product';

/**
 * The cart, on native.
 *
 * The Next store's `hooks/use-cart.tsx` and `hooks/use-local-storage.tsx`,
 * collapsed into one file because the reason they were separate does not apply
 * here. On the web the split existed to survive hydration: the first render has
 * to match what the server sent, so the stored cart could only arrive an effect
 * later. Nothing is server-rendered on native, so the load is just a load - it is
 * asynchronous because AsyncStorage is, not because React demands it.
 *
 * What is kept, deliberately:
 *
 *   - the reviver. Storage holds whatever shape was current on the day it was
 *     written, and the app has been holding it ever since. A cart that no longer
 *     parses is discarded rather than rendered.
 *   - functional updates throughout, so the setter never closes over the current
 *     value and never has to change identity.
 *   - not writing before the first read completes, which would otherwise flush an
 *     empty cart over a real one on launch.
 */

type CartItem = {
  product: zProductType;
  quantity: number;
};

type CartState = Record<string, CartItem>;

type CartContextType = {
  cart: CartState;
  cartCount: number;
  cartTotal: number;
  /** false until storage has been read, so a screen can avoid flashing "empty" */
  isLoaded: boolean;
  addToCart: (product: zProductType) => void;
  increaseProductQuantity: (product: zProductType) => void;
  decreaseProductQuantity: (product: zProductType) => void;
  removeFromCart: (productId: zProductType['id']) => void;
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

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        setCart(stored ? reviveCart(JSON.parse(stored)) : {});
      })
      .catch((error) => {
        console.warn('Could not read the stored cart:', error);
        if (!cancelled) setCart({});
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // held in a ref so the write effect does not fire on the very first render,
  // before the stored cart has had a chance to arrive
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart)).catch((error) =>
      console.warn('Could not save the cart:', error),
    );
  }, [cart, isLoaded]);

  const addToCart = useCallback((product: zProductType) => {
    setCart((prev) => ({ ...prev, [product.id]: { product, quantity: 1 } }));
  }, []);

  const increaseProductQuantity = useCallback((product: zProductType) => {
    setCart((prev) => {
      const line = prev[product.id];
      // a line that is not there yet starts at one rather than throwing. A cart
      // is restored from storage and can name a product the catalogue no longer
      // returns, so the entry is never a given.
      if (!line) return { ...prev, [product.id]: { product, quantity: 1 } };
      return {
        ...prev,
        [product.id]: { ...line, quantity: line.quantity + 1 },
      };
    });
  }, []);

  const decreaseProductQuantity = useCallback((product: zProductType) => {
    setCart((prev) => {
      const line = prev[product.id];
      if (!line) return prev;
      // the last one out removes the line rather than leaving a zero, which
      // would keep an invisible entry in the basket forever
      if (line.quantity <= 1) {
        const { [String(product.id)]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [product.id]: { ...line, quantity: line.quantity - 1 },
      };
    });
  }, []);

  const removeFromCart = useCallback((productId: zProductType['id']) => {
    setCart((prev) => {
      const { [String(productId)]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const { cartCount, cartTotal } = useMemo(() => {
    const lines = Object.values(cart);
    return {
      cartCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      cartTotal: lines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0,
      ),
    };
  }, [cart]);

  const value = useMemo(
    () => ({
      cart,
      cartCount,
      cartTotal,
      isLoaded,
      addToCart,
      increaseProductQuantity,
      decreaseProductQuantity,
      removeFromCart,
      clearCart,
    }),
    [
      cart,
      cartCount,
      cartTotal,
      isLoaded,
      addToCart,
      increaseProductQuantity,
      decreaseProductQuantity,
      removeFromCart,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within <CartProvider/>');
  return context;
}
