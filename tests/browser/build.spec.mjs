import { test, expect } from '@playwright/test';

test('standalone web bundle loads all local assets and completes onboarding', async ({ page }) => {
  const failures = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:8134/') && response.status() >= 400) failures.push(response.url());
  });
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8134/') ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:8134/');
  await expect(page.locator('#oobe')).toBeVisible();
  await page.locator('#oobeSkipBtn').click();
  await expect(page.locator('#oobe')).toBeHidden();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('body')).toHaveClass(/settings-open/);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});
