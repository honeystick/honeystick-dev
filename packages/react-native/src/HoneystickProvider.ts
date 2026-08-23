import { createElement, type ReactNode } from 'react';

import {
  HoneystickProvider as ReactProvider,
  type HoneystickProviderProps as ReactProviderProps,
} from '@honeystick/react';

export type HoneystickProviderProps = Omit<
  ReactProviderProps,
  'backendUrl' | 'children'
> & {
  /**
   * Your server's origin, e.g. "https://api.yourapp.com".
   *
   * Required here where it is optional on web, and that asymmetry is the whole
   * reason this package exists. A page can call `/billing` on the origin it was
   * served from; an app was not served from anywhere. Leaving it out would
   * resolve every call against nothing and fail at runtime with a bare
   * "Network request failed", so it is asked for at the type level instead.
   */
  backendUrl: string;
  children: ReactNode;
};

/**
 * Honeystick for React Native.
 *
 * The same hooks as `@honeystick/react` - a native app reaches the handler on
 * your server exactly as a browser does, and holds no secret key either:
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
 *
 * On native the missing key is not a nicety. An app bundle is readable by
 * anyone who has the app, so a secret key compiled into one is a published
 * secret - the same argument as `NEXT_PUBLIC_` on the web, with the same
 * answer. The client this builds is the SDK's proxy client, which carries no
 * credential of its own and calls your server's `/billing` route, where the key
 * actually lives.
 */
export function HoneystickProvider({
  children,
  backendUrl,
  ...options
}: HoneystickProviderProps) {
  // The type already says this is required, and it is still checked: the value
  // usually arrives from an environment variable, and an unset one is a
  // perfectly well-typed empty string. Failing here names the cause; failing
  // later names only the request that could not be made.
  if (!backendUrl) {
    throw new Error(
      'HoneystickProvider needs backendUrl on native: there is no current origin to fall back on. Point it at the server your Honeystick handler is mounted on.',
    );
  }

  return createElement(ReactProvider, { ...options, backendUrl, children });
}
