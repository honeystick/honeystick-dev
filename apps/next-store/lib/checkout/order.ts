import {
  PRODUCT_ATTRIBUTE_LIMIT,
  type CartLine,
} from './constants';

/**
 * A cart, priced.
 *
 * Prices are looked up from the catalogue rather than taken from the request.
 * The cart lives in the shopper's own localStorage, so a price arriving from
 * the browser is a number the shopper could have edited - the only thing worth
 * trusting from them is which product and how many.
 */
export type PricedLine = {
  ext_id: string;
  title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type PricedOrder = {
  order_id: string;
  lines: PricedLine[];
  total: number;
  item_count: number;
};

/** how many line items fit in the snapshot - see snapshotFor */
export const SNAPSHOT_LINE_LIMIT = 5;

export function priceOrder(
  requested: CartLine[],
  catalogue: { ext_id: string; name: string; price: number }[],
  orderId: string,
): PricedOrder {
  const byExtId = new Map(catalogue.map((item) => [item.ext_id, item]));

  const lines: PricedLine[] = [];
  for (const line of requested) {
    const product = byExtId.get(line.ext_id);
    // a product that has left the catalogue is dropped rather than guessed at
    if (!product) continue;
    const quantity = Math.max(1, Math.floor(line.quantity));
    lines.push({
      ext_id: product.ext_id,
      title: product.name,
      unit_price: product.price,
      quantity,
      line_total: Number((product.price * quantity).toFixed(2)),
    });
  }

  return {
    order_id: orderId,
    lines,
    total: Number(lines.reduce((sum, l) => sum + l.line_total, 0).toFixed(2)),
    item_count: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

/**
 * The order, as a Honeystick product snapshot.
 *
 * The snapshot is a flat `Record<string, string>` capped at
 * PRODUCT_ATTRIBUTE_LIMIT attributes, so it is a summary of what was bought
 * and not somewhere to keep an order. Past SNAPSHOT_LINE_LIMIT lines the rest
 * are counted rather than listed, and `order_id` is what ties the plan back to
 * the store's own record of the full basket.
 */
export function snapshotFor(order: PricedOrder): Record<string, string> {
  const snapshot: Record<string, string> = {
    order_id: order.order_id,
    item_count: String(order.item_count),
    line_count: String(order.lines.length),
    order_total: order.total.toFixed(2),
  };

  const listed = order.lines.slice(0, SNAPSHOT_LINE_LIMIT);
  listed.forEach((line, index) => {
    const n = index + 1;
    snapshot[`item_${n}_ref`] = line.ext_id;
    snapshot[`item_${n}_qty`] = String(line.quantity);
    snapshot[`item_${n}_price`] = line.unit_price.toFixed(2);
  });

  if (order.lines.length > listed.length) {
    snapshot.items_truncated = String(order.lines.length - listed.length);
  }

  // the cap is Honeystick's and it refuses the whole request when exceeded,
  // so this trims rather than letting a large basket fail at the API
  const keys = Object.keys(snapshot);
  if (keys.length > PRODUCT_ATTRIBUTE_LIMIT) {
    for (const key of keys.slice(PRODUCT_ATTRIBUTE_LIMIT)) delete snapshot[key];
  }

  return snapshot;
}

/**
 * The order reference, and the plan's `ext_id`.
 *
 * One value doing both jobs is deliberate: it is what makes a retry safe to
 * recognise later, and it is the only handle the store and Honeystick share
 * for the same purchase.
 */
export function newOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const noise = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEPOT-${stamp}-${noise}`;
}
