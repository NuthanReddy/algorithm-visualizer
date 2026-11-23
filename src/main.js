import './style.css';
import { lessons, complexities, counts, snippets, courses } from './lesson.js';
import { diagram } from './diagram.js';

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
let step = 0;
let focusOverride = null;
let language = read('studio-code', 'Pseudocode');
if (!Object.hasOwn(snippets, language)) language = 'Pseudocode';
let completed = read('studio-complete', 'false') === 'true';
let visited = new Set(read('studio-visited', '').split(',').filter(x => /^[0-6]$/.test(x)).map(Number));
let theme = read('studio-theme', 'dark');
let searchTerm = '';
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
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
      <div class="course-heading">${icon('book')}<h2>Your learning path</h2><span class="tiny-badge">01 LIVE</span></div>
      <div class="course-list"></div>
      <div class="sidebar-bottom"><div class="progress-caption"><span>Your progress</span><strong class="progress-fraction">0 / 1</strong></div><div class="progress-track"><span></span></div><p>One concept at a time. You've got this.</p></div>
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
  document.querySelector('.course-list').innerHTML = courses.map(([name, topics], index) => `
    <details class="course-group" ${index === 0 ? 'open' : ''}>
      <summary>${icon('chevron', 'disclosure')}${icon('folder')}<span><small>${String(index + 1).padStart(2, '0')}</small> ${name}</span>${index === 0 ? `<span class="group-status">${completed ? '1' : '0'}/1</span>` : '<span class="upcoming-dot" title="Upcoming section"></span>'}</summary>
      <div class="course-topics">${topics.map((topic, t) => index === 0 && t === 0
        ? `<a href="#/big-o/1" class="topic current" aria-current="page">${icon(completed ? 'check' : 'file')}<span>${topic}</span><span class="topic-dot"></span></a>`
        : `<div class="topic upcoming">${icon('file')}<span>${topic}</span><span class="soon">SOON</span></div>`).join('')}</div>
    </details>`).join('');
  renderProgress();
}

function renderProgress() {
  document.querySelector('.progress-fraction').textContent = `${completed ? '1' : '0'} / 1`;
  document.querySelector('.progress-track span').style.width = `${completed ? 100 : Math.round(visited.size / 7 * 100)}%`;
}

function renderCode(focus) {
  const selected = focus ? complexities.findIndex(c => c.key === focus) : -1;
  const content = document.querySelector('.code-content');
  content.innerHTML = snippets[language].map((lines, i) => `
    <div class="code-example ${selected === i ? 'focused' : ''} ${selected !== -1 && selected !== i ? 'muted' : ''}">
      <div class="code-label"><span style="color:${complexities[i].color}">${complexities[i].formula}</span><span>${complexities[i].name.toLowerCase()}</span></div>
      <pre><code>${lines.map((line, j) => `<span class="code-line"><span class="line-number">${j + 1}</span><span>${escape(line).replace(/\b(function|return|while|for|const|let|def|in)\b/g, '<b>$1</b>')}</span></span>`).join('')}</code></pre>
    </div>`).join('');
  content.scrollTop = selected === -1 ? 0 : content.querySelector('.focused').offsetTop;
}

function render() {
  const lesson = lessons[step];
  const focus = focusOverride ?? lesson.focus;
  visited.add(step);
  save('studio-visited', [...visited].join(','));
  document.querySelector('#diagram').innerHTML = diagram(lesson.n, focus);
  document.querySelector('.legend').innerHTML = complexities.map(c => `
    <button class="legend-button ${focus === c.key ? 'active' : ''}" data-focus="${c.key}" aria-pressed="${focus === c.key}" style="--rate-color:${c.color}"><i></i><span>${c.formula}</span><small>${c.name}</small></button>`).join('');
  document.querySelector('.step-caption').textContent = `${step + 1} of 7`;
  document.querySelector('.timeline').innerHTML = lessons.map((s, i) => `
    <li><button data-step="${i}" class="${i === step ? 'active' : ''} ${visited.has(i) && i !== step ? 'visited' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="step-circle">${visited.has(i) && i < step ? icon('check') : i + 1}</span><span class="step-name">${i > 2 ? `<small>${complexities[i - 3].formula}</small>` : ''}${s.short}</span></button></li>`).join('');
  document.querySelector('.explanation-card').innerHTML = `
    <div class="explanation-meta"><span>STEP ${String(step + 1).padStart(2, '0')} <span class="muted-text">/ 07</span></span><span class="concept-badge">${lesson.tag}</span></div>
    <h2>${lesson.title}</h2>
    ${lesson.paragraphs.map(p => `<p>${p}</p>`).join('')}
    <div class="notice">${icon('bulb')}<div><h3>${lesson.noteTitle}</h3><p>${lesson.note}</p></div></div>
    <div class="step-navigation"><button class="back-button" ${step === 0 ? 'disabled' : ''}>${icon('arrow', 'reverse')} Back</button><button class="next-button">${step === 6 ? completed ? 'Try the practice' : 'Finish lesson' : 'Next step'}${icon(step === 6 ? 'check' : 'arrow')}</button></div>`;
  const values = counts(lesson.n);
  document.querySelector('.metrics-input').textContent = `n = ${lesson.n}`;
  document.querySelector('.metrics').innerHTML = complexities.map((c, i) => `
    <div class="metric ${focus === c.key ? 'focused' : ''}" data-count="${c.key}"><dt><i style="background:${c.color}"></i><strong>${c.formula}</strong><span>${c.name.toLowerCase()}</span></dt><dd>${values[i]}</dd></div>`).join('');
  renderCode(focus);
  renderProgress();
  updateThemeButton();
}

function navigate(index) {
  focusOverride = null;
  const next = Math.max(0, Math.min(6, index));
  const hash = `#/big-o/${next + 1}`;
  if (location.hash === hash) { step = next; render(); }
  else location.hash = hash;
}

function syncRoute() {
  const match = location.hash.match(/^#\/big-o\/([1-7])$/);
  if (!match) { history.replaceState(null, '', '#/big-o/1'); step = 0; }
  else step = Number(match[1]) - 1;
  focusOverride = null;
  render();
}

function updateThemeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  const btn = document.querySelector('.theme-button');
  btn.innerHTML = icon(light ? 'moon' : 'sun');
  btn.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
}

const questions = [
  { question: 'You read the last item of an array by its index. How does the work grow?', answer: 0, detail: 'Direct access does not depend on the number of items. That is constant time.' },
  { question: 'You walk through every item once to find the largest number. What is the growth rate?', answer: 2, detail: 'One visit per item means the work grows in proportion to n: linear time.' },
  { question: 'A sorted search repeatedly discards half of the remaining candidates. Which rate fits?', answer: 1, detail: 'Halving the remaining problem gives logarithmic growth.' },
  { question: 'For every item, you visit every item again. What happens as the list grows?', answer: 3, detail: 'Two full nested passes multiply to n × n: quadratic time.' },
];

function quizMarkup() {
  if (quizIndex === questions.length) {
    return `<div class="result-icon">${icon('trophy')}</div><h2>Small steps, stronger intuition.</h2><p class="dialog-description">You got <strong>${quizScore} of ${questions.length}</strong> correct. ${quizScore === questions.length ? 'You have a great handle on these four growth rates.' : 'Revisit the growth explorer, then give it another go.'}</p><button class="primary-button" data-action="restart-quiz">Practice again ${icon('reset')}</button>`;
  }
  return `<div class="dialog-kicker">PRACTICE <span>${quizIndex + 1} / ${questions.length}</span></div><h2>Put your intuition to work.</h2><p class="quiz-question">${questions[quizIndex].question}</p><div class="quiz-options">${complexities.map((c, i) => `<button data-answer="${i}"><span>${c.formula}</span><small>${c.name}</small>${icon('chevron')}</button>`).join('')}</div><div class="quiz-feedback" role="status"></div><button class="primary-button quiz-next" data-action="next-question" hidden>Next question ${icon('arrow')}</button>`;
}

function searchResults() {
  const filtered = lessons.map((s, i) => ({ ...s, i })).filter(s => `${s.title} ${s.short} ${s.tag}`.toLowerCase().includes(searchTerm.toLowerCase()));
  document.querySelector('.search-results').innerHTML = filtered.length ? filtered.map(s => `<button data-search-step="${s.i}">${icon('book')}<span><strong>${s.title}</strong><small>Big-O Notation · Step ${s.i + 1}</small></span>${icon('arrow')}</button>`).join('') : '<p class="empty-state">No matching steps. Try “linear” or “input”.</p>';
}

function openDialog(type) {
  const content = document.querySelector('#dialog-content');
  if (type === 'search') {
    searchTerm = '';
    content.innerHTML = `<h2>Follow your curiosity.</h2><p class="dialog-description">Search the seven steps of this Big-O lesson.</p><label class="search-field">${icon('search')}<input type="search" placeholder="Search concepts..." aria-label="Search concepts" autocomplete="off"/><kbd>Esc</kbd></label><div class="search-results"></div>`;
    searchResults();
  } else if (type === 'practice') {
    quizIndex = 0; quizScore = 0; quizAnswered = false;
    content.innerHTML = quizMarkup();
  } else if (type === 'cheatsheet') {
    content.innerHTML = `<div class="dialog-kicker">YOUR POCKET REFERENCE</div><h2>Four rates worth remembering.</h2><p class="dialog-description">The input gets bigger. How much more work do you do?</p><div class="cheatsheet-grid">${complexities.map((c, i) => `<article style="--rate-color:${c.color}"><h3>${c.formula} <span>${c.name}</span></h3><p>${c.description}.</p><small>At n = 1,024</small><strong>${counts(1024)[i].toLocaleString()} operations</strong></article>`).join('')}</div><p class="fine-print">These are simple growth models. Big-O ignores constant factors and lower-order terms. Logarithms here use base 2.</p>`;
  } else if (type === 'challenge') {
    content.innerHTML = `<div class="dialog-kicker">A QUICK CHALLENGE ${icon('trophy')}</div><h2>Predict the next stack.</h2><p class="dialog-description">A quadratic algorithm does 64 operations for 8 items. If the input doubles to 16 items, how many operations will it do?</p><form id="challenge-form"><label for="challenge-answer">Your prediction</label><div class="challenge-field"><input id="challenge-answer" type="number" min="0" step="1" required placeholder="Number of operations"/><button class="primary-button" type="submit">Check ${icon('arrow')}</button></div></form><div class="challenge-feedback" role="status"></div><p class="fine-print">Hint: quadratic work is n × n, not twice n.</p>`;
  } else if (type === 'progress') {
    content.innerHTML = `<div class="dialog-kicker">YOUR LEARNING JOURNEY</div><h2>${completed ? 'One big idea, in the bag.' : 'Every step counts.'}</h2><p class="dialog-description">Your progress is saved on this device.${storageAvailable ? '' : ' Browser storage is unavailable; progress may not persist.'}</p><div class="progress-summary"><strong>${visited.size}<span>/ 7</span></strong><p>lesson steps explored</p><div class="progress-track"><span style="width:${visited.size / 7 * 100}%"></span></div></div><div class="progress-lesson">${icon(completed ? 'check' : 'book')}<div><strong>Big-O Notation</strong><p>${completed ? 'Completed' : 'In progress'} · Foundations</p></div><span>${completed ? '100%' : `${Math.round(visited.size / 7 * 100)}%`}</span></div><button class="primary-button" data-action="continue">Continue learning ${icon('arrow')}</button><button class="text-button" data-action="reset-progress">Reset local progress</button>`;
  } else if (type === 'complete') {
    content.innerHTML = `<div class="result-icon">${icon('check')}</div><div class="dialog-kicker">LESSON COMPLETE</div><h2>Now you can see the bigger picture.</h2><p class="dialog-description">You explored how constant, logarithmic, linear, and quadratic work respond to growing input. Put that intuition to the test.</p><button class="primary-button" data-dialog="practice">Try a little practice ${icon('arrow')}</button><p class="fine-print">This release includes the complete Big-O lesson. Other course topics are upcoming, not available lessons.</p>`;
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
    if (step < 6) navigate(step + 1);
    else if (completed) openDialog('practice');
    else { completed = true; save('studio-complete', 'true'); renderSidebar(); render(); openDialog('complete'); }
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
  if (el.dataset.searchStep !== undefined) { dialog.close(); navigate(Number(el.dataset.searchStep)); }
  if (el.dataset.answer !== undefined && !quizAnswered) {
    quizAnswered = true;
    const answer = Number(el.dataset.answer);
    const q = questions[quizIndex];
    const correct = answer === q.answer;
    if (correct) quizScore++;
    dialog.querySelectorAll('[data-answer]').forEach(btn => {
      btn.disabled = true;
      if (Number(btn.dataset.answer) === q.answer) btn.classList.add('correct');
      else if (btn === el) btn.classList.add('incorrect');
    });
    dialog.querySelector('.quiz-feedback').innerHTML = `<strong>${correct ? 'Exactly right.' : 'Not quite. Here is the idea.'}</strong><p>${q.detail}</p>`;
    dialog.querySelector('.quiz-next').hidden = false;
  }
  if (el.dataset.action === 'next-question') { quizIndex++; quizAnswered = false; document.querySelector('#dialog-content').innerHTML = quizMarkup(); }
  if (el.dataset.action === 'restart-quiz') openDialog('practice');
  if (el.dataset.action === 'continue') dialog.close();
  if (el.dataset.action === 'reset-progress') {
    openDialog('reset-confirm');
    document.querySelector('#dialog-content').innerHTML = `<h2>Start fresh?</h2><p class="dialog-description">This clears your Big-O completion and explored steps on this device. Your theme and code language stay the same.</p><button class="primary-button" data-action="confirm-reset">Reset progress</button><button class="text-button" data-action="continue">Keep my progress</button>`;
  }
  if (el.dataset.action === 'confirm-reset') {
    completed = false; visited = new Set(); save('studio-complete', 'false'); save('studio-visited', '');
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
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'challenge-form') return;
  event.preventDefault();
  const value = Number(document.querySelector('#challenge-answer').value);
  document.querySelector('.challenge-feedback').innerHTML = value === 256
    ? '<strong>That is it! 16 × 16 = 256.</strong><p>Doubling the input quadrupled the work from 64 to 256.</p>'
    : '<strong>Try again. Think of a square.</strong><p>There are 16 visits for each of the 16 items. Multiply those two numbers.</p>';
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
window.addEventListener('hashchange', syncRoute);
renderSidebar();
syncRoute();
if (!storageAvailable) toast('Browser storage is unavailable. Progress may not persist.');
