import { test, expect } from '@playwright/test';
import { curriculum, inventory } from '../src/curriculum.js';
import { topics } from '../src/catalog.js';
import { buildLesson } from '../src/trace-contract.js';
import { traceDiagram } from '../src/trace-diagram.js';

test('complete reference inventory has working original algorithm examples', () => {
  expect(curriculum.map(([, entries]) => entries.length)).toEqual([4, 10, 6, 7, 5, 8, 6, 13, 8, 3, 4, 8, 3, 1]);
  expect(inventory).toHaveLength(86);
  expect(Object.keys(topics)).toHaveLength(85);
  const introductions = new Set();
  for (const { id, title } of inventory.filter(topic => topic.id !== 'big-o')) {
    const spec = topics[id];
    introductions.add(spec.intro);
    expect(spec.examples.length, title).toBeGreaterThanOrEqual(2);
    expect(spec.quiz.options, title).toHaveLength(4);
    expect(spec.quiz.answer, title).toBeGreaterThanOrEqual(0);
    expect(spec.quiz.answer, title).toBeLessThan(4);
    expect(spec.challenge.answer, title).toBeTruthy();
    for (const language of ['Pseudocode', 'JavaScript', 'Python']) {
      expect(spec.code[language].length, `${title} ${language}`).toBeGreaterThan(1);
    }
    for (let i = 0; i < spec.examples.length; i++) {
      const lesson = buildLesson(spec, i);
      expect(lesson.frames.at(-1).view.result, `${title}: ${spec.examples[i].label}`).toBe(spec.examples[i].expected);
      const original = JSON.stringify(lesson.frames[0]);
      for (let j = 0; j < lesson.frames.length; j++) {
        const frame = lesson.frames[j];
        expect(frame.description, title).toBeTruthy();
        expect(traceDiagram(frame, title, j, lesson.frames.length), title).toContain('role="img"');
      }
      expect(JSON.stringify(lesson.frames[0]), `${title}: immutable history`).toBe(original);
    }
  }
  expect(introductions.size).toBe(85);
});

test('every lesson route renders its own trace and both example outcomes', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/big-o/1');
  await expect(page.locator('.course-topics a')).toHaveCount(86);
  await expect(page.locator('.soon')).toHaveCount(0);
  for (const topic of inventory.filter(topic => topic.id !== 'big-o')) {
    await page.goto(`/#/${topic.id}/1`);
    await expect(page.locator('h1'), topic.title).toHaveText(`${topic.title}.`);
    await expect(page.locator('#diagram svg')).toHaveAttribute('data-view', /.+/);
    await expect(page.locator('.back-button')).toBeDisabled();
    await page.locator('.next-button').click();
    await expect(page).toHaveURL(new RegExp(`/${topic.id}/2$`));
    for (let i = 0; i < topics[topic.id].examples.length; i++) {
      if (i) await page.locator('#example-select').selectOption(String(i));
      const lesson = buildLesson(topics[topic.id], i);
      await page.goto(`/#/${topic.id}/${lesson.steps.length}${i ? `?example=${i}` : ''}`);
      await expect(page.locator('.trace-result')).toContainText(topics[topic.id].examples[i].expected.slice(0, 70));
      await expect(page.locator('.next-button')).toHaveText('Finish lesson');
    }
  }
  expect(errors).toEqual([]);
});

test('course sections expose all lessons and preserve progress across topics', async ({ page }) => {
  await page.goto('/#/breadth-first-search/1');
  const total = buildLesson(topics['breadth-first-search']).steps.length;
  await page.goto(`/#/breadth-first-search/${total}`);
  await page.locator('.next-button').click();
  await page.locator('a[data-topic="depth-first-search"]').click();
  await expect(page.locator('h1')).toHaveText('Depth-First Search.');
  await expect(page.locator('.progress-fraction')).toHaveText('1 / 86');
  await page.reload();
  await expect(page.locator('.progress-fraction')).toHaveText('1 / 86');
  await page.locator('[data-dialog="practice"]').first().click();
  await expect(page).toHaveURL(/#\/practice$/);
  await expect(page.locator('#practice-topic option')).toHaveCount(87);
  await page.locator('#practice-topic').selectOption('edit-distance');
  await expect(page.locator('.quiz-question')).toHaveText(topics['edit-distance'].quiz.question);
  await page.locator(`[data-answer="${topics['edit-distance'].quiz.answer}"]`).click();
  await expect(page.locator('.quiz-feedback')).toContainText('Exactly right.');
  await page.keyboard.press('Escape');
  await page.locator('[data-dialog="challenge"]').click();
  await expect(page.locator('#challenge-topic option')).toHaveCount(86);
  await page.locator('#challenge-topic').selectOption('binary-search');
  await page.locator('#challenge-answer').fill(topics['binary-search'].challenge.answer);
  await page.locator('#challenge-form button').click();
  await expect(page.locator('.challenge-feedback')).toContainText('That is it!');
  await page.keyboard.press('Escape');
  await page.locator('[data-dialog="cheatsheet"]').click();
  await expect(page.locator('.reference-card')).toHaveCount(86);
  await page.locator('#reference-category').selectOption('7');
  await expect(page.locator('.reference-card')).toHaveCount(13);
  await page.keyboard.press('Escape');
  await page.goto('/#/progress');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.course-progress .progress-lesson')).toHaveCount(86);
  await expect(page.locator('.course-progress')).toContainText('Completed');
});

test('mobile algorithm scenarios, playback, keyboard stepping and deep links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/knapsack/1');
  await expect(page.locator('#diagram svg')).toHaveAttribute('data-view', /grid|array|state/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#example-select').selectOption('1');
  await expect(page).toHaveURL(/knapsack\/1\?example=1$/);
  await page.reload();
  await expect(page.locator('#example-select')).toHaveValue('1');
  const visualization = await page.locator('.visualization').boundingBox();
  for (const selector of ['#example-select', '.play-trace']) {
    const control = await page.locator(selector).boundingBox();
    expect(control.x).toBeGreaterThanOrEqual(visualization.x);
    expect(control.x + control.width).toBeLessThanOrEqual(visualization.x + visualization.width);
  }
  await page.locator('.play-trace').click();
  await expect(page.locator('.play-trace')).toHaveText('Pause');
  await expect(page).toHaveURL(/knapsack\/2\?example=1$/);
  await page.locator('.play-trace').click();
  await expect(page.locator('.play-trace')).toHaveText('Play trace');
  await page.goto('/#/n-queens/9999');
  await expect(page.locator('h1')).toHaveText('N-Queens.');
  await expect(page.locator('.next-button')).toHaveText('Finish lesson');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('existing Big-O device progress migrates without losing completion', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('studio-complete', 'true');
    localStorage.setItem('studio-visited', '0,1,2,3,4,5,6');
  });
  await page.goto('/#/big-o/7');
  await expect(page.locator('.progress-fraction')).toHaveText('1 / 86');
  await expect(page.locator('.next-button')).toHaveText('Try the practice');
  await page.goto('/#/arrays/1');
  await expect(page.locator('.progress-fraction')).toHaveText('1 / 86');
});
