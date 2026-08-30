"use client"

import Image from "next/image";
import Link from "next/link";

import { HoneystickBadge } from "@honeystick/next/client";

import { useCart } from "@/hooks/use-cart";

import styles from './header.module.css'

export default function Header() {
  const { cartCount, toggleCart, isCartOpen } = useCart()

  return (
    <header className={styles.wrapper}>
      <div className={`responsive-container ${styles.header}`}>
        {/* Sized from the artwork's own 220x48 rather than filled: the box was
            149x39, a different ratio, and objectFit 'cover' answered that by
            cropping the wordmark off. Explicit dimensions also mean the Image
            needs no positioned ancestor, which the <Link> was not. */}
        <div className={styles.brand}>
          <Link href='/' className={styles.logo}>
            <Image
              alt="Honeystick Example App logo"
              src='/depot_logo.svg'
              width={179}
              height={39}
              priority
            />
          </Link>
          {/* Beside the store's own wordmark, which is the honest place for it:
              this is a shop, and Honeystick is who takes the money in it.
              `sm` and unelevated because the header is already a surface - a
              shadow here would make the badge look like it was floating above
              a bar it is actually sitting in. The href is left to the SDK,
              which resolves HS_APP_URL for the environment. */}
          <HoneystickBadge size="sm" elevated={false} />
        </div>
        <div className={`row ${styles.cartRow}`}>
          {cartCount ? <p className={styles.cartQuantity}>{cartCount}</p> : ''}
          <button
            data-testid="cart-menu-button"
            onClick={toggleCart}
            data-variant="icon"
            className="pushable"
          >
            <span className="visually-hidden">Cart</span>
            {isCartOpen
              ? (
                <div className={styles.menuActiveIcon}>
                  <span />
                  <span />
                </div>
              ) : (
                <Image
                  className="front"
                  alt="cart"
                  src='/cart.svg'
                  fill
                  style={{
                    objectFit: 'cover',
                    zIndex: 2
                  }}
                />
              )}
          </button>
        </div>
      </div>

    </header>
  )
}