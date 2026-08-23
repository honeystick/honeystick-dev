"use client"

import { PropsWithChildren, useMemo } from "react";

import ProductCard from "../product-card/product-card";

import { zProductType } from "@/types/schema/product";

export default function Products({ products, filters }: PropsWithChildren<{ products: zProductType[], filters: string | string[] | undefined }>) {

  const productMemo = useMemo(() => {
    if (typeof filters === 'string') {
      return products.filter(product => filters === product.category)
    }

    if (filters?.length) {
      return products.filter(product => filters.includes(product.category))
    }
    return products
  }, [filters, products])

  return productMemo.map((product, index) => (
    <ProductCard
    key={product.id}
      id={`product-${String(product.id)}`}
      className={`${index === 0 ? 'first-product' : ''}`}
      data-testid="product-card"
      product={product}
    />
  ))
}