# Algorithm Studio

An original interactive algorithm-learning experience focused on Big-O notation. Built with vanilla JavaScript, CSS, independently drawn SVG diagrams, and Vite.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the displayed local URL. The lesson uses `#/big-o/1` through `#/big-o/7`; arrow keys step through the lesson when focus is not in an interactive control. Ctrl/Cmd+K opens lesson search.

## Included

- Seven complete lesson steps with input doubling, operation counts, and interactive growth-rate highlights.
- Pseudocode, JavaScript, and Python examples.
- Four-question practice, a quadratic-growth challenge, and a quick-reference cheatsheet.
- Device-local progress and theme preferences, with an explicit reset confirmation.
- Responsive desktop/mobile layout and accessible keyboard/dialog controls.

Only Big-O is available. Other course topics are labeled **SOON**, not linked to unfinished lessons. The halving model counts reductions rather than exact binary-search comparisons.

## Validate and build

```sh
npx playwright install chromium
npm test
npm run build
```

Production output is in `dist`. Deploy it as a static site; hash routing does not require server rewrites.

## GitHub Pages

The public site is deployed from `main` by `.github/workflows/pages.yml`. The workflow runs browser tests before building and publishing. GitHub Pages must use **GitHub Actions** as its deployment source. Vite uses `/algorithm-visualizer/` for Actions builds and `/` for local development.

Site: https://nuthanreddy.github.io/algorithm-visualizer/#/big-o/1

The site is inspired by the layout and learning mechanics of the supplied reference, with original implementation, educational wording, branding, and geometric artwork. Google Fonts supplies DM Sans and Manrope; system sans-serif fallbacks are used if unavailable.
