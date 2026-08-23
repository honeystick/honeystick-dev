import { test as setup } from '@playwright/test';
import chalk from 'chalk';

/**
 * There is no longer a remote API to intercept.
 *
 * The catalogue is resolved on the server - from Honeystick when keys are
 * set, from the fixtures in lib/catalogue when they are not - so it never
 * crosses a network boundary the browser can see, and a page.route() mock
 * would match nothing. Running without keys is what makes the suite
 * deterministic.
 */
setup('confirm the store renders its catalogue', async ({ page }) => {
  console.log(chalk.blue('\n*** Setup Started ***'));

  if (process.env.HONEYSTICK_SECRET_KEY) {
    console.log(
      chalk.yellow(
        '  > HONEYSTICK_SECRET_KEY is set: the suite runs against a live catalogue, ' +
          'so product counts and titles may not match the fixtures.',
      ),
    );
  } else {
    console.log(chalk.gray('  > No keys set: serving the sample catalogue.'));
  }

  await page.goto('/');
  await page.getByTestId('product-card').first().waitFor();

  console.log(chalk.blue('*** Setup Complete ***\n'));
});
