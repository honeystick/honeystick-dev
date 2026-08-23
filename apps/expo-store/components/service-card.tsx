import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { imageUrl } from '@/lib/config';
import { money, theme } from '@/lib/theme';

import type { zServiceType } from '@/types/service';

/**
 * A service, on the shop floor.
 *
 * Reads like a product card turned on its side, which is the point - it belongs
 * to the same catalogue and should look like it. What it deliberately does not
 * have is a quantity: a subscription is one per shopper, so the button opens the
 * detail sheet instead of adding a line to the cart.
 */
export default function ServiceCard({
  service,
  onOpen,
}: {
  service: zServiceType;
  onOpen: () => void;
}) {
  // a seat-limited service can be fully booked; one with no limit never is, and
  // null is that rather than zero
  const soldOut = service.seats !== null && service.seats <= 0;

  return (
    <View style={styles.card}>
      <Image
        source={imageUrl(service.image)}
        style={styles.image}
        contentFit="contain"
        accessibilityLabel={service.title}
      />

      <View style={styles.body}>
        <Text style={styles.category}>{service.category}</Text>
        <Text style={styles.title}>{service.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {service.description}
        </Text>
      </View>

      <View style={styles.pricing}>
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
          onPress={onOpen}
          disabled={soldOut}
          style={({ pressed }) => [
            styles.open,
            (pressed || soldOut) && styles.pressed,
          ]}
        >
          <Text style={styles.openText}>{soldOut ? 'Full' : 'View'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing * 0.75,
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
    marginBottom: theme.spacing * 0.5,
  },
  image: { width: 64, height: 64 },
  body: { flex: 1, gap: 2 },
  category: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.colorSecondary,
  },
  title: { fontSize: 15, fontWeight: '700', color: theme.colorPrimary },
  description: { fontSize: 12, color: theme.colorSecondary },
  pricing: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: 16, fontWeight: '700', color: theme.colorPrimary },
  frequency: { fontSize: 10, color: theme.colorSecondary },
  open: {
    marginTop: 4,
    backgroundColor: theme.bgMuted,
    paddingHorizontal: theme.spacing * 0.75,
    paddingVertical: 6,
  },
  openText: { color: theme.colorLight, fontSize: 12 },
  pressed: { opacity: 0.64 },
});
