import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite, with nothing unusual in it - which is the point of this sample.
 *
 * No proxy to the API, deliberately. The Expo and React Native stores reach the
 * Express server cross-origin over its own address, and so does this: a dev
 * proxy would hide the one thing all three have in common, which is that the
 * SDK's client is talking to a server on another origin and needs
 * `includeCredentials` to send a cookie with it. A proxy makes that work by
 * accident in development and fail in production.
 *
 * There is no monorepo configuration here either. The @honeystick packages
 * resolve through npm workspaces to compiled output in their `dist`, exactly as
 * they would from the registry - so what this app exercises is the published
 * shape of the SDK rather than a privileged path into its source.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
