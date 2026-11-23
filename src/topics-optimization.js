import { snapshot, defineTopic } from './trace-contract.js';

// Keep both the opening decisions and the latest work when a search branches heavily.
function recorder() {
  const frames = [];
  let condensed = 0;
  return {
    step(title, description, view, metrics = []) {
      if (frames.length === 29) {
        frames.splice(14, 1);
        condensed++;
      }
      frames.push(snapshot(title, description, { result: '', ...view }, metrics));
    },
    end(title, description, view, result, metrics = []) {
      frames.push(snapshot(title, `${description}${condensed ? ` ${condensed} intermediate operations were condensed; every displayed state comes from the executed algorithm.` : ''}`, { ...view, result: String(result) }, metrics));
      return frames;
    },
  };
}

const array = (values, active = [], labels) => ({ kind: 'array', values, active, ...(labels ? { labels } : {}) });
const grid = (matrix, active = []) => ({ kind: 'grid', matrix, active });
const lines = text => text.trim().split('\n');
const code = (pseudocode, javascript, python) => ({
  Pseudocode: lines(pseudocode),
  JavaScript: lines(javascript),
  Python: lines(python),
});
const example = (label, input, expected) => ({ label, input, expected });
const quiz = (question, options, answer, explanation) => ({ question, options, answer, explanation });
const challenge = (prompt, answer, hint, explanation) => ({ prompt, answer, hint, explanation });

function binarySearch({ values, target }) {
  const r = recorder();
  let lo = 0, hi = values.length - 1, found = -1, comparisons = 0;
  const view = active => ({ ...array(values, active), secondary: [lo, hi, target], labels: values.map((_, i) => String(i)) });
  r.step('A sorted search interval', `Find ${target}; only indices in [${lo}, ${hi}] can still match. Sorting is a precondition, not work done by this search.`, view([]));
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    comparisons++;
    if (values[mid] === target) {
      found = mid;
      r.step('Equality stops the search', `${values[mid]} equals ${target} at index ${mid}. The candidate interval contains a confirmed match.`, view([mid]), [['Comparisons', comparisons]]);
      break;
    }
    const smaller = values[mid] < target;
    r.step('Compare the midpoint', `${values[mid]} at ${mid} is ${smaller ? 'below' : 'above'} ${target}; sorted order rules out the midpoint and the entire ${smaller ? 'left' : 'right'} side.`, view([mid]), [['Comparisons', comparisons]]);
    if (smaller) lo = mid + 1;
    else hi = mid - 1;
    r.step('Shrink the bounds', `Candidates are now [${lo}, ${hi}]. Every discarded value is known not to equal the target.`, view(lo <= hi ? [lo, hi] : []));
  }
  return r.end('Search outcome', found < 0 ? 'The bounds crossed, so the candidate interval is empty: the target is absent.' : 'The reported index was obtained by an equality comparison, not by guessing a position.', view(found < 0 ? [] : [found]), `index: ${found}`, [['Comparisons', comparisons]]);
}

function answerSearch({ piles, hours }) {
  const r = recorder();
  let lo = 1, hi = Math.max(...piles), checks = 0;
  r.step('Search speeds, not positions', `Each pile requires ceil(pile / speed) hours. At speed ${hi}, each nonempty pile takes one hour; assume hours is at least the number of piles. Feasibility is monotone.`, array(piles));
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const work = piles.map(p => Math.ceil(p / mid));
    const needed = work.reduce((a, b) => a + b, 0);
    checks++;
    r.step('Execute the feasibility test', `Speed ${mid} needs ${work.join(' + ')} = ${needed} hours, ${needed <= hours ? 'within' : 'over'} the ${hours}-hour budget. Faster speeds cannot require more hours.`, { ...array(piles), secondary: work }, [['Low speed', lo], ['High speed', hi], ['Trial speed', mid], ['Hours needed', needed]]);
    if (needed <= hours) hi = mid;
    else lo = mid + 1;
    r.step('Preserve the first feasible speed', `The minimum feasible speed remains in [${lo}, ${hi}]; ${needed <= hours ? 'keep the feasible trial as an upper bound' : 'exclude this infeasible speed and every slower speed'}.`, array([lo, hi]));
  }
  return r.end('Minimum feasible speed', `The bounds meet at ${lo}. The predicate tests narrowed the first feasible integer, not merely any workable speed.`, array(piles), `speed: ${lo}`, [['Feasibility checks', checks]]);
}

function insertionSort({ values }) {
  const a = [...values], r = recorder();
  let shifts = 0;
  r.step('Grow a sorted prefix', 'The first element is already a sorted prefix. Insert each following key into that prefix by shifting only strictly larger values.', array(a, a.length ? [0] : []));
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    r.step('Hold the next key', `Hold ${key} outside the array while finding its place in the sorted prefix [0, ${i - 1}].`, array(a, [i]), [['Held key', key]]);
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      shifts++;
      r.step('Shift one larger value', `Move ${a[j]} from ${j} to ${j + 1}; the hole moves left and the other prefix values keep their relative order.`, array(a, [j, j + 1]), [['Held key', key], ['Shifts', shifts]]);
      j--;
    }
    a[j + 1] = key;
    r.step('Close the hole', `Place ${key} at ${j + 1}. Indices 0 through ${i} are now sorted, including equal keys in their original order.`, array(a, [j + 1]));
  }
  return r.end('Insertion sort complete', 'Every key has joined the sorted prefix; the prefix now covers the entire array.', array(a), `sorted: ${a.join(', ')}`, [['Shifts', shifts]]);
}

function mergeSort({ values }) {
  const a = [...values], r = recorder();
  r.step('Split before combining', 'A singleton run is sorted. Recursively sort two halves, then merge them without losing or duplicating an element.', array(a));
  function sort(lo, hi) {
    if (hi - lo < 2) return;
    const mid = Math.floor((lo + hi) / 2);
    r.step('Divide the run', `Split [${lo}, ${hi}) at ${mid}. No ordering is assumed yet inside either child run.`, array(a, [lo, mid, hi - 1]));
    sort(lo, mid); sort(mid, hi);
    const left = a.slice(lo, mid), right = a.slice(mid, hi), merged = [];
    let i = 0, j = 0;
    while (i < left.length || j < right.length) {
      const takeLeft = j === right.length || (i < left.length && left[i] <= right[j]);
      merged.push(takeLeft ? left[i++] : right[j++]);
      r.step('Choose the smaller run head', `Append ${merged.at(-1)} from the ${takeLeft ? 'left' : 'right'} run. The output prefix is sorted and consists exactly of consumed heads; ties choose left for stability.`, { ...array(merged, [merged.length - 1]), secondary: [...left.slice(i), '|', ...right.slice(j)] });
    }
    a.splice(lo, hi - lo, ...merged);
    r.step('Write the merged run', `Indices [${lo}, ${hi}) are now a sorted permutation of the original run.`, array(a, Array.from({ length: hi - lo }, (_, k) => lo + k)));
  }
  sort(0, a.length);
  return r.end('All runs combined', 'The top-level merge covers every input element, so no unsorted run remains.', array(a), `sorted: ${a.join(', ')}`);
}

function partition(a, lo, hi, r) {
  const pivot = a[hi];
  let boundary = lo;
  r.step('Choose a pivot', `Use ${pivot} at ${hi}. Before scanning, [${lo}, ${boundary}) is the empty region of values strictly below the pivot.`, array(a, [hi]));
  for (let j = lo; j < hi; j++) {
    if (a[j] < pivot) {
      [a[boundary], a[j]] = [a[j], a[boundary]];
      r.step('Expand the lower region', `Swap indices ${boundary} and ${j}: ${a[boundary]} belongs below ${pivot}. The lower region gains exactly one value; scanned values outside it are at least the pivot.`, array(a, [boundary, j]), [['Pivot', pivot], ['Boundary', boundary + 1]]);
      boundary++;
    } else {
      r.step('Leave a value on the high side', `${a[j]} is not below ${pivot}; leave it in the scanned high region and advance the scan.`, array(a, [j, hi]));
    }
  }
  [a[boundary], a[hi]] = [a[hi], a[boundary]];
  r.step('Fix the pivot position', `Swap the pivot into ${boundary}. Every value to its left within this run is smaller and every value to its right is at least ${pivot}.`, array(a, [boundary]));
  return boundary;
}

function quickSort({ values }) {
  const a = [...values], r = recorder();
  r.step('Partition in place', 'Lomuto partitioning fixes one pivot at a time. Recursion must not include that fixed pivot again.', array(a));
  function sort(lo, hi) {
    if (lo >= hi) return;
    const p = partition(a, lo, hi, r);
    r.step('Recurse around the fixed pivot', `Sort [${lo}, ${p - 1}] and [${p + 1}, ${hi}] independently. The pivot at ${p} is already in a valid final position.`, array(a, [p]));
    sort(lo, p - 1); sort(p + 1, hi);
  }
  sort(0, a.length - 1);
  return r.end('Partitions become sorted', 'Each remaining subarray is empty or a singleton; all pivot order constraints together give a sorted array.', array(a), `sorted: ${a.join(', ')}`);
}

function quickselect({ values, k }) {
  const a = [...values], r = recorder();
  let lo = 0, hi = a.length - 1;
  r.step('Seek one order statistic', `Find rank ${k} (one-based), which is index ${k - 1} in sorted order. The rest of the array need not become sorted.`, array(a));
  while (lo <= hi) {
    const p = partition(a, lo, hi, r);
    if (p === k - 1) return r.end('Rank found', `Partition placed a pivot at target index ${p}; its value is the requested order statistic even though other regions may be unsorted.`, array(a, [p]), `rank ${k}: ${a[p]}`);
    if (p < k - 1) lo = p + 1;
    else hi = p - 1;
    r.step('Discard the irrelevant partition', `The requested index ${k - 1} remains in [${lo}, ${hi}]. Do not sort or search the other side of the fixed pivot.`, array(a, [lo, hi]));
  }
  return r.end('No valid rank', 'No candidate remains; ranks must lie between one and the number of values.', array(a), 'invalid rank');
}

function radixSort({ values }) {
  let a = [...values];
  const r = recorder(), max = Math.max(0, ...a);
  r.step('Sort nonnegative integer digits', 'Use stable base-10 counting passes, starting at the units digit. Already processed lower digits must retain their order within each new digit bucket.', array(a));
  for (let place = 1; Math.floor(max / place) > 0; place *= 10) {
    const counts = Array(10).fill(0);
    for (const value of a) counts[Math.floor(value / place) % 10]++;
    r.step('Count digit occurrences', `At place ${place}, count each digit 0–9. Counts cover every input element exactly once.`, { ...array(counts, [], counts.map((_, i) => String(i))), secondary: a });
    for (let d = 1; d < 10; d++) counts[d] += counts[d - 1];
    r.step('Convert counts to end positions', 'Prefix sums tell us the exclusive end of each digit bucket in the output. Equal digits will be placed from right to left to preserve their input order.', array(counts));
    const output = Array(a.length).fill('·');
    for (let i = a.length - 1; i >= 0; i--) {
      const digit = Math.floor(a[i] / place) % 10;
      const dest = --counts[digit];
      output[dest] = a[i];
      r.step('Stable counting placement', `Place ${a[i]} in bucket ${digit} at output index ${dest}. Scanning backward leaves earlier equal-digit values earlier in that bucket.`, { ...array(output, [dest]), secondary: counts });
    }
    a = output;
    r.step('One more digit is ordered', `After place ${place}, values are sorted by their last ${String(place).length} decimal digits.`, array(a));
  }
  return r.end('Radix passes complete', 'All digits up to the maximum input value have been processed, so numeric order is complete.', array(a), `sorted: ${a.join(', ')}`);
}

function stableSort({ entries }) {
  const a = entries.map(([key, tag]) => ({ key, tag })), r = recorder();
  const view = active => array(a.map(e => `${e.key}:${e.tag}`), active);
  r.step('Tags reveal equal-key order', 'Sort by the numeric key only. Letter tags identify original records and must stay in original relative order when their keys tie.', view([]));
  for (let i = 1; i < a.length; i++) {
    const held = a[i];
    let j = i - 1;
    while (j >= 0 && a[j].key > held.key) {
      a[j + 1] = a[j];
      r.step('Move only a strictly larger key', `${a[j].key}:${a[j].tag} shifts right of held ${held.key}:${held.tag}. Equal keys are never moved across the held record.`, view([j, j + 1]));
      j--;
    }
    a[j + 1] = held;
    r.step('Insert without crossing a tie', `Insert ${held.key}:${held.tag} at ${j + 1}. The sorted prefix preserves the input order of every equal-key group.`, view([j + 1]));
  }
  return r.end('Stable order', 'Read the tags within each key group: their relative order is unchanged. Stability is separate from the Ω(n log n) worst-case bound for comparison sorting arbitrary distinct keys.', view([]), `order: ${a.map(e => `${e.key}:${e.tag}`).join(', ')}`);
}

function intervalScheduling({ intervals }) {
  const r = recorder();
  const sorted = intervals.map((v, id) => ({ v, id })).sort((a, b) => a.v[1] - b.v[1] || a.id - b.id);
  const chosen = [];
  let finish = -Infinity;
  r.step('Order by finishing time', 'For half-open intervals [start, end), touching endpoints are compatible. Consider jobs by increasing finish time, not by start time or duration.', { kind: 'intervals', values: intervals, active: [] });
  for (const { v: [start, end], id } of sorted) {
    if (start >= finish) {
      chosen.push(id); finish = end;
      r.step('Accept the earliest compatible finish', `Job ${id} [${start}, ${end}) fits after the previous finish. Its earliest available end leaves at least as much room as any compatible alternative.`, { kind: 'intervals', values: intervals, active: [...chosen] }, [['Chosen jobs', chosen.length], ['Last finish', finish]]);
    } else {
      r.step('Reject an overlap', `Job ${id} starts at ${start}, before selected finish ${finish}. It cannot be added to this nonoverlapping schedule.`, { kind: 'intervals', values: intervals, active: [id] }, [['Chosen jobs', chosen.length]]);
    }
  }
  return r.end('Maximum-cardinality schedule', 'The finish-time exchange argument permits each chosen job in an optimal unweighted schedule. Weighted scheduling would need a different algorithm.', { kind: 'intervals', values: intervals, active: chosen }, `jobs: ${chosen.join(', ')}; count: ${chosen.length}`);
}

function huffman({ frequencies }) {
  const r = recorder(), nodes = [], edges = [], codes = {};
  let serial = 0;
  const queue = frequencies.map(([symbol, weight]) => {
    const node = { id: `h${serial++}`, symbol, weight, left: null, right: null };
    nodes.push({ id: node.id, label: `${symbol}:${weight}` });
    return node;
  });
  const view = active => ({ kind: 'tree', nodes, edges, active, directed: true });
  r.step('A forest of weighted leaves', 'Each symbol begins as a separate tree. Repeatedly merge the two least frequent roots; every root weight equals the total frequency of its leaves.', view([]));
  while (queue.length > 1) {
    queue.sort((a, b) => a.weight - b.weight || Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const left = queue.shift(), right = queue.shift();
    const parent = { id: `h${serial++}`, weight: left.weight + right.weight, left, right };
    nodes.push({ id: parent.id, label: String(parent.weight) });
    edges.push({ from: parent.id, to: left.id, label: '0' }, { from: parent.id, to: right.id, label: '1' });
    queue.push(parent);
    r.step('Merge the two minimum roots', `Join weights ${left.weight} and ${right.weight} under ${parent.weight}. These least-weight subtrees gain one code bit; the forest still accounts for every frequency.`, view([left.id, right.id, parent.id]), [['Trees remaining', queue.length]]);
  }
  function assign(node, prefix) {
    if (!node.left) {
      codes[node.symbol] = prefix || '0';
      r.step('Read a root-to-leaf code', `Symbol ${node.symbol} receives ${codes[node.symbol]}. Codes end only at leaves, so no symbol code prefixes another. A one-symbol alphabet uses one bit here.`, view([node.id]));
    } else {
      assign(node.left, `${prefix}0`); assign(node.right, `${prefix}1`);
    }
  }
  if (queue.length) assign(queue[0], '');
  const cost = frequencies.reduce((sum, [symbol, weight]) => sum + weight * codes[symbol].length, 0);
  const encoded = frequencies.map(([symbol]) => `${symbol}=${codes[symbol]}`).join(', ');
  return r.end('A prefix-free encoding', 'The weighted bit cost was calculated from the constructed leaf depths. Deterministic insertion-order tie breaking selects one of possibly several optimal trees.', view([]), `codes: ${encoded}; weighted bits: ${cost}`, [['Weighted bits', cost]]);
}

function greedyFailure({ coins, amount }) {
  const r = recorder(), sorted = [...coins].sort((a, b) => b - a), taken = [];
  let remaining = amount;
  r.step('Test a tempting local rule', `Largest coin first tries to make ${amount} with denominations ${sorted.join(', ')}. A locally largest payment need not minimize the total number of coins.`, array(sorted));
  for (const coin of sorted) {
    while (remaining >= coin) {
      taken.push(coin); remaining -= coin;
      r.step('Greedy commits to a coin', `Take ${coin}; remainder ${remaining}. This maintains the paid total but does not prove an optimal coin count.`, array(taken, [taken.length - 1]), [['Remainder', remaining]]);
    }
  }
  const dp = Array(amount + 1).fill(Infinity); dp[0] = 0;
  for (let x = 1; x <= amount; x++) {
    for (const coin of coins) if (coin <= x) dp[x] = Math.min(dp[x], dp[x - coin] + 1);
    r.step('Compare against all final-coin choices', `dp[${x}] = ${Number.isFinite(dp[x]) ? dp[x] : 'unreachable'} after considering every usable last coin. Smaller amounts are already optimal, so the recurrence can expose greedy's mistake.`, array(dp.map(v => Number.isFinite(v) ? v : '∞'), [x]));
  }
  const greedy = remaining ? 'unreachable' : taken.length;
  const optimal = Number.isFinite(dp[amount]) ? dp[amount] : 'unreachable';
  return r.end('Local choice versus optimal choice', `The same amount produced greedy count ${greedy} and optimal count ${optimal}. Agreement on one input is not a general correctness proof.`, array(taken), `greedy: ${greedy}; optimal: ${optimal}`);
}

function subsets({ values }) {
  const r = recorder(), path = [], output = [];
  const view = active => ({ kind: 'stack', values: path, active, secondary: output.map(s => `[${s.join(',')}]`) });
  r.step('An include/exclude decision tree', 'At depth i, only the first i input positions have been decided. Start with no selected values and branch once for exclusion and once for inclusion.', view([]));
  function visit(i) {
    if (i === values.length) {
      output.push([...path]);
      r.step('Emit a complete subset', `All positions are decided; record [${path.join(', ')}]. This leaf is unique because its include/exclude choices identify one subset.`, view([]));
      return;
    }
    r.step('Exclude the next value', `Leave ${values[i]} out at depth ${i}; the current path still contains only selected positions before this one.`, view([]));
    visit(i + 1);
    path.push(values[i]);
    r.step('Include the next value', `Push ${values[i]} for the alternate branch at depth ${i}. Explore every suffix decision with this value included.`, view([path.length - 1]));
    visit(i + 1);
    path.pop();
    r.step('Undo the inclusion', `Pop ${values[i]}; restore the exact prefix state expected by the caller. Undo prevents one branch from leaking into another.`, view([]));
  }
  visit(0);
  return r.end('Every subset once', 'The recursion explored both choices at every input position, including the all-excluded empty subset.', view([]), `subsets: ${output.map(s => `[${s.join(',')}]`).join(' ')}; count: ${output.length}`);
}

function permutations({ values }) {
  const r = recorder(), path = [], used = values.map(() => false), output = [];
  const view = () => ({ kind: 'stack', values: path, active: [], secondary: values.map((v, i) => `${v}:${used[i] ? 'used' : 'free'}`) });
  r.step('Choose one unused position at a time', 'A permutation uses every input position exactly once. These examples use distinct values, so different position orders also give different value orders.', view());
  function visit() {
    if (path.length === values.length) {
      output.push([...path]);
      r.step('Emit one ordering', `The path [${path.join(', ')}] uses all positions once, so it is a complete permutation.`, view());
      return;
    }
    for (let i = 0; i < values.length; i++) {
      if (used[i]) {
        r.step('Prune a reused position', `Skip ${values[i]} at input position ${i}; reusing it would violate the one-use constraint.`, view());
        continue;
      }
      used[i] = true; path.push(values[i]);
      r.step('Choose a free position', `Append ${values[i]} and mark position ${i} used. The prefix contains no repeated input position.`, view());
      visit();
      path.pop(); used[i] = false;
      r.step('Undo both changes', `Remove ${values[i]} and clear its used flag. The caller can now explore the next unused candidate with its original prefix.`, view());
    }
  }
  visit();
  return r.end('All position orders explored', 'Every legal next choice was visited and undone. For distinct values there are n! outputs, each of length n.', view(), `permutations: ${output.map(p => `[${p.join(',')}]`).join(' ')}; count: ${output.length}`);
}

function queens({ n }) {
  const r = recorder(), board = Array.from({ length: n }, () => Array(n).fill('·')), positions = [], solutions = [];
  const columns = new Set(), descending = new Set(), ascending = new Set();
  r.step('One queen per row', 'Place rows from top to bottom. Used columns and the two diagonal identifiers describe exactly the attacks from the current partial placement.', grid(board));
  function visit(row) {
    if (row === n) {
      solutions.push([...positions]);
      r.step('Record a safe board', `All ${n} rows contain a queen with distinct columns and diagonals. Record this placement before undoing it to look for other solutions.`, grid(board));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (columns.has(col) || descending.has(row - col) || ascending.has(row + col)) {
        r.step('Prune an attacked square', `(${row}, ${col}) shares a column or diagonal with a placed queen. Reject it before creating a deeper recursive branch.`, grid(board, [[row, col]]));
        continue;
      }
      board[row][col] = 'Q'; positions.push(col);
      columns.add(col); descending.add(row - col); ascending.add(row + col);
      r.step('Place a safe queen', `Choose (${row}, ${col}); reserve column ${col}, diagonal ${row - col}, and anti-diagonal ${row + col}. The partial board remains attack-free.`, grid(board, [[row, col]]));
      visit(row + 1);
      board[row][col] = '·'; positions.pop();
      columns.delete(col); descending.delete(row - col); ascending.delete(row + col);
      r.step('Undo the queen and its attacks', `Clear (${row}, ${col}) and its three reservations. The previous row prefix is restored for the next column choice.`, grid(board, [[row, col]]));
    }
  }
  visit(0);
  const first = solutions[0];
  if (first) first.forEach((col, row) => { board[row][col] = 'Q'; });
  return r.end('Count safe placements', first ? 'Show the first saved solution; the full search counted every safe placement, including mirrored boards.' : 'Every candidate branch was either attacked or eventually exhausted; no safe board exists for this size.', grid(board), `solutions: ${solutions.length}; first: ${first ? first.join(', ') : 'none'}`);
}

function maze({ matrix }) {
  const r = recorder(), board = matrix.map(row => row.map(v => v === 1 ? '#' : '·')), path = [];
  const rows = matrix.length, cols = matrix[0].length, seen = new Set();
  r.step('Search walkable cells', 'Zero is open and one is a wall. Depth-first search tries right, down, left, then up, marking discovered cells to avoid cycles; a failed branch must undo its displayed path.', grid(board));
  function visit(row, col) {
    const key = `${row},${col}`;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    if (matrix[row][col] === 1 || seen.has(key)) {
      r.step('Prune a wall or visited cell', `Reject (${row}, ${col}): ${matrix[row][col] === 1 ? 'a wall cannot belong to a path' : 'this cell has already been searched; repeating it would create a cycle'}.`, grid(board, [[row, col]]));
      return false;
    }
    seen.add(key); path.push([row, col]); board[row][col] = '●';
    r.step('Extend the current path', `Enter (${row}, ${col}). The displayed path is a connected sequence of open cells, and each discovered cell is searched at most once.`, grid(board, [[row, col]]));
    if (row === rows - 1 && col === cols - 1) return true;
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (visit(row + dr, col + dc)) return true;
    path.pop(); board[row][col] = '×';
    r.step('Backtrack from a dead end', `All neighbors of (${row}, ${col}) failed. Remove it from the current path, while keeping its global visited mark so its exhausted region is not searched again.`, grid(board, [[row, col]]));
    return false;
  }
  const found = visit(0, 0);
  return r.end('Maze search outcome', found ? 'The retained recursion path reaches the bottom-right goal using only orthogonally adjacent open cells. DFS finds a path, not necessarily a shortest path.' : 'The reachable component was exhausted without reaching the goal; no path exists from the entrance.', grid(board), `path: ${found ? path.map(([row, col]) => `${row},${col}`).join(' → ') : 'none'}`);
}

function memoization({ n }) {
  const r = recorder(), cache = new Map([[0, 0], [1, 1]]);
  let hits = 0;
  const view = active => ({ kind: 'hash', values: [...cache].sort((a, b) => a[0] - b[0]).map(([k, v]) => `F(${k})=${v}`), active, secondary: [hits] });
  r.step('Top-down Fibonacci with a cache', 'F(0)=0 and F(1)=1 are cached bases. Ask for F(n); compute a state only when it is absent, then retain its completed answer for overlapping calls.', view([]));
  function fib(k) {
    if (cache.has(k)) {
      hits++;
      r.step('Reuse a cached answer', `F(${k})=${cache.get(k)} is already complete. Return it without visiting its children; cached values never change.`, view([]), [['Cache hits', hits]]);
      return cache.get(k);
    }
    r.step('Expand an uncached state', `F(${k}) is absent. It depends on F(${k - 1}) + F(${k - 2}); neither an unfinished call nor a guess may be cached as its answer.`, view([]));
    const result = fib(k - 1) + fib(k - 2);
    cache.set(k, result);
    r.step('Store a completed recurrence', `F(${k})=${result}; both dependencies have returned exact values. Later calls to this state can now use one cache lookup.`, view([]), [['Cached states', cache.size]]);
    return result;
  }
  const value = fib(n);
  return r.end('Reuse removes repeated subproblems', 'Every non-base Fibonacci state was expanded once. Recursion depth is still linear even though repeated work has been removed.', view([]), `F(${n}): ${value}`, [['Cache hits', hits]]);
}

function tabulation({ n }) {
  const r = recorder(), dp = Array(n + 1).fill('·');
  dp[0] = 0; if (n >= 1) dp[1] = 1;
  r.step('Install the bottom-up bases', 'Write F(0)=0 and, when needed, F(1)=1. Increasing index order ensures both dependencies are complete before a state is filled.', array(dp, n ? [0, 1] : [0]));
  for (let i = 2; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
    r.step('Fill the next table cell', `F(${i}) = F(${i - 1}) + F(${i - 2}) = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}. The completed prefix now ends at ${i}.`, array(dp, [i - 2, i - 1, i]));
  }
  return r.end('Read the requested state', 'The table contains the Fibonacci values through n in dependency order. Unlike top-down memoization, no recursive call stack was needed.', array(dp, [n]), `F(${n}): ${dp[n]}`);
}

function gridPaths({ matrix }) {
  const r = recorder(), rows = matrix.length, cols = matrix[0].length, dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  const view = active => ({ ...grid(dp, active), secondary: matrix.flat().map(v => v ? '#' : 'open') });
  r.step('Count right/down routes with obstacles', 'The count at a blocked cell is zero. At an open cell, every route arrives from either the top or the left, disjoint possibilities whose counts can be added.', view([]));
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (matrix[row][col]) {
      dp[row][col] = 0;
      r.step('A wall contributes no routes', `(${row}, ${col}) is blocked, so its count stays zero regardless of neighboring counts.`, view([[row, col]]));
    } else {
      const top = row ? dp[row - 1][col] : 0, left = col ? dp[row][col - 1] : 0;
      dp[row][col] = row === 0 && col === 0 ? 1 : top + left;
      r.step('Combine predecessor counts', row === 0 && col === 0 ? 'The open start has one empty route. This is the only base contributing one without a predecessor.' : `ways(${row}, ${col}) = top ${top} + left ${left} = ${dp[row][col]}. Row-major order has completed both predecessors.`, view([[row, col]]));
    }
  }
  return r.end('Routes to the destination', 'The bottom-right count includes exactly the right/down paths avoiding every wall; a blocked start or goal correctly gives zero.', view([[rows - 1, cols - 1]]), `paths: ${dp[rows - 1][cols - 1]}`);
}

function knapsack({ items, capacity }) {
  const r = recorder(), dp = Array.from({ length: items.length + 1 }, () => Array(capacity + 1).fill(0));
  r.step('Choose each item at most once', 'Row i permits only the first i items; column c is available capacity. Row zero and capacity zero are zero for positive-weight items. Taking an item must read the previous row.', grid(dp));
  items.forEach(([weight, value], index) => {
    const row = index + 1;
    for (let c = 1; c <= capacity; c++) {
      const skip = dp[row - 1][c], take = weight <= c ? value + dp[row - 1][c - weight] : -Infinity;
      dp[row][c] = Math.max(skip, take);
      r.step('Compare skip and take', `Item ${index} weighs ${weight}, value ${value}; capacity ${c}: skip=${skip}, take=${Number.isFinite(take) ? take : 'does not fit'}. Store ${dp[row][c]}; previous-row lookup prevents reusing this item.`, grid(dp, [[row, c], [row - 1, c]]));
    }
  });
  const selected = [];
  let c = capacity;
  for (let row = items.length; row > 0; row--) if (dp[row][c] > dp[row - 1][c]) {
    selected.push(row - 1); c -= items[row - 1][0];
    r.step('Reconstruct a taken item', `Row ${row} improves on skipping, so include item ${row - 1} and reduce remaining capacity to ${c}. Then move to the previous item row.`, grid(dp, [[row - 1, c]]));
  }
  selected.reverse();
  return r.end('Optimal 0/1 value', 'Each reconstruction step moves to a previous item row, so no item can appear twice. Ties favor skipping for deterministic output.', grid(dp, [[items.length, capacity]]), `value: ${dp[items.length][capacity]}; items: ${selected.join(', ') || 'none'}`);
}

function coinChange({ coins, amount }) {
  const r = recorder(), dp = Array(amount + 1).fill(Infinity), last = Array(amount + 1).fill(null);
  dp[0] = 0;
  const view = active => array(dp.map(v => Number.isFinite(v) ? v : '∞'), active);
  r.step('Zero amount needs zero coins', 'All positive amounts begin unreachable. With unlimited positive integer denominations, dp[x] is the minimum count among choices for the last coin of x.', view([0]));
  for (let x = 1; x <= amount; x++) {
    for (const coin of coins) {
      if (coin > x) continue;
      const candidate = dp[x - coin] + 1;
      if (candidate < dp[x]) { dp[x] = candidate; last[x] = coin; }
      r.step('Try one last denomination', `For amount ${x}, coin ${coin} uses dp[${x - coin}] + 1 = ${Number.isFinite(candidate) ? candidate : '∞'}. Best so far is ${Number.isFinite(dp[x]) ? dp[x] : 'unreachable'}; an unreachable predecessor cannot create a route.`, view([x - coin, x]));
    }
  }
  const chosen = [];
  if (Number.isFinite(dp[amount])) for (let x = amount; x > 0; x -= last[x]) chosen.push(last[x]);
  return r.end('Minimum coin count', Number.isFinite(dp[amount]) ? 'Following saved last-coin choices reduces the amount to zero and constructs an optimal payment; denominations may repeat.' : 'No last-coin transition reached this amount, so it is impossible with the supplied denominations.', view([amount]), `minimum: ${Number.isFinite(dp[amount]) ? dp[amount] : 'unreachable'}; coins: ${chosen.join(', ') || 'none'}`);
}

function lis({ values }) {
  const r = recorder(), dp = Array(values.length).fill(1), previous = Array(values.length).fill(-1);
  r.step('A subsequence can skip positions', 'dp[i] starts at one for the single-element subsequence ending at i. Extend only from an earlier position with a strictly smaller value.', { ...array(values), secondary: dp });
  for (let i = 0; i < values.length; i++) for (let j = 0; j < i; j++) {
    const improves = values[j] < values[i] && dp[j] + 1 > dp[i];
    if (improves) { dp[i] = dp[j] + 1; previous[i] = j; }
    r.step(improves ? 'Extend an increasing subsequence' : 'Reject a non-improving predecessor', `${values[j]} at ${j} ${values[j] < values[i] ? 'is smaller' : 'is not strictly smaller'} than ${values[i]} at ${i}. ${improves ? `Set length ${dp[i]} and predecessor ${j}.` : 'Keep the existing best ending length.'} Completed earlier dp states certify each extension.`, { ...array(values, [j, i]), secondary: dp });
  }
  let end = -1;
  for (let i = 0; i < dp.length; i++) if (end < 0 || dp[i] > dp[end]) end = i;
  const sequence = [];
  for (let i = end; i >= 0; i = previous[i]) sequence.push(values[i]);
  sequence.reverse();
  return r.end('Best over every ending position', 'The longest subsequence may end before the final array element. Take the maximum ending length and follow predecessor links, then reverse them.', { ...array(values), secondary: dp }, `length: ${sequence.length}; sequence: ${sequence.join(', ') || 'none'}`);
}

function lcs({ a, b }) {
  const r = recorder(), dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  const view = active => ({ ...grid(dp, active), secondary: [`rows: ∅ ${[...a].join(' ')}`, `columns: ∅ ${[...b].join(' ')}`] });
  r.step('Compare two sequence prefixes', 'dp[i][j] is the longest common subsequence length of a[:i] and b[:j]. Empty prefixes have length zero; characters may be skipped but never reordered.', view([]));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const match = a[i - 1] === b[j - 1];
    dp[i][j] = match ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    r.step(match ? 'Match the prefix endings' : 'Skip an unmatched ending', match ? `${a[i - 1]} matches ${b[j - 1]}: extend diagonal length ${dp[i - 1][j - 1]} to ${dp[i][j]}. Earlier prefix states are complete.` : `${a[i - 1]} differs from ${b[j - 1]}: max(top ${dp[i - 1][j]}, left ${dp[i][j - 1]}) = ${dp[i][j]}. One ending must be skipped.`, view([[i, j]]));
  }
  let i = a.length, j = b.length;
  const sequence = [];
  while (i && j) {
    if (a[i - 1] === b[j - 1]) {
      sequence.push(a[i - 1]); i--; j--;
      r.step('Reconstruct a shared character', `Take shared ${sequence.at(-1)} and move diagonally to prefix lengths (${i}, ${j}); the remaining optimum is one shorter.`, view([[i, j]]));
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  sequence.reverse();
  return r.end('A longest common subsequence', 'Backtracking preserves order in both inputs. When several longest subsequences exist, ties move upward for deterministic output.', view([[a.length, b.length]]), `length: ${dp[a.length][b.length]}; LCS: ${sequence.join('') || 'none'}`);
}

function editDistance({ a, b }) {
  const r = recorder(), dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  const view = active => ({ ...grid(dp, active), secondary: [`source: ${a || '∅'}`, `target: ${b || '∅'}`] });
  r.step('Empty prefixes give edit bases', 'Deleting i source characters costs i; inserting j target characters costs j. Other cells will minimize unit-cost insertions, deletions, and replacements.', view([]));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const replace = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), remove = dp[i - 1][j] + 1, insert = dp[i][j - 1] + 1;
    dp[i][j] = Math.min(replace, remove, insert);
    r.step('Choose the cheapest last edit', `Prefixes (${i}, ${j}): ${a[i - 1] === b[j - 1] ? 'match' : 'replace'}=${replace}, delete=${remove}, insert=${insert}; store ${dp[i][j]}. Each option reads an already-completed shorter-prefix state.`, view([[i, j]]));
  }
  return r.end('Levenshtein distance', 'The bottom-right value is the fewest unit-cost edits transforming the whole source into the target. A character match costs zero, not one.', view([[a.length, b.length]]), `distance: ${dp[a.length][b.length]}`);
}

const bits = (value, active = []) => ({ kind: 'bits', values: Array.from({ length: 8 }, (_, bit) => (value >>> bit) & 1), labels: Array.from({ length: 8 }, (_, bit) => `2^${bit}`), active });

function masks({ value, bit }) {
  const r = recorder(), mask = 1 << bit;
  r.step('A mask isolates one bit', `Use an unsigned 8-bit example: value ${value}, target bit ${bit} counted from zero at the least significant end. Shift one to construct a single-bit mask.`, bits(value, [bit]));
  r.step('Build the mask', `1 << ${bit} = ${mask}; every other mask bit is zero, so AND cannot retain any unrelated bit.`, bits(mask, [bit]));
  const present = (value & mask) !== 0;
  r.step('Test with AND', `${value} & ${mask} = ${value & mask}; bit ${bit} is ${present ? 'set' : 'clear'}. Testing does not change the value.`, bits(value & mask, [bit]));
  const set = value | mask;
  r.step('Set with OR', `${value} | ${mask} = ${set}. OR makes the selected bit one and preserves all others.`, bits(set, [bit]));
  const cleared = set & ~mask;
  r.step('Clear with AND-NOT', `${set} & ~${mask} = ${cleared}. Only the mask's position is forced to zero.`, bits(cleared, [bit]));
  const toggled = cleared ^ mask;
  r.step('Toggle with XOR', `${cleared} ^ ${mask} = ${toggled}. XOR flips the selected bit, leaving other positions unchanged.`, bits(toggled, [bit]));
  return r.end('Read the bit operations', 'These are computed bitwise operations on the input, not decimal digit tricks. JavaScript uses 32-bit operands; these lesson inputs stay within eight bits.', bits(toggled), `was set: ${present}; set: ${set}; clear: ${cleared}; toggle: ${toggled}`);
}

function bitTricks({ value }) {
  const r = recorder(), low = value & -value;
  let x = value, count = 0;
  r.step('Count only set positions', 'For a nonnegative 8-bit integer, x & (x−1) deletes exactly its lowest set bit. Repeating until zero counts ones, not all bit positions.', bits(x));
  r.step('Isolate the lowest set bit', `${value} & -${value} = ${low}. Two's-complement negation leaves only the lowest shared one; zero has no set bit and yields zero.`, bits(low));
  while (x !== 0) {
    const old = x;
    x &= x - 1; count++;
    r.step('Erase one set bit', `${old} & ${old - 1} = ${x}; the number of remaining ones falls by exactly one. The counter ${count} records erased bits.`, bits(x), [['Erased ones', count]]);
  }
  const power = value > 0 && (value & (value - 1)) === 0;
  return r.end('Bit properties', 'A positive integer is a power of two exactly when deleting its lowest one leaves zero. The positivity check excludes zero.', bits(value), `popcount: ${count}; lowbit: ${low}; power of two: ${power}`);
}

function bitsets({ a, b, universe }) {
  const r = recorder();
  let left = 0, right = 0;
  const view = active => ({ kind: 'bits', values: Array.from({ length: universe }, (_, i) => (left >>> i) & 1), secondary: Array.from({ length: universe }, (_, i) => (right >>> i) & 1), labels: Array.from({ length: universe }, (_, i) => String(i)), active });
  r.step('Encode a small integer universe', `Members range from 0 to ${universe - 1}. A one at position i means membership of i; OR insertion is idempotent, so duplicates do not create extra members.`, view([]));
  for (const member of a) {
    left |= 1 << member;
    r.step('Insert into set A', `Set bit ${member} in A. All previously inserted members remain present; inserting an existing member changes nothing.`, view([member]));
  }
  for (const member of b) {
    right |= 1 << member;
    r.step('Insert into set B', `Set bit ${member} in B without changing A. Each mask now exactly represents its processed members.`, view([member]));
  }
  const union = left | right, intersection = left & right, difference = left & ~right;
  const decode = mask => Array.from({ length: universe }, (_, i) => i).filter(i => (mask & (1 << i)) !== 0).join(', ') || 'none';
  for (const [label, mask, reason] of [['Union', union, 'OR keeps positions present in either set'], ['Intersection', intersection, 'AND keeps only positions present in both sets'], ['A minus B', difference, 'AND-NOT keeps A positions absent from B']]) {
    r.step(label, `${reason}. Decode the computed mask ${mask} to members ${decode(mask)}; each displayed position still means one universe element.`, { kind: 'bits', values: Array.from({ length: universe }, (_, i) => (mask >>> i) & 1), active: [] });
  }
  return r.end('Set algebra in a word', 'These examples fit in one 32-bit word. Larger universes require arrays of words, and set operations then scale with the number of words.', view([]), `union: ${decode(union)}; intersection: ${decode(intersection)}; A\\B: ${decode(difference)}`);
}

function pVsNp({ values, target, certificate }) {
  const r = recorder(), seen = new Set();
  let sum = 0, valid = true, checks = 0;
  r.step('A decision question and a proposed witness', `Does a subset sum to ${target}? The certificate supplies input indices. Verification checks range, uniqueness, and total; search must discover a witness rather than receive one.`, array(values));
  for (const index of certificate) {
    checks++;
    if (!Number.isInteger(index) || index < 0 || index >= values.length || seen.has(index)) {
      valid = false;
      r.step('Reject an invalid certificate index', `Index ${index} is repeated or outside the input. A subset certificate cannot reuse positions; this certificate is invalid regardless of its sum.`, array(values));
    } else {
      seen.add(index); sum += values[index];
      r.step('Verify a certificate element', `Add value ${values[index]} at unique index ${index}; partial certificate sum is ${sum}. Only the supplied positions are examined.`, array(values, [index]), [['Certificate checks', checks], ['Partial sum', sum]]);
    }
  }
  valid &&= sum === target;
  r.step('Finish certificate verification', `The certificate sum ${sum} ${sum === target ? 'matches' : 'does not match'} ${target}; range and uniqueness checks ${valid ? 'also passed' : 'do not yield an accepted witness'}. Verification accepts=${valid}.`, array(values, [...seen]));
  let searched = 0, witness = null;
  for (let mask = 0; mask < 2 ** values.length; mask++) {
    let candidate = 0;
    const indices = [];
    for (let i = 0; i < values.length; i++) if ((mask & (1 << i)) !== 0) { candidate += values[i]; indices.push(i); }
    searched++;
    r.step('Enumerate a candidate subset', `Mask ${mask} selects indices [${indices.join(', ')}], sum ${candidate}. This finite exhaustive algorithm has checked ${searched} candidate subsets; it has not established a lower bound for other algorithms.`, array(values, indices), [['Candidates searched', searched], ['Candidate sum', candidate]]);
    if (candidate === target) { witness = indices; break; }
  }
  return r.end('Evidence, not a separation proof', 'Subset-sum has efficiently checkable certificates and is NP-complete for binary-encoded integers. This particular exhaustive search can examine 2^n subsets; it does not prove that all algorithms must. Whether P=NP remains open.', array(values, witness || []), `certificate: ${valid ? 'valid' : 'invalid'}; found: ${witness ? 'yes' : 'no'}; candidates: ${searched}`, [['Certificate index checks', checks], ['Search candidates', searched]]);
}

export const topics = {
  'binary-search': defineTopic({
    intro: 'Binary search uses sorted order as evidence. Compare one midpoint, then eliminate a whole side instead of checking positions one at a time.',
    invariant: 'If the target exists and has not been found, at least one matching index remains inside the inclusive bounds [lo, hi].',
    takeaway: 'Move bounds past a mismatching midpoint; stop when bounds cross. Search does not pay for sorting and returns any matching index, not necessarily the first duplicate.',
    complexity: { time: 'O(log n) comparisons on an already sorted random-access array; sorting is not included.', space: 'O(1) auxiliary search state, excluding the recorded visualization snapshots.' },
    examples: [example('Present in the middle', { values: [2, 5, 8, 12, 16, 23, 38], target: 16 }, 'index: 4'), example('Missing between values', { values: [1, 4, 7, 10], target: 6 }, 'index: -1')],
    trace: binarySearch,
    code: code(`lo ← 0; hi ← length(A) − 1
WHILE lo ≤ hi
  mid ← lo + floor((hi − lo) / 2)
  IF A[mid] = target: RETURN mid
  IF A[mid] < target: lo ← mid + 1
  ELSE: hi ← mid − 1
RETURN −1`, `function binarySearch(a, target) {
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`, `def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`),
    quiz: quiz('Why is lo = mid + 1 safe when A[mid] < target?', ['Sorted order excludes every index at or before mid.', 'The target must be at the last index.', 'The left side has fewer elements.', 'All values are distinct.'], 0, 'Sortedness makes every earlier value no larger than the mismatching midpoint; duplicates do not invalidate this exclusion.'),
    challenge: challenge('On [1, 3, 5, 7, 9], target 8: what index is returned?', '-1', 'Track the inclusive bounds after comparing 5, then 7, then 9.', 'The final bounds are lo=4, hi=3. There is no remaining position that could contain 8.'),
  }),
  'binary-search-answer': defineTopic({
    intro: 'Some problems hide a sorted yes/no pattern among answers. Find the slowest integer eating speed that finishes all piles within a fixed hour budget.',
    invariant: 'The minimum feasible speed stays within [lo, hi]; the upper endpoint is feasible and all speeds below lo are infeasible.',
    takeaway: 'Write and justify a monotone feasibility predicate before searching. Ceiling division matters because even a partial final pile-hour counts.',
    complexity: { time: 'O(n log M) for n positive piles and maximum pile M; each speed test scans all piles. Assumes hours ≥ n.', space: 'O(1) auxiliary state with a running hours sum; the visual trace also displays per-pile hour counts.' },
    examples: [example('A tight budget', { piles: [3, 6, 7, 11], hours: 8 }, 'speed: 4'), example('One hour per pile', { piles: [30, 11, 23, 4, 20], hours: 5 }, 'speed: 30')],
    trace: answerSearch,
    code: code(`lo ← 1; hi ← maximum(piles)
WHILE lo < hi
  speed ← floor((lo + hi) / 2)
  needed ← SUM ceil(pile / speed)
  IF needed ≤ hours: hi ← speed
  ELSE: lo ← speed + 1
RETURN lo`, `function minimumSpeed(piles, hours) {
  let lo = 1, hi = Math.max(...piles);
  while (lo < hi) {
    const speed = Math.floor((lo + hi) / 2);
    const needed = piles.reduce((s, p) => s + Math.ceil(p / speed), 0);
    if (needed <= hours) hi = speed;
    else lo = speed + 1;
  }
  return lo;
}`, `def minimum_speed(piles, hours):
    lo, hi = 1, max(piles)
    while lo < hi:
        speed = (lo + hi) // 2
        needed = sum((p + speed - 1) // speed for p in piles)
        if needed <= hours:
            hi = speed
        else:
            lo = speed + 1
    return lo`),
    quiz: quiz('Why keep a feasible trial as hi rather than hi = trial − 1?', ['It may itself be the minimum feasible speed.', 'All lower speeds are feasible.', 'Feasibility is random.', 'The trial is always the maximum pile.'], 0, 'The first-true search preserves a feasible endpoint; discarding a feasible trial could discard the optimum.'),
    challenge: challenge('Piles [4, 8], budget 4: what minimum speed works?', '4', 'At speed 3, ceil(4/3)+ceil(8/3)=5.', 'Speed 4 takes 1+2=3 hours. Speed 3 is infeasible, and every slower speed needs at least as much time.'),
  }),
  'simple-sorts': defineTopic({
    intro: 'Insertion sort makes an unsorted array manageable by growing a sorted prefix. Hold one key, shift larger prefix values, and close the resulting hole.',
    invariant: 'Before iteration i, indices below i are sorted; while shifting, the held key plus the visible values preserve the input multiset.',
    takeaway: 'Insertion sort is useful for short or nearly ordered runs. Selection sort minimizes swaps and bubble sort exchanges neighbors, but neither shares insertion sort’s exact shift process.',
    complexity: { time: 'O(n²) worst case on reverse order; O(n) on already sorted input. Work is proportional to inversions plus n.', space: 'O(1) auxiliary state for in-place insertion sort; the trace copies the input to preserve examples.' },
    examples: [example('Several inversions', { values: [5, 2, 4, 1] }, 'sorted: 1, 2, 4, 5'), example('Already ordered with ties', { values: [1, 2, 2, 4] }, 'sorted: 1, 2, 2, 4')],
    trace: insertionSort,
    code: code(`FOR i from 1 to n − 1
  key ← A[i]; j ← i − 1
  WHILE j ≥ 0 AND A[j] > key
    A[j + 1] ← A[j]; j ← j − 1
  A[j + 1] ← key`, `function insertionSort(a) {
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}`, `def insertion_sort(a):
    for i in range(1, len(a)):
        key, j = a[i], i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a`),
    quiz: quiz('What is sorted after insertion iteration i?', ['The prefix through index i.', 'Only the suffix after i.', 'The entire array immediately.', 'Only the held key.'], 0, 'Inserting the next key into an already sorted prefix extends that prefix by one.'),
    challenge: challenge('How many shifts does insertion sort perform on [3, 2, 1]?', '3', 'Each inversion is removed by one shift.', 'Inserting 2 shifts 3 once; inserting 1 shifts 3 and 2, giving three shifts.'),
  }),
  'merge-sort': defineTopic({
    intro: 'Merge sort separates the problem into short runs, then combines sorted runs by repeatedly taking their smallest remaining heads.',
    invariant: 'During a merge, output is a sorted prefix containing exactly the consumed elements from the two sorted input runs.',
    takeaway: 'Choosing the left head on equal keys makes the merge stable. The predictable balanced splits avoid quicksort’s pivot-dependent worst case.',
    complexity: { time: 'O(n log n) for all input orders: O(n) merging work across each of O(log n) levels.', space: 'O(n) peak auxiliary merge storage plus O(log n) recursion depth; emitted snapshots are excluded.' },
    examples: [example('Interleaved halves', { values: [7, 2, 6, 1, 5, 3] }, 'sorted: 1, 2, 3, 5, 6, 7'), example('Repeated and negative values', { values: [2, -1, 2, 0] }, 'sorted: -1, 0, 2, 2')],
    trace: mergeSort,
    code: code(`IF length(A) ≤ 1: RETURN A
split A into left and right halves
left ← MERGESORT(left); right ← MERGESORT(right)
WHILE either run has elements
  take left head if right empty or left head ≤ right head
  otherwise take right head
RETURN merged run`, `function mergeSort(a) {
  if (a.length < 2) return a.slice();
  const m = Math.floor(a.length / 2);
  const l = mergeSort(a.slice(0, m)), r = mergeSort(a.slice(m));
  const out = [];
  let i = 0, j = 0;
  while (i < l.length || j < r.length) {
    if (j === r.length || (i < l.length && l[i] <= r[j])) out.push(l[i++]);
    else out.push(r[j++]);
  }
  return out;
}`, `def merge_sort(a):
    if len(a) < 2:
        return a[:]
    m = len(a) // 2
    left, right = merge_sort(a[:m]), merge_sort(a[m:])
    out, i, j = [], 0, 0
    while i < len(left) or j < len(right):
        if j == len(right) or (i < len(left) and left[i] <= right[j]):
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    return out`),
    quiz: quiz('When merge heads tie, which choice preserves stability?', ['The left head first.', 'The right head first.', 'Either choice always preserves stability.', 'Discard both equal heads.'], 0, 'A left-run record preceded the right-run record in the original sequence, so taking left first preserves that order.'),
    challenge: challenge('Merge [1, 4, 8] and [2, 3, 9]. What is the output?', '1, 2, 3, 4, 8, 9', 'Only compare the two remaining heads.', 'Taking the smaller head successively gives 1,2,3,4,8; after the left run empties, append 9.'),
  }),
  'quick-sort': defineTopic({
    intro: 'Quicksort rearranges a run around a pivot before recursing. This lesson uses the last value as pivot and swaps smaller scanned values into a growing low region.',
    invariant: 'During partitioning, the low region contains values < pivot; other scanned positions contain values ≥ pivot; unscanned positions are undecided.',
    takeaway: 'The pivot is fixed after partitioning and must be excluded from both recursive calls. This in-place scheme is not stable and is sensitive to poor pivots.',
    complexity: { time: 'O(n log n) expected for randomly ordered distinct inputs; O(n²) worst case for sorted or all-equal input with this last-pivot rule.', space: 'O(log n) expected recursion depth, O(n) worst case; partition itself uses O(1) state.' },
    examples: [example('Mixed pivot positions', { values: [6, 3, 8, 2, 5] }, 'sorted: 2, 3, 5, 6, 8'), example('Equal pivots', { values: [3, 3, 1, 3] }, 'sorted: 1, 3, 3, 3')],
    trace: quickSort,
    code: code(`PARTITION(A, lo, hi):
  pivot ← A[hi]; p ← lo
  FOR j from lo to hi − 1
    IF A[j] < pivot: SWAP A[p], A[j]; p ← p + 1
  SWAP A[p], A[hi]; RETURN p
QUICKSORT(A, lo, hi):
  IF lo ≥ hi: RETURN
  p ← PARTITION(A, lo, hi)
  QUICKSORT(A, lo, p − 1); QUICKSORT(A, p + 1, hi)`, `function partition(a, lo, hi) {
  const pivot = a[hi];
  let p = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] < pivot) { [a[p], a[j]] = [a[j], a[p]]; p++; }
  }
  [a[p], a[hi]] = [a[hi], a[p]];
  return p;
}
function quickSort(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return a;
  const p = partition(a, lo, hi);
  quickSort(a, lo, p - 1); quickSort(a, p + 1, hi);
  return a;
}`, `def partition(a, lo, hi):
    pivot, p = a[hi], lo
    for j in range(lo, hi):
        if a[j] < pivot:
            a[p], a[j] = a[j], a[p]
            p += 1
    a[p], a[hi] = a[hi], a[p]
    return p
def quick_sort(a, lo=0, hi=None):
    if hi is None: hi = len(a) - 1
    if lo < hi:
        p = partition(a, lo, hi)
        quick_sort(a, lo, p - 1)
        quick_sort(a, p + 1, hi)
    return a`),
    quiz: quiz('What is guaranteed immediately after partition?', ['The pivot separates lower and higher-or-equal regions.', 'Both regions are internally sorted.', 'All equal keys retain order.', 'The pivot must be the median.'], 0, 'Partitioning establishes a relation to one pivot; recursive sorting establishes order inside the two regions.'),
    challenge: challenge('Partition [4, 1, 3, 2] using final pivot 2. What pivot index results?', '1', 'Only 1 is strictly below 2.', 'Swap 1 to the front, then swap pivot 2 into the boundary at index 1, yielding [1,2,3,4].'),
  }),
  quickselect: defineTopic({
    intro: 'Quickselect uses a partition to locate a requested rank, then explores only the side that can contain that rank. Sorting all other values is unnecessary.',
    invariant: 'The requested sorted index remains inside the active bounds; every discarded partition lies entirely on the wrong side of a fixed pivot.',
    takeaway: 'One-sided recursion can save work, but deterministic poor pivots still cause quadratic behavior. Rank here is one-based; array indices are zero-based.',
    complexity: { time: 'O(n) expected with random pivots or random distinct input order; O(n²) worst case for this deterministic last-pivot implementation.', space: 'O(1) iterative selection and in-place partition state, excluding the input copy and frames.' },
    examples: [example('Third-smallest without full sorting', { values: [9, 1, 7, 3, 5], k: 3 }, 'rank 3: 5'), example('Repeated values count as separate ranks', { values: [4, 2, 2, 8], k: 2 }, 'rank 2: 2')],
    trace: quickselect,
    code: code(`target ← k − 1; lo ← 0; hi ← n − 1
WHILE lo ≤ hi
  p ← partition around last element
  IF p = target: RETURN A[p]
  IF p < target: lo ← p + 1
  ELSE: hi ← p − 1`, `function quickselect(a, k) {
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const pivot = a[hi];
    let p = lo;
    for (let j = lo; j < hi; j++) {
      if (a[j] < pivot) { [a[p], a[j]] = [a[j], a[p]]; p++; }
    }
    [a[p], a[hi]] = [a[hi], a[p]];
    if (p === k - 1) return a[p];
    if (p < k - 1) lo = p + 1;
    else hi = p - 1;
  }
  throw new RangeError('Invalid rank');
}`, `def quickselect(a, k):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        pivot, p = a[hi], lo
        for j in range(lo, hi):
            if a[j] < pivot:
                a[p], a[j] = a[j], a[p]
                p += 1
        a[p], a[hi] = a[hi], a[p]
        if p == k - 1: return a[p]
        if p < k - 1: lo = p + 1
        else: hi = p - 1
    raise ValueError('Invalid rank')`),
    quiz: quiz('If pivot index is 2 and target index is 5, which range remains?', ['Indices greater than 2.', 'Indices less than 2.', 'Both partitions.', 'Only index 2.'], 0, 'The pivot and lower partition occupy sorted ranks up to index 2, so none can be the rank at index 5.'),
    challenge: challenge('What is rank 4 in [8, 2, 5, 2, 9]?', '8', 'Duplicates occupy separate positions in sorted order.', 'Sorted order is [2,2,5,8,9], making 8 the fourth-smallest value.'),
  }),
  'counting-radix-sort': defineTopic({
    intro: 'Counting sort uses a bounded key range rather than comparisons. Radix sort reuses a stable counting pass on each decimal digit, from least significant to most significant.',
    invariant: 'After each digit pass, output is sorted by all processed low-order digits; stability preserves that order within equal new-digit buckets.',
    takeaway: 'The comparison-sorting bound does not forbid faster sorting when integer key structure is available. Counting range, digit count, and stable placement are the real costs.',
    complexity: { time: 'O(d(n + 10)) for d decimal digits of nonnegative integer keys; one full-range counting pass instead costs O(n + K).', space: 'O(n + 10) for radix output and digit counts; full-range counting would use O(n + K) stable output storage.' },
    examples: [example('Three decimal digit passes', { values: [170, 45, 75, 90, 802, 24, 2, 66] }, 'sorted: 2, 24, 45, 66, 75, 90, 170, 802'), example('Zeros and equal low digits', { values: [10, 0, 20, 10] }, 'sorted: 0, 10, 10, 20')],
    trace: radixSort,
    code: code(`FOR place ← 1, 10, 100, ... through maximum key
  count digit frequencies into count[0..9]
  prefix-sum count to exclusive bucket ends
  FOR i from n − 1 down to 0
    digit ← floor(A[i] / place) mod 10
    count[digit] ← count[digit] − 1
    output[count[digit]] ← A[i]
  A ← output`, `function radixSort(a) {
  a = a.slice();
  const max = Math.max(0, ...a);
  for (let place = 1; Math.floor(max / place) > 0; place *= 10) {
    const count = Array(10).fill(0), out = Array(a.length);
    for (const x of a) count[Math.floor(x / place) % 10]++;
    for (let d = 1; d < 10; d++) count[d] += count[d - 1];
    for (let i = a.length - 1; i >= 0; i--) {
      const d = Math.floor(a[i] / place) % 10;
      out[--count[d]] = a[i];
    }
    a = out;
  }
  return a;
}`, `def radix_sort(a):
    a = a[:]
    place, largest = 1, max(a, default=0)
    while largest // place > 0:
        count, out = [0] * 10, [0] * len(a)
        for x in a: count[(x // place) % 10] += 1
        for d in range(1, 10): count[d] += count[d - 1]
        for x in reversed(a):
            d = (x // place) % 10
            count[d] -= 1
            out[count[d]] = x
        a, place = out, place * 10
    return a`),
    quiz: quiz('Why must each least-significant-digit pass be stable?', ['Equal new digits must retain previously sorted low digits.', 'Stability makes negative keys valid automatically.', 'It eliminates the output array.', 'It sorts all digits in a single pass.'], 0, 'A later digit pass must not destroy ordering learned from earlier low-order passes.'),
    challenge: challenge('After the units pass on [21, 12, 11, 22], what is the order?', '21, 11, 12, 22', 'Group by units digit, preserving input order inside each group.', 'The digit-1 bucket is [21,11], followed by digit-2 bucket [12,22]; the tens pass completes numeric order.'),
  }),
  'sorting-stability': defineTopic({
    intro: 'Equal numeric keys can belong to different records. Tagged records make stability observable: sort only the key, but inspect whether equal-key tags retain their original order.',
    invariant: 'The sorted prefix is key-ordered, and every group of equal keys retains the relative input order of its tags.',
    takeaway: 'Stability supports multi-key sorting by sorting secondary keys first and primary keys last. It is independent of the Ω(n log n) worst-case comparison lower bound.',
    complexity: { time: 'This stable insertion demonstration takes O(n²) worst case and O(n) on sorted keys. Arbitrary distinct-key comparison sorting needs Ω(n log n) comparisons in the worst case.', space: 'O(1) auxiliary insertion state on a mutable tagged array, excluding input copying and trace snapshots.' },
    examples: [example('Tags cross larger keys, not equal keys', { entries: [[2, 'A'], [1, 'B'], [2, 'C'], [1, 'D']] }, 'order: 1:B, 1:D, 2:A, 2:C'), example('All keys tie', { entries: [[3, 'X'], [3, 'Y'], [3, 'Z']] }, 'order: 3:X, 3:Y, 3:Z')],
    trace: stableSort,
    code: code(`FOR each record after the first
  hold record
  shift earlier records whose key > held.key
  insert held after all earlier equal keys
RETURN records in stable key order`, `function stableInsertion(records) {
  const a = records.map(([key, tag]) => ({ key, tag }));
  for (let i = 1; i < a.length; i++) {
    const held = a[i];
    let j = i - 1;
    while (j >= 0 && a[j].key > held.key) {
      a[j + 1] = a[j]; j--;
    }
    a[j + 1] = held;
  }
  return a.map(({ key, tag }) => [key, tag]);
}`, `def stable_insertion(records):
    a = records[:]
    for i in range(1, len(a)):
        held, j = a[i], i - 1
        while j >= 0 and a[j][0] > held[0]:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = held
    return a`),
    quiz: quiz('Changing the shift comparison from > to ≥ would do what?', ['Move later equal-key records before earlier ones.', 'Improve stability.', 'Make the sort linear in every case.', 'Change the numeric sorted order.'], 0, 'Equal keys would shift past the held record, reversing their original relative order even though numeric order stays valid.'),
    challenge: challenge('Stable-sort [(2,A),(1,B),(2,C)] by key. Which tag comes first among key 2?', 'A', 'Stability remembers relative input order, not alphabetical order.', 'A preceded C before sorting, so it must still precede C after sorting by key.'),
  }),
  'interval-scheduling': defineTopic({
    intro: 'To schedule the greatest number of nonoverlapping jobs, take the compatible job that finishes first. Its short commitment preserves room for future choices.',
    invariant: 'Selected half-open intervals never overlap, and the current finish is no later than the corresponding finish of a competing maximum-cardinality schedule.',
    takeaway: 'Finish-time greediness solves unweighted cardinality scheduling. Choosing the earliest start, longest duration, or largest reward does not have the same guarantee.',
    complexity: { time: 'O(n log n) to sort jobs by end time, then O(n) scanning; O(n) if already end-sorted.', space: 'O(n) for the sorted copy and selected job indices in this implementation.' },
    examples: [example('One long job competes with many short jobs', { intervals: [[0, 6], [1, 2], [2, 4], [4, 5], [5, 7]] }, 'jobs: 1, 2, 3, 4; count: 4'), example('Touching is allowed but overlaps are not', { intervals: [[0, 2], [1, 3], [2, 4], [3, 5]] }, 'jobs: 0, 2; count: 2')],
    trace: intervalScheduling,
    code: code(`sort jobs by increasing end, breaking ties by input index
finish ← −∞; selected ← empty
FOR each job
  IF job.start ≥ finish
    append job index; finish ← job.end
RETURN selected`, `function schedule(intervals) {
  const jobs = intervals.map(([start, end], id) => ({ start, end, id }));
  jobs.sort((a, b) => a.end - b.end || a.id - b.id);
  let finish = -Infinity;
  const selected = [];
  for (const job of jobs) {
    if (job.start >= finish) {
      selected.push(job.id);
      finish = job.end;
    }
  }
  return selected;
}`, `def schedule(intervals):
    jobs = sorted(enumerate(intervals), key=lambda p: (p[1][1], p[0]))
    finish, selected = float('-inf'), []
    for index, (start, end) in jobs:
        if start >= finish:
            selected.append(index)
            finish = end
    return selected`),
    quiz: quiz('Why prefer the earliest compatible end?', ['It leaves at least as much future room as any compatible replacement.', 'It guarantees the highest reward.', 'It chooses the longest job.', 'It requires every start to be sorted.'], 0, 'Replacing the first job of an optimal schedule with an earlier-finishing compatible job cannot invalidate the later jobs.'),
    challenge: challenge('For [0,3), [1,2), [2,4), which job indices are selected?', '1, 2', 'Sort by end, then allow start equal to the last finish.', 'Job 1 finishes at 2; job 0 overlaps it; job 2 starts exactly at 2 and is accepted.'),
  }),
  'huffman-coding': defineTopic({
    intro: 'Huffman coding gives frequent symbols shorter paths in a binary prefix tree. Repeatedly pair the two smallest remaining frequencies, turning a forest into one encoding tree.',
    invariant: 'Every forest root weight equals the sum of its leaf frequencies, and each merge preserves the full set of symbol leaves.',
    takeaway: 'Read edge labels from root to leaf to obtain prefix-free codes. Ties can produce different equally good codes; the weighted path length is what is minimized.',
    complexity: { time: 'This small visual version re-sorts the forest and takes O(k² log k); a min-heap implementation takes O(k log k) for k symbols. Code output adds total code length.', space: 'O(k + L) for 2k−1 tree nodes and L total output code bits; traversal stack is O(k) worst case.' },
    examples: [example('Unequal symbol frequencies', { frequencies: [['A', 5], ['B', 9], ['C', 12], ['D', 13]] }, 'codes: A=00, B=01, C=10, D=11; weighted bits: 78'), example('One frequent symbol', { frequencies: [['A', 1], ['B', 1], ['C', 8]] }, 'codes: A=00, B=01, C=1; weighted bits: 12')],
    trace: huffman,
    code: code(`create one leaf per symbol; assign increasing serial numbers
WHILE forest has more than one root
  sort roots by (weight, serial)
  remove two minimum roots as left and right
  insert parent with their sum and next serial
walk root: append 0 left, 1 right
at each leaf store path (or "0" for a sole symbol)`, `function huffman(frequencies) {
  let serial = 0;
  const q = frequencies.map(([symbol, weight]) => ({ symbol, weight, serial: serial++ }));
  while (q.length > 1) {
    q.sort((a, b) => a.weight - b.weight || a.serial - b.serial);
    const left = q.shift(), right = q.shift();
    q.push({ weight: left.weight + right.weight, serial: serial++, left, right });
  }
  const codes = {};
  function walk(node, prefix) {
    if (!node.left) codes[node.symbol] = prefix || '0';
    else { walk(node.left, prefix + '0'); walk(node.right, prefix + '1'); }
  }
  if (q.length) walk(q[0], '');
  return codes;
}`, `def huffman(frequencies):
    forest = [dict(symbol=s, weight=w, serial=i) for i, (s, w) in enumerate(frequencies)]
    serial = len(forest)
    while len(forest) > 1:
        forest.sort(key=lambda t: (t['weight'], t['serial']))
        left, right = forest.pop(0), forest.pop(0)
        forest.append(dict(weight=left['weight'] + right['weight'], serial=serial, left=left, right=right))
        serial += 1
    codes = {}
    def walk(node, prefix):
        if 'left' not in node: codes[node['symbol']] = prefix or '0'
        else:
            walk(node['left'], prefix + '0')
            walk(node['right'], prefix + '1')
    if forest: walk(forest[0], '')
    return codes`),
    quiz: quiz('Why can no Huffman symbol code prefix another?', ['Symbol codes terminate at leaves, not internal nodes.', 'All codes have the same length.', 'Frequencies are distinct.', 'The tree has only left edges.'], 0, 'A leaf has no descendant path, so its complete root-to-leaf code cannot be an initial segment of another leaf path.'),
    challenge: challenge('Frequencies A=1, B=1, C=8: what weighted bit cost does Huffman obtain?', '12', 'A and B first form weight 2, then merge with C.', 'A and B have depth 2, while C has depth 1: 1×2 + 1×2 + 8×1 = 12.'),
  }),
  'when-greedy-fails': defineTopic({
    intro: 'A greedy rule needs a proof, not a plausible slogan. Largest-coin-first looks sensible, but denomination systems can force its early choice into an expensive remainder.',
    invariant: 'Greedy preserves the paid sum, whereas dp[x] certifies the best count over every possible last coin for amount x.',
    takeaway: 'A single counterexample refutes a universal greedy claim. Dynamic programming provides an exact comparison, including unreachable states, without assuming a special coin system.',
    complexity: { time: 'O(m log m + g + amount×m): sorting m denominations, taking g greedy coins, and exact amount DP. Positive integer denominations only.', space: 'O(amount + g + m) for the optimal table, displayed greedy coins, and sorted denominations.' },
    examples: [example('Greedy loses to two threes', { coins: [1, 3, 4], amount: 6 }, 'greedy: 3; optimal: 2'), example('A system where this amount agrees', { coins: [1, 5, 10], amount: 12 }, 'greedy: 3; optimal: 3')],
    trace: greedyFailure,
    code: code(`take largest fitting coins until no coin fits
record greedy count, or unreachable if remainder remains
dp[0] ← 0; other dp ← ∞
FOR x from 1 through amount
  FOR coin ≤ x
    dp[x] ← min(dp[x], dp[x − coin] + 1)
compare greedy result with dp[amount]`, `function compareGreedy(coins, amount) {
  let remainder = amount, greedy = 0;
  for (const c of [...coins].sort((a, b) => b - a)) {
    while (remainder >= c) { remainder -= c; greedy++; }
  }
  const dp = Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let x = 1; x <= amount; x++)
    for (const c of coins)
      if (c <= x) dp[x] = Math.min(dp[x], dp[x - c] + 1);
  return { greedy: remainder ? Infinity : greedy, optimal: dp[amount] };
}`, `def compare_greedy(coins, amount):
    remainder, greedy = amount, 0
    for coin in sorted(coins, reverse=True):
        while remainder >= coin:
            remainder -= coin
            greedy += 1
    dp = [0] + [float('inf')] * amount
    for x in range(1, amount + 1):
        for coin in coins:
            if coin <= x:
                dp[x] = min(dp[x], dp[x - coin] + 1)
    return (greedy if remainder == 0 else float('inf'), dp[amount])`),
    quiz: quiz('What does a counterexample to largest-coin-first establish?', ['The rule is not correct for every denomination system.', 'Every greedy algorithm is wrong.', 'Coin change has no exact algorithm.', 'DP is always faster than greedy.'], 0, 'It refutes this particular universal claim, not all greedy methods or their proven applications.'),
    challenge: challenge('With coins [1,3,4] and amount 6, give an optimal payment.', '3 + 3', 'Compare two coins with greedy’s 4+1+1.', 'Two threes pay 6 with two coins; no single available coin pays 6, so two is optimal.'),
  }),
  subsets: defineTopic({
    intro: 'Subsets arise from a binary choice at each input position: leave it out or include it. A mutable path lets recursion explore those decisions without copying each partial branch.',
    invariant: 'At depth i, the path contains exactly the selected positions below i. Returning from a branch restores the caller’s original path.',
    takeaway: 'Emit at leaves, copy emitted paths, and undo every push. The empty subset is a valid leaf, not a special case to omit.',
    complexity: { time: 'O(n 2^n) when materializing all subsets of n distinct input values; there are 2^n leaves and output copying costs up to n per leaf.', space: 'O(n) working stack/path, plus O(n 2^n) output storage.' },
    examples: [example('Three binary choices', { values: [1, 2, 3] }, 'subsets: [] [3] [2] [2,3] [1] [1,3] [1,2] [1,2,3]; count: 8'), example('No positions to choose', { values: [] }, 'subsets: []; count: 1')],
    trace: subsets,
    code: code(`VISIT(i):
  IF i = n: emit copy(path); RETURN
  VISIT(i + 1)                   // exclude
  push A[i] onto path
  VISIT(i + 1)                   // include
  pop path                       // undo
VISIT(0)`, `function subsets(values) {
  const path = [], output = [];
  function visit(i) {
    if (i === values.length) { output.push(path.slice()); return; }
    visit(i + 1);
    path.push(values[i]);
    visit(i + 1);
    path.pop();
  }
  visit(0);
  return output;
}`, `def subsets(values):
    path, output = [], []
    def visit(i):
        if i == len(values):
            output.append(path[:])
            return
        visit(i + 1)
        path.append(values[i])
        visit(i + 1)
        path.pop()
    visit(0)
    return output`),
    quiz: quiz('Why copy the path when emitting a subset?', ['Later pops and pushes would otherwise change saved outputs.', 'Copying prunes duplicate values.', 'It reduces the number of subsets.', 'It is required only for empty subsets.'], 0, 'All branches reuse the same mutable path, so output must own its leaf state.'),
    challenge: challenge('How many subsets does a four-position input have, including empty?', '16', 'Each position has two independent decisions.', 'The include/exclude tree has 2^4=16 leaves.'),
  }),
  permutations: defineTopic({
    intro: 'A permutation chooses a different unused input position for each slot. Unlike subsets, every position must eventually appear; the order of choices is the output.',
    invariant: 'Used flags and the path describe the same chosen positions, each appearing exactly once; undo restores both structures together.',
    takeaway: 'Reusing a value is forbidden by position, and every choice needs an undo. Repeated input values require an extra duplicate-elimination policy to enumerate unique value permutations.',
    complexity: { time: 'O(n n!) to materialize all orders of n distinct values; each of n! outputs has n values.', space: 'O(n) recursion/path/flags plus O(n n!) stored output.' },
    examples: [example('Three distinct positions', { values: [1, 2, 3] }, 'permutations: [1,2,3] [1,3,2] [2,1,3] [2,3,1] [3,1,2] [3,2,1]; count: 6'), example('A single legal ordering', { values: [7] }, 'permutations: [7]; count: 1')],
    trace: permutations,
    code: code(`VISIT():
  IF path length = n: emit copy(path); RETURN
  FOR each input position i
    IF used[i]: CONTINUE
    used[i] ← true; push A[i]
    VISIT()
    pop path; used[i] ← false
VISIT()`, `function permutations(values) {
  const used = Array(values.length).fill(false), path = [], output = [];
  function visit() {
    if (path.length === values.length) { output.push(path.slice()); return; }
    for (let i = 0; i < values.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(values[i]);
      visit();
      path.pop(); used[i] = false;
    }
  }
  visit();
  return output;
}`, `def permutations(values):
    used, path, output = [False] * len(values), [], []
    def visit():
        if len(path) == len(values):
            output.append(path[:])
            return
        for i, value in enumerate(values):
            if used[i]: continue
            used[i] = True; path.append(value)
            visit()
            path.pop(); used[i] = False
    visit()
    return output`),
    quiz: quiz('What must be undone after exploring one chosen position?', ['Both the path push and its used flag.', 'Only the path push.', 'Only the used flag.', 'The entire input ordering.'], 0, 'A stale used flag suppresses later branches; a stale path entry corrupts their prefixes.'),
    challenge: challenge('How many permutations of four distinct values start with a fixed first value?', '6', 'Only the remaining three positions are free.', 'Fixing the first value leaves 3!=6 ways to order the remaining values.'),
  }),
  'n-queens': defineTopic({
    intro: 'N-Queens is a constraint search: put one queen in each row while avoiding columns and both diagonal directions occupied by earlier queens.',
    invariant: 'The placed row prefix is attack-free. Column c, diagonal row−c, and anti-diagonal row+c sets exactly describe its occupied lines.',
    takeaway: 'Prune an attacked square before descending; undo the queen and all three line reservations after returning. A failed small board is a genuine exhausted search.',
    complexity: { time: 'O(n·n!) upper bound for this row-by-row search: at most factorial column-prefix states and n constant-time line tests per state; pruning reduces actual work.', space: 'O(n²) displayed board plus O(n) search state and O(n·s) storage for s solutions.' },
    examples: [example('Four queens have two solutions', { n: 4 }, 'solutions: 2; first: 1, 3, 0, 2'), example('Three queens cannot fit safely', { n: 3 }, 'solutions: 0; first: none')],
    trace: queens,
    code: code(`PLACE(row):
  IF row = n: emit copy(columnsByRow); RETURN
  FOR col from 0 to n − 1
    IF col, row−col, or row+col occupied: CONTINUE
    reserve all three lines; append col
    PLACE(row + 1)
    remove col and all three reservations
PLACE(0)`, `function nQueens(n) {
  const cols = new Set(), diag = new Set(), anti = new Set(), path = [], solutions = [];
  function place(row) {
    if (row === n) { solutions.push(path.slice()); return; }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag.has(row - col) || anti.has(row + col)) continue;
      cols.add(col); diag.add(row - col); anti.add(row + col); path.push(col);
      place(row + 1);
      path.pop(); cols.delete(col); diag.delete(row - col); anti.delete(row + col);
    }
  }
  place(0);
  return solutions;
}`, `def n_queens(n):
    cols, diag, anti, path, solutions = set(), set(), set(), [], []
    def place(row):
        if row == n:
            solutions.append(path[:]); return
        for col in range(n):
            if col in cols or row - col in diag or row + col in anti: continue
            cols.add(col); diag.add(row - col); anti.add(row + col); path.append(col)
            place(row + 1)
            path.pop(); cols.remove(col); diag.remove(row - col); anti.remove(row + col)
    place(0)
    return solutions`),
    quiz: quiz('Which expression identifies one diagonal direction?', ['row − column.', 'row × column.', 'Only the column.', 'The queen’s insertion order.'], 0, 'Moving one step down and right changes row and column equally, preserving their difference.'),
    challenge: challenge('For n=4, does the column list [1,3,0,2] give a safe board?', 'yes', 'Check uniqueness of columns, row−col, and row+col.', 'Columns are distinct; row−col values are −1,−2,2,1 and row+col values are 1,4,2,5, also distinct.'),
  }),
  'solving-maze': defineTopic({
    intro: 'Maze solving explores open cells as a graph. DFS extends a tentative path, rejects walls and revisits, and backs out of dead ends until it reaches the goal or exhausts the entrance’s component.',
    invariant: 'The path is a connected simple chain of open cells; globally visited cells have already been discovered and need not be expanded again.',
    takeaway: 'Backtracking removes failed cells from the displayed path but keeps visited marks. DFS proves reachability; use BFS if the shortest unweighted route is required.',
    complexity: { time: 'O(rows×columns) with global visited marks: each open cell is expanded once and has four neighbor tests.', space: 'O(rows×columns) visited set, board, and worst-case recursion path.' },
    examples: [example('A tempting corridor is a dead end', { matrix: [[0, 0, 0], [0, 1, 1], [0, 0, 0]] }, 'path: 0,0 → 1,0 → 2,0 → 2,1 → 2,2'), example('Goal separated by walls', { matrix: [[0, 1], [1, 0]] }, 'path: none')],
    trace: maze,
    code: code(`VISIT(row, col):
  IF out of bounds, wall, or visited: RETURN false
  mark visited; append cell to path
  IF cell is goal: RETURN true
  TRY right, down, left, up; RETURN true if any succeeds
  pop cell from path; RETURN false
VISIT(0, 0)`, `function solveMaze(matrix) {
  const rows = matrix.length, cols = matrix[0].length, seen = new Set(), path = [];
  function visit(r, c) {
    const key = r + ',' + c;
    if (r < 0 || c < 0 || r >= rows || c >= cols || matrix[r][c] || seen.has(key)) return false;
    seen.add(key); path.push([r, c]);
    if (r === rows - 1 && c === cols - 1) return true;
    for (const [dr, dc] of [[0,1],[1,0],[0,-1],[-1,0]])
      if (visit(r + dr, c + dc)) return true;
    path.pop();
    return false;
  }
  return visit(0, 0) ? path : null;
}`, `def solve_maze(matrix):
    rows, cols, seen, path = len(matrix), len(matrix[0]), set(), []
    def visit(r, c):
        if not (0 <= r < rows and 0 <= c < cols) or matrix[r][c] or (r, c) in seen:
            return False
        seen.add((r, c)); path.append((r, c))
        if (r, c) == (rows - 1, cols - 1): return True
        for dr, dc in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            if visit(r + dr, c + dc): return True
        path.pop()
        return False
    return path if visit(0, 0) else None`),
    quiz: quiz('Why keep a global visited mark after popping a failed cell?', ['Its exhausted region need not be searched again.', 'It makes DFS always find the shortest path.', 'The cell becomes a physical wall.', 'It forbids every alternate path to the goal.'], 0, 'Once DFS has explored a cell’s reachable neighbors, re-expanding it would repeat work or form cycles; a successful reachable goal would already have been found.'),
    challenge: challenge('An open 2×2 grid with right-first DFS: what first path reaches (1,1)?', '0,0 → 0,1 → 1,1', 'Follow the specified neighbor order, rejecting moves outside the grid.', 'From (0,0) go right to (0,1); its right neighbor is out of bounds, so next go down to the goal.'),
  }),
  memoization: defineTopic({
    intro: 'Memoization retains a recursive problem’s completed answers. Fibonacci makes overlapping requests visible: F(n−2) is often already solved while computing F(n−1).',
    invariant: 'Every cache entry is a completed exact Fibonacci value; uncached states are expanded from their two smaller dependencies.',
    takeaway: 'A cache hit avoids an entire repeated recursive expansion. Memoization changes repeated work, not the recurrence or its linear dependency depth.',
    complexity: { time: 'O(n) arithmetic operations for nonnegative n with constant-time cache access; exact large integers would add bit-arithmetic costs.', space: 'O(n) cached values and O(n) worst-case recursive depth; examples remain within exact JavaScript integer range.' },
    examples: [example('Overlapping calls', { n: 6 }, 'F(6): 8'), example('Cached base request', { n: 0 }, 'F(0): 0')],
    trace: memoization,
    code: code(`cache ← {0:0, 1:1}
F(k):
  IF cache contains k: RETURN cache[k]
  cache[k] ← F(k − 1) + F(k − 2)
  RETURN cache[k]`, `function memoFib(n) {
  const cache = new Map([[0, 0], [1, 1]]);
  function fib(k) {
    if (cache.has(k)) return cache.get(k);
    const value = fib(k - 1) + fib(k - 2);
    cache.set(k, value);
    return value;
  }
  return fib(n);
}`, `def memo_fib(n):
    cache = {0: 0, 1: 1}
    def fib(k):
        if k in cache:
            return cache[k]
        cache[k] = fib(k - 1) + fib(k - 2)
        return cache[k]
    return fib(n)`),
    quiz: quiz('When is it safe to write a state’s cached answer?', ['After its required recursive dependencies return.', 'Before computing any dependency.', 'Only after every possible state is solved.', 'Only when the answer is nonzero.'], 0, 'An unfinished value is not an exact answer; zero is a legitimate cached result, so test presence rather than truthiness.'),
    challenge: challenge('With bases F(0)=0, F(1)=1, what is F(5)?', '5', 'Compute 1,2,3,5 while reusing smaller cached values.', 'F(2)=1, F(3)=2, F(4)=3, and F(5)=3+2=5.'),
  }),
  tabulation: defineTopic({
    intro: 'Tabulation solves dependencies in an explicit order. For Fibonacci, increasing indices turn a recursive definition into a loop over a completed table prefix.',
    invariant: 'Before filling index i, all smaller Fibonacci indices are complete, including the two entries used by the recurrence.',
    takeaway: 'Bottom-up order eliminates recursive calls. Keep the full table for teaching or reconstruction; two rolling variables suffice when only the final Fibonacci value is needed.',
    complexity: { time: 'O(n) arithmetic operations for nonnegative n, assuming word-sized exact results.', space: 'O(n) for this displayed table and O(1) call stack; rolling previous values reduce algorithm storage to O(1).' },
    examples: [example('Fill a dependency chain', { n: 7 }, 'F(7): 13'), example('Only base cells', { n: 1 }, 'F(1): 1')],
    trace: tabulation,
    code: code(`allocate dp[0..n]
dp[0] ← 0; IF n ≥ 1: dp[1] ← 1
FOR i from 2 to n
  dp[i] ← dp[i − 1] + dp[i − 2]
RETURN dp[n]`, `function tableFib(n) {
  const dp = Array(n + 1).fill(0);
  if (n >= 1) dp[1] = 1;
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp[n];
}`, `def table_fib(n):
    dp = [0] * (n + 1)
    if n >= 1: dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]`),
    quiz: quiz('Why is left-to-right filling valid for Fibonacci?', ['Each state depends only on smaller indices.', 'Fibonacci values are all equal.', 'The table is sorted by the loop.', 'It guesses an answer before dependencies.'], 0, 'A valid topological order of the dependency graph completes each prerequisite before use.'),
    challenge: challenge('What two values suffice to compute F(8) after F(7) is known?', 'F(6)=8 and F(7)=13', 'The recurrence reads only the preceding two states.', 'Adding 8 and 13 gives F(8)=21; older table entries need not be retained if no reconstruction is required.'),
  }),
  'grid-paths': defineTopic({
    intro: 'Counting routes differs from finding one route. With only right and down moves, every cell’s route count comes from its top and left neighbors, and walls contribute zero.',
    invariant: 'Each completed cell stores the exact number of right/down routes from the start; its top and left dependencies have already been processed.',
    takeaway: 'Seed the open start with one and never seed a wall. Adding disjoint predecessor counts counts routes without enumerating each path.',
    complexity: { time: 'O(rows×columns) additions for a rectangular obstacle grid; counts assumed to fit exact numeric range.', space: 'O(rows×columns) for the displayed count table; a rolling row can reduce working storage to O(columns).' },
    examples: [example('An obstacle removes middle routes', { matrix: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] }, 'paths: 2'), example('Blocked entrance', { matrix: [[1, 0], [0, 0]] }, 'paths: 0')],
    trace: gridPaths,
    code: code(`FOR each cell in row-major order
  IF blocked: dp[row][col] ← 0
  ELSE IF start: dp[row][col] ← 1
  ELSE: dp[row][col] ← top count + left count
  missing neighbors contribute zero
RETURN destination count`, `function gridPaths(blocked) {
  const rows = blocked.length, cols = blocked[0].length;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (blocked[r][c]) continue;
    if (r === 0 && c === 0) dp[r][c] = 1;
    else dp[r][c] = (r ? dp[r - 1][c] : 0) + (c ? dp[r][c - 1] : 0);
  }
  return dp[rows - 1][cols - 1];
}`, `def grid_paths(blocked):
    rows, cols = len(blocked), len(blocked[0])
    dp = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if blocked[r][c]: continue
            if r == 0 and c == 0: dp[r][c] = 1
            else: dp[r][c] = (dp[r - 1][c] if r else 0) + (dp[r][c - 1] if c else 0)
    return dp[-1][-1]`),
    quiz: quiz('What count should a blocked start receive?', ['0.', '1.', 'The number of columns.', 'The number of neighbors.'], 0, 'The empty start route is valid only when the start is open; otherwise no route can begin.'),
    challenge: challenge('How many right/down routes cross an open 2×3 grid?', '3', 'Each route contains one down move and two right moves.', 'The down move can occur first, second, or third, giving DRR, RDR, and RRD.'),
  }),
  knapsack: defineTopic({
    intro: '0/1 knapsack chooses a subset of weighted items under capacity. For each item and capacity, compare skipping it with taking it once plus an optimal solution using only earlier items.',
    invariant: 'dp[i][c] is the maximum value using only the first i items within capacity c. Taking item i reads row i−1, never the current row.',
    takeaway: 'The previous-row dependency enforces one use per item. A one-dimensional optimization must iterate capacities downward to keep the same 0/1 rule.',
    complexity: { time: 'O(nW) for n positive-weight items and integer capacity W; pseudo-polynomial in numeric capacity, not its binary input length.', space: 'O(nW) table for reconstruction; O(W) possible for value-only descending-capacity updates.' },
    examples: [example('A better pair beats a single item', { items: [[2, 3], [3, 4], [4, 5]], capacity: 5 }, 'value: 7; items: 0, 1'), example('The same item cannot be taken twice', { items: [[2, 3]], capacity: 4 }, 'value: 3; items: 0')],
    trace: knapsack,
    code: code(`dp[0][all capacities] ← 0
FOR item i with weight w and value v
  FOR capacity c
    skip ← dp[i − 1][c]
    take ← v + dp[i − 1][c − w] if w ≤ c, else −∞
    dp[i][c] ← max(skip, take)
backtrack previous rows; take only when value improves`, `function knapsack(items, capacity) {
  const dp = Array.from({ length: items.length + 1 }, () => Array(capacity + 1).fill(0));
  for (let i = 1; i <= items.length; i++) {
    const [w, v] = items[i - 1];
    for (let c = 1; c <= capacity; c++)
      dp[i][c] = Math.max(dp[i - 1][c], w <= c ? v + dp[i - 1][c - w] : -Infinity);
  }
  let c = capacity;
  const chosen = [];
  for (let i = items.length; i > 0; i--) {
    if (dp[i][c] > dp[i - 1][c]) { chosen.push(i - 1); c -= items[i - 1][0]; }
  }
  return { value: dp[items.length][capacity], chosen: chosen.reverse() };
}`, `def knapsack(items, capacity):
    dp = [[0] * (capacity + 1) for _ in range(len(items) + 1)]
    for i, (weight, value) in enumerate(items, 1):
        for c in range(1, capacity + 1):
            take = value + dp[i - 1][c - weight] if weight <= c else float('-inf')
            dp[i][c] = max(dp[i - 1][c], take)
    c, chosen = capacity, []
    for i in range(len(items), 0, -1):
        if dp[i][c] > dp[i - 1][c]:
            chosen.append(i - 1); c -= items[i - 1][0]
    return dp[-1][capacity], chosen[::-1]`),
    quiz: quiz('What mistake turns a one-dimensional 0/1 update into reuse?', ['Scanning capacities upward while reading the same array.', 'Scanning capacities downward.', 'Initializing empty choices to zero.', 'Skipping an item that does not fit.'], 0, 'An upward scan can read a value just updated by the same item, allowing that item again.'),
    challenge: challenge('One item weighs 3 and has value 5; capacity is 6. What is the 0/1 optimum?', '5', 'The item may be selected once or not at all.', 'Capacity can fit two copies physically, but only one copy is available; the optimum is 5, not 10.'),
  }),
  'coin-change': defineTopic({
    intro: 'Minimum coin change allows repeated denominations. Build an amount table where each reachable state chooses a last coin and reuses the best solution for the smaller remainder.',
    invariant: 'Before amount x is filled, all smaller amounts are optimal or explicitly unreachable. Only a finite predecessor can produce a reachable candidate.',
    takeaway: 'Zero coins pays amount zero; infinity represents impossible positive amounts. This minimum-count recurrence is not the recurrence for counting ways.',
    complexity: { time: 'O(amount×m) for m positive integer denominations; pseudo-polynomial in the target amount.', space: 'O(amount) for minimum counts and saved last coins, plus the reconstructed payment.' },
    examples: [example('A noncanonical coin system', { coins: [1, 3, 4], amount: 6 }, 'minimum: 2; coins: 3, 3'), example('Parity makes the amount unreachable', { coins: [2, 4], amount: 3 }, 'minimum: unreachable; coins: none')],
    trace: coinChange,
    code: code(`dp[0] ← 0; all other dp ← ∞
FOR x from 1 to amount
  FOR each coin ≤ x
    IF dp[x − coin] + 1 < dp[x]
      dp[x] ← dp[x − coin] + 1; last[x] ← coin
IF dp[amount] = ∞: RETURN unreachable
follow last coins until remaining amount is zero`, `function coinChange(coins, amount) {
  const dp = Array(amount + 1).fill(Infinity), last = Array(amount + 1).fill(null);
  dp[0] = 0;
  for (let x = 1; x <= amount; x++) for (const c of coins) {
    if (c <= x && dp[x - c] + 1 < dp[x]) {
      dp[x] = dp[x - c] + 1; last[x] = c;
    }
  }
  if (!Number.isFinite(dp[amount])) return null;
  const chosen = [];
  for (let x = amount; x > 0; x -= last[x]) chosen.push(last[x]);
  return { count: dp[amount], chosen };
}`, `def coin_change(coins, amount):
    dp, last = [0] + [float('inf')] * amount, [None] * (amount + 1)
    for x in range(1, amount + 1):
        for coin in coins:
            if coin <= x and dp[x - coin] + 1 < dp[x]:
                dp[x], last[x] = dp[x - coin] + 1, coin
    if dp[amount] == float('inf'): return None
    chosen, x = [], amount
    while x > 0:
        chosen.append(last[x]); x -= last[x]
    return dp[amount], chosen`),
    quiz: quiz('Why not initialize every amount to zero?', ['Zero would falsely claim impossible amounts need no coins.', 'Infinity makes every amount impossible forever.', 'Zero is never a valid answer.', 'It prevents repeated denominations.'], 0, 'Only amount zero has the zero-coin base. Other states need an unreachable sentinel until a valid transition reaches them.'),
    challenge: challenge('With coins [2,5], minimum coins for amount 7?', '2', 'Choose the last coin from an already reachable smaller amount.', 'Either 2+5 or 5+2 uses two coins; no denomination equals 7, so one coin is impossible.'),
  }),
  'longest-increasing-subsequence': defineTopic({
    intro: 'An increasing subsequence can skip elements while preserving input order. Track the best length ending at each index, then choose the best ending anywhere in the array.',
    invariant: 'dp[i] is the best strictly increasing subsequence ending exactly at i, using only earlier smaller predecessors.',
    takeaway: 'A subsequence is not a contiguous subarray. Equal values cannot extend a strictly increasing sequence; predecessor links reconstruct an actual witness.',
    complexity: { time: 'O(n²) pair checks in this ending-at-index DP; a tails/binary-search method computes length in O(n log n).', space: 'O(n) lengths and predecessor links, plus O(n) reconstructed output.' },
    examples: [example('Skip low and high distractions', { values: [3, 1, 2, 5, 4, 6] }, 'length: 4; sequence: 1, 2, 5, 6'), example('Equal keys cannot extend', { values: [2, 2, 2] }, 'length: 1; sequence: 2')],
    trace: lis,
    code: code(`dp[i] ← 1; previous[i] ← −1
FOR i from 0 to n − 1
  FOR j from 0 to i − 1
    IF A[j] < A[i] AND dp[j] + 1 > dp[i]
      dp[i] ← dp[j] + 1; previous[i] ← j
choose earliest maximum dp ending
follow previous links and reverse witness`, `function lis(a) {
  const dp = Array(a.length).fill(1), prev = Array(a.length).fill(-1);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < i; j++)
    if (a[j] < a[i] && dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; prev[i] = j; }
  let end = -1;
  for (let i = 0; i < a.length; i++) if (end < 0 || dp[i] > dp[end]) end = i;
  const sequence = [];
  for (let i = end; i >= 0; i = prev[i]) sequence.push(a[i]);
  return sequence.reverse();
}`, `def lis(a):
    dp, prev = [1] * len(a), [-1] * len(a)
    for i in range(len(a)):
        for j in range(i):
            if a[j] < a[i] and dp[j] + 1 > dp[i]:
                dp[i], prev[i] = dp[j] + 1, j
    end = max(range(len(a)), key=lambda i: dp[i]) if a else -1
    sequence = []
    while end >= 0:
        sequence.append(a[end]); end = prev[end]
    return sequence[::-1]`),
    quiz: quiz('Can equal predecessor and current values extend a strict LIS?', ['No; the comparison must be strictly less.', 'Yes, every equal value adds one.', 'Only if they are adjacent.', 'Only at the final index.'], 0, 'Allowing equality computes a nondecreasing subsequence instead of a strictly increasing one.'),
    challenge: challenge('What is the LIS length of [4,1,3,2,5]?', '3', 'The sequence may skip positions, but not reorder them.', 'Both [1,3,5] and [1,2,5] have length three; no four-element strictly increasing subsequence exists.'),
  }),
  sequences: defineTopic({
    intro: 'Longest common subsequence compares two sequences while permitting deletions from either. A prefix matrix decides whether to keep matching endings or skip one unmatched ending.',
    invariant: 'dp[i][j] is the optimal shared subsequence length for the first i and first j characters; all smaller required prefixes are complete.',
    takeaway: 'LCS preserves relative order without requiring adjacency. Read the table backward to reconstruct a witness rather than confusing length with the subsequence itself.',
    complexity: { time: 'O(mn) for sequence lengths m and n, plus O(m+n) backtracking; examples use basic single-code-unit characters.', space: 'O(mn) matrix for reconstruction; length-only computation can use O(min(m,n)) rolling-row storage.' },
    examples: [example('Shared characters with gaps', { a: 'ABCDE', b: 'ACE' }, 'length: 3; LCS: ACE'), example('Disjoint alphabets', { a: 'ABC', b: 'XYZ' }, 'length: 0; LCS: none')],
    trace: lcs,
    code: code(`dp[empty prefix][any prefix] ← 0
FOR i from 1 to m; FOR j from 1 to n
  IF A[i−1] = B[j−1]: dp[i][j] ← dp[i−1][j−1] + 1
  ELSE: dp[i][j] ← max(dp[i−1][j], dp[i][j−1])
backtrack: matching endings go diagonal; otherwise follow larger neighbor
reverse collected characters`, `function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  let i = a.length, j = b.length;
  const out = [];
  while (i && j) {
    if (a[i - 1] === b[j - 1]) { out.push(a[--i]); j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return out.reverse().join('');
}`, `def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = dp[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(dp[i - 1][j], dp[i][j - 1])
    i, j, out = len(a), len(b), []
    while i and j:
        if a[i - 1] == b[j - 1]:
            out.append(a[i - 1]); i -= 1; j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]: i -= 1
        else: j -= 1
    return ''.join(reversed(out))`),
    quiz: quiz('When prefix endings differ, why take max(top, left)?', ['A common subsequence must omit at least one of those endings.', 'Both endings can be matched anyway.', 'The two lengths should be added.', 'All earlier characters must be discarded.'], 0, 'An unmatched pair cannot both be the final shared character; removing either ending covers the optimal possibilities.'),
    challenge: challenge('What is an LCS of "AXBYC" and "ABC"?', 'ABC', 'Subsequence characters may have gaps.', 'A, B, C occur in order in both inputs, and the second input bounds the maximum length at three.'),
  }),
  'edit-distance': defineTopic({
    intro: 'Edit distance measures transformation cost, not shared length. A prefix matrix weighs the cheapest possible last operation: insert, delete, replace, or match at zero cost.',
    invariant: 'dp[i][j] is the minimum unit-cost edits converting the source prefix of length i into the target prefix of length j.',
    takeaway: 'Empty-prefix costs are their lengths; equal characters keep diagonal cost unchanged. Levenshtein distance does not include transposition as a single edit.',
    complexity: { time: 'O(mn) for source length m and target length n with unit-cost operations and basic characters.', space: 'O(mn) for the displayed matrix; value-only computation can use O(min(m,n)) rolling rows.' },
    examples: [example('Insertion and replacement', { a: 'cat', b: 'cuts' }, 'distance: 2'), example('Delete to the empty target', { a: 'abc', b: '' }, 'distance: 3')],
    trace: editDistance,
    code: code(`dp[i][0] ← i; dp[0][j] ← j
FOR i from 1 to m; FOR j from 1 to n
  diagonal ← dp[i−1][j−1] + (A[i−1] ≠ B[j−1])
  deletion ← dp[i−1][j] + 1
  insertion ← dp[i][j−1] + 1
  dp[i][j] ← min(diagonal, deletion, insertion)
RETURN dp[m][n]`, `function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
  return dp[a.length][b.length];
}`, `def edit_distance(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1): dp[i][0] = i
    for j in range(len(b) + 1): dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
    return dp[-1][-1]`),
    quiz: quiz('What diagonal cost is added for equal ending characters?', ['0.', '1.', '2.', 'Their character codes.'], 0, 'Matching characters need no replacement, so the optimal smaller-prefix transformation can be retained unchanged.'),
    challenge: challenge('What is the Levenshtein distance from "ab" to "ba"?', '2', 'Transposition is not an allowed single operation here.', 'Two replacements work, or one deletion and one insertion. No single insertion, deletion, or replacement produces the target.'),
  }),
  'bits-masks': defineTopic({
    intro: 'A bit mask names selected binary positions. Construct a one-bit mask, then test, set, clear, and toggle its position while preserving unrelated bits.',
    invariant: 'Only the selected mask position can change; each other bit remains equal to its input value across all four operations.',
    takeaway: 'AND tests, OR sets, AND with the complemented mask clears, and XOR toggles. Bit positions begin at zero from the least significant side, not from decimal digits.',
    complexity: { time: 'O(1) for each operation on a fixed 32-bit machine word; the visual examples show eight nonnegative bits.', space: 'O(1) machine-word state; displaying w individual bits uses O(w) visualization cells.' },
    examples: [example('Target bit already set', { value: 10, bit: 1 }, 'was set: true; set: 10; clear: 8; toggle: 10'), example('Target bit initially clear', { value: 8, bit: 0 }, 'was set: false; set: 9; clear: 8; toggle: 9')],
    trace: masks,
    code: code(`mask ← 1 shifted left by bit
present ← (value AND mask) ≠ 0
setValue ← value OR mask
clearValue ← setValue AND NOT mask
toggleValue ← clearValue XOR mask
RETURN present, setValue, clearValue, toggleValue`, `function maskOperations(value, bit) {
  const mask = 1 << bit;
  const present = (value & mask) !== 0;
  const setValue = value | mask;
  const clearValue = setValue & ~mask;
  const toggleValue = clearValue ^ mask;
  return { present, setValue, clearValue, toggleValue };
}`, `def mask_operations(value, bit):
    mask = 1 << bit
    present = (value & mask) != 0
    set_value = value | mask
    clear_value = set_value & ~mask
    toggle_value = clear_value ^ mask
    return present, set_value, clear_value, toggle_value`),
    quiz: quiz('Which operation clears bit b while preserving others?', ['value & ~(1 << b).', 'value | (1 << b).', 'value ^ (1 << b) in every case.', 'value + b.'], 0, 'The complemented one-bit mask is zero only at b, so AND clears just that position.'),
    challenge: challenge('Set bit 2 of decimal 8. What decimal value results?', '12', 'Bit 2 has weight four.', '8 is binary 1000; OR with 0100 gives 1100, which is 12.'),
  }),
  'bit-tricks': defineTopic({
    intro: 'Subtracting one flips the lowest set bit and all trailing zeros. AND with the original erases just that one, giving a compact popcount loop and a power-of-two test.',
    invariant: 'After each x &= x−1 operation, one original set bit has been removed and the counter records exactly how many were removed.',
    takeaway: 'x & −x isolates the lowest one; x & (x−1) deletes it. Zero needs special care: it has popcount zero and is not a positive power of two.',
    complexity: { time: 'O(k) popcount iterations for k set bits; lowbit and power-of-two tests use O(1) word operations.', space: 'O(1) auxiliary state for fixed-width nonnegative machine-word inputs; the lesson uses eight-bit values.' },
    examples: [example('Three scattered ones', { value: 44 }, 'popcount: 3; lowbit: 4; power of two: false'), example('Zero has no lowest one', { value: 0 }, 'popcount: 0; lowbit: 0; power of two: false')],
    trace: bitTricks,
    code: code(`lowbit ← value AND (−value)
count ← 0; x ← value
WHILE x ≠ 0
  x ← x AND (x − 1); count ← count + 1
power ← value > 0 AND (value AND (value − 1)) = 0
RETURN count, lowbit, power`, `function bitProperties(value) {
  const lowbit = value & -value;
  let x = value, count = 0;
  while (x !== 0) { x &= x - 1; count++; }
  const powerOfTwo = value > 0 && (value & (value - 1)) === 0;
  return { count, lowbit, powerOfTwo };
}`, `def bit_properties(value):
    lowbit = value & -value
    x, count = value, 0
    while x:
        x &= x - 1
        count += 1
    power_of_two = value > 0 and (value & (value - 1)) == 0
    return count, lowbit, power_of_two`),
    quiz: quiz('Why does the power-of-two test also require value > 0?', ['Zero also satisfies value & (value−1) == 0.', 'Every odd number is a power of two.', 'Negative values have no bits.', 'It makes subtraction unnecessary.'], 0, 'The bit expression alone accepts zero, but positive powers of two have exactly one set bit.'),
    challenge: challenge('Compute 40 & (40−1).', '32', '40 is binary 101000; subtracting one gives 100111.', 'AND yields 100000, deleting the lowest one at weight eight and leaving 32.'),
  }),
  bitsets: defineTopic({
    intro: 'A bitset packs membership of a small integer universe into bits. Set algebra becomes word algebra: union is OR, intersection is AND, and difference is AND-NOT.',
    invariant: 'Position i is one exactly when member i belongs to the represented set; duplicate insertion is harmless because setting a bit is idempotent.',
    takeaway: 'Packing can process many membership positions in one word operation. For larger universes, use word arrays and remember to mask unused positions where appropriate.',
    complexity: { time: 'O(|A|+|B|) to construct these one-word sets; O(1) packed algebra and O(U) decoding. Multiword algebra costs O(ceil(U/w)).', space: 'O(1) for one-word masks when U≤31; multiword bitsets need O(ceil(U/w)) words, while visualization uses O(U) cells.' },
    examples: [example('Overlapping sets', { a: [0, 2, 4], b: [2, 3], universe: 6 }, 'union: 0, 2, 3, 4; intersection: 2; A\\B: 0, 4'), example('Duplicates and a disjoint set', { a: [1, 1], b: [4], universe: 6 }, 'union: 1, 4; intersection: none; A\\B: 1')],
    trace: bitsets,
    code: code(`left ← 0; right ← 0
FOR i in A: left ← left OR (1 << i)
FOR i in B: right ← right OR (1 << i)
union ← left OR right
intersection ← left AND right
difference ← left AND NOT right
decode set positions within the universe`, `function bitsetAlgebra(a, b, universe) {
  let left = 0, right = 0;
  for (const i of a) left |= 1 << i;
  for (const i of b) right |= 1 << i;
  const decode = mask => Array.from({ length: universe }, (_, i) => i)
    .filter(i => (mask & (1 << i)) !== 0);
  return { union: decode(left | right), intersection: decode(left & right), difference: decode(left & ~right) };
}`, `def bitset_algebra(a, b, universe):
    left, right = 0, 0
    for i in a: left |= 1 << i
    for i in b: right |= 1 << i
    def decode(mask):
        return [i for i in range(universe) if mask & (1 << i)]
    return decode(left | right), decode(left & right), decode(left & ~right)`),
    quiz: quiz('What does inserting the same member twice do?', ['Leaves the same membership bit set.', 'Stores two copies in that bit.', 'Toggles the member off.', 'Shifts the whole set.'], 0, 'Insertion uses OR, so a bit already equal to one stays one; XOR would toggle instead.'),
    challenge: challenge('A={1,3}, B={3,4}. What is A minus B?', '1', 'Keep A positions where B has a zero.', 'Member 3 is excluded because it is in B, leaving only member 1.'),
  }),
  'p-vs-np': defineTopic({
    intro: 'P concerns decision problems solvable in polynomial time; NP concerns yes-instances with polynomially checkable certificates. A finite subset-sum example separates receiving a witness from searching for one.',
    invariant: 'Certificate verification examines supplied distinct indices, while enumeration has ruled out exactly the candidate masks already tested.',
    takeaway: 'Fast verification does not currently imply a known fast algorithm for every NP problem. Exponential brute force is an algorithm’s cost, not proof of a necessary lower bound. P versus NP is open.',
    complexity: { time: 'Verifier: O(k) word operations for k certificate indices with a set. This exhaustive search: O(n 2^n) worst case; polynomial bit costs must also account for integer encoding lengths.', space: 'O(n) candidate, certificate checks, and witness state beyond input; enumeration does not store all subsets.' },
    examples: [example('Verify a witness, then discover it', { values: [3, 5, 8, 10], target: 13, certificate: [1, 2] }, 'certificate: valid; found: yes; candidates: 7'), example('A failed witness and no solution', { values: [2, 4, 6], target: 5, certificate: [0, 1] }, 'certificate: invalid; found: no; candidates: 8')],
    trace: pVsNp,
    code: code(`VERIFY(indices):
  reject repeated or out-of-range indices
  sum the indexed values; accept iff sum = target
SEARCH:
  FOR mask from 0 through 2^n − 1
    sum values selected by mask
    IF sum = target: RETURN witness
  RETURN no
This enumerator is illustrative, not a lower-bound proof.`, `function subsetSumEvidence(values, target, certificate) {
  const seen = new Set();
  let sum = 0, valid = true;
  for (const i of certificate) {
    if (!Number.isInteger(i) || i < 0 || i >= values.length || seen.has(i)) valid = false;
    else { seen.add(i); sum += values[i]; }
  }
  valid = valid && sum === target;
  for (let mask = 0; mask < 2 ** values.length; mask++) {
    const witness = [];
    let total = 0;
    for (let i = 0; i < values.length; i++)
      if (mask & (1 << i)) { total += values[i]; witness.push(i); }
    if (total === target) return { valid, witness, candidates: mask + 1 };
  }
  return { valid, witness: null, candidates: 2 ** values.length };
}`, `def subset_sum_evidence(values, target, certificate):
    seen, total, valid = set(), 0, True
    for i in certificate:
        if not isinstance(i, int) or not 0 <= i < len(values) or i in seen: valid = False
        else:
            seen.add(i); total += values[i]
    valid = valid and total == target
    for mask in range(1 << len(values)):
        witness = [i for i in range(len(values)) if mask & (1 << i)]
        if sum(values[i] for i in witness) == target:
            return valid, witness, mask + 1
    return valid, None, 1 << len(values)`),
    quiz: quiz('What does this exponential subset enumeration prove about P versus NP?', ['Nothing decisive; a faster general algorithm might exist.', 'It proves P is not NP.', 'It proves every NP problem takes exponential time.', 'It proves checking certificates is impossible.'], 0, 'Running one exhaustive algorithm establishes its work on these inputs, not a lower bound on every possible algorithm.'),
    challenge: challenge('For [3,5,8,10], target 13, is certificate [1,2] valid?', 'yes', 'Indices are zero-based and must be distinct.', 'Positions 1 and 2 contain 5 and 8; their sum is 13. Checking these positions is different from discovering them without a certificate.'),
  }),
};
