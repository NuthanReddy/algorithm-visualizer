import { test, expect } from '@playwright/test';
import { topics } from '../src/topics-optimization.js';
import { buildLesson } from '../src/trace-contract.js';

const outcome = (id, input) => topics[id].trace(structuredClone(input)).at(-1).view.result;

for (const [id, spec] of Object.entries(topics)) {
  test(`${id}: both original examples execute deterministically with owned history`, () => {
    for (let index = 0; index < spec.examples.length; index++) {
      const inputBefore = structuredClone(spec.examples[index].input);
      const { frames, example } = buildLesson(spec, index);
      expect(frames.at(-1).view.result).toBe(example.expected);
      expect(frames.length).toBeGreaterThanOrEqual(2);
      expect(frames.length).toBeLessThanOrEqual(30);
      expect(spec.examples[index].input).toEqual(inputBefore);
      expect(spec.trace(structuredClone(inputBefore))).toEqual(frames);
      for (const frame of frames) {
        expect(frame.view.result).toEqual(expect.any(String));
        expect(frame.description).toBeTruthy();
        if (frame.view.kind !== 'intervals') {
          for (const cell of frame.view.values ?? []) {
            expect(['string', 'number', 'boolean']).toContain(typeof cell);
          }
        }
        for (const cell of frame.view.matrix?.flat() ?? []) {
          expect(['string', 'number', 'boolean']).toContain(typeof cell);
        }
      }
      // Mutating the final visible state must not rewrite the opening snapshot.
      const openingBefore = structuredClone(frames[0]);
      const final = frames.at(-1).view;
      if (final.values?.length) final.values[0] = 'changed by test';
      if (final.matrix?.length) final.matrix[0][0] = 'changed by test';
      if (final.nodes?.length) final.nodes[0].label = 'changed by test';
      expect(frames[0]).toEqual(openingBefore);
    }
  });
}

test('search bounds handle empty, endpoint, and first-feasible boundary cases', () => {
  expect(outcome('binary-search', { values: [], target: 3 })).toBe('index: -1');
  expect(outcome('binary-search', { values: [1, 3, 5], target: 1 })).toBe('index: 0');
  expect(outcome('binary-search', { values: [1, 3, 5], target: 5 })).toBe('index: 2');
  expect(outcome('binary-search-answer', { piles: [4, 8], hours: 4 })).toBe('speed: 4');
  expect(outcome('binary-search-answer', { piles: [1, 1], hours: 2 })).toBe('speed: 1');
});

test('partition, merge, and stable counting algorithms handle ties and zero keys', () => {
  for (const id of ['simple-sorts', 'merge-sort', 'quick-sort', 'counting-radix-sort']) {
    expect(outcome(id, { values: [2, 0, 2, 1, 0] })).toBe('sorted: 0, 0, 1, 2, 2');
    expect(outcome(id, { values: [] })).toBe('sorted: ');
  }
  expect(outcome('quickselect', { values: [2, 0, 2, 1, 0], k: 4 })).toBe('rank 4: 2');
  expect(outcome('sorting-stability', { entries: [[2, 'Z'], [1, 'X'], [2, 'A']] })).toBe('order: 1:X, 2:Z, 2:A');
});

test('greedy witnesses come from executed selections and actual Huffman depths', () => {
  expect(outcome('interval-scheduling', { intervals: [[0, 3], [1, 2], [2, 4]] })).toBe('jobs: 1, 2; count: 2');
  expect(outcome('huffman-coding', { frequencies: [['X', 7]] })).toBe('codes: X=0; weighted bits: 7');
  expect(outcome('when-greedy-fails', { coins: [3, 4], amount: 6 })).toBe('greedy: unreachable; optimal: 2');
});

test('backtracking restores branches and finds or rejects actual witnesses', () => {
  expect(outcome('subsets', { values: [4] })).toBe('subsets: [] [4]; count: 2');
  expect(outcome('permutations', { values: [] })).toBe('permutations: []; count: 1');
  expect(outcome('n-queens', { n: 1 })).toBe('solutions: 1; first: 0');
  expect(outcome('n-queens', { n: 2 })).toBe('solutions: 0; first: none');
  expect(outcome('solving-maze', { matrix: [[0, 0], [0, 0]] })).toBe('path: 0,0 → 0,1 → 1,1');
  expect(outcome('solving-maze', { matrix: [[1]] })).toBe('path: none');
});

test('DP bases, item-once transitions, strict inequalities, and prefix costs', () => {
  expect(outcome('memoization', { n: 10 })).toBe('F(10): 55');
  expect(outcome('tabulation', { n: 0 })).toBe('F(0): 0');
  expect(outcome('grid-paths', { matrix: [[0, 0, 0], [0, 0, 0]] })).toBe('paths: 3');
  expect(outcome('grid-paths', { matrix: [[0, 0], [0, 1]] })).toBe('paths: 0');
  expect(outcome('knapsack', { items: [[3, 5]], capacity: 6 })).toBe('value: 5; items: 0');
  expect(outcome('coin-change', { coins: [2, 5], amount: 0 })).toBe('minimum: 0; coins: none');
  expect(outcome('longest-increasing-subsequence', { values: [4, 1, 3, 2, 5] })).toBe('length: 3; sequence: 1, 3, 5');
  expect(outcome('sequences', { a: 'AXBYC', b: 'ABC' })).toBe('length: 3; LCS: ABC');
  expect(outcome('edit-distance', { a: 'ab', b: 'ba' })).toBe('distance: 2');
  expect(outcome('edit-distance', { a: '', b: 'abc' })).toBe('distance: 3');
});

test('bit algorithms operate on real masks, including the zero exception', () => {
  expect(outcome('bits-masks', { value: 8, bit: 2 })).toBe('was set: false; set: 12; clear: 8; toggle: 12');
  expect(outcome('bit-tricks', { value: 32 })).toBe('popcount: 1; lowbit: 32; power of two: true');
  expect(outcome('bit-tricks', { value: 255 })).toBe('popcount: 8; lowbit: 1; power of two: false');
  expect(outcome('bitsets', { a: [1, 3], b: [3, 4], universe: 5 })).toBe('union: 1, 3, 4; intersection: 3; A\\B: 1');
});

test('subset-sum verification rejects repeated and out-of-range certificates independently of search', () => {
  expect(outcome('p-vs-np', { values: [2], target: 4, certificate: [0, 0] })).toBe('certificate: invalid; found: no; candidates: 2');
  expect(outcome('p-vs-np', { values: [2], target: 2, certificate: [1] })).toBe('certificate: invalid; found: yes; candidates: 2');
  expect(outcome('p-vs-np', { values: [], target: 0, certificate: [] })).toBe('certificate: valid; found: yes; candidates: 1');
});
