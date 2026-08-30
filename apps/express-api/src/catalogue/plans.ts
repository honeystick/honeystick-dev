/**
 * Honeystick Example App's catalogue, in the shape Honeystick answers `GET /plans` with.
 *
 * These are plans rather than a store-specific product type on purpose: the
 * mapping in catalogue.ts is written against the real contract, so pointing
 * this at a live organization is a matter of setting HONEYSTICK_SECRET_KEY
 * and nothing downstream changes.
 *
 * Goods are `one-time-payment` plans - bought once, never renewed. The
 * membership is a `subscription`, which is what makes this worth shipping as
 * a sample: one storefront selling both, billed by the same system.
 */
export type CataloguePlan = {
  id: number;
  ext_id: string;
  name: string;
  description: string | null;
  plan_model: 'free' | 'paid';
  plan_type: 'subscription' | 'one-off' | 'one-time-payment';
  plan_type_data: {
    price: number | null;
    price_plan?: 'fixed' | 'usage' | null;
    plan_frequency?: string | null;
  };
};

export const DUMMY_PLANS: CataloguePlan[] = [
  {
    id: 1,
    ext_id: 'trail-daypack',
    name: 'Trail Daypack, Fits 15" Laptops',
    description:
      'Your pack for everyday use and walks in the forest. Padded sleeve for a laptop up to 15 inches.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 109.95, price_plan: 'fixed' },
  },
  {
    id: 2,
    ext_id: 'slim-fit-tee',
    name: 'Casual Premium Slim Fit T-Shirt',
    description:
      'Slim-fitting, contrast raglan long sleeve and a three-button placket. Light and soft enough to wear all day.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 22.3, price_plan: 'fixed' },
  },
  {
    id: 3,
    ext_id: 'cotton-jacket',
    name: 'Cotton Field Jacket',
    description:
      'Outerwear for spring, autumn and winter. Suits working, hiking, camping and travelling.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 55.99, price_plan: 'fixed' },
  },
  {
    id: 4,
    ext_id: 'casual-slim-shirt',
    name: 'Casual Slim Fit Shirt',
    description:
      'An everyday shirt that holds its shape. The colour may differ slightly between screen and thread.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 15.99, price_plan: 'fixed' },
  },
  {
    id: 5,
    ext_id: 'dragon-chain-bracelet',
    name: 'Gold & Silver Dragon Station Chain Bracelet',
    description:
      'From the Legends collection, inspired by the water dragon said to guard the ocean pearl.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 695, price_plan: 'fixed' },
  },
  {
    id: 6,
    ext_id: 'micropave-band',
    name: 'Solid Gold Petite Micropave Band',
    description:
      'Satisfaction guaranteed. Return or exchange any order within 30 days of delivery.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 168, price_plan: 'fixed' },
  },
  {
    id: 7,
    ext_id: 'princess-solitaire',
    name: 'White Gold Plated Princess Solitaire',
    description:
      'A classic solitaire engagement ring. A gift for her, for him, for anyone.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 9.99, price_plan: 'fixed' },
  },
  {
    id: 8,
    ext_id: 'rose-gold-earrings',
    name: 'Rose Gold Plated Double Flared Earrings',
    description:
      'Double flared tunnel plug earrings, rose gold plated over 316L stainless steel.',
    plan_model: 'paid',
    plan_type: 'one-time-payment',
    plan_type_data: { price: 10.99, price_plan: 'fixed' },
  },
  {
    id: 9,
    ext_id: 'depot-insiders',
    name: 'Depot Insiders',
    description:
      'Free delivery on everything and first look at new arrivals. Billed monthly, cancel any time.',
    plan_model: 'paid',
    plan_type: 'subscription',
    plan_type_data: { price: 99, price_plan: 'fixed', plan_frequency: 'month' },
  },
  {
    id: 10,
    ext_id: 'depot-delivery',
    name: 'Delivery, Handled',
    description:
      'Every delivery free, as often as you order. One flat monthly fee instead of a charge per parcel.',
    plan_model: 'paid',
    plan_type: 'subscription',
    // fixed price on a monthly cycle - the frequency is the only thing
    // separating this from a one-time-payment plan
    plan_type_data: { price: 49, price_plan: 'fixed', plan_frequency: 'month' },
  },
];
