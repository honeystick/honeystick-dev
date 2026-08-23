
import { honeystick } from '../honeystick';

import type { zProductType } from '../types/product';
import type { zServiceType } from '../types/service';

import { seatsLeft, stockLeft } from '../demo/store';

import { DUMMY_PLANS, type CataloguePlan } from './plans';

/**
 * Turning a billing catalogue into a shop window.
 *
 * Honeystick owns what a thing costs and how it is sold; the store owns what
 * it looks like. Keeping the two apart is the whole shape of the integration -
 * a price change happens in Honeystick and appears here without a deploy,
 * while a photograph is never something a billing system should be asked to
 * hold.
 *
 * Presentation is keyed on `ext_id` because that is the identifier the store
 * chooses and Honeystick preserves. Row ids are Honeystick's own and would
 * change if the catalogue were ever rebuilt.
 */
type Presentation = {
  image: string;
  category: string;
  /** reviews. What is left on the shelf is metered - see lib/demo/store */
  rating: { rate: number; count: number };
};

const PRESENTATION: Record<string, Presentation> = {
  'trail-daypack': {
    image: '/products/backpack.svg',
    category: "men's clothing",
    rating: { rate: 3.9, count: 120 },
  },
  'slim-fit-tee': {
    image: '/products/tshirt.svg',
    category: "men's clothing",
    rating: { rate: 4.1, count: 259 },
  },
  'cotton-jacket': {
    image: '/products/jacket.svg',
    category: "men's clothing",
    rating: { rate: 4.7, count: 500 },
  },
  'casual-slim-shirt': {
    image: '/products/shirt.svg',
    category: "men's clothing",
    rating: { rate: 2.1, count: 430 },
  },
  'dragon-chain-bracelet': {
    image: '/products/bracelet.svg',
    category: 'jewellery',
    rating: { rate: 4.6, count: 400 },
  },
  'micropave-band': {
    image: '/products/ring.svg',
    category: 'jewellery',
    rating: { rate: 3.9, count: 70 },
  },
  'princess-solitaire': {
    image: '/products/solitaire.svg',
    category: 'jewellery',
    rating: { rate: 3, count: 400 },
  },
  'rose-gold-earrings': {
    image: '/products/earrings.svg',
    category: 'jewellery',
    rating: { rate: 1.9, count: 100 },
  },
};

/** anything the store has no artwork for still has to be sellable */
const FALLBACK: Presentation = {
  image: '/products/membership.svg',
  category: 'other',
  rating: { rate: 5, count: 25 },
};

/**
 * Presentation for the subscriptions, kept separate from the goods.
 *
 * `benefits` is the store's copy, not Honeystick's. A billing system knows what
 * a plan costs and how often; what the shopper actually gets for it is a
 * shop-window question, which is why it lives here next to the artwork.
 */
type ServicePresentation = {
  image: string;
  category: string;
  benefits: string[];
  /**
   * The organization features this subscription includes, and how much of
   * each.
   *
   * Named by `ext_id` rather than by row id, for the same reason the artwork
   * is: an ext_id is the store's own handle and survives the catalogue being
   * rebuilt. A feature named here that the organization has not created is
   * skipped when the plan is bought - see `meteredRulesFor`.
   */
  metered: {
    ext_id: string;
    name: string;
    limit: number;
    interval: 'day' | 'week' | 'month' | 'year' | 'none';
  }[];
};

const SERVICE_PRESENTATION: Record<string, ServicePresentation> = {
  'depot-delivery': {
    image: '/products/delivery.svg',
    category: 'delivery',
    benefits: [
      'Every delivery free, with no minimum basket.',
      'As many orders a month as you like - one big one or thirty small ones.',
      'Nationwide, to any address on your account.',
      'Cancel whenever; it runs to the end of the month you have paid for.',
    ],
    metered: [
      {
        ext_id: 'deliveries',
        name: 'Free deliveries',
        limit: 20,
        interval: 'month',
      },
      {
        ext_id: 'priority-dispatch',
        name: 'Priority dispatch',
        limit: 5,
        interval: 'month',
      },
    ],
  },
  'depot-insiders': {
    image: '/products/membership.svg',
    category: 'membership',
    benefits: [
      'Free delivery on everything.',
      'First look at new arrivals before they reach the shop floor.',
      'Member pricing on the Legends collection.',
      'Cancel whenever.',
    ],
    metered: [
      {
        ext_id: 'deliveries',
        name: 'Free deliveries',
        limit: 10,
        interval: 'month',
      },
      {
        ext_id: 'early-access',
        name: 'Early access drops',
        limit: 3,
        interval: 'month',
      },
    ],
  },
};

const SERVICE_FALLBACK: ServicePresentation = {
  image: '/products/membership.svg',
  category: 'services',
  benefits: ['Billed on a repeating cycle. Cancel whenever.'],
  metered: [],
};

/**
 * Honeystick's `subscription` is the only plan type that bills again; the rest
 * of the catalogue is bought once. This one predicate is what sorts the shop
 * floor from the services counter, so it is written down once here rather than
 * as a string comparison in each component.
 */
export function isSubscription(plan: CataloguePlan): boolean {
  return plan.plan_type === 'subscription';
}

export function planToProduct(plan: CataloguePlan): zProductType {
  const presentation = PRESENTATION[plan.ext_id] ?? FALLBACK;
  return {
    id: plan.id,
    ext_id: plan.ext_id,
    title: plan.name,
    description: plan.description ?? '',
    // a free plan is a real thing in Honeystick, and it is priced at nothing
    // rather than at "no price"
    price: plan.plan_type_data.price ?? 0,
    // the starting figure for a server render. The client reads the live
    // balance off the customer's plan with `check` the moment it has one.
    stock: stockLeft(plan.ext_id),
    ...presentation,
  };
}

export function planToService(plan: CataloguePlan): zServiceType {
  const presentation = SERVICE_PRESENTATION[plan.ext_id] ?? SERVICE_FALLBACK;
  return {
    id: plan.id,
    ext_id: plan.ext_id,
    title: plan.name,
    description: plan.description ?? '',
    price: plan.plan_type_data.price ?? 0,
    // a subscription with no stated cycle is a data problem rather than a
    // free-for-all, and monthly is the only cycle this store sells
    frequency: plan.plan_type_data.plan_frequency ?? 'month',
    seats: seatsLeft(plan.ext_id),
    ...presentation,
  };
}

export type Storefront = {
  /** bought once, and the only things that go in the cart */
  products: zProductType[];
  /** billed on a cycle, and subscribed to one at a time */
  services: zServiceType[];
};

/**
 * The whole shop window, from Honeystick when it is configured and from the
 * fixtures when it is not.
 *
 * The fallback is deliberate rather than a stub: this is a sample project, and
 * it has to run for someone who has cloned it and not yet been given keys.
 * Because the fixtures are already plan-shaped, the only difference between the
 * two paths is where the array came from.
 *
 * Products and services are split from one read rather than fetched
 * separately, so rendering the page costs Honeystick a single call. The split
 * is on plan type, which means adding a subscription to the catalogue is enough
 * to make it appear under Services - there is no second list to maintain.
 */
/**
 * How much of a feature a plan the store has no copy for should include.
 *
 * Only reached by `withOrgMeters` below, and only for a subscription this
 * sample was not written for. A round number, because the honest answer is that
 * the store does not know - what a plan includes is a product decision, and
 * nothing here is in a position to make it.
 */
const FALLBACK_METER_LIMIT = 20;

/** how many of an organization's features to meter when the store names none */
const FALLBACK_METER_COUNT = 2;

/**
 * Meters for a subscription the store has no presentation for.
 *
 * The awkward case this exists for: `SERVICE_PRESENTATION` is keyed on the
 * ext_ids this sample ships with, and a real organization sells its own plans
 * under its own names. Those fall through to `SERVICE_FALLBACK`, which declares
 * no meters - so the subscription is created with no usage rules, and the
 * account page correctly reports that there is nothing to show. Correct, and a
 * poor demonstration of the one screen the flow exists to reach.
 *
 * So a plan that names no meters borrows the organization's own features. It is
 * the sample making up a product decision, which is why it is confined to this
 * function, is capped at two, and never overrides meters the store did declare.
 * An organization with no features at all still gets no meters, because at that
 * point there is genuinely nothing to count.
 */
async function withOrgMeters(services: zServiceType[]): Promise<zServiceType[]> {
  if (services.every((service) => service.metered.length)) return services;

  let features: { ext_id?: string; name?: string }[] = [];
  try {
    const page = await honeystick().features.list({ limit: 100 });
    features = page.data ?? [];
  } catch (error) {
    // a shop window that will not render because the feature list was
    // unreachable is a worse outcome than one without meters
    console.error({ HONEYSTICK_FEATURE_LOOKUP_ERROR: String(error) });
    return services;
  }

  const borrowed = features
    .filter((feature) => !!feature.ext_id)
    .slice(0, FALLBACK_METER_COUNT)
    .map((feature) => ({
      ext_id: feature.ext_id as string,
      name: feature.name || (feature.ext_id as string),
      limit: FALLBACK_METER_LIMIT,
      interval: 'month' as const,
    }));

  if (!borrowed.length) return services;

  return services.map((service) =>
    service.metered.length ? service : { ...service, metered: borrowed },
  );
}

export async function getStorefront(): Promise<Storefront> {
  const plans = await getPlans();

  const products = plans
    .filter((plan) => !isSubscription(plan))
    .map(planToProduct);
  const services = plans.filter(isSubscription).map(planToService);

  /**
   * Each half falls back on its own.
   *
   * The check in getPlans only asks whether the catalogue was empty, and an
   * organization that sells one subscription and no goods answers that with a
   * perfectly good catalogue - then empties the shop floor, because none of
   * what it returned is something you put in a basket. That is the normal state
   * of a billing account early on, so it cannot be allowed to read as a broken
   * store.
   *
   * The half that came back real is always kept. Only the empty half is
   * dressed, so a live subscription still bills live money while the goods
   * beside it are visibly samples.
   */
  const fixtures = (subscriptions: boolean) =>
    DUMMY_PLANS.filter((plan) => isSubscription(plan) === subscriptions);

  return {
    products: products.length ? products : fixtures(false).map(planToProduct),
    services: await withOrgMeters(
      services.length ? services : fixtures(true).map(planToService),
    ),
  };
}

/**
 * One service, by the reference the browser sent.
 *
 * The subscribe action needs the price, and this is where it gets it. Taking
 * the price from the request instead would let the shopper name their own -
 * the only thing worth trusting from the browser is which plan.
 */
export async function findService(extId: string): Promise<zServiceType | null> {
  const plans = await getPlans();
  const plan = plans.find(
    (candidate) => candidate.ext_id === extId && isSubscription(candidate),
  );
  if (!plan) return null;

  // through the same fallback the shop window went through, so the meters the
  // shopper was shown are the meters the plan is created with
  const [service] = await withOrgMeters([planToService(plan)]);
  return service ?? null;
}

async function getPlans(): Promise<CataloguePlan[]> {
  if (!process.env.HONEYSTICK_SECRET_KEY) return DUMMY_PLANS;

  try {
    const response = await honeystick().plans.list();
    const plans = (response as { data?: CataloguePlan[] })?.data ?? [];
    // an organization with an empty catalogue would otherwise render an empty
    // shop, which reads as a broken page rather than as a configuration issue
    return plans.length ? plans : DUMMY_PLANS;
  } catch (error) {
    console.error({ HONEYSTICK_CATALOGUE_ERROR: String(error) });
    return DUMMY_PLANS;
  }
}
