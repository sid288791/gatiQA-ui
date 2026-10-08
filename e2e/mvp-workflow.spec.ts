import { expect, test } from '@playwright/test';

/**
 * Complete MVP workflow:
 * profiles → generate (clarify + missing expectations) → approve/save →
 * run (poll to verdict) → history (counts, detail, rerun).
 */
test.describe('gatiQA MVP workflow', () => {
  test('end-to-end: profile → test → run → history', async ({ page }) => {
    // --- 1. Evaluation Profiles ---
    await page.goto('/profiles');
    await expect(page.getByRole('heading', { name: 'Evaluation Profiles' })).toBeVisible();

    // Open the seeded profile and save a new version
    await page.getByRole('listitem', { name: /Support Agent Quality/i }).click();
    await expect(page.getByText('Version history')).toBeVisible();
    await page.getByRole('button', { name: /edit as new version/i }).click();

    // Validation: weights must total 100 — break the total and confirm the block
    const weightInput = page.getByLabel('Weight for Answer Accuracy');
    await weightInput.fill('50');
    await page.getByRole('button', { name: /save as new version/i }).click();
    await expect(page.getByText(/must equal 100/i).first()).toBeVisible();

    // Fix weights and save as v3
    await weightInput.fill('60');
    await page.getByRole('button', { name: /save as new version/i }).click();
    await expect(page.getByText('v3')).toBeVisible();

    // --- 2. Generate Test ---
    await page.getByRole('link', { name: 'Generate Test' }).click();
    await page
      .getByLabel('Test description')
      .fill('Agent must politely decline refunds for orders older than 30 days and cite policy R-30.');
    await page.getByLabel('Profile version').selectOption('prof-support@3');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    // Clarification workflow
    await expect(page.getByText('Clarifications needed')).toBeVisible();
    await page.getByLabel(/response time as well as content/i).selectOption('Content only');
    await page.getByLabel(/which locale/i).selectOption('en-US');
    await page.getByRole('button', { name: /submit answers/i }).click();
    await expect(page.getByText('Clarifications needed')).not.toBeVisible();

    // Missing-expectation workflow
    await expect(page.getByText('Missing expectations')).toBeVisible();
    await page.getByRole('button', { name: 'Add expectation' }).click();

    // Draft JSON editors are visible
    await expect(page.getByLabel('Draft request JSON')).toBeVisible();
    await expect(page.getByLabel('Draft expectations JSON')).toBeVisible();

    // Explicit approval then save
    const saveBtn = page.getByRole('button', { name: /approve & save test/i });
    await expect(saveBtn).toBeDisabled();
    await page.getByLabel('Approve test spec').check();
    await saveBtn.click();
    await expect(page.getByText(/Saved as test-/)).toBeVisible();

    // --- 3. Run Tests ---
    await page.getByRole('link', { name: 'Run Tests' }).click();
    await page.getByLabel(/Select Agent must politely decline/i).check();
    await page.getByLabel('Environment').selectOption('env-staging');
    await page.getByRole('button', { name: /start run/i }).click();

    // Run detail: execution state separate from verdict, polls to completion
    await expect(page).toHaveURL(/\/runs\/run-/);
    await expect(page.getByText('Execution state')).toBeVisible();
    await expect(page.getByText('succeeded')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('pass', { exact: true }).first()).toBeVisible();

    // Evaluator scores and expected-vs-actual evidence
    await expect(page.getByText('Answer Accuracy')).toBeVisible();
    await expect(page.getByText('Expected').first()).toBeVisible();
    await expect(page.getByText('Actual').first()).toBeVisible();

    // Immutable snapshot references
    await expect(page.getByText('prof-support@3')).toBeVisible();
    await expect(page.getByText(/env-staging#snap-/)).toBeVisible();

    // --- 4. History / Dashboard ---
    await page.getByRole('link', { name: 'History', exact: true }).click();
    await expect(page.getByTestId('summary-passed')).toHaveText(/\d+/);
    await expect(page.getByTestId('summary-execution-errors')).toBeVisible();
    await expect(page.getByRole('link', { name: /run-/ }).first()).toBeVisible();

    // Filters
    await page.getByLabel('Filter by verdict').selectOption('pass');
    await expect(page.getByRole('link', { name: /run-/ }).first()).toBeVisible();
    await page.getByLabel('Filter by verdict').selectOption('fail');
    await expect(page.getByText('No runs match')).toBeVisible();
    await page.getByLabel('Filter by verdict').selectOption('');

    // Rerun action
    await page.getByRole('button', { name: /^rerun run-/i }).first().click();
    await expect(page).toHaveURL(/\/runs\/run-/);
    await expect(page.getByText('succeeded')).toBeVisible({ timeout: 15_000 });
  });
});
