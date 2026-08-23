"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef } from "react";

import Image from "next/image";

import { AnimatePresence, motion } from "motion/react";

import { useCart } from "@/hooks/use-cart";
import { useDialog } from "@/hooks/use-dialog";
import SVGAdd from "../svg-add/svg-add";
import SVGMinus from "../svg-minus/svg-minus";
import { zProductType } from "@/types/schema/product";

import styles from "./cart-menu.module.css";

export default function CartMenu() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const {
    cart,
    toggleCart,
    isCartOpen,
    increaseProductQuantity,
    decreaseProductQuantity,
    clearCart
  } = useCart();

  const cartArray = Object.values(cart);

  const cartTotalMemo = useMemo(() => {
    return cartArray.reduce((total, item) => {
      return (total += item.quantity * item.product.price);
    }, 0);
  }, [cartArray]);

  const isDepleted = useCallback(
    (product: zProductType) => {
      const stockLeft = product.stock - cart[product.id].quantity;
      return stockLeft === 0;
    },
    [cart]
  );

  // Escape, the focus trap, focus restoration and the scroll lock - shared with
  // the service drawer, which has to behave the same way
  useDialog(isCartOpen, toggleCart, panelRef);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          key="cart-menu-wrapper"
          aria-label="Shopping cart"
          aria-modal="true"
          role="dialog"
          tabIndex={-1}
          ref={panelRef}
          className={styles.cartMenuWrapper}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            data-testid='cart-menu'
            className={`${styles.cartMenu} responsive-container`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2, duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {!cartArray.length &&
              <div className={styles.cartEmptyWrapper}>
                <p>Cart empty</p>
              </div>
            }
            <ul className={styles.cartBody}>
              {cartArray.map((item) => {
                const {
                  quantity,
                  product: { title, image, id, price },
                } = item;
                const lineTotal = price * quantity;

                return (
                  <li
                    key={id}
                    data-testid="cart-list-item"
                    className={styles.cartRow}
                  >
                    <Image
                      className={styles.productCardImage}
                      alt={title || ""}
                      src={image}
                      width={80}
                      height={80}
                      style={{ objectFit: "contain" }}
                    />
                    <p className={styles.cartTitle}>{title}</p>
                    <div className={styles.cardPricing}>
                      <div className={styles.cartActions} style={{ marginLeft: "auto" }}>
                        <button
                          onClick={() => decreaseProductQuantity(item.product)}
                          aria-label={`Decrease quantity of ${title}`}
                          data-variant="icon"
                          className="pushable"
                        >
                          <SVGMinus className="front" />
                        </button>
                        <span
                          className={styles.cartQuantity}
                          aria-live="polite"
                          aria-label={`Quantity of ${title}: ${quantity}`}
                        >
                          {quantity}
                        </span>
                        <button
                          onClick={() => increaseProductQuantity(item.product)}
                          aria-label={`Increase quantity of ${title}`}
                          data-variant="icon"
                          className={!isDepleted(item.product) ? "pushable" : ""}
                          disabled={isDepleted(item.product)}
                          style={{ opacity: isDepleted(item.product) ? 0.64 : 1 }}
                        >
                          <SVGAdd className="front" />
                        </button>
                      </div>
                      <div className={styles.cartPricingRow}>
                        <p data-testid="cart-item-price" className={styles.cartPrice}>R {price}</p>
                        <h2 data-testid="cart-item-total" className={styles.cartLineTotal}>R {lineTotal.toFixed(2)}</h2>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className={styles.cartFooter}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button
                  data-testid="clear-cart-button"
                  className={styles.clearCartButton}
                  aria-disabled={!cartTotalMemo}
                  disabled={!cartTotalMemo}
                  style={{
                    opacity: !cartTotalMemo ? 0.64 : 1,
                    backgroundColor: 'var(--bg-muted)'
                  }}
                  onClick={clearCart}
                >
                  <h2>Clear cart</h2>
                </button>
                <div className="row">
                  <p>Total:</p>
                  <p>
                    <strong data-testid="cart-grand-total">R{cartTotalMemo.toFixed(2)}</strong>
                  </p>
                </div>
              </div>
              <Link
                href="/checkout"
                onClick={() => cartTotalMemo && toggleCart()}
                aria-disabled={!cartTotalMemo}
                style={{
                  opacity: !cartTotalMemo ? 0.64 : 1,
                  pointerEvents: !cartTotalMemo ? 'none' : 'auto',
                }}
                className={styles.checkoutLink}
              >
                <h2>Checkout</h2>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
