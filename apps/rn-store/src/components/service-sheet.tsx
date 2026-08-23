import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { startSubscription } from '../api';
import { useSubscription } from '../hooks/use-subscription';
import { money, theme } from '../theme';
import type { Service } from '../types';

/**
 * What a service costs and what it does, before anyone commits to it.
 *
 * The web store's `service-modal.tsx` as a native sheet, with one genuine
 * difference at the end: where the browser sets `window.location`, this calls
 * `Linking.openURL`.
 *
 * That difference is not cosmetic. The provider's checkout must not run inside
 * a WebView this app controls - a shopper cannot see the address bar to know
 * who they are giving a card to, and the app could read the page if it wanted
 * to. `Linking.openURL` hands off to the real browser, which is both safer and
 * the only version a payment provider will bless.
 *
 * The Expo store reaches for `WebBrowser.openAuthSessionAsync`, which does the
 * same handoff and additionally resolves when the browser closes. Bare React
 * Native has no equivalent in core, so this app finds out it is back a
 * different way: the deep link the payment page navigates to, which App.tsx
 * listens for. That is the only place in either app where being Expo-free costs
 * anything, and it costs about fifteen lines.
 */
export default function ServiceSheet({
  service,
  onClose,
  onSubscribed,
}: {
  service: Service | null;
  onClose: () => void;
  onSubscribed?: () => void;
}) {
  const { remember } = useSubscription();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // a fresh sheet asks fresh questions - a stale error from a previous attempt
  // reads as a failure of this one
  useEffect(() => {
    if (!service) return;
    setError(null);
    setPending(false);
  }, [service]);

  const onSubscribe = async () => {
    if (!service) return;
    setPending(true);
    setError(null);

    /**
     * The plan reference and who is subscribing, and nothing about the price.
     * The figure shown below is for the shopper to read - the server looks the
     * price up again from the catalogue, because a price arriving from a client
     * is a price the client could have chosen.
     *
     * The email is the whole identity here. It reaches
     * `POST /customer-plans/checkout` as a `customers` entry, and Honeystick
     * matches an existing customer on it or registers a new one - which is why
     * this app never calls `POST /customers` and never has to hold a customer
     * id.
     */
    const result = await startSubscription({
      ext_id: service.ext_id,
      email,
      name,
    }).catch((cause: unknown) => ({
      ok: false as const,
      error: cause instanceof Error ? cause.message : 'Could not subscribe.',
    }));

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    /**
     * Written down before the shopper leaves, and awaited.
     *
     * The next line hands the phone to another application entirely, and this
     * one may be suspended while that happens. An unawaited write is not
     * guaranteed to have landed by then, and what is lost is the only handle on
     * the plan they just bought - the account screen has no other way to find
     * it, because the return url could not carry an id that did not exist yet
     * when it was sent.
     */
    if (result.plan_id) {
      await remember({
        planId: result.plan_id,
        customerId: result.customer_id,
        reference: result.reference,
        planName: service.title,
        email: email.trim().toLowerCase(),
      });
    }

    onSubscribed?.();
    onClose();
    setPending(false);

    // A relative URL is the server's sample-data path, which creates nothing -
    // there is no payment page to open and the account screen will say so.
    if (result.redirect_url.startsWith('/')) return;

    await Linking.openURL(result.redirect_url).catch(() =>
      setError('Could not open the payment page.'),
    );
  };

  const canSubscribe = !pending && email.trim().length > 0;

  return (
    <Modal
      visible={service !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {service && (
        /**
         * Its own SafeAreaProvider, nested inside the one at the root.
         *
         * A React Native Modal is a separate native view hierarchy - it is not
         * a child of the app's view tree, whatever the JSX suggests - so the
         * root provider's insets do not reach in here. `useSafeAreaInsets`
         * would return zeros and the failure would look like the insets simply
         * not being applied, which is the hard kind of bug to place.
         *
         * `initialMetrics` seeds it with the window's real insets so the first
         * frame is already correct. Without it the sheet slides in flush to the
         * status bar and jumps down once the provider has measured.
         */
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={styles.category}>{service.category}</Text>
                <Text style={styles.title}>{service.title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.close}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.description}>{service.description}</Text>

              {service.benefits.map((benefit) => (
                <Text key={benefit} style={styles.benefit}>
                  • {benefit}
                </Text>
              ))}

              {!!service.metered.length && (
                <View style={styles.meters}>
                  <Text style={styles.metersTitle}>Included each period</Text>
                  {service.metered.map((meter) => (
                    <Text key={meter.ext_id} style={styles.meter}>
                      {meter.limit} × {meter.name} per {meter.interval}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.colorSecondary}
                autoComplete="name"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.colorSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Text style={styles.hint}>
                This address is the customer. Honeystick matches an existing one
                or registers a new one from it, in the same call that creates
                the plan.
              </Text>

              {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>

            <View style={styles.footer}>
              <Text style={styles.priceRow}>
                Then{' '}
                <Text style={styles.priceStrong}>{money(service.price)}</Text> /{' '}
                {service.frequency}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onSubscribe}
                disabled={!canSubscribe}
                style={({ pressed }) => [
                  styles.subscribe,
                  (pressed || !canSubscribe) && styles.pressed,
                ]}
              >
                <Text style={styles.subscribeText}>
                  {pending
                    ? 'Starting…'
                    : `Subscribe — ${money(service.price)}/${service.frequency}`}
                </Text>
              </Pressable>
              <Text style={styles.note}>Billed through Payfast.</Text>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: theme.bgPrimary },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing * 0.75,
    padding: theme.spacing,
    backgroundColor: theme.bgSecondary,
  },
  headText: { flex: 1, gap: 2 },
  category: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.colorSecondary,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.colorPrimary },
  close: { padding: 8 },
  closeText: { fontSize: 18, color: theme.colorPrimary },
  body: { padding: theme.spacing, gap: 8 },
  description: { color: theme.colorPrimary, lineHeight: 20 },
  benefit: { color: theme.colorSecondary, fontSize: 13, lineHeight: 19 },
  meters: {
    marginTop: 8,
    padding: theme.spacing * 0.75,
    backgroundColor: theme.bgSecondary,
    gap: 3,
  },
  metersTitle: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorSecondary,
  },
  meter: { fontSize: 13, color: theme.colorPrimary },
  label: {
    marginTop: theme.spacing * 0.75,
    fontSize: 12,
    color: theme.colorSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colorAlt,
    padding: 10,
    color: theme.colorPrimary,
  },
  hint: { fontSize: 11, color: theme.colorSecondary, lineHeight: 16 },
  error: { marginTop: 8, color: theme.danger },
  footer: {
    padding: theme.spacing,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.bgSecondary,
  },
  priceRow: { color: theme.colorSecondary },
  priceStrong: { fontWeight: '700', color: theme.colorPrimary },
  subscribe: {
    backgroundColor: theme.bgMuted,
    padding: theme.spacing * 0.75,
    alignItems: 'center',
  },
  subscribeText: { color: theme.colorLight, fontWeight: '600' },
  note: { fontSize: 11, color: theme.colorSecondary, textAlign: 'center' },
  pressed: { opacity: 0.64 },
});
