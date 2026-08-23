import ProductCategories from '@/ui/product-categories/product-categories'
import Products from '@/ui/products/products'
import Services from '@/ui/services/services'
import Hero from '@/ui/hero/hero'
import ResetDemo from '@/ui/reset-demo/reset-demo'

import { getStorefront } from '@/lib/catalogue/catalogue'

import styles from './page.module.css'

export default async function ProductListingsPage(
  { searchParams }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }) {
  // The catalogue comes from Honeystick - what a thing costs and how it sells
  // is billing's answer, not the store's. A server component can hold the
  // secret key, so this reads Honeystick directly rather than going back out
  // through the store's own /api/billing route.
  //
  // Products and services come from the same read, split on plan type: goods
  // are bought once, services bill again on a cycle.
  const { products, services } = await getStorefront()
  const filters = (await searchParams).category

  return (
    <div
      // @ts-expect-error This does work :)
      style={{ '--hero-height': '400px' }}
    >
      <Hero />
      <div
        className='responsive-container'
      >
        <ResetDemo />
        <div className={`${styles.wrapper}`}>
          <div className={styles.mainColumn}>
            <div data-testid="products" className={styles.productsWrapper}>
              <h2 className={styles.sectionHeading}>Products</h2>
              <section className={styles.list}>
                <Products products={products} filters={filters} />
              </section>
            </div>

            <div data-testid="services-section" className={styles.productsWrapper}>
              <h2 className={styles.sectionHeading}>Subscriptions example</h2>
              <Services services={services} />
            </div>
          </div>

          <section className={styles.aside}>
            <ProductCategories
              products={products}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
