"use client"

import { PropsWithChildren } from 'react';

import Image from 'next/image';

import { useCart } from '@/hooks/use-cart';

import SVGAdd from '../svg-add/svg-add';
import SVGMinus from '../svg-minus/svg-minus';

import { zProductType } from '@/types/schema/product';

import styles from './product-card.module.css';

interface ProductCardComponent {
  id: string;
  className?: string
  product?: zProductType
}

const ProductCard = function ProductCard({
  id,
  className,
  product,
  ...props
}: PropsWithChildren<ProductCardComponent>) {
  const {
    cart,
    addToCart,
    increaseProductQuantity,
    decreaseProductQuantity
  } = useCart()
  const inCart = product?.id ? product?.id in cart : false
  const inCartQuantity = inCart && product ? cart[product.id].quantity : 0
  const stockLeft = inCart && product ? product.stock - cart[product?.id].quantity : product?.stock

  // derived, not synced. Held in state it needed an effect to keep it honest,
  // which meant every card rendered once with a stale value and the lint rule
  // about setting state in an effect had to be silenced to allow it.
  const isDepleted = stockLeft === 0


  return (
    <div
      id={id}
      className={`${styles.productCard} ${className || ''}`}
      {...props}
    >
      <a
        aria-hidden="true"
        style={{ display: 'none' }}
        href={String(product?.id) || ''}
      />
      <div
        className={`${styles.floatingAddSection} `}
        style={{ left: inCart ? 'var(--spacing)' : 'unset' }}
      >
        {inCart ? (
          <div className={styles.floatingCartActions}>
            <button
              data-testid='cart-action-decrease-quantity'
              onClick={() => decreaseProductQuantity(product!)}
              data-variant="icon"
              className='pushable'
            >
              <SVGMinus className='front' />
            </button>
            <button
              data-testid='cart-action-quantity'
              className={styles.cartQuantity}
            >
              {inCartQuantity}
            </button>
            <button
              data-testid='cart-action-add-quantity'
              onClick={() => increaseProductQuantity(product!)}
              data-variant="icon"
              className={!isDepleted ? 'pushable' : ''}
              disabled={isDepleted}
              style={{ opacity: isDepleted ? 0.64 : 1 }}
            >
              <SVGAdd className='front' />
            </button>
          </div>
        ) : (
          <button
            data-testid='cart-action-add'
            onClick={() => addToCart(product!)}
            data-variant="icon"
            className='pushable'
          >
            <SVGAdd className='front' />
          </button>
        )}
      </div>
      <div style={{ position: 'relative', width: '100%', height: '8rem', marginTop: 'var(--spacing)' }}>
        <div className={styles.productCardImageWrapper}>
          <Image
            placeholder="empty"
            className={styles.productCardImage}
            alt={product?.title || ''}
            // @ts-expect-error AS TO DOCS - An empty string ("") was passed to the src attribute. This may cause the browser to download the whole page again over the network. To fix this, either do not render the element at all or pass null to src instead of an empty string.
            src={product?.image || null}
            fill
            style={{
              objectFit: 'contain',
            }}
          />
        </div>
      </div>
      <div
        className={styles.productCardBody}
      >
        <div className={styles.productCardContent}>
          <h2 className={`${styles.productPrice}`}>
            R{product?.price.toFixed(2)}
          </h2>
          <p className={`${styles.productCategory}`}>
            {product?.category}
          </p>
          <h2 className={`${styles.productTitle}`}>
            {product?.title}
          </h2>
          <p className={`${styles.productDescription}`}>
            {product?.description}
          </p>
        </div>
        <div className={styles.productCardFooter}>
          <div className={styles.productCardFooterRow}>
            <svg xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 22 22"
              fill="var(--color-secondary)"
              stroke="var(--color-alt)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2">
              </polygon>
            </svg>
            <p>
              <strong>{product?.rating.rate}</strong>
            </p>
          </div>

          <div className={styles.productCardFooterRow}>
            <p>
              Left:
            </p>
            <p className={`${styles.productCount} ${className || ''}`}>
              <strong data-testid="product-stock">{stockLeft}</strong>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductCard;
