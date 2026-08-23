/**
 * Honeystick for React Native.
 *
 * Everything from `@honeystick/react` - the hooks are identical, because the
 * proxy transport does not care whether it is running in a page or in an app -
 * with two things replaced for native:
 *
 *   - `HoneystickProvider`, which requires `backendUrl`. A page has an origin
 *     to fall back on and an app does not.
 *   - `HoneystickFab`, which is views rather than an anchor, and pins to its
 *     parent rather than to the viewport.
 *
 * `@honeystick/expo` re-exports this file unchanged. There is nothing
 * Expo-specific in either of them, and one implementation is one place for the
 * native behaviour to be right.
 */
export { HoneystickProvider } from './HoneystickProvider.js';
export type { HoneystickProviderProps } from './HoneystickProvider.js';
export { HoneystickFab } from './HoneystickFab.js';
export type { HoneystickFabProps } from './HoneystickFab.js';

export * from '@honeystick/react/hooks';
export { HoneystickContext, useHoneystickClient } from '@honeystick/react';
export type { HoneystickContextValue } from '@honeystick/react';
export { HoneystickError } from 'honeystick';
export type { CustomerRef, PlanType } from 'honeystick';
