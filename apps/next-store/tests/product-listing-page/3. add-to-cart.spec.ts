import { test, expect } from '@playwright/test';
import chalk from 'chalk';

// 3. Add to Cart Button
// - Users should be able to click on the Add to Cart button multiple times.
// - As the customer adds the item, it should update and show on the cart.
// - Each item in the Cart should show the quantity of that particular item.
// - The cart should show the price of each item multiplied by the quantity.

test('Product card buttons work', async ({ page }) => {
  await page.goto("/");
  console.log(chalk.gray('> Page content loaded and products are mocked.'));

  const firstProductCard = page.getByTestId('product-card').first();
  await expect(firstProductCard).toBeVisible({ timeout: 20000 });
  console.log(chalk.gray('> Located the first product card.'));

  const initialAddButton = firstProductCard.getByTestId('cart-action-add');
  const increaseButton = firstProductCard.getByTestId('cart-action-add-quantity');
  const quantity = firstProductCard.getByTestId('cart-action-quantity');
  const decreaseButton = firstProductCard.getByTestId('cart-action-decrease-quantity');

  await expect(initialAddButton).toBeVisible();
  console.log(chalk.gray('> Located initial Add button via data-testid.'));

  await initialAddButton.click();
  console.log(chalk.green('✅ Success: Clicked Add to Cart once.'));

  await expect(increaseButton).toBeVisible();
  await expect(quantity).toBeVisible();
  await expect(decreaseButton).toBeVisible();
  console.log(chalk.gray('> Cart action buttons and quantity are visible.'));

  await expect(quantity).toHaveText('1');
  console.log(chalk.green('✅ Success: Cart Quantity is 1.'));

  await increaseButton.click({ clickCount: 2 });
  await expect(quantity).toHaveText('3');
  console.log(chalk.green('✅ Success: Cart Quantity successfully updated to 3.'));

  await decreaseButton.click({ clickCount: 2 });
  await expect(quantity).toHaveText('1');
  console.log(chalk.green('✅ Success: Cart Quantity successfully decreased to 1.'));

  await decreaseButton.click();
  await expect(initialAddButton).toBeVisible();
  console.log(chalk.green('✅ Success: Product action section was removed (quantity reduced to 0).'));

  console.log(chalk.blue('*** Test ended ***\n'));
});

test('Cart menu updates are correct', async ({ page }) => {
  console.log(chalk.blue('\n*** Test Started ***'));
  await page.goto("/");
  console.log(chalk.gray('> Page content loaded and products are mocked.'));

  const firstProductCard = page.getByTestId('product-card').first();
  await expect(firstProductCard).toBeVisible({ timeout: 20000 });

  const initialAddButton = firstProductCard.getByTestId('cart-action-add');
  const increaseButton = firstProductCard.getByTestId('cart-action-add-quantity');

  await expect(initialAddButton).toBeVisible();
  console.log(chalk.gray('  > Located initial Add button.'));

  await initialAddButton.click();

  await increaseButton.click({ clickCount: 2 });
  console.log(chalk.green('Update: 3 of list item added.'));
  // we're on 3 now
  const cartMenuButton = page.getByTestId('cart-menu-button');
  await cartMenuButton.click();

  const cartMenu = page.getByTestId('cart-menu');
  await expect(cartMenu).toBeVisible();
  console.log(chalk.green('Cart menu now open. Checking the line item'));
  await expect(cartMenu.getByText('Cart empty')).not.toBeVisible();
  console.log(chalk.green('✅ Success: Cart is NOT empty.'));

  const cartRowQuantity = cartMenu.getByRole('list').first().locator('span[aria-label^="Quantity of"]').first();
  await expect(cartRowQuantity).toHaveText('3');
  console.log(chalk.green('✅ Success: Cart item quantity correctly shows 3.'));

  const firstCartItem = cartMenu.getByTestId('cart-list-item').first();
  const cartPriceElement = firstCartItem.getByTestId('cart-item-price');
  await expect(cartPriceElement).toBeVisible();
  const priceText = await cartPriceElement.textContent();
  console.log(chalk.green(`Update: Line items price is ${priceText}`));
  expect(priceText).toBeTruthy();

  if (!priceText) {
    throw new Error(chalk.red('❌ Fail: Price must be available on the list item'))
  }
  const priceValue = parseFloat(priceText.replace(/[^\d.]/g, ''));
  const expectedLineTotal = (priceValue * 3).toFixed(2);
  const cartLineTotal = firstCartItem.getByTestId('cart-item-total');
  await expect(cartLineTotal).toHaveText(`R ${expectedLineTotal}`);
  console.log(chalk.green(`✅ Success: Line Total is correct: R ${expectedLineTotal}.`));

  const expectedGrandTotal = expectedLineTotal; // Since only one item
  const cartGrandTotal = cartMenu.getByTestId('cart-grand-total');
  await expect(cartGrandTotal).toHaveText(`R${expectedGrandTotal}`);
  console.log(chalk.green(`✅ Success: Grand Total is correct: R ${expectedGrandTotal}.`));

  const clearCartButton = cartMenu.getByTestId('clear-cart-button');
  await expect(clearCartButton).toBeEnabled();
  await clearCartButton.click();

  await expect(cartMenu.getByText('Cart empty')).toBeVisible();
  console.log(chalk.green('✅ Success: Cart was successfully cleared.'));

  console.log(chalk.blue('*** Test ended ***\n'));
});