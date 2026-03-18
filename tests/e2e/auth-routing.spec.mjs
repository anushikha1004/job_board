import { test, expect } from '@playwright/test';

test.describe('Auth intent routing', () => {
  test('candidate page redirects logged-out users to candidate login', async ({ page }) => {
    await page.goto('/candidate');
    await expect(page).toHaveURL(/\/login\/candidate$/);
  });

  test('company page redirects logged-out users to recruiter login', async ({ page }) => {
    await page.goto('/company');
    await expect(page).toHaveURL(/\/login\/recruiter$/);
  });

  test('recruiter login sends signup to recruiter signup page', async ({ page }) => {
    await page.goto('/login/recruiter');
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/signup\/recruiter$/);
  });

  test('candidate notifications redirects logged-out users to candidate login', async ({ page }) => {
    await page.goto('/candidate/notifications');
    await expect(page).toHaveURL(/\/login\/candidate$/);
  });

  test('company applications redirects logged-out users to recruiter login', async ({ page }) => {
    await page.goto('/company/applications');
    await expect(page).toHaveURL(/\/login\/recruiter$/);
  });
});
