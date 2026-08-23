import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '../hooks/use-cart';
import { money, theme } from '../theme';
import type { RootStackParamList } from '../navigation';

/** The basket, and the one button that turns it into an order. */
export default function CartScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {
    cart,
    cartTotal,
    increaseProductQuantity,
    decreaseProductQuantity,
    removeFromCart,
  } = useCart();

  const lines = Object.values(cart);

  if (!lines.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Your cart is empty.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {lines.map(({ product, quantity }) => (
          <View key={product.ext_id} style={styles.line}>
            <View style={styles.lineText}>
              <Text style={styles.lineTitle} numberOfLines={2}>
                {product.title}
              </Text>
              <Text style={styles.lineUnit}>{money(product.price)} each</Text>
            </View>

            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove one ${product.title}`}
                onPress={() => decreaseProductQuantity(product)}
                style={({ pressed }) => [
                  styles.step,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.quantity}>{quantity}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add one ${product.title}`}
                onPress={() => increaseProductQuantity(product)}
                style={({ pressed }) => [
                  styles.step,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.lineEnd}>
              <Text style={styles.lineTotal}>
                {money(product.price * quantity)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${product.title}`}
                onPress={() => removeFromCart(product.ext_id)}
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing }]}
      >
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(cartTotal)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Checkout')}
          style={({ pressed }) => [styles.pay, pressed && styles.pressed]}
        >
          <Text style={styles.payText}>Checkout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgPrimary,
  },
  empty: { color: theme.colorSecondary },
  content: { padding: theme.spacing, gap: theme.spacing * 0.5 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing * 0.5,
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
  },
  lineText: { flex: 1, gap: 2 },
  lineTitle: { fontSize: 13, fontWeight: '600', color: theme.colorPrimary },
  lineUnit: { fontSize: 11, color: theme.colorSecondary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgMuted,
  },
  step: { paddingHorizontal: 10, paddingVertical: 4 },
  stepText: { color: theme.colorLight, fontSize: 16, fontWeight: '700' },
  quantity: {
    color: theme.colorLight,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  lineEnd: { alignItems: 'flex-end', gap: 2 },
  lineTotal: { fontWeight: '700', color: theme.colorPrimary },
  remove: { fontSize: 10, color: theme.danger },
  footer: {
    padding: theme.spacing,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.bgSecondary,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: theme.colorSecondary },
  totalValue: { fontWeight: '700', color: theme.colorPrimary, fontSize: 16 },
  pay: {
    backgroundColor: theme.bgMuted,
    padding: theme.spacing * 0.9,
    alignItems: 'center',
  },
  payText: { color: theme.colorLight, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
