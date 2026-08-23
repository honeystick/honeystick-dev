"use client"

import Image from "next/image";
import Link from "next/link";

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
        <Link href='/' className={styles.logo}>
          <Image
            alt="The Depot logo"
            src='/depot_logo.svg'
            width={179}
            height={39}
            priority
          />
        </Link>
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