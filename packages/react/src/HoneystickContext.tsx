'use client';

import { createContext, useContext } from 'react';

import type { Honeystick } from '@honeystick/js';

export type HoneystickContextValue = {
  client: Honeystick;
};

export const HoneystickContext = createContext<HoneystickContextValue | null>(
  null,
);

export const useHoneystickClient = ({
  caller,
}: {
  caller: string;
}): Honeystick => {
  const context = useContext(HoneystickContext);
  if (!context) {
    throw new Error(`${caller} must be used within <HoneystickProvider/>`);
  }
  return context.client;
};
