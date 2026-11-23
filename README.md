# Algorithm Studio

An original interactive algorithm-learning experience covering all 86 lessons in 14 course groups. Built with vanilla JavaScript, CSS, independently drawn SVG diagrams, and Vite.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the displayed local URL. Lessons use `#/<topic-id>/<step>`; the original Big-O flow remains `#/big-o/1` through `#/big-o/7`. Arrow keys step through a lesson when focus is not in an interactive control. Ctrl/Cmd+K opens course-wide search.

## Included

- All 86 topics: Foundations; Arrays & Strings; Linked Lists; Stacks & Queues; Hashing; Trees; Heaps; Graphs; Sorting & Searching; Greedy Algorithms; Backtracking; Dynamic Programming; Bit Manipulation; and P vs NP.
- Topic-specific executable traces with distinct example scenarios, forward/backward stepping, playback, and array/list/stack/queue/hash/tree/graph/grid/interval/bit visualizations.
- Pseudocode, JavaScript, and Python examples for each topic.
- Course-wide practice, a challenge for every topic, and filtered reference cards covering the full inventory.
- Device-local completion, explored steps, practice results, and theme preferences, with an explicit reset confirmation. Existing Big-O progress is migrated.
- Responsive desktop/mobile layout and accessible keyboard/dialog controls.

`src/curriculum.js` is the exact reference inventory, with stable original route IDs. `src/topics-*.js` contains the original topic content and deterministic algorithms. `src/trace-contract.js` turns immutable algorithm snapshots into lesson steps. Every topic has at least two predefined examples with independently specified expected outcomes.

Examples are small teaching simulations, not a general-purpose code execution environment. Switch examples to compare cases; custom arbitrary input and running code from the editor are not offered. Code snippets illustrate the algorithm, and auxiliary helpers are explained by the lesson. Complexity bounds depend on the stated data structure and assumptions. The Big-O halving model counts reductions rather than exact binary-search comparisons; the P vs NP lesson does not claim the open problem is solved.

The navigation sections also have shareable routes: `#/practice`, `#/cheatsheet`, `#/challenge`, and `#/progress`. Closing a section returns to the active lesson. Example selection is preserved in lesson links using `?example=<index>`.

## Validate and build

```sh
npx playwright install chromium
npm test
npm run build
```

Production output is in `dist`. Deploy it as a static site; hash routing does not require server rewrites.

## GitHub Pages

The public site is deployed from `main` by `.github/workflows/pages.yml`. The workflow verifies the full inventory's example outcomes and browser routes before building and publishing. Build and deployment are separate dependent jobs. GitHub Pages must use **GitHub Actions** as its deployment source. Vite uses `/algorithm-visualizer/` for Actions builds and `/` for local development.

Site: https://nuthanreddy.github.io/algorithm-visualizer/#/big-o/1

The site is inspired by the layout and learning mechanics of the supplied reference, with original implementation, educational wording, branding, and geometric artwork. Google Fonts supplies DM Sans and Manrope; system sans-serif fallbacks are used if unavailable.
