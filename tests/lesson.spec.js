import { test, expect } from '@playwright/test';

test('seven-step lesson, doubling, history, and persisted completion', async ({ page }) => {
  await page.goto('/#/big-o/1');
  await expect(page.locator('.back-button')).toBeDisabled();
  for (const [index, values] of [[1, [1, 1, 2, 4]], [2, [1, 2, 4, 16]], [3, [1, 3, 8, 64]]]) {
    await expect(page).toHaveURL(new RegExp(`/big-o/${index}$`));
    await expect(page.locator('.metric dd')).toHaveText(values.map(String));
    await expect(page.locator('.operation-block')).toHaveCount(values.reduce((a, b) => a + b, 0));
    await page.locator('.next-button').click();
  }
  await page.locator('[data-step="6"]').click();
  await expect(page.locator('.platform.dimmed')).toHaveCount(3);
  await expect(page.locator('[data-complexity="quadratic"]')).not.toHaveClass(/dimmed/);
  await page.locator('[data-focus="constant"]').click();
  await expect(page.locator('[data-complexity="constant"]')).not.toHaveClass(/dimmed/);
  await page.locator('[data-focus="constant"]').click();
  await expect(page.locator('.platform.dimmed')).toHaveCount(0);
  await page.locator('.next-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Now you can see the bigger picture.' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.progress-fraction')).toHaveText('1 / 86');
  await page.reload();
  await expect(page.locator('.progress-fraction')).toHaveText('1 / 86');
  await page.locator('.reset-button').click();
  await expect(page).toHaveURL(/big-o\/1$/);
  await page.goBack();
  await expect(page).toHaveURL(/big-o\/7$/);
});

test('keyboard, search, code language, theme and dialog behavior', async ({ page }) => {
  await page.goto('/#/big-o/1');
  await page.locator('body').click({ position: { x: 4, y: 500 } });
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/big-o\/2$/);
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox').fill('linear');
  await page.locator('[data-search-step="5"]').click();
  await expect(page).toHaveURL(/big-o\/6$/);
  await page.locator('#code-language').selectOption('Python');
  await expect(page.locator('.code-content')).toContainText('def total(items):');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#code-language')).toHaveValue('Python');
  await page.locator('[data-dialog="cheatsheet"]').click();
  await expect(page.locator('.cheatsheet-grid')).toContainText('1,048,576 operations');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('search stays open when invoked before a pending step hash change settles', async ({ page }) => {
  await page.goto('/#/big-o/1');
  await expect(page.locator('.back-button')).toBeDisabled();
  await page.evaluate(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  await expect(page).toHaveURL(/big-o\/2$/);
  await expect(page.getByRole('searchbox')).toBeVisible();
  await page.getByRole('searchbox').fill('linear');
  await page.locator('[data-search-step="5"]').click();
  await expect(page).toHaveURL(/big-o\/6$/);
});

test('practice answers, challenge feedback and safe progress reset', async ({ page }) => {
  await page.goto('/#/big-o/1');
  await page.locator('[data-dialog="practice"]').first().click();
  for (const answer of [0, 2, 1, 3]) {
    await page.locator(`[data-answer="${answer}"]`).click();
    await expect(page.locator('.quiz-feedback')).toContainText('Exactly right.');
    await page.locator('[data-action="next-question"]').click();
  }
  await expect(page.locator('#dialog-content')).toContainText('4 of 4');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.locator('[data-dialog="challenge"]').click();
  await page.locator('#challenge-answer').fill('128');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.locator('.challenge-feedback')).toContainText('Try again.');
  await page.locator('#challenge-answer').fill('256');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.locator('.challenge-feedback')).toContainText('16 × 16 = 256');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.locator('[data-dialog="progress"]').click();
  await page.getByRole('button', { name: 'Reset local progress' }).click();
  await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
  await expect(page.locator('.progress-fraction')).toHaveText('0 / 86');
  await expect(page).toHaveURL(/big-o\/1$/);
});

test('mobile layout, course menu and meaningful navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/big-o/1');
  await expect(page.getByRole('heading', { name: 'Big-O Notation.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const widths = await page.locator('.details > section').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().width));
  expect(widths.every(width => width > 350)).toBe(true);
  await page.getByRole('button', { name: 'Open course menu' }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('.course-group').nth(1).locator('summary').click();
  await expect(page.locator('.topic').filter({ hasText: 'Two Pointers' })).toHaveAttribute('href', '#/two-pointers/1');
  await page.getByRole('button', { name: 'Close course menu' }).click();
  await page.locator('.next-button').click();
  await expect(page.locator('.metric dd')).toHaveText(['1', '2', '4', '16']);
  await page.locator('[data-dialog="practice"]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
