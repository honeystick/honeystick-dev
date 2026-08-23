import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoneystickFab as Fab } from '@honeystick/react-native';

import { useCart } from '../hooks/use-cart';
import { theme } from '../theme';

/**
 * The Honeystick mark, placed for this particular store.
 *
 * The SDK's FAB knows how to draw itself and pin to a corner; where that corner
 * actually is, is the app's problem, and on native it is a real one. Two things
 * the component cannot know:
 *
 *   - the safe-area inset. Reading it needs a provider that not every app
 *     mounts, so the SDK takes an offset instead of requiring one.
 *   - the cart bar. It is this store's own floating control, it spans the full
 *     width, and it only exists when there is something in the cart - so the
 *     mark has to move up out of its way and back down again.
 *
 * Compact on purpose. A phone screen is already carrying a cart bar and a
 * product grid, and a pill reading "Billing by Honeystick" across the bottom of
 * it is a banner rather than a mark. The label is still there for screen
 * readers, which is where it does the work anyway.
 */
export default function HoneystickFab() {
  const insets = useSafeAreaInsets();
  const { cartCount } = useCart();

  // 48 is the cart bar's height, plus the gap it already leaves itself
  const clearsCartBar = cartCount > 0 ? 48 + theme.spacing * 0.75 : 0;

  return (
    <Fab compact offset={insets.bottom + theme.spacing * 0.75 + clearsCartBar} />
  );
}
