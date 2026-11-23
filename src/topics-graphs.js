import { snapshot, defineTopic } from './trace-contract.js';

function layout(view) {
  if (view.kind !== 'tree' || !view.nodes.length) return view;
  const children = new Map(view.nodes.map(n => [n.id, []]));
  const childIds = new Set();
  for (const edge of view.edges) {
    children.get(edge.from).push(edge.to); childIds.add(edge.to);
  }
  const positions = new Map(); let leaves = 0, maxDepth = 0;
  function place(id, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const descendants = children.get(id);
    const childPositions = descendants.map(child => place(child, depth + 1));
    const column = childPositions.length ? (childPositions[0] + childPositions.at(-1)) / 2 : leaves++;
    positions.set(id, { column, depth });
    return column;
  }
  for (const node of view.nodes) if (!childIds.has(node.id)) place(node.id, 0);
  return { ...view, nodes: view.nodes.map(node => {
    const p = positions.get(node.id);
    return { ...node,
      x: node.x ?? (leaves === 1 ? 490 : 100 + p.column * 780 / (leaves - 1)),
      y: node.y ?? 130 + p.depth * 360 / Math.max(1, maxDepth),
    };
  }) };
}

// Keep algorithm execution complete even when the teaching trace is condensed.
function recorder() {
  const frames = [];
  let omitted = 0;
  return {
    add(title, description, view, metrics = []) {
      if (frames.length < 28) frames.push(snapshot(title, description, layout(view), metrics));
      else omitted++;
    },
    finish(description, view, result, metrics = []) {
      frames.push(snapshot('Computed result', description, { ...layout(view), result },
        [...metrics, ...(omitted ? [['Condensed operations', omitted]] : [])]));
      return frames;
    },
  };
}
const lines = text => text.trim().split('\n');
function lesson(spec, pseudocode, javascript, python) {
  return defineTopic({ ...spec, code: {
    Pseudocode: lines(pseudocode), JavaScript: lines(javascript), Python: lines(python),
  } });
}
const arrayView = (values, active = [], extra = {}) => ({ kind: 'array', values, active, ...extra });
const gridView = (matrix, active = [], extra = {}) => ({ kind: 'grid', matrix, active, ...extra });
const display = value => value === Infinity ? '∞' : value === -Infinity ? '−∞' : String(value);
const listResult = values => values.length ? values.join(', ') : '(empty)';
const quiz = (question, options, answer, explanation) => ({ question, options, answer, explanation });
const challenge = (prompt, answer, hint, explanation) => ({ prompt, answer, hint, explanation });

function binaryTree(values) {
  const nodes = values.map((value, index) => value == null ? null :
    ({ id: String(index), value, left: null, right: null }));
  nodes.forEach((node, index) => {
    if (node) {
      node.left = nodes[2 * index + 1] ?? null;
      node.right = nodes[2 * index + 2] ?? null;
    }
  });
  return nodes[0] ?? null;
}
function treeView(root, active = [], extra = {}) {
  const nodes = [], edges = [];
  function visit(node) {
    if (!node) return;
    nodes.push({ id: node.id, label: String(node.value) });
    for (const child of [node.left, node.right]) if (child) {
      edges.push({ from: node.id, to: child.id });
      visit(child);
    }
  }
  visit(root);
  return { kind: 'tree', nodes, edges, active, directed: true, ...extra };
}
function inorder(root, output = []) {
  if (root) { inorder(root.left, output); output.push(root.value); inorder(root.right, output); }
  return output;
}
function insertBST(root, value, id, onStep = () => {}) {
  if (!root) return { id, value, left: null, right: null };
  let node = root;
  while (true) {
    onStep(node);
    if (value === node.value) return root;
    const side = value < node.value ? 'left' : 'right';
    if (!node[side]) { node[side] = { id, value, left: null, right: null }; return root; }
    node = node[side];
  }
}
function makeBST(values) {
  let root = null;
  values.forEach((value, i) => { root = insertBST(root, value, String(i)); });
  return root;
}

export const topics = {};

topics['binary-trees'] = lesson({
  intro: 'A binary tree gives each node at most two child links, not necessarily two children or sorted keys. Compute height bottom-up: an empty subtree contributes zero, and a parent adds one to the taller child. Here height counts nodes, so a leaf has height one.',
  invariant: 'After a recursive call returns, its height is exactly one plus the larger child height; both child answers are complete before the parent is measured.',
  takeaway: 'Shape, not key order, determines height. A chain of n nodes has height n; the empty tree has height zero under this convention.',
  complexity: { time: 'O(n): visit every reachable node once.', space: 'O(h) recursive stack for tree height h; visualization storage excluded.' },
  examples: [
    { label: 'Two uneven branches', input: { values: [8, 3, 10, 1, 6, null, 14] }, expected: 'Height: 3; nodes: 6' },
    { label: 'Empty tree', input: { values: [] }, expected: 'Height: 0; nodes: 0' },
  ],
  trace({ values }) {
    const root = binaryTree(values), r = recorder(); let count = 0;
    r.add('Child links, not sorted positions', 'Null slots are absent children in this level-indexed input.', treeView(root));
    function height(node) {
      if (!node) return 0;
      const left = height(node.left), right = height(node.right); count++;
      const h = 1 + Math.max(left, right);
      r.add('Measure a completed subtree', `Node ${node.value}: 1 + max(${left}, ${right}) = ${h}.`,
        treeView(root, [node.id]), [['Subtree height', h], ['Measured nodes', count]]);
      return h;
    }
    const h = height(root);
    return r.finish('Every reachable child link has been accounted for.', treeView(root), `Height: ${h}; nodes: ${count}`);
  },
  quiz: quiz('With height measured in nodes, what is the height of a leaf?', ['0', '1', '2', 'Its key'], 1, 'Both children are empty with height zero, so the leaf adds one.'),
  challenge: challenge('A root has a leaf on the left and a three-node chain on the right. What is its height?', '4', 'Use the taller subtree.', 'The right subtree has height three; the root adds one.'),
}, `
HEIGHT(node):
  if node is absent: return 0
  return 1 + max(HEIGHT(node.left), HEIGHT(node.right))
`, `
function height(node) {
  if (!node) return 0;
  return 1 + Math.max(height(node.left), height(node.right));
}
`, `
def height(node):
    if node is None:
        return 0
    return 1 + max(height(node.left), height(node.right))
`);

topics['tree-traversals'] = lesson({
  intro: 'Depth-first traversal changes meaning when the node is emitted before, between, or after its children. Preorder copies a hierarchy, inorder reads a BST in sorted order, and postorder finishes dependencies before their parent. Compare all three on the same unsorted binary tree.',
  invariant: 'Each recursive call emits its node exactly once in each order, with the complete left subtree preceding the complete right subtree.',
  takeaway: 'Inorder is sorted only when the input also satisfies the BST invariant. Traversal order is about structure, not a sorting operation.',
  complexity: { time: 'O(n) for all three orders together; each node has constant work.', space: 'O(n) output plus O(h) recursion for height h.' },
  examples: [
    { label: 'Branching tree', input: { values: [4, 2, 6, 1, 3] }, expected: 'Pre: 4, 2, 1, 3, 6 | In: 1, 2, 3, 4, 6 | Post: 1, 3, 2, 6, 4' },
    { label: 'Not a search tree', input: { values: [2, 7, 1] }, expected: 'Pre: 2, 7, 1 | In: 7, 2, 1 | Post: 7, 1, 2' },
  ],
  trace({ values }) {
    const root = binaryTree(values), r = recorder(), pre = [], ino = [], post = [];
    r.add('One tree, three emission times', 'All orders descend left before right.', treeView(root));
    function walk(node) {
      if (!node) return;
      pre.push(node.value);
      r.add('Preorder: entering', `Emit ${node.value} before either child.`, treeView(root, [node.id]), [['Preorder', listResult(pre)]]);
      walk(node.left); ino.push(node.value);
      r.add('Inorder: between children', `The left subtree of ${node.value} is complete.`, treeView(root, [node.id]), [['Inorder', listResult(ino)]]);
      walk(node.right); post.push(node.value);
      r.add('Postorder: leaving', `Both subtrees of ${node.value} are complete.`, treeView(root, [node.id]), [['Postorder', listResult(post)]]);
    }
    walk(root);
    return r.finish('Emission position produces three different sequences.', treeView(root),
      `Pre: ${listResult(pre)} | In: ${listResult(ino)} | Post: ${listResult(post)}`);
  },
  quiz: quiz('Which traversal emits a node after both subtrees?', ['Preorder', 'Inorder', 'Postorder', 'Level order'], 2, 'Postorder places the parent after its descendants.'),
  challenge: challenge('For root A with children B and C, give postorder.', 'B, C, A', 'Children finish first.', 'Visit left B, then right C, then emit A.'),
}, `
WALK(node):
  if absent: return
  emit node to preorder
  WALK(node.left)
  emit node to inorder
  WALK(node.right)
  emit node to postorder
`, `
function orders(node, pre = [], ino = [], post = []) {
  if (!node) return { pre, ino, post };
  pre.push(node.value);
  orders(node.left, pre, ino, post);
  ino.push(node.value);
  orders(node.right, pre, ino, post);
  post.push(node.value);
  return { pre, ino, post };
}
`, `
def orders(node, pre, ino, post):
    if node is None:
        return
    pre.append(node.value)
    orders(node.left, pre, ino, post)
    ino.append(node.value)
    orders(node.right, pre, ino, post)
    post.append(node.value)
`);

topics['lowest-common-ancestor'] = lesson({
  intro: 'In a general binary tree, the lowest common ancestor is the deepest node whose subtree contains both targets. Return a candidate upward when one side contains a target; when both sides report candidates, the current node is their first meeting point. A target may be its own ancestor.',
  invariant: 'A returned candidate is either a target or the deepest meeting point found below; presence is checked for both requested keys before accepting an answer.',
  takeaway: 'This method needs no BST ordering. Unique keys identify targets here; a missing target must yield no ancestor rather than the one existing target.',
  complexity: { time: 'O(n) including presence checks on a tree with unique keys.', space: 'O(h) recursive stack for height h.' },
  examples: [
    { label: 'Targets in separate branches', input: { values: [3, 5, 1, 6, 2, 0, 8], a: 6, b: 8 }, expected: 'LCA: 3' },
    { label: 'Missing target', input: { values: [3, 5, 1], a: 5, b: 9 }, expected: 'LCA: not found' },
  ],
  trace({ values, a, b }) {
    const root = binaryTree(values), r = recorder(), present = new Set();
    r.add('Search for both targets', `Targets are ${a} and ${b}; keys must be unique.`, treeView(root));
    function search(node) {
      if (!node) return null;
      present.add(node.value);
      const left = search(node.left), right = search(node.right);
      const candidate = node.value === a || node.value === b ? node : left && right ? node : left || right;
      r.add('Propagate subtree evidence', `At ${node.value}, candidate is ${candidate?.value ?? 'none'}.`,
        treeView(root, [node.id]), [['Left candidate', left?.value ?? 'none'], ['Right candidate', right?.value ?? 'none']]);
      return candidate;
    }
    const candidate = search(root), answer = present.has(a) && present.has(b) ? candidate : null;
    return r.finish('Accept a meeting point only if both targets exist.', treeView(root, answer ? [answer.id] : []), `LCA: ${answer?.value ?? 'not found'}`);
  },
  quiz: quiz('If one target is an ancestor of the other, which is the LCA?', ['The root always', 'The deeper target', 'The ancestor target', 'No LCA exists'], 2, 'A node is allowed to be its own ancestor.'),
  challenge: challenge('Root 8 has child 4, and 4 has child 2. Find LCA(4,2).', '4', 'One target contains the other.', 'Node 4 is the deepest subtree containing both targets.'),
}, `
Verify both unique target keys exist
SEARCH(node):
  recursively obtain left and right candidates
  if node is a target or both candidates exist: return node
  return the nonempty candidate
`, `
function lca(root, a, b) {
  const seen = new Set();
  function visit(n) {
    if (!n) return null;
    seen.add(n.value);
    const l = visit(n.left), r = visit(n.right);
    return n.value === a || n.value === b || (l && r) ? n : l || r;
  }
  const answer = visit(root);
  return seen.has(a) && seen.has(b) ? answer : null;
}
`, `
def lca(root, a, b):
    seen = set()
    def visit(n):
        if n is None:
            return None
        seen.add(n.value)
        left, right = visit(n.left), visit(n.right)
        if n.value in (a, b) or (left and right):
            return n
        return left or right
    answer = visit(root)
    return answer if a in seen and b in seen else None
`);

topics['binary-search-trees'] = lesson({
  intro: 'A binary search tree stores smaller keys in the entire left subtree and larger keys in the entire right subtree. Insert by following comparisons until an empty child link is reached, then search by discarding one subtree per comparison. This lesson treats duplicate keys as already present.',
  invariant: 'Every left descendant is smaller and every right descendant is larger; insertion changes only an empty link and never crosses an ancestor bound.',
  takeaway: 'Search is O(h), not automatically O(log n). Sorted insertion can make a chain; balancing is a separate responsibility.',
  complexity: { time: 'O(nh) to insert n keys, then O(h) search; h can be n without balancing.', space: 'O(n) nodes; iterative insertion and search use O(1) auxiliary space.' },
  examples: [
    { label: 'Find an internal key', input: { values: [5, 2, 8, 1, 3], key: 3 }, expected: 'Sorted: 1, 2, 3, 5, 8; found: yes' },
    { label: 'Duplicate and absent key', input: { values: [2, 2, 3, 4], key: 1 }, expected: 'Sorted: 2, 3, 4; found: no' },
  ],
  trace({ values, key }) {
    let root = null; const r = recorder();
    r.add('Start with no keys', 'Insert unique values by following strict comparisons.', treeView(root));
    values.forEach((value, i) => {
      root = insertBST(root, value, String(i), node =>
        r.add('Compare before insertion', `${value} versus ${node.value}: ${value === node.value ? 'ignore duplicate' : value < node.value ? 'go left' : 'go right'}.`, treeView(root, [node.id])));
      r.add('Insertion complete', `Key ${value} is present; ancestor bounds still hold.`, treeView(root));
    });
    let node = root;
    while (node && node.value !== key) {
      r.add('Discard one subtree', `Searching for ${key} at ${node.value}.`, treeView(root, [node.id]));
      node = key < node.value ? node.left : node.right;
    }
    return r.finish('Inorder exposes the key ordering; search reports presence.', treeView(root, node ? [node.id] : []),
      `Sorted: ${listResult(inorder(root))}; found: ${node ? 'yes' : 'no'}`);
  },
  quiz: quiz('What happens to an ordinary BST after ascending insertion?', ['Always balanced', 'May become a right chain', 'Becomes a heap', 'Keys reverse'], 1, 'Every new largest key follows right links to the end.'),
  challenge: challenge('Insert 5,2,8,3. Which comparisons find 3?', '5, 2, 3', 'Smaller goes left; larger goes right.', 'From 5 go left to 2, then right to 3.'),
}, `
INSERT(node, key):
  if absent: return new node
  if key < node.key: insert left
  if key > node.key: insert right
  return node
SEARCH follows the same comparisons
`, `
function insert(node, key) {
  if (!node) return { value: key, left: null, right: null };
  if (key < node.value) node.left = insert(node.left, key);
  if (key > node.value) node.right = insert(node.right, key);
  return node;
}
function contains(node, key) {
  while (node && node.value !== key)
    node = key < node.value ? node.left : node.right;
  return Boolean(node);
}
`, `
def insert(node, key):
    if node is None:
        return Node(key)
    if key < node.value:
        node.left = insert(node.left, key)
    elif key > node.value:
        node.right = insert(node.right, key)
    return node

def contains(node, key):
    while node and node.value != key:
        node = node.left if key < node.value else node.right
    return node is not None
`);

topics['bst-deletion'] = lesson({
  intro: 'Deleting a BST key is structural surgery. A leaf disappears, a one-child node is replaced by its child, and a two-child node copies its inorder successor, the minimum of its right subtree. The successor itself is then spliced out so no duplicate remains.',
  invariant: 'Each returned subtree preserves strict key order and contains exactly its previous keys minus the requested key, if that key existed.',
  takeaway: 'Copying a successor is only half the job: remove its old node too. Return the new subtree root because deleting the root may change it.',
  complexity: { time: 'O(h) deletion after construction; successor search follows at most h links.', space: 'O(h) recursive stack for an unbalanced tree of height h.' },
  examples: [
    { label: 'Successor has a child to splice', input: { values: [5, 2, 9, 7, 8, 10], key: 5 }, expected: 'Remaining: 2, 7, 8, 9, 10; deleted: yes' },
    { label: 'Absent key preserves the tree', input: { values: [4, 2, 6], key: 9 }, expected: 'Remaining: 2, 4, 6; deleted: no' },
  ],
  trace({ values, key }) {
    let root = makeBST(values); const r = recorder(); let deleted = false;
    r.add('Locate the deletion target', `Remove ${key} while preserving ancestor bounds.`, treeView(root));
    function remove(node, target) {
      if (!node) return null;
      r.add('Compare target', `Compare ${target} with ${node.value}.`, treeView(root, [node.id]));
      if (target < node.value) node.left = remove(node.left, target);
      else if (target > node.value) node.right = remove(node.right, target);
      else {
        deleted = true;
        if (!node.left || !node.right) {
          const child = node.left || node.right;
          r.add('Splice at most one child', `Replace ${node.value} by ${child?.value ?? 'an empty link'}.`, treeView(root, [node.id]));
          return child;
        }
        let successor = node.right;
        while (successor.left) {
          r.add('Walk to right-subtree minimum', 'The successor is the leftmost node on the right.', treeView(root, [successor.id]));
          successor = successor.left;
        }
        node.value = successor.value;
        r.add('Copy successor key', `Copy ${successor.value}; now remove its old node, which has no left child.`, treeView(root, [node.id, successor.id]));
        node.right = remove(node.right, successor.value);
      }
      return node;
    }
    root = remove(root, key);
    return r.finish('The successor copy, if used, appears only once in the final tree.', treeView(root),
      `Remaining: ${listResult(inorder(root))}; deleted: ${deleted ? 'yes' : 'no'}`);
  },
  quiz: quiz('Why can the inorder successor be spliced without a two-child case?', ['It is always a leaf', 'It has no left child', 'It has no right child', 'It is the root'], 1, 'A left child would be a smaller key in the right subtree, contradicting minimality.'),
  challenge: challenge('Delete 5 from a BST with left 2 and right 9 whose left child is 7. Which key replaces 5?', '7', 'Find the right-subtree minimum.', 'The leftmost key below 9 is 7; its old node is removed.'),
}, `
DELETE(node, key):
  descend by comparisons
  when found with zero or one child: return that child
  otherwise copy minimum key from right subtree
  delete that minimum from the right subtree
  return node
`, `
function remove(n, key) {
  if (!n) return null;
  if (key < n.value) n.left = remove(n.left, key);
  else if (key > n.value) n.right = remove(n.right, key);
  else {
    if (!n.left) return n.right;
    if (!n.right) return n.left;
    let s = n.right;
    while (s.left) s = s.left;
    n.value = s.value;
    n.right = remove(n.right, s.value);
  }
  return n;
}
`, `
def remove(n, key):
    if n is None:
        return None
    if key < n.value:
        n.left = remove(n.left, key)
    elif key > n.value:
        n.right = remove(n.right, key)
    else:
        if n.left is None:
            return n.right
        if n.right is None:
            return n.left
        s = n.right
        while s.left:
            s = s.left
        n.value = s.value
        n.right = remove(n.right, s.value)
    return n
`);

topics['balanced-trees'] = lesson({
  intro: 'An AVL tree adds a height rule to BST ordering: child heights differ by at most one. After insertion, recompute heights on the search path and repair the first unbalanced shapes with rotations. An outer-heavy branch needs one rotation; an inner-heavy branch needs two.',
  invariant: 'Every completed subtree has correct stored height, strict BST ordering, and balance factor between −1 and 1.',
  takeaway: 'Rotations rearrange links without changing inorder key order. Height metadata must be updated on the demoted node before the promoted node.',
  complexity: { time: 'O(log n) per AVL insertion, O(n log n) for n keys; duplicate keys ignored.', space: 'O(n) nodes plus O(log n) recursive insertion stack.' },
  examples: [
    { label: 'Left-left: one rotation', input: { values: [30, 20, 10] }, expected: 'Root: 20; sorted: 10, 20, 30; height: 2' },
    { label: 'Left-right: double rotation', input: { values: [30, 10, 20] }, expected: 'Root: 20; sorted: 10, 20, 30; height: 2' },
  ],
  trace({ values }) {
    let root = null; const r = recorder();
    const h = n => n?.height ?? 0;
    const update = n => { n.height = 1 + Math.max(h(n.left), h(n.right)); };
    function rotate(n, left) {
      const p = left ? n.right : n.left;
      if (left) { n.right = p.left; p.left = n; }
      else { n.left = p.right; p.right = n; }
      update(n); update(p);
      r.add(left ? 'Rotate left' : 'Rotate right', `Promote ${p.value} over ${n.value}; preserve the middle subtree.`,
        treeView(p, [n.id, p.id]), [['Local height', p.height]]);
      return p;
    }
    function insert(n, value, id) {
      if (!n) return { value, id, height: 1, left: null, right: null };
      if (value === n.value) return n;
      if (value < n.value) n.left = insert(n.left, value, id);
      else n.right = insert(n.right, value, id);
      update(n); const balance = h(n.left) - h(n.right);
      r.add('Check height difference', `At ${n.value}, balance = ${balance}.`, treeView(n, [n.id]), [['Balance', balance]]);
      if (balance > 1) {
        if (value > n.left.value) n.left = rotate(n.left, true);
        return rotate(n, false);
      }
      if (balance < -1) {
        if (value < n.right.value) n.right = rotate(n.right, false);
        return rotate(n, true);
      }
      return n;
    }
    r.add('Empty AVL tree', 'Insert keys and repair heights as recursion unwinds.', treeView(root));
    values.forEach((value, i) => {
      root = insert(root, value, String(i));
      r.add('Balanced insertion complete', `Inserted ${value}; show the entire repaired tree.`, treeView(root));
    });
    return r.finish('Ordering survived the rotations and height is logarithmically bounded.', treeView(root),
      `Root: ${root?.value ?? 'none'}; sorted: ${listResult(inorder(root))}; height: ${h(root)}`);
  },
  quiz: quiz('Which repair fixes a left-right insertion imbalance?', ['Right only', 'Left on the child, then right on the node', 'Left only', 'Delete the root'], 1, 'The child rotation makes the inner-heavy shape outer-heavy.'),
  challenge: challenge('Insert 10,30,20 into an AVL tree. What root remains?', '20', 'This is right-left, the mirror of left-right.', 'Rotate right at 30 and left at 10 to promote 20.'),
}, `
Insert as in a BST and update height on return
If left-heavy:
  if left child is right-heavy: rotate left child left
  rotate node right
If right-heavy: apply the mirrored repairs
Each rotation updates demoted height before promoted height
`, `
const height = n => n?.height ?? 0;
function update(n) { n.height = 1 + Math.max(height(n.left), height(n.right)); }
function rotate(n, left) {
  const p = left ? n.right : n.left;
  if (left) { n.right = p.left; p.left = n; }
  else { n.left = p.right; p.right = n; }
  update(n); update(p); return p;
}
function insert(n, value) {
  if (!n) return { value, height: 1, left: null, right: null };
  if (value === n.value) return n;
  if (value < n.value) n.left = insert(n.left, value);
  else n.right = insert(n.right, value);
  update(n);
  const b = height(n.left) - height(n.right);
  if (b > 1) {
    if (value > n.left.value) n.left = rotate(n.left, true);
    return rotate(n, false);
  }
  if (b < -1) {
    if (value < n.right.value) n.right = rotate(n.right, false);
    return rotate(n, true);
  }
  return n;
}
`, `
def height(n):
    return n.height if n else 0
def update(n):
    n.height = 1 + max(height(n.left), height(n.right))
def rotate(n, left):
    p = n.right if left else n.left
    if left:
        n.right, p.left = p.left, n
    else:
        n.left, p.right = p.right, n
    update(n)
    update(p)
    return p
def insert(n, key):
    if n is None:
        return Node(key, height=1)
    if key == n.value:
        return n
    if key < n.value:
        n.left = insert(n.left, key)
    else:
        n.right = insert(n.right, key)
    update(n)
    b = height(n.left) - height(n.right)
    if b > 1:
        if key > n.left.value:
            n.left = rotate(n.left, True)
        return rotate(n, False)
    if b < -1:
        if key < n.right.value:
            n.right = rotate(n.right, False)
        return rotate(n, True)
    return n
`);

topics['tries'] = lesson({
  intro: 'A trie shares character prefixes instead of comparing whole words. Each edge consumes one character, and a terminal flag distinguishes a stored word from a mere prefix. Insert words, then compare exact membership with prefix existence on the same query.',
  invariant: 'The root-to-node edge labels spell exactly one prefix; terminal is true precisely when a complete inserted word ends there.',
  takeaway: 'Reaching a prefix is not enough for exact membership. The empty prefix always exists, but the empty word is present only if explicitly inserted.',
  complexity: { time: 'O(S + m): S inserted characters and m query characters, assuming constant-time child-map operations.', space: 'O(S) worst-case trie nodes; shared prefixes reduce actual allocation.' },
  examples: [
    { label: 'Shared prefix is not a word', input: { words: ['car', 'cat'], query: 'ca' }, expected: 'Word: no; prefix: yes' },
    { label: 'Terminal word with an extension', input: { words: ['a', 'ant'], query: 'a' }, expected: 'Word: yes; prefix: yes' },
  ],
  trace({ words, query }) {
    const root = { id: '0', children: new Map(), terminal: false }; let next = 1; const r = recorder();
    function view(active = []) {
      const nodes = [], edges = [];
      function visit(n, prefix) {
        nodes.push({ id: n.id, label: `${prefix || 'root'}${n.terminal ? ' ✓' : ''}` });
        for (const [ch, child] of n.children) {
          edges.push({ from: n.id, to: child.id, label: ch }); visit(child, prefix + ch);
        }
      }
      visit(root, ''); return { kind: 'tree', nodes, edges, active, directed: true };
    }
    r.add('Start at the empty prefix', 'Terminal flags, not leaves, identify stored words.', view());
    for (const word of words) {
      let n = root;
      for (const ch of word) {
        const shared = n.children.has(ch);
        if (!shared) n.children.set(ch, { id: String(next++), children: new Map(), terminal: false });
        n = n.children.get(ch);
        r.add(shared ? 'Reuse prefix edge' : 'Create character edge', `Consume ${ch} while inserting "${word}".`, view([n.id]));
      }
      n.terminal = true;
      r.add('Mark a word ending', `"${word}" ends here even if more words extend it.`, view([n.id]));
    }
    let n = root;
    for (const ch of query) {
      n = n?.children.get(ch);
      r.add('Follow query character', `Consume ${ch}: ${n ? 'edge exists' : 'prefix missing'}.`, view(n ? [n.id] : []));
      if (!n) break;
    }
    return r.finish('Exact search checks the terminal flag; prefix search checks only reachability.', view(n ? [n.id] : []),
      `Word: ${n?.terminal ? 'yes' : 'no'}; prefix: ${n ? 'yes' : 'no'}`);
  },
  quiz: quiz('What distinguishes an inserted word from a prefix?', ['Node depth', 'Terminal flag', 'Number of siblings', 'Edge color'], 1, 'A word may end at an internal node with children.'),
  challenge: challenge('After inserting "tea" and "team", is "te" a word?', 'no', 'An existing path does not imply a terminal flag.', 'The path for te exists, but neither insertion ends there.'),
}, `
For each word, follow or create each character edge
Mark the final node terminal
For query, follow every character edge
Prefix exists if the path exists
Word exists if that node is also terminal
`, `
function trie(words) {
  const root = { children: new Map(), terminal: false };
  for (const word of words) {
    let n = root;
    for (const c of word) {
      if (!n.children.has(c)) n.children.set(c, { children: new Map(), terminal: false });
      n = n.children.get(c);
    }
    n.terminal = true;
  }
  return root;
}
function lookup(root, query) {
  let n = root;
  for (const c of query) { n = n?.children.get(c); if (!n) break; }
  return { prefix: Boolean(n), word: Boolean(n?.terminal) };
}
`, `
def trie(words):
    root = {"children": {}, "terminal": False}
    for word in words:
        n = root
        for c in word:
            n = n["children"].setdefault(c, {"children": {}, "terminal": False})
        n["terminal"] = True
    return root
def lookup(root, query):
    n = root
    for c in query:
        n = n["children"].get(c)
        if n is None:
            return False, False
    return True, n["terminal"]
`);

topics['segment-trees'] = lesson({
  intro: 'A sum segment tree partitions an array into nested half-open intervals. Build parent sums from children, replace a point by updating its ancestor sums, then answer [left,right) by accepting fully covered nodes and pruning disjoint nodes. An empty query contributes the additive identity zero.',
  invariant: 'Each node stores the sum of precisely its interval; a query returns zero for disjoint nodes and the stored sum for complete coverage.',
  takeaway: 'Half-open endpoints eliminate ambiguity: right is excluded. Sum is associative with identity zero; other aggregates need their own combine operation and identity.',
  complexity: { time: 'O(n) build, O(log n) point update and interval query for nonempty n.', space: 'O(n) stored sums and O(log n) recursive stack.' },
  examples: [
    { label: 'Update inside a partial query', input: { values: [2, 1, 5, 3], update: [1, 4], range: [1, 4] }, expected: 'Sum [1, 4): 12' },
    { label: 'Empty half-open range', input: { values: [6, -2, 4], update: null, range: [2, 2] }, expected: 'Sum [2, 2): 0' },
  ],
  trace({ values, update, range }) {
    const r = recorder(), sums = [], intervals = [], edges = [];
    function view(active = []) {
      return { kind: 'tree', nodes: intervals.flatMap((span, i) => span ? [{ id: String(i), label: `[${span[0]},${span[1]}): ${sums[i] ?? '?'}` }] : []),
        edges: edges.filter(e => intervals[Number(e.from)] && intervals[Number(e.to)]),
        active: active.map(String), directed: true };
    }
    r.add('Array before partitioning', 'The query uses a half-open interval.', arrayView(values), [['Range', `[${range.join(', ')})`]]);
    function build(i, lo, hi) {
      intervals[i] = [lo, hi];
      if (hi - lo === 1) sums[i] = values[lo];
      else {
        const mid = Math.floor((lo + hi) / 2);
        edges.push({ from: String(i), to: String(2 * i) }, { from: String(i), to: String(2 * i + 1) });
        build(2 * i, lo, mid); build(2 * i + 1, mid, hi);
        sums[i] = sums[2 * i] + sums[2 * i + 1];
      }
      r.add('Combine interval sum', `[${lo},${hi}) has sum ${sums[i]}.`, view([i]));
    }
    function set(i, lo, hi, index, value) {
      if (hi - lo === 1) sums[i] = value;
      else {
        const mid = Math.floor((lo + hi) / 2);
        if (index < mid) set(2 * i, lo, mid, index, value);
        else set(2 * i + 1, mid, hi, index, value);
        sums[i] = sums[2 * i] + sums[2 * i + 1];
      }
      r.add('Repair updated ancestor', `Set index ${index} to ${value}; recompute [${lo},${hi}).`, view([i]));
    }
    function query(i, lo, hi) {
      const [left, right] = range;
      if (right <= lo || hi <= left) {
        r.add('Prune disjoint interval', `[${lo},${hi}) contributes zero.`, view([i])); return 0;
      }
      if (left <= lo && hi <= right) {
        r.add('Accept covered interval', `Use stored sum ${sums[i]} without descending.`, view([i])); return sums[i];
      }
      const mid = Math.floor((lo + hi) / 2);
      return query(2 * i, lo, mid) + query(2 * i + 1, mid, hi);
    }
    if (values.length) build(1, 0, values.length);
    if (update && values.length) {
      if (update[0] < 0 || update[0] >= values.length) throw new RangeError('Point update index outside array');
      set(1, 0, values.length, ...update);
    }
    const sum = !values.length || range[0] >= range[1] ? 0 : query(1, 0, values.length);
    return r.finish('Disjoint contributions vanish and covered sums combine.', view(), `Sum [${range[0]}, ${range[1]}): ${sum}`);
  },
  quiz: quiz('What does a disjoint node contribute to a sum query?', ['Its full sum', 'Infinity', 'Zero', 'Its left leaf'], 2, 'Zero is the identity for addition.'),
  challenge: challenge('For [3,1,4,2], compute sum [1,3).', '5', 'Include indices 1 and 2, not 3.', '1 + 4 = 5.'),
}, `
BUILD interval sums bottom-up
SET a leaf, then recompute ancestors
QUERY(node interval, requested interval):
  if disjoint: return 0
  if completely covered: return stored sum
  return QUERY(left child) + QUERY(right child)
`, `
function segment(values) {
  const n = values.length, t = Array(2 * n).fill(0);
  for (let i = 0; i < n; i++) t[n + i] = values[i];
  for (let i = n - 1; i > 0; i--) t[i] = t[2*i] + t[2*i+1];
  return {
    set(i, value) {
      if (i < 0 || i >= n) throw new RangeError('index');
      t[i += n] = value;
      while (i > 1) { i >>= 1; t[i] = t[2*i] + t[2*i+1]; }
    },
    sum(l, r) {
      let result = 0;
      for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
        if (l & 1) result += t[l++];
        if (r & 1) result += t[--r];
      }
      return result;
    }
  };
}
`, `
class Segment:
    def __init__(self, values):
        self.n = len(values)
        self.t = [0] * self.n + list(values)
        for i in range(self.n - 1, 0, -1):
            self.t[i] = self.t[2*i] + self.t[2*i+1]
    def set(self, i, value):
        if not 0 <= i < self.n:
            raise IndexError(i)
        i += self.n
        self.t[i] = value
        while i > 1:
            i //= 2
            self.t[i] = self.t[2*i] + self.t[2*i+1]
    def sum(self, left, right):
        left, right, total = left + self.n, right + self.n, 0
        while left < right:
            if left % 2:
                total += self.t[left]
                left += 1
            if right % 2:
                right -= 1
                total += self.t[right]
            left //= 2
            right //= 2
        return total
`);

class Heap {
  constructor(before = (a, b) => a < b, report = () => {}) {
    this.items = []; this.before = before; this.report = report;
  }
  swap(i, j) {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    this.report('Swap heap positions', [i, j]);
  }
  push(value) {
    this.items.push(value); let i = this.items.length - 1;
    this.report('Append at next leaf', [i]);
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (!this.before(this.items[i], this.items[p])) break;
      this.swap(i, p); i = p;
    }
  }
  down(i, end = this.items.length) {
    while (2 * i + 1 < end) {
      let c = 2 * i + 1;
      if (c + 1 < end && this.before(this.items[c + 1], this.items[c])) c++;
      if (!this.before(this.items[c], this.items[i])) break;
      this.swap(i, c); i = c;
    }
  }
  pop() {
    if (!this.items.length) return undefined;
    const result = this.items[0], last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last; this.report('Move last leaf to root', [0]); this.down(0);
    }
    return result;
  }
  build(values) {
    this.items = [...values];
    for (let i = Math.floor(this.items.length / 2) - 1; i >= 0; i--) {
      this.report('Sift an internal subtree', [i]); this.down(i);
    }
  }
}
function heapView(heap, active = [], label = String, extra = {}) {
  return {
    kind: 'tree', directed: true,
    nodes: heap.items.map((v, i) => ({ id: String(i), label: label(v) })),
    edges: heap.items.slice(1).map((_, i) => ({ from: String(Math.floor(i / 2)), to: String(i + 1) })),
    active: active.map(String), ...extra,
  };
}
const heapJavaScript = `
class Heap {
  constructor(before = (a,b) => a < b) { this.a = []; this.before = before; }
  push(x) {
    this.a.push(x);
    for (let i = this.a.length-1; i > 0;) {
      const p = Math.floor((i-1)/2);
      if (!this.before(this.a[i], this.a[p])) break;
      [this.a[i],this.a[p]] = [this.a[p],this.a[i]]; i = p;
    }
  }
  down(i, end = this.a.length) {
    while (2*i+1 < end) {
      let c = 2*i+1;
      if (c+1 < end && this.before(this.a[c+1],this.a[c])) c++;
      if (!this.before(this.a[c],this.a[i])) break;
      [this.a[i],this.a[c]] = [this.a[c],this.a[i]]; i = c;
    }
  }
  pop() {
    if (!this.a.length) return undefined;
    const out = this.a[0], last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this.down(0); }
    return out;
  }
}
`;

topics['binary-heaps'] = lesson({
  intro: 'A min-heap combines complete-tree shape with local priority order: each parent is no larger than either child. Array positions encode links, so insertion appends a leaf and sifts it upward. Removing the minimum moves the last leaf to the root and sifts it down through the smaller child.',
  invariant: 'Outside the current sift path, every parent is at most its children; each swap moves the one possible violation toward an endpoint.',
  takeaway: 'The root is minimum, but the heap array is not sorted. Complete shape gives logarithmic height even when values arrive in sorted order.',
  complexity: { time: 'O(log n) per push/pop; O(n log n) for these repeated insertions and removals.', space: 'O(n) heap; each sift uses O(1) auxiliary space.' },
  examples: [
    { label: 'Small value climbs to root', input: { values: [7, 4, 9, 1], remove: 2 }, expected: 'Removed: 1, 4; heap: 7, 9' },
    { label: 'Duplicates keep heap order', input: { values: [2, 2, 1], remove: 1 }, expected: 'Removed: 1; heap: 2, 2' },
  ],
  trace({ values, remove }) {
    const r = recorder(), h = new Heap((a, b) => a < b, (title, active) =>
      r.add(title, 'Parent index floor((i−1)/2); child indices 2i+1 and 2i+2.', heapView(h, active)));
    r.add('Empty complete tree', 'Use a min-heap: smaller values have higher priority.', heapView(h));
    for (const value of values) {
      h.push(value); r.add('Insertion repaired', `${value} is in its heap position.`, heapView(h));
    }
    const removed = [];
    for (let i = 0; i < remove && h.items.length; i++) {
      removed.push(h.pop());
      r.add('Minimum removed', 'The root replacement has been sifted down.', heapView(h), [['Removed', listResult(removed)]]);
    }
    return r.finish('The remaining heap is partially ordered, not globally sorted.', heapView(h),
      `Removed: ${listResult(removed)}; heap: ${listResult(h.items)}`);
  },
  quiz: quiz('In a zero-indexed heap, where is the parent of index 5?', ['1', '2', '3', '10'], 1, 'floor((5−1)/2) = 2.'),
  challenge: challenge('Insert 1 into min-heap [3,5,4]. What array results?', '1, 3, 4, 5', 'Append at index 3, then compare ancestors.', 'Swap with 5 at index 1, then 3 at index 0.'),
}, `
PUSH: append leaf; swap upward while smaller than parent
POP: save root; move last leaf to root
Swap downward with the smaller child until heap order holds
`, heapJavaScript + `
const heap = new Heap();
for (const value of [7,4,9,1]) heap.push(value);
const minimum = heap.pop();
`, `
import heapq
heap = []
for value in [7, 4, 9, 1]:
    heapq.heappush(heap, value)  # sift up
minimum = heapq.heappop(heap)   # last leaf replaces root, then sifts down
`);

topics['building-heap'] = lesson({
  intro: 'Bottom-up heap construction starts with the input already laid out as a complete tree. Leaves need no repair. Visit internal nodes from the last parent back to the root, sifting each down into child subtrees that are already heaps. Most nodes lie near leaves, which makes total work linear.',
  invariant: 'Before processing index i, both child subtrees of i already satisfy min-heap order; after sifting, its entire subtree does too.',
  takeaway: 'Heapify is O(n), unlike n repeated O(log n) insertions. It produces a heap, not a sorted array.',
  complexity: { time: 'O(n) bottom-up heapify, by summing node heights in a complete tree.', space: 'O(1) auxiliary in-place heapify; this trace copies the input array.' },
  examples: [
    { label: 'Reverse priorities', input: { values: [9, 7, 5, 3, 1] }, expected: 'Heap: 1, 3, 5, 9, 7' },
    { label: 'Already a heap', input: { values: [1, 3, 2] }, expected: 'Heap: 1, 3, 2' },
  ],
  trace({ values }) {
    const r = recorder(), h = new Heap((a, b) => a < b, (title, active) =>
      r.add(title, 'Children have already been repaired; choose the smaller child.', heapView(h, active)));
    h.items = [...values];
    r.add('Unordered complete tree', 'Leaves are heaps of size one; start at the last internal node.', heapView(h), [['Last parent', Math.floor(values.length / 2) - 1]]);
    h.build(values);
    return r.finish('Every subtree now obeys min-heap order.', heapView(h), `Heap: ${listResult(h.items)}`);
  },
  quiz: quiz('Why is bottom-up heapify linear?', ['Every node is swapped once', 'Most nodes have small subtree height', 'It sorts before building', 'The tree has one level'], 1, 'The geometric distribution of heights sums to O(n), although a root sift can be logarithmic.'),
  challenge: challenge('What is the last parent index in a zero-indexed array of length 6?', '2', 'floor(n/2)−1.', 'Indices 3,4,5 are leaves, so index 2 is the last parent.'),
}, `
For i from floor(n/2)−1 down to 0:
  sift i downward through its already-heaped children
Return the same array in heap order
`, heapJavaScript + `
function heapify(values) {
  const h = new Heap(); h.a = values;
  for (let i = Math.floor(values.length/2)-1; i >= 0; i--) h.down(i);
  return h.a;
}
`, `
import heapq
def build_heap(values):
    heap = list(values)
    heapq.heapify(heap)  # bottom-up, not repeated insertion
    return heap
`);

topics['priority-queues'] = lesson({
  intro: 'A priority queue removes the most urgent item rather than the oldest item. Here a smaller numeric priority is more urgent, and an insertion sequence number breaks ties fairly. Store records in a heap ordered lexicographically by priority and then sequence.',
  invariant: 'The root is the smallest (priority, sequence) pair among all pending tasks, so equal priorities leave in arrival order.',
  takeaway: 'FIFO applies only inside equal-priority groups here. Explicit tie-breaking makes scheduling reproducible; changing a queued priority needs a separate update operation.',
  complexity: { time: 'O(log n) enqueue/dequeue and O(1) peek with a binary heap.', space: 'O(n) pending records including sequence numbers.' },
  examples: [
    { label: 'Urgency beats arrival order', input: { tasks: [['backup', 3], ['alert', 1], ['report', 2]] }, expected: 'Served: alert, report, backup' },
    { label: 'Equal priority is stable', input: { tasks: [['first', 2], ['second', 2], ['urgent', 1]] }, expected: 'Served: urgent, first, second' },
  ],
  trace({ tasks }) {
    const r = recorder(), label = t => `${t.name}:p${t.priority} #${t.seq}`;
    const h = new Heap((a, b) => a.priority < b.priority || a.priority === b.priority && a.seq < b.seq,
      (title, active) => r.add(title, 'Compare priority first and arrival sequence second.', heapView(h, active, label)));
    r.add('No pending tasks', 'Smaller priority numbers are more urgent.', heapView(h, [], label));
    tasks.forEach(([name, priority], seq) => {
      h.push({ name, priority, seq });
      r.add('Enqueue task', `Queued ${name} with priority ${priority} and sequence ${seq}.`, heapView(h, [], label));
    });
    const served = [];
    while (h.items.length) {
      const task = h.pop(); served.push(task.name);
      r.add('Serve most urgent pending task', `${task.name} leaves before less urgent or later equal-priority tasks.`,
        heapView(h, [], label), [['Served', listResult(served)]]);
    }
    return r.finish('All pending tasks were served under the stable priority ordering.', heapView(h, [], label), `Served: ${listResult(served)}`);
  },
  quiz: quiz('How can a heap priority queue preserve arrival order for ties?', ['Compare sequence numbers after priority', 'Sort names', 'Ignore priority', 'Use a random child'], 0, 'A monotonically increasing sequence number explicitly encodes stable tie order.'),
  challenge: challenge('A:p2 arrives before B:p1 and C:p2. Give service order.', 'B, A, C', 'Urgency first, arrival order second.', 'B has lower priority number; A precedes C within p2.'),
}, `
Assign each task an increasing sequence number
Enqueue into heap ordered by (priority, sequence)
Dequeue the root; repair the heap
`, heapJavaScript + `
const pending = new Heap((a,b) =>
  a.priority < b.priority || a.priority === b.priority && a.seq < b.seq);
let sequence = 0;
function enqueue(name, priority) { pending.push({ name, priority, seq: sequence++ }); }
function dequeue() { return pending.pop()?.name; }
`, `
import heapq
from itertools import count
pending, sequence = [], count()
def enqueue(name, priority):
    heapq.heappush(pending, (priority, next(sequence), name))
def dequeue():
    return heapq.heappop(pending)[2] if pending else None
`);

topics['top-k'] = lesson({
  intro: 'To keep the k largest values from a stream, maintain a min-heap of at most k candidates. Its smallest retained value is the admission threshold: reject a smaller newcomer, or replace the root when a larger one arrives. Duplicates count as separate observations.',
  invariant: 'After each arrival the heap contains the largest min(k, seen) observations so far, with the smallest retained observation at its root.',
  takeaway: 'A bounded heap avoids sorting the entire stream. Sorting just the retained k values is an optional presentation cost; k=0 retains nothing.',
  complexity: { time: 'O(n log(k+1)) selection; O(k log k) final display sorting, for 0≤k≤n.', space: 'O(k) retained values, excluding the incoming stream.' },
  examples: [
    { label: 'Replace the threshold', input: { values: [4, 1, 9, 7, 3], k: 2 }, expected: 'Top 2: 9, 7' },
    { label: 'Duplicates occupy slots', input: { values: [5, 5, 2, 8], k: 3 }, expected: 'Top 3: 8, 5, 5' },
  ],
  trace({ values, k }) {
    k = Math.max(0, Math.floor(k)); const r = recorder();
    const h = new Heap((a, b) => a < b, (title, active) =>
      r.add(title, 'Only retained candidates occupy this min-heap.', heapView(h, active), [['Capacity', k]]));
    r.add('Empty candidate set', `Keep at most ${k} largest observations.`, heapView(h));
    for (const value of values) {
      if (!k) r.add('Zero capacity', `Reject ${value}: no slots requested.`, heapView(h));
      else if (h.items.length < k) {
        h.push(value); r.add('Fill an available slot', `Retain ${value} until the candidate heap fills.`, heapView(h));
      } else if (value > h.items[0]) {
        const evicted = h.pop(); h.push(value);
        r.add('Raise the admission threshold', `${value} replaces ${evicted}.`, heapView(h), [['Threshold', h.items[0]]]);
      } else r.add('Reject below threshold', `${value} cannot improve the retained largest ${k}.`, heapView(h, [0]));
    }
    const result = [...h.items].sort((a, b) => b - a);
    return r.finish('Sort only the retained candidates for descending presentation.', arrayView(result), `Top ${k}: ${listResult(result)}`);
  },
  quiz: quiz('Why use a min-heap to retain the largest k?', ['The minimum retained value is easiest to evict', 'All values must be ascending', 'It stores the smallest k', 'It removes duplicates'], 0, 'The root is the weakest candidate and defines the replacement threshold.'),
  challenge: challenge('Retain k=2 from 6,1,4,8. What remains descending?', '8, 6', 'Replace the weakest candidate when possible.', 'After 4 replaces 1, 8 replaces 4.'),
}, `
For each value:
  if fewer than k candidates: push
  else if value exceeds heap minimum: pop minimum, push value
Return retained values in descending order
`, heapJavaScript + `
function topK(values, k) {
  const h = new Heap();
  for (const x of values) {
    if (k <= 0) continue;
    if (h.a.length < k) h.push(x);
    else if (x > h.a[0]) { h.pop(); h.push(x); }
  }
  return h.a.sort((a,b) => b-a);
}
`, `
import heapq
def top_k(values, k):
    heap = []
    for x in values:
        if k <= 0:
            continue
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:
            heapq.heapreplace(heap, x)
    return sorted(heap, reverse=True)
`);

topics['median-stream'] = lesson({
  intro: 'A running median uses two heaps: a max-heap for the lower half and a min-heap for the upper half. Classify each arrival by the lower root, then rebalance sizes. Odd prefixes use the lower root; even prefixes average the two roots.',
  invariant: 'Every lower-half value is at most every upper-half value; lower size equals upper size or exceeds it by exactly one.',
  takeaway: 'The heaps need not sort their interiors. Two boundary roots and a size invariant are sufficient to answer a median after each insertion.',
  complexity: { time: 'O(log n) insertion/rebalancing and O(1) median lookup for each prefix.', space: 'O(n) across both heaps; O(n) if all reported medians are retained.' },
  examples: [
    { label: 'Odd and even prefixes', input: { values: [5, 1, 9, 2] }, expected: 'Medians: 5, 3, 5, 3.5' },
    { label: 'Negative values and duplicates', input: { values: [-2, -2, 4] }, expected: 'Medians: -2, -2, -2' },
  ],
  trace({ values }) {
    const r = recorder(), low = new Heap((a, b) => a > b), high = new Heap(), medians = [];
    const view = () => arrayView([...low.items, '|', ...high.items], [], {
      labels: [...low.items.map(() => 'lower max-heap'), 'partition', ...high.items.map(() => 'upper min-heap')],
    });
    low.report = (title, active) => r.add(`Lower heap: ${title}`, 'Sift with larger values above smaller ones.', view(), [['Sift indices', active.join(', ')]]);
    high.report = (title, active) => r.add(`Upper heap: ${title}`, 'Sift with smaller values above larger ones.', view(), [['Sift indices', active.join(', ')]]);
    r.add('Two empty halves', 'Keep the extra odd element in the lower heap.', view());
    for (const value of values) {
      if (!low.items.length || value <= low.items[0]) low.push(value);
      else high.push(value);
      r.add('Classify the arrival', `${value} enters the half chosen by the lower maximum.`, view());
      if (low.items.length > high.items.length + 1) high.push(low.pop());
      if (high.items.length > low.items.length) low.push(high.pop());
      const median = low.items.length > high.items.length ? low.items[0] : (low.items[0] + high.items[0]) / 2;
      medians.push(median);
      r.add('Read the balanced boundaries', 'Equal sizes: average roots. Otherwise: lower root.', view(),
        [['Lower size', low.items.length], ['Upper size', high.items.length], ['Median', median]]);
    }
    return r.finish('Each prefix median was computed after restoring both invariants.', view(), `Medians: ${listResult(medians)}`);
  },
  quiz: quiz('When heap sizes are equal, where is the median?', ['Lower minimum', 'Upper maximum', 'Average of the two roots', 'Newest value'], 2, 'The roots are the two middle order statistics.'),
  challenge: challenge('What are the running medians of 8,2,6?', '8, 5, 6', 'For an even prefix average the middle pair.', 'The prefixes sort to [8], [2,8], and [2,6,8].'),
}, `
Insert value into lower max-heap or upper min-heap
Move a boundary root if sizes differ too much
If sizes equal: average roots
Otherwise: median is lower root
`, heapJavaScript + `
function runningMedians(values) {
  const low = new Heap((a,b) => a>b), high = new Heap(), out = [];
  for (const x of values) {
    (!low.a.length || x <= low.a[0] ? low : high).push(x);
    if (low.a.length > high.a.length+1) high.push(low.pop());
    if (high.a.length > low.a.length) low.push(high.pop());
    out.push(low.a.length > high.a.length ? low.a[0] : (low.a[0]+high.a[0])/2);
  }
  return out;
}
`, `
import heapq
def running_medians(values):
    low, high, out = [], [], []
    for x in values:
        if not low or x <= -low[0]:
            heapq.heappush(low, -x)
        else:
            heapq.heappush(high, x)
        if len(low) > len(high) + 1:
            heapq.heappush(high, -heapq.heappop(low))
        if len(high) > len(low):
            heapq.heappush(low, -heapq.heappop(high))
        out.append(-low[0] if len(low) > len(high) else (-low[0] + high[0]) / 2)
    return out
`);

topics['heap-sort'] = lesson({
  intro: 'Heapsort builds a max-heap in the same array, then repeatedly swaps the root maximum into the last unsorted position. Shrink the heap boundary and sift the replacement root down without touching the sorted suffix. The final array is ascending.',
  invariant: 'The prefix before the heap boundary is a max-heap; the suffix is ascending and every suffix element is at least every remaining prefix element.',
  takeaway: 'Heapsort guarantees O(n log n) worst-case time with constant algorithmic auxiliary space, but swapping distant equal keys makes it unstable.',
  complexity: { time: 'O(n) heapify plus O(n log n) extraction, worst case for arbitrary comparable keys.', space: 'O(1) auxiliary in-place sorting; the trace clones the input and records frames.' },
  examples: [
    { label: 'Mixed ordering', input: { values: [4, 1, 3, 2] }, expected: 'Sorted: 1, 2, 3, 4' },
    { label: 'Duplicates and negative keys', input: { values: [2, -1, 2, 0] }, expected: 'Sorted: -1, 0, 2, 2' },
  ],
  trace({ values }) {
    const r = recorder(), h = new Heap((a, b) => a > b); let end = values.length;
    const view = active => arrayView(h.items, active, { labels: h.items.map((_, i) => i < end ? 'heap' : 'sorted') });
    h.items = [...values];
    h.report = (title, active) => r.add(title, 'Only indices before the heap boundary may be sifted.', view(active), [['Heap size', end]]);
    r.add('Input before max-heapify', 'The root maximum will fill the sorted suffix from right to left.', view([]));
    h.build(values);
    for (end = h.items.length; end > 1;) {
      h.swap(0, end - 1); end--;
      r.add('Freeze the maximum in the suffix', `Index ${end} now holds its final value ${h.items[end]}.`, view([end]), [['Heap size', end]]);
      h.down(0, end);
    }
    end = 0;
    return r.finish('No unsorted prefix remains.', view([]), `Sorted: ${listResult(h.items)}`);
  },
  quiz: quiz('Which heap produces ascending in-place heapsort by suffix extraction?', ['Min-heap', 'Max-heap', 'Either without changes', 'No heap'], 1, 'The largest value belongs at the rightmost remaining position.'),
  challenge: challenge('After max-heapifying [2,1,3], which value is frozen first?', '3', 'Extract the maximum to the last position.', 'The root maximum 3 moves to index 2.'),
}, `
Build a max-heap bottom-up
For end from n−1 down to 1:
  swap root with array[end]
  sift root down within [0,end)
`, heapJavaScript + `
function heapSort(a) {
  const h = new Heap((x,y) => x>y); h.a = a;
  for (let i = Math.floor(a.length/2)-1; i >= 0; i--) h.down(i);
  for (let end = a.length-1; end > 0; end--) {
    [a[0],a[end]] = [a[end],a[0]]; h.down(0, end);
  }
  return a;
}
`, `
def heap_sort(a):
    def down(i, end):
        while 2*i + 1 < end:
            child = 2*i + 1
            if child + 1 < end and a[child+1] > a[child]:
                child += 1
            if a[i] >= a[child]:
                break
            a[i], a[child] = a[child], a[i]
            i = child
    for i in range(len(a)//2 - 1, -1, -1):
        down(i, len(a))
    for end in range(len(a)-1, 0, -1):
        a[0], a[end] = a[end], a[0]
        down(0, end)
    return a
`);

function graphData(input, forceDirected = undefined) {
  const nodes = input.nodes.map(String), directed = forceDirected ?? input.directed ?? false;
  if (new Set(nodes).size !== nodes.length) throw new Error('Graph node ids must be unique');
  const adj = new Map(nodes.map(id => [id, []]));
  const edges = input.edges.map(([u, v, w = 1], index) => {
    u = String(u); v = String(v);
    if (!adj.has(u) || !adj.has(v)) throw new Error('Edge endpoint missing from nodes');
    adj.get(u).push({ to: v, weight: w, index });
    if (!directed) adj.get(v).push({ to: u, weight: w, index });
    return { from: u, to: v, weight: w, index };
  });
  return { nodes, edges, adj, directed };
}
function graphView(g, active = [], extra = {}) {
  return { kind: 'graph', nodes: g.nodes.map(id => ({ id, label: id })),
    edges: g.edges.map(e => ({ from: e.from, to: e.to, label: String(e.weight) })),
    active, directed: g.directed, ...extra };
}
const componentsResult = groups => groups.map(group => [...group].sort().join(', ')).join(' | ') || '(empty)';
function requireStart(g, start) {
  start = String(start);
  if (!g.adj.has(start)) throw new Error('Start vertex missing from nodes');
  return start;
}
const adjacencyJavaScript = `
function adjacency(nodes, edges, directed = false) {
  const adj = new Map(nodes.map(v => [v, []]));
  for (const [u,v] of edges) {
    adj.get(u).push(v);
    if (!directed) adj.get(v).push(u);
  }
  return adj;
}
`;

topics['graph-representation'] = lesson({
  intro: 'A graph can store neighbors as adjacency lists or possible connections as a matrix. Lists expose only present edges; a matrix makes every possible pair explicit. Build both for the same simple graph, adding reverse entries only when edges are undirected.',
  invariant: 'For each inserted edge u→v, v is in u’s list and matrix[u][v] is one; undirected input also records v→u.',
  takeaway: 'Lists take O(V+E) space and support sparse neighbor scans; a matrix takes O(V²) space but gives constant-time edge membership. Zero here means absent, not a zero-weight edge.',
  complexity: { time: 'O(V²+E) to allocate this matrix and fill both representations of a simple graph.', space: 'O(V²) matrix plus O(V+E) adjacency lists; undirected edges appear twice in lists.' },
  examples: [
    { label: 'Undirected path with an isolate', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['B', 'C']], directed: false }, expected: 'Adjacency: A:[B]; B:[A,C]; C:[B]; D:[]' },
    { label: 'Directed links are one-way', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B'], ['C', 'A']], directed: true }, expected: 'Adjacency: A:[B]; B:[]; C:[A]' },
  ],
  trace(input) {
    const g = graphData(input), r = recorder(), matrix = g.nodes.map(() => g.nodes.map(() => 0));
    const adj = new Map(g.nodes.map(v => [v, []])), indices = new Map(g.nodes.map((v, i) => [v, i]));
    r.add('Vertices and edge directions', 'The same connections will be recorded in two representations.', graphView(g));
    for (const e of g.edges) {
      const u = indices.get(e.from), v = indices.get(e.to);
      adj.get(e.from).push(e.to); matrix[u][v] = 1;
      if (!g.directed) { adj.get(e.to).push(e.from); matrix[v][u] = 1; }
      r.add('Record an edge', `${e.from}${g.directed ? '→' : '↔'}${e.to}: list insertion and matrix cell marking.`,
        gridView(matrix, g.directed ? [[u, v]] : [[u, v], [v, u]], { labels: g.nodes }),
        [['Neighbors', g.nodes.map(n => `${n}:[${adj.get(n).join(',')}]`).join('; ')]]);
    }
    const output = g.nodes.map(n => `${n}:[${adj.get(n).join(',')}]`).join('; ');
    return r.finish('Isolated vertices still have an empty list and an all-zero matrix row.',
      gridView(matrix, [], { labels: g.nodes }), `Adjacency: ${output || '(empty)'}`);
  },
  quiz: quiz('Which representation uses O(V²) memory even for a sparse graph?', ['Adjacency list', 'Edge list', 'Adjacency matrix', 'DFS stack'], 2, 'The matrix reserves a cell for every ordered vertex pair.'),
  challenge: challenge('For an undirected edge A—B, which matrix entries become one?', 'A,B and B,A', 'Undirected means both directions.', 'Both symmetric cells record the same connection.'),
}, `
Allocate one neighbor list per vertex and a V×V zero matrix
For each edge u→v: append v to list[u]; set matrix[u][v]=1
If undirected: also append u to list[v] and mark matrix[v][u]
`, adjacencyJavaScript + `
function representations(nodes, edges, directed) {
  const adj = adjacency(nodes, edges, directed);
  const index = new Map(nodes.map((v,i) => [v,i]));
  const matrix = nodes.map(() => nodes.map(() => 0));
  for (const [u, neighbors] of adj)
    for (const v of neighbors) matrix[index.get(u)][index.get(v)] = 1;
  return { adj, matrix };
}
`, `
def representations(nodes, edges, directed=False):
    index = {v: i for i, v in enumerate(nodes)}
    adj = {v: [] for v in nodes}
    matrix = [[0] * len(nodes) for _ in nodes]
    for u, v in edges:
        adj[u].append(v)
        matrix[index[u]][index[v]] = 1
        if not directed:
            adj[v].append(u)
            matrix[index[v]][index[u]] = 1
    return adj, matrix
`);

topics['breadth-first-search'] = lesson({
  intro: 'Breadth-first search expands an unweighted graph one distance layer at a time. Discover neighbors when enqueuing them, assign distance parent+1, and remove work from the front. Marking on enqueue prevents several parents from scheduling the same vertex.',
  invariant: 'The queue contains discovered, unexpanded vertices in nondecreasing distance order; the first distance assigned to a vertex is its minimum edge count from the source.',
  takeaway: 'FIFO distinguishes BFS from DFS. Unreachable vertices retain infinity, and weighted shortest paths need a different algorithm.',
  complexity: { time: 'O(V+E) with adjacency lists and a queue head index; edges have equal cost.', space: 'O(V) distances, discovered set, and queue.' },
  examples: [
    { label: 'Two equal-length routes', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']], start: 'A' }, expected: 'BFS: A, B, C, D; distances: A=0, B=1, C=1, D=2' },
    { label: 'Unreachable component', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B']], start: 'B' }, expected: 'BFS: B, A; distances: A=1, B=0, C=∞' },
  ],
  trace(input) {
    const g = graphData(input), start = requireStart(g, input.start), r = recorder();
    const distance = new Map(g.nodes.map(v => [v, Infinity])), queue = [], order = [];
    r.add('Unweighted source search', 'Every edge contributes one step; undiscovered distances begin at infinity.', graphView(g, [start]));
    distance.set(start, 0); queue.push(start); let head = 0;
    r.add('Enqueue source', 'The source is discovered at distance zero.', { kind: 'queue', values: queue.slice(head), active: [0] });
    while (head < queue.length) {
      const u = queue[head++]; order.push(u);
      r.add('Dequeue oldest frontier vertex', `Expand ${u} at distance ${distance.get(u)}.`, graphView(g, [u]), [['Queue', listResult(queue.slice(head))]]);
      for (const { to: v } of g.adj.get(u)) if (distance.get(v) === Infinity) {
        distance.set(v, distance.get(u) + 1); queue.push(v);
        r.add('Discover and enqueue neighbor', `${v} gets distance ${distance.get(v)} via ${u}; it will not be enqueued again.`,
          { kind: 'queue', values: queue.slice(head), active: [queue.length - head - 1] }, [['Expanded', listResult(order)]]);
      }
    }
    const distances = g.nodes.map(v => `${v}=${display(distance.get(v))}`).join(', ');
    return r.finish('Only vertices reachable from the source have finite edge-count distances.', graphView(g, order),
      `BFS: ${listResult(order)}; distances: ${distances}`);
  },
  quiz: quiz('When should BFS mark a vertex discovered?', ['When enqueued', 'After all its neighbors finish', 'Only at the end', 'Never'], 0, 'Marking on enqueue prevents duplicate scheduling and fixes the shortest unweighted distance.'),
  challenge: challenge('A—B—C is a path. What is the BFS distance from A to C?', '2', 'Count edges, not vertices.', 'The route crosses A—B and B—C.'),
}, `
Set source distance to 0 and enqueue it
While queue nonempty:
  dequeue u from front
  for each undiscovered neighbor v:
    distance[v]=distance[u]+1; enqueue v
`, adjacencyJavaScript + `
function bfs(adj, start) {
  const distance = new Map([[start,0]]), queue = [start], order = [];
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head]; order.push(u);
    for (const v of adj.get(u)) if (!distance.has(v)) {
      distance.set(v, distance.get(u)+1); queue.push(v);
    }
  }
  return { order, distance };
}
`, `
from collections import deque
def bfs(adj, start):
    distance, queue, order = {start: 0}, deque([start]), []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            if v not in distance:
                distance[v] = distance[u] + 1
                queue.append(v)
    return order, distance
`);

topics['depth-first-search'] = lesson({
  intro: 'Iterative depth-first search uses a LIFO stack to pursue the most recently scheduled branch. Push neighbors in reverse adjacency order so the first listed neighbor is visited next. Mark on pop and skip stale entries: cross-edges may schedule a vertex more than once before its first visit.',
  invariant: 'Each vertex is expanded only on its first pop; the stack holds pending branch choices, and pushing reversed neighbors preserves the desired first-neighbor-first order.',
  takeaway: 'DFS explores depth rather than shortest-distance layers. A pending duplicate is safe only when it is checked before expansion.',
  complexity: { time: 'O(V+E) adjacency-list traversal, including stale stack entries.', space: 'O(V+E) for this mark-on-pop stack variant, plus O(V) visited/output; recursion-style stacks can use O(V).' },
  examples: [
    { label: 'Deep branch before sibling', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['A', 'C'], ['B', 'D']], start: 'A' }, expected: 'DFS: A, B, D, C' },
    { label: 'Cycle does not repeat visits', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']], start: 'B' }, expected: 'DFS: B, A, C' },
  ],
  trace(input) {
    const g = graphData(input), start = requireStart(g, input.start), r = recorder(), seen = new Set(), stack = [start], order = [];
    r.add('A stack, not a queue', 'The top is the rightmost pending vertex.', graphView(g, [start]));
    r.add('Push source', 'Pop the most recently scheduled branch next.', { kind: 'stack', values: stack, active: [0] });
    while (stack.length) {
      const u = stack.pop();
      if (seen.has(u)) {
        r.add('Skip a stale stack entry', `${u} has already been expanded.`, { kind: 'stack', values: stack, active: [] }); continue;
      }
      seen.add(u); order.push(u);
      r.add('Visit popped vertex', `Expand ${u} exactly once.`, graphView(g, [u]), [['Order', listResult(order)]]);
      for (const { to: v } of [...g.adj.get(u)].reverse()) if (!seen.has(v)) {
        stack.push(v);
        r.add('Push a pending branch', `Schedule ${v}; reverse neighbor insertion makes the first neighbor pop first.`,
          { kind: 'stack', values: stack, active: [stack.length - 1] });
      }
    }
    return r.finish('The reachable component is complete; isolated vertices were not visited.', graphView(g, order), `DFS: ${listResult(order)}`);
  },
  quiz: quiz('What causes DFS to follow the newest pending branch?', ['FIFO queue', 'LIFO stack', 'Sorted distance table', 'Indegree count'], 1, 'LIFO removes the most recently pushed vertex first.'),
  challenge: challenge('A lists neighbors B,C and B leads to D. Give DFS from A.', 'A, B, D, C', 'Push C before B onto the stack.', 'B pops first and its descendant D is explored before C.'),
}, `
Push source onto stack
While stack nonempty:
  pop u; skip if already visited
  mark and emit u
  push unvisited neighbors in reverse order
`, adjacencyJavaScript + `
function dfs(adj, start) {
  const seen = new Set(), stack = [start], order = [];
  while (stack.length) {
    const u = stack.pop();
    if (seen.has(u)) continue;
    seen.add(u); order.push(u);
    for (const v of [...adj.get(u)].reverse()) if (!seen.has(v)) stack.push(v);
  }
  return order;
}
`, `
def dfs(adj, start):
    seen, stack, order = set(), [start], []
    while stack:
        u = stack.pop()
        if u in seen:
            continue
        seen.add(u)
        order.append(u)
        for v in reversed(adj[u]):
            if v not in seen:
                stack.append(v)
    return order
`);

topics['connected-components'] = lesson({
  intro: 'An undirected graph may have several islands. Scan all vertices; each still-unvisited vertex seeds a new flood fill. Mark on discovery, finish that entire reachable island, and then resume the outer scan. Isolated vertices are components of size one.',
  invariant: 'Each flood fill assigns exactly the vertices reachable from its seed; completed components are disjoint and never revisited.',
  takeaway: 'A single BFS cannot enumerate a disconnected graph. This lesson uses undirected connectivity; directed mutual reachability needs strongly connected components.',
  complexity: { time: 'O(V+E) with adjacency lists; outer scanning does not repeat completed traversals.', space: 'O(V) visited set, queue, and component output.' },
  examples: [
    { label: 'Two islands and an isolate', input: { nodes: ['A', 'B', 'C', 'D', 'E'], edges: [['A', 'B'], ['C', 'D']] }, expected: 'Components (3): A, B | C, D | E' },
    { label: 'One component despite a cycle', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] }, expected: 'Components (1): A, B, C' },
  ],
  trace(input) {
    const g = graphData(input, false), r = recorder(), seen = new Set(), groups = [];
    r.add('Scan every vertex', 'An unvisited seed identifies a previously undiscovered island.', graphView(g));
    for (const seed of g.nodes) if (!seen.has(seed)) {
      const queue = [seed], group = []; seen.add(seed); groups.push(group);
      r.add('Start another component', `Seed ${seed} starts component ${groups.length}.`, graphView(g, [seed]));
      for (let head = 0; head < queue.length; head++) {
        const u = queue[head]; group.push(u);
        for (const { to: v } of g.adj.get(u)) if (!seen.has(v)) { seen.add(v); queue.push(v); }
        r.add('Flood the current island', `All neighbors of ${u} are examined.`, graphView(g, group),
          [['Component', groups.length], ['Queue', listResult(queue.slice(head + 1))]]);
      }
    }
    return r.finish('Every vertex belongs to exactly one undirected component.', graphView(g, [...seen]),
      `Components (${groups.length}): ${componentsResult(groups)}`);
  },
  quiz: quiz('How many components does an isolated vertex contribute?', ['Zero', 'One', 'Two', 'Depends on its label'], 1, 'A vertex is reachable from itself even without edges.'),
  challenge: challenge('Vertices A,B,C,D have only edges A—B and B—C. How many components?', '2', 'Do not forget D.', 'A,B,C form one island; D forms another.'),
}, `
For each unvisited vertex:
  create a new component
  flood-fill all reachable neighbors, marking on enqueue
  append the completed component
`, adjacencyJavaScript + `
function components(adj) {
  const seen = new Set(), groups = [];
  for (const seed of adj.keys()) if (!seen.has(seed)) {
    const q = [seed], group = []; seen.add(seed);
    for (let i = 0; i < q.length; i++) {
      const u = q[i]; group.push(u);
      for (const v of adj.get(u)) if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
    groups.push(group);
  }
  return groups;
}
`, `
from collections import deque
def components(adj):
    seen, groups = set(), []
    for seed in adj:
        if seed in seen:
            continue
        seen.add(seed)
        queue, group = deque([seed]), []
        while queue:
            u = queue.popleft()
            group.append(u)
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    queue.append(v)
        groups.append(group)
    return groups
`);

const distanceResult = (g, d) => g.nodes.map(v => `${v}=${display(d.get(v))}`).join(', ');
const weightedAdjacencyJavaScript = `
function weightedAdjacency(nodes, edges, directed = true) {
  const adj = new Map(nodes.map(v => [v,[]]));
  for (const [u,v,w] of edges) {
    adj.get(u).push([v,w]);
    if (!directed) adj.get(v).push([u,w]);
  }
  return adj;
}
`;

topics['shortest-paths'] = lesson({
  intro: 'Dijkstra’s algorithm solves single-source shortest paths when every edge weight is nonnegative. Repeatedly settle the unvisited vertex with the smallest tentative distance, then relax its outgoing edges. This version scans a distance table, making the greedy choice visible without hiding it inside a priority queue.',
  invariant: 'Every settled distance is final; each tentative distance is the cost of an actual discovered path, and the smallest tentative vertex can be settled safely because edges are nonnegative.',
  takeaway: 'Fewest edges and least total weight are different goals. Negative weights invalidate the greedy settling proof; use Bellman–Ford instead. Unreachable vertices remain infinity.',
  complexity: { time: 'O(V²+E) with linear minimum selection and adjacency lists; assumes nonnegative finite weights.', space: 'O(V) distance, predecessor, and settled tables beyond O(V+E) graph storage.' },
  examples: [
    { label: 'An indirect route is cheaper', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', 7], ['A', 'C', 2], ['C', 'B', 1], ['B', 'D', 2], ['C', 'D', 8]], start: 'A', directed: true }, expected: 'Distances: A=0, B=3, C=2, D=5' },
    { label: 'Zero weight and unreachable vertex', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B', 0]], start: 'A', directed: true }, expected: 'Distances: A=0, B=0, C=∞' },
  ],
  trace(input) {
    const g = graphData(input, input.directed ?? true), start = requireStart(g, input.start), r = recorder();
    if (g.edges.some(e => e.weight < 0 || !Number.isFinite(e.weight))) throw new RangeError('Dijkstra requires finite nonnegative weights');
    const d = new Map(g.nodes.map(v => [v, Infinity])), settled = new Set(), parent = new Map();
    r.add('Tentative distances begin unknown', 'Only the source has a known zero-cost path.', graphView(g, [start]));
    d.set(start, 0);
    r.add('Initialize the source distance', `${start} is reachable at cost zero.`, arrayView(g.nodes.map(v => display(d.get(v))), [], { labels: g.nodes }));
    while (settled.size < g.nodes.length) {
      let u = null;
      for (const v of g.nodes) if (!settled.has(v) && (u === null || d.get(v) < d.get(u))) u = v;
      if (u === null || d.get(u) === Infinity) break;
      settled.add(u);
      r.add('Settle the minimum tentative vertex', `${u} has final distance ${d.get(u)}.`, graphView(g, [u]),
        [['Distances', distanceResult(g, d)], ['Settled', listResult([...settled])]]);
      for (const { to: v, weight } of g.adj.get(u)) {
        if (settled.has(v)) continue;
        const candidate = d.get(u) + weight, improves = candidate < d.get(v);
        if (improves) { d.set(v, candidate); parent.set(v, u); }
        r.add(improves ? 'Relax a cheaper route' : 'Keep the existing route',
          `Via ${u}, cost to ${v} is ${candidate}; ${improves ? 'replace the tentative distance' : 'no improvement'}.`,
          graphView(g, [u, v]), [['Distances', distanceResult(g, d)], ['Predecessor', parent.get(v) ?? 'none']]);
      }
    }
    return r.finish('No unsettled finite distance remains; all reachable minima are final.', graphView(g, [...settled]), `Distances: ${distanceResult(g, d)}`);
  },
  quiz: quiz('Why can Dijkstra permanently settle its smallest tentative distance?', ['All weights are nonnegative', 'All graphs are trees', 'It visits alphabetically', 'Every edge has weight one'], 0, 'A later route through an unsettled vertex cannot become cheaper by adding nonnegative edges.'),
  challenge: challenge('A→B costs 6, A→C costs 2, C→B costs 1. Find distance A to B.', '3', 'Compare the direct and indirect route.', 'The route A→C→B costs 2+1=3, less than 6.'),
}, `
Reject negative weights; distance[source]=0, others=infinity
Repeatedly choose the smallest unsettled finite distance
Settle that vertex
Relax each outgoing edge if distance[u]+weight < distance[v]
`, weightedAdjacencyJavaScript + `
function dijkstra(adj, start) {
  for (const edges of adj.values()) for (const [,w] of edges)
    if (w < 0 || !Number.isFinite(w)) throw new RangeError('nonnegative weights required');
  const d = new Map([...adj.keys()].map(v => [v,Infinity])), done = new Set();
  d.set(start,0);
  while (done.size < adj.size) {
    let u = null;
    for (const v of adj.keys()) if (!done.has(v) && (u === null || d.get(v)<d.get(u))) u=v;
    if (u === null || d.get(u) === Infinity) break;
    done.add(u);
    for (const [v,w] of adj.get(u)) if (!done.has(v))
      d.set(v,Math.min(d.get(v),d.get(u)+w));
  }
  return d;
}
`, `
def dijkstra(adj, start):
    if any(w < 0 or w == float("inf") for edges in adj.values() for _, w in edges):
        raise ValueError("finite nonnegative weights required")
    d, done = dict.fromkeys(adj, float("inf")), set()
    d[start] = 0
    while len(done) < len(adj):
        u = min((v for v in adj if v not in done), key=d.get)
        if d[u] == float("inf"):
            break
        done.add(u)
        for v, w in adj[u]:
            if v not in done:
                d[v] = min(d[v], d[u] + w)
    return d
`);

topics['bellman-ford'] = lesson({
  intro: 'Bellman–Ford permits negative directed edges by repeatedly relaxing every edge instead of settling vertices greedily. After V−1 passes all finite shortest simple paths have been covered. One more improving edge reachable from the source proves a reachable negative cycle, where path cost can decrease without bound.',
  invariant: 'Each finite distance is the cost of a discovered source walk; after pass i it is no greater than the best source path with at most i edges, even if in-place updates propagate farther.',
  takeaway: 'Negative edges alone are safe; reachable negative cycles are not. Unreachable cycles do not invalidate distances from this source. A pass with no updates permits early stopping.',
  complexity: { time: 'O(VE) worst case, including a final reachable-negative-cycle check; directed finite weights.', space: 'O(V) distance/predecessor tables beyond the edge list.' },
  examples: [
    { label: 'A useful negative edge', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', 4], ['A', 'C', 5], ['B', 'C', -2], ['C', 'D', 3]], start: 'A' }, expected: 'Distances: A=0, B=4, C=2, D=5' },
    { label: 'Reachable negative cycle', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B', 1], ['B', 'C', -2], ['C', 'B', -1]], start: 'A' }, expected: 'Reachable negative cycle: yes' },
  ],
  trace(input) {
    const g = graphData(input, true), start = requireStart(g, input.start), r = recorder(), d = new Map(g.nodes.map(v => [v, Infinity]));
    if (g.edges.some(e => !Number.isFinite(e.weight))) throw new RangeError('Finite weights required');
    d.set(start, 0);
    r.add('Allow negative edges', 'Source distance is zero; never relax outward from infinity.', graphView(g, [start]), [['Distances', distanceResult(g, d)]]);
    for (let pass = 1; pass < g.nodes.length; pass++) {
      let changed = false;
      for (const e of g.edges) {
        if (d.get(e.from) === Infinity) continue;
        const candidate = d.get(e.from) + e.weight;
        if (candidate < d.get(e.to)) {
          const old = d.get(e.to); d.set(e.to, candidate); changed = true;
          r.add('Relax a directed edge', `Pass ${pass}: ${e.from}→${e.to} improves ${display(old)} to ${candidate}.`,
            graphView(g, [e.from, e.to]), [['Pass', pass], ['Distances', distanceResult(g, d)]]);
        }
      }
      r.add('Finish a whole edge pass', changed ? 'Some path costs improved; another pass may propagate them.' : 'No update: all edge inequalities are satisfied.',
        arrayView(g.nodes.map(v => display(d.get(v))), [], { labels: g.nodes }), [['Pass', pass], ['Changed', changed ? 'yes' : 'no']]);
      if (!changed) break;
    }
    const witness = g.edges.find(e => d.get(e.from) !== Infinity && d.get(e.from) + e.weight < d.get(e.to));
    r.add('Check one extra relaxation pass', witness ? `${witness.from}→${witness.to} can still improve: a reachable negative cycle exists.` : 'No reachable edge can improve after the allowed passes.',
      graphView(g, witness ? [witness.from, witness.to] : []));
    return r.finish(witness ? 'Do not label these decreasing estimates as finite shortest distances.' : 'All reachable finite shortest-path distances are established.',
      graphView(g), witness ? 'Reachable negative cycle: yes' : `Distances: ${distanceResult(g, d)}`);
  },
  quiz: quiz('What does an improvement after V−1 complete passes prove?', ['Any negative edge exists', 'A source-reachable negative cycle exists', 'The graph is a DAG', 'The source is isolated'], 1, 'A simple path has at most V−1 edges; further strict improvement needs a beneficial repeated cycle.'),
  challenge: challenge('A→B costs 3, B→C costs −5, A→C costs 1. Find distance A to C.', '-2', 'Negative edges are allowed if there is no negative cycle.', 'The route through B costs 3−5=−2.'),
}, `
distance[source]=0; others=infinity
Repeat V−1 times:
  relax all edges from finite-distance sources
  stop early if nothing changes
If any reachable edge can still improve: report negative cycle
`, `
function bellmanFord(nodes, edges, start) {
  const d = new Map(nodes.map(v => [v,Infinity])); d.set(start,0);
  for (let pass=1; pass<nodes.length; pass++) {
    let changed=false;
    for (const [u,v,w] of edges) if (d.get(u)!==Infinity && d.get(u)+w<d.get(v)) {
      d.set(v,d.get(u)+w); changed=true;
    }
    if (!changed) break;
  }
  const negativeCycle=edges.some(([u,v,w]) => d.get(u)!==Infinity && d.get(u)+w<d.get(v));
  return { distance: d, negativeCycle };
}
`, `
def bellman_ford(nodes, edges, start):
    d = dict.fromkeys(nodes, float("inf"))
    d[start] = 0
    for _ in range(len(nodes) - 1):
        changed = False
        for u, v, w in edges:
            if d[u] != float("inf") and d[u] + w < d[v]:
                d[v] = d[u] + w
                changed = True
        if not changed:
            break
    cycle = any(d[u] != float("inf") and d[u] + w < d[v] for u, v, w in edges)
    return d, cycle
`);

topics['floyd-warshall'] = lesson({
  intro: 'Floyd–Warshall computes all-pairs distances by gradually allowing more intermediate vertices. Start with direct edges and zero-length diagonal paths; for each intermediate k, compare the current i→j route with i→k→j. Keeping k as the outer loop is what makes the dynamic-programming stages meaningful.',
  invariant: 'After stage k, each table entry is the best path using only processed vertices as intermediates, provided no negative cycle exists.',
  takeaway: 'Infinity must stay unreachable unless both halves of a route exist. Negative edges are supported; a negative diagonal detects a negative cycle, in which case ordinary finite all-pairs distances are not valid.',
  complexity: { time: 'O(V³) triple loop regardless of sparsity; O(E) initialization for directed finite weights.', space: 'O(V²) distance table, updated in place.' },
  examples: [
    { label: 'Negative edge without a cycle', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B', 3], ['B', 'C', -2], ['A', 'C', 8]] }, expected: 'Distances: 0, 3, 1 | ∞, 0, -2 | ∞, ∞, 0' },
    { label: 'Bidirectional reachability with an isolate', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B', 4], ['B', 'A', 2]] }, expected: 'Distances: 0, 4, ∞ | 2, 0, ∞ | ∞, ∞, 0' },
  ],
  trace(input) {
    const g = graphData(input, true), r = recorder(), n = g.nodes.length, index = new Map(g.nodes.map((v, i) => [v, i]));
    if (g.edges.some(e => !Number.isFinite(e.weight))) throw new RangeError('Finite weights required');
    const d = g.nodes.map((_, i) => g.nodes.map((__, j) => i === j ? 0 : Infinity));
    const view = active => gridView(d.map(row => row.map(display)), active, { labels: g.nodes });
    r.add('Only empty diagonal paths are known', 'Zero on the diagonal; infinity for every absent route.', view([]));
    for (const e of g.edges) {
      const i = index.get(e.from), j = index.get(e.to);
      d[i][j] = Math.min(d[i][j], e.weight);
      r.add('Initialize a direct edge', `${e.from}→${e.to}: keep the minimum direct weight, including parallel edges.`, view([[i, j]]));
    }
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (d[i][k] === Infinity || d[k][j] === Infinity) continue;
        const candidate = d[i][k] + d[k][j];
        if (candidate < d[i][j]) {
          const old = d[i][j]; d[i][j] = candidate;
          r.add('Improve through the allowed intermediate', `${g.nodes[i]}→${g.nodes[k]}→${g.nodes[j]} costs ${candidate}, replacing ${display(old)}.`,
            view([[i, k], [k, j], [i, j]]), [['Intermediate', g.nodes[k]]]);
        }
      }
      r.add('Complete an intermediate stage', `Paths may now use ${g.nodes.slice(0, k + 1).join(', ')} internally.`, view([[k, k]]));
    }
    const negative = d.some((row, i) => row[i] < 0);
    const output = d.map(row => row.map(display).join(', ')).join(' | ') || '(empty)';
    return r.finish(negative ? 'A negative diagonal proves a negative cycle; finite distance claims are withheld.' : 'Every vertex has been considered as a possible intermediate.',
      view([]), negative ? 'Negative cycle: yes' : `Distances: ${output}`);
  },
  quiz: quiz('Which loop must be outermost in the standard Floyd–Warshall recurrence?', ['Source i', 'Destination j', 'Intermediate k', 'Weight w'], 2, 'The allowed-intermediate set must advance one complete stage at a time.'),
  challenge: challenge('If d[A,B]=2 and d[B,C]=3 but d[A,C]=9, what does stage B do?', '5', 'Compare the direct route with the route through B.', '2+3=5 improves the old distance 9.'),
}, `
Initialize diagonal to zero, direct edges to minimum weight, others to infinity
For each intermediate k:
  for every pair i,j with both halves reachable:
    d[i][j]=min(d[i][j], d[i][k]+d[k][j])
Check for a negative diagonal
`, `
function floydWarshall(nodes, edges) {
  const index=new Map(nodes.map((v,i) => [v,i]));
  const d=nodes.map((_,i) => nodes.map((__,j) => i===j ? 0 : Infinity));
  for (const [u,v,w] of edges) {
    const i=index.get(u), j=index.get(v); d[i][j]=Math.min(d[i][j],w);
  }
  for (let k=0; k<nodes.length; k++)
    for (let i=0; i<nodes.length; i++)
      for (let j=0; j<nodes.length; j++)
        if (d[i][k]!==Infinity && d[k][j]!==Infinity)
          d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);
  return { distance: d, negativeCycle: d.some((row,i) => row[i]<0) };
}
`, `
def floyd_warshall(nodes, edges):
    index = {v: i for i, v in enumerate(nodes)}
    n, inf = len(nodes), float("inf")
    d = [[0 if i == j else inf for j in range(n)] for i in range(n)]
    for u, v, w in edges:
        i, j = index[u], index[v]
        d[i][j] = min(d[i][j], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if d[i][k] != inf and d[k][j] != inf:
                    d[i][j] = min(d[i][j], d[i][k] + d[k][j])
    return d, any(d[i][i] < 0 for i in range(n))
`);

class DisjointSet {
  constructor(n, report = () => {}) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = Array(n).fill(0); this.count = n; this.report = report;
  }
  find(x) {
    if (!Number.isInteger(x) || x < 0 || x >= this.parent.length) throw new RangeError('Disjoint-set index outside range');
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (x !== root) {
      const next = this.parent[x];
      if (this.parent[x] !== root) {
        this.parent[x] = root; this.report('Compress a parent path', [x, root]);
      }
      x = next;
    }
    return root;
  }
  union(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) { this.report('Already in one set', [a]); return false; }
    if (this.rank[a] < this.rank[b]) [a, b] = [b, a];
    this.parent[b] = a;
    if (this.rank[a] === this.rank[b]) this.rank[a]++;
    this.count--; this.report('Merge roots by rank', [a, b]); return true;
  }
}
const dsuJavaScript = `
class DSU {
  constructor(n) {
    this.parent=Array.from({length:n},(_,i)=>i); this.rank=Array(n).fill(0); this.count=n;
  }
  find(x) {
    if (this.parent[x]!==x) this.parent[x]=this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a,b) {
    a=this.find(a); b=this.find(b);
    if (a===b) return false;
    if (this.rank[a]<this.rank[b]) [a,b]=[b,a];
    this.parent[b]=a;
    if (this.rank[a]===this.rank[b]) this.rank[a]++;
    this.count--; return true;
  }
}
`;
const dsuPython = `
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.count = n
    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]
    def union(self, a, b):
        a, b = self.find(a), self.find(b)
        if a == b:
            return False
        if self.rank[a] < self.rank[b]:
            a, b = b, a
        self.parent[b] = a
        if self.rank[a] == self.rank[b]:
            self.rank[a] += 1
        self.count -= 1
        return True
`;

topics['union-find'] = lesson({
  intro: 'Union–find tracks a partition of elements under merges. Each set is a parent-pointer tree whose root represents the set. Union by rank attaches the shallower root, and find compresses every traversed pointer directly toward the representative. Connectivity is equality of roots, not equality of immediate parents.',
  invariant: 'Each parent-pointer chain reaches one root, and two elements belong to the same set exactly when find returns the same root; successful unions reduce the set count by one.',
  takeaway: 'Path compression changes representation without changing membership. Rank is a balancing bound, not the current height after compression. Standard union–find does not support arbitrary deletions.',
  complexity: { time: 'O((n+m) α(n)) amortized for initialization and m find/union operations with rank and path compression.', space: 'O(n) parent/rank tables; iterative find uses O(1) auxiliary space.' },
  examples: [
    { label: 'Compress a two-link path', input: { size: 6, unions: [[0, 1], [2, 3], [0, 2], [4, 5]], query: [3, 1] }, expected: 'Components: 2; connected(3, 1): yes' },
    { label: 'Redundant merge does not reduce count', input: { size: 4, unions: [[0, 1], [1, 0], [2, 3]], query: [0, 3] }, expected: 'Components: 2; connected(0, 3): no' },
  ],
  trace({ size, unions, query }) {
    const r = recorder();
    function view(active = []) {
      return { kind: 'tree', nodes: ds.parent.map((_, i) => ({ id: String(i), label: `${i} (r${ds.rank[i]})` })),
        edges: ds.parent.flatMap((p, i) => p === i ? [] : [{ from: String(p), to: String(i) }]),
        active: active.map(String), directed: true };
    }
    const ds = new DisjointSet(size, (title, active) =>
      r.add(title, 'Representatives are roots; compression preserves set membership.', view(active),
        [['Parents', ds.parent.join(', ')], ['Components', ds.count]]));
    r.add('Every element starts separate', 'Each parent initially points to itself and every rank is zero.', view());
    for (const [a, b] of unions) {
      const merged = ds.union(a, b);
      r.add('Union request complete', `union(${a}, ${b}): ${merged ? 'two sets merged' : 'membership already shared'}.`,
        view([a, b]), [['Components', ds.count]]);
    }
    const [a, b] = query, connected = ds.find(a) === ds.find(b);
    r.add('Compare representatives', `Connectivity query find(${a}) == find(${b}) is ${connected}.`, view([a, b]), [['Parents', ds.parent.join(', ')]]);
    return r.finish('Only successful merges changed the number of components.', view(),
      `Components: ${ds.count}; connected(${a}, ${b}): ${connected ? 'yes' : 'no'}`);
  },
  quiz: quiz('Which union reduces the number of sets?', ['Any union call', 'Only a union of distinct roots', 'Only equal-priority roots', 'Only a repeated union'], 1, 'If the representatives already match, the partition is unchanged.'),
  challenge: challenge('Start with five singletons and perform three successful unions. How many sets remain?', '2', 'Each successful union removes one set.', 'Five minus three equals two.'),
}, `
FIND follows parents to a root and compresses the traversed path
UNION finds both roots
If equal: no change
Otherwise attach lower-rank root; increment rank on a tie
Connectivity compares FIND results
`, dsuJavaScript + `
const sets=new DSU(4);
sets.union(0,1); sets.union(2,3);
const connected=sets.find(0)===sets.find(3);
`, dsuPython + `
sets = DSU(4)
sets.union(0, 1)
sets.union(2, 3)
connected = sets.find(0) == sets.find(3)
`);

const edgeResult = edges => edges.map(e => `${e.from}-${e.to}(${e.weight})`).join(', ') || '(empty)';

topics['minimum-spanning-trees'] = lesson({
  intro: 'Kruskal’s algorithm builds a minimum spanning forest of an undirected weighted graph by considering edges globally from cheapest to most expensive. Accept an edge only when its endpoints lie in different union–find sets. Rejected edges would close a cycle; accepted edges safely merge two current trees.',
  invariant: 'Accepted edges form an acyclic forest that can be extended to a minimum spanning forest; union–find components exactly match its connected trees.',
  takeaway: 'An MST minimizes total connecting weight, not source-to-vertex distances. A disconnected graph produces a minimum spanning forest; equal weights may allow several equally optimal answers.',
  complexity: { time: 'O(E log E + (V+E) α(V)) with edge sorting and union–find; undirected finite weights.', space: 'O(V+E) for disjoint sets, sorted edges, and selected forest.' },
  examples: [
    { label: 'Reject a tempting cycle edge', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', 1], ['B', 'C', 2], ['A', 'C', 2.5], ['C', 'D', 3], ['A', 'D', 9]] }, expected: 'Forest weight: 6; edges: A-B(1), B-C(2), C-D(3); components: 1' },
    { label: 'Disconnected forest with negative weight', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', -2], ['C', 'D', 4]] }, expected: 'Forest weight: 2; edges: A-B(-2), C-D(4); components: 2' },
  ],
  trace(input) {
    const g = graphData(input, false), r = recorder(), index = new Map(g.nodes.map((v, i) => [v, i])), ds = new DisjointSet(g.nodes.length), selected = [];
    if (g.edges.some(e => !Number.isFinite(e.weight))) throw new RangeError('Finite weights required');
    const sorted = [...g.edges].sort((a, b) => a.weight - b.weight || a.index - b.index); let weight = 0;
    r.add('Global cheapest-edge strategy', 'Begin with one singleton tree per vertex.', graphView(g), [['Components', ds.count]]);
    r.add('Sort all candidate edges', 'Ties retain input edge order for deterministic selection.',
      arrayView(sorted.map(e => `${e.from}-${e.to}:${e.weight}`)));
    for (const e of sorted) {
      const merged = ds.union(index.get(e.from), index.get(e.to));
      if (merged) { selected.push(e); weight += e.weight; }
      r.add(merged ? 'Accept an edge crossing two trees' : 'Reject a cycle-closing edge',
        `${e.from}-${e.to} weighs ${e.weight}: ${merged ? 'representatives differ' : 'endpoints already share a representative'}.`,
        graphView(g, [e.from, e.to]), [['Selected', edgeResult(selected)], ['Weight', weight], ['Components', ds.count]]);
    }
    return r.finish('The cheapest acyclic connections span each original connected component.',
      graphView({ ...g, edges: selected }), `Forest weight: ${weight}; edges: ${edgeResult(selected)}; components: ${ds.count}`);
  },
  quiz: quiz('What makes Kruskal reject an edge?', ['Its weight is negative', 'Its endpoints are already connected in the chosen forest', 'It touches the source', 'It is not adjacent to the last edge'], 1, 'Adding it inside one current tree would create a cycle.'),
  challenge: challenge('Triangle edges AB=1, BC=2, AC=5. What is the MST weight?', '3', 'Choose cheapest edges without a cycle.', 'AB and BC connect all three vertices with total 1+2=3.'),
}, `
Sort all undirected edges by weight
For each edge (u,v,w):
  if UNION(u,v) succeeds: accept edge and add w
  otherwise reject the cycle
Return the forest and its component count
`, dsuJavaScript + `
function kruskal(nodes, edges) {
  const index=new Map(nodes.map((v,i)=>[v,i])), ds=new DSU(nodes.length);
  const sorted=edges.map((e,i)=>({e,i})).sort((a,b)=>a.e[2]-b.e[2] || a.i-b.i);
  const chosen=[]; let weight=0;
  for (const {e:[u,v,w]} of sorted) if (ds.union(index.get(u),index.get(v))) {
    chosen.push([u,v,w]); weight+=w;
  }
  return { chosen, weight, components: ds.count };
}
`, dsuPython + `
def kruskal(nodes, edges):
    index = {v: i for i, v in enumerate(nodes)}
    ds, chosen, weight = DSU(len(nodes)), [], 0
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        if ds.union(index[u], index[v]):
            chosen.append((u, v, w))
            weight += w
    return chosen, weight, ds.count
`);

topics['prims-algorithm'] = lesson({
  intro: 'Prim’s algorithm grows one connected tree by choosing the cheapest edge crossing from visited vertices to unvisited vertices. Put frontier edges in a min-priority queue, discard stale edges whose destinations were already reached, and add newly exposed frontier edges. Restart from an unvisited seed to cover disconnected input.',
  invariant: 'Every queued candidate was exposed from the visited tree; accepting the cheapest edge to an unvisited endpoint adds one vertex without a cycle and is safe by the cut property.',
  takeaway: 'Prim selects from a local frontier, unlike Kruskal’s global edge scan. Restarting after a frontier empties produces a minimum spanning forest; negative weights are allowed.',
  complexity: { time: 'O(V + E log(E+1)) for lazy frontier heaps, including disconnected components; undirected finite weights.', space: 'O(V+E) visited state, selected edges, and potentially stale frontier candidates.' },
  examples: [
    { label: 'Frontier order differs from global weight order', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', 4], ['A', 'C', 5], ['B', 'C', 1], ['C', 'D', 2], ['B', 'D', 6]] }, expected: 'Prim weight: 7; edges: A-B(4), B-C(1), C-D(2); components: 1' },
    { label: 'Restart for a disconnected island', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', 3], ['C', 'D', -1]] }, expected: 'Prim weight: 2; edges: A-B(3), C-D(-1); components: 2' },
  ],
  trace(input) {
    const g = graphData(input, false), r = recorder(), visited = new Set(), selected = [];
    if (g.edges.some(e => !Number.isFinite(e.weight))) throw new RangeError('Finite weights required');
    let weight = 0, components = 0, sequence = 0;
    r.add('Grow from a vertex frontier', 'Do not sort all graph edges: only exposed crossing candidates compete.', graphView(g));
    for (const seed of g.nodes) if (!visited.has(seed)) {
      components++; visited.add(seed);
      const frontier = new Heap((a, b) => a.weight < b.weight || a.weight === b.weight && a.sequence < b.sequence);
      function expose(u) {
        for (const e of g.adj.get(u)) if (!visited.has(e.to)) {
          frontier.push({ from: u, to: e.to, weight: e.weight, sequence: sequence++ });
          r.add('Expose an outgoing frontier edge', `${u}-${e.to} enters the priority queue.`,
            arrayView(frontier.items.map(x => `${x.from}-${x.to}:${x.weight}`)), [['Visited', listResult([...visited])]]);
        }
      }
      r.add('Seed a new connected tree', `${seed} starts component ${components}.`, graphView(g, [seed])); expose(seed);
      while (frontier.items.length) {
        const e = frontier.pop();
        if (visited.has(e.to)) {
          r.add('Discard a stale frontier edge', `${e.to} was already reached; ${e.from}-${e.to} would not add a vertex.`, graphView(g, [e.from, e.to])); continue;
        }
        visited.add(e.to); selected.push(e); weight += e.weight;
        r.add('Take the cheapest crossing edge', `${e.from}-${e.to} adds ${e.to} at cost ${e.weight}.`, graphView(g, [e.from, e.to]),
          [['Selected', edgeResult(selected)], ['Weight', weight]]);
        expose(e.to);
      }
    }
    return r.finish('Each frontier exhausted one connected component before the next seed began.',
      graphView({ ...g, edges: selected }), `Prim weight: ${weight}; edges: ${edgeResult(selected)}; components: ${components}`);
  },
  quiz: quiz('What edge set does Prim choose its next edge from?', ['All edges regardless of endpoints', 'Edges crossing the current visited/unvisited cut', 'Only edges of weight one', 'Only edges between unvisited vertices'], 1, 'A crossing edge extends the existing tree by one vertex.'),
  challenge: challenge('Starting at A, edges AB=4, AC=5, BC=1: which edges does Prim choose?', 'A-B, B-C', 'BC is not available until B or C joins the tree.', 'First AB is cheapest across the cut; then BC becomes the cheapest crossing edge.'),
}, `
For each unvisited seed:
  mark seed; push its outgoing edges
  repeatedly pop the cheapest frontier edge
  skip if destination already visited
  otherwise accept it, mark destination, expose its outgoing edges
`, heapJavaScript + weightedAdjacencyJavaScript + `
function prim(adj) {
  const seen=new Set(), chosen=[]; let weight=0, components=0, seq=0;
  for (const seed of adj.keys()) if (!seen.has(seed)) {
    components++; seen.add(seed);
    const q=new Heap((a,b)=>a.w<b.w || a.w===b.w && a.seq<b.seq);
    const expose=u => {
      for (const [v,w] of adj.get(u)) if (!seen.has(v)) q.push({u,v,w,seq:seq++});
    };
    expose(seed);
    while (q.a.length) {
      const {u,v,w}=q.pop();
      if (seen.has(v)) continue;
      seen.add(v); chosen.push([u,v,w]); weight+=w; expose(v);
    }
  }
  return { chosen, weight, components };
}
`, `
import heapq
from itertools import count
def prim(adj):
    seen, chosen, weight, components = set(), [], 0, 0
    sequence = count()
    for seed in adj:
        if seed in seen:
            continue
        components += 1
        seen.add(seed)
        frontier = []
        def expose(u):
            for v, w in adj[u]:
                if v not in seen:
                    heapq.heappush(frontier, (w, next(sequence), u, v))
        expose(seed)
        while frontier:
            w, _, u, v = heapq.heappop(frontier)
            if v in seen:
                continue
            seen.add(v)
            chosen.append((u, v, w))
            weight += w
            expose(v)
    return chosen, weight, components
`);

topics['cycle-detection'] = lesson({
  intro: 'A directed DFS distinguishes unvisited, active, and finished vertices. An edge to an active vertex returns to the current recursion path and proves a directed cycle. An edge to a finished vertex may simply join a previously completed path, so it is not enough to prove a cycle.',
  invariant: 'Gray vertices are exactly the current recursion path; black vertices have had every outgoing edge examined without an unfinished descendant.',
  takeaway: 'A visited bit alone cannot distinguish a back-edge from harmless convergence in a directed graph. For undirected graphs, the parent edge needs different handling.',
  complexity: { time: 'O(V+E) using three-color DFS over all directed components.', space: 'O(V) color map and recursion path.' },
  examples: [
    { label: 'Back-edge closes a cycle', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] }, expected: 'Directed cycle: A → B → C → A' },
    { label: 'Converging DAG is not cyclic', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']] }, expected: 'Directed cycle: none' },
  ],
  trace(input) {
    const g = graphData(input, true), r = recorder(), color = new Map(g.nodes.map(v => [v, 0])), path = []; let cycle = null;
    r.add('White, gray, black states', 'Gray means on the active path; black means completely finished.', graphView(g));
    function dfs(u) {
      color.set(u, 1); path.push(u);
      r.add('Enter: mark gray', `${u} joins the active recursion path.`, graphView(g, path), [['Path', path.join(' → ')]]);
      for (const { to: v } of g.adj.get(u)) {
        if (color.get(v) === 1) {
          cycle = [...path.slice(path.indexOf(v)), v];
          r.add('Back-edge proves a cycle', `${u}→${v} returns to an active ancestor.`, graphView(g, cycle), [['Witness', cycle.join(' → ')]]);
          return true;
        }
        if (color.get(v) === 0 && dfs(v)) return true;
        if (color.get(v) === 2) r.add('Finished target is safe', `${u}→${v} is not an active-path back-edge.`, graphView(g, [u, v]));
      }
      path.pop(); color.set(u, 2);
      r.add('Exit: mark black', `All outgoing edges of ${u} are complete.`, graphView(g, path));
      return false;
    }
    for (const u of g.nodes) if (color.get(u) === 0 && dfs(u)) break;
    return r.finish('A reported cycle is a concrete directed closed path.', graphView(g, cycle ?? []), `Directed cycle: ${cycle ? cycle.join(' → ') : 'none'}`);
  },
  quiz: quiz('Which edge proves a directed cycle during DFS?', ['Edge to white', 'Edge to gray', 'Every edge to black', 'Every edge to a visited node'], 1, 'Gray is on the current ancestor path, so the edge closes a loop.'),
  challenge: challenge('A→B, A→C, B→C: does the edge A→C prove a cycle after B finishes?', 'no', 'C can be black rather than gray.', 'Two routes to C are convergence, not a route back to an ancestor.'),
}, `
DFS marks vertex gray on entry and black on exit
For each outgoing edge:
  gray target: report a cycle
  white target: recurse
  black target: no active-path cycle
Run DFS from every remaining white vertex
`, `
function hasDirectedCycle(adj) {
  const color = new Map([...adj.keys()].map(v => [v,0]));
  function dfs(u) {
    color.set(u,1);
    for (const v of adj.get(u)) {
      if (color.get(v) === 1) return true;
      if (color.get(v) === 0 && dfs(v)) return true;
    }
    color.set(u,2); return false;
  }
  for (const u of adj.keys()) if (color.get(u) === 0 && dfs(u)) return true;
  return false;
}
`, `
def has_directed_cycle(adj):
    color = {v: 0 for v in adj}
    def dfs(u):
        color[u] = 1
        for v in adj[u]:
            if color[v] == 1:
                return True
            if color[v] == 0 and dfs(v):
                return True
        color[u] = 2
        return False
    return any(color[u] == 0 and dfs(u) for u in adj)
`);

topics['topological-sort'] = lesson({
  intro: 'Kahn’s algorithm schedules directed dependencies by repeatedly taking a vertex with zero remaining indegree. Removing its outgoing edges may release more ready vertices. If all vertices are emitted, every prerequisite appears before its dependent; otherwise a directed cycle blocks the remainder.',
  invariant: 'Each indegree counts incoming edges from not-yet-emitted vertices; only zero-indegree vertices enter the ready queue.',
  takeaway: 'Topological ordering exists only for DAGs and need not be unique. A partial order emitted before a blockage is not a valid ordering of the entire cyclic graph.',
  complexity: { time: 'O(V+E) indegree construction and FIFO processing with adjacency lists.', space: 'O(V) indegrees, ready queue, and output.' },
  examples: [
    { label: 'Two prerequisites release a task', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'C'], ['B', 'C'], ['C', 'D']] }, expected: 'Order: A, B, C, D' },
    { label: 'A cycle blocks two vertices', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B'], ['B', 'A']] }, expected: 'No topological order; blocked: A, B' },
  ],
  trace(input) {
    const g = graphData(input, true), r = recorder(), indegree = new Map(g.nodes.map(v => [v, 0])), order = [];
    for (const e of g.edges) indegree.set(e.to, indegree.get(e.to) + 1);
    const ready = g.nodes.filter(v => indegree.get(v) === 0); let head = 0;
    r.add('Count incoming prerequisites', 'Queue every initial zero-indegree vertex in input order.', graphView(g),
      [['Indegrees', g.nodes.map(v => `${v}:${indegree.get(v)}`).join(', ')], ['Ready', listResult(ready)]]);
    while (head < ready.length) {
      const u = ready[head++]; order.push(u);
      r.add('Emit a ready vertex', `${u} has no remaining prerequisites.`, { kind: 'queue', values: ready.slice(head), active: [] }, [['Order', listResult(order)]]);
      for (const { to: v } of g.adj.get(u)) {
        indegree.set(v, indegree.get(v) - 1);
        if (indegree.get(v) === 0) ready.push(v);
        r.add('Remove a dependency edge', `${u}→${v} is satisfied; ${v} has ${indegree.get(v)} incoming dependencies left.`,
          graphView(g, [u, v]), [['Ready', listResult(ready.slice(head))]]);
      }
    }
    const blocked = g.nodes.filter(v => indegree.get(v) > 0);
    return r.finish('Compare emitted count with the vertex count before accepting the order.', graphView(g, blocked.length ? blocked : order),
      blocked.length ? `No topological order; blocked: ${listResult(blocked)}` : `Order: ${listResult(order)}`);
  },
  quiz: quiz('What does a nonempty unprocessed remainder mean after Kahn’s queue empties?', ['The whole graph is sorted', 'A cycle exists', 'All edges are undirected', 'The queue must be a stack'], 1, 'Every remaining vertex has a remaining prerequisite; following those edges eventually repeats a vertex.'),
  challenge: challenge('For A→C and B→C, can C be emitted before B?', 'no', 'C needs both incoming edges removed.', 'C remains blocked until both A and B have been emitted.'),
}, `
Count indegrees; queue vertices with indegree zero
Pop ready u and emit it
For each u→v: decrement indegree[v]; enqueue v if it reaches zero
If emitted count < V: reject as cyclic
`, `
function topological(adj) {
  const degree = new Map([...adj.keys()].map(v => [v,0]));
  for (const neighbors of adj.values()) for (const v of neighbors) degree.set(v,degree.get(v)+1);
  const queue = [...adj.keys()].filter(v => degree.get(v) === 0), order = [];
  for (let head=0; head<queue.length; head++) {
    const u=queue[head]; order.push(u);
    for (const v of adj.get(u)) {
      degree.set(v,degree.get(v)-1);
      if (degree.get(v) === 0) queue.push(v);
    }
  }
  return order.length === adj.size ? order : null;
}
`, `
from collections import deque
def topological(adj):
    degree = dict.fromkeys(adj, 0)
    for neighbors in adj.values():
        for v in neighbors:
            degree[v] += 1
    queue, order = deque(v for v in adj if degree[v] == 0), []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            degree[v] -= 1
            if degree[v] == 0:
                queue.append(v)
    return order if len(order) == len(adj) else None
`);

topics['strongly-connected-components'] = lesson({
  intro: 'Strongly connected components group directed vertices that can all reach one another. Kosaraju’s algorithm first records DFS finishing order in the original graph, then traverses the transpose in decreasing finish order. Reversing edges and using the correct order prevents one-way links from merging separate components.',
  invariant: 'The first pass appends a vertex only after its descendants finish; each second-pass flood fill, seeded by decreasing finish time, stays in one unassigned SCC.',
  takeaway: 'Undirected connectivity is insufficient for directed mutual reachability. The transpose and reverse finishing order are both essential.',
  complexity: { time: 'O(V+E) for two DFS passes and edge reversal; presentation sorts component members separately.', space: 'O(V+E) transpose plus O(V) visited, finish order, recursion, and output.' },
  examples: [
    { label: 'Two cycles joined one-way', input: { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['B', 'A'], ['B', 'C'], ['C', 'D'], ['D', 'C']] }, expected: 'SCCs (2): A, B | C, D' },
    { label: 'A directed chain', input: { nodes: ['A', 'B', 'C'], edges: [['A', 'B'], ['B', 'C']] }, expected: 'SCCs (3): A | B | C' },
  ],
  trace(input) {
    const g = graphData(input, true), r = recorder(), seen = new Set(), finish = [], groups = [];
    r.add('First pass on original directions', 'Record exit times, not discovery times.', graphView(g));
    function first(u) {
      seen.add(u);
      r.add('Explore before finishing', `Enter ${u} on the original graph.`, graphView(g, [u]));
      for (const { to: v } of g.adj.get(u)) if (!seen.has(v)) first(v);
      finish.push(u);
      r.add('Append on DFS exit', `${u} finishes after all newly reached descendants.`, graphView(g, [u]), [['Finish order', listResult(finish)]]);
    }
    for (const u of g.nodes) if (!seen.has(u)) first(u);
    const transpose = graphData({ nodes: g.nodes, edges: g.edges.map(e => [e.to, e.from, e.weight]) }, true);
    seen.clear();
    r.add('Reverse all edges', `Second-pass seeds: ${[...finish].reverse().join(', ')}.`, graphView(transpose), [['Decreasing finish order', listResult([...finish].reverse())]]);
    function second(u, group) {
      seen.add(u); group.push(u);
      r.add('Assign on the transpose', `${u} belongs to component ${groups.length}.`, graphView(transpose, group));
      for (const { to: v } of transpose.adj.get(u)) if (!seen.has(v)) second(v, group);
    }
    for (const u of [...finish].reverse()) if (!seen.has(u)) {
      const group = []; groups.push(group); second(u, group);
      r.add('Complete one mutual-reachability group', 'Already assigned vertices are barriers to later flood fills.', graphView(transpose, group));
    }
    return r.finish('Each component has paths in both directions between every pair of its vertices.', graphView(g),
      `SCCs (${groups.length}): ${componentsResult(groups)}`);
  },
  quiz: quiz('Which order seeds Kosaraju’s second pass?', ['Increasing discovery time', 'Increasing finish time', 'Decreasing finish time', 'Alphabetical only'], 2, 'Decreasing finish time together with reversed edges isolates one SCC at a time.'),
  challenge: challenge('A↔B and B→C, with no route back from C: how many SCCs?', '2', 'Mutual reachability, not one-way reachability.', 'A,B are mutually reachable; C forms its own SCC.'),
}, `
DFS original graph, appending each vertex on exit
Reverse every edge to form the transpose
Clear visited
DFS transpose from seeds in reversed finishing order
Each new traversal is one SCC
`, `
function scc(adj) {
  const seen = new Set(), finish = [], groups = [];
  function first(u) {
    seen.add(u);
    for (const v of adj.get(u)) if (!seen.has(v)) first(v);
    finish.push(u);
  }
  for (const u of adj.keys()) if (!seen.has(u)) first(u);
  const reverse = new Map([...adj.keys()].map(u => [u,[]]));
  for (const [u,neighbors] of adj) for (const v of neighbors) reverse.get(v).push(u);
  seen.clear();
  function second(u, group) {
    seen.add(u); group.push(u);
    for (const v of reverse.get(u)) if (!seen.has(v)) second(v,group);
  }
  for (const u of finish.reverse()) if (!seen.has(u)) {
    const group=[]; second(u,group); groups.push(group);
  }
  return groups;
}
`, `
def scc(adj):
    seen, finish, groups = set(), [], []
    def first(u):
        seen.add(u)
        for v in adj[u]:
            if v not in seen:
                first(v)
        finish.append(u)
    for u in adj:
        if u not in seen:
            first(u)
    reverse = {u: [] for u in adj}
    for u in adj:
        for v in adj[u]:
            reverse[v].append(u)
    seen.clear()
    def second(u, group):
        seen.add(u)
        group.append(u)
        for v in reverse[u]:
            if v not in seen:
                second(v, group)
    for u in reversed(finish):
        if u not in seen:
            group = []
            second(u, group)
            groups.append(group)
    return groups
`);
