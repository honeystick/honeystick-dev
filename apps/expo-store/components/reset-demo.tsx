import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCart } from '@/hooks/use-cart';
import { resetDemo } from '@/lib/api';
import { theme } from '@/lib/theme';

/**
 * Putting the demo back, on every screen.
 *
 * Honeystick Example App's shelves and its subscription seats are small fixtures held in
 * memory on the server, so a visitor can empty them - which is the point, and
 * also why there has to be a way back. It belongs on every screen rather than
 * tucked into one: whichever screen you exhausted is the screen you want to
 * refill from.
 *
 * Three things move together, and missing any one of them looks like the button
 * not working: the server's counters, the copy of the catalogue this screen is
 * holding, and the cart - which would otherwise keep lines for stock that has
 * just been handed back.
 *
 * `onReset` is the screen's own refetch rather than something this component
 * knows how to do. A list that fetched on mount has to be told, and the caller is
 * the only one who knows how.
 */
export default function ResetDemo({ onReset }: { onReset?: () => void }) {
  const { clearCart } = useCart();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = useCallback(async () => {
    setPending(true);
    setDone(false);
    setError(null);
    try {
      await resetDemo();
      clearCart();
      onReset?.();
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset.');
    } finally {
      setPending(false);
    }
  }, [clearCart, onReset]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Text style={styles.note}>
          Sample data. Stock and seats are small on purpose, and start over from
          here.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          disabled={pending}
          style={({ pressed }) => [
            styles.button,
            (pressed || pending) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {pending ? 'Resetting…' : done ? 'Reset ✓' : 'Reset'}
          </Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.bgSecondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colorAlt,
    padding: theme.spacing * 0.75,
    marginBottom: theme.spacing,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing * 0.75,
  },
  note: { flex: 1, color: theme.colorSecondary, fontSize: 12 },
  button: {
    backgroundColor: theme.bgMuted,
    paddingHorizontal: theme.spacing,
    paddingVertical: 8,
  },
  buttonPressed: { opacity: 0.64 },
  buttonText: {
    color: theme.colorLight,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  error: { color: theme.danger, fontSize: 12 },
});
