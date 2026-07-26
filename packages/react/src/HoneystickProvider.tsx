'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useRef, type ReactNode } from 'react';

import { createHoneystickClient, DEFAULT_PATH_PREFIX } from '@honeystick/js';

import { HoneystickContext, type HoneystickContextValue } from './HoneystickContext';

export type HoneystickProviderProps = {
  children: ReactNode;
  /**
   * Base URL of your own server, e.g. "https://api.example.com". Defaults to
   * the current origin, which is what a browser wants and what a native app
   * cannot have.
   */
  backendUrl?: string;
  /** Path your Honeystick handler is mounted on. Defaults to "/billing". */
  pathPrefix?: string;
  /**
   * Send cookies with each call. Needed whenever the handler's `identify` reads
   * a session, and required once your backend is on another origin.
   */
  includeCredentials?: boolean;
  headers?: Record<string, string>;
  /** Safe to ship. A secret key must never appear here. */
  publishableKey?: string;
};

/**
 * Provider for the Honeystick React SDK.
 *
 * The client it builds holds no secret: it calls the route your handler is
 * mounted on, on your own server, and that handler is the only place your
 * secret key exists.
 *
 * It also owns the react-query cache the hooks read from - kept in a ref so a
 * re-render never swaps the cache out from under them.
 */
export const HoneystickProvider = ({
  children,
  backendUrl,
  pathPrefix,
  includeCredentials,
  headers,
  publishableKey,
}: HoneystickProviderProps) => {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60,
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });
  }

  const contextValue = useMemo<HoneystickContextValue>(
    () => ({
      client: createHoneystickClient({
        backendUrl,
        pathPrefix: pathPrefix ?? DEFAULT_PATH_PREFIX,
        includeCredentials,
        headers,
        publishableKey,
      }),
    }),
    [
      backendUrl,
      pathPrefix,
      includeCredentials,
      publishableKey,
      JSON.stringify(headers),
    ],
  );

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <HoneystickContext.Provider value={contextValue}>
        {children}
      </HoneystickContext.Provider>
    </QueryClientProvider>
  );
};
