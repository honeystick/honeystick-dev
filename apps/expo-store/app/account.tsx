import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoneystickError, useCustomer } from '@honeystick/expo';

import { useStoreEvents } from '@/hooks/use-store-events';
import { useSubscription } from '@/hooks/use-subscription';
import { money, theme } from '@/lib/theme';

/**
 * Where a subscriber manages what they are paying for, on native.
 *
 * The web store's /account page, screen for screen. Everything here is the SDK
 * talking to Honeystick through the handler mounted on the Express server -
 * there is no store endpoint behind any of it, and no key in this bundle.
 *
 * `planId` comes from the device's own record of the checkout rather than from
 * "the newest subscription on the organization". That distinction is the
 * difference between a demo and a bug: the list is org-wide and newest-first,
 * so an unqualified read hands whoever opens this screen the last person's
 * subscription - with a cancel button under it.
 */
export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subscription, isLoaded, forget } = useSubscription();

  const {
    data: plan,
    isLoading,
    error,
    check,
    track,
    cancel,
    updateCard,
    refetch,
  } = useCustomer({
    planId: subscription?.planId,
    // AsyncStorage answers a tick after mount, so there is nothing to ask about
    // on the first pass. Without this the hook fires a read for `undefined`.
    queryOptions: { enabled: !!subscription?.planId },
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The stream, and the one thing on this screen that is not a request.
   *
   * `payment.settled` is the only event in the system that means money actually
   * moved. Coming back from PayFast proves the shopper came back; this proves
   * the payment cleared, and it arrives whether or not they are still looking
   * at the screen. The hook has already invalidated the plan by the time this
   * renders, so the meters and the status below re-read without anything here
   * asking them to.
   */
  const { status: streamStatus, lastEvent } = useStoreEvents();

  /**
   * Held rather than read straight off `lastEvent`, so it survives.
   *
   * `lastEvent` is the most recent frame of any kind, and the Express stream
   * carries several - a reset, a basket, another shopper's subscription. Any of
   * them would replace it and the confirmation would vanish mid-read. It is
   * also narrowed to *this* plan: the stream is org-wide, so somebody else's
   * payment settling must not tell this shopper theirs did.
   */
  const [settled, setSettled] = useState<{
    reference: string | null;
    status: string | null;
  } | null>(null);

  useEffect(() => {
    if (lastEvent?.name !== 'payment.settled') return;
    const data = lastEvent.data as {
      planId?: number | null;
      reference?: string | null;
      status?: string | null;
    };
    if (!subscription || data?.planId !== subscription.planId) return;
    setSettled({
      reference: data.reference ?? null,
      status: data.status ?? null,
    });
  }, [lastEvent?.at, lastEvent?.name, lastEvent?.data, subscription]);

  const usage = (Array.isArray(plan?.usage) ? plan.usage : []) as {
    feature_ext_id: string;
    name?: string | null;
    used?: number;
    limit?: number | null;
    interval?: string | null;
  }[];

  const status: string | null = plan?.latest_status ?? null;
  const terms = (plan?.plan_type_data ?? {}) as {
    price?: number | null;
    plan_frequency?: string | null;
    current_period_ends_at?: string | null;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  /**
   * Recording a unit against a meter.
   *
   * A 403 here is not a failure - it is the plan's own limit refusing the unit
   * with the counter untouched, which arrives as
   * `HoneystickError.isLimitReached`. Reported as a fact rather than as an
   * error, because it is the branch a metered plan exists to have.
   */
  const onTrack = useCallback(
    async (featureId: string, value: number) => {
      setBusy(featureId);
      setNote(null);
      setFailure(null);
      try {
        const result = (await track({ featureId, value })) as {
          used?: number;
          limit?: number | null;
        };
        setNote(
          `${value > 0 ? 'Recorded' : 'Returned'} ${Math.abs(value)} · ${featureId} is now ${result?.used ?? '?'} of ${result?.limit ?? '∞'}`,
        );
      } catch (cause) {
        if (cause instanceof HoneystickError && cause.isLimitReached) {
          setFailure(
            `${featureId} is at its limit. The server refused the unit and the counter is untouched.`,
          );
        } else {
          setFailure(
            cause instanceof Error ? cause.message : 'Could not record that.',
          );
        }
      } finally {
        setBusy(null);
      }
    },
    [track],
  );

  /**
   * Sends the shopper to the provider to replace their card.
   *
   * A system browser, never a WebView this app controls. The shopper cannot see
   * an address bar in a WebView to know who they are giving a card to, and the
   * app could read the page if it wanted to - which is the same reason the
   * checkout itself is handed off.
   *
   * A plan that has not been paid for yet has no card on file and answers 400.
   * That is a state a shopper reaches by subscribing and then backing out of
   * the payment page, so it is worth saying plainly.
   */
  const onUpdateCard = useCallback(async () => {
    setBusy('card');
    setNote(null);
    setFailure(null);
    try {
      const url = await updateCard();
      await WebBrowser.openAuthSessionAsync(url, 'demostore://');
      await refetch();
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : 'Could not open the card update page.',
      );
    } finally {
      setBusy(null);
    }
  }, [updateCard, refetch]);

  const onCancel = useCallback(async () => {
    setBusy('cancel');
    setNote(null);
    setFailure(null);
    try {
      const { removed } = await cancel();
      setNote(
        removed
          ? 'This plan never started, so it was removed rather than cancelled.'
          : 'Cancelled. It runs to the end of the period you have paid for.',
      );
      if (removed) await forget();
    } catch (cause) {
      setFailure(
        cause instanceof Error ? cause.message : 'Could not cancel the plan.',
      );
    } finally {
      setBusy(null);
    }
  }, [cancel, forget]);

  /**
   * Leaving, which also ends the subscription.
   *
   * A real store would never do this, and it is here because a demo has the
   * opposite problem to a real store: every visitor who tries the flow leaves a
   * live recurring plan behind on somebody's actual billing account, and by
   * next week there are two hundred of them still billing. Tying the teardown
   * to the one action that always happens is the only version that reliably
   * cleans up.
   *
   * Cancelled first, forgotten second. The other order leaves a live
   * subscription that nothing points at any more - still billing, and now
   * invisible to the only screen that could have stopped it.
   *
   * A cancellation that fails does not block the exit. It is reported, and the
   * handle is kept so the screen can be reopened and the cancel tried again.
   */
  const onBack = useCallback(async () => {
    setBusy('back');
    try {
      if (subscription?.planId) await cancel({ planId: subscription.planId });
      await forget();
      router.replace('/');
    } catch (cause) {
      setFailure(
        `Leaving, but the subscription could not be cancelled: ${
          cause instanceof Error ? cause.message : 'unknown error'
        }. Reopen this screen to try again.`,
      );
      setBusy(null);
    }
  }, [cancel, forget, router, subscription]);

  const Header = (
    <View style={styles.head}>
      <Pressable
        accessibilityRole="button"
        onPress={() => void onBack()}
        disabled={busy === 'back'}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>
          ← {busy === 'back' ? 'Cancelling…' : 'Back to the store'}
        </Text>
      </Pressable>
      <Text style={styles.backNote}>
        Demo behaviour: leaving cancels the subscription you just created, so
        this store does not leave live plans behind.
      </Text>
    </View>
  );

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colorAlt} />
      </View>
    );
  }

  if (!subscription) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        {Header}
        <Text style={styles.heading}>No subscription on this device</Text>
        <Text style={styles.muted}>
          Subscribing writes the plan id here so this screen knows which one to
          open. Start one from the subscriptions counter on the shop floor.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing * 2 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {Header}

      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.eyebrow}>Your subscription</Text>
          <Text style={styles.heading}>
            {plan?.name ?? subscription.planName}
          </Text>
        </View>
        {status && (
          <View
            style={[
              styles.status,
              status === 'active' && styles.statusActive,
              (status === 'cancelled' || status === 'past-due') &&
                styles.statusEnded,
            ]}
          >
            <Text style={styles.statusText}>{status.replace(/-/g, ' ')}</Text>
          </View>
        )}
      </View>

      {settled && (
        <View style={styles.settled} accessibilityRole="alert">
          <View style={styles.settledMark}>
            <Text style={styles.settledMarkText}>✓</Text>
          </View>
          <View style={styles.settledText}>
            <Text style={styles.settledTitle}>Payment received</Text>
            <Text style={styles.settledNote}>
              Honeystick confirmed this with the payment provider
              {settled.reference ? ` · ${settled.reference}` : ''}. Nothing here
              polled — the notification arrived on its own.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.facts}>
        <Fact label="Reference" value={subscription.reference || '—'} />
        <Fact label="Billed to" value={subscription.email || '—'} />
        <Fact
          label="Price"
          value={
            terms.price != null
              ? `${money(Number(terms.price))} / ${terms.plan_frequency ?? 'month'}`
              : '—'
          }
        />
        <Fact
          label="Renews"
          value={
            terms.current_period_ends_at
              ? new Date(terms.current_period_ends_at).toLocaleDateString()
              : 'After the first payment clears'
          }
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Usage this period</Text>
          {/* Whether the screen would hear about a payment, shown rather than
              assumed. A stream that quietly died looks exactly like a quiet
              one, and this is the difference. */}
          <Text
            style={[
              styles.stream,
              streamStatus === 'live' && styles.streamLive,
              streamStatus === 'offline' && styles.streamOffline,
            ]}
          >
            {streamStatus}
          </Text>
        </View>

        {isLoading && <Text style={styles.muted}>Reading the plan…</Text>}
        {error && <Text style={styles.error}>{error.message}</Text>}

        {!isLoading && !error && !usage.length && (
          <Text style={styles.muted}>
            This plan meters nothing. Usage counters come from the features and
            usage-limit rules attached at checkout, and this organization has
            none of the features the store asked for.
          </Text>
        )}

        {usage.map((meter) => {
          const state = check({ featureId: meter.feature_ext_id });
          const pct =
            state.limit && state.limit > 0
              ? Math.min(100, Math.round((state.used / state.limit) * 100))
              : 0;

          return (
            <View key={meter.feature_ext_id} style={styles.meter}>
              <View style={styles.meterHead}>
                <Text style={styles.meterName}>
                  {meter.name ?? meter.feature_ext_id}
                </Text>
                <Text style={styles.meterCount}>
                  {state.used} / {state.limit ?? '∞'}
                  {meter.interval ? ` per ${meter.interval}` : ''}
                </Text>
              </View>

              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` },
                    !state.allowed && styles.barFull,
                  ]}
                />
              </View>

              <View style={styles.meterActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy === meter.feature_ext_id || state.used <= 0}
                  onPress={() => void onTrack(meter.feature_ext_id, -1)}
                  style={({ pressed }) => [
                    styles.ghost,
                    (pressed ||
                      busy === meter.feature_ext_id ||
                      state.used <= 0) &&
                      styles.pressed,
                  ]}
                >
                  <Text style={styles.ghostText}>Return one</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy === meter.feature_ext_id}
                  onPress={() => void onTrack(meter.feature_ext_id, 1)}
                  style={({ pressed }) => [
                    styles.ghost,
                    (pressed || busy === meter.feature_ext_id) &&
                      styles.pressed,
                  ]}
                >
                  <Text style={styles.ghostText}>Use one</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Manage</Text>
        <View style={styles.manage}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onUpdateCard()}
            disabled={busy === 'card'}
            style={({ pressed }) => [
              styles.secondary,
              (pressed || busy === 'card') && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>
              {busy === 'card' ? 'Opening…' : 'Update card'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onCancel()}
            disabled={busy === 'cancel'}
            style={({ pressed }) => [
              styles.danger,
              (pressed || busy === 'cancel') && styles.pressed,
            ]}
          >
            <Text style={styles.dangerText}>
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          Both are the SDK. updateCard() answers with a page at the payment
          provider, opened in a system browser; cancel() stops the subscription
          there. The card is never seen by this app.
        </Text>
      </View>

      {note && <Text style={styles.note}>{note}</Text>}
      {failure && <Text style={styles.error}>{failure}</Text>}
    </ScrollView>
  );
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.fact}>
    <Text style={styles.factLabel}>{label}</Text>
    <Text style={styles.factValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  content: { padding: theme.spacing, gap: theme.spacing },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgPrimary,
  },

  head: { gap: 4 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: theme.colorSecondary, fontWeight: '600' },
  backNote: { fontSize: 11, color: theme.colorSecondary, opacity: 0.85 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.colorSecondary,
  },
  heading: { fontSize: 20, fontWeight: '700', color: theme.colorPrimary },

  status: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.bgSecondary,
  },
  statusActive: { backgroundColor: '#2fd07a' },
  statusEnded: { backgroundColor: '#ff3b6b' },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorPrimary,
  },

  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing,
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
  },
  fact: { minWidth: 130, flexGrow: 1, gap: 2 },
  factLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorSecondary,
  },
  factValue: { fontSize: 13, fontWeight: '600', color: theme.colorPrimary },

  panel: {
    borderWidth: 1,
    borderColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
    gap: theme.spacing * 0.75,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stream: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorSecondary,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  streamLive: { color: theme.success },
  streamOffline: { color: theme.danger },

  // The payment confirmation, and the only thing on this screen that arrived
  // without being asked for.
  settled: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: theme.spacing * 0.75,
    backgroundColor: '#e8f9ef',
    borderLeftWidth: 4,
    borderLeftColor: theme.success,
  },
  settledMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settledMarkText: { color: theme.colorLight, fontWeight: '700', fontSize: 12 },
  settledText: { flex: 1, gap: 2 },
  settledTitle: { fontWeight: '700', color: theme.colorPrimary },
  settledNote: { fontSize: 12, lineHeight: 17, color: theme.colorSecondary },
  panelTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colorPrimary,
  },

  meter: { gap: 6 },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  meterName: { flex: 1, color: theme.colorPrimary, fontWeight: '600' },
  meterCount: { fontSize: 12, color: theme.colorSecondary },
  bar: { height: 8, backgroundColor: theme.bgSecondary, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.colorAlt },
  // at the limit the bar stops being progress and starts being a refusal
  barFull: { backgroundColor: theme.danger },
  meterActions: { flexDirection: 'row', gap: 8 },

  manage: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  ghost: {
    borderWidth: 1,
    borderColor: theme.colorAlt,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ghostText: { fontSize: 12, color: theme.colorSecondary, fontWeight: '600' },
  secondary: {
    backgroundColor: theme.bgMuted,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  secondaryText: { color: theme.colorLight, fontWeight: '600', fontSize: 13 },
  danger: {
    borderWidth: 1,
    borderColor: theme.danger,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  dangerText: { color: theme.danger, fontWeight: '600', fontSize: 13 },
  pressed: { opacity: 0.6 },

  muted: { fontSize: 12, lineHeight: 18, color: theme.colorSecondary },
  note: { fontSize: 12, color: theme.colorAlt },
  error: { fontSize: 12, color: theme.danger },
});
