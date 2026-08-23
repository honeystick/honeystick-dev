import { test, expect } from '@playwright/test';
import chalk from 'chalk';

// 1. Rendering of a list of products from the Honeystick catalogue (see lib/catalogue).

test('Verify products downloaded', async ({ page }) => {
  console.log(chalk.blue('\n*** Test Starting ***'));
  await page.goto("/");
  const productCards = page.getByTestId('product-card');
  const productCount = await productCards.count();

  if (productCount === 0) {
    throw new Error(chalk.red('❌ Poor: Zero products were rendered.'));
  }

  try {
    await expect(productCards.first()).toBeVisible({ timeout: 30000 });
    console.log(chalk.green('✅ Success: The first product card is visible on the screen.'));
  } catch (error) {
    console.log(chalk.red('❌ Failure: The first product card is NOT visible on the screen.'));
    throw error;
  }

  if (productCount < 20 && productCount > 10) {
    console.log(chalk.red(`⚠️ Medium Amount of products were displayed`));
  }

  if (productCount >= 20) {
    console.log(chalk.green(`✅ Positive: 20 products or more are showing`));
  }

  console.log(chalk.blue('*** Test Ended ***\n'));
});