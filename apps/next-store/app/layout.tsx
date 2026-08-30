import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import Link from "next/link";
import Image from "next/image";

// global styles
import "./layout.css";
import { HoneystickFab, HoneystickProvider } from "@honeystick/next/client";

import CartMenu from "@/ui/cart-menu/cart-menu";
import Header from "@/ui/header/header";
import { CartProvider } from "@/hooks/use-cart";

const lexend = Lexend({
  variable: "--font-lexend",
  fallback: ['serif']
});

export const metadata: Metadata = {
  title: "Honeystick Example App - Ecommerce Store",
  description: "A sample ecommerce store built on Honeystick and Next.js",
};

/**
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` mean anything.
 *
 * Without it those keywords resolve to 0 on every browser, so a stylesheet full
 * of correct safe-area padding is silently inert - which is the worst version of
 * this bug, because the CSS looks right in review and the phone still puts the
 * checkout button under the home indicator.
 *
 * It matters here more than on a plain site: the manifest declares
 * `display: standalone`, so an installed Depot runs with no browser chrome and
 * the home indicator sits directly over the page's own bottom edge.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Client-side context for the whole store.
 *
 * HoneystickProvider carries no key. It builds a client that calls this app's
 * own /api/billing route, and that route handler is the only place the secret
 * key exists - which is what makes the billing hooks usable from a client
 * component at all. `pathPrefix` has to match where the catch-all route
 * actually lives, since the default is '/billing'.
 *
 * `includeCredentials` because the handler's `identify` is expected to read a
 * session; Honeystick Example App has no accounts yet and treats every visitor as the same
 * guest, but the cookie has to be sent for the day it does.
 */
function ClientProviders({
  children,
  honeystickAppUrl,
}: {
  children: React.ReactNode;
  honeystickAppUrl?: string;
}) {
  return (
    <HoneystickProvider pathPrefix="/api/billing" includeCredentials>
      <CartProvider>
        {children}
        {/* Every page, from the layout, rather than dropped onto the ones
            that happen to be about billing. The point of a mark is that it is
            always in the same place - a shopper who noticed it on the account
            page and cannot find it on the shop floor has learnt nothing. */}
        <HoneystickFab href={honeystickAppUrl} />
      </CartProvider>
    </HoneystickProvider>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /**
   * Read here, on the server, and handed down as a prop - deliberately not as
   * `NEXT_PUBLIC_HS_APP_URL`.
   *
   * The FAB is a client component, and a `NEXT_PUBLIC_` value is *inlined by
   * next build*, not read at request time. Both Workers are deployed from one
   * bundle, so an inlined value would be whichever hostname CI happened to
   * build with and dev-demo would link to demo. Reading the plain variable in
   * this server component resolves it from each Worker's own `vars` on every
   * request, which is the same trick `NEXT_PUBLIC_STORE_URL` gets away with by
   * only ever being touched in `'use server'` files.
   */
  const honeystickAppUrl = process.env.HS_APP_URL;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${lexend.variable}`}>
        <ClientProviders honeystickAppUrl={honeystickAppUrl}>
          <div style={{ isolation: 'isolate' }}>
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <CartMenu />
              <Header />
              {children}
            </div>
            <footer className="footer">
              <div className="footer-top">
                <div className="responsive-container ">
                  <div className="footer-top-inner">
                    <div className="footer-top-column">
                      <Link href="" target="_blank">About us</Link>
                      <Link href="" target="_blank">How we ship</Link>
                      <Link href="" target="_blank">Our promise</Link>
                      <Link href="" target="_blank">Our team</Link>
                    </div>
                    <div className="footer-top-column">
                      <Link href="" target="_blank">Our Services</Link>
                      <Link href="" target="_blank">Who we work with</Link>
                      <Link href="" target="_blank">Case Studies</Link>
                      <Link href="" target="_blank">Our Partnerships</Link>
                    </div>

                    <div className="footer-top-column">
                      <Link href="" target="_blank">Blog</Link>
                      <Link href="" target="_blank">Playbooks</Link>
                      <Link href="" target="_blank">Events</Link>
                      <Link href="" target="_blank">Network blogs</Link>
                    </div>
                    <div className="footer-top-column">
                      <Link href="" target="_blank">Join us</Link>
                      <Link href="" target="_blank">Current opportunities</Link>
                      <Link href="" target="_blank">Our Values</Link>
                      <Link href="" target="_blank">Contact us</Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="footer-bottom">
                <div className="footer-icon">
                  <Image
                    alt="bracket-left"
                    src='/bracket_left.svg'
                    fill
                  />
                </div>
                <div className="footer-link">
                  <Image
                    alt="linkedin icon"
                    src='/linkedin.svg'
                    fill
                  />
                </div>
                <div className="footer-link">
                  <Image
                    alt="youtube icon"
                    src='/youtube.svg'
                    fill
                    style={{
                      objectFit: 'cover',
                    }}
                  />
                </div>
                <div className="footer-icon">
                  <Image
                    alt="bracket right icon"
                    src='/bracket_right.svg'
                    fill
                  />
                </div>
              </div>
            </footer>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
