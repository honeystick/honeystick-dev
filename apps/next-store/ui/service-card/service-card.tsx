"use client"

import Image from 'next/image'

import SVGAdd from '../svg-add/svg-add'

import type { zServiceType } from '@/types/schema/service'

import styles from './service-card.module.css'

/**
 * A service, on the shop floor.
 *
 * Reads like a product card turned on its side, which is the point - it belongs
 * to the same catalogue and should look like it. What it deliberately does not
 * have is a quantity: a subscription is one per shopper, so the plus opens the
 * detail drawer instead of adding a line to the cart. That difference is the
 * whole reason this is not a ProductCard with a flag on it, and why the button
 * says what it does rather than showing a bare plus.
 */
export default function ServiceCard({
  service,
  onOpen,
}: {
  service: zServiceType
  onOpen: () => void
}) {
  const { title, description, price, frequency, image, category, seats } = service

  // a seat-limited service can be fully booked; one with no limit never is,
  // and null is that rather than zero
  const soldOut = seats !== null && seats <= 0

  return (
    <article
      className={styles.serviceCard}
      data-testid="service-card"
      data-service={service.ext_id}
    >
      <div className={styles.media}>
        <Image
          className={styles.mediaImage}
          alt={title}
          src={image}
          width={96}
          height={96}
          style={{ objectFit: 'contain' }}
        />
      </div>

      <div className={styles.body}>
        <p className={styles.category}>{category}</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.pricing}>
        <h2 data-testid="service-price" className={styles.price}>
          R{price.toFixed(2)}
        </h2>
        <p className={styles.frequency}>per {frequency}</p>
        {seats !== null && (
          <p className={styles.frequency} data-testid="service-seats">
            {soldOut ? 'Fully booked' : `${seats} seats left`}
          </p>
        )}
      </div>

      <div className={styles.action}>
        <button
          data-testid="service-action-open"
          onClick={onOpen}
          data-variant="icon"
          className={!soldOut ? 'pushable' : ''}
          disabled={soldOut}
          style={{ opacity: soldOut ? 0.64 : 1 }}
          aria-label={`About ${title}`}
        >
          <SVGAdd className="front" />
        </button>
      </div>
    </article>
  )
}
