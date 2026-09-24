import { test, expect } from '@playwright/test';

test.describe('Auth input focus visual regression', () => {
  test('login auth input focus does not render inner input focus ring', async ({ page }) => {
    await page.goto('/login/candidate');

    const emailInput = page.getByPlaceholder('your@email.com').first();
    await emailInput.click();

    await expect(emailInput).toHaveCSS('box-shadow', 'none');
    await expect(emailInput).not.toHaveCSS('outline-style', 'solid');
  });

  test('signup auth input focus does not render inner input focus ring', async ({ page }) => {
    await page.goto('/signup/candidate');

    const emailInput = page.getByPlaceholder('your@email.com').first();
    await emailInput.click();

    await expect(emailInput).toHaveCSS('box-shadow', 'none');
    await expect(emailInput).not.toHaveCSS('outline-style', 'solid');
  });

  test('recruiter login auth input focus does not render inner input focus ring', async ({ page }) => {
    await page.goto('/login/recruiter');

    const emailInput = page.getByPlaceholder('your@email.com').first();
    await emailInput.click();

    await expect(emailInput).toHaveCSS('box-shadow', 'none');
    await expect(emailInput).not.toHaveCSS('outline-style', 'solid');
  });

  test('recruiter signup auth input focus does not render inner input focus ring', async ({ page }) => {
    await page.goto('/signup/recruiter');

    const emailInput = page.getByPlaceholder('your@email.com').first();
    await emailInput.click();

    await expect(emailInput).toHaveCSS('box-shadow', 'none');
    await expect(emailInput).not.toHaveCSS('outline-style', 'solid');
  });
});
