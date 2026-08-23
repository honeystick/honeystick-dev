import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCart } from '@/hooks/use-cart';
import { imageUrl } from '@/lib/config';
import { money, theme } from '@/lib/theme';

import type { zProductType } from '@/types/product';

/**
 * One product, and what is left of it.
 *
 * The same arithmetic as the web store's card: the catalogue's stock figure minus
 * whatever is already in the basket, derived rather than held in state. Held in
 * state it would need an effect to stay honest, and every card would render once
 * with a stale value.
 *
 * Stock is plain inventory, not a metered Honeystick feature. A product here is
 * bought once through a one-time-payment plan, and what a metered feature counts
 * is how much of a live plan's allowance has been spent - a different question,
 * and not one a basket should be asking.
 *
 * The artwork is an SVG served by the store, which is why this uses `expo-image`
 * rather than React Native's own `Image` - the built-in one cannot render SVG at
 * all, and fails by drawing nothing rather than by complaining.
 */
export default function ProductCard({ product }: { product: zProductType }) {
  const { cart, addToCart, increaseProductQuantity, decreaseProductQuantity } =
    useCart();

  const line = cart[product.id];
  const inCartQuantity = line?.quantity ?? 0;
  const stockLeft = product.stock - inCartQuantity;
  const isDepleted = stockLeft <= 0;

  return (
    <View style={styles.card}>
      <Image
        source={imageUrl(product.image)}
        style={styles.image}
        contentFit="contain"
        transition={200}
        accessibilityLabel={product.title}
      />

      <Text style={styles.price}>{money(product.price)}</Text>
      <Text style={styles.category}>{product.category}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.stock}>
          {isDepleted ? 'Sold out' : `${stockLeft} left`}
        </Text>

        {line ? (
          <View style={styles.quantityRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Decrease quantity of ${product.title}`}
              onPress={() => decreaseProductQuantity(product)}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.quantity}>{inCartQuantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Increase quantity of ${product.title}`}
              onPress={() => increaseProductQuantity(product)}
              disabled={isDepleted}
              style={({ pressed }) => [
                styles.step,
                (pressed || isDepleted) && styles.pressed,
              ]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.title} to cart`}
            onPress={() => addToCart(product)}
            disabled={isDepleted}
            style={({ pressed }) => [
              styles.add,
              (pressed || isDepleted) && styles.pressed,
            ]}
          >
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        )}
      </View>
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
  image: { width: '100%', height: 96, marginBottom: 4 },
  price: { fontSize: 18, fontWeight: '700', color: theme.colorPrimary },
  category: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.colorSecondary,
  },
  title: { fontSize: 13, color: theme.colorPrimary, minHeight: 34 },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stock: { fontSize: 11, color: theme.colorSecondary },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    backgroundColor: theme.bgMuted,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.colorLight, fontSize: 16, lineHeight: 18 },
  quantity: {
    minWidth: 26,
    textAlign: 'center',
    color: theme.colorPrimary,
    fontWeight: '600',
  },
  add: {
    backgroundColor: theme.bgMuted,
    paddingHorizontal: theme.spacing * 0.75,
    height: 28,
    justifyContent: 'center',
  },
  addText: { color: theme.colorLight, fontSize: 12 },
  pressed: { opacity: 0.64 },
});
