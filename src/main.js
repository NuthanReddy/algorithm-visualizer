import './style.css';
import { lessons as bigOLessons, complexities, counts, snippets } from './lesson.js';
import { diagram } from './diagram.js';
import { curriculum, inventory, byId } from './curriculum.js';
import { topics } from './catalog.js';
import { buildLesson } from './trace-contract.js';
import { traceDiagram } from './trace-diagram.js';

const paths = {
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 18l9 5 9-5"/>',
  book: '<path d="M12 5v16M12 5C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 1Z"/>',
  code: '<path d="m7 7-5 5 5 5m10-10 5 5-5 5m-4-13-2 20"/>',
  file: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h8"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-5 1h10"/>',
  chart: '<path d="M3 20h18M6 16v-5m6 5V4m6 12V8"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  folder: '<path d="M3 5h6l2 2h10v13H3V5Z"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

let storageAvailable = true;
function read(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch (error) { storageAvailable = false; console.warn('Local progress storage is unavailable.', error); return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); }
  catch (error) { storageAvailable = false; console.warn('Could not save local progress.', error); toast('Progress could not be saved in this browser.'); }
}
function readObject(key) {
  const stored = read(key, '{}');
  try {
    const result = JSON.parse(stored);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid saved progress format.');
    return result;
  } catch (error) {
    console.warn(`Could not restore ${key}.`, error);
    return {};
  }
}
const progress = readObject('studio-course-progress');
if (!progress['big-o']) progress['big-o'] = {
  visited: read('studio-visited', '').split(',').filter(x => /^[0-6]$/.test(x)).map(Number),
  completed: read('studio-complete', 'false') === 'true',
};
let topicId = 'big-o';
let exampleIndex = 0;
let lessonData = null;
let lessons = bigOLessons;
let step = 0;
let playbackTimer = null;
let sectionRoute = '';
let focusOverride = null;
let language = read('studio-code', 'Pseudocode');
if (!Object.hasOwn(snippets, language)) language = 'Pseudocode';
let completed = progress['big-o'].completed === true;
let visited = new Set(progress['big-o'].visited);
let theme = read('studio-theme', 'dark');
let searchTerm = '';
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizTopicId = 'big-o';
let quizQuestions = [];
let challengeTopicId = 'big-o';
let referenceFilter = '';
let toastTimer;

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <button class="icon-button mobile-menu" aria-label="Open course menu" aria-expanded="false" aria-controls="course-sidebar">${icon('menu')}</button>
    <a class="brand" href="#/big-o/1" aria-label="Algorithm Studio home"><span class="brand-symbol">${icon('layers')}</span><span>algo<span class="brand-slash">/</span><strong>studio</strong></span></a>
    <nav class="topnav" aria-label="Main navigation">
      <a href="#/big-o/1" class="nav-item selected" aria-current="page">${icon('book')}<span>Learn</span></a>
      <button class="nav-item" data-dialog="practice">${icon('code')}<span>Practice</span></button>
      <button class="nav-item" data-dialog="cheatsheet">${icon('file')}<span>Cheatsheet</span></button>
      <button class="nav-item" data-dialog="challenge">${icon('trophy')}<span>Challenge</span></button>
      <button class="nav-item" data-dialog="progress">${icon('chart')}<span>Progress</span></button>
    </nav>
    <div class="header-tools">
      <button class="search-trigger" data-dialog="search" aria-label="Search lesson topics">${icon('search')}<span>Find something to learn...</span><kbd>Ctrl K</kbd></button>
      <button class="language-button" data-dialog="language" aria-label="Lesson language: English">${icon('globe')}<span>EN</span></button>
      <button class="icon-button theme-button" aria-label="Switch to light theme">${icon('sun')}</button>
      <span class="header-divider"></span><span class="edition">A little learning.<br><strong>A big difference.</strong></span>
    </div>
  </header>
  <div class="workspace">
    <aside class="sidebar" id="course-sidebar" aria-label="Course navigation">
      <div class="course-heading">${icon('book')}<h2>Your learning path</h2><span class="tiny-badge">86 LIVE</span></div>
      <div class="course-list"></div>
      <div class="sidebar-bottom"><div class="progress-caption"><span>Your progress</span><strong class="progress-fraction">0 / 86</strong></div><div class="progress-track"><span></span></div><p>One concept at a time. You've got this.</p></div>
    </aside>
    <main id="main-content">
      <section class="lesson-shell" aria-label="Big-O lesson">
        <div class="lesson-heading">
          <div><div class="eyebrow">FOUNDATIONS <span>/</span> LESSON 01</div><h1>Big-O Notation<span class="title-dot">.</span></h1><p>Understand the work. See the growth.</p></div>
          <div class="lesson-meta"><span>${icon('clock')} 5 min</span><span class="beginner"><i></i> Beginner friendly</span></div>
        </div>
        <div class="visualization">
          <div class="visual-top"><span class="live-label"><i></i> GROWTH EXPLORER</span><button class="reset-button" aria-label="Restart lesson">${icon('reset')}<span>Reset</span></button></div>
          <div id="diagram"></div>
          <div class="legend" aria-label="Highlight a complexity"></div>
          <div class="visual-bottom"><span>${icon('layers')} Four approaches. The same input.</span><span class="visual-hint">Select a growth rate to take a closer look</span></div>
        </div>
        <div class="timeline-panel">
          <div class="timeline-heading"><h2>Your next small steps</h2><span class="keyboard-hint"><kbd>←</kbd><kbd>→</kbd> to explore</span><span class="step-caption"></span></div>
          <ol class="timeline"></ol>
        </div>
        <div class="lesson-footer"><span>${icon('bulb')} The best way to learn an algorithm? Watch it work.</span><span>MADE FOR CURIOUS MINDS</span></div>
      </section>
    </main>
    <aside class="details" aria-label="Lesson explanation">
      <section class="explanation-card" aria-live="polite"></section>
      <section class="code-card"><div class="card-heading"><h2>${icon('code')} Under the hood</h2><label class="sr-only" for="code-language">Code language</label><select id="code-language">${Object.keys(snippets).map(l => `<option>${l}</option>`).join('')}</select></div><div class="code-content"></div></section>
      <section class="metrics-card"><div class="card-heading"><h2>${icon('chart')} The work, in numbers</h2><span class="metrics-input"></span></div><dl class="metrics"></dl><p>Illustrative operations, not elapsed time.</p></section>
    </aside>
  </div>
  <dialog id="utility-dialog"><div class="dialog-heading"><span class="dialog-eyebrow">ALGORITHM STUDIO</span><button class="icon-button close-dialog" aria-label="Close dialog">${icon('close')}</button></div><div id="dialog-content"></div></dialog>
  <div class="toast" role="status"></div>`;

const dialog = document.querySelector('#utility-dialog');
document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
document.querySelector('#code-language').value = language;

function toast(message) {
  const el = document.querySelector('.toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 4000);
}

function renderSidebar() {
  const scroll = document.querySelector('.course-list').scrollTop;
  const openGroups = new Set([...document.querySelectorAll('.course-group[open]')].map(el => Number(el.dataset.group)));
  openGroups.add(byId[topicId].groupIndex);
  document.querySelector('.course-list').innerHTML = curriculum.map(([name, entries], index) => `
    <details class="course-group" data-group="${index}" ${openGroups.has(index) ? 'open' : ''}>
      <summary>${icon('chevron', 'disclosure')}${icon('folder')}<span><small>${String(index + 1).padStart(2, '0')}</small> ${escape(name)}</span><span class="group-status">${entries.filter(([id]) => progress[id]?.completed).length}/${entries.length}</span></summary>
      <div class="course-topics">${entries.map(([id, title]) =>
        `<a href="#/${id}/1" class="topic ${id === topicId ? 'current' : ''}" ${id === topicId ? 'aria-current="page"' : ''}>${icon(progress[id]?.completed ? 'check' : 'file')}<span>${escape(title)}</span>${id === topicId ? '<span class="topic-dot"></span>' : ''}</a>`).join('')}</div>
    </details>`).join('');
  document.querySelector('.course-list').scrollTop = scroll;
  renderProgress();
}

function renderProgress() {
  const count = inventory.filter(({ id }) => progress[id]?.completed).length;
  document.querySelector('.progress-fraction').textContent = `${count} / ${inventory.length}`;
  document.querySelector('.sidebar-bottom .progress-track span').style.width = `${count / inventory.length * 100}%`;
}

function renderCode(focus) {
  const content = document.querySelector('.code-content');
  if (topicId !== 'big-o') {
    const lines = topics[topicId].code[language];
    content.innerHTML = `<div class="code-example"><div class="code-label"><span>${escape(byId[topicId].title)}</span><span>${escape(language)}</span></div><pre><code>${lines.map((line, j) => `<span class="code-line"><span class="line-number">${j + 1}</span><span>${escape(line).replace(/\b(function|return|while|for|const|let|def|in|if|else)\b/g, '<b>$1</b>')}</span></span>`).join('')}</code></pre></div>`;
    return;
  }
  const selected = focus ? complexities.findIndex(c => c.key === focus) : -1;
  content.innerHTML = snippets[language].map((lines, i) => `
    <div class="code-example ${selected === i ? 'focused' : ''} ${selected !== -1 && selected !== i ? 'muted' : ''}">
      <div class="code-label"><span style="color:${complexities[i].color}">${complexities[i].formula}</span><span>${complexities[i].name.toLowerCase()}</span></div>
      <pre><code>${lines.map((line, j) => `<span class="code-line"><span class="line-number">${j + 1}</span><span>${escape(line).replace(/\b(function|return|while|for|const|let|def|in)\b/g, '<b>$1</b>')}</span></span>`).join('')}</code></pre>
    </div>`).join('');
  content.scrollTop = selected === -1 ? 0 : content.querySelector('.focused').offsetTop;
}

function render() {
  const lesson = lessons[step];
  const topic = byId[topicId];
  const focus = focusOverride ?? lesson.focus;
  visited.add(step);
  progress[topicId] = { ...progress[topicId], visited: [...visited], completed, lastStep: step };
  save('studio-course-progress', JSON.stringify(progress));
  if (topicId === 'big-o') save('studio-visited', [...visited].join(','));
  document.title = `${topic.title} | Algorithm Studio`;
  document.querySelector('.lesson-shell').setAttribute('aria-label', `${topic.title} lesson`);
  document.querySelector('.lesson-heading h1').innerHTML = `${escape(topic.title)}<span class="title-dot">.</span>`;
  document.querySelector('.eyebrow').innerHTML = `${escape(topic.category.toUpperCase())} <span>/</span> LESSON ${String(topic.topicIndex + 1).padStart(2, '0')}`;
  document.querySelector('.lesson-heading p').textContent = topicId === 'big-o' ? 'Understand the work. See the growth.' : topics[topicId].invariant;
  document.querySelector('.live-label').innerHTML = `<i></i> ${topicId === 'big-o' ? 'GROWTH' : 'ALGORITHM'} EXPLORER`;
  document.querySelector('#diagram').innerHTML = topicId === 'big-o' ? diagram(lesson.n, focus) : traceDiagram(lesson.frame, topic.title, step, lessons.length);
  document.querySelector('.legend').innerHTML = topicId === 'big-o' ? complexities.map(c => `
    <button class="legend-button ${focus === c.key ? 'active' : ''}" data-focus="${c.key}" aria-pressed="${focus === c.key}" style="--rate-color:${c.color}"><i></i><span>${c.formula}</span><small>${c.name}</small></button>`).join('') : `
      <label class="example-label" for="example-select">Example</label><select id="example-select">${topics[topicId].examples.map((example, i) => `<option value="${i}" ${i === exampleIndex ? 'selected' : ''}>${escape(example.label)}</option>`).join('')}</select><button class="play-trace" aria-pressed="${playbackTimer !== null}">${icon(playbackTimer ? 'close' : 'arrow')}${playbackTimer ? 'Pause' : 'Play trace'}</button>`;
  document.querySelector('.legend').classList.toggle('trace-controls', topicId !== 'big-o');
  document.querySelector('.visual-bottom > span:first-child').innerHTML = `${icon('layers')} ${topicId === 'big-o' ? 'Four approaches. The same input.' : 'Trace the state, step by step.'}`;
  document.querySelector('.visual-hint').textContent = topicId === 'big-o' ? 'Select a growth rate to take a closer look' : 'Switch examples to test a different case';
  document.querySelector('.step-caption').textContent = `${step + 1} of ${lessons.length}`;
  document.querySelector('.timeline').classList.toggle('trace-timeline', topicId !== 'big-o');
  document.querySelector('.timeline').style.setProperty('--steps', lessons.length);
  document.querySelector('.timeline').innerHTML = lessons.map((s, i) => `
    <li><button data-step="${i}" class="${i === step ? 'active' : ''} ${visited.has(i) && i !== step ? 'visited' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="step-circle">${visited.has(i) && i < step ? icon('check') : i + 1}</span><span class="step-name">${topicId === 'big-o' && i > 2 ? `<small>${complexities[i - 3].formula}</small>` : ''}${escape(s.short)}</span></button></li>`).join('');
  if (topicId !== 'big-o') {
    const timeline = document.querySelector('.timeline');
    const active = timeline.querySelector('.active').parentElement;
    timeline.scrollLeft = active.offsetLeft - timeline.offsetLeft - timeline.clientWidth / 2 + active.clientWidth / 2;
  }
  document.querySelector('.explanation-card').innerHTML = `
    <div class="explanation-meta"><span>STEP ${String(step + 1).padStart(2, '0')} <span class="muted-text">/ ${String(lessons.length).padStart(2, '0')}</span></span><span class="concept-badge">${escape(lesson.tag)}</span></div>
    <h2>${escape(lesson.title)}</h2>
    ${lesson.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}
    <div class="notice">${icon('bulb')}<div><h3>${escape(lesson.noteTitle)}</h3><p>${escape(lesson.note)}</p></div></div>
    <div class="step-navigation"><button class="back-button" ${step === 0 ? 'disabled' : ''}>${icon('arrow', 'reverse')} Back</button><button class="next-button">${step === lessons.length - 1 ? completed ? 'Try the practice' : 'Finish lesson' : 'Next step'}${icon(step === lessons.length - 1 ? 'check' : 'arrow')}</button></div>`;
  document.querySelector('.metrics-input').textContent = topicId === 'big-o' ? `n = ${lesson.n}` : `Trace ${step + 1}`;
  document.querySelector('.metrics').innerHTML = topicId === 'big-o' ? complexities.map((c, i) => `
    <div class="metric ${focus === c.key ? 'focused' : ''}" data-count="${c.key}"><dt><i style="background:${c.color}"></i><strong>${c.formula}</strong><span>${c.name.toLowerCase()}</span></dt><dd>${counts(lesson.n)[i]}</dd></div>`).join('') :
    [...(lesson.frame.metrics ?? []), ['Time', topics[topicId].complexity.time], ['Space', topics[topicId].complexity.space]].map(([label, value]) => `<div class="metric"><dt><strong>${escape(label)}</strong></dt><dd>${escape(value)}</dd></div>`).join('');
  document.querySelector('.metrics-card > p').textContent = topicId === 'big-o' ? 'Illustrative operations, not elapsed time.' : 'Complexities use the assumptions in the lesson.';
  renderCode(focus);
  renderProgress();
  updateThemeButton();
}

function stopPlayback() {
  clearInterval(playbackTimer);
  playbackTimer = null;
}

function navigate(index, keepPlaying = false) {
  if (!keepPlaying) stopPlayback();
  focusOverride = null;
  const next = Math.max(0, Math.min(lessons.length - 1, index));
  const hash = `#/${topicId}/${next + 1}${exampleIndex ? `?example=${exampleIndex}` : ''}`;
  if (location.hash === hash) { step = next; render(); }
  else location.hash = hash;
}

function syncRoute() {
  const section = location.hash.match(/^#\/(practice|cheatsheet|challenge|progress)$/);
  if (section) { sectionRoute = section[1]; openDialog(section[1], false); return; }
  sectionRoute = '';
  if (dialog.open) dialog.close();
  const match = location.hash.match(/^#\/([a-z0-9-]+)\/(\d+)(?:\?example=(\d+))?$/);
  const requestedId = match?.[1];
  if (!byId[requestedId]) {
    if (location.hash && location.hash !== '#') toast('That lesson route was not found. Opening Big-O.');
    history.replaceState(null, '', '#/big-o/1');
    topicId = 'big-o'; exampleIndex = 0; lessons = bigOLessons; step = 0;
  } else {
    const nextExample = requestedId === 'big-o' ? 0 : Math.min(Number(match[3] ?? 0), topics[requestedId].examples.length - 1);
    if (requestedId !== topicId || nextExample !== exampleIndex) stopPlayback();
    topicId = requestedId;
    exampleIndex = nextExample;
    lessonData = topicId === 'big-o' ? null : buildLesson(topics[topicId], exampleIndex);
    lessons = lessonData?.steps ?? bigOLessons;
    step = Math.max(0, Math.min(lessons.length - 1, Number(match[2]) - 1));
    if (step !== Number(match[2]) - 1) history.replaceState(null, '', `#/${topicId}/${step + 1}${exampleIndex ? `?example=${exampleIndex}` : ''}`);
  }
  completed = progress[topicId]?.completed === true;
  visited = new Set(Array.isArray(progress[topicId]?.visited) ? progress[topicId].visited.filter(i => Number.isInteger(i) && i >= 0 && i < lessons.length) : []);
  focusOverride = null;
  renderSidebar();
  render();
}

function updateThemeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  const btn = document.querySelector('.theme-button');
  btn.innerHTML = icon(light ? 'moon' : 'sun');
  btn.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
}

const bigOQuestions = [
  { question: 'You read the last item of an array by its index. How does the work grow?', answer: 0, detail: 'Direct access does not depend on the number of items. That is constant time.' },
  { question: 'You walk through every item once to find the largest number. What is the growth rate?', answer: 2, detail: 'One visit per item means the work grows in proportion to n: linear time.' },
  { question: 'A sorted search repeatedly discards half of the remaining candidates. Which rate fits?', answer: 1, detail: 'Halving the remaining problem gives logarithmic growth.' },
  { question: 'For every item, you visit every item again. What happens as the list grows?', answer: 3, detail: 'Two full nested passes multiply to n × n: quadratic time.' },
];

const bigOSpec = {
  intro: 'Compare how constant, logarithmic, linear and quadratic work grow with the input.',
  invariant: 'Measure growth in operations, rather than elapsed time.',
  takeaway: 'Drop constant factors and lower-order terms when comparing growth at scale.',
  complexity: { time: 'O(1) to O(n²)', space: 'Depends on the algorithm' },
  challenge: {
    prompt: 'A quadratic algorithm does 64 operations for 8 items. If the input doubles to 16 items, how many operations will it do?',
    answer: '256', hint: 'Quadratic work is n × n, not twice n.',
    explanation: 'Doubling the input quadrupled the work from 64 to 256.',
  },
};
const getSpec = id => id === 'big-o' ? bigOSpec : topics[id];
const topicOptions = selected => inventory.map(topic => `<option value="${topic.id}" ${topic.id === selected ? 'selected' : ''}>${escape(topic.title)}</option>`).join('');

function startQuiz(id) {
  quizTopicId = id;
  quizIndex = 0; quizScore = 0; quizAnswered = false;
  const ids = id === 'all' ? inventory.map(topic => topic.id) : [id];
  quizQuestions = ids.flatMap(key => key === 'big-o'
    ? bigOQuestions.map(q => ({ ...q, topicId: key, options: complexities.map(c => `${c.formula} · ${c.name}`), explanation: q.detail }))
    : [{ ...topics[key].quiz, topicId: key }]);
}

function quizMarkup() {
  const selector = `<label class="field-label" for="practice-topic">Practice a topic</label><select id="practice-topic" class="topic-select"><option value="all" ${quizTopicId === 'all' ? 'selected' : ''}>Mixed review — every course topic</option>${topicOptions(quizTopicId)}</select>`;
  if (quizIndex === quizQuestions.length) {
    return `${selector}<div class="result-icon">${icon('trophy')}</div><h2>Small steps, stronger intuition.</h2><p class="dialog-description">You got <strong>${quizScore} of ${quizQuestions.length}</strong> correct. ${quizScore === quizQuestions.length ? 'You have a great handle on this material.' : 'Revisit the explorer, then give it another go.'}</p><button class="primary-button" data-action="restart-quiz">Practice again ${icon('reset')}</button>`;
  }
  const question = quizQuestions[quizIndex];
  return `${selector}<div class="dialog-kicker">PRACTICE <span>${quizIndex + 1} / ${quizQuestions.length}</span></div><h2>Put your intuition to work.</h2><a class="quiz-lesson-link" data-topic="${question.topicId}" href="#/${question.topicId}/1">${escape(byId[question.topicId].title)} ${icon('arrow')}</a><p class="quiz-question">${escape(question.question)}</p><div class="quiz-options">${question.options.map((option, i) => `<button data-answer="${i}"><span>${escape(option)}</span>${icon('chevron')}</button>`).join('')}</div><div class="quiz-feedback" role="status"></div><button class="primary-button quiz-next" data-action="next-question" hidden>Next question ${icon('arrow')}</button>`;
}

function searchResults() {
  const term = searchTerm.toLowerCase();
  const filtered = inventory.filter(topic => `${topic.title} ${topic.category}`.toLowerCase().includes(term));
  const steps = searchTerm ? lessons.map((s, i) => ({ ...s, i })).filter(s => `${s.title} ${s.short} ${s.tag}`.toLowerCase().includes(term)) : [];
  document.querySelector('.search-results').innerHTML = filtered.length || steps.length ?
    filtered.map(topic => `<button data-topic="${topic.id}">${icon('book')}<span><strong>${escape(topic.title)}</strong><small>${escape(topic.category)} · Lesson ${topic.topicIndex + 1}</small></span>${icon('arrow')}</button>`).join('') +
    steps.map(s => `<button data-search-step="${s.i}">${icon('book')}<span><strong>${escape(s.title)}</strong><small>${escape(byId[topicId].title)} · Step ${s.i + 1}</small></span>${icon('arrow')}</button>`).join('') : '<p class="empty-state">No matching lessons. Try “trees”, “search”, or “linear”.</p>';
}

function referenceCards() {
  const filtered = inventory.filter(topic => referenceFilter === '' || String(topic.groupIndex) === referenceFilter);
  document.querySelector('.reference-cards').innerHTML = filtered.map(topic => {
    const spec = getSpec(topic.id);
    return `<article class="reference-card"><a href="#/${topic.id}/1" data-topic="${topic.id}">${escape(topic.title)} ${icon('arrow')}</a><small>${escape(topic.category)}</small><p>${escape(spec.takeaway)}</p><dl><div><dt>Time</dt><dd>${escape(spec.complexity.time)}</dd></div><div><dt>Space</dt><dd>${escape(spec.complexity.space)}</dd></div></dl></article>`;
  }).join('');
}

function challengeMarkup(id) {
  const challenge = getSpec(id).challenge;
  return `<div class="dialog-kicker">A QUICK CHALLENGE ${icon('trophy')}</div><h2>Reason it through.</h2><label class="field-label" for="challenge-topic">Choose a topic</label><select id="challenge-topic" class="topic-select">${topicOptions(id)}</select><a href="#/${id}/1" data-topic="${id}" class="quiz-lesson-link">Explore ${escape(byId[id].title)} ${icon('arrow')}</a><p class="dialog-description">${escape(challenge.prompt)}</p><form id="challenge-form"><label for="challenge-answer">Your prediction</label><div class="challenge-field"><input id="challenge-answer" type="text" required placeholder="Your answer" autocomplete="off"/><button class="primary-button" type="submit">Check ${icon('arrow')}</button></div></form><div class="challenge-feedback" role="status"></div><p class="fine-print">Hint: ${escape(challenge.hint)}</p>`;
}

function openDialog(type, updateRoute = true) {
  stopPlayback();
  if (['practice', 'cheatsheet', 'challenge', 'progress'].includes(type)) {
    sectionRoute = type;
    if (updateRoute && location.hash !== `#/${type}`) history.pushState(null, '', `#/${type}`);
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('selected', el.dataset.dialog === type));
  }
  const content = document.querySelector('#dialog-content');
  if (type === 'search') {
    searchTerm = '';
    content.innerHTML = `<h2>Follow your curiosity.</h2><p class="dialog-description">Search all 86 lessons, 14 course groups, and the current lesson steps.</p><label class="search-field">${icon('search')}<input type="search" placeholder="Search concepts..." aria-label="Search concepts" autocomplete="off"/><kbd>Esc</kbd></label><div class="search-results"></div>`;
    searchResults();
  } else if (type === 'practice') {
    startQuiz(topicId);
    content.innerHTML = quizMarkup();
  } else if (type === 'cheatsheet') {
    referenceFilter = '';
    content.innerHTML = `<div class="dialog-kicker">YOUR POCKET REFERENCE</div><h2>A reference for every lesson.</h2><p class="dialog-description">Growth rates, invariants, and trade-offs across the complete course. Complexity assumptions are explained in each lesson.</p><div class="cheatsheet-grid">${complexities.map((c, i) => `<article style="--rate-color:${c.color}"><h3>${c.formula} <span>${c.name}</span></h3><p>${c.description}.</p><small>At n = 1,024</small><strong>${counts(1024)[i].toLocaleString()} operations</strong></article>`).join('')}</div><label class="field-label" for="reference-category">Course group</label><select id="reference-category" class="topic-select"><option value="">All 86 lessons</option>${curriculum.map(([name], i) => `<option value="${i}">${escape(name)}</option>`).join('')}</select><div class="reference-cards"></div>`;
    referenceCards();
  } else if (type === 'challenge') {
    challengeTopicId = topicId;
    content.innerHTML = challengeMarkup(challengeTopicId);
  } else if (type === 'progress') {
    const finished = inventory.filter(({ id }) => progress[id]?.completed).length;
    content.innerHTML = `<div class="dialog-kicker">YOUR LEARNING JOURNEY</div><h2>Every step counts.</h2><p class="dialog-description">Your course progress is saved on this device.${storageAvailable ? '' : ' Browser storage is unavailable; progress may not persist.'}</p><div class="progress-summary"><strong>${finished}<span>/ 86</span></strong><p>lessons completed · ${inventory.filter(({ id }) => progress[id]?.visited?.length).length} started</p><div class="progress-track"><span style="width:${finished / 86 * 100}%"></span></div></div><div class="course-progress">${curriculum.map(([name, entries], i) => `<details ${i === byId[topicId].groupIndex ? 'open' : ''}><summary>${escape(name)} <span>${entries.filter(([id]) => progress[id]?.completed).length} / ${entries.length}</span></summary>${entries.map(([id, title]) => `<a href="#/${id}/${(progress[id]?.lastStep ?? 0) + 1}" data-topic="${id}" class="progress-lesson">${icon(progress[id]?.completed ? 'check' : 'book')}<div><strong>${escape(title)}</strong><p>${progress[id]?.completed ? 'Completed' : progress[id]?.visited?.length ? `${progress[id].visited.length} steps explored` : 'Not started'}${progress[id]?.practice ? ` · Practice ${progress[id].practice.score}/${progress[id].practice.total}` : ''}</p></div>${icon('arrow')}</a>`).join('')}</details>`).join('')}</div><button class="primary-button" data-action="continue">Continue learning ${icon('arrow')}</button><button class="text-button" data-action="reset-progress">Reset local progress</button>`;
  } else if (type === 'complete') {
    const nextTopic = inventory[inventory.findIndex(topic => topic.id === topicId) + 1];
    content.innerHTML = `<div class="result-icon">${icon('check')}</div><div class="dialog-kicker">LESSON COMPLETE</div><h2>${topicId === 'big-o' ? 'Now you can see the bigger picture.' : 'Another idea, made concrete.'}</h2><p class="dialog-description">You completed ${escape(byId[topicId].title)}. ${escape(getSpec(topicId).takeaway)}</p><button class="primary-button" data-dialog="practice">Try a little practice ${icon('arrow')}</button>${nextTopic ? `<a class="primary-button" data-topic="${nextTopic.id}" href="#/${nextTopic.id}/1">Next: ${escape(nextTopic.title)} ${icon('arrow')}</a>` : '<p class="fine-print">You reached the end of the course. Revisit any topic or try mixed practice.</p>'}`;
  } else if (type === 'language') {
    content.innerHTML = `<div class="dialog-kicker">LANGUAGE & CODE</div><h2>Learn in English. Read your way.</h2><p class="dialog-description">The lesson is currently available in English. Code examples can be viewed in pseudocode, JavaScript, or Python.</p><label for="dialog-code-language">Code example language</label><select id="dialog-code-language">${Object.keys(snippets).map(l => `<option ${l === language ? 'selected' : ''}>${l}</option>`).join('')}</select><p class="fine-print">Choose a code language to update “Under the hood” in the lesson.</p>`;
  }
  if (!dialog.open) dialog.showModal();
  if (type === 'search') content.querySelector('input').focus();
}

document.addEventListener('click', event => {
  const el = event.target.closest('button, a');
  if (!el) return;
  if (el.dataset.step !== undefined) navigate(Number(el.dataset.step));
  if (el.dataset.focus) {
    const defaultFocus = lessons[step].focus;
    focusOverride = (focusOverride ?? defaultFocus) === el.dataset.focus ? '' : el.dataset.focus;
    render();
  }
  if (el.classList.contains('next-button')) {
    if (step < lessons.length - 1) navigate(step + 1);
    else if (completed) openDialog('practice');
    else {
      completed = true;
      if (topicId === 'big-o') save('studio-complete', 'true');
      render(); renderSidebar(); openDialog('complete');
    }
  }
  if (el.classList.contains('back-button')) navigate(step - 1);
  if (el.classList.contains('reset-button')) navigate(0);
  if (el.classList.contains('theme-button')) {
    theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme; save('studio-theme', theme); updateThemeButton();
  }
  if (el.classList.contains('mobile-menu')) {
    const open = document.querySelector('.sidebar').classList.toggle('open');
    el.setAttribute('aria-expanded', String(open));
    el.setAttribute('aria-label', open ? 'Close course menu' : 'Open course menu');
  }
  if (el.closest('.course-topics') && el.tagName === 'A') {
    document.querySelector('.sidebar').classList.remove('open');
    const menu = document.querySelector('.mobile-menu');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open course menu');
  }
  if (el.dataset.dialog) openDialog(el.dataset.dialog);
  if (el.classList.contains('close-dialog')) dialog.close();
  if (el.dataset.topic) {
    sectionRoute = '';
    dialog.close();
    stopPlayback();
    if (el.tagName !== 'A') location.hash = `#/${el.dataset.topic}/1`;
  }
  if (el.dataset.searchStep !== undefined) { sectionRoute = ''; dialog.close(); navigate(Number(el.dataset.searchStep)); }
  if (el.classList.contains('play-trace')) {
    if (playbackTimer) { stopPlayback(); render(); }
    else {
      if (step === lessons.length - 1) navigate(0);
      playbackTimer = setInterval(() => {
        if (step >= lessons.length - 1 || dialog.open) { stopPlayback(); render(); return; }
        navigate(step + 1, true);
      }, 1400);
      render();
    }
  }
  if (el.dataset.answer !== undefined && !quizAnswered) {
    quizAnswered = true;
    const answer = Number(el.dataset.answer);
    const q = quizQuestions[quizIndex];
    const correct = answer === q.answer;
    if (correct) quizScore++;
    dialog.querySelectorAll('[data-answer]').forEach(btn => {
      btn.disabled = true;
      if (Number(btn.dataset.answer) === q.answer) btn.classList.add('correct');
      else if (btn === el) btn.classList.add('incorrect');
    });
    dialog.querySelector('.quiz-feedback').innerHTML = `<strong>${correct ? 'Exactly right.' : 'Not quite. Here is the idea.'}</strong><p>${escape(q.explanation)}</p>`;
    dialog.querySelector('.quiz-next').hidden = false;
  }
  if (el.dataset.action === 'next-question') {
    quizIndex++; quizAnswered = false;
    if (quizIndex === quizQuestions.length && quizTopicId !== 'all') {
      progress[quizTopicId] = { ...progress[quizTopicId], practice: { score: quizScore, total: quizQuestions.length } };
      save('studio-course-progress', JSON.stringify(progress));
    }
    document.querySelector('#dialog-content').innerHTML = quizMarkup();
  }
  if (el.dataset.action === 'restart-quiz') { startQuiz(quizTopicId); document.querySelector('#dialog-content').innerHTML = quizMarkup(); }
  if (el.dataset.action === 'continue') dialog.close();
  if (el.dataset.action === 'reset-progress') {
    openDialog('reset-confirm');
    document.querySelector('#dialog-content').innerHTML = `<h2>Start fresh?</h2><p class="dialog-description">This clears completion, explored steps and practice results for all 86 lessons on this device. Your theme and code language stay the same.</p><button class="primary-button" data-action="confirm-reset">Reset progress</button><button class="text-button" data-action="continue">Keep my progress</button>`;
  }
  if (el.dataset.action === 'confirm-reset') {
    completed = false; visited = new Set();
    Object.keys(progress).forEach(id => delete progress[id]);
    save('studio-course-progress', '{}'); save('studio-complete', 'false'); save('studio-visited', '');
    sectionRoute = '';
    dialog.close(); navigate(0); renderSidebar(); toast('Progress reset. A fresh start!');
  }
});
document.addEventListener('input', event => {
  if (event.target.matches('.search-field input')) { searchTerm = event.target.value; searchResults(); }
});
document.addEventListener('change', event => {
  if (event.target.matches('#code-language, #dialog-code-language')) {
    language = event.target.value; save('studio-code', language);
    document.querySelector('#code-language').value = language;
    renderCode(focusOverride ?? lessons[step].focus);
  }
  if (event.target.id === 'example-select') {
    stopPlayback();
    location.hash = `#/${topicId}/1${Number(event.target.value) ? `?example=${event.target.value}` : ''}`;
  }
  if (event.target.id === 'practice-topic') {
    startQuiz(event.target.value);
    document.querySelector('#dialog-content').innerHTML = quizMarkup();
    document.querySelector('#practice-topic').focus();
  }
  if (event.target.id === 'challenge-topic') {
    challengeTopicId = event.target.value;
    document.querySelector('#dialog-content').innerHTML = challengeMarkup(challengeTopicId);
    document.querySelector('#challenge-topic').focus();
  }
  if (event.target.id === 'reference-category') {
    referenceFilter = event.target.value;
    referenceCards();
  }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'challenge-form') return;
  event.preventDefault();
  const challenge = getSpec(challengeTopicId).challenge;
  const normalize = value => String(value).trim().toLowerCase().replace(/\s+/g, '');
  const correct = normalize(document.querySelector('#challenge-answer').value) === normalize(challenge.answer);
  document.querySelector('.challenge-feedback').innerHTML = correct
    ? `<strong>${challengeTopicId === 'big-o' ? 'That is it! 16 × 16 = 256.' : 'That is it!'}</strong><p>${escape(challenge.explanation)}</p>`
    : `<strong>Try again.</strong><p>${escape(challenge.hint)}</p>`;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('.sidebar').classList.contains('open')) {
    document.querySelector('.mobile-menu').click();
    document.querySelector('.mobile-menu').focus();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); openDialog('search'); return;
  }
  if (dialog.open || event.target.closest('input, textarea, select, button, summary, a') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); navigate(step + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(step - 1); }
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  if (sectionRoute) {
    history.replaceState(null, '', `#/${topicId}/${step + 1}${exampleIndex ? `?example=${exampleIndex}` : ''}`);
    sectionRoute = '';
  }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('selected', el.tagName === 'A'));
});
window.addEventListener('hashchange', syncRoute);
renderSidebar();
syncRoute();
if (!storageAvailable) toast('Browser storage is unavailable. Progress may not persist.');
