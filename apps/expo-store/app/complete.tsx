import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ResetDemo from '@/components/reset-demo';
import { theme } from '@/lib/theme';

/**
 * Where a payment lands.
 *
 * Deliberately does not claim the payment succeeded. Coming back is only evidence
 * that the shopper came back - the provider confirms a payment to Honeystick over
 * its own webhook, and the plan's status is what actually settles. Telling someone
 * "paid" on the strength of a redirect is how a cancelled or failed payment ends
 * up looking complete.
 *
 * That caution matters more on native than on the web. Closing a system browser
 * is indistinguishable from finishing in it, so this screen is reached by a
 * shopper who paid and by one who thought better of it, and it has to be true for
 * both.
 */
export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    order?: string;
    total?: string;
    plan?: string;
    frequency?: string;
    demo?: string;
  }>();

  const isDemo = params.demo === '1';
  // a subscription comes back naming its plan; a basket does not
  const plan = params.plan;

  return (
    /* The last thing on this screen is the link back to the store, and this is
       where a shopper lands from a system browser - so it is reached with the
       gesture bar already on screen and nothing else to hold the link clear of
       it. */
    <View style={[styles.screen, { paddingBottom: insets.bottom + theme.spacing }]}>
      <Text style={styles.heading}>
        {plan ? 'Thanks for subscribing' : 'Thanks for your order'}
      </Text>

      {params.order && (
        <View style={styles.summary}>
          <Row label={plan ? 'Subscription' : 'Order'} value={params.order} />
          {plan && <Row label="Plan" value={plan} />}
          {params.total && (
            <Row
              label={params.frequency ? `Per ${params.frequency}` : 'Total'}
              value={`R${params.total}`}
            />
          )}
        </View>
      )}

      <Text style={styles.note}>
        {isDemo
          ? 'This store is running on sample data, so no payment was taken. Set HONEYSTICK_SECRET_KEY on the API to check out against Honeystick for real.'
          : 'We are confirming your payment with the provider. Your order updates on its own once that lands.'}
      </Text>

      <ResetDemo />

      <Link href="/" style={styles.link}>
        Back to the store
      </Link>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bgPrimary,
    padding: theme.spacing,
    gap: theme.spacing * 0.75,
  },
  heading: { fontSize: 22, fontWeight: '700', color: theme.colorPrimary },
  summary: {
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { color: theme.colorSecondary, fontSize: 13 },
  rowValue: { color: theme.colorPrimary, fontWeight: '700', fontSize: 13 },
  note: { color: theme.colorSecondary, lineHeight: 20, fontSize: 13 },
  link: { color: theme.colorAlt, fontWeight: '600' },
});
