const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const trim = (value, length = 17) => String(value ?? '').length > length ? `${String(value).slice(0, length - 1)}…` : String(value ?? '');
const text = (x, y, value, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(value)}</text>`;

function cell(x, y, width, height, value, selected, label = '') {
  return `<g class="trace-cell ${selected ? 'is-active' : ''}">
    <path d="M${x} ${y + height} l10 7 h${width - 10} v-${height} l-10 -7" class="trace-cell-side"/>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7"/>
    ${text(x + width / 2, y + height / 2 + 6, trim(value), 'trace-value')}
    ${label !== '' ? text(x + width / 2, y + height + 29, trim(label), 'trace-index') : ''}
  </g>`;
}

function array(view) {
  const values = view.values ?? [];
  if (!values.length) return text(490, 330, 'Empty — ready for the first operation', 'trace-empty');
  const columns = Math.min(values.length, 8);
  const width = Math.min(92, 720 / columns - 12);
  const rows = Math.ceil(values.length / columns);
  const gap = width + 14;
  const start = (980 - (columns * gap - 14)) / 2;
  const y = rows > 3 ? 160 : 270 - rows * 22;
  const active = view.active ?? [];
  let output = values.map((value, i) => cell(start + i % columns * gap, y + Math.floor(i / columns) * 100, width, 58, value, active.includes(i), view.labels?.[i] ?? i)).join('');
  if (view.kind === 'list') {
    for (let i = 0; i < values.length - 1; i++) {
      if (i % columns === columns - 1) continue;
      const x = start + i % columns * gap + width;
      const cy = y + Math.floor(i / columns) * 100 + 28;
      output += `<path d="M${x + 2} ${cy} h11" class="trace-edge" marker-end="url(#trace-arrow)"/>`;
    }
  }
  if (view.secondary?.length) {
    const cy = Math.min(540, y + rows * 135);
    output += text(490, cy - 20, 'WORKING STATE', 'trace-subtitle');
    output += view.secondary.map((value, i) => cell(110 + i % 10 * 75, cy + Math.floor(i / 10) * 75, 64, 42, value, false)).join('');
  }
  return output;
}

function stack(view) {
  const values = view.values ?? [];
  const count = Math.max(1, values.length);
  const height = Math.min(52, 300 / count);
  let output = `<path d="M375 165v390h230V165" class="trace-stack-outline"/>`;
  output += values.map((value, i) => cell(405, 515 - i * (height + 6), 170, height, value, (view.active ?? []).includes(i))).join('');
  output += text(645, values.length ? 535 - (values.length - 1) * (height + 6) : 330, values.length ? '← TOP' : 'EMPTY', 'trace-subtitle');
  if (view.secondary?.length) output += text(490, 600, `Input / output: ${view.secondary.join('  ')}`, 'trace-subtitle');
  return output;
}

function network(view) {
  const nodes = view.nodes ?? [];
  const isTree = view.kind === 'tree';
  const positions = Object.fromEntries(nodes.map((node, i) => {
    const depth = Math.floor(Math.log2(i + 1));
    const offset = i - (2 ** depth - 1);
    const angle = i / Math.max(1, nodes.length) * Math.PI * 2 - Math.PI / 2;
    return [String(node.id), { x: node.x ?? (isTree ? 980 * (offset + .5) / (2 ** depth) : 490 + Math.cos(angle) * 270), y: node.y ?? (isTree ? 175 + depth * 95 : 345 + Math.sin(angle) * 190) }];
  }));
  let output = (view.edges ?? []).map(edge => {
    const from = positions[String(edge.from)];
    const to = positions[String(edge.to)];
    if (!from || !to) throw new Error(`Missing endpoint in ${view.kind} visualization.`);
    if (String(edge.from) === String(edge.to)) {
      return `<path d="M${from.x - 17} ${from.y - 23} C${from.x - 65} ${from.y - 85},${from.x + 65} ${from.y - 85},${from.x + 17} ${from.y - 23}" class="trace-edge" ${view.directed ? 'marker-end="url(#trace-arrow)"' : ''}/>${edge.label !== undefined ? text(from.x, from.y - 71, trim(edge.label, 5), 'trace-index') : ''}`;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = 29;
    const x1 = from.x + dx / length * offset;
    const y1 = from.y + dy / length * offset;
    const x2 = to.x - dx / length * offset;
    const y2 = to.y - dy / length * offset;
    return `<path d="M${x1} ${y1} L${x2} ${y2}" class="trace-edge" ${view.directed ? 'marker-end="url(#trace-arrow)"' : ''}/>${edge.label !== undefined ? `<g><rect x="${(from.x + to.x) / 2 - 19}" y="${(from.y + to.y) / 2 - 16}" width="38" height="24" rx="5" class="trace-edge-label"/>${text((from.x + to.x) / 2, (from.y + to.y) / 2 + 1, trim(edge.label, 5), 'trace-index')}</g>` : ''}`;
  }).join('');
  output += nodes.map(node => {
    const p = positions[String(node.id)];
    const active = (view.active ?? []).map(String).includes(String(node.id));
    return `<g class="trace-node ${active ? 'is-active' : ''}"><circle cx="${p.x + 3}" cy="${p.y + 5}" r="31" class="trace-node-shadow"/><circle cx="${p.x}" cy="${p.y}" r="29"/>${text(p.x, p.y + 6, trim(node.label, 9), 'trace-value')}</g>`;
  }).join('');
  if (!nodes.length) output += text(490, 350, 'No nodes remain', 'trace-empty');
  return output;
}

function grid(view) {
  const matrix = view.matrix ?? [];
  const rows = matrix.length;
  const columns = Math.max(1, ...matrix.map(row => row.length));
  const size = Math.min(64, 620 / columns, 390 / Math.max(1, rows));
  const x = (980 - columns * (size + 6)) / 2;
  const y = Math.max(140, (680 - rows * (size + 6)) / 2);
  let output = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < matrix[r].length; c++) {
    output += cell(x + c * (size + 6), y + r * (size + 6), size, size, matrix[r][c], (view.active ?? []).some(([ar, ac]) => ar === r && ac === c));
  }
  for (let c = 0; c < columns; c++) output += text(x + c * (size + 6) + size / 2, y - 15, c, 'trace-index');
  for (let r = 0; r < rows; r++) output += text(x - 25, y + r * (size + 6) + size / 2 + 5, r, 'trace-index');
  return output;
}

function intervals(view) {
  const values = view.values ?? [];
  const min = Math.min(0, ...values.flat());
  const max = Math.max(1, ...values.flat());
  const scale = 680 / (max - min);
  return values.map(([a, b], i) => `<g class="trace-interval ${(view.active ?? []).includes(i) ? 'is-active' : ''}"><rect x="${150 + (a - min) * scale}" y="${160 + i * 58}" width="${Math.max(12, (b - a) * scale)}" height="33" rx="6"/>${text(100, 183 + i * 58, i, 'trace-index')}${text(150 + (a - min) * scale, 150 + i * 58, a, 'trace-index')}${text(150 + (b - min) * scale, 150 + i * 58, b, 'trace-index')}</g>`).join('');
}

export function traceDiagram(frame, title, step, total) {
  const view = frame.view;
  let body;
  if (view.kind === 'graph' || view.kind === 'tree') body = network(view);
  else if (view.kind === 'grid') body = grid(view);
  else if (view.kind === 'stack') body = stack(view);
  else if (view.kind === 'intervals') body = intervals(view);
  else if (['array', 'list', 'queue', 'hash', 'bits', 'text', 'state'].includes(view.kind)) body = array(view);
  else throw new Error(`Unsupported visualization kind: ${view.kind}`);
  const result = view.result;
  const showResult = result !== undefined && (String(result).trim() !== '' || step === total - 1);
  return `<svg viewBox="0 0 980 680" role="img" aria-labelledby="trace-title trace-description" data-view="${view.kind}">
    <title id="trace-title">${esc(title)} — ${esc(frame.title)}</title>
    <desc id="trace-description">${esc(frame.description)} ${result === undefined ? '' : `Result: ${esc(result)}`}</desc>
    <defs><marker id="trace-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#ee806b"/></marker><pattern id="trace-dots" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="1" fill="#888" opacity=".14"/></pattern></defs>
    <rect width="980" height="680" fill="url(#trace-dots)"/>
    ${text(490, 100, `${view.kind.toUpperCase()} EXPLORER`, 'trace-subtitle')}
    ${body}
    ${showResult ? `<rect x="140" y="597" width="700" height="44" rx="8" class="trace-result-bg"/>${text(490, 625, `Result: ${String(result).trim() === '' ? '∅' : trim(result, 90)}`, 'trace-result')}` : text(490, 630, `STEP ${step + 1} / ${total} · CORAL HIGHLIGHTS THE CURRENT OPERATION`, 'trace-subtitle')}
  </svg>`;
}
