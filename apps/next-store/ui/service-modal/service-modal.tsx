"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { AnimatePresence, motion } from "motion/react";

import { useDialog } from "@/hooks/use-dialog";
import { useSubscription } from "@/hooks/use-subscription";
import { startSubscription } from "@/lib/services/actions";

import type { zServiceType } from "@/types/schema/service";

import styles from "./service-modal.module.css";

/**
 * What a service costs and what it does, before anyone commits to it.
 *
 * Built as the same drawer as the cart - right-hand panel, same slide, same
 * dark ground, same Escape and focus handling out of useDialog - because it is
 * the same gesture from the shopper's side. The difference is what it is for:
 * the cart totals things up, this explains one thing and then charges for it.
 *
 * Subscribing is a POST through a server action, and the redirect it returns is
 * the payment provider's own hosted page. The store never sees a card.
 */
export default function ServiceModal({
  service,
  onClose,
}: {
  service: zServiceType | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { remember } = useSubscription();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = service !== null;
  useDialog(isOpen, onClose, panelRef);

  // a fresh drawer asks fresh questions - a stale error from a previous attempt
  // reads as a failure of this one
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPending(false);
  }, [isOpen, service?.ext_id]);

  const onSubscribe = async () => {
    if (!service) return;

    setPending(true);
    setError(null);

    /**
     * The plan reference and who is subscribing, and nothing about the price.
     * The figure rendered below is for the shopper to read - the server looks
     * the price up again from the catalogue, because a price arriving from a
     * browser is a price the browser could have chosen.
     */
    const result = await startSubscription({
      ext_id: service.ext_id,
      email,
      name,
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    /**
     * Written down before the shopper leaves, not after they come back.
     *
     * The next line hands them to PayFast, and everything this page is holding
     * is gone the moment it does. The account page they return to has no other
     * way to know which plan is theirs - the return url cannot carry the id,
     * because the id did not exist yet when that url was sent.
     *
     * Which also means it has to happen even on the sample-data path below: the
     * flow is the same either way, and a demo that skips this is a demo whose
     * account page is empty.
     */
    if (result.plan_id) {
      remember({
        planId: result.plan_id,
        customerId: result.customer_id,
        reference: result.reference,
        planName: service.title,
        email: email.trim().toLowerCase(),
      });
    }

    if (result.redirect_url.startsWith("/")) {
      router.push(result.redirect_url);
      return;
    }
    // the provider's hosted checkout, on their origin
    window.location.href = result.redirect_url;
  };

  const canSubscribe = !pending && email.trim().length > 0;

  return (
    <AnimatePresence>
      {service && (
        <motion.div
          key="service-modal-wrapper"
          aria-label={`${service.title} subscription`}
          aria-modal="true"
          role="dialog"
          tabIndex={-1}
          ref={panelRef}
          className={styles.wrapper}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            data-testid="service-modal"
            className={`${styles.panel} responsive-container`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2, duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <div className={styles.head}>
              <div className={styles.media}>
                <Image
                  alt={service.title}
                  src={service.image}
                  width={80}
                  height={80}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <div className={styles.headText}>
                <p className={styles.category}>{service.category}</p>
                <h2 className={styles.title}>{service.title}</h2>
              </div>
              <button
                data-testid="service-modal-close"
                className={styles.close}
                onClick={onClose}
                data-variant="icon"
                aria-label="Close"
              >
                <span className={styles.closeIcon}>
                  <span />
                  <span />
                </span>
              </button>
            </div>

            <div className={styles.body}>
              <p className={styles.description}>{service.description}</p>

              <ul className={styles.benefits}>
                {service.benefits.map((benefit) => (
                  <li key={benefit} className={styles.benefit}>
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className={styles.fields}>
                <label className={styles.label}>
                  Name
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
                <label className={styles.label}>
                  Email
                  <input
                    data-testid="service-email"
                    className={styles.input}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
              </div>

              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
            </div>

            <div className={styles.footer}>
              <div className={styles.priceRow}>
                <p>Then</p>
                <p>
                  <strong data-testid="service-modal-price">
                    R{service.price.toFixed(2)}
                  </strong>{" "}
                  / {service.frequency}
                </p>
              </div>
              <button
                data-testid="service-subscribe"
                className={styles.subscribe}
                onClick={onSubscribe}
                disabled={!canSubscribe}
                aria-disabled={!canSubscribe}
                style={{ opacity: canSubscribe ? 1 : 0.64 }}
              >
                <h2>
                  {pending
                    ? "Starting…"
                    : `Subscribe - R${service.price.toFixed(2)}/${service.frequency}`}
                </h2>
              </button>
              <p className={styles.note}>
                Billed through Payfast.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
