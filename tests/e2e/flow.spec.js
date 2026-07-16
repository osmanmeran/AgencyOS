import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'e2e.admin@travelpro.com';
const ADMIN_PASSWORD = 'password123';

test('login → create trip → create proposal', async ({ page }) => {
  // --- Login (MockLogin local email/password form) ---
  await page.goto('/mock-login');
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  // Authenticated app shell loaded (Dashboard).
  await expect(page.getByText('Welcome back')).toBeVisible();

  // --- Create a Trip (the `Trip` entity via CreateReservation) ---
  await page.goto('/CreateReservation');
  await page.getByPlaceholder('Summer Adventure 2025').fill('E2E Trip');
  await page.getByPlaceholder('Bali, Indonesia').fill('Barcelona');
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2025-08-01');
  await dateInputs.nth(1).fill('2025-08-10');
  await page.getByRole('button', { name: 'Create Reservation' }).click();
  await page.waitForURL('**/ReservationDetails**', { timeout: 20000 });

  // --- Create a Proposal (CreateProposal page) ---
  await page.goto('/CreateProposal');
  await page.getByPlaceholder('Summer Vacation Package').fill('E2E Proposal');
  await page.locator('div.space-y-2').filter({ hasText: 'Client Name' }).locator('input').fill('E2E Client');
  await page.getByRole('button', { name: 'Add Service' }).click();
  await page.getByPlaceholder('Service name').first().fill('Hotel');
  await page.getByRole('button', { name: 'Create Proposal' }).click();
  await page.waitForURL('**/ProposalDetails**', { timeout: 20000 });
});
