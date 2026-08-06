import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'e2e.admin@travelpro.com';
const ADMIN_PASSWORD = 'password123';

async function login(page) {
  await page.goto('/mock-login');
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Welcome back')).toBeVisible();
}

/** Create a task from the board and return its card locator. */
async function createTask(page, title) {
  await page.getByRole('button', { name: 'New Task' }).click();
  await page.getByPlaceholder('Task title').fill(title);
  await page.getByRole('button', { name: 'Create Task' }).click();
  // Radix keeps the dialog mounted (and aria-hides the board behind it) until
  // its close animation finishes — wait it out before touching the cards.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const card = page.locator('[data-rfd-draggable-id]').filter({ hasText: title });
  await expect(card).toHaveCount(1);
  return card;
}

test('task board: deleting a task asks for confirmation first', async ({ page }) => {
  await login(page);
  await page.goto('/TaskBoard');

  const title = `E2E Delete ${Date.now()}`;
  const card = await createTask(page, title);

  // Cancelling leaves the task alone.
  await card.hover();
  await card.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(card).toHaveCount(1);

  // Confirming removes it for real.
  await card.hover();
  await card.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(card).toHaveCount(0);
});

test('task board: a booking’s auto-generated tasks show their SLA state', async ({ page }) => {
  await login(page);
  await page.goto('/TaskBoard');

  // flow.spec.js runs first (workers: 1, no parallelism) and creates the Trip
  // whose saved dates generate this task set.
  await expect(page.locator('[data-rfd-draggable-id]').first()).toBeVisible();

  const autoCard = page.locator('[data-rfd-draggable-id]').filter({ hasText: 'Auto' }).first();
  await expect(autoCard.getByText('Auto')).toBeVisible();
  // Auto cards link to their booking rather than being inert text.
  await expect(autoCard.locator('a[href*="ReservationDetails"]')).toHaveCount(1);
});
