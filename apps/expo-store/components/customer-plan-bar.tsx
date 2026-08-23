import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCustomer } from '@honeystick/expo';

import { useStoreEvents } from '@/hooks/use-store-events';
import { useSubscription } from '@/hooks/use-subscription';
import { theme } from '@/lib/theme';

/**
 * The way in to the live customer plan.
 *
 * Replaces the "sample data" note that used to sit here. That note described the
 * store's own fixtures, which are still fixtures - but the interesting thing on
 * this screen is not the shelf stock, it is that a real customer plan is one tap
 * away and its meters can be moved from a phone.
 *
 * The summary is read with the same `useCustomer` the plan screen uses, and with
 * the same params - so react-query serves both from one cache entry and opening
 * the screen costs no second request. Getting the params wrong would silently
 * double the traffic instead of breaking, which is why they are worth matching
 * exactly.
 */
export default function CustomerPlanBar() {
  /**
   * The plan this device bought, and the only one it may ask about.
   *
   * This bar used to read "the newest subscription on the organization", which
   * meant listing every plan the organization holds - and that list carries
   * each customer's email address, so the mounted handler now refuses it. The
   * stored id is both the safe way to ask and the correct one: whoever
   * subscribed most recently is only you until somebody else does.
   */
  const { subscription } = useSubscription();

  const {
    data: customer,
    isLoading,
    error,
  } = useCustomer({
    planId: subscription?.planId,
    // nothing to ask about until AsyncStorage has answered, and nothing to ask
    // at all on a device that has not subscribed
    queryOptions: { enabled: !!subscription?.planId },
  });

  /**
   * Read from the shared stream, not owned here.
   *
   * The connection is mounted once at the root - see StoreEventsProvider. It
   * used to be opened by this component, on the reasoning that the shop floor
   * is always beneath the others; that stopped being true when the account
   * screen started rendering the settled-payment banner, because a stack keeps
   * the screen underneath mounted and the app would hold two sockets.
   */
  const { status, lastEvent } = useStoreEvents();

  /**
   * The announcement, and why it fades.
   *
   * A settled payment is the one event in this system that a person should be
   * told about rather than merely have the screen quietly agree with - it is the
   * end of a round trip that went out through PayFast and came back. Everything
   * else (a tracked unit, a reset) is already visible in the numbers it changed,
   * so announcing those too would be noise.
   *
   * It clears itself because it is news, not state. Left on screen it would
   * still be claiming a payment just arrived ten minutes later.
   */
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (lastEvent?.name !== 'payment.settled') return;

    const data = lastEvent.data as {
      planId?: number | null;
      reference?: string | null;
    };
    setAnnouncement(
      `Payment settled${data?.reference ? ` · ${data.reference}` : data?.planId ? ` · plan ${data.planId}` : ''}`,
    );

    const timer = setTimeout(() => setAnnouncement(null), 8000);
    // keyed on `at` rather than on the event object, so two settlements in a row
    // restart the timer instead of the second one being swallowed
    return () => clearTimeout(timer);
  }, [lastEvent?.at, lastEvent?.name, lastEvent?.data]);

  const usage = Array.isArray(customer?.usage) ? customer.usage : [];
  const first = usage[0] as
    | { feature_ext_id?: string; used?: number; limit?: number | null }
    | undefined;

  const summary = () => {
    if (!subscription) return 'Subscribe below and your plan appears here.';
    if (isLoading) return 'Reading the customer plan from Honeystick…';
    if (error) return `Honeystick: ${error.message}`;
    if (!customer) return 'No subscription plan on this organization yet.';
    if (!first) return `${customer.name ?? 'Plan'} — no metered features.`;
    return `${customer.name ?? 'Plan'} — ${first.feature_ext_id}: ${first.used ?? 0} of ${first.limit ?? '∞'}`;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Live customer plan</Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    status === 'live'
                      ? theme.colorAlt
                      : status === 'connecting'
                        ? theme.colorSecondary
                        : theme.danger,
                },
              ]}
            />
            <Text style={styles.status}>{status}</Text>
          </View>
          <Text style={styles.note} numberOfLines={2}>
            {summary()}
          </Text>
          {announcement && (
            <Text style={styles.announcement}>{announcement}</Text>
          )}
        </View>

        <Link href={subscription ? '/account' : '/customer'} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              subscription
                ? 'Manage your subscription'
                : 'Open the live customer plan'
            }
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {subscription ? 'Manage' : 'Open'}
            </Text>
          </Pressable>
        </Link>
      </View>
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing * 0.75,
  },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontSize: 10, color: theme.colorSecondary },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colorPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  note: { fontSize: 11, color: theme.colorSecondary },
  announcement: { fontSize: 11, fontWeight: '700', color: theme.colorAlt },
  button: {
    backgroundColor: theme.bgMuted,
    paddingHorizontal: theme.spacing,
    paddingVertical: 8,
  },
  buttonText: {
    color: theme.colorLight,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
