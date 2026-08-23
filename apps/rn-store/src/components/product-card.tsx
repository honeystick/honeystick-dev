import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCart } from '../hooks/use-cart';
import { money, theme } from '../theme';
import type { Product } from '../types';

/**
 * A product, on the shop floor.
 *
 * No photograph, and that is a deliberate consequence of being a bare React
 * Native app rather than an oversight. The store serves its artwork as SVG, and
 * React Native's own `Image` cannot render SVG - the Expo store gets it from
 * `expo-image`, and matching that here would mean `react-native-svg`, a native
 * dependency and a pod install, added to a sample so that a T-shirt has a
 * picture.
 *
 * The initial and the category do the same job at this size. What the sample is
 * for is the billing, and a dependency that costs a native rebuild is a poor
 * price for decoration.
 */
export default function ProductCard({ product }: { product: Product }) {
  const { cart, addToCart, decreaseProductQuantity } = useCart();
  const quantity = cart[product.ext_id]?.quantity ?? 0;
  const soldOut = product.stock <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.thumb}>
        <Text style={styles.thumbText}>
          {product.title.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <Text style={styles.category}>{product.category}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.price}>{money(product.price)}</Text>
        <Text style={styles.stock}>
          {soldOut ? 'Sold out' : `${product.stock} left`}
        </Text>
      </View>

      {quantity > 0 ? (
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove one ${product.title}`}
            onPress={() => decreaseProductQuantity(product)}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.quantity}>{quantity}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add one ${product.title}`}
            disabled={soldOut}
            onPress={() => addToCart(product)}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={soldOut}
          onPress={() => addToCart(product)}
          style={({ pressed }) => [
            styles.add,
            (pressed || soldOut) && styles.pressed,
          ]}
        >
          <Text style={styles.addText}>
            {soldOut ? 'Sold out' : 'Add to cart'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
    gap: 4,
  },
  thumb: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgPrimary,
    marginBottom: 4,
  },
  thumbText: { fontSize: 28, fontWeight: '700', color: theme.colorAlt },
  category: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorSecondary,
  },
  title: { fontSize: 13, fontWeight: '600', color: theme.colorPrimary },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: { fontSize: 15, fontWeight: '700', color: theme.colorPrimary },
  stock: { fontSize: 10, color: theme.colorSecondary },
  add: {
    marginTop: 6,
    backgroundColor: theme.bgMuted,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addText: { color: theme.colorLight, fontWeight: '600', fontSize: 12 },
  stepper: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bgMuted,
  },
  step: { paddingHorizontal: 16, paddingVertical: 6 },
  stepText: { color: theme.colorLight, fontSize: 18, fontWeight: '700' },
  quantity: { color: theme.colorLight, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
