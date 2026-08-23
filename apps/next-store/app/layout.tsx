import type { Metadata } from "next";
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
  title: "The Depot - Ecommerce Store",
  description: "A sample ecommerce store built on Honeystick and Next.js",
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
 * session; The Depot has no accounts yet and treats every visitor as the same
 * guest, but the cookie has to be sent for the day it does.
 */
function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <HoneystickProvider pathPrefix="/api/billing" includeCredentials>
      <CartProvider>
        {children}
        {/* Every page, from the layout, rather than dropped onto the ones
            that happen to be about billing. The point of a mark is that it is
            always in the same place - a shopper who noticed it on the account
            page and cannot find it on the shop floor has learnt nothing. */}
        <HoneystickFab />
      </CartProvider>
    </HoneystickProvider>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${lexend.variable}`}>
        <ClientProviders>
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
