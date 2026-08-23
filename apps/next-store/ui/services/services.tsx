"use client"

import { useCallback, useState } from "react"

import ServiceCard from "../service-card/service-card"
import ServiceModal from "../service-modal/service-modal"

import type { zServiceType } from "@/types/schema/service"

import styles from './services.module.css'

/**
 * The services counter.
 *
 * Owns which service is being looked at, because that is the only state here -
 * a service has no quantity and never enters the cart, so there is nothing for
 * useCart to hold. The open service is held as the object rather than an id so
 * the drawer has everything it needs to render without looking anything up.
 */
export default function Services({ services }: { services: zServiceType[] }) {
  const [activeService, setActiveService] = useState<zServiceType | null>(null)

  const closeModal = useCallback(() => setActiveService(null), [])

  if (!services.length) return null

  return (
    <>
      <section className={styles.list} data-testid="services">
        {services.map((service) => (
          <ServiceCard
            key={service.ext_id}
            service={service}
            onOpen={() => setActiveService(service)}
          />
        ))}
      </section>

      <ServiceModal service={activeService} onClose={closeModal} />
    </>
  )
}
