import { createElement, type ReactNode } from 'react';

import {
  HoneystickProvider as ReactProvider,
  type HoneystickProviderProps as ReactProviderProps,
} from '@honeystick/react';

export * from '@honeystick/react/hooks';
export { HoneystickContext, useHoneystickClient } from '@honeystick/react';
export { HoneystickError } from '@honeystick/js';

export type HoneystickProviderProps = Omit<
  ReactProviderProps,
  'backendUrl' | 'children'
> & {
  /**
   * Your server's origin, e.g. "https://api.yourapp.com".
   *
   * Required here where it is optional on web: a page can call /billing on the
   * origin it was served from, but an app was not served from anywhere. Leaving
   * it out would resolve every call against nothing and fail at runtime, so it
   * is asked for up front.
   */
  backendUrl: string;
  children: ReactNode;
};

/**
 * Honeystick for Expo and React Native.
 *
 * The same hooks as @honeystick/react - a native app reaches the handler on your
 * server exactly as a browser does, and holds no secret key either:
 *
 * ```tsx
 * <HoneystickProvider
 *   backendUrl="https://api.yourapp.com"
 *   pathPrefix="/billing"
 *   includeCredentials
 * >
 *   <App />
 * </HoneystickProvider>
 * ```
 */
export function HoneystickProvider({
  children,
  backendUrl,
  ...options
}: HoneystickProviderProps) {
  if (!backendUrl) {
    throw new Error(
      'HoneystickProvider needs backendUrl on native: there is no current origin to fall back on. Point it at the server your Honeystick handler is mounted on.',
    );
  }

  return createElement(ReactProvider, { ...options, backendUrl, children });
}
