import { Pressable, StyleSheet, Text, View } from 'react-native';

import { money, theme } from '../theme';
import type { Service } from '../types';

/**
 * A service, on the shop floor.
 *
 * Reads like a product card turned on its side, which is the point - it belongs
 * to the same catalogue and should look like it. What it deliberately does not
 * have is a quantity: a subscription is one per shopper, so the button opens the
 * detail sheet instead of adding a line to the cart. That difference is the
 * whole reason this is not a ProductCard with a flag on it.
 */
export default function ServiceCard({
  service,
  onOpen,
}: {
  service: Service;
  onOpen: () => void;
}) {
  // a seat-limited service can be fully booked; one with no limit never is, and
  // null is that rather than zero
  const soldOut = service.seats !== null && service.seats <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.category}>{service.category}</Text>
        <Text style={styles.title}>{service.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {service.description}
        </Text>
        {!!service.metered.length && (
          <Text style={styles.meters}>
            Meters {service.metered.map((meter) => meter.name).join(' · ')}
          </Text>
        )}
      </View>

      <View style={styles.side}>
        <Text style={styles.price}>{money(service.price)}</Text>
        <Text style={styles.frequency}>per {service.frequency}</Text>
        {service.seats !== null && (
          <Text style={styles.frequency}>
            {soldOut ? 'Fully booked' : `${service.seats} seats left`}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`About ${service.title}`}
          disabled={soldOut}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.open,
            (pressed || soldOut) && styles.pressed,
          ]}
        >
          <Text style={styles.openText}>
            {soldOut ? 'Full' : 'Subscribe'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: theme.spacing * 0.75,
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
    marginBottom: theme.spacing * 0.5,
  },
  body: { flex: 1, gap: 3 },
  category: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorSecondary,
  },
  title: { fontSize: 15, fontWeight: '700', color: theme.colorPrimary },
  description: { fontSize: 12, color: theme.colorSecondary, lineHeight: 17 },
  meters: { fontSize: 10, color: theme.colorAlt, marginTop: 2 },
  side: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  price: { fontSize: 16, fontWeight: '700', color: theme.colorPrimary },
  frequency: { fontSize: 10, color: theme.colorSecondary },
  open: {
    marginTop: 4,
    backgroundColor: theme.bgMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openText: { color: theme.colorLight, fontWeight: '600', fontSize: 12 },
  pressed: { opacity: 0.6 },
});
