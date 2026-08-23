import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ResetDemo from '@/components/reset-demo';
import { useCart } from '@/hooks/use-cart';
import { startCheckout } from '@/lib/api';
import { money, theme } from '@/lib/theme';

/**
 * Paying for the basket.
 *
 * The web store's `app/checkout/page.tsx`, with the same division of trust: the
 * app sends the product reference and how many, and nothing about the price. The
 * total shown here is for the shopper to read - the server prices the basket
 * again from the catalogue, because a total arriving from a client is a total the
 * client could have chosen.
 *
 * The card is never seen by this app or by the store. The provider's own hosted
 * page collects it, in a system browser rather than a WebView, so the shopper can
 * see whose address bar they are typing into.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  // Edge-to-edge is mandatory on current Android, so the gesture bar is drawn
  // over this screen rather than beside it - and the thing it lands on is the
  // Pay button. Measured rather than guessed, so it is right on a phone with
  // hardware buttons too, where the inset is 0.
  const insets = useSafeAreaInsets();
  const { cart, cartTotal, clearCart } = useCart();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart);

  const onPay = async () => {
    setPending(true);
    setError(null);

    const result = await startCheckout({
      email,
      name,
      items: lines.map(({ product, quantity }) => ({
        ext_id: product.ext_id,
        quantity,
      })),
    }).catch((cause: unknown) => ({
      ok: false as const,
      error: cause instanceof Error ? cause.message : 'Checkout failed.',
    }));

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // the basket has become an order; leaving it filled would let a second
    // attempt buy it twice
    clearCart();
    setPending(false);

    // A relative URL is one of this app's own screens - the sample-data path.
    // Anything absolute is the provider's hosted page and belongs in a browser.
    if (result.redirect_url.startsWith('/')) {
      const params = new URLSearchParams(result.redirect_url.split('?')[1]);
      router.replace({
        pathname: '/complete',
        params: Object.fromEntries(params.entries()),
      });
      return;
    }

    await WebBrowser.openAuthSessionAsync(result.redirect_url, 'demostore://');
    router.replace({
      pathname: '/complete',
      params: { order: result.order_id },
    });
  };

  if (!lines.length) {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          <ResetDemo />
          <Text style={styles.empty}>
            Your cart is empty, so there is nothing to pay for.
          </Text>
        </View>
      </View>
    );
  }

  const canPay = !pending && email.trim().length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.padded}>
        <ResetDemo />

        <View style={styles.summary}>
          {lines.map(({ product, quantity }) => (
            <View key={product.ext_id} style={styles.line}>
              <Text style={styles.lineTitle} numberOfLines={1}>
                {product.title}
              </Text>
              <Text style={styles.lineQty}>×{quantity}</Text>
              <Text style={styles.lineTotal}>
                {money(product.price * quantity)}
              </Text>
            </View>
          ))}
          <View style={[styles.line, styles.grandTotal]}>
            <Text style={styles.lineTitle}>Total</Text>
            <Text style={styles.lineQty} />
            <Text style={styles.lineTotal}>{money(cartTotal)}</Text>
          </View>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoComplete="name"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + theme.spacing },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onPay}
          disabled={!canPay}
          style={({ pressed }) => [
            styles.pay,
            (pressed || !canPay) && styles.pressed,
          ]}
        >
          <Text style={styles.payText}>
            {pending ? 'Starting checkout…' : `Pay ${money(cartTotal)}`}
          </Text>
        </Pressable>
        <Text style={styles.note}>Billed through Payfast.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  padded: { padding: theme.spacing, gap: 6 },
  empty: { color: theme.colorSecondary },
  summary: {
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
    gap: 6,
    marginBottom: 6,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineTitle: { flex: 1, color: theme.colorPrimary, fontSize: 13 },
  lineQty: { width: 34, color: theme.colorSecondary, fontSize: 13 },
  lineTotal: { fontWeight: '700', color: theme.colorPrimary },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: theme.colorAlt,
    paddingTop: 6,
    marginTop: 2,
  },
  label: { marginTop: 6, fontSize: 12, color: theme.colorSecondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colorAlt,
    padding: 10,
    color: theme.colorPrimary,
  },
  error: { marginTop: 8, color: theme.danger },
  footer: {
    padding: theme.spacing,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.bgSecondary,
  },
  pay: {
    backgroundColor: theme.bgMuted,
    padding: theme.spacing * 0.9,
    alignItems: 'center',
  },
  payText: { color: theme.colorLight, fontWeight: '700' },
  note: { fontSize: 11, color: theme.colorSecondary, textAlign: 'center' },
  pressed: { opacity: 0.64 },
});
