import { useCallback } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
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
 *     from two views and a bracket glyph, and the ground is one brand colour.
 *     A component in an SDK that pulls in react-native-svg is a component that
 *     costs a native rebuild to adopt, which is too high a price for a badge.
 *
 * Safe-area is the caller's, not this component's. `useSafeAreaInsets` needs a
 * provider that not every app mounts, and a hard-coded guess at the gesture bar
 * is wrong on half of all phones - so pass `offset` from your own inset.
 */

export type HoneystickFabProps = {
  /** where it goes. Defaults to Honeystick's own site. */
  href?: string;
  /** the text beside the mark. Hidden entirely when `compact`. */
  label?: string;
  /** which corner of the parent it pins to */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /**
   * How far from the two edges of that corner. Add your own safe-area inset to
   * it - this component cannot read one without a provider it should not
   * require.
   */
  offset?: number;
  /** mark only, no label - for a screen that is already busy */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** the Honeystick brackets, as type rather than as an SVG dependency */
const Mark = () => (
  <View style={styles.mark}>
    <Text style={styles.markText}>[</Text>
    <View style={styles.markBars}>
      <View style={styles.markBar} />
      <View style={styles.markBar} />
    </View>
    <Text style={styles.markText}>]</Text>
  </View>
);

export const HoneystickFab = ({
  href = 'https://honeystick.co.za',
  label = 'Billing by Honeystick',
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
      <Mark />
      {!compact && (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#6b5ce7',
    // iOS takes the four shadow props and Android takes only elevation, so
    // both are set - one of them is always the no-op
    shadowColor: '#2b2440',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  compact: { width: 48, paddingHorizontal: 0, justifyContent: 'center' },
  pressed: { opacity: 0.82 },
  label: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  markText: { color: '#ffffff', fontSize: 17, fontWeight: '300', lineHeight: 20 },
  markBars: { gap: 3, justifyContent: 'center' },
  markBar: { width: 9, height: 2, backgroundColor: '#ffffff' },
});
