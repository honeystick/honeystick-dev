import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
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
import { useRouter } from 'expo-router';

import { useSubscription } from '@/hooks/use-subscription';
import { startSubscription } from '@/lib/api';
import { imageUrl } from '@/lib/config';
import { money, theme } from '@/lib/theme';

import type { zServiceType } from '@/types/service';

/**
 * What a service costs and what it does, before anyone commits to it.
 *
 * The web store's `service-modal.tsx` as a native sheet. Same job, same shape of
 * result, one genuine difference at the end: where the browser sets
 * `window.location`, this opens the payment page in a system browser.
 *
 * That difference is not cosmetic. The provider's checkout must not run inside a
 * WebView this app controls - a shopper cannot see the address bar to know who
 * they are giving a card to, and the app could read the page if it wanted to.
 * `openAuthSessionAsync` hands off to Safari or Chrome, which is both safer and
 * the only version a payment provider will bless.
 */
export default function ServiceSheet({
  service,
  onClose,
  onSubscribed,
}: {
  service: zServiceType | null;
  onClose: () => void;
  onSubscribed?: () => void;
}) {
  const router = useRouter();
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
     * The next thing that happens is a system browser taking over, and on iOS
     * this app may be suspended while it does. An unawaited write is not
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

    // A relative URL is one of this app's own screens - the sample-data path.
    // Anything absolute is the provider's hosted page and belongs in a browser.
    if (result.redirect_url.startsWith('/')) {
      router.push('/account');
      return;
    }

    /**
     * The payment page, and then the account screen.
     *
     * `openAuthSessionAsync` resolves when the browser closes, however it
     * closed - the /return page's deep link, the shopper dismissing it, or a
     * cancellation. All three land on the account screen, which is correct:
     * it reads the plan's real status from Honeystick and is therefore the one
     * screen that can say what actually happened. Branching on the result here
     * would only let this sheet guess at it first, and guess wrong for the
     * shopper who paid and then closed the tab.
     */
    await WebBrowser.openAuthSessionAsync(result.redirect_url, 'demostore://');
    router.push('/account');
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
          {/* The sheet is full-screen on Android, so it owns both ends: the
              status bar at the top and the gesture bar at the bottom. The sides
              are left alone - the content already has its own padding, and
              insetting them would double it. */}
          <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
            <View style={styles.head}>
              <Image
                source={imageUrl(service.image)}
                style={styles.image}
                contentFit="contain"
              />
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
  image: { width: 64, height: 64 },
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
