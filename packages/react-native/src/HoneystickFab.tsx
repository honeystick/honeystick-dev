import { useCallback } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * The way back to Honeystick, on native.
 *
 * The web FAB's counterpart, and deliberately not a port of it - three things
 * a browser gives free do not exist here, and each one changes the component
 * rather than just its styling:
 *
 *   - there is no `position: fixed`. A view pinned with `position: 'absolute'`
 *     is pinned to its *parent*, so this only floats over a screen if it is the
 *     last child of a flex:1 container. That is a real constraint on the caller
 *     and is why it is written down here rather than discovered.
 *   - there is no hover, so there is no expand-on-hover. The label is either
 *     shown or it is not, decided by the caller with `compact`.
 *   - there is no SVG and no gradient without a dependency. The mark is drawn
 *     as plain views, and the ground is one brand colour. A component in an SDK
 *     that pulls in react-native-svg is a component that costs a native rebuild
 *     to adopt, which is too high a price for a badge - and it buys nothing
 *     here, because every shape in the Honeystick mark is a rectangle.
 *
 * Safe-area is the caller's, not this component's. `useSafeAreaInsets` needs a
 * provider that not every app mounts, and a hard-coded guess at the gesture bar
 * is wrong on half of all phones - so pass `offset` from your own inset.
 */

/**
 * Where the mark points, when the caller does not say.
 *
 * `HS_APP_URL`: the Honeystick **app** - honeystick.co.za in production,
 * dev.honeystick.co.za on preview, localhost:8081 locally. Not `HONEYSTICK_URL`,
 * which is the API origin and is no place to send a person, and not a demo
 * store's address either - a badge on the demo pointing at the demo is a link
 * to the page you are already looking at.
 *
 * `EXPO_PUBLIC_` is the only prefix Metro substitutes, and substitution is the
 * mechanism - the key has to be written out in full for the bundler to find and
 * replace it, so this cannot be a lookup by computed name. A bare React Native
 * app has no equivalent and no `.env` at all, which is why `href` stays a prop:
 * rn-store passes it from its own config, the same way it does `API_URL`.
 */
const envDemoUrl = (): string | undefined => {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env.EXPO_PUBLIC_HS_APP_URL ?? process.env.HS_APP_URL;
};

export type HoneystickFabProps = {
  /**
   * Where it goes. Defaults to `HS_APP_URL` from the environment, and to
   * Honeystick's own site when that is unset.
   */
  href?: string;
  /**
   * The accessible name, for screen readers.
   *
   * Not the string that is drawn. On screen the badge reads "Billing by"
   * followed by the Honeystick logo, and an image announces nothing - so this
   * has to spell out the word the mark stands in for, or the control is read
   * aloud as "Billing by" and then nothing.
   */
  label?: string;
  /**
   * The words in front of the mark. The logo finishes the sentence.
   *
   * Separate from `label` because they are different jobs: this is read, that
   * is announced. Empty string for the mark on its own.
   */
  caption?: string;
  /** which corner of the parent it pins to */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /**
   * How far from the two edges of that corner. Add your own safe-area inset to
   * it - this component cannot read one without a provider it should not
   * require.
   */
  offset?: number;
  /**
   * Mark only, no caption.
   *
   * Left in because a caller may genuinely want it, but no longer what the
   * sample apps use. The caption is three short words now rather than the whole
   * of "Billing by Honeystick", so it fits across the bottom of a phone without
   * reading as a banner - which was the only reason the samples hid it.
   */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Honeystick's `--color-primary`, the honey the mark is drawn in */
const MARK_COLOR = '#facc15';

type MarkProps = {
  /** rendered square, as the 140x140 artwork is */
  size?: number;
  color?: string;
};

/**
 * The Honeystick mark, as the artwork itself.
 *
 * This went through two wrong answers before this one, and both are worth
 * recording because each looks reasonable until you see the real logo:
 *
 *   1. A `[`, two bars and a `]` set as text - not the logo at all, just the
 *      nearest thing that could be typed, wearing the system font's idea of
 *      what a bracket looks like.
 *   2. That same shape rebuilt from eight positioned views. Pixel-exact
 *      against the file it was traced from, and that file turned out to be a
 *      stale mark rather than the brand's.
 *
 * The real mark is three honeycomb cells drawn as *stroked* hexagons, and that
 * is what rules out a third attempt at drawing it: a hexagon is not
 * axis-aligned, so views cannot make one without rotation tricks, and an
 * outline needs its inside left empty. `react-native-svg` would manage it and
 * costs a native rebuild to adopt, which is still too much to ask of anyone
 * installing a badge.
 *
 * So it is the PNG the Honeystick app itself ships, bundled with this package.
 * Metro resolves an image import with no native dependency and no extra setup,
 * and `tintColor` recolours it: the asset is white on transparency, so tinting
 * repaints every opaque pixel and leaves the outlines exactly where they are.
 * One asset, every colour the badge will ever need.
 */
const Mark = ({ size = 22, color = MARK_COLOR }: MarkProps) => (
  <Image
    /**
     * `../assets/` and not `./`, which is the one detail that decides whether
     * this works once published.
     *
     * `tsc` emits .js and .d.ts and copies nothing else, so an asset beside
     * this file in src/ simply is not in dist/ - and dist/index.js is what the
     * package's `main` points at. A path relative to the package root resolves
     * the same from src/HoneystickFab.tsx and from dist/HoneystickFab.js, so
     * one asset serves the workspace and the published tarball with no copy
     * step to remember.
     */
    source={require('../assets/honeystick-mark.png')}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
    // the pill already carries the accessible name; announcing the mark too
    // makes a screen reader say "Honeystick" twice for one control
    accessible={false}
  />
);

export const HoneystickFab = ({
  href = envDemoUrl() ?? 'https://honeystick.co.za',
  label = 'Billing by Honeystick',
  caption = 'Billing by',
  position = 'bottom-right',
  offset = 24,
  compact = false,
  style,
}: HoneystickFabProps) => {
  const onPress = useCallback(() => {
    // Failures are swallowed rather than thrown. There is no browser on some
    // devices and no network on others, and neither is worth crashing a store
    // over - this is a badge, and the worst honest outcome is that it does
    // nothing.
    void Linking.openURL(href).catch(() => {});
  }, [href]);

  const corner: ViewStyle = {
    [position.startsWith('bottom') ? 'bottom' : 'top']: offset,
    [position.endsWith('right') ? 'right' : 'left']: offset,
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        corner,
        compact && styles.compact,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* "Billing by" then the logo that finishes it. The Pressable already
          carries the accessible name, so the caption is not announced again. */}
      {!compact && caption ? (
        <Text style={styles.label} numberOfLines={1} accessible={false}>
          {caption}
        </Text>
      ) : null}
      <Mark />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    /**
     * Honeystick black with the mark in honey - `--color-primary` from the
     * Honeystick app. That is the point of changing it: the badge should look
     * like the product it links to, not like the store it is sitting on.
     */
    backgroundColor: '#000000',
    // a faint honey rim, so the pill still has an edge on a dark screen
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.28)',
    // iOS takes the four shadow props and Android takes only elevation, so
    // both are set - one of them is always the no-op
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  compact: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  pressed: { opacity: 0.82 },
  label: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
});
