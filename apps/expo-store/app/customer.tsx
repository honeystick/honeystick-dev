import {
  ActionProvider,
  Renderer,
  StateProvider,
  ValidationProvider,
  VisibilityProvider,
} from '@json-render/react-native';
import { useCallback, useMemo, useState } from 'react';
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

import { useSubscription } from '@/hooks/use-subscription';
import { buildCustomerSpec } from '@/lib/json-render/customer-spec';
import { theme } from '@/lib/theme';

/**
 * A live customer plan, and the ability to move its counters.
 *
 * This is the SDK doing the thing it exists for. `useCustomer` reads
 * `GET /customer-plans` through the handler mounted on the Express server and
 * takes the first row; the meters come off that row's `usage`, and each button
 * is a real `POST /customer-plans/:id/track-usage`. No key is in this bundle -
 * the server attaches it as the call passes through /billing.
 *
 * The plan is named by id, from the device's own record of its checkout. It used
 * to ask for "the newest subscription", which read the whole organization's plan
 * list - and that list carries every customer's email, so the mounted handler
 * now refuses it. Naming the id is both the safe way to ask and the correct one:
 * the newest plan on an organization is only yours while nobody else has
 * subscribed since.
 *
 * The screen is rendered from a JSON spec rather than from components written out
 * here. What is worth seeing on a customer plan changes with the plan, and a spec
 * grows a row where a component tree needs an edit.
 */
export default function CustomerScreen() {
  const insets = useSafeAreaInsets();

  const { subscription, isLoaded } = useSubscription();
  const { data: customer, isLoading, error, track, refetch } = useCustomer({
    planId: subscription?.planId,
    // nothing to ask about until AsyncStorage has answered
    queryOptions: { enabled: !!subscription?.planId },
  });

  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The one handler the spec's buttons reach.
   *
   * A 403 is not a failure here - it is the plan's own limit refusing the unit
   * with the counter untouched, which arrives as `HoneystickError.isLimitReached`.
   * Reported as a fact rather than an error, because it is the branch this screen
   * exists to demonstrate.
   */
  const onTrackUsage = useCallback(
    async (params: { featureId?: unknown; value?: unknown }) => {
      const featureId = String(params.featureId ?? '');
      const value = Number(params.value ?? 1);
      if (!featureId || value === 0) return;

      setPending(true);
      setActionError(null);
      setLastResult(null);

      try {
        const result = (await track({ featureId, value })) as {
          used?: number;
          limit?: number | null;
          remaining?: number | null;
          limit_reached?: boolean;
        };
        setLastResult(
          `${value > 0 ? 'Tracked' : 'Returned'} ${Math.abs(value)} · ${featureId} now ${result?.used ?? '?'} of ${result?.limit ?? '∞'}`,
        );
      } catch (cause) {
        if (cause instanceof HoneystickError && cause.isLimitReached) {
          setActionError(
            `${featureId} is at its limit - the server refused the unit and the counter is untouched.`,
          );
        } else {
          setActionError(
            cause instanceof Error ? cause.message : 'Could not track that.',
          );
        }
      } finally {
        setPending(false);
      }
    },
    [track],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlers = useMemo(
    () => ({
      trackUsage: onTrackUsage,
      refreshCustomer: onRefresh,
    }),
    [onTrackUsage, onRefresh],
  );

  // rebuilt whenever the plan changes, which is every time `track` invalidates
  // the query - so the meters and the disabled states follow the server
  const spec = useMemo(
    () =>
      customer
        ? buildCustomerSpec(customer as Record<string, unknown>)
        : null,
    [customer],
  );

  if (!isLoaded || (isLoading && subscription)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colorAlt} />
        <Text style={styles.muted}>Reading the customer plan…</Text>
      </View>
    );
  }

  if (!subscription) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>No subscription on this device</Text>
        <Text style={styles.muted}>
          Subscribe from the shop floor and the plan id is recorded here, which
          is what this screen reads. It deliberately cannot ask for "whoever
          subscribed last" - that is the whole organization&apos;s plan list, and
          it carries other people&apos;s email addresses.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>Could not load a customer plan</Text>
        <Text style={styles.muted}>{error.message}</Text>
        <Pressable onPress={onRefresh} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!spec) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>No subscription to show</Text>
        <Text style={styles.muted}>
          This organization has no subscription customer plan, so there is nothing
          with usage counters to action. Create one and it appears here.
        </Text>
        <Pressable onPress={onRefresh} style={styles.retry}>
          <Text style={styles.retryText}>Check again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.provenance}>
        Live from Honeystick via /billing. Every ± is a real track-usage call.
      </Text>

      <StateProvider initialState={{}}>
        <VisibilityProvider>
          <ActionProvider handlers={handlers}>
            <ValidationProvider>
              <Renderer spec={spec} />
            </ValidationProvider>
          </ActionProvider>
        </VisibilityProvider>
      </StateProvider>

      {pending && (
        <Text style={styles.muted}>Recording…</Text>
      )}
      {lastResult && !actionError && (
        <Text style={styles.result}>{lastResult}</Text>
      )}
      {actionError && <Text style={styles.error}>{actionError}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  content: { padding: theme.spacing, gap: 10 },
  provenance: { fontSize: 11, color: theme.colorSecondary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing * 1.5,
    gap: 10,
    backgroundColor: theme.bgPrimary,
  },
  errorHeading: { fontSize: 18, fontWeight: '700', color: theme.colorPrimary },
  muted: { color: theme.colorSecondary, textAlign: 'center', fontSize: 13 },
  result: { color: theme.colorAlt, fontSize: 12 },
  error: { color: theme.danger, fontSize: 12 },
  retry: {
    marginTop: 6,
    backgroundColor: theme.bgMuted,
    paddingHorizontal: theme.spacing,
    paddingVertical: 10,
  },
  retryText: { color: theme.colorLight },
});
