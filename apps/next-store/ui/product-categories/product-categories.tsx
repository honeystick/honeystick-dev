"use client"

import { PropsWithChildren, useCallback, useMemo } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { uniqueBy } from "remeda";

import { zProductType } from "@/types/schema/product";

import styles from './product-categories.module.css'

export default function ProductCategories(
  { products,
  }: PropsWithChildren<{ products: zProductType[] }>
) {
  const searchParams = useSearchParams();
  const router = useRouter()
  const filters = searchParams.get('category') || 'all';

  const uniqueCategoriesMemo = useMemo(() => {
    if (products.length) {
      return uniqueBy(
        products,
        ({ category }) => category
      )
    }

    return []
  }, [products])

  // INTENTIONALLY FILTERING ONLY ON ONE
  const handleURLSearchUpdate = useCallback((category: string) => {
    if (filters === category) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("category") // remove it fully
      router.push(`?${params.toString()}`, { scroll: false })
      return
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set("category", category)
      router.push(`?${params.toString()}`, { scroll: false })
    }
  }, [filters, router, searchParams])

  const isActive = useCallback((category: string) => {
    const isTrue = filters === category
    return isTrue
  }, [filters])

  return (
    <section className={styles.categoryWrapper}>
      <div>
        <h2 style={{ color: 'var(--color-secondary)', textTransform: 'uppercase' }}>Product Categories</h2>
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("category")            // remove it fully
            router.push(`?${params.toString()}`, { scroll: false })
          }}
          className="pushable"
          data-variant="icon"
          style={{ padding: 0, minHeight: 'auto', paddingLeft: 8 }}
        >
          <p className="front">
            Clear
          </p>
        </button>
      </div>
      <div className={styles.categoryButtonWrapper}>
        {uniqueCategoriesMemo.map(product =>
          <button
            key={product.category}
            className={`${styles.categoryButton} ${isActive(product.category) ? styles.categoryActive : ''}`}
            onClick={() => handleURLSearchUpdate(product.category)}
          >
            {product.category}
          </button>
        )}
      </div>
    </section>
  )
}