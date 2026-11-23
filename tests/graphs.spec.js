import { test, expect } from '@playwright/test';
import { topics } from '../src/topics-graphs.js';
import { buildLesson } from '../src/trace-contract.js';
import { traceDiagram } from '../src/trace-diagram.js';

const ids = [
  'binary-trees', 'tree-traversals', 'lowest-common-ancestor', 'binary-search-trees',
  'bst-deletion', 'balanced-trees', 'tries', 'segment-trees', 'binary-heaps',
  'building-heap', 'priority-queues', 'top-k', 'median-stream', 'heap-sort',
  'graph-representation', 'breadth-first-search', 'depth-first-search',
  'connected-components', 'cycle-detection', 'topological-sort',
  'strongly-connected-components', 'shortest-paths', 'bellman-ford',
  'floyd-warshall', 'union-find', 'minimum-spanning-trees', 'prims-algorithm',
];
const result = (id, input) => topics[id].trace(structuredClone(input)).at(-1).view.result;
const scalar = value => ['string', 'number', 'boolean'].includes(typeof value) || value === null;

test('all tree, heap, and graph examples compute independent literal outcomes with renderable immutable frames', () => {
  expect(Object.keys(topics).sort()).toEqual([...ids].sort());
  for (const id of ids) {
    const spec = topics[id];
    expect(spec.examples, id).toHaveLength(2);
    expect(spec.quiz.options, id).toHaveLength(4);
    for (const language of ['Pseudocode', 'JavaScript', 'Python']) {
      expect(spec.code[language].length, `${id} ${language}`).toBeGreaterThan(1);
    }
    expect(() => new Function(spec.code.JavaScript.join('\n')), id).not.toThrow();
    for (let i = 0; i < 2; i++) {
      const input = structuredClone(spec.examples[i].input), before = structuredClone(input);
      const frames = spec.trace(input), built = buildLesson(spec, i);
      expect(input, `${id} input mutation`).toEqual(before);
      expect(frames.length, id).toBeGreaterThanOrEqual(2);
      expect(frames.length, id).toBeLessThanOrEqual(30);
      expect(frames.at(-1).view.result, id).toBe(spec.examples[i].expected);
      expect(built.frames, id).toEqual(frames);
      for (const frame of frames) {
        expect(frame.title, id).toBeTruthy();
        expect(frame.description, id).toBeTruthy();
        expect(traceDiagram(frame, id, frames.indexOf(frame), frames.length), id)
          .toContain(`data-view="${frame.view.kind}"`);
        for (const metric of frame.metrics) {
          expect(metric, id).toHaveLength(2);
          expect(scalar(metric[1]), id).toBe(true);
        }
        const view = frame.view;
        if (view.nodes) {
          const nodes = new Set(view.nodes.map(node => node.id));
          for (const node of view.nodes) {
            expect(typeof node.id, id).toBe('string');
            expect(typeof node.label, id).toBe('string');
            if (view.kind === 'tree') {
              expect(node.x, id).toBeGreaterThanOrEqual(100);
              expect(node.x, id).toBeLessThanOrEqual(880);
              expect(node.y, id).toBeGreaterThanOrEqual(120);
              expect(node.y, id).toBeLessThanOrEqual(500);
            }
          }
          for (const edge of view.edges) {
            expect(nodes.has(edge.from), `${id} edge source`).toBe(true);
            expect(nodes.has(edge.to), `${id} edge target`).toBe(true);
          }
          for (const active of view.active) expect(nodes.has(active), `${id} active node`).toBe(true);
        }
        for (const value of view.values ?? []) expect(scalar(value), id).toBe(true);
        for (const row of view.matrix ?? []) for (const value of row) expect(scalar(value), id).toBe(true);
      }
      const initial = structuredClone(frames[0]);
      const final = frames.at(-1).view;
      if (final.nodes?.length) final.nodes[0].label = 'changed after trace';
      if (final.values?.length) final.values[0] = 'changed after trace';
      if (final.matrix?.length) final.matrix[0][0] = 'changed after trace';
      expect(frames[0], `${id} history ownership`).toEqual(initial);
    }
  }
});

test('BST deletion splices a successor child, handles root replacement, and leaves absent keys alone', () => {
  expect(result('bst-deletion', { values: [5, 2, 9, 7, 8, 10], key: 5 }))
    .toBe('Remaining: 2, 7, 8, 9, 10; deleted: yes');
  expect(result('bst-deletion', { values: [5, 2], key: 5 }))
    .toBe('Remaining: 2; deleted: yes');
  expect(result('bst-deletion', { values: [5, 2], key: 2 }))
    .toBe('Remaining: 5; deleted: yes');
  expect(result('bst-deletion', { values: [], key: 2 }))
    .toBe('Remaining: (empty); deleted: no');
  expect(result('lowest-common-ancestor', { values: [8, 4, 10, 2], a: 4, b: 2 })).toBe('LCA: 4');
});

test('all four AVL rotation shapes restore balance and long traces preserve the final tree', () => {
  for (const values of [[30, 20, 10], [10, 20, 30], [30, 10, 20], [10, 30, 20]]) {
    expect(result('balanced-trees', { values })).toBe('Root: 20; sorted: 10, 20, 30; height: 2');
  }
  const frames = topics['balanced-trees'].trace({ values: Array.from({ length: 24 }, (_, i) => i) });
  expect(frames.length).toBeLessThanOrEqual(30);
  const view = frames.at(-1).view, nodes = new Map(view.nodes.map(n => [n.id, n]));
  const children = new Map(view.nodes.map(n => [n.id, []]));
  for (const e of view.edges) children.get(e.from).push(e.to);
  const childIds = new Set(view.edges.map(e => e.to));
  const root = view.nodes.find(n => !childIds.has(n.id));
  function height(id, lower = -Infinity, upper = Infinity) {
    const value = Number(nodes.get(id).label);
    expect(value).toBeGreaterThan(lower); expect(value).toBeLessThan(upper);
    let left = 0, right = 0;
    for (const child of children.get(id)) {
      if (Number(nodes.get(child).label) < value) left = height(child, lower, value);
      else right = height(child, value, upper);
    }
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    return 1 + Math.max(left, right);
  }
  expect(view.nodes).toHaveLength(24);
  expect(height(root.id)).toBeLessThanOrEqual(6);
});

test('segment identities, trie terminals, heap boundaries and stream partitioning cover edge cases', () => {
  expect(result('segment-trees', { values: [3, 1, 4, 2], update: [2, -4], range: [1, 3] }))
    .toBe('Sum [1, 3): -3');
  expect(result('segment-trees', { values: [], update: null, range: [0, 0] })).toBe('Sum [0, 0): 0');
  expect(result('tries', { words: ['', 'at'], query: '' })).toBe('Word: yes; prefix: yes');
  expect(result('tries', { words: ['at'], query: 'ax' })).toBe('Word: no; prefix: no');
  expect(result('top-k', { values: [9, 2, 9], k: 0 })).toBe('Top 0: (empty)');
  expect(result('top-k', { values: [9, 2, 9], k: 5 })).toBe('Top 5: 9, 9, 2');
  expect(result('median-stream', { values: [8, 2, 6, 10, -4] })).toBe('Medians: 8, 5, 6, 7, 6');
  expect(result('heap-sort', { values: [8, -3, 5, 5, 0, 2] })).toBe('Sorted: -3, 0, 2, 5, 5, 8');
  expect(result('binary-heaps', { values: [3], remove: 4 })).toBe('Removed: 3; heap: (empty)');
});

test('graph traversal, cycles and SCCs handle direction, convergent edges, and disconnected seeds', () => {
  const input = { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['A', 'C'], ['B', 'D']], start: 'A', directed: true };
  expect(result('breadth-first-search', input)).toBe('BFS: A, B, C, D; distances: A=0, B=1, C=1, D=2');
  expect(result('depth-first-search', input)).toBe('DFS: A, B, D, C');
  expect(result('cycle-detection', { nodes: ['A', 'B'], edges: [['B', 'B']] })).toBe('Directed cycle: B → B');
  expect(result('topological-sort', { nodes: ['A', 'B'], edges: [['B', 'B']] })).toBe('No topological order; blocked: B');
  expect(result('strongly-connected-components', {
    nodes: ['A', 'B', 'C', 'D', 'E'],
    edges: [['A', 'B'], ['B', 'A'], ['B', 'C'], ['C', 'D'], ['D', 'C'], ['E', 'A']],
  })).toBe('SCCs (3): E | A, B | C, D');
  expect(result('connected-components', { nodes: ['A', 'B'], edges: [] })).toBe('Components (2): A | B');
});

test('shortest path algorithms distinguish unreachable cycles, invalid weights, and negative diagonals', () => {
  expect(() => topics['shortest-paths'].trace({
    nodes: ['A', 'B'], edges: [['A', 'B', -1]], start: 'A',
  })).toThrow(/nonnegative/);
  expect(result('bellman-ford', {
    nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', -2], ['B', 'A', 1], ['C', 'D', 3]], start: 'C',
  })).toBe('Distances: A=∞, B=∞, C=0, D=3');
  expect(result('floyd-warshall', { nodes: ['A', 'B'], edges: [['A', 'B', 1], ['B', 'A', -2]] }))
    .toBe('Negative cycle: yes');
  expect(result('floyd-warshall', { nodes: ['A', 'B'], edges: [['A', 'B', 5], ['A', 'B', 2]] }))
    .toBe('Distances: 0, 2 | ∞, 0');
});

test('Kruskal and Prim use distinct edge-selection orders and count isolated forest components', () => {
  const input = {
    nodes: ['A', 'B', 'C', 'D', 'E'],
    edges: [['A', 'B', 4], ['A', 'C', 5], ['B', 'C', 1], ['C', 'D', 2], ['B', 'D', 6]],
  };
  expect(result('minimum-spanning-trees', input))
    .toBe('Forest weight: 7; edges: B-C(1), C-D(2), A-B(4); components: 2');
  expect(result('prims-algorithm', input))
    .toBe('Prim weight: 7; edges: A-B(4), B-C(1), C-D(2); components: 2');
  const frames = topics['union-find'].trace({
    size: 4, unions: [[0, 1], [2, 3], [0, 2]], query: [3, 1],
  });
  expect(frames.some(frame => frame.title === 'Compress a parent path')).toBe(true);
  expect(frames.at(-1).view.result).toBe('Components: 1; connected(3, 1): yes');
});
