"use client";
import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
} from "react";
import { produce } from "immer";
import { zProductSchema, zProductType } from "@/types/schema/product";
import { useLocalStorage } from "./use-local-storage";

type CartItem = {
  product: zProductType;
  quantity: number;
};
type CartState = Record<string | number, CartItem>;
type CartContextType = {
  cart: CartState;
  cartCount: number;
  isCartOpen: boolean;
  toggleCart: () => void;
  increaseProductQuantity: (product: zProductType) => void;
  decreaseProductQuantity: (product: zProductType) => void;
  changeProductQuantity: (product: zProductType, quantity: number) => void;
  addToCart: (product: zProductType) => void;
  removeFromCart: (productId: zProductType["id"]) => void;
  clearCart: () => void;
};

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
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cart, setCart] = useLocalStorage<CartState>('local-cart', {}, reviveCart);

  const clearCart = useCallback(() => {
    setCart({})
  }, [setCart])

  const increaseProductQuantity = useCallback(
    (product: zProductType) => {
      setCart((prev) =>
        produce(prev ?? {}, (draft) => {
          // a line that is not there yet starts at one rather than throwing.
          // A cart is restored from localStorage and can name a product the
          // catalogue no longer returns, so the entry is never a given.
          const line = draft[product.id];
          if (line) line.quantity += 1;
          else draft[product.id] = { product, quantity: 1 };
        })
      );
    },
    [setCart]
  );

  const decreaseProductQuantity = useCallback(
    (product: zProductType) => {
      setCart((prev) =>
        produce(prev ?? {}, (draft) => {
          const line = draft[product.id];
          if (!line) return;
          if (line.quantity <= 1) {
            delete draft[product.id];
          } else {
            line.quantity -= 1;
          }
        })
      );
    },
    [setCart]
  );

  const changeProductQuantity = useCallback(
    (product: zProductType, quantity: number) => {
      setCart((prev) =>
        produce(prev ?? {}, (draft) => {
          draft[product.id] = { product, quantity };
        })
      );
    },
    [setCart]
  );

  const addToCart = useCallback(
    (product: zProductType) => {
      setCart((prev) =>
        produce(prev ?? {}, (draft) => {
          draft[product.id] = { product, quantity: 1 };
        })
      );
    },
    [setCart]
  );

  const removeFromCart = useCallback(
    (productId: zProductType["id"]) => {
      setCart((prev) =>
        produce(prev ?? {}, (draft) => {
          delete draft[productId];
        })
      );
    },
    [setCart]
  );

  const toggleCart = useCallback(() => {
    return setIsCartOpen(prev => !prev)
  }, [])
  
  const value = useMemo(
    () => ({
      cart,
      cartCount: Object.keys(cart ?? {}).length,
      increaseProductQuantity,
      decreaseProductQuantity,
      changeProductQuantity,
      addToCart,
      removeFromCart,
      clearCart,
      isCartOpen,
      toggleCart
    }),
    [cart, increaseProductQuantity, decreaseProductQuantity, changeProductQuantity, addToCart, removeFromCart, clearCart, isCartOpen, toggleCart]
  );
  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}