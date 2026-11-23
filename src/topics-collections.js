import { snapshot, defineTopic } from './trace-contract.js';

const code = (Pseudocode, JavaScript, Python) => ({
  Pseudocode: Pseudocode.trim().split('\n'),
  JavaScript: JavaScript.trim().split('\n'),
  Python: Python.trim().split('\n'),
});
const indentedCode = (...sources) => code(...sources.map(source => source.split('\n').map((line, i) => i ? line.replace(/^ {6}/, '') : line).join('\n')));
const quiz = (question, options, answer, explanation) => ({ question, options, answer, explanation });
const challenge = (prompt, answer, hint, explanation) => ({ prompt, answer, hint, explanation });
const array = (values, active = [], extra = {}) => ({ kind: 'array', values, active, ...extra });
const cells = (kind, values, active = [], extra = {}) => ({ kind, values, active, ...extra });
const show = values => `[${values.join(', ')}]`;
const bucketIndex = (key, capacity) => ((key % capacity) + capacity) % capacity;
const hashView = buckets => cells('hash', buckets.map(bucket => bucket.length ? bucket.map(([key, value]) => `${key}:${value}`).join(' → ') : 'empty'), [], { labels: buckets.map((_, i) => `bucket ${i}`) });

// Keep long inputs readable without stopping the underlying algorithm.
function recording(title, description, view, metrics = []) {
  const frames = [snapshot(title, description, view, metrics)];
  let operations = 0;
  return {
    step(title, description, view, metrics = []) {
      operations++;
      if (frames.length < 29) frames.push(snapshot(`${operations}. ${title}`, description, view, metrics));
    },
    done(description, view, result, metrics = []) {
      const aggregated = operations - (frames.length - 1);
      if (aggregated) {
        description += ` The remaining ${aggregated} operations were executed and aggregated into this final state to keep the trace within 30 frames.`;
        metrics = [...metrics, ['Aggregated operations', aggregated]];
      }
      frames.push(snapshot('Computed outcome', description, { ...view, result: String(result) }, metrics));
      return frames;
    },
  };
}

export const topics = {
  'memory-pointers': defineTopic({
    intro: 'A pointer stores an address, not a private copy of the addressed value. This tiny heap allocates one cell, makes two aliases, writes through the second alias, then releases it. Reading through the first alias exposes both shared mutation and the danger of a dangling address.',
    invariant: 'Both aliases contain the same address; a dereference is permitted only while that address belongs to a live allocation.',
    takeaway: 'Copying a pointer copies an address. Freeing the allocation invalidates all aliases, even when their address bits have not changed.',
    complexity: { time: 'O(1) for this fixed number of simulated allocations and reads; allocator internals are excluded.', space: 'O(1): one heap cell and two address variables.' },
    examples: [
      { label: 'Shared positive value', input: { value: 7, replacement: 12 }, expected: 'alias read: 12; after free: dangling' },
      { label: 'Shared negative value', input: { value: 0, replacement: -3 }, expected: 'alias read: -3; after free: dangling' },
    ],
    trace({ value, replacement }) {
      const heap = new Map();
      const r = recording('Unallocated heap', 'No address can yet be dereferenced.', cells('state', ['p = null', 'q = null', 'heap empty']));
      const p = 100;
      heap.set(p, value);
      r.step('Allocate address 100', 'The allocator records a live cell and p receives its address.', cells('state', [`p = ${p}`, `100: ${heap.get(p)}`]), [['Live cells', heap.size]]);
      const q = p;
      r.step('Copy an address', 'q aliases p; there is still only one allocated value.', cells('state', [`p = ${p}`, `q = ${q}`, `100: ${heap.get(p)}`]));
      heap.set(q, replacement);
      const observed = heap.get(p);
      r.step('Write through q, read through p', `Writing ${replacement} to q changes the cell that p also addresses.`, cells('state', [`100: ${observed}`, `p read = ${observed}`]));
      heap.delete(q);
      const status = heap.has(p) ? String(heap.get(p)) : 'dangling';
      r.step('Release the allocation', 'The address variables remain, but their target is no longer live. We detect the invalid read instead of performing it.', cells('state', [`p = ${p}`, `q = ${q}`, `100: freed`]));
      return r.done('The observed value came from the shared cell; the subsequent liveness check rejects dereferencing freed storage.', cells('state', [`p: ${status}`]), `alias read: ${observed}; after free: ${status}`);
    },
    code: code(
      `allocate cell at address a with value
p ← a; q ← p
heap[q] ← replacement
observed ← heap[p]
release a
reject reads unless a is live`,
      `function aliases(value, replacement) {
  const heap = new Map([[100, value]]);
  const p = 100, q = p;
  heap.set(q, replacement);
  const observed = heap.get(p);
  heap.delete(q);
  return { observed, dangling: !heap.has(p) };
}`,
      `def aliases(value, replacement):
    heap = {100: value}
    p = 100
    q = p
    heap[q] = replacement
    observed = heap[p]
    del heap[q]
    return observed, p not in heap`),
    quiz: quiz('After q = p and a write through q, what does p observe?', ['Its original private copy', 'The updated shared cell', 'A new allocation', 'Always zero'], 1, 'The variables hold the same address, so both dereference the same live allocation.'),
    challenge: challenge('What should a safe simulated dereference do after the cell is released?', 'Check allocation liveness and reject the read.', 'An address may still exist in a variable.', 'Clearing one pointer cannot clear every alias; the heap must track which addresses are live.'),
  }),
  recursion: defineTopic({
    intro: 'Factorial illustrates recursion as deferred work. Each call for n > 1 waits for the smaller factorial, while n = 0 or 1 returns one immediately. The visualization shows the active call stack and the multiplication performed during unwinding.',
    invariant: 'Every pending call k waits for factorial(k − 1); completed return values equal the product from 1 through their argument.',
    takeaway: 'A base case supplies a value, not just a stopping condition. Deep recursion also consumes call-stack space.',
    complexity: { time: 'O(n) multiplications for nonnegative integer n, treating arithmetic as constant cost.', space: 'O(n) call frames; arbitrary-precision result storage is excluded.' },
    examples: [{ label: 'Four pending factors', input: 4, expected: '24' }, { label: 'Zero factorial', input: 0, expected: '1' }],
    trace(n) {
      const stack = [];
      const r = recording('Prepare factorial', `Compute factorial(${n}) with a base case at 0 or 1.`, cells('stack', stack, [], { secondary: [n] }));
      function factorial(k) {
        stack.push(k);
        r.step(`Call factorial(${k})`, k <= 1 ? 'This call reaches the base case and supplies one.' : `Suspend this call while factorial(${k - 1}) is evaluated.`, cells('stack', stack, [stack.length - 1]));
        const value = k <= 1 ? 1 : k * factorial(k - 1);
        stack.pop();
        r.step(`Return ${value} from ${k}`, k <= 1 ? 'The base value begins unwinding.' : `Multiply the child result by ${k} and release this frame.`, cells('stack', stack, [], { secondary: [value] }));
        return value;
      }
      const result = factorial(n);
      return r.done('All calls have returned; no pending multiplication remains.', cells('stack', stack, [], { secondary: [result] }), result);
    },
    code: code(
      `factorial(n):
  if n ≤ 1: return 1
  smaller ← factorial(n − 1)
  return n × smaller`,
      `function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}`,
      `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)`),
    quiz: quiz('Why must factorial(0) return 1?', ['To create another call', 'To erase the stack', 'It is the multiplicative identity', 'It means zero calls are impossible'], 2, 'The empty product is one; returning zero would annihilate every enclosing multiplication.'),
    challenge: challenge('What is factorial(3), including the base-case contribution?', '3 × 2 × 1 = 6', 'Unwind from factorial(1).', 'The deepest call returns one; the waiting calls multiply by two and then three.'),
  }),
  'divide-conquer': defineTopic({
    intro: 'Finding a maximum can be decomposed into two independent half-range questions. A one-element range answers itself; a parent combines two returned maxima with one comparison. This is divide-and-conquer even though a linear scan is simpler for this particular problem.',
    invariant: 'A call on [lo, hi) returns the maximum of exactly that nonempty range; its children partition the range without gaps or overlap.',
    takeaway: 'Dividing a problem is useful only when the combine operation preserves the desired answer. Splitting alone does not guarantee a faster algorithm.',
    complexity: { time: 'O(n) for n ≥ 1 values: the recursion tree performs n − 1 combine comparisons.', space: 'O(log n) active calls with balanced midpoint splits, excluding trace snapshots.' },
    examples: [{ label: 'Mixed signs', input: [3, -2, 9, 4], expected: '9' }, { label: 'All negative', input: [-8, -3, -5], expected: '-3' }],
    trace(values) {
      const r = recording('Whole search range', 'The maximum must belong to one of the two halves.', array(values));
      function solve(lo, hi) {
        if (hi - lo === 1) {
          r.step(`Singleton [${lo}, ${hi})`, `The only candidate is ${values[lo]}.`, array(values, [lo]));
          return values[lo];
        }
        const mid = Math.floor((lo + hi) / 2);
        r.step(`Split [${lo}, ${hi}) at ${mid}`, 'Each child receives a strictly smaller nonempty range.', array(values, [lo, mid, hi - 1]));
        const left = solve(lo, mid), right = solve(mid, hi), best = Math.max(left, right);
        r.step(`Combine [${lo}, ${hi})`, `Compare child maxima ${left} and ${right}; keep ${best}.`, array(values), [['Left maximum', left], ['Right maximum', right]]);
        return best;
      }
      const result = values.length ? solve(0, values.length) : 'empty';
      return r.done('The root combines the answers covering the complete input.', array(values), result);
    },
    code: code(
      `maximum(lo, hi):
  if hi − lo = 1: return values[lo]
  mid ← floor((lo + hi) / 2)
  return max(maximum(lo, mid), maximum(mid, hi))`,
      `function maximum(a, lo = 0, hi = a.length) {
  if (hi === lo) return null;
  if (hi - lo === 1) return a[lo];
  const mid = Math.floor((lo + hi) / 2);
  return Math.max(maximum(a, lo, mid), maximum(a, mid, hi));
}`,
      `def maximum(a, lo=0, hi=None):
    hi = len(a) if hi is None else hi
    if hi == lo:
        return None
    if hi - lo == 1:
        return a[lo]
    mid = (lo + hi) // 2
    return max(maximum(a, lo, mid), maximum(a, mid, hi))`),
    quiz: quiz('How are two half-range maximum answers combined?', ['Add them', 'Compare and keep the greater', 'Keep the left unconditionally', 'Sort the indices'], 1, 'Every input value is in one half, so the greater half maximum is also the whole-range maximum.'),
    challenge: challenge('How many combine comparisons are needed for eight values?', '7', 'Each combine reduces two answers to one.', 'A full binary recursion tree with eight leaves has seven internal nodes.'),
  }),
  arrays: defineTopic({
    intro: 'An array provides indexed cells, but inserting into an occupied position requires moving a suffix. Here we reserve one extra cell, shift values right from the end, write the new value, and then remove a selected index by shifting the following values left.',
    invariant: 'During right shifts, the suffix already moved preserves its original order; during deletion, the copied prefix of the suffix occupies its final positions.',
    takeaway: 'Random access is constant-time, but preserving order during an interior insertion or deletion requires shifting cells.',
    complexity: { time: 'O(n) for the demonstrated insertion and deletion, assuming valid indices and contiguous storage.', space: 'O(1) auxiliary space apart from the expanded array storage.' },
    examples: [
      { label: 'Insert then remove middle', input: { values: [2, 4, 6], index: 1, value: 3, remove: 2 }, expected: '[2, 3, 6]' },
      { label: 'Insert into empty array', input: { values: [], index: 0, value: -1, remove: 0 }, expected: '[]' },
    ],
    trace({ values, index, value, remove }) {
      const a = [...values];
      const r = recording('Indexed storage', `Insert ${value} at ${index}, then delete index ${remove} in the expanded array.`, array(a, [], { secondary: [value] }));
      a.push('free');
      for (let i = a.length - 1; i > index; i--) {
        a[i] = a[i - 1];
        r.step(`Shift ${i - 1} to ${i}`, 'Copy from right to left so unread source cells are not overwritten.', array(a, [i - 1, i]));
      }
      a[index] = value;
      r.step(`Write insertion at ${index}`, 'The reserved gap now holds the new value.', array(a, [index]));
      for (let i = remove; i < a.length - 1; i++) {
        a[i] = a[i + 1];
        r.step(`Close deletion gap at ${i}`, 'The next cell moves left while preserving order.', array(a, [i, i + 1]));
      }
      a.pop();
      r.step('Shrink logical length', 'Drop the duplicated trailing cell after the left shifts.', array(a));
      return r.done('The array reflects both requested edits in their specified order.', array(a), show(a));
    },
    code: code(
      `extend storage by one cell
for i from last down to index + 1: a[i] ← a[i − 1]
a[index] ← value
for i from remove to last − 1: a[i] ← a[i + 1]
discard last cell`,
      `function edit(a, index, value, remove) {
  a.push(undefined);
  for (let i = a.length - 1; i > index; i--) a[i] = a[i - 1];
  a[index] = value;
  for (let i = remove; i < a.length - 1; i++) a[i] = a[i + 1];
  a.pop();
  return a;
}`,
      `def edit(a, index, value, remove):
    a.append(None)
    for i in range(len(a) - 1, index, -1):
        a[i] = a[i - 1]
    a[index] = value
    for i in range(remove, len(a) - 1):
        a[i] = a[i + 1]
    a.pop()
    return a`),
    quiz: quiz('Why shift right from the last cell during insertion?', ['To change the sort order', 'To avoid overwriting unread values', 'To make indices one-based', 'To eliminate allocation'], 1, 'Moving left to right would overwrite a source before copying it to its new position.'),
    challenge: challenge('Insert 5 at index 0 of [8, 9]. What is the result?', '[5, 8, 9]', 'Open a gap before writing.', 'Move 9 to index 2 and 8 to index 1, then place 5 at index 0.'),
  }),
  'dynamic-arrays': defineTopic({
    intro: 'A dynamic array separates its logical size from the capacity of its backing block. Appending into spare capacity writes one cell. When the block is full, this implementation allocates twice the capacity and copies every live value before appending.',
    invariant: 'Only slots below size contain live elements, size never exceeds capacity, and a resize preserves every live element in order.',
    takeaway: 'Doubling gives amortized constant-time append, not constant worst-case latency. A resize copies the entire current prefix.',
    complexity: { time: 'O(m + c) total for m appends with initial capacity c ≥ 1; amortized O(1) append, worst-case O(n) resize.', space: 'O(c + m) backing storage; old and new blocks coexist transiently during copying.' },
    examples: [
      { label: 'Two growth events', input: { capacity: 1, values: [4, 8, 12] }, expected: '[4, 8, 12]; size=3; capacity=4' },
      { label: 'Unused capacity remains', input: { capacity: 4, values: [-2, -2] }, expected: '[-2, -2]; size=2; capacity=4' },
    ],
    trace({ capacity, values }) {
      capacity = Math.max(1, capacity);
      let storage = Array(capacity).fill('free'), size = 0, copies = 0;
      const r = recording('Empty backing block', 'Capacity counts allocated cells; size counts initialized elements.', array(storage, [], { secondary: values }), [['Size', size], ['Capacity', capacity]]);
      for (const value of values) {
        if (size === capacity) {
          const old = storage;
          capacity *= 2;
          storage = Array(capacity).fill('free');
          r.step(`Allocate capacity ${capacity}`, 'The old block remains available while values are copied.', array(storage, [], { secondary: old }), [['Size', size], ['Capacity', capacity]]);
          for (let i = 0; i < size; i++) {
            storage[i] = old[i]; copies++;
            r.step(`Copy element ${i}`, 'This live element keeps its logical index in the new block.', array(storage, [i], { secondary: old }), [['Copies', copies]]);
          }
        }
        storage[size++] = value;
        r.step(`Append at ${size - 1}`, `Write ${value} in the first free slot and increment size.`, array(storage, [size - 1]), [['Size', size], ['Capacity', capacity]]);
      }
      return r.done('Unused slots are capacity, not members of the logical array.', array(storage), `${show(storage.slice(0, size))}; size=${size}; capacity=${capacity}`, [['Copies', copies]]);
    },
    code: code(
      `size ← 0; allocate capacity cells
for value in input:
  if size = capacity:
    allocate 2 × capacity cells; copy size live cells
    replace backing block; capacity ← 2 × capacity
  storage[size] ← value; size ← size + 1`,
      `function grow(values, capacity = 1) {
  capacity = Math.max(1, capacity);
  let storage = Array(capacity), size = 0;
  for (const value of values) {
    if (size === capacity) {
      const next = Array(capacity * 2);
      for (let i = 0; i < size; i++) next[i] = storage[i];
      storage = next; capacity *= 2;
    }
    storage[size++] = value;
  }
  return { values: storage.slice(0, size), capacity };
}`,
      `def grow(values, capacity=1):
    capacity = max(1, capacity)
    storage, size = [None] * capacity, 0
    for value in values:
        if size == capacity:
            next_block = [None] * (capacity * 2)
            for i in range(size):
                next_block[i] = storage[i]
            storage, capacity = next_block, capacity * 2
        storage[size] = value
        size += 1
    return storage[:size], capacity`),
    quiz: quiz('An append arrives when size equals capacity. What happens first?', ['Overwrite the first cell', 'Allocate a larger block and copy live values', 'Decrease size', 'Sort the block'], 1, 'There is no spare slot, so a larger backing block is needed before the new write.'),
    challenge: challenge('With initial capacity 2, what capacity is needed after five appends?', '8', 'Double only when full.', 'The third append grows to 4; the fifth grows to 8.'),
  }),
  'two-pointers': defineTopic({
    intro: 'In a sorted numeric array, two boundary pointers can search for a target sum without enumerating every pair. A sum that is too small rules out the current left value paired with any remaining right value; a sum that is too large rules out the current right value.',
    invariant: 'Every pair discarded by moving a boundary cannot meet the target; any undiscovered valid pair remains between left and right.',
    takeaway: 'The direction rules rely on sorted input. Indices must remain distinct, so stop when the boundaries meet.',
    complexity: { time: 'O(n) for an already sorted array of n numbers; sorting is not included.', space: 'O(1) auxiliary search state.' },
    examples: [
      { label: 'Pair with duplicate values', input: { values: [1, 2, 2, 5], target: 4 }, expected: 'indices 1, 2; values 2 + 2 = 4' },
      { label: 'No matching sum', input: { values: [-4, 0, 3], target: 8 }, expected: 'not found' },
    ],
    trace({ values, target }) {
      let left = 0, right = values.length - 1, result = 'not found';
      const r = recording('Sorted boundaries', `Look for two distinct entries totaling ${target}.`, array(values));
      while (left < right) {
        const sum = values[left] + values[right];
        r.step(`Compare pair ${left}, ${right}`, `${values[left]} + ${values[right]} = ${sum}; compare with ${target}.`, array(values, [left, right]), [['Sum', sum]]);
        if (sum === target) { result = `indices ${left}, ${right}; values ${values[left]} + ${values[right]} = ${target}`; break; }
        if (sum < target) {
          left++;
          r.step(`Advance left to ${left}`, 'The former left entry cannot reach the target with any remaining right entry.', array(values, [left, right]));
        } else {
          right--;
          r.step(`Retreat right to ${right}`, 'The former right entry is too large with every remaining left entry.', array(values, [left, right]));
        }
      }
      return r.done(result === 'not found' ? 'The candidate interval has fewer than two entries.' : 'The current pair satisfies the target exactly.', array(values, left < right ? [left, right] : []), result);
    },
    code: code(
      `left ← 0; right ← length − 1
while left < right:
  sum ← a[left] + a[right]
  if sum = target: return (left, right)
  if sum < target: left ← left + 1
  else: right ← right − 1
return missing`,
      `function pair(a, target) {
  let l = 0, r = a.length - 1;
  while (l < r) {
    const sum = a[l] + a[r];
    if (sum === target) return [l, r];
    if (sum < target) l++; else r--;
  }
  return null;
}`,
      `def pair(a, target):
    left, right = 0, len(a) - 1
    while left < right:
        total = a[left] + a[right]
        if total == target:
            return left, right
        if total < target:
            left += 1
        else:
            right -= 1
    return None`),
    quiz: quiz('In sorted input, a boundary pair sum is too small. Which pointer moves?', ['Right moves left', 'Left moves right', 'Both reset', 'Neither can move safely'], 1, 'Increasing the left value is the only boundary move that can increase the sum.'),
    challenge: challenge('Can a single value 4 satisfy target 8 in this pair search?', 'No; two distinct indices are required.', 'Check left < right.', 'The algorithm must not use the same array cell twice.'),
  }),
  'sliding-window': defineTopic({
    intro: 'A fixed-width window sum reuses nearly all the work from its predecessor. Add the new rightmost value and subtract the value that just fell out. This lesson reports every full-window sum, including windows with negative values.',
    invariant: 'After removing the expired entry, running equals the sum of the last at most k values; output is recorded only for full windows.',
    takeaway: 'Fixed-size window sums work with negative values. Variable-size sum thresholds need additional assumptions, often nonnegative input.',
    complexity: { time: 'O(n) for n numeric values and integer width k ≥ 1.', space: 'O(1) auxiliary running state, plus O(n − k + 1) output when k ≤ n.' },
    examples: [{ label: 'Mixed window sums', input: { values: [2, -1, 3, 4], k: 2 }, expected: '[1, 2, 7]' }, { label: 'Window exceeds input', input: { values: [5], k: 2 }, expected: '[]' }],
    trace({ values, k }) {
      let running = 0;
      const sums = [];
      const r = recording('Window before first entry', `A full window requires ${k} entries.`, array(values), [['Running sum', running]]);
      for (let i = 0; i < values.length; i++) {
        running += values[i];
        r.step(`Enter index ${i}`, `Add ${values[i]} to the running total.`, array(values, [i]), [['Running sum', running]]);
        if (i >= k) {
          running -= values[i - k];
          r.step(`Expire index ${i - k}`, `Subtract ${values[i - k]} because it lies outside the width-${k} window.`, array(values, [i - k, i]), [['Running sum', running]]);
        }
        if (i >= k - 1) {
          sums.push(running);
          r.step(`Record window ending ${i}`, 'This window has exactly the required number of entries.', array(values, Array.from({ length: k }, (_, j) => i - k + 1 + j), { secondary: sums }));
        }
      }
      return r.done('Only complete windows contribute to the output.', array(values, [], { secondary: sums }), show(sums));
    },
    code: code(
      `running ← 0; output ← []
for i from 0 to n − 1:
  running ← running + a[i]
  if i ≥ k: running ← running − a[i − k]
  if i ≥ k − 1: append running to output`,
      `function windowSums(a, k) {
  let sum = 0;
  const out = [];
  for (let i = 0; i < a.length; i++) {
    sum += a[i];
    if (i >= k) sum -= a[i - k];
    if (i >= k - 1) out.push(sum);
  }
  return out;
}`,
      `def window_sums(a, k):
    total, out = 0, []
    for i, value in enumerate(a):
        total += value
        if i >= k:
            total -= a[i - k]
        if i >= k - 1:
            out.append(total)
    return out`),
    quiz: quiz('When a width-3 window moves right, which value is subtracted?', ['The new rightmost value', 'The former leftmost value', 'The maximum value', 'Every negative value'], 1, 'Only the former leftmost entry has left the window.'),
    challenge: challenge('List width-2 sums for [-2, 5, -1].', '[3, 4]', 'Negative values are included normally.', 'The full windows are [-2, 5] and [5, -1].'),
  }),
  'prefix-sums': defineTopic({
    intro: 'A prefix table stores cumulative sums at boundaries rather than at elements. Prefix[0] is zero, and prefix[i + 1] includes value i. Subtracting two boundaries answers an inclusive range query without rescanning its contents.',
    invariant: 'prefix[i] equals the sum of values at indices below i, so prefix[r + 1] − prefix[l] contains exactly indices l through r.',
    takeaway: 'The extra zero boundary removes special handling for ranges beginning at index zero. Updating an input value invalidates later prefixes.',
    complexity: { time: 'O(n) preprocessing and O(1) per valid inclusive query; O(n + q) for q queries.', space: 'O(n) prefix storage plus O(q) returned answers.' },
    examples: [
      { label: 'Ranges across negative values', input: { values: [3, -2, 5, 1], queries: [[0, 2], [1, 3]] }, expected: '[6, 4]' },
      { label: 'Singleton range', input: { values: [-7], queries: [[0, 0]] }, expected: '[-7]' },
    ],
    trace({ values, queries }) {
      const prefix = [0], answers = [];
      const r = recording('Zero boundary', 'The empty prefix has sum zero.', array(values, [], { secondary: prefix }));
      values.forEach((value, i) => {
        prefix.push(prefix[i] + value);
        r.step(`Build boundary ${i + 1}`, `Add ${value} to prefix[${i}] = ${prefix[i]}.`, array(values, [i], { secondary: prefix }));
      });
      queries.forEach(([l, h], i) => {
        const answer = prefix[h + 1] - prefix[l];
        answers.push(answer);
        r.step(`Answer query ${i}: [${l}, ${h}]`, `${prefix[h + 1]} − ${prefix[l]} = ${answer}; the excluded prefix cancels.`, array(prefix, [l, h + 1], { labels: prefix.map((_, j) => `boundary ${j}`) }));
      });
      return r.done('Each query uses two stored boundaries, regardless of range length.', array(prefix, [], { secondary: answers }), show(answers));
    },
    code: code(
      `prefix ← [0]
for value in a: append last(prefix) + value
for (l, r) in queries: answer ← prefix[r + 1] − prefix[l]`,
      `function ranges(a, queries) {
  const p = [0];
  for (const value of a) p.push(p[p.length - 1] + value);
  return queries.map(([l, r]) => p[r + 1] - p[l]);
}`,
      `def ranges(a, queries):
    prefix = [0]
    for value in a:
        prefix.append(prefix[-1] + value)
    return [prefix[r + 1] - prefix[l] for l, r in queries]`),
    quiz: quiz('For inclusive indices [l, r], which subtraction is correct?', ['p[r] − p[l]', 'p[r + 1] − p[l]', 'p[l] − p[r + 1]', 'p[r + 1] + p[l]'], 1, 'Boundary r + 1 includes r; boundary l excludes everything before l.'),
    challenge: challenge('What is the prefix table of [2, -3, 4]?', '[0, 2, -1, 3]', 'Start with the empty-prefix sum.', 'Successive boundaries add 2, then -3, then 4.'),
  }),
};

Object.assign(topics, {
        'hash-tables': defineTopic({
          intro: 'A hash table maps a key to a bucket and compares actual keys inside that bucket. This small integer-key dictionary uses separate chains, so even a deliberately simple modulo hash can store colliding keys correctly. Putting an existing key replaces its value rather than adding a duplicate.',
          invariant: 'Each key appears exactly once in its hash bucket; lookup and deletion compare keys, not merely their bucket numbers.',
          takeaway: 'A hash chooses where to search, not which key has matched. Expected constant-time lookup depends on short chains and a controlled load factor.',
          complexity: { time: 'Expected O(1 + n/c) per operation under uniform hashing for n keys and c buckets; worst-case O(n) with a single long chain.', space: 'O(n + c) chains and bucket headers; integer-key hashing is treated as O(1).' },
          examples: [
            { label: 'Collision and update', input: { capacity: 4, operations: [['put', 1, 10], ['put', 5, 50], ['put', 1, 11], ['get', 5], ['delete', 1], ['get', 1]] }, expected: 'reads [50, miss]; entries [5:50]' },
            { label: 'Negative key and missing deletion', input: { capacity: 3, operations: [['put', -1, 7], ['delete', 2], ['get', -1]] }, expected: 'reads [7]; entries [-1:7]' },
          ],
          trace({ capacity, operations }) {
            const buckets = Array.from({ length: capacity }, () => []), reads = [];
            const r = recording('Empty bucket directory', 'Normalize modulo so negative integer keys still select a valid bucket.', hashView(buckets), [['Capacity', capacity]]);
            operations.forEach(([op, key, value], i) => {
              const index = bucketIndex(key, capacity), bucket = buckets[index];
              r.step(`Hash key ${key} at operation ${i}`, `Normalized ${key} modulo ${capacity} selects bucket ${index}; key comparison still follows.`, { ...hashView(buckets), active: [index] });
              let found = -1;
              for (let j = 0; j < bucket.length; j++) {
                r.step(`Compare chain entry ${index}:${j}`, `Compare stored key ${bucket[j][0]} with ${key}; collision alone is not equality.`, { ...hashView(buckets), active: [index] });
                if (bucket[j][0] === key) { found = j; break; }
              }
              if (op === 'put') {
                if (found >= 0) bucket[found][1] = value; else bucket.push([key, value]);
                r.step(`${found >= 0 ? 'Update' : 'Insert'} key ${key}`, `Store value ${value} ${found >= 0 ? 'in the existing entry' : 'at the end of this bucket chain'}.`, { ...hashView(buckets), active: [index] });
              } else if (op === 'get') {
                const answer = found >= 0 ? bucket[found][1] : 'miss'; reads.push(answer);
                r.step(`Read key ${key}`, `The chain scan ${found >= 0 ? `found value ${answer}` : 'found no equal key'}.`, { ...hashView(buckets), active: [index], secondary: reads });
              } else {
                if (found >= 0) bucket.splice(found, 1);
                r.step(`Delete key ${key}`, found >= 0 ? 'Remove only the matching entry; other colliding keys stay reachable.' : 'No equal key exists; deletion leaves the bucket unchanged.', { ...hashView(buckets), active: [index] });
              }
            });
            const entries = buckets.flat().sort((a, b) => a[0] - b[0]).map(([key, value]) => `${key}:${value}`);
            return r.done('Read results follow key equality; final entries are displayed in numeric-key order for comparison.', { ...hashView(buckets), secondary: reads }, `reads ${show(reads)}; entries ${show(entries)}`);
          },
          code: indentedCode(
            `bucket ← table[normalized key modulo capacity]
      scan bucket for equal key
      put: replace equal entry, otherwise append
      get: return equal entry value, otherwise miss
      delete: remove equal entry only`,
            `class ChainedMap {
        constructor(capacity) { this.buckets = Array.from({ length: capacity }, () => []); }
        bucket(key) {
          const c = this.buckets.length;
          return this.buckets[((key % c) + c) % c];
        }
        put(key, value) {
          const b = this.bucket(key), entry = b.find(e => e[0] === key);
          if (entry) entry[1] = value; else b.push([key, value]);
        }
        get(key) { return this.bucket(key).find(e => e[0] === key)?.[1] ?? 'miss'; }
        delete(key) {
          const b = this.bucket(key), i = b.findIndex(e => e[0] === key);
          if (i >= 0) b.splice(i, 1);
        }
      }`,
            `class ChainedMap:
          def __init__(self, capacity):
              self.buckets = [[] for _ in range(capacity)]
          def bucket(self, key):
              return self.buckets[key % len(self.buckets)]
          def put(self, key, value):
              bucket = self.bucket(key)
              for entry in bucket:
                  if entry[0] == key:
                      entry[1] = value
                      return
              bucket.append([key, value])
          def get(self, key):
              for stored, value in self.bucket(key):
                  if stored == key: return value
              return "miss"
          def delete(self, key):
              bucket = self.bucket(key)
              for i, entry in enumerate(bucket):
                  if entry[0] == key:
                      bucket.pop(i)
                      return`),
          quiz: quiz('Keys 1 and 5 both hash to bucket 1 in capacity 4. Are they the same dictionary key?', ['Yes, bucket equality is key equality', 'No, compare their actual keys', 'Only if their values match', 'The second key must be discarded'], 1, 'Collisions share a search location, not identity.'),
          challenge: challenge('What bucket receives key -1 with capacity 4 and normalized modulo?', '3', 'The valid indices are 0 through 3.', 'Normalize the remainder using ((key % capacity) + capacity) % capacity in JavaScript.'),
        }),
        'collision-handling': defineTopic({
          intro: 'Linear probing resolves a collision by trying successive slots, wrapping at the end. Deletion cannot simply mark a slot never-used: a later colliding key may depend on probing across it. A tombstone preserves that search route while remaining reusable for insertion.',
          invariant: 'A stored key is reachable by probing from its home slot without crossing a never-used slot; tombstones do not terminate lookup.',
          takeaway: 'Empty and deleted are different states. Probe at most capacity slots so a full table or a table of tombstones cannot cause an infinite loop.',
          complexity: { time: 'Expected O(1) per operation only with good hashing and bounded load; worst-case O(c) probes for capacity c.', space: 'O(c) slots and tombstone state; keys are integers with constant-cost hashing.' },
          examples: [
            { label: 'Lookup passes a tombstone', input: { capacity: 5, operations: [['put', 1, 'a'], ['put', 6, 'b'], ['delete', 1], ['get', 6], ['put', 11, 'c']] }, expected: 'reads [b]; slots [empty, 11:c, 6:b, empty, empty]' },
            { label: 'Full table bounds probing', input: { capacity: 2, operations: [['put', 0, 'x'], ['put', 2, 'y'], ['put', 4, 'z'], ['get', 4]] }, expected: 'reads [miss]; slots [0:x, 2:y]' },
          ],
          trace({ capacity, operations }) {
            const slots = Array(capacity).fill(null), deleted = Symbol('deleted'), reads = [];
            const display = () => slots.map(s => s === null ? 'empty' : s === deleted ? 'deleted' : `${s.key}:${s.value}`);
            const view = (active = []) => cells('hash', display(), active, { secondary: reads });
            const r = recording('Never-used probe slots', 'A never-used slot ends a missing-key search; a deleted slot does not.', view());
            for (const [op, key, value] of operations) {
              const home = bucketIndex(key, capacity);
              let found = -1, available = -1;
              for (let distance = 0; distance < capacity; distance++) {
                const index = (home + distance) % capacity, entry = slots[index];
                r.step(`Probe key ${key} at slot ${index}`, entry === null ? 'Never-used slot proves the key is absent.' : entry === deleted ? 'Tombstone is reusable but search must continue.' : `Compare stored key ${entry.key} with ${key}.`, view([index]), [['Probe distance', distance]]);
                if (entry === null) { if (available < 0) available = index; break; }
                if (entry === deleted) { if (available < 0) available = index; }
                else if (entry.key === key) { found = index; break; }
              }
              if (op === 'put') {
                const index = found >= 0 ? found : available;
                if (index >= 0) {
                  slots[index] = { key, value };
                  r.step(`Store key ${key} at ${index}`, found >= 0 ? 'Update the existing key rather than duplicating it into an earlier tombstone.' : 'Use the first reusable slot encountered on the probe route.', view([index]));
                } else r.step(`Reject key ${key}: table full`, 'All capacity slots were checked with no reusable slot; insertion is rejected.', view());
              } else if (op === 'get') {
                reads.push(found >= 0 ? slots[found].value : 'miss');
                r.step(`Finish lookup for ${key}`, found >= 0 ? 'An actual key match supplies the value.' : 'The bounded probe sequence proves the key absent.', view(found >= 0 ? [found] : []));
              } else {
                if (found >= 0) slots[found] = deleted;
                r.step(`Delete probe key ${key}`, found >= 0 ? 'Leave a tombstone so later colliding keys remain reachable.' : 'An absent key changes no slot.', view(found >= 0 ? [found] : []));
              }
            }
            return r.done('The physical slot layout records collisions and reusable deletion markers.', view(), `reads ${show(reads)}; slots ${show(display())}`);
          },
          code: indentedCode(
            `probe at most capacity slots from home, wrapping
      remember first tombstone; continue to check for an existing key
      stop at never-used slot or equal key
      put into equal slot or first reusable slot; reject if none
      get returns equal value or miss
      delete replaces equal slot with tombstone`,
            `const DELETED = Symbol('deleted');
      class ProbedMap {
        constructor(c) { this.slots = Array(c).fill(null); }
        locate(key) {
          const c = this.slots.length, home = ((key % c) + c) % c;
          let free = -1;
          for (let d = 0; d < c; d++) {
            const i = (home + d) % c, e = this.slots[i];
            if (e === null) return { found: -1, free: free < 0 ? i : free };
            if (e === DELETED) { if (free < 0) free = i; }
            else if (e.key === key) return { found: i, free };
          }
          return { found: -1, free };
        }
        put(key, value) {
          const p = this.locate(key), i = p.found >= 0 ? p.found : p.free;
          if (i < 0) return 'full';
          this.slots[i] = { key, value };
        }
        get(key) { const i = this.locate(key).found; return i < 0 ? 'miss' : this.slots[i].value; }
        delete(key) { const i = this.locate(key).found; if (i >= 0) this.slots[i] = DELETED; }
      }`,
            `DELETED = object()

      class ProbedMap:
          def __init__(self, capacity):
              self.slots = [None] * capacity
          def locate(self, key):
              capacity, free = len(self.slots), -1
              for distance in range(capacity):
                  i = (key % capacity + distance) % capacity
                  entry = self.slots[i]
                  if entry is None:
                      return -1, i if free < 0 else free
                  if entry is DELETED:
                      if free < 0: free = i
                  elif entry[0] == key:
                      return i, free
              return -1, free
          def put(self, key, value):
              found, free = self.locate(key)
              i = found if found >= 0 else free
              if i < 0: return "full"
              self.slots[i] = (key, value)
          def get(self, key):
              found, _ = self.locate(key)
              return self.slots[found][1] if found >= 0 else "miss"
          def delete(self, key):
              found, _ = self.locate(key)
              if found >= 0: self.slots[found] = DELETED`),
          quiz: quiz('Why must lookup continue past a tombstone?', ['Tombstones contain the final answer', 'A colliding key may have been stored farther along', 'Hashing is no longer needed', 'It must examine every slot always'], 1, 'The deleted key occupied a formerly used position in another key’s probe route.'),
          challenge: challenge('Capacity 4: insert keys 1 and 5, then delete 1. Where can lookup find 5?', 'Slot 2, by probing across the tombstone in slot 1.', 'Both keys start at home slot 1.', 'The second insertion had to advance one slot; deleting the first must not break that route.'),
        }),
        'resizing-rehashing': defineTopic({
          intro: 'A growing hash table watches load factor, the ratio of keys to buckets. Before a new key would exceed 0.75, this chained table doubles the bucket count and recomputes every stored key’s bucket. Merely copying old bucket positions would make lookups use the wrong modulus.',
          invariant: 'Every entry resides at normalized key modulo the current capacity, and updates of an existing key do not increase the key count.',
          takeaway: 'Rehashing changes addresses within the table but preserves key-value associations. Occasional expensive rebuilds buy shorter expected chains.',
          complexity: { time: 'Expected amortized O(1) insert under uniform hashing and doubling; a rebuild is O(n + c) for n keys and c new buckets. Worst-case colliding chains can make insert O(n).', space: 'O(n + c) stored entries and bucket headers; old and new directories temporarily coexist.' },
          examples: [
            { label: 'Old collision separates on growth', input: { capacity: 2, entries: [[0, 'a'], [2, 'b'], [4, 'c'], [6, 'd']] }, expected: 'capacity=8; buckets [0:a, empty, 2:b, empty, 4:c, empty, 6:d, empty]' },
            { label: 'Updating does not trigger growth', input: { capacity: 4, entries: [[1, 'a'], [1, 'z'], [3, 'c']] }, expected: 'capacity=4; buckets [empty, 1:z, empty, 3:c]' },
          ],
          trace({ capacity, entries }) {
            let buckets = Array.from({ length: capacity }, () => []), size = 0;
            const r = recording('Initial hash directory', 'A new distinct key triggers growth only if projected load exceeds 0.75.', hashView(buckets), [['Size', size], ['Capacity', capacity]]);
            for (const [key, value] of entries) {
              let bucket = buckets[bucketIndex(key, capacity)], existing = bucket.find(e => e[0] === key);
              if (existing) {
                existing[1] = value;
                r.step(`Update existing key ${key}`, 'The association changes but key count and load factor stay the same.', hashView(buckets), [['Size', size], ['Capacity', capacity]]);
                continue;
              }
              if ((size + 1) / capacity > 0.75) {
                const old = buckets, oldCapacity = capacity;
                capacity *= 2; buckets = Array.from({ length: capacity }, () => []);
                r.step(`Double capacity ${oldCapacity} to ${capacity}`, `Projected load ${(size + 1) / oldCapacity} exceeds 0.75; allocate a fresh directory.`, hashView(buckets), [['Keys to migrate', size]]);
                for (const oldBucket of old) for (const entry of oldBucket) {
                  const index = bucketIndex(entry[0], capacity);
                  buckets[index].push(entry);
                  r.step(`Rehash stored key ${entry[0]}`, `Recompute modulo ${capacity}: key ${entry[0]} now belongs in bucket ${index}.`, { ...hashView(buckets), active: [index] });
                }
              }
              const index = bucketIndex(key, capacity);
              bucket = buckets[index]; bucket.push([key, value]); size++;
              r.step(`Insert new key ${key}`, `Place the association in current bucket ${index}, after any rebuild.`, { ...hashView(buckets), active: [index] }, [['Size', size], ['Load factor', size / capacity]]);
            }
            return r.done('The final directory uses the current modulus for every association.', hashView(buckets), `capacity=${capacity}; buckets ${show(hashView(buckets).values)}`, [['Size', size]]);
          },
          code: indentedCode(
            `if key exists: update value without changing size
      else if (size + 1) / capacity > 0.75:
        double capacity; allocate empty buckets
        for each stored entry: insert into key modulo new capacity
      insert new entry using current capacity; increment size`,
            `function rehashing(entries, capacity) {
        let buckets = Array.from({ length: capacity }, () => []), size = 0;
        const index = key => ((key % capacity) + capacity) % capacity;
        for (const [key, value] of entries) {
          const oldEntry = buckets[index(key)].find(e => e[0] === key);
          if (oldEntry) { oldEntry[1] = value; continue; }
          if ((size + 1) / capacity > 0.75) {
            const old = buckets; capacity *= 2;
            buckets = Array.from({ length: capacity }, () => []);
            for (const bucket of old)
              for (const entry of bucket) buckets[index(entry[0])].push(entry);
          }
          buckets[index(key)].push([key, value]); size++;
        }
        return { capacity, buckets };
      }`,
            `def rehashing(entries, capacity):
          buckets, size = [[] for _ in range(capacity)], 0
          for key, value in entries:
              existing = next((e for e in buckets[key % capacity] if e[0] == key), None)
              if existing is not None:
                  existing[1] = value
                  continue
              if (size + 1) / capacity > 0.75:
                  old, capacity = buckets, capacity * 2
                  buckets = [[] for _ in range(capacity)]
                  for bucket in old:
                      for entry in bucket:
                          buckets[entry[0] % capacity].append(entry)
              buckets[key % capacity].append([key, value])
              size += 1
          return capacity, buckets`),
          quiz: quiz('Why recompute bucket indices when capacity doubles?', ['Values have changed', 'The hash-to-bucket modulus has changed', 'Keys must be renamed', 'Old collisions are guaranteed forever'], 1, 'A key’s remainder modulo the new capacity can differ from its old remainder.'),
          challenge: challenge('Where does key 6 move when capacity changes from 4 to 8?', 'From bucket 2 to bucket 6.', 'Recompute both remainders.', '6 % 4 is 2, while 6 % 8 is 6; leaving it at 2 would violate lookup’s bucket rule.'),
        }),
        'sets-maps': defineTopic({
          intro: 'A set answers whether a value is present; a map associates each value with a count. This lesson builds two unique-value sets, computes their union and intersection, and counts all occurrences across both inputs. Duplicate membership and duplicate frequency are intentionally different.',
          invariant: 'Each set contains each processed value once; counts[value] equals the number of processed occurrences across both inputs.',
          takeaway: 'Sets forget multiplicity, while maps can preserve it. Output here follows insertion order, not numeric sorting.',
          complexity: { time: 'Expected O(n + m) with hash-backed sets/maps for input lengths n and m.', space: 'O(u) unique memberships and counts for u distinct values; integer hashing is treated as constant cost.' },
          examples: [
            { label: 'Shared duplicates', input: { left: [1, 2, 2], right: [2, 3] }, expected: 'union [1, 2, 3]; intersection [2]; counts [1:1, 2:3, 3:1]' },
            { label: 'Empty left and negative duplicate', input: { left: [], right: [-1, -1, 0] }, expected: 'union [-1, 0]; intersection []; counts [-1:2, 0:1]' },
          ],
          trace({ left, right }) {
            const a = new Set(), b = new Set(), counts = new Map();
            const view = () => cells('hash', Array.from(counts, ([value, count]) => `${value}:${count}`), [], { secondary: [...a].map(v => `L:${v}`).concat([...b].map(v => `R:${v}`)) });
            const r = recording('No membership or frequency', 'Primary cells are value:count; secondary cells show distinct left and right memberships.', view());
            for (const [name, values, set] of [['left', left, a], ['right', right, b]]) {
              values.forEach((value, i) => {
                const wasPresent = set.has(value);
                set.add(value); counts.set(value, (counts.get(value) ?? 0) + 1);
                r.step(`Consume ${name}[${i}] = ${value}`, `${wasPresent ? 'Membership already existed' : 'Add new membership'}; frequency still increases to ${counts.get(value)}.`, view());
              });
            }
            const union = new Set(a), intersection = [];
            for (const value of b) {
              const present = union.has(value); union.add(value);
              r.step(`Union considers ${value}`, present ? 'The value is already represented once; no duplicate membership is added.' : 'Add the right-only value to the union.', cells('array', [...union]));
            }
            for (const value of a) {
              const shared = b.has(value);
              if (shared) intersection.push(value);
              r.step(`Intersection tests ${value}`, shared ? 'The right set also contains this value, so retain it.' : 'The value occurs only in the left set, so exclude it.', cells('array', [...a], [], { secondary: intersection }));
            }
            return r.done('Union, intersection, and occurrence counts answer three different questions.', view(), `union ${show([...union])}; intersection ${show(intersection)}; counts ${show(Array.from(counts, ([value, count]) => `${value}:${count}`))}`);
          },
          code: indentedCode(
            `build leftSet and rightSet by unique insertion
      increment counts[value] for every occurrence in either input
      union ← unique values from left then right
      intersection ← leftSet values also in rightSet`,
            `function setMap(left, right) {
        const a = new Set(left), b = new Set(right), counts = new Map();
        for (const values of [left, right])
          for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
        const union = new Set([...a, ...b]);
        const intersection = [...a].filter(value => b.has(value));
        return { union: [...union], intersection, counts: [...counts] };
      }`,
            `def set_map(left, right):
          a, b = set(left), set(right)
          counts = {}
          for values in (left, right):
              for value in values:
                  counts[value] = counts.get(value, 0) + 1
          ordered_left = list(dict.fromkeys(left))
          union = list(dict.fromkeys(left + right))
          intersection = [value for value in ordered_left if value in b]
          return union, intersection, list(counts.items())`),
          quiz: quiz('Inserting value 2 twice into a set and a frequency map has which effect?', ['Both store two separate keys', 'Set membership stays one; frequency becomes two', 'Both discard the second occurrence completely', 'The set becomes sorted'], 1, 'A set records presence while a frequency map records how many times presence was observed.'),
          challenge: challenge('For left [4, 4] and right [4], what are intersection and total count?', 'intersection [4]; count of 4 is 3', 'Count occurrences separately from membership.', 'Both sets contain one membership for 4, but the combined inputs contain three occurrences.'),
        }),
        'bloom-filters': defineTopic({
          intro: 'A Bloom filter stores membership evidence in bits, not the keys themselves. Each insertion sets two deterministic hash positions. A query is definitely absent when any required bit is zero, but all-one positions only mean maybe present: different keys can leave identical evidence.',
          invariant: 'Every inserted key has both of its hash positions set; insertion changes bits only from zero to one, so inserted keys are never reported absent.',
          takeaway: 'False positives are allowed, false negatives are not (without deletion). These tiny additive hashes deliberately expose collisions; production filters need better-distributed hash functions.',
          complexity: { time: 'O(L + k) per insert/query for key length L and k = 2 hash positions, since both hashes share one code-point pass.', space: 'O(b) bits for b slots, represented here as b numeric cells; original keys are not stored in the filter.' },
          examples: [
            { label: 'A deliberate false positive', input: { size: 8, insert: ['a'], query: ['a', 'i', 'b'] }, expected: 'queries [a:maybe, i:maybe, b:absent]; bits [0, 1, 0, 1, 0, 0, 0, 0]' },
            { label: 'Two insertions and clear negatives', input: { size: 8, insert: ['b', 'c'], query: ['a', 'b', 'd'] }, expected: 'queries [a:absent, b:maybe, d:absent]; bits [0, 0, 1, 1, 0, 1, 0, 1]' },
          ],
          trace({ size, insert, query }) {
            const bits = Array(size).fill(0), answers = [];
            function hashes(key) {
              let sum = 0, weighted = 0, i = 0;
              for (const ch of key) { const cp = ch.codePointAt(0); sum += cp; weighted += ++i * cp; }
              return [sum % size, (sum + weighted + 1) % size];
            }
            const r = recording('Zero membership evidence', 'Hash one is code-point sum modulo size; hash two is (sum + position-weighted sum + 1) modulo size.', cells('bits', bits), [['Bits', size], ['Hashes', 2]]);
            insert.forEach((key, i) => {
              const positions = hashes(key);
              positions.forEach((position, h) => {
                const old = bits[position]; bits[position] = 1;
                r.step(`Insert ${i}, hash ${h + 1}: bit ${position}`, `Key "${key}" sets this position; ${old === 1 ? 'existing evidence remains one' : 'zero becomes one'}.`, cells('bits', bits, [position]), [['Hash position', position]]);
              });
            });
            query.forEach((key, i) => {
              const positions = hashes(key);
              const maybe = positions.every(position => bits[position] === 1);
              answers.push(`${key}:${maybe ? 'maybe' : 'absent'}`);
              r.step(`Query ${i}: "${key}"`, maybe ? `Both positions ${show(positions)} are set. The filter cannot distinguish this key from a collision, so return maybe.` : `At least one of positions ${show(positions)} is zero; this key was definitely not inserted.`, cells('bits', bits, [...new Set(positions)], { secondary: answers }));
            });
            return r.done('Only the caller’s original insertion list reveals which maybe answers are false positives; the filter itself stores no exact membership.', cells('bits', bits, [], { secondary: answers }), `queries ${show(answers)}; bits ${show(bits)}`);
          },
          code: indentedCode(
            `hashes(key): sum code points and their 1-based weighted sum
      return (sum mod b, (sum + weighted + 1) mod b)
      insert: set both hash-position bits
      query: if any required bit is zero return absent; else return maybe`,
            `class Bloom {
        constructor(size) { this.bits = Array(size).fill(0); }
        hashes(key) {
          let sum = 0, weighted = 0, i = 0;
          for (const ch of key) {
            const cp = ch.codePointAt(0); sum += cp; weighted += ++i * cp;
          }
          const b = this.bits.length;
          return [sum % b, (sum + weighted + 1) % b];
        }
        insert(key) { for (const h of this.hashes(key)) this.bits[h] = 1; }
        query(key) { return this.hashes(key).every(h => this.bits[h]) ? 'maybe' : 'absent'; }
      }`,
            `class Bloom:
          def __init__(self, size):
              self.bits = [0] * size
          def hashes(self, key):
              total = weighted = 0
              for i, ch in enumerate(key, 1):
                  total += ord(ch)
                  weighted += i * ord(ch)
              b = len(self.bits)
              return total % b, (total + weighted + 1) % b
          def insert(self, key):
              for h in self.hashes(key):
                  self.bits[h] = 1
          def query(self, key):
              return "maybe" if all(self.bits[h] for h in self.hashes(key)) else "absent"`),
          quiz: quiz('Both required bits are one for a queried key. What can the filter conclude?', ['Definitely present', 'Maybe present', 'Definitely absent', 'The key must be duplicated'], 1, 'Other inserted keys can set the same positions, producing a false positive.'),
          challenge: challenge('Why is clearing the two bits for one deleted key unsafe in an ordinary Bloom filter?', 'Other keys may depend on those same bits, causing false negatives.', 'Bits are shared membership evidence.', 'Deletion needs extra information such as counters; ordinary bits do not record which insertions set them.'),
        }),
      });

Object.assign(topics, {
  'maximum-subarray': defineTopic({
    intro: 'Kadane’s algorithm asks a local question at each element: is the best nonempty subarray ending here a fresh start, or an extension of yesterday’s best ending here? A second variable remembers the best answer seen anywhere.',
    invariant: 'ending is the largest sum of a nonempty subarray ending at the current index; best is the largest sum among all processed endpoints.',
    takeaway: 'Initialize from the first value, not zero, when the subarray must be nonempty. Otherwise all-negative inputs incorrectly return an empty answer.',
    complexity: { time: 'O(n) for n values in one pass.', space: 'O(1) auxiliary state; only sums are returned, not the subarray.' },
    examples: [{ label: 'Restart after a loss', input: [-2, 3, -1, 4, -5], expected: '6' }, { label: 'All-negative nonempty answer', input: [-8, -3, -5], expected: '-3' }],
    trace(values) {
      const r = recording('Choose a nonempty subarray', 'Each endpoint compares restarting against extending.', array(values));
      if (!values.length) return r.done('No nonempty subarray exists.', array(values), 'empty');
      let ending = values[0], best = ending;
      r.step('Initialize at index 0', `The only subarray so far has sum ${ending}.`, array(values, [0]), [['Ending', ending], ['Best', best]]);
      for (let i = 1; i < values.length; i++) {
        const extend = ending + values[i], restart = values[i];
        ending = Math.max(restart, extend);
        best = Math.max(best, ending);
        r.step(`Choose at endpoint ${i}`, `Restart gives ${restart}; extend gives ${extend}. Keep ${ending} here and ${best} overall.`, array(values, [i]), [['Ending', ending], ['Best', best]]);
      }
      return r.done('Every possible endpoint has contributed its best nonempty candidate.', array(values), best);
    },
    code: code(
      `ending ← a[0]; best ← ending
for value in a after the first:
  ending ← max(value, ending + value)
  best ← max(best, ending)
return best`,
      `function maxSubarray(a) {
  if (!a.length) return null;
  let ending = a[0], best = ending;
  for (let i = 1; i < a.length; i++) {
    const x = a[i];
    ending = Math.max(x, ending + x);
    best = Math.max(best, ending);
  }
  return best;
}`,
      `def max_subarray(a):
    if not a:
        return None
    ending = best = a[0]
    for i in range(1, len(a)):
        value = a[i]
        ending = max(value, ending + value)
        best = max(best, ending)
    return best`),
    quiz: quiz('Why is initializing best = 0 wrong for nonempty all-negative inputs?', ['It is slower', 'It permits an empty subarray to win', 'It loses positive values', 'It sorts the input'], 1, 'Zero exceeds every valid negative sum but does not correspond to a nonempty subarray.'),
    challenge: challenge('What does Kadane return for [-4, -1, -6]?', '-1', 'A single element is a valid subarray.', 'Restarting at -1 beats extending a negative prefix, and no later endpoint improves it.'),
  }),
  'merge-intervals': defineTopic({
    intro: 'Closed intervals can be united after sorting by start position. The last output interval is the only candidate that a new interval can overlap. If the new start is beyond its end, begin a separate component; otherwise extend the end as needed.',
    invariant: 'Output intervals are sorted and disjoint, and their union equals the union of all processed input intervals.',
    takeaway: 'This version merges touching closed intervals because start ≤ end counts as overlap. Half-open intervals may use a different boundary rule.',
    complexity: { time: 'O(n log n) for sorting n intervals, followed by O(n) merging.', space: 'O(n) copied input and output; sort workspace depends on the runtime.' },
    examples: [
      { label: 'Overlap and touching boundary', input: [[5, 7], [1, 3], [3, 6], [9, 10]], expected: '[[1, 7], [9, 10]]' },
      { label: 'Nested and separate', input: [[1, 8], [2, 4], [10, 11]], expected: '[[1, 8], [10, 11]]' },
    ],
    trace(input) {
      const sorted = input.map(x => [...x]), merged = [];
      const view = (values, active = []) => ({ kind: 'intervals', values, active });
      const r = recording('Unordered closed intervals', 'Each pair includes both endpoints.', view(sorted));
      sorted.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      r.step('Sort by left endpoint', 'Sorted starts make every earlier disconnected component permanently complete.', view(sorted));
      sorted.forEach(([start, end], i) => {
        const last = merged[merged.length - 1];
        if (last && start <= last[1]) {
          const old = last[1];
          last[1] = Math.max(last[1], end);
          r.step(`Unite interval ${i}`, `Start ${start} touches or precedes ${old}; the component now ends at ${last[1]}.`, view(merged, [merged.length - 1]));
        } else {
          merged.push([start, end]);
          r.step(`Open component ${merged.length - 1}`, `Start ${start} is beyond the previous component, so no overlap remains.`, view(merged, [merged.length - 1]));
        }
      });
      return r.done('The disjoint components cover exactly the original union.', view(merged), `[${merged.map(show).join(', ')}]`);
    },
    code: code(
      `sort intervals by start
output ← []
for (start, end):
  if output empty or start > last.end: append interval
  else: last.end ← max(last.end, end)`,
      `function mergeIntervals(intervals) {
  const out = [];
  for (const [s, e] of intervals.slice().sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (!last || s > last[1]) out.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }
  return out;
}`,
      `def merge_intervals(intervals):
    out = []
    for start, end in sorted(intervals):
        if not out or start > out[-1][1]:
            out.append([start, end])
        else:
            out[-1][1] = max(out[-1][1], end)
    return out`),
    quiz: quiz('Under closed-interval semantics, do [1, 3] and [3, 5] merge?', ['No, starts differ', 'Yes, they share endpoint 3', 'Only if lengths match', 'Only if input was already sorted'], 1, 'Their intersection contains 3, producing the union [1, 5].'),
    challenge: challenge('Merge [[1, 9], [2, 3], [4, 7]].', '[[1, 9]]', 'Do not shrink the end for a nested interval.', 'Both later intervals lie inside the first; max(old end, new end) keeps 9.'),
  }),
  'pattern-matching': defineTopic({
    intro: 'Naive substring search aligns the pattern at each possible start and compares characters from left to right. A mismatch abandons only that alignment. This trace returns the first match, using case-sensitive Unicode code points rather than locale rules.',
    invariant: 'Before testing start s, every earlier start has a proven mismatch; within an alignment, all pattern positions before j match.',
    takeaway: 'Starting fresh after every mismatch is simple but can repeat many comparisons when the text and pattern share long prefixes.',
    complexity: { time: 'O(nm) worst-case comparisons for n text code points and m pattern code points.', space: 'O(n + m) code-point arrays in these implementations; the index-only search state is O(1).' },
    examples: [{ label: 'Match after an earlier mismatch', input: { text: 'ababa', pattern: 'bab' }, expected: 'index 1' }, { label: 'Absent pattern', input: { text: 'aaaa', pattern: 'ab' }, expected: 'not found' }],
    trace({ text, pattern }) {
      const t = Array.from(text), p = Array.from(pattern);
      const r = recording('Prepare alignments', 'Indices refer to code points in the text; matching is case-sensitive.', cells('text', t, [], { secondary: p }));
      let result = p.length ? 'not found' : 'index 0';
      for (let s = 0; p.length && s <= t.length - p.length; s++) {
        let j = 0;
        for (; j < p.length; j++) {
          const match = t[s + j] === p[j];
          r.step(`Alignment ${s}, character ${j}`, `Compare ${t[s + j]} with ${p[j]}: ${match ? 'equal, continue' : 'mismatch, shift alignment'}.`, cells('text', t, [s + j], { secondary: p }), [['Start', s], ['Pattern index', j]]);
          if (!match) break;
        }
        if (j === p.length) { result = `index ${s}`; break; }
      }
      return r.done('All characters of the first successful alignment match, or every legal start has failed.', cells('text', t, [], { secondary: p }), result);
    },
    code: code(
      `for start from 0 to n − m:
  j ← 0
  while j < m and text[start + j] = pattern[j]: j ← j + 1
  if j = m: return start
return missing`,
      `function naiveSearch(text, pattern) {
  const t = Array.from(text), p = Array.from(pattern);
  for (let s = 0; s <= t.length - p.length; s++) {
    let j = 0;
    while (j < p.length && t[s + j] === p[j]) j++;
    if (j === p.length) return s;
  }
  return -1;
}`,
      `def naive_search(text, pattern):
    for start in range(len(text) - len(pattern) + 1):
        j = 0
        while j < len(pattern) and text[start + j] == pattern[j]:
            j += 1
        if j == len(pattern):
            return start
    return -1`),
    quiz: quiz('After a mismatch in naive search, which alignment is tested next?', ['The same alignment forever', 'The next text start', 'Only the final text character', 'A randomly chosen start'], 1, 'A mismatch proves this start invalid, but says nothing about the immediately following start.'),
    challenge: challenge('Find the first occurrence of "aa" in "baaa".', 'index 1', 'Return the first complete alignment.', 'Start 0 mismatches b against a; positions 1 and 2 form the first match.'),
  }),
  'kmp-search': defineTopic({
    intro: 'KMP records a pattern’s reusable borders: prefixes that are also suffixes. On a mismatch after j matched characters, the longest border tells us how many matches remain useful. The text cursor never moves backward.',
    invariant: 'j pattern characters equal the suffix of text already consumed; lps[k] is the longest proper prefix of pattern[0..k] that is also its suffix.',
    takeaway: 'A fallback changes the pattern position without consuming the mismatching text character. Border preprocessing is what makes that reuse safe.',
    complexity: { time: 'O(n + m) for n text and m pattern code points, including border preprocessing.', space: 'O(n + m) code-point arrays and O(m) border table; search cursors themselves use O(1).' },
    examples: [{ label: 'Reuse a repeated border', input: { text: 'abababac', pattern: 'ababac' }, expected: 'index 2' }, { label: 'No complete match', input: { text: 'aaaa', pattern: 'aaab' }, expected: 'not found' }],
    trace({ text, pattern }) {
      const t = Array.from(text), p = Array.from(pattern), lps = Array(p.length).fill(0);
      const r = recording('Pattern border table', 'Zero means no nonempty proper border has been established.', cells('text', p, [], { secondary: lps }));
      let length = 0;
      for (let i = 1; i < p.length;) {
        if (p[i] === p[length]) {
          lps[i] = ++length;
          r.step(`Extend border at ${i}`, `The equal character grows this prefix-suffix border to ${length}.`, cells('text', p, [i], { secondary: lps }));
          i++;
        } else if (length) {
          const old = length; length = lps[length - 1];
          r.step(`Fallback border ${old} to ${length}`, 'Try the next shorter border without advancing the pattern build position.', cells('text', p, [i], { secondary: lps }));
        } else {
          r.step(`No border at ${i}`, 'A mismatch at border length zero leaves lps at zero.', cells('text', p, [i], { secondary: lps }));
          i++;
        }
      }
      let i = 0, j = 0, result = p.length ? 'not found' : 'index 0';
      while (p.length && i < t.length) {
        if (t[i] === p[j]) {
          r.step(`Match text ${i} with pattern ${j}`, 'Consume this text character and extend the matched prefix.', cells('text', t, [i], { secondary: p }), [['Matched after comparison', j + 1]]);
          i++; j++;
          if (j === p.length) { result = `index ${i - j}`; break; }
        } else if (j) {
          const old = j; j = lps[j - 1];
          r.step(`Reuse border at text ${i}`, `Mismatch after ${old} matches; keep ${j} suffix matches and retry this same text character.`, cells('text', t, [i], { secondary: p }), [['Pattern position', j]]);
        } else {
          r.step(`Skip unmatched text ${i}`, 'With no matched prefix to reuse, consume one text character.', cells('text', t, [i], { secondary: p }));
          i++;
        }
      }
      return r.done('The search uses border fallbacks instead of rewinding the text cursor.', cells('text', t, [], { secondary: p }), result);
    },
    code: code(
      `build lps using shorter-border fallback on mismatch
i ← 0; j ← 0
while i < n:
  if text[i] = pattern[j]: advance i and j
  else if j > 0: j ← lps[j − 1]
  else: advance i
  if j = m: return i − m`,
      `function kmp(text, pattern) {
  const t = Array.from(text), p = Array.from(pattern), lps = Array(p.length).fill(0);
  if (!p.length) return 0;
  for (let i = 1, j = 0; i < p.length;) {
    if (p[i] === p[j]) lps[i++] = ++j;
    else if (j) j = lps[j - 1];
    else i++;
  }
  for (let i = 0, j = 0; i < t.length;) {
    if (t[i] === p[j]) { i++; j++; }
    else if (j) j = lps[j - 1];
    else i++;
    if (j === p.length) return i - j;
  }
  return -1;
}`,
      `def kmp(text, pattern):
    if not pattern:
        return 0
    lps = [0] * len(pattern)
    i, j = 1, 0
    while i < len(pattern):
        if pattern[i] == pattern[j]:
            j += 1
            lps[i] = j
            i += 1
        elif j:
            j = lps[j - 1]
        else:
            i += 1
    i = j = 0
    while i < len(text):
        if text[i] == pattern[j]:
            i += 1
            j += 1
        elif j:
            j = lps[j - 1]
        else:
            i += 1
        if j == len(pattern):
            return i - j
    return -1`),
    quiz: quiz('A mismatch occurs with j > 0. Which cursor stays fixed during fallback?', ['The text cursor', 'Both must rewind', 'Only the input length', 'Neither; both advance'], 0, 'The text character has not matched yet; KMP retries it against the shorter reusable border.'),
    challenge: challenge('What is the lps table for "abab"?', '[0, 0, 1, 2]', 'Use proper prefix-suffix borders.', 'The prefixes a, ab, aba, abab have longest proper borders of lengths 0, 0, 1, 2.'),
  }),
  '2d-arrays': defineTopic({
    intro: 'A rectangular grid has two independent indices. Transposition swaps their roles: an input cell at row r, column c is written to output row c, column r. A nonsquare example makes the change in dimensions visible.',
    invariant: 'Every visited source cell [r, c] has been copied to output[c, r]; no other destination cell has been initialized.',
    takeaway: 'Rows and columns are not interchangeable dimensions. A rectangular transpose needs a new grid unless a specialized in-place representation is used.',
    complexity: { time: 'O(RC) for an R-by-C rectangular matrix.', space: 'O(RC) for the returned C-by-R matrix; traversal indices use O(1).' },
    examples: [{ label: 'Two by three', input: [[1, 2, 3], [4, 5, 6]], expected: '[[1, 4], [2, 5], [3, 6]]' }, { label: 'One-column negatives', input: [[-1], [0]], expected: '[[-1, 0]]' }],
    trace(matrix) {
      const rows = matrix.length, cols = matrix[0]?.length ?? 0;
      const out = Array.from({ length: cols }, () => Array(rows).fill('unset'));
      const r = recording('Source dimensions', `The ${rows}-by-${cols} input becomes a ${cols}-by-${rows} output.`, { kind: 'grid', matrix, active: [] });
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        out[col][row] = matrix[row][col];
        r.step(`Copy [${row}, ${col}] to [${col}, ${row}]`, `Write ${matrix[row][col]} into the transposed coordinate, not into the original row.`, { kind: 'grid', matrix: out, active: [[col, row]] }, [['Source row', row], ['Source column', col]]);
      }
      return r.done('All source coordinates have a unique transposed destination.', { kind: 'grid', matrix: out, active: [] }, `[${out.map(show).join(', ')}]`);
    },
    code: code(
      `allocate output with C rows and R columns
for r from 0 to R − 1:
  for c from 0 to C − 1:
    output[c][r] ← input[r][c]`,
      `function transpose(a) {
  const rows = a.length, cols = a[0]?.length ?? 0;
  const out = Array.from({ length: cols }, () => Array(rows));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out[c][r] = a[r][c];
  return out;
}`,
      `def transpose(a):
    rows, cols = len(a), len(a[0]) if a else 0
    out = [[None] * rows for _ in range(cols)]
    for r in range(rows):
        for c in range(cols):
            out[c][r] = a[r][c]
    return out`),
    quiz: quiz('A 2-by-5 matrix is transposed. What are the new dimensions?', ['2 by 5', '5 by 2', '10 by 1', '5 by 5'], 1, 'Each original column becomes an output row.'),
    challenge: challenge('Transpose [[2, 7], [3, 8], [4, 9]].', '[[2, 3, 4], [7, 8, 9]]', 'Read each source column into a row.', 'The output has two rows, each with three entries.'),
  }),
});

function chain(values, doubly = false) {
  const nodes = values.map((value, i) => ({ id: `n${i}`, value, next: null, ...(doubly ? { prev: null } : {}) }));
  nodes.forEach((node, i) => {
    node.next = nodes[i + 1] ?? null;
    if (doubly) node.prev = nodes[i - 1] ?? null;
  });
  return { head: nodes[0] ?? null, tail: nodes[nodes.length - 1] ?? null, nodes };
}
function walk(head, direction = 'next') {
  const out = [], seen = new Set();
  while (head && !seen.has(head)) { seen.add(head); out.push(head); head = head[direction]; }
  return out;
}
function linkedView(head, active = [], extra = {}) {
  const nodes = walk(head);
  return cells('list', nodes.map(n => n.value), nodes.flatMap((n, i) => active.includes(n) ? [i] : []), {
    labels: nodes.map(n => `${n.id} → ${n.next?.id ?? 'null'}`), ...extra,
  });
}

Object.assign(topics, {
  'singly-linked-lists': defineTopic({
    intro: 'A singly linked list stores the route to the next node inside each node. Inserting after a known position changes links without shifting values. Deleting the first node with a requested value requires finding its predecessor, which is different from knowing an array index.',
    invariant: 'Starting at head and following next visits each live list node exactly once; bypassing a deleted node preserves the rest of the chain.',
    takeaway: 'Insertion is constant-time once the predecessor is known, but finding that predecessor can take a full traversal. Equal values are not equal node identities.',
    complexity: { time: 'O(n) to find an insertion predecessor and the first deletion match in an n-node list; each splice is O(1).', space: 'O(1) auxiliary pointer state plus one inserted node, excluding simulated node storage and trace output.' },
    examples: [
      { label: 'Delete only first duplicate', input: { values: [1, 2, 2], after: 0, value: 9, remove: 2 }, expected: '[1, 9, 2]' },
      { label: 'Insert at empty head', input: { values: [], after: -1, value: 5, remove: 8 }, expected: '[5]' },
    ],
    trace({ values, after, value, remove }) {
      let { head } = chain(values);
      const r = recording('Original next chain', 'Each label names its stored successor; duplicate values can occupy different nodes.', linkedView(head, [], { secondary: [value, remove] }));
      let predecessor = null, current = head;
      for (let i = 0; i <= after && current; i++) {
        predecessor = current; current = current.next;
        r.step(`Find insertion predecessor ${i}`, `Follow next from ${predecessor.id}; its successor is ${current?.id ?? 'null'}.`, linkedView(head, [predecessor]));
      }
      const added = { id: 'inserted', value, next: predecessor ? predecessor.next : head };
      if (predecessor) predecessor.next = added; else head = added;
      r.step('Splice the new node', 'First save the former successor in the new node, then redirect the predecessor (or head).', linkedView(head, [added]));
      predecessor = null; current = head;
      while (current && current.value !== remove) {
        r.step(`Inspect ${current.id}`, `Value ${current.value} is not ${remove}; keep this node and follow its next link.`, linkedView(head, [current]));
        predecessor = current; current = current.next;
      }
      if (current) {
        if (predecessor) predecessor.next = current.next; else head = current.next;
        current.next = null;
        r.step(`Unlink first value ${remove}`, 'Only the first matching node is bypassed; later equal values stay in the list.', linkedView(head, predecessor ? [predecessor] : []));
      } else r.step('Deletion target absent', `Traversal reached null without finding ${remove}; no links change.`, linkedView(head));
      return r.done('Read the result by following links from the possibly updated head.', linkedView(head), show(walk(head).map(n => n.value)));
    },
    code: code(
      `find predecessor at after, or use head boundary
new.next ← predecessor.next (or head)
redirect predecessor.next (or head) to new
scan until first node.value = remove
redirect its predecessor (or head) to node.next`,
      `function editList(head, after, value, remove) {
  let prev = null, cur = head;
  for (let i = 0; i <= after && cur; i++) { prev = cur; cur = cur.next; }
  const node = { value, next: prev ? prev.next : head };
  if (prev) prev.next = node; else head = node;
  prev = null; cur = head;
  while (cur && cur.value !== remove) { prev = cur; cur = cur.next; }
  if (cur) {
    if (prev) prev.next = cur.next; else head = cur.next;
    cur.next = null;
  }
  return head;
}`,
      `def edit_list(head, after, value, remove):
    prev, cur = None, head
    for _ in range(after + 1):
        if cur is None:
            break
        prev, cur = cur, cur["next"]
    node = {"value": value, "next": prev["next"] if prev else head}
    if prev:
        prev["next"] = node
    else:
        head = node
    prev, cur = None, head
    while cur and cur["value"] != remove:
        prev, cur = cur, cur["next"]
    if cur:
        if prev:
            prev["next"] = cur["next"]
        else:
            head = cur["next"]
        cur["next"] = None
    return head`),
    quiz: quiz('What must be saved before redirecting predecessor.next during insertion?', ['The old successor', 'The largest value', 'The list length in every node', 'An array offset'], 0, 'The new node must point to the old successor or the remainder of the list would be lost.'),
    challenge: challenge('Remove the head of 4 → 7 → null. What pointer changes?', 'head becomes the node containing 7.', 'The head has no predecessor node.', 'A head deletion updates the external entry pointer instead of a predecessor.next field.'),
  }),
  'doubly-linked-lists': defineTopic({
    intro: 'Doubly linked nodes store both next and previous links. Once a target node is known, removal reconnects its two neighbors in both directions. The head and tail need special updates when the target lies at a boundary.',
    invariant: 'For adjacent live nodes a and b, a.next = b implies b.prev = a; head.prev and tail.next are null.',
    takeaway: 'A doubly linked removal has two link repairs, not just one. Correct forward traversal alone does not prove the reverse chain is intact.',
    complexity: { time: 'O(n) to locate the first matching value, then O(1) unlinking; reverse traversal shown costs O(n).', space: 'O(1) auxiliary removal pointers, excluding the list and displayed traversal output.' },
    examples: [{ label: 'Remove interior node', input: { values: [2, 4, 6], remove: 4 }, expected: 'forward [2, 6]; backward [6, 2]' }, { label: 'Remove singleton', input: { values: [9], remove: 9 }, expected: 'forward []; backward []' }],
    trace({ values, remove }) {
      let { head, tail } = chain(values, true);
      const view = active => {
        const nodes = walk(head);
        return cells('list', nodes.map(n => n.value), nodes.flatMap((n, i) => n === active ? [i] : []), { labels: nodes.map(n => `${n.prev?.id ?? 'null'} ← ${n.id} → ${n.next?.id ?? 'null'}`) });
      };
      const r = recording('Bidirectional links', `Find the first node containing ${remove}.`, view());
      let node = head;
      while (node && node.value !== remove) {
        r.step(`Traverse ${node.id}`, 'The value does not match; move to its next neighbor.', view(node));
        node = node.next;
      }
      if (node) {
        const before = node.prev, after = node.next;
        if (before) before.next = after; else head = after;
        r.step(`Repair forward link around ${node.id}`, before ? `${before.id}.next now points to ${after?.id ?? 'null'}. The backward link still needs repair.` : 'The removed head is replaced by its successor; its prev still needs clearing.', view(before));
        if (after) after.prev = before; else tail = before;
        node.next = node.prev = null;
        r.step('Repair backward link and detach', after ? `${after.id}.prev now points to ${before?.id ?? 'null'}.` : 'The removed tail is replaced by its predecessor.', view(after));
      } else r.step('No removal match', 'The scan reaches null; the bidirectional chain is unchanged.', view());
      const reverse = [];
      for (let cur = tail; cur; cur = cur.prev) {
        reverse.push(cur.value);
        r.step(`Walk backward from ${cur.id}`, 'Following prev independently verifies the surviving reverse route.', view(cur), [['Backward values', show(reverse)]]);
      }
      return r.done('Both traversal directions now agree on the same surviving nodes.', view(), `forward ${show(walk(head).map(n => n.value))}; backward ${show(reverse)}`);
    },
    code: code(
      `scan next links for target node
if node.prev exists: node.prev.next ← node.next
else: head ← node.next
if node.next exists: node.next.prev ← node.prev
else: tail ← node.prev
clear removed node links`,
      `function removeNode(head, tail, value) {
  let node = head;
  while (node && node.value !== value) node = node.next;
  if (!node) return { head, tail };
  if (node.prev) node.prev.next = node.next; else head = node.next;
  if (node.next) node.next.prev = node.prev; else tail = node.prev;
  node.next = node.prev = null;
  return { head, tail };
}`,
      `def remove_node(head, tail, value):
    node = head
    while node and node.value != value:
        node = node.next
    if node is None:
        return head, tail
    if node.prev:
        node.prev.next = node.next
    else:
        head = node.next
    if node.next:
        node.next.prev = node.prev
    else:
        tail = node.prev
    node.next = node.prev = None
    return head, tail`),
    quiz: quiz('After deleting the head, what must the new head.prev contain?', ['The deleted node', 'The tail', 'null', 'Its own address'], 2, 'The new head has no previous live neighbor.'),
    challenge: challenge('Delete tail 8 from 3 ⇄ 8. Which surviving link must be cleared?', 'The node containing 3 must have next = null.', 'A tail has no successor.', 'The predecessor becomes the tail, and its forward link cannot still address the removed node.'),
  }),
  'fast-slow-pointers': defineTopic({
    intro: 'Floyd’s cycle detector advances one pointer by one link and another by two. A meeting proves a reachable cycle, not its starting node. Resetting one pointer to head and moving both one step locates the entry without a visited-node table.',
    invariant: 'After t detection rounds slow has traveled t links and fast 2t; in a cycle their relative displacement advances modulo the cycle length.',
    takeaway: 'Compare node identities rather than values: duplicate data does not create a cycle. Always guard both fast and fast.next before a double step.',
    complexity: { time: 'O(n) for n distinct reachable nodes, including the entry-location phase.', space: 'O(1) algorithm pointers; the simulated linked input and trace storage are excluded.' },
    examples: [{ label: 'Cycle enters the second node', input: { values: [1, 2, 3, 4], cycleAt: 1 }, expected: 'cycle entry index 1' }, { label: 'Duplicate values without cycle', input: { values: [2, 2, 2], cycleAt: null }, expected: 'no cycle' }],
    trace({ values, cycleAt }) {
      const { head, tail, nodes } = chain(values);
      if (tail && cycleAt != null) tail.next = nodes[cycleAt];
      let slow = head, fast = head;
      const view = () => ({
        kind: 'graph', directed: true,
        nodes: nodes.map((n, i) => ({ id: n.id, label: `${i}: ${n.value}` })),
        edges: nodes.filter(n => n.next).map(n => ({ from: n.id, to: n.next.id, label: 'next' })),
        active: [...new Set([slow?.id, fast?.id].filter(Boolean))],
      });
      const r = recording('Reachable link topology', 'The tail may point into the list; graph edges show actual next references.', view());
      let meeting = false;
      while (fast && fast.next) {
        slow = slow.next; fast = fast.next.next;
        r.step('Advance one and two links', `slow=${slow?.id ?? 'null'}, fast=${fast?.id ?? 'null'}; compare references after moving.`, view());
        if (slow === fast) { meeting = true; break; }
      }
      let result = 'no cycle';
      if (meeting) {
        slow = head;
        r.step('Reset slow to head', 'Keep fast at the meeting point. Equal one-step speeds now converge at the cycle entry.', view());
        while (slow !== fast) {
          slow = slow.next; fast = fast.next;
          r.step('Advance both toward entry', `Both pointers move one link: slow=${slow.id}, fast=${fast.id}.`, view());
        }
        result = `cycle entry index ${nodes.indexOf(slow)}`;
      }
      return r.done(meeting ? 'The equal references identify the first node of the cycle.' : 'The fast route reached a null boundary, proving no reachable cycle.', view(), result);
    },
    code: code(
      `slow ← head; fast ← head
while fast and fast.next:
  slow ← slow.next; fast ← fast.next.next
  if slow is fast: break
if fast is null or fast.next is null: return no cycle
slow ← head
while slow is not fast: move each one link
return slow`,
      `function cycleEntry(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next; fast = fast.next.next;
    if (slow === fast) {
      slow = head;
      while (slow !== fast) { slow = slow.next; fast = fast.next; }
      return slow;
    }
  }
  return null;
}`,
      `def cycle_entry(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
        if slow is fast:
            slow = head
            while slow is not fast:
                slow, fast = slow.next, fast.next
            return slow
    return None`),
    quiz: quiz('Two nodes contain value 5. Does slow.value == fast.value prove a cycle?', ['Yes, values identify nodes', 'No, compare node references', 'Only in a sorted list', 'Only in an even-length list'], 1, 'Different nodes may store equal data without any links pointing backward.'),
    challenge: challenge('Where does Floyd report the entry for one node whose next points to itself?', 'That same node, index 0.', 'Both speeds remain at the only node.', 'They meet on the first round; resetting to head already places both pointers at the entry.'),
  }),
});

Object.assign(topics, {
        stacks: defineTopic({
          intro: 'A stack exposes only its top: pushing adds the newest value and popping removes that same newest value first. This operation stream distinguishes a legitimate zero from an empty-stack pop by returning the explicit marker "empty".',
          invariant: 'The stack from bottom to top contains exactly the pushed values that have not yet been popped, in insertion order.',
          takeaway: 'LIFO is a rule about the next removable item, not a rule about sorting. Check emptiness before reading the top.',
          complexity: { time: 'Amortized O(1) per push/pop on a dynamic-array stack; O(q) total for q operations.', space: 'O(s) for maximum live stack size s, plus returned pop values.' },
          examples: [
            { label: 'Last in, first out', input: [['push', 3], ['push', 7], ['pop'], ['push', 0], ['pop']], expected: 'popped [7, 0]; stack [3]' },
            { label: 'Underflow and duplicate pushes', input: [['pop'], ['push', 2], ['push', 2], ['pop']], expected: 'popped [empty, 2]; stack [2]' },
          ],
          trace(operations) {
            const stack = [], popped = [];
            const view = () => cells('stack', stack, stack.length ? [stack.length - 1] : [], { secondary: popped });
            const r = recording('Empty stack', 'The rightmost displayed cell will be the top; only the top can be popped.', { ...view(), secondary: operations.map(op => op.join(' ')) });
            operations.forEach(([op, value], i) => {
              if (op === 'push') {
                stack.push(value);
                r.step(`Push operation ${i}`, `Place ${value} above the former top; older entries remain below it.`, view(), [['Depth', stack.length]]);
              } else {
                const result = stack.length ? stack.pop() : 'empty';
                popped.push(result);
                r.step(`Pop operation ${i}`, result === 'empty' ? 'There is no top to remove; report underflow without mutating the stack.' : `Remove the newest live entry ${result}.`, view(), [['Depth', stack.length]]);
              }
            });
            return r.done('The pop history demonstrates last-in, first-out removal.', view(), `popped ${show(popped)}; stack ${show(stack)}`);
          },
          code: indentedCode(
            `stack ← []; popped ← []
      for operation:
        if push: append value to stack
        if pop: append removed top, or empty if stack has no values`,
            `function stackOps(operations) {
        const stack = [], popped = [];
        for (const [op, value] of operations) {
          if (op === 'push') stack.push(value);
          else popped.push(stack.length ? stack.pop() : 'empty');
        }
        return { stack, popped };
      }`,
            `def stack_ops(operations):
          stack, popped = [], []
          for operation in operations:
              if operation[0] == "push":
                  stack.append(operation[1])
              else:
                  popped.append(stack.pop() if stack else "empty")
          return stack, popped`),
          quiz: quiz('After pushing 4 then 9, which value does the first pop return?', ['4', '9', '13', 'empty'], 1, '9 is the most recently pushed live value and therefore sits at the top.'),
          challenge: challenge('Push 1, push 2, pop, pop, pop. List the returned values.', '[2, 1, empty]', 'There are only two live entries.', 'The newest is removed first, then the older entry, then the underflow marker.'),
        }),
        'balanced-brackets': defineTopic({
          intro: 'Nested brackets require more than counting open and close symbols. A closing bracket must match the most recent unmatched opener. A stack keeps that nesting order while ordinary non-bracket characters are ignored.',
          invariant: 'The stack holds all unmatched opening brackets from the scanned prefix, in nesting order; its top is the only legal partner for the next closer.',
          takeaway: 'Matching totals do not imply correct nesting: ([)] has equal counts but crosses pairs. A nonempty stack at the end also means failure.',
          complexity: { time: 'O(n) for n code points, stopping early on the first mismatch.', space: 'O(n) worst-case unmatched openers and code-point input representation.' },
          examples: [{ label: 'Nested and adjacent pairs', input: '{[()]}()', expected: 'balanced' }, { label: 'Wrong closer', input: '(]', expected: 'invalid at index 1' }],
          trace(text) {
            const chars = Array.from(text), stack = [], partner = { ')': '(', ']': '[', '}': '{' };
            const r = recording('No unmatched openers', 'Scan left to right; ignore characters that are not brackets.', cells('text', chars, [], { secondary: stack }));
            let result = null;
            for (let i = 0; i < chars.length; i++) {
              const ch = chars[i];
              if ('([{'.includes(ch)) {
                stack.push(ch);
                r.step(`Open ${ch} at ${i}`, 'Push this opener because its matching closer must arrive before any outer closer.', cells('text', chars, [i], { secondary: stack }));
              } else if (Object.hasOwn(partner, ch)) {
                if (stack[stack.length - 1] !== partner[ch]) {
                  result = `invalid at index ${i}`;
                  r.step(`Reject ${ch} at ${i}`, `The required opener is ${partner[ch]}, but the top is ${stack[stack.length - 1] ?? 'empty'}.`, cells('text', chars, [i], { secondary: stack }));
                  break;
                }
                stack.pop();
                r.step(`Close pair at ${i}`, `The top matches ${ch}; pop exactly one opener.`, cells('text', chars, [i], { secondary: stack }));
              } else r.step(`Skip non-bracket at ${i}`, 'This character does not affect bracket nesting.', cells('text', chars, [i], { secondary: stack }));
            }
            result ??= stack.length ? `invalid: ${stack.length} unclosed` : 'balanced';
            return r.done('Success requires no mismatch and no unmatched opener remaining.', cells('text', chars, [], { secondary: stack }), result);
          },
          code: indentedCode(
            `for character in text:
        if opener: push it
        else if closer:
          if stack empty or top is not its partner: reject
          pop opener
      accept only if stack empty at end`,
            `function brackets(text) {
        const stack = [], match = { ')': '(', ']': '[', '}': '{' };
        for (const ch of text) {
          if ('([{'.includes(ch)) stack.push(ch);
          else if (Object.hasOwn(match, ch)) {
            if (stack.pop() !== match[ch]) return false;
          }
        }
        return stack.length === 0;
      }`,
            `def brackets(text):
          stack, match = [], {")": "(", "]": "[", "}": "{"}
          for ch in text:
              if ch in "([{":
                  stack.append(ch)
              elif ch in match:
                  if not stack or stack.pop() != match[ch]:
                      return False
          return not stack`),
          quiz: quiz('Why is ([)] invalid even though bracket counts match?', ['It is too short', 'The ) cannot close the top opener [', 'It has no braces', 'Parentheses must always be outermost'], 1, 'The closer must match the stack top; crossing pairs violate nesting.'),
          challenge: challenge('Is "{{}" balanced?', 'No; one opening brace remains unclosed.', 'Inspect the stack after the final closer.', 'The closer removes only the innermost brace, leaving the first opener on the stack.'),
        }),
        queues: defineTopic({
          intro: 'A queue removes values in arrival order. This linked implementation appends at tail and dequeues at head, so neither operation shifts other entries. Removing the last node must clear both endpoints.',
          invariant: 'Following next from head visits queued values in arrival order; tail is the final node and is null exactly when head is null.',
          takeaway: 'FIFO needs two endpoints in a linked implementation. An empty queue is a structural condition, not a special numeric value.',
          complexity: { time: 'O(1) per enqueue/dequeue with linked head and tail pointers; O(q) for q operations.', space: 'O(s) nodes for maximum live queue size s, plus returned dequeue values.' },
          examples: [
            { label: 'Arrivals interleaved with service', input: [['enqueue', 4], ['enqueue', 8], ['dequeue'], ['enqueue', 1], ['dequeue']], expected: 'removed [4, 8]; queue [1]' },
            { label: 'Empty queue can be reused', input: [['dequeue'], ['enqueue', -1], ['dequeue'], ['enqueue', 0]], expected: 'removed [empty, -1]; queue [0]' },
          ],
          trace(operations) {
            let head = null, tail = null;
            const removed = [];
            const view = () => cells('queue', walk(head).map(n => n.value), head ? [0] : [], { secondary: removed });
            const r = recording('Null queue endpoints', 'The first displayed cell is the head; new arrivals attach at the tail.', { ...view(), secondary: operations.map(op => op.join(' ')) });
            operations.forEach(([op, value], i) => {
              if (op === 'enqueue') {
                const node = { value, next: null };
                if (tail) tail.next = node; else head = node;
                tail = node;
                r.step(`Enqueue at operation ${i}`, `Attach ${value} after the old tail; for an empty queue, set head too.`, view());
              } else if (head) {
                const node = head; head = head.next;
                if (!head) tail = null;
                node.next = null; removed.push(node.value);
                r.step(`Dequeue at operation ${i}`, `Remove oldest arrival ${node.value}; clear tail if the queue became empty.`, view());
              } else {
                removed.push('empty');
                r.step(`Underflow at operation ${i}`, 'No head node exists; endpoints remain null.', view());
              }
            });
            return r.done('The removal order comes from head traversal, not from value magnitude.', view(), `removed ${show(removed)}; queue ${show(walk(head).map(n => n.value))}`);
          },
          code: indentedCode(
            `enqueue(value):
        node ← new node(value, next=null)
        if tail exists: tail.next ← node; else head ← node
        tail ← node
      dequeue():
        if head null: return empty
        node ← head; head ← head.next
        if head null: tail ← null
        return node.value`,
            `class Queue {
        constructor() { this.head = this.tail = null; }
        enqueue(value) {
          const node = { value, next: null };
          if (this.tail) this.tail.next = node; else this.head = node;
          this.tail = node;
        }
        dequeue() {
          if (!this.head) return 'empty';
          const value = this.head.value;
          this.head = this.head.next;
          if (!this.head) this.tail = null;
          return value;
        }
      }`,
            `class Queue:
          def __init__(self):
              self.head = self.tail = None
          def enqueue(self, value):
              node = {"value": value, "next": None}
              if self.tail: self.tail["next"] = node
              else: self.head = node
              self.tail = node
          def dequeue(self):
              if self.head is None: return "empty"
              value = self.head["value"]
              self.head = self.head["next"]
              if self.head is None: self.tail = None
              return value`),
          quiz: quiz('Which queue endpoint is removed by dequeue?', ['Tail', 'Head', 'Largest value', 'Middle'], 1, 'The head is the oldest still-waiting arrival.'),
          challenge: challenge('Why clear tail after removing the final queue node?', 'Otherwise tail still references a node outside the queue.', 'Both endpoints must agree about emptiness.', 'A later enqueue must set head as well as tail, not link onto a detached old node.'),
        }),
        'circular-buffer': defineTopic({
          intro: 'A circular buffer reuses a fixed block by wrapping read and write indices modulo capacity. This version stores a count to distinguish empty from full when the indices coincide, and rejects writes on a full buffer rather than overwriting unread data.',
          invariant: 'count live entries begin at head in circular order; tail is the next write position, and 0 ≤ count ≤ capacity.',
          takeaway: 'Physical slot order can differ from FIFO order after wrapping. Specify the full-buffer policy explicitly: rejection and overwrite are different contracts.',
          complexity: { time: 'O(1) per read/write for capacity c ≥ 1; O(q) for q operations.', space: 'O(c) fixed backing cells plus operation outputs.' },
          examples: [
            { label: 'Wrap into a freed slot', input: { capacity: 3, operations: [['write', 1], ['write', 2], ['read'], ['write', 3], ['write', 4]] }, expected: 'events [ok, ok, 1, ok, ok]; buffer [2, 3, 4]' },
            { label: 'Reject full and empty operations', input: { capacity: 1, operations: [['read'], ['write', 7], ['write', 8], ['read']] }, expected: 'events [empty, ok, full, 7]; buffer []' },
          ],
          trace({ capacity, operations }) {
            const buffer = Array(capacity).fill('free'), events = [];
            let head = 0, tail = 0, count = 0;
            const view = () => array(buffer, [...new Set([head, tail])], { labels: buffer.map((_, i) => `${i}${i === head ? ':read' : ''}${i === tail ? ':write' : ''}`), secondary: events });
            const r = recording('Allocated ring slots', 'Read and write both start at slot zero; count zero distinguishes this from full.', view(), [['Count', count]]);
            operations.forEach(([op, value], i) => {
              if (op === 'write') {
                if (count === capacity) {
                  events.push('full');
                  r.step(`Reject write ${i}`, 'Every slot contains unread data; the rejection policy leaves all state unchanged.', view(), [['Count', count]]);
                } else {
                  const slot = tail;
                  buffer[slot] = value; tail = (tail + 1) % capacity; count++;
                  events.push('ok');
                  r.step(`Write ${value} at slot ${slot}`, `Advance tail modulo ${capacity}; it is now ${tail}.`, view(), [['Count', count]]);
                }
              } else if (!count) {
                events.push('empty');
                r.step(`Reject read ${i}`, 'No unread item exists even though the indices may coincide.', view(), [['Count', count]]);
              } else {
                const slot = head, value = buffer[slot];
                buffer[slot] = 'free'; head = (head + 1) % capacity; count--;
                events.push(value);
                r.step(`Read ${value} from slot ${slot}`, `Free the slot and advance head modulo ${capacity} to ${head}.`, view(), [['Count', count]]);
              }
            });
            const logical = Array.from({ length: count }, (_, i) => buffer[(head + i) % capacity]);
            return r.done('The secondary row of events and logical FIFO result are independent of the physical wrapping layout.', view(), `events ${show(events)}; buffer ${show(logical)}`, [['Count', count]]);
          },
          code: indentedCode(
            `allocate capacity slots; head ← tail ← count ← 0
      write(value):
        if count = capacity: return full
        buffer[tail] ← value; tail ← (tail + 1) mod capacity; count++
      read():
        if count = 0: return empty
        value ← buffer[head]; head ← (head + 1) mod capacity; count--
        return value`,
            `class Ring {
        constructor(c) { this.a = Array(c); this.head = this.tail = this.count = 0; }
        write(value) {
          if (this.count === this.a.length) return 'full';
          this.a[this.tail] = value;
          this.tail = (this.tail + 1) % this.a.length; this.count++;
          return 'ok';
        }
        read() {
          if (!this.count) return 'empty';
          const value = this.a[this.head];
          this.a[this.head] = undefined;
          this.head = (this.head + 1) % this.a.length; this.count--;
          return value;
        }
      }`,
            `class Ring:
          def __init__(self, capacity):
              self.a = [None] * capacity
              self.head = self.tail = self.count = 0
          def write(self, value):
              if self.count == len(self.a): return "full"
              self.a[self.tail] = value
              self.tail = (self.tail + 1) % len(self.a)
              self.count += 1
              return "ok"
          def read(self):
              if not self.count: return "empty"
              value = self.a[self.head]
              self.a[self.head] = None
              self.head = (self.head + 1) % len(self.a)
              self.count -= 1
              return value`),
          quiz: quiz('If head == tail, why is count still needed in this ring?', ['To sort values', 'The ring could be either empty or full', 'To store addresses', 'Modulo never wraps'], 1, 'Both zero entries and exactly capacity entries produce coincident indices.'),
          challenge: challenge('Capacity 3 and tail 2: where does tail move after a successful write?', '0', 'Use modulo capacity.', '(2 + 1) % 3 wraps to the first physical slot.'),
        }),
        deques: defineTopic({
          intro: 'A deque permits insertion and removal at both ends. Doubly linked nodes make all four endpoint operations local: each updates an endpoint and, when present, one neighbor link. This is more flexible than a stack or FIFO queue without allowing arbitrary indexed access.',
          invariant: 'Head-to-tail order is the deque order, neighboring next/prev links agree, and both endpoints are null together when empty.',
          takeaway: 'Two-ended access does not mean constant-time access to the middle. Boundary removal must also clear the opposite endpoint for a singleton.',
          complexity: { time: 'O(1) for each of the four linked endpoint operations; O(q) for q operations.', space: 'O(s) nodes for maximum live size s, plus returned removals.' },
          examples: [
            { label: 'Both insertion and removal ends', input: [['pushBack', 2], ['pushFront', 1], ['pushBack', 3], ['popBack'], ['popFront']], expected: 'removed [3, 1]; deque [2]' },
            { label: 'Singleton and underflow', input: [['pushFront', 5], ['popBack'], ['popFront']], expected: 'removed [5, empty]; deque []' },
          ],
          trace(operations) {
            let head = null, tail = null;
            const removed = [];
            const view = () => cells('queue', walk(head).map(n => n.value), [], { labels: walk(head).map((_, i, a) => `${i === 0 ? 'front' : ''}${i === a.length - 1 ? ' back' : ''}`), secondary: removed });
            const r = recording('Two empty endpoints', 'The first cell is front, the last is back; both ends accept operations.', { ...view(), secondary: operations.map(op => op.join(' ')) });
            operations.forEach(([op, value], i) => {
              if (op.startsWith('push')) {
                const node = { value, next: null, prev: null };
                if (op === 'pushFront') {
                  node.next = head;
                  if (head) head.prev = node; else tail = node;
                  head = node;
                } else {
                  node.prev = tail;
                  if (tail) tail.next = node; else head = node;
                  tail = node;
                }
                r.step(`${op} at operation ${i}`, `Link ${value} at the requested end, repairing its neighbor's opposite link.`, view());
              } else {
                const node = op === 'popFront' ? head : tail;
                if (!node) {
                  removed.push('empty');
                  r.step(`${op} underflow ${i}`, 'There is no endpoint node; report empty and preserve the null endpoints.', view());
                } else {
                  if (op === 'popFront') {
                    head = node.next;
                    if (head) head.prev = null; else tail = null;
                  } else {
                    tail = node.prev;
                    if (tail) tail.next = null; else head = null;
                  }
                  node.next = node.prev = null; removed.push(node.value);
                  r.step(`${op} removes ${node.value}`, 'Detach the endpoint and clear the new boundary link; a singleton removal empties both ends.', view());
                }
              }
            });
            return r.done('The remaining values are read from front to back.', view(), `removed ${show(removed)}; deque ${show(walk(head).map(n => n.value))}`);
          },
          code: indentedCode(
            `pushFront: connect new.next to head; repair head.prev; replace head
      pushBack: connect new.prev to tail; repair tail.next; replace tail
      popFront: advance head; clear new head.prev
      popBack: retreat tail; clear new tail.next
      if singleton removed: clear both endpoints`,
            `class Deque {
        constructor() { this.head = this.tail = null; }
        pushFront(value) {
          const n = { value, prev: null, next: this.head };
          if (this.head) this.head.prev = n; else this.tail = n;
          this.head = n;
        }
        pushBack(value) {
          const n = { value, prev: this.tail, next: null };
          if (this.tail) this.tail.next = n; else this.head = n;
          this.tail = n;
        }
        popFront() {
          if (!this.head) return 'empty';
          const n = this.head; this.head = n.next;
          if (this.head) this.head.prev = null; else this.tail = null;
          return n.value;
        }
        popBack() {
          if (!this.tail) return 'empty';
          const n = this.tail; this.tail = n.prev;
          if (this.tail) this.tail.next = null; else this.head = null;
          return n.value;
        }
      }`,
            `from collections import deque

      def deque_ops(operations):
          live, removed = deque(), []
          for operation in operations:
              op = operation[0]
              if op == "pushFront":
                  live.appendleft(operation[1])
              elif op == "pushBack":
                  live.append(operation[1])
              elif op == "popFront":
                  removed.append(live.popleft() if live else "empty")
              else:
                  removed.append(live.pop() if live else "empty")
          return list(live), removed`),
          quiz: quiz('Which operation is supported by a deque but not a standard FIFO queue?', ['Enqueue at back', 'Remove at front', 'Remove at back', 'Check emptiness'], 2, 'A deque can pop its back as well as its front.'),
          challenge: challenge('pushBack(4), pushFront(2), popBack(): what remains?', '[2]', 'The last cell is the back.', 'Adding 2 at the front produces [2, 4]; removing the back removes 4.'),
        }),
        'monotonic-stack': defineTopic({
          intro: 'For each entry, find the first strictly greater value to its right. A stack keeps unresolved indices with nonincreasing values. When a new value is greater than the top, it resolves that top immediately; repeat until the remaining top cannot be resolved.',
          invariant: 'Stack indices increase and their values are nonincreasing; none has yet encountered a strictly greater value to its right.',
          takeaway: 'Store indices to distinguish duplicates and fill the correct output cells. Equal values do not satisfy a strictly-greater query.',
          complexity: { time: 'O(n) total: each index is pushed once and popped at most once.', space: 'O(n) stack and result storage.' },
          examples: [{ label: 'Duplicates wait for a greater value', input: [2, 2, 3, 1], expected: '[3, 3, none, none]' }, { label: 'Decreasing negatives', input: [-1, -2, -3], expected: '[none, none, none]' }],
          trace(values) {
            const pending = [], result = Array(values.length).fill('none');
            const view = active => array(values, active, { secondary: result });
            const r = recording('Unresolved next-greater queries', 'Every output begins as none; pending indices have not seen a greater value yet.', view([]));
            for (let i = 0; i < values.length; i++) {
              while (pending.length && values[pending[pending.length - 1]] < values[i]) {
                const j = pending.pop(); result[j] = values[i];
                r.step(`Resolve index ${j} with ${i}`, `${values[i]} is strictly greater than ${values[j]} and is the first such value encountered.`, view([j, i]), [['Pending indices', show(pending)]]);
              }
              pending.push(i);
              r.step(`Push unresolved index ${i}`, 'The stack now remains nonincreasing by value; equal entries stay unresolved.', view([i]), [['Pending indices', show(pending)]]);
            }
            return r.done('Entries still on the pending stack have no greater value to their right.', view([]), show(result));
          },
          code: indentedCode(
            `result ← none for each entry; stack ← []
      for index i:
        while stack nonempty and a[stack.top] < a[i]:
          j ← pop stack; result[j] ← a[i]
        push i
      return result`,
            `function nextGreater(a) {
        const stack = [], out = Array(a.length).fill('none');
        for (let i = 0; i < a.length; i++) {
          while (stack.length && a[stack[stack.length - 1]] < a[i])
            out[stack.pop()] = a[i];
          stack.push(i);
        }
        return out;
      }`,
            `def next_greater(a):
          pending, out = [], ["none"] * len(a)
          for i, value in enumerate(a):
              while pending and a[pending[-1]] < value:
                  out[pending.pop()] = value
              pending.append(i)
          return out`),
          quiz: quiz('Does a second 5 resolve the next-strictly-greater query for a first 5?', ['Yes, equality is enough', 'No, only a value greater than 5 resolves it', 'Only at an odd index', 'Only when adjacent'], 1, 'Strict comparison uses < when removing pending candidates.'),
          challenge: challenge('Find next greater values for [4, 1, 2].', '[none, 2, none]', 'The new 2 resolves only the smaller top.', '2 resolves 1 but cannot resolve 4; no later value resolves 2.'),
        }),
        'monotonic-queue': defineTopic({
          intro: 'Sliding-window maxima use a deque of candidate indices rather than a running sum. Expired indices leave the front. A new value removes smaller or equal values from the back because it is at least as large and will remain in future windows longer.',
          invariant: 'Candidate indices increase, remain inside the current window, and have strictly decreasing values; the front is the window maximum.',
          takeaway: 'Expiry needs indices, not values. Keeping the newer equal value is safe because it dominates the older equal value in both size and lifetime.',
          complexity: { time: 'O(n) total for valid fixed width k ≥ 1: each index enters once and leaves at most once.', space: 'O(k) live candidates with a true deque, plus output. The JavaScript offset-array implementation retains O(n) allocated indices.' },
          examples: [{ label: 'Repeated maximum expires', input: { values: [3, 3, 1, 2, 0], k: 3 }, expected: '[3, 3, 2]' }, { label: 'Width one with negatives', input: { values: [-2, -5, 0], k: 1 }, expected: '[-2, -5, 0]' }],
          trace({ values, k }) {
            const deque = [], maxima = [];
            let head = 0;
            const view = active => array(values, active, { secondary: deque.slice(head).map(i => `${i}:${values[i]}`) });
            const r = recording('Empty maximum candidates', `Each full window has width ${k}; secondary cells show index:value candidates.`, view([]));
            for (let i = 0; i < values.length; i++) {
              while (head < deque.length && deque[head] <= i - k) {
                const expired = deque[head++];
                r.step(`Expire candidate ${expired}`, `Index ${expired} is left of the window boundary ${i - k + 1}.`, view([i]));
              }
              while (head < deque.length && values[deque[deque.length - 1]] <= values[i]) {
                const dominated = deque.pop();
                r.step(`Discard dominated index ${dominated}`, `New value ${values[i]} is at least ${values[dominated]} and expires later, so the old candidate can never win.`, view([dominated, i]));
              }
              deque.push(i);
              r.step(`Append candidate ${i}`, 'The remaining candidates decrease by value and increase by index.', view([i]));
              if (i >= k - 1) {
                maxima.push(values[deque[head]]);
                r.step(`Read maximum for endpoint ${i}`, `The front index ${deque[head]} supplies maximum ${values[deque[head]]}.`, view([deque[head]]), [['Maxima', show(maxima)]]);
              }
            }
            return r.done('Each output comes from the front of the active candidate deque.', view([]), show(maxima));
          },
          code: indentedCode(
            `for index i:
        remove front indices ≤ i − k
        remove back indices whose values ≤ a[i]
        append i at back
        if window full: output a[front]`,
            `function windowMax(a, k) {
        const q = [], out = [];
        let head = 0;
        for (let i = 0; i < a.length; i++) {
          while (head < q.length && q[head] <= i - k) head++;
          while (head < q.length && a[q[q.length - 1]] <= a[i]) q.pop();
          q.push(i);
          if (i >= k - 1) out.push(a[q[head]]);
        }
        return out;
      }`,
            `from collections import deque

      def window_max(a, k):
          candidates, out = deque(), []
          for i, value in enumerate(a):
              while candidates and candidates[0] <= i - k:
                  candidates.popleft()
              while candidates and a[candidates[-1]] <= value:
                  candidates.pop()
              candidates.append(i)
              if i >= k - 1:
                  out.append(a[candidates[0]])
          return out`),
          quiz: quiz('Why discard an older equal-valued candidate?', ['It is smaller', 'The newer equal value expires later', 'Equal values must be deduplicated globally', 'Its index is negative'], 1, 'The newer value provides the same maximum with a longer remaining window lifetime.'),
          challenge: challenge('What are width-2 maxima of [1, 4, 2, 3]?', '[4, 4, 3]', 'Track the front candidate as windows advance.', 'The windows [1,4], [4,2], and [2,3] have maxima 4, 4, and 3.'),
        }),
      });

Object.assign(topics, {
  'reversing-list': defineTopic({
    intro: 'Reversing a singly linked list changes each next pointer, not each stored value. Keep three references: the reversed prefix head, the current node, and its saved original successor. Saving the successor before rewiring prevents losing the unprocessed suffix.',
    invariant: 'prev heads the reversed processed prefix; current heads the untouched suffix. Together they contain every original node exactly once.',
    takeaway: 'The old head becomes the new tail. Pointer assignment order matters because overwriting next destroys the route needed for the following iteration.',
    complexity: { time: 'O(n): every node has its next reference changed once.', space: 'O(1) auxiliary references; input nodes are reused in place.' },
    examples: [{ label: 'Reverse three nodes', input: [1, 2, 3], expected: '[3, 2, 1]' }, { label: 'Empty list', input: [], expected: '[]' }],
    trace(values) {
      let { head: current } = chain(values), prev = null;
      const r = recording('Forward input chain', 'The top row begins as the unprocessed list.', linkedView(current, [], { secondary: [`head = ${current?.id ?? 'null'}`] }));
      while (current) {
        const next = current.next;
        r.step(`Save successor of ${current.id}`, `Save ${next?.id ?? 'null'} before modifying the next field.`, linkedView(current, [current], { secondary: walk(prev).map(n => n.value) }));
        current.next = prev;
        prev = current; current = next;
        r.step(`Reverse link from ${prev.id}`, `${prev.id}.next now addresses the previous reversed head. Top row follows the reversed prefix; the secondary row is the untouched suffix.`, linkedView(prev, [prev], { secondary: walk(current).map(n => n.value) }));
      }
      return r.done('The suffix is empty; prev is the new head and every shown arrow follows an actual reversed next link.', linkedView(prev), show(walk(prev).map(n => n.value)));
    },
    code: code(
      `prev ← null; current ← head
while current:
  saved ← current.next
  current.next ← prev
  prev ← current
  current ← saved
return prev`,
      `function reverse(head) {
  let prev = null, current = head;
  while (current) {
    const saved = current.next;
    current.next = prev;
    prev = current;
    current = saved;
  }
  return prev;
}`,
      `def reverse(head):
    prev, current = None, head
    while current:
        saved = current.next
        current.next = prev
        prev, current = current, saved
    return prev`),
    quiz: quiz('Why save current.next before assigning current.next = prev?', ['To allocate a new list', 'To retain the route to unprocessed nodes', 'To sort the prefix', 'To detect duplicates'], 1, 'After rewiring, current.next leads backward and can no longer locate the original suffix.'),
    challenge: challenge('After reversing 7 → 8 → null, what is 7.next?', 'null', 'The old head becomes the tail.', 'The first iteration points the original head at the initially null reversed prefix.'),
  }),
  'merging-sorted-lists': defineTopic({
    intro: 'Two sorted linked chains can be merged by repeatedly detaching the smaller current head and attaching it to an output tail. No node values are copied. On equal values this implementation chooses the left node first, preserving order within each source.',
    invariant: 'The output is sorted and contains exactly the consumed source nodes; each remaining head is the smallest unconsumed value in its source.',
    takeaway: 'A dummy head removes the first-attachment special case. Equal values must still keep their distinct nodes.',
    complexity: { time: 'O(n + m) for sorted lists with n and m nodes.', space: 'O(1) auxiliary links and a dummy node; existing nodes are relinked, not copied.' },
    examples: [{ label: 'Duplicates from both inputs', input: { left: [1, 3, 3], right: [2, 3] }, expected: '[1, 2, 3, 3, 3]' }, { label: 'Empty left source', input: { left: [], right: [-2, 4] }, expected: '[-2, 4]' }],
    trace({ left, right }) {
      let a = chain(left).head, b = chain(right).head;
      walk(a).forEach(n => { n.id = `left-${n.id}`; });
      walk(b).forEach(n => { n.id = `right-${n.id}`; });
      const dummy = { next: null }, r = recording('Two sorted sources', 'Compare source heads; source node identities remain distinct.', cells('list', left, [], { secondary: right }));
      let tail = dummy;
      while (a || b) {
        const useLeft = !b || (a && a.value <= b.value);
        const node = useLeft ? a : b;
        if (useLeft) a = a.next; else b = b.next;
        node.next = null;
        tail.next = node; tail = node;
        r.step(`Attach ${node.id}`, `${useLeft ? 'Left' : 'Right'} head ${node.value} is the next smallest candidate. Detach it, append it, and advance only that source.`, linkedView(dummy.next, [node], { secondary: [...walk(a).map(n => `L:${n.value}`), ...walk(b).map(n => `R:${n.value}`)] }));
      }
      return r.done('Both sources are exhausted and the tail ends at null.', linkedView(dummy.next), show(walk(dummy.next).map(n => n.value)));
    },
    code: code(
      `dummy.next ← null; tail ← dummy
while either source remains:
  choose smaller head, preferring left on ties
  advance chosen source; detach chosen node
  tail.next ← chosen; tail ← chosen
return dummy.next`,
      `function mergeLists(a, b) {
  const dummy = { next: null };
  let tail = dummy;
  while (a || b) {
    let node;
    if (!b || (a && a.value <= b.value)) { node = a; a = a.next; }
    else { node = b; b = b.next; }
    node.next = null; tail.next = node; tail = node;
  }
  return dummy.next;
}`,
      `def merge_lists(a, b):
    dummy = type("Node", (), {})()
    dummy.next = None
    tail = dummy
    while a or b:
        if b is None or (a is not None and a.value <= b.value):
            node, a = a, a.next
        else:
            node, b = b, b.next
        node.next = None
        tail.next = node
        tail = node
    return dummy.next`),
    quiz: quiz('When source heads are equal, can one of the nodes be discarded?', ['Yes, merging removes duplicates', 'No, both nodes belong in the output', 'Only if the sources have equal lengths', 'Only the right node survives'], 1, 'Merging sorted lists preserves multiplicity; deduplication is a separate operation.'),
    challenge: challenge('Merge [1, 4] with [1, 2] using left-first ties.', '[1, 1, 2, 4]', 'Compare the two current heads after each attachment.', 'Take left 1, right 1, right 2, then the remaining left 4.'),
  }),
  'lru-cache': defineTopic({
    intro: 'An LRU cache combines key lookup with a recency list. A successful get or a put moves that key to the most-recent end. When a new key exceeds capacity, the least-recent node is evicted from both the map and the doubly linked chain.',
    invariant: 'The map and recency chain contain the same keys exactly once; head is most recent, tail is least recent, and size does not exceed capacity after each operation.',
    takeaway: 'Recency means most recent access, not insertion time. A miss does not refresh any key, and updating an existing key must not create a duplicate node.',
    complexity: { time: 'Expected O(1) per get/put using a hash map and doubly linked nodes; O(q) for q operations under uniform hashing.', space: 'O(c) for positive capacity c, excluding returned get results and trace output.' },
    examples: [
      { label: 'Read refresh prevents eviction', input: { capacity: 2, operations: [['put', 'a', 1], ['put', 'b', 2], ['get', 'a'], ['put', 'c', 3], ['get', 'b']] }, expected: 'reads [1, miss]; MRU [c:3, a:1]' },
      { label: 'Update existing key', input: { capacity: 1, operations: [['put', 'x', 1], ['put', 'x', 9], ['get', 'x']] }, expected: 'reads [9]; MRU [x:9]' },
    ],
    trace({ capacity, operations }) {
      const map = new Map(), reads = [];
      let head = null, tail = null;
      function detach(node) {
        if (node.prev) node.prev.next = node.next; else head = node.next;
        if (node.next) node.next.prev = node.prev; else tail = node.prev;
        node.prev = node.next = null;
      }
      function prepend(node) {
        node.next = head; node.prev = null;
        if (head) head.prev = node; else tail = node;
        head = node;
      }
      const view = () => cells('list', walk(head).map(n => `${n.key}:${n.value}`), [], { labels: walk(head).map((_, i) => i === 0 ? 'MRU' : 'toward LRU'), secondary: reads });
      const r = recording('Empty recency chain', `Capacity is ${capacity}; a successful access will move a key to the front.`, { ...view(), secondary: operations.map(op => op.join(' ')) }, [['Capacity', capacity]]);
      for (const [op, key, value] of operations) {
        let node = map.get(key);
        if (op === 'get') {
          if (!node) {
            reads.push('miss');
            r.step(`Miss for ${key}`, 'No node exists for this key; recency order is unchanged.', view());
            continue;
          }
          reads.push(node.value);
          detach(node); prepend(node);
          r.step(`Read and refresh ${key}`, `Return ${node.value} and splice this same node to the MRU head.`, view());
        } else if (capacity > 0) {
          if (node) { detach(node); node.value = value; }
          else { node = { key, value, prev: null, next: null }; map.set(key, node); }
          prepend(node);
          r.step(`Store and refresh ${key}`, `The key holds ${value}; the linked head is now most recently used.`, view(), [['Size before eviction', map.size]]);
          if (map.size > capacity) {
            const victim = tail;
            detach(victim); map.delete(victim.key);
            r.step(`Evict LRU key ${victim.key}`, 'Remove the tail node and its map entry so both structures stay synchronized.', view(), [['Size', map.size]]);
          }
        } else r.step(`Reject storage for ${key}`, 'A zero-capacity cache retains no entries.', view());
      }
      return r.done('Reads and the final MRU-to-LRU chain are computed from the actual access sequence.', view(), `reads ${show(reads)}; MRU ${show(walk(head).map(n => `${n.key}:${n.value}`))}`);
    },
    code: code(
      `map key → linked node; head is MRU; tail is LRU
get(key): if absent return miss; detach and prepend node; return value
put(key, value): update existing node or create one
detach existing node; prepend at head
if size > capacity: detach tail and delete its map entry`,
      `class LRU {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); this.head = this.tail = null; }
  detach(n) {
    if (n.prev) n.prev.next = n.next; else this.head = n.next;
    if (n.next) n.next.prev = n.prev; else this.tail = n.prev;
  }
  front(n) {
    n.prev = null; n.next = this.head;
    if (this.head) this.head.prev = n; else this.tail = n;
    this.head = n;
  }
  get(key) {
    const n = this.map.get(key);
    if (!n) return 'miss';
    this.detach(n); this.front(n); return n.value;
  }
  put(key, value) {
    if (this.capacity <= 0) return;
    let n = this.map.get(key);
    if (n) { this.detach(n); n.value = value; }
    else { n = { key, value }; this.map.set(key, n); }
    this.front(n);
    if (this.map.size > this.capacity) {
      const victim = this.tail; this.detach(victim); this.map.delete(victim.key);
    }
  }
}`,
      `class LRU:
    def __init__(self, capacity):
        self.capacity, self.nodes = capacity, {}
        self.head = self.tail = None
    def detach(self, n):
        if n["prev"]: n["prev"]["next"] = n["next"]
        else: self.head = n["next"]
        if n["next"]: n["next"]["prev"] = n["prev"]
        else: self.tail = n["prev"]
    def front(self, n):
        n["prev"], n["next"] = None, self.head
        if self.head: self.head["prev"] = n
        else: self.tail = n
        self.head = n
    def get(self, key):
        n = self.nodes.get(key)
        if n is None: return "miss"
        self.detach(n)
        self.front(n)
        return n["value"]
    def put(self, key, value):
        if self.capacity <= 0: return
        n = self.nodes.get(key)
        if n is not None:
            self.detach(n)
            n["value"] = value
        else:
            n = {"key": key, "value": value}
            self.nodes[key] = n
        self.front(n)
        if len(self.nodes) > self.capacity:
            victim = self.tail
            self.detach(victim)
            del self.nodes[victim["key"]]`),
    quiz: quiz('Which key is evicted when a new key exceeds LRU capacity?', ['The smallest key', 'The most recently read key', 'The least recently accessed key', 'A random duplicate'], 2, 'The tail records the access that has gone untouched longest.'),
    challenge: challenge('Capacity 2: put a, put b, get a, put c. Which key is evicted?', 'b', 'A successful get refreshes recency.', 'Reading a moves it ahead of b; the new c then displaces b at the least-recent end.'),
  }),
});
