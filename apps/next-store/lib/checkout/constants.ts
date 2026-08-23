/**
 * Limits that belong to Honeystick, restated here so the store can respect
 * them before making a call rather than discovering them in a 400.
 *
 * These mirror PRODUCT_ATTRIBUTE_LIMIT and friends on the customer-plan
 * response contract. If they change there, they change here.
 */
export const PRODUCT_ATTRIBUTE_LIMIT = 25;

/** what the browser is allowed to tell us about the basket */
export type CartLine = {
  ext_id: string;
  quantity: number;
};
