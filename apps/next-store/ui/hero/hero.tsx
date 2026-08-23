"use client"

import { useCallback } from "react"
import { motion } from "motion/react"
import Image from "next/image"

import styles from "./hero.module.css"

export default function Hero() {

  const handleAnimateToScroll = useCallback(() => {
    const [el] = document.getElementsByClassName('first-product');
    el?.scrollIntoView({behavior: "smooth"})
  }, [])

  return (
    <section className={styles.hero}>
      <div className={styles.contentWrapper}>
        <motion.div
          className={`${styles.bracket} ${styles.bracketLeft}`}
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
        >
          <Image src="/bracket_left.svg" alt="" width={120} height={120} />
        </motion.div>

        <motion.div
          className={`${styles.bracket} ${styles.bracketRight}`}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
        >
          <Image src="/bracket_right.svg" alt="" width={120} height={120} />
        </motion.div>

        <motion.h1
          className={styles.heading}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
        >
          Welcome to the Store
        </motion.h1>

        <motion.button
          onClick={handleAnimateToScroll}
          className={styles.cta}
          aria-label="Click to go to first product loaded on this page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        >
          Shop Now
        </motion.button>
      </div>
    </section>
  )
}
