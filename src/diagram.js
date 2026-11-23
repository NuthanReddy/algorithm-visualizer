import { complexities, counts } from './lesson.js';

function polygon(points, attrs) {
  return `<polygon points="${points.map(p => p.join(',')).join(' ')}" ${attrs}/>`;
}

function prism(cx, cy, w, d, h, fills, extra = '') {
  const top = [cx, cy - h];
  const right = [cx + w, cy + w * 0.48 - h];
  const front = [cx + w - d, cy + (w + d) * 0.48 - h];
  const left = [cx - d, cy + d * 0.48 - h];
  const bottom = p => [p[0], p[1] + h];
  return `<g ${extra}>
    ${polygon([left, front, bottom(front), bottom(left)], `fill="${fills[1]}"`)}
    ${polygon([front, right, bottom(right), bottom(front)], `fill="${fills[2]}"`)}
    ${polygon([top, right, front, left], `fill="${fills[0]}"`)}
  </g>`;
}

export function diagram(n, focus) {
  const values = counts(n);
  const bases = [
    { x: 184, y: 471, w: 105, d: 88, h: 38 },
    { x: 361, y: 431, w: 108, d: 92, h: 73 },
    { x: 552, y: 387, w: 113, d: 98, h: 107 },
    { x: 753, y: 338, w: 120, d: 107, h: 147 },
  ];
  let grid = '';
  for (let i = -15; i <= 15; i++) {
    grid += `<path d="M${490 + i * 46 - 610} 60 l1220 586 M${490 + i * 46 + 610} 60 l-1220 586"/>`;
  }
  const platforms = bases.map((b, i) => {
    const c = complexities[i];
    const rows = i === 3 ? n : 1;
    const cols = i === 3 ? n : values[i];
    const cell = Math.min(33, (b.w - 20) / cols, (b.d - 18) / rows);
    const startX = b.x + 6;
    const startY = b.y - b.h + 14;
    let cubes = '';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * cell - row * cell;
        const y = startY + (col + row) * cell * 0.48;
        cubes += prism(x, y, cell * 0.84, cell * 0.84, Math.min(20, cell * 0.67),
          ['#f0e6d7', '#baaa99', c.color], `class="operation-block" style="animation-delay:${(col + row) * 18}ms"`);
      }
    }
    const dimmed = focus && focus !== c.key;
    const labelY = b.y + (b.w + b.d) * 0.48 + 34;
    return `<g class="platform ${dimmed ? 'dimmed' : ''}" data-complexity="${c.key}">
      <ellipse cx="${b.x + 5}" cy="${b.y + 86}" rx="${b.w + 15}" ry="38" fill="#000" opacity=".23"/>
      ${prism(b.x, b.y, b.w, b.d, b.h, ['#383a3b', '#252728', '#303233'], 'class="plinth"')}
      ${prism(b.x, b.y - b.h, b.w, b.d, 5, ['#64605a', '#45413d', '#514b45'])}
      ${cubes}
      <text x="${b.x + 7}" y="${b.y + (b.w + b.d) * 0.48 - b.h / 2 + 7}" text-anchor="middle" class="platform-formula">${c.formula}</text>
      <path d="M${b.x + 6} ${labelY - 33} v15" stroke="${c.color}" stroke-width="1.5"/>
      <rect x="${b.x - 51}" y="${labelY - 18}" width="114" height="39" rx="10" class="count-label"/>
      <circle cx="${b.x - 32}" cy="${labelY + 1}" r="3.5" fill="${c.color}"/>
      <text x="${b.x + 15}" y="${labelY + 6}" text-anchor="middle" class="count-text">${values[i]} ${values[i] === 1 ? 'operation' : 'operations'}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 980 680" role="img" aria-labelledby="diagram-title diagram-description">
    <title id="diagram-title">How algorithm work grows for ${n} input items</title>
    <desc id="diagram-description">Constant: ${values[0]} operation. Logarithmic: ${values[1]}. Linear: ${values[2]}. Quadratic: ${values[3]}. One block represents one operation.</desc>
    <defs>
      <radialGradient id="grid-fade"><stop offset="0" stop-color="white" stop-opacity=".9"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
      <mask id="grid-mask"><ellipse cx="490" cy="350" rx="490" ry="335" fill="url(#grid-fade)"/></mask>
      <radialGradient id="ambient"><stop stop-color="#ed806c" stop-opacity=".065"/><stop offset="1" stop-color="#ed806c" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="590" cy="355" rx="440" ry="320" fill="url(#ambient)"/>
    <g mask="url(#grid-mask)" class="diagram-grid">${grid}</g>
    <g class="input-label">
      <rect x="430" y="63" width="120" height="52" rx="12"/>
      <text x="490" y="84" text-anchor="middle" class="input-caption">INPUT SIZE</text>
      <text x="490" y="105" text-anchor="middle" class="input-value">n = ${n}</text>
      <path d="M490 115 v31 l190 91" fill="none" stroke="#ed806c" stroke-opacity=".4" stroke-dasharray="4 5"/>
      <circle cx="680" cy="237" r="4" fill="#ed806c"/>
    </g>
    ${platforms}
    <text x="490" y="647" text-anchor="middle" class="diagram-caption">ONE BLOCK = ONE OPERATION</text>
  </svg>`;
}
