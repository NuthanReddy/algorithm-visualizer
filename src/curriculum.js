export const curriculum = [
  ['Foundations', [
    ['big-o', 'Big-O Notation'], ['memory-pointers', 'Memory & Pointers'], ['recursion', 'Recursion'], ['divide-conquer', 'Divide & Conquer'],
  ]],
  ['Arrays & Strings', [
    ['arrays', 'Arrays'], ['dynamic-arrays', 'Dynamic Arrays'], ['two-pointers', 'Two Pointers'], ['sliding-window', 'Sliding Window'], ['prefix-sums', 'Prefix Sums'], ['maximum-subarray', 'Maximum Subarray'], ['merge-intervals', 'Merge Intervals'], ['pattern-matching', 'Pattern Matching'], ['kmp-search', 'KMP Search'], ['2d-arrays', '2D Arrays'],
  ]],
  ['Linked Lists', [
    ['singly-linked-lists', 'Singly Linked Lists'], ['doubly-linked-lists', 'Doubly Linked Lists'], ['fast-slow-pointers', 'Fast & Slow Pointers'], ['reversing-list', 'Reversing a List'], ['merging-sorted-lists', 'Merging Sorted Lists'], ['lru-cache', 'LRU Cache'],
  ]],
  ['Stacks & Queues', [
    ['stacks', 'Stacks'], ['balanced-brackets', 'Balanced Brackets'], ['queues', 'Queues'], ['circular-buffer', 'Circular Buffer'], ['deques', 'Deques'], ['monotonic-stack', 'Monotonic Stack'], ['monotonic-queue', 'Monotonic Queue'],
  ]],
  ['Hashing', [
    ['hash-tables', 'Hash Tables'], ['collision-handling', 'Collision Handling'], ['resizing-rehashing', 'Resizing & Rehashing'], ['sets-maps', 'Sets & Maps'], ['bloom-filters', 'Bloom Filters'],
  ]],
  ['Trees', [
    ['binary-trees', 'Binary Trees'], ['tree-traversals', 'Tree Traversals'], ['lowest-common-ancestor', 'Lowest Common Ancestor'], ['binary-search-trees', 'Binary Search Trees'], ['bst-deletion', 'BST Deletion'], ['balanced-trees', 'Balanced Trees'], ['tries', 'Tries'], ['segment-trees', 'Segment Trees'],
  ]],
  ['Heaps', [
    ['binary-heaps', 'Binary Heaps'], ['building-heap', 'Building a Heap'], ['priority-queues', 'Priority Queues'], ['top-k', 'Top-K Problems'], ['median-stream', 'Median of a Stream'], ['heap-sort', 'Heap Sort'],
  ]],
  ['Graphs', [
    ['graph-representation', 'Graph Representation'], ['breadth-first-search', 'Breadth-First Search'], ['depth-first-search', 'Depth-First Search'], ['connected-components', 'Connected Components'], ['cycle-detection', 'Cycle Detection'], ['topological-sort', 'Topological Sort'], ['strongly-connected-components', 'Strongly Connected Components'], ['shortest-paths', 'Shortest Paths'], ['bellman-ford', 'Bellman–Ford'], ['floyd-warshall', 'Floyd–Warshall'], ['union-find', 'Union-Find'], ['minimum-spanning-trees', 'Minimum Spanning Trees'], ['prims-algorithm', 'Prim’s Algorithm'],
  ]],
  ['Sorting & Searching', [
    ['binary-search', 'Binary Search'], ['binary-search-answer', 'Binary Search on the Answer'], ['simple-sorts', 'Simple Sorts'], ['merge-sort', 'Merge Sort'], ['quick-sort', 'Quick Sort'], ['quickselect', 'Quickselect'], ['counting-radix-sort', 'Counting & Radix Sort'], ['sorting-stability', 'Stability & the Sorting Limit'],
  ]],
  ['Greedy Algorithms', [
    ['interval-scheduling', 'Interval Scheduling'], ['huffman-coding', 'Huffman Coding'], ['when-greedy-fails', 'When Greedy Fails'],
  ]],
  ['Backtracking', [
    ['subsets', 'Subsets'], ['permutations', 'Permutations'], ['n-queens', 'N-Queens'], ['solving-maze', 'Solving a Maze'],
  ]],
  ['Dynamic Programming', [
    ['memoization', 'Memoization'], ['tabulation', 'Tabulation'], ['grid-paths', 'Grid Paths'], ['knapsack', 'Knapsack'], ['coin-change', 'Coin Change'], ['longest-increasing-subsequence', 'Longest Increasing Subsequence'], ['sequences', 'Sequences'], ['edit-distance', 'Edit Distance'],
  ]],
  ['Bit Manipulation', [
    ['bits-masks', 'Bits & Masks'], ['bit-tricks', 'Bit Tricks'], ['bitsets', 'Bitsets'],
  ]],
  ['Hard Problems', [['p-vs-np', 'P vs NP']]],
];

export const inventory = curriculum.flatMap(([category, topics], groupIndex) =>
  topics.map(([id, title], topicIndex) => ({ id, title, category, groupIndex, topicIndex })));

export const byId = Object.fromEntries(inventory.map(topic => [topic.id, topic]));
