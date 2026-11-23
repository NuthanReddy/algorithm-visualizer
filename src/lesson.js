export const complexities = [
  { key: 'constant', formula: 'O(1)', name: 'Constant', description: 'Same work, any size', color: '#92bda7' },
  { key: 'logarithmic', formula: 'O(log n)', name: 'Logarithmic', description: 'One more step per doubling', color: '#a8abd1' },
  { key: 'linear', formula: 'O(n)', name: 'Linear', description: 'Input and work grow together', color: '#e1bf7e' },
  { key: 'quadratic', formula: 'O(n²)', name: 'Quadratic', description: 'Twice the input, four times the work', color: '#ed806c' },
];

export function counts(n) {
  return [1, Math.log2(n), n, n * n];
}

export const lessons = [
  {
    title: 'Think in operations', short: 'Count the work', n: 2, focus: null, tag: 'THE BIG IDEA',
    paragraphs: [
      'A stopwatch tells you about a computer. Counting operations tells you about an algorithm.',
      'Start with just two items. Each little block is one operation. These four approaches look pretty similar now. But what happens when the input grows?',
    ],
    noteTitle: 'Small inputs hide big differences',
    note: 'Big-O describes how the amount of work grows with the input, not an exact running time.',
  },
  {
    title: 'A little more input. A lot more work?', short: 'Double the input', n: 4, focus: null, tag: 'EXPERIMENT 01',
    paragraphs: [
      'We doubled the input from 2 to 4 items. Watch how differently the four stacks respond.',
      'Constant work stays at 1. Logarithmic work adds just one operation. Linear work doubles to 4, while quadratic work jumps to 16.',
    ],
    noteTitle: 'Look at the change, not just the count',
    note: 'The interesting question is not “how much work?” but “how much more work when n grows?”',
  },
  {
    title: 'Double it once more', short: 'Double it again', n: 8, focus: null, tag: 'EXPERIMENT 02',
    paragraphs: [
      'Now there are 8 items. The constant stack is unchanged. Logarithmic needs 3 operations, linear needs 8, and quadratic needs 64.',
      'A tiny input change has made the gap unmistakable. The same growth patterns continue at a thousand items or a million.',
    ],
    noteTitle: 'Scale changes everything',
    note: 'For n = 1,024, these models count 1, 10, 1,024, and 1,048,576 operations respectively.',
  },
  {
    title: 'Constant: one and done', short: 'Constant', n: 8, focus: 'constant', tag: 'O(1) · CONSTANT',
    paragraphs: [
      'Reading the first item of an array takes one access, whether the array holds 8 items or 8 million.',
      'That is constant time: the work does not grow with the input. O(1) can describe several fixed operations too; it does not have to mean literally one.',
    ],
    noteTitle: 'A useful mental model',
    note: 'Ask: can I get the answer directly, without walking through the input?',
  },
  {
    title: 'Logarithmic: keep cutting in half', short: 'Logarithmic', n: 8, focus: 'logarithmic', tag: 'O(log n) · LOGARITHMIC',
    paragraphs: [
      'Imagine finding a name in a sorted list. Look in the middle, then keep only the half that might contain it.',
      'Our model halves 8 candidates to 4, then 2, then 1: three reductions. Doubling the input adds just one reduction.',
    ],
    noteTitle: 'A little work goes a long way',
    note: 'These blocks count halving rounds, not all comparisons in a real binary search. The growth rate is the same.',
  },
  {
    title: 'Linear: give every item a turn', short: 'Linear', n: 8, focus: 'linear', tag: 'O(n) · LINEAR',
    paragraphs: [
      'To add every number in an array, visit each item once. Eight items mean eight additions.',
      'Double the list and you double the work. A single pass through the input is the classic sign of linear time.',
    ],
    noteTitle: 'Often the right amount of work',
    note: 'When every item contributes to the answer, reading the whole input can be unavoidable.',
  },
  {
    title: 'Quadratic: every item meets every item', short: 'Quadratic', n: 8, focus: 'quadratic', tag: 'O(n²) · QUADRATIC',
    paragraphs: [
      'For each item, walk through the entire list again. Two nested full passes create n × n operations.',
      'At 8 items, that is 64 visits. Double the input and the work quadruples. This is where a small example can become an expensive solution.',
    ],
    noteTitle: 'Take the intuition with you',
    note: 'Big-O is a growth model. We leave out fixed multipliers and smaller terms to focus on what dominates at scale.',
  },
];

export const snippets = {
  Pseudocode: [
    ['first(items):', '  return items[0]'],
    ['halving_rounds(n):', '  while n > 1:', '    n = n / 2'],
    ['sum(items):', '  result = 0', '  for item in items:', '    result += item', '  return result'],
    ['visit_pairs(items):', '  for left in items:', '    for right in items:', '      visit(left, right)'],
  ],
  JavaScript: [
    ['function first(items) {', '  return items[0];', '}'],
    ['function halvingRounds(n) {', '  while (n > 1) {', '    n = n / 2;', '  }', '}'],
    ['function sum(items) {', '  let result = 0;', '  for (const item of items) {', '    result += item;', '  }', '  return result;', '}'],
    ['function visitPairs(items) {', '  for (const left of items) {', '    for (const right of items) {', '      visit(left, right);', '    }', '  }', '}'],
  ],
  Python: [
    ['def first(items):', '    return items[0]'],
    ['def halving_rounds(n):', '    while n > 1:', '        n = n / 2'],
    ['def total(items):', '    result = 0', '    for item in items:', '        result += item', '    return result'],
    ['def visit_pairs(items):', '    for left in items:', '        for right in items:', '            visit(left, right)'],
  ],
};

export const courses = [
  ['Foundations', ['Big-O Notation', 'Memory & Pointers', 'Recursion', 'Divide & Conquer']],
  ['Arrays & Strings', ['Array traversal', 'Two pointers', 'Sliding window']],
  ['Linked Lists', ['Singly linked lists', 'Fast & slow pointers']],
  ['Stacks & Queues', ['Stacks', 'Queues', 'Monotonic stacks']],
  ['Hashing', ['Hash maps', 'Collision handling']],
  ['Trees', ['Binary trees', 'Tree traversal']],
  ['Heaps', ['Priority queues', 'Heap operations']],
  ['Graphs', ['Breadth-first search', 'Depth-first search']],
  ['Sorting & Searching', ['Binary search', 'Merge sort', 'Quick sort']],
  ['Greedy Algorithms', ['Greedy choices']],
  ['Backtracking', ['Exploring possibilities']],
  ['Dynamic Programming', ['Memoization', 'Tabulation']],
  ['Bit Manipulation', ['Bitwise operations']],
  ['Hard Problems', ['Putting it together']],
];
