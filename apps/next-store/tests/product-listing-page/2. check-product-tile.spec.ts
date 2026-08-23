import { test, expect } from '@playwright/test';
import chalk from 'chalk';

// 2. Each product tile should show the product information from the api:
// - Product Image
// - Title
// - Price
// - Description
test('Product tile is correct', async ({ page }) => {
  console.log(chalk.blue('\n*** Test Started ***'));
  await page.goto("/");
  console.log(chalk.gray('> Page content loaded.'));

  const firstProductCard = page.getByTestId('product-card').first();
  await expect(firstProductCard).toBeVisible({ timeout: 20000 });
  console.log(chalk.gray('> Located the first product card.'));

  // this isnt great but we are picking up svgs
  const productImage = firstProductCard.locator('img').first();
  console.log({ productImage });
  await expect(productImage).toBeVisible();
  await expect(productImage).toHaveAttribute('src', /.+/);
  const imageSrc = await productImage.getAttribute('src');
  console.log({ imageSrc });
  console.log(chalk.green('✅ Success: Product image visible with src'));

  const firstH2 = firstProductCard.getByRole('heading').first(); // this is the price. If it moves, we err
  await expect(firstH2).toBeVisible();
  await expect(firstH2).not.toBeEmpty();
  console.log(chalk.green('✅ Success: Price visible'));

  const secondH2 = firstProductCard.getByRole('heading').nth(1);
  await expect(secondH2).toBeVisible();
  await expect(secondH2).not.toBeEmpty();
  console.log(chalk.green('✅ Success: Title visible'));

  const productDescription = firstProductCard.getByRole('paragraph').nth(1);
  await expect(productDescription).toBeVisible();
  await expect(productDescription).not.toBeEmpty();
  console.log(chalk.green('✅ Success: Description visible'));

  console.log(chalk.blue('*** Test complete ***\n'));
});