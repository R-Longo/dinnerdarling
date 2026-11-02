(() => {
  'use strict';

  const KEY_FAV = 'dd.favorites.v1';
  const KEY_WEEK = 'dd.week.v1'; // legacy (read once for migration): single week { key, ids }
  const KEY_PLAN = 'dd.plan.v1'; // { "YYYY-MM-DD": recipeId } — one dinner per local date, never auto-deleted
  const KEY_QUEUE = 'dd.queue.v1'; // [recipeId, …] — Selected Dinners waiting to be given a date
  const KEY_MIG = 'dd.plan.migrated.v1';
  const KEY_VIEW = 'dd.calview.v1'; // last calendar view: week | 2weeks | month
  const KEY_SHOP = 'dd.shop.v1'; // { "YYYY-MM-DD" (Monday): [checked item keys] }
  const KEY_WEEKS = 'dd.weeks.v2'; // legacy (read once for migration): { Monday: [recipeId, …] } — never modified
  const Art = window.DDArt;

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pretty = (s) => s.replace(/-/g, ' ');
  const MEALS = [['bowls', 'Bowls'], ['pasta', 'Pasta'], ['soup', 'Soup'], ['skillet', 'Skillet'], ['sheet-pan', 'Sheet Pan'], ['salad', 'Salad'], ['tacos', 'Tacos'], ['flatbread-pizza', 'Flatbread/Pizza']];
  const mealLabel = (m) => (MEALS.find(([k]) => k === m) || [0, cap(pretty(m))])[1];
  const uniq = (a) => [...new Set(a)];

  function read(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }

  const pad2 = (n) => String(n).padStart(2, '0');
  const dkey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // local date, YYYY-MM-DD
  const pdate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (k, n) => { const d = pdate(k); d.setDate(d.getDate() + n); return dkey(d); };
  const todayKey = () => dkey(new Date());
  function weekKey(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back to Monday
    return dkey(x);
  }
  const weekOf = (k) => weekKey(pdate(k));
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fmtShort = (k) => pdate(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmtDay = (k) => pdate(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtRange = (a, b) => `${fmtShort(a)} – ${fmtShort(b)}, ${pdate(b).getFullYear()}`;
  const monthName = (k) => pdate(k).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  /* ---------- state ---------- */
  const emptyFilters = () => ({ q: '', protein: null, meal: null, level: null, quick: false, favs: false });
  const state = {
    recipes: [], byId: {},
    favorites: new Set(read(KEY_FAV, [])),
    plan: {},                          // { 'YYYY-MM-DD': recipeId }
    queue: [],                         // Selected Dinners (recipe ids, not yet on a date)
    view: { mode: 'week', anchor: weekKey(), sel: weekKey() }, // sel = the calendar week Shopping reads
    selDay: null,                      // month view: the tapped day
    picking: null,                     // { date, replace } while choosing from the Recipe Box
    dlg: null,
    today: todayKey(),
    filters: emptyFilters(),
    tab: 'home', canBack: false,
    openId: null, detailTab: 'overview',
  };

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const isDate = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  function readLegacyWeeks() {
    let weeks = read(KEY_WEEKS, null);
    if (!isObj(weeks)) {
      weeks = {};
      const legacy = read(KEY_WEEK, null);
      if (legacy && typeof legacy.key === 'string' && Array.isArray(legacy.ids) && legacy.ids.length) weeks[legacy.key] = legacy.ids;
    }
    return weeks;
  }
  const savePlan = () => write(KEY_PLAN, state.plan);
  const saveQueue = () => write(KEY_QUEUE, state.queue);
  // First run only (guarded by KEY_MIG, so refreshing never duplicates anything): copy old picks for the current and future
  // weeks into Selected Dinners, because the old data never said which day. Past weeks are NOT given invented dates — they stay in
  // the untouched dd.weeks.v2 record and are listed read-only under "Earlier selections".
  function migrate() {
    if (read(KEY_MIG, false)) return;
    const weeks = readLegacyWeeks();
    const thisWeek = weekKey();
    for (const key of Object.keys(weeks).filter(isDate).sort()) {
      if (key < thisWeek) continue;
      for (const id of (Array.isArray(weeks[key]) ? weeks[key] : [])) if (typeof id === 'string') addToQueue(id);
    }
    saveQueue();
    write(KEY_MIG, true);
  }
  function earlierSelections() {
    const weeks = readLegacyWeeks(), thisWeek = weekKey(pdate(state.today));
    return Object.keys(weeks).filter((k) => isDate(k) && k < thisWeek).sort().reverse()
      .map((k) => [k, (Array.isArray(weeks[k]) ? weeks[k] : []).filter((id) => state.byId[id])]).filter(([, ids]) => ids.length);
  }
  function loadPlan() {
    const p = read(KEY_PLAN, {});
    state.plan = {};
    if (isObj(p)) for (const k of Object.keys(p)) if (isDate(k) && typeof p[k] === 'string') state.plan[k] = p[k];
    const q = read(KEY_QUEUE, []);
    state.queue = Array.isArray(q) ? q.filter((id) => typeof id === 'string') : [];
    migrate();
    const mode = read(KEY_VIEW, 'week');
    if (['week', '2weeks', 'month'].includes(mode)) state.view.mode = mode;
  }
  const queueIds = () => state.queue.filter((id) => state.byId[id]);
  const planned = (date) => (state.plan[date] && state.byId[state.plan[date]] ? state.plan[date] : null);
  function plannedInWeek(weekStart) {
    const out = [];
    for (let i = 0; i < 7; i++) { const d = addDays(weekStart, i), id = planned(d); if (id) out.push({ date: d, id }); }
    return out;
  }
  const removeFromQueue = (id) => { const i = state.queue.indexOf(id); if (i >= 0) state.queue.splice(i, 1); };
  const addToQueue = (id) => { if (!state.queue.includes(id)) state.queue.push(id); };
  // Called when the app becomes visible again: if the date has rolled over, refresh "today" and follow the new week.
  function checkToday() {
    const t = todayKey();
    if (t === state.today) return;
    const wasCurrent = state.view.sel === weekOf(state.today);
    state.today = t;
    if (wasCurrent) setSel(weekOf(t));
    afterPlanChange();
  }
  function setSel(key) { state.view.sel = key; state.view.anchor = key; }
  const saveFavs = () => write(KEY_FAV, [...state.favorites]);

  /* ---------- small UI icons ---------- */
  const UI = {
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    sparkle: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/><path d="M19 3v4M17 5h4"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    serves: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3.5 4-3.5 7 0 1.5 1 2.5 3.5 3"/>',
    budget: '<path d="M12 3v18M16.5 7.5C15.5 6 14 5.5 12 5.5c-2.5 0-4 1.2-4 3 0 4.5 8.5 2 8.5 6.5 0 1.8-1.7 3-4.5 3-2.2 0-3.8-.7-4.8-2.3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    pot: '<path d="M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M3 10h2M19 10h2M9 6c0-1.5 1-1.5 1-3M14 6c0-1.5 1-1.5 1-3"/>',
  };
  const ui = (k, cls) => `<svg viewBox="0 0 24 24" class="${cls || ''}" aria-hidden="true">${UI[k]}</svg>`;

  /* ---------- formatting ---------- */
  const FRACTIONS = [[0.125, '⅛'], [0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.66, '⅔'], [0.67, '⅔'], [0.75, '¾']];
  function fmtQty(q) {
    if (q === '' || q == null) return '';
    const whole = Math.floor(q + 0.02);
    const frac = q - whole;
    if (Math.abs(frac) < 0.02) return String(whole);
    const hit = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.02);
    return hit ? (whole ? String(whole) : '') + hit[1] : String(Math.round(q * 100) / 100);
  }
  function ingredientRow(i) {
    if (i.unit === 'pinch') return { amt: 'to taste', soft: true };
    if ((i.quantity === '' || i.quantity == null) && !i.unit) return { amt: 'as needed', soft: true };
    return { amt: `${fmtQty(i.quantity)} ${i.unit || ''}`.trim(), soft: false };
  }
  const meta = (r) => `${cap(r.difficulty)} · ${r.cost} · Serves ${r.servings}`;
  const isTreat = (r) => r.tags.includes('treat-night');
  const kicker = (r) => `<span class="kicker">${Art.protein(r.protein[0])}${esc(r.protein[0])} · ${r.timeMinutes} min</span>`;
  const pills = (r) => {
    const list = r.mealType.slice(0, 2).map((m) => `<span class="pill">${esc(mealLabel(m))}</span>`);
    if (isTreat(r)) list.unshift('<span class="pill treat">Treat night</span>');
    return `<span class="pills">${list.join('')}</span>`;
  };

  /* ---------- search + filtering ---------- */
  function haystack(r) {
    if (!r._hay) {
      r._hay = [r.name, r.description, ...r.protein, ...r.mealType, ...r.mealType.map(pretty),
        ...r.tags, ...r.tags.map(pretty), r.difficulty, ...r.ingredients.map((i) => i.item)].join(' ').toLowerCase();
    }
    return r._hay;
  }
  function parseQuery(q) {
    let text = q.toLowerCase();
    let maxTime = null;
    const m = text.match(/(?:under|less than|within)\s+(\d+)\s*(?:min\w*)?/);
    if (m) { maxTime = Number(m[1]); text = text.replace(m[0], ' '); }
    const tokens = text.split(/[\s+,&]+/).filter((t) => t && t !== 'and' && t !== 'min' && t !== 'minutes');
    return { tokens, maxTime };
  }
  function matches(r) {
    const f = state.filters;
    if (f.protein && !r.protein.includes(f.protein)) return false;
    if (f.meal && !r.mealType.includes(f.meal)) return false;
    if (f.level && r.difficulty !== f.level) return false;
    if (f.quick && r.timeMinutes > 30) return false;
    if (f.favs && !state.favorites.has(r.id)) return false;
    const { tokens, maxTime } = parseQuery(f.q);
    if (maxTime && r.timeMinutes > maxTime) return false;
    const hay = haystack(r);
    return tokens.every((t) => hay.includes(t));
  }
  const filtersActive = () => { const f = state.filters; return !!(f.q.trim() || f.protein || f.meal || f.level || f.quick || f.favs); };

  /* ---------- rendering: filters ---------- */
  function renderFilters() {
    const f = state.filters;
    const q = (k, label, icon, on) => `<button class="qbtn" data-quick="${k}" data-k="${k}" aria-pressed="${on}">${ui(icon)}${label}</button>`;
    $('#quick').innerHTML = q('quick', 'Under 30', 'bolt', f.quick) + q('easy', 'Easy', 'sparkle', f.level === 'easy') + q('favs', 'Favorites', 'heart', f.favs);

    const proteins = ['chicken', 'salmon', 'fish', 'turkey', 'pork', 'beef', 'steak', 'vegetarian'];
    $('#proteins').innerHTML = proteins.map((p) =>
      `<button class="pbtn" data-protein="${esc(p)}" data-p="${esc(p)}" aria-pressed="${f.protein === p}"><span class="pt">${Art.protein(p)}</span>${esc(cap(p))}</button>`).join('');

    $('#meals').innerHTML = MEALS.map(([m, label]) =>
      `<button class="chip" data-meal="${esc(m)}" aria-pressed="${f.meal === m}">${Art.mealType(m)}${esc(label)}</button>`).join('');
    const levels = ['easy', 'medium', 'hard'];
    $('#levels').innerHTML = levels.map((l) =>
      `<button class="chip noicon" data-level="${esc(l)}" aria-pressed="${f.level === l}">${esc(cap(l))}</button>`).join('');
  }

  /* ---------- rendering: cards ---------- */
  function favButton(id) {
    const on = state.favorites.has(id);
    return `<button class="act fav" data-fav="${esc(id)}" aria-pressed="${on}"><span class="ico" aria-hidden="true">${on ? '♥' : '♡'}</span><span class="lbl">${on ? 'Saved' : 'Save'}</span></button>`;
  }
  function heartButton(id) {
    const on = state.favorites.has(id);
    return `<button class="heart" data-fav="${esc(id)}" aria-pressed="${on}" aria-label="Favorite"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg></button>`;
  }
  // "Add to Week" puts a recipe in Selected Dinners. While choosing a dinner for a specific day it becomes "Pick for <day>".
  function wkState(id, mini) {
    if (state.picking) {
      const d = state.picking.date;
      return { on: false, ico: '＋', lbl: mini ? `Pick ${DOW[(pdate(d).getDay() + 6) % 7]}` : `Pick for ${fmtDay(d)}` };
    }
    const on = state.queue.includes(id);
    return { on, ico: on ? '✓' : '＋', lbl: mini ? (on ? 'Selected' : 'Add to Week') : (on ? 'In Selected Dinners' : 'Add to Week') };
  }
  function weekButton(id, mini) {
    const w = wkState(id, mini);
    return `<button class="act wk${mini ? ' mini' : ''}" data-week="${esc(id)}" aria-pressed="${w.on}"><span class="ico" aria-hidden="true">${w.ico}</span><span class="lbl">${esc(w.lbl)}</span></button>`;
  }
  function card(r) {
    const main = cap(r.protein[0]);
    const mealPill = r.mealType.length ? `<span class="pill">${esc(mealLabel(r.mealType[0]))}</span>` : '';
    return `
      <article class="card">
        <button class="card-open" data-open="${esc(r.id)}" aria-label="Open ${esc(r.name)}"></button>
        <span class="art">${Art.dish(r)}</span>
        <div class="card-body">
          <h3 class="card-title">${esc(r.name)}</h3>
          <p class="cmeta">${Art.protein(r.protein[0])}<span>${esc(main)} · ${r.timeMinutes} min · ${esc(cap(r.difficulty))} · ${esc(r.cost)}</span></p>
          <p class="card-desc">${esc(r.description)}</p>
          <div class="card-foot">${mealPill}${weekButton(r.id, true)}</div>
        </div>
        ${heartButton(r.id)}
      </article>`;
  }

  function renderList() {
    const items = state.recipes.filter(matches);
    const n = items.length;
    $('#count').innerHTML = `<span>${n} ${n === 1 ? 'recipe' : 'recipes'}</span>` + (filtersActive() ? '<button class="linkbtn" data-clear>Clear all</button>' : '');
    $('#list').innerHTML = n
      ? items.map(card).join('') + (filtersActive() ? '' : Art.decor('listEnd', 'decor list-end'))
      : `<div class="empty">${Art.decor('noResults', 'decor')}<p>${state.filters.favs && !state.favorites.size ? 'No favorites yet. Tap Save on any recipe to keep it here.' : 'No dinners match. Try removing a filter.'}</p>${filtersActive() ? '<button class="linkbtn" data-clear>Clear all</button>' : ''}</div>`;
  }

  /* ---------- rendering: This Week + Favorites ---------- */
  const ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const ICON_POT = '<svg viewBox="0 0 24 24" class="pot" aria-hidden="true"><path d="M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M3 10h2M19 10h2M9 6c0-1.5 1-1.5 1-3M14 6c0-1.5 1-1.5 1-3"/></svg>';

  function mealCard(date, id) {
    const r = state.byId[id];
    return `<div class="meal" draggable="true" data-drag="plan:${date}">
      <button class="meal-open" data-open="${esc(id)}" aria-label="Open ${esc(r.name)}">
        <span class="art">${Art.dish(r)}</span>
        <span class="meal-text"><span class="meal-name">${esc(r.name)}</span><span class="meal-meta">${r.timeMinutes} min</span></span>
      </button>
      <button class="meal-menu" data-meal-menu="${date}" aria-label="Options for ${esc(r.name)}, ${esc(fmtDay(date))}">⋯</button>
    </div>`;
  }
  const addBtn = (date) => `<button class="add-day" data-add-day="${date}" aria-label="Add dinner on ${esc(fmtDay(date))}"><span class="plus" aria-hidden="true">＋</span><span>Add dinner</span></button>`;
  const dayBody = (date) => (planned(date) ? mealCard(date, planned(date)) : addBtn(date));

  function dayEl(date) {
    const idx = (pdate(date).getDay() + 6) % 7;
    const cls = date === state.today ? ' today' : date < state.today ? ' past' : '';
    return `<div class="day${cls}" data-drop="${date}">
      <div class="day-label"><b>${DOW[idx]}</b><span>${esc(fmtShort(date))}</span></div>
      <div class="day-body">${dayBody(date)}</div>
    </div>`;
  }
  const weekGrid = (start) => `<div class="wk-grid" role="group" aria-label="Week of ${esc(fmtShort(start))}">${Array.from({ length: 7 }, (_, i) => dayEl(addDays(start, i))).join('')}</div>`;

  function monthRange(anchor) {
    const first = new Date(pdate(anchor).getFullYear(), pdate(anchor).getMonth(), 1, 12);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
    return { first: dkey(first), last: dkey(last), start: weekKey(first), end: addDays(weekKey(last), 6) };
  }
  function monthGrid(anchor) {
    const { first, last, start, end } = monthRange(anchor);
    if (!state.selDay || state.selDay < start || state.selDay > end) state.selDay = (state.today >= first && state.today <= last) ? state.today : first;
    const cells = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const id = planned(d);
      const cls = [d < first || d > last ? 'out' : '', d === state.today ? 'today' : '', d === state.selDay ? 'sel' : '', id ? 'has' : ''].filter(Boolean).join(' ');
      cells.push(`<button class="mcell ${cls}" data-day-select="${d}" data-drop="${d}" aria-pressed="${d === state.selDay}" aria-label="${esc(fmtDay(d))}${id ? ', ' + esc(state.byId[id].name) : ', no dinner'}">
        <span class="mnum">${pdate(d).getDate()}</span><span class="mname">${id ? esc(state.byId[id].name) : ''}</span><span class="mdot"></span></button>`);
    }
    const sel = state.selDay;
    return `<div class="mo-head" aria-hidden="true">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="mo-grid">${cells.join('')}</div>
      <div class="day-panel" data-drop="${sel}">
        <h3>${esc(pdate(sel).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))}</h3>
        <div class="day-body">${dayBody(sel)}</div>
      </div>`;
  }

  function calendarState() {
    const { mode, anchor } = state.view;
    if (mode === 'month') {
      const r = monthRange(anchor);
      return { range: monthName(r.first), from: r.first, to: r.last, body: monthGrid(anchor), sub: monthName(r.first) };
    }
    const days = mode === '2weeks' ? 14 : 7;
    const to = addDays(anchor, days - 1);
    const body = mode === '2weeks'
      ? `<h3 class="wk-sub">Week of ${esc(fmtShort(anchor))}</h3>${weekGrid(anchor)}<h3 class="wk-sub">Week of ${esc(fmtShort(addDays(anchor, 7)))}</h3>${weekGrid(addDays(anchor, 7))}`
      : weekGrid(anchor);
    return { range: fmtRange(anchor, to), from: anchor, to, body, sub: mode === 'week' ? `Week of ${fmtShort(anchor)}, ${pdate(anchor).getFullYear()}` : fmtRange(anchor, to) };
  }
  function countPlanned(from, to) {
    let n = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) if (planned(d)) n++;
    return n;
  }

  function queueItem(id) {
    const r = state.byId[id];
    return `<div class="qitem" draggable="true" data-drag="queue:${esc(id)}">
      <button class="q-open" data-open="${esc(id)}" aria-label="Open ${esc(r.name)}"><span class="art">${Art.dish(r)}</span><span class="q-name">${esc(r.name)}</span></button>
      <button class="q-assign" data-q-assign="${esc(id)}" aria-label="Assign ${esc(r.name)} to a day">Assign</button>
      <button class="q-remove" data-q-remove="${esc(id)}" aria-label="Remove ${esc(r.name)} from Selected Dinners">✕</button>
    </div>`;
  }
  function renderWeek() {
    const c = calendarState();
    const n = countPlanned(c.from, c.to);
    const q = queueIds();
    const mode = state.view.mode;
    const seg = [['week', '1 Week'], ['2weeks', '2 Weeks'], ['month', 'Month']].map(([k, l]) => `<button data-view-mode="${k}" aria-pressed="${mode === k}">${l}</button>`).join('');
    $('#view-week').innerHTML = `
      <div class="plan-head"><h2>Plan This Week</h2><p>${esc(c.sub)} · ${n} ${n === 1 ? 'dinner' : 'dinners'} planned</p></div>
      <div class="cal">
        ${Art.decor('weekRosemary', 'rosemary-peek')}
        <div class="cal-bar">
          <div class="cal-nav">
            <button class="navbtn" data-cal-nav="-1" aria-label="Previous ${mode === 'month' ? 'month' : mode === '2weeks' ? 'two weeks' : 'week'}">${ICON_PREV}</button>
            <div class="cal-range" aria-live="polite">${esc(c.range)}</div>
            <button class="navbtn" data-cal-nav="1" aria-label="Next ${mode === 'month' ? 'month' : mode === '2weeks' ? 'two weeks' : 'week'}">${ICON_NEXT}</button>
          </div>
          <div class="cal-ctl">
            <div class="seg" role="group" aria-label="Calendar view">${seg}</div>
            <button class="todaybtn" data-cal-today>Today</button>
          </div>
        </div>
        ${c.body}
      </div>
      <section class="queue" aria-labelledby="qh">
        <h3 id="qh">Selected Dinners</h3>
        <p class="qsub">Drag a recipe to a day on the calendar, or tap Assign.</p>
        ${q.length
          ? `<div class="qlist">${q.map(queueItem).join('')}</div>`
          : `<div class="q-empty">${ICON_POT}<p><b>No dinners selected yet.</b><br>Browse recipes and add some to get started!</p><button class="linkbtn" data-go="recipes">Browse recipes</button></div>`}
      </section>
      ${earlierBlock()}`;
  }
  function earlierBlock() {
    const e = earlierSelections();
    if (!e.length) return '';
    return `<details class="earlier"><summary>Earlier selections (${e.reduce((n, [, ids]) => n + ids.length, 0)})</summary>
      <p class="qsub">Dinners you picked in past weeks, before the calendar. They weren’t tied to a day, so they’re listed here as they were saved.</p>
      ${e.map(([k, ids]) => `<h4>Week of ${esc(fmtShort(k))}, ${pdate(k).getFullYear()}</h4><ul class="dlg-list">${ids.map((id) => `<li class="qitem"><button class="q-open" data-open="${esc(id)}"><span class="art">${Art.dish(state.byId[id])}</span><span class="q-name">${esc(state.byId[id].name)}</span></button><button class="q-assign" data-q-add="${esc(id)}">Add to Selected</button></li>`).join('')}</ul>`).join('')}
    </details>`;
  }

  /* ---------- dialogs (assign, move, replace) ---------- */
  function openDlg(title, body, ctx) {
    closeDlg();
    state.dlg = ctx || {};
    const el = document.createElement('div');
    el.className = 'dlg-back';
    el.id = 'dlg';
    el.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="dlg-head"><h3>${esc(title)}</h3><button class="dlg-x" data-dlg-close aria-label="Close">✕</button></div>
      <div class="dlg-body">${body}</div></div>`;
    document.body.appendChild(el);
    document.body.classList.add('dlg-open');
    const first = $('.dlg-body button, .dlg-body input', el);
    if (first) first.focus({ preventScroll: true });
  }
  function closeDlg() {
    const el = $('#dlg');
    if (el) el.remove();
    document.body.classList.remove('dlg-open');
    state.dlg = null;
  }
  const rowArt = (r) => `<span class="art">${Art.dish(r)}</span>`;

  function addDayDlg(date) {
    const q = queueIds();
    const body = (q.length
      ? `<h4>From Selected Dinners</h4><ul class="dlg-list">${q.map((id) => `<li><button class="dlg-row" data-place-queue="${esc(id)}">${rowArt(state.byId[id])}<span>${esc(state.byId[id].name)}</span></button></li>`).join('')}</ul>`
      : '') + `<button class="btn" data-pick-recipes>Choose from Recipe Box</button>`;
    openDlg(`Dinner for ${fmtDay(date)}`, body, { kind: 'add', date });
  }
  function mealMenuDlg(date) {
    const id = planned(date);
    if (!id) return;
    openDlg(state.byId[id].name, `<div class="dlg-stack">
      <button class="btn ghost" data-menu="open">Open recipe</button>
      <button class="btn ghost" data-menu="move">Move to another day</button>
      <button class="btn ghost" data-menu="replace">Replace with another recipe</button>
      <button class="btn ghost" data-menu="unschedule">Back to Selected Dinners</button>
      <button class="btn danger" data-menu="remove">Remove from this day</button></div>`, { kind: 'menu', date, id });
  }
  function chooseDayDlg(src) {
    const start = state.view.sel;
    const group = (w) => `<h4>Week of ${esc(fmtShort(w))}</h4><ul class="dlg-list">${Array.from({ length: 7 }, (_, i) => addDays(w, i)).map((d) => {
      const id = planned(d);
      const self = src.type === 'plan' && src.date === d;
      return `<li><button class="dlg-row" data-place-day="${d}"${self ? ' disabled' : ''}><b>${esc(fmtDay(d))}</b><span class="sub">${self ? 'Current day' : id ? esc(state.byId[id].name) : 'Open'}</span></button></li>`;
    }).join('')}</ul>`;
    openDlg('Choose a day', group(start) + group(addDays(start, 7)) + `<label class="dlg-date"><span>Another date</span><input type="date" id="dlg-date"></label><button class="btn ghost" data-place-date>Use this date</button>`, { kind: 'choose', src });
  }
  function askReplace(date, id, src) {
    const ex = state.plan[date];
    const exName = state.byId[ex].name, name = state.byId[id].name;
    const swap = src.type === 'plan';
    openDlg(swap ? 'Swap dinners?' : 'Replace dinner?',
      `<p class="dlg-text">${esc(fmtDay(date))} already has <b>${esc(exName)}</b>.${swap
        ? ` Swap it with <b>${esc(name)}</b>?`
        : ` Replace it with <b>${esc(name)}</b>? ${esc(exName)} will go back to Selected Dinners.`}</p>
       <div class="dlg-stack"><button class="btn" data-confirm="yes">${swap ? 'Swap' : 'Replace'}</button><button class="btn ghost" data-dlg-close>Cancel</button></div>`,
      { kind: 'confirm', date, id, src });
  }

  // The one place a dinner lands on a date. src: {type:'queue'} | {type:'plan', date} | {type:'new'}
  function place(date, id, src, opts = {}) {
    if (src.type === 'plan' && src.date === date) { closeDlg(); return; }
    const ex = planned(date);
    if (ex && !opts.confirmed && !opts.discard) { askReplace(date, id, src); return; }
    closeDlg();
    if (src.type === 'plan') delete state.plan[src.date];
    removeFromQueue(id);
    if (ex) { if (opts.confirmed && src.type === 'plan') state.plan[src.date] = ex; else if (!opts.discard) addToQueue(ex); }
    state.plan[date] = id;
    savePlan(); saveQueue();
    const wasPicking = !!state.picking;
    state.picking = null;
    renderPick();
    afterPlanChange();
    toast(`Planned for ${fmtDay(date)}`);
    if (wasPicking) { state.canBack = false; location.hash = '#/week'; }
  }
  function unplan(date, toQueue) {
    const id = state.plan[date];
    if (!id) return;
    delete state.plan[date];
    if (toQueue) addToQueue(id);
    savePlan(); saveQueue();
    closeDlg();
    afterPlanChange();
    toast(toQueue ? 'Back in Selected Dinners' : 'Removed from this day');
  }
  function startPicking(date, replace) {
    closeDlg();
    state.picking = { date, replace: !!replace };
    state.canBack = false;
    renderPick();
    renderList();
    location.hash = '#/recipes';
  }
  function stopPicking() {
    state.picking = null;
    renderPick();
    renderList();
    location.hash = '#/week';
  }
  function renderPick() {
    const el = $('#pickbar');
    el.innerHTML = state.picking
      ? `<div class="pickbar" role="status"><span>${state.picking.replace ? 'Replacing' : 'Choosing'} dinner for <b>${esc(fmtDay(state.picking.date))}</b></span><button class="linkbtn" data-pick-cancel>Cancel</button></div>`
      : '';
    $$('[data-week]').forEach((b) => syncButtons(b.dataset.week));
  }

  function renderFavorites() {
    const items = state.recipes.filter((r) => state.favorites.has(r.id));
    $('#view-favorites').innerHTML = `
      <div class="view-head has-mascot"><div class="head-text"><h2>Favorites</h2><p>${items.length ? 'Dinners you saved.' : ''}</p></div>${Art.decor('favoritesMascot', 'head-mascot basil')}</div>` +
      (items.length
        ? `<div class="list">${items.map(card).join('')}</div>`
        : `<div class="empty"><p>No favorites yet. Tap Save on any recipe to keep it here.</p><button class="linkbtn" data-go="recipes">Browse recipes</button></div>`);
  }

  /* ---------- rendering: Home ---------- */
  const HOME_ICON = {
    week: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 14l2 2 4-4"/>',
    recipes: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.500 5.5-1.500 8-.5V19c-2.500-1-5.500-1-8 .5-2.500-1.500-5.500-1.500-8-.5z"/><path d="M12 6v13.500"/>',
    shopping: '<path d="M3 4h2.500l2 11h10l2-8H7"/><circle cx="9" cy="19" r="1.300"/><circle cx="17" cy="19" r="1.300"/>',
    favorites: UI.heart,
  };
  const TILES = [
    ['week', 'Plan This Week', 'Choose your dinners', 'plan'],
    ['recipes', 'Browse Recipes', 'Find your next favorite', 'browse'],
    ['shopping', 'Shopping List', 'Everything you need for this week', 'shop'],
    ['favorites', 'Favorites', 'Save the ones you love', 'fav'],
  ];
  function renderHome() {
    const wk = weekKey(pdate(state.today));
    const n = plannedInWeek(wk).length;
    const waiting = queueIds().length;
    const say = n === 0 ? 'What sounds good this week?' : n === 1 ? 'Nice start — 1 dinner planned.' : n === 2 ? 'Looking good — 2 dinners planned.' : 'Dinner’s decided.';
    const pips = Array.from({ length: 7 }, (_, i) => `<i class="${planned(addDays(wk, i)) ? 'on' : ''}"></i>`).join('');
    $('#view-home').innerHTML = `
      <header class="home-head">
        <h1 class="wordmark">Dinner Darling</h1>
        <p class="tagline">Dinner, decided.</p>
      </header>
      <div class="home-hero">
        ${Art.mascot('home', 'tilly')}
        <p class="home-say" role="status">${esc(say)}</p>
      </div>
      <a class="week-status" href="#/week">
        <span class="ws-text"><b>This Week</b><span>${n} ${n === 1 ? 'dinner' : 'dinners'} planned${waiting ? ` · ${waiting} waiting` : ''}</span></span>
        <span class="pips" aria-hidden="true">${pips}</span>
      </a>
      <nav class="tiles" aria-label="Main">
        ${TILES.map(([k, title, sub, cls]) => `
          <a class="tile ${cls}" href="${tabHash(k)}">
            <svg viewBox="0 0 24 24" class="tile-ico" aria-hidden="true">${HOME_ICON[k]}</svg>
            <span class="tile-title">${esc(title)}</span>
            <span class="tile-sub">${esc(sub)}</span>
            <svg viewBox="0 0 24 24" class="tile-go" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
          </a>`).join('')}
      </nav>`;
  }

  /* ---------- Shopping list: built from the recipes in This Week ---------- */
  const NAME_ALIAS = {
    'ground cumin': 'cumin', 'garlic clove': 'garlic cloves', 'garlic': 'garlic cloves', 'carrot': 'carrots',
    'boneless chicken breast': 'chicken breast', 'boneless chicken breasts': 'chicken breast', 'chicken breasts': 'chicken breast',
    'salmon': 'salmon fillets', 'celery ribs': 'celery', 'celery stalks': 'celery', 'celery rib': 'celery', 'flour': 'all-purpose flour',
  };
  const normName = (item) => {
    let n = String(item).toLowerCase().replace(/\([^)]*\)/g, ' ').split(',')[0].replace(/\s+/g, ' ').trim();
    return NAME_ALIAS[n] || n;
  };
  const STAPLE = [/^(kosher |flaky |sea |table )?salt( and (black )?pepper)?$/, /^(ground )?(black )?pepper$/, /^(extra[- ]virgin )?(olive|cooking|vegetable|avocado|canola|neutral) oil$/, /^water$/, /^(granulated )?sugar$/, /^all-purpose flour$/];
  const isStaple = (n) => STAPLE.some((re) => re.test(n));
  const VOL = { tsp: 1, tbsp: 3, cup: 48, cups: 48 };
  const WT = { oz: 1, lb: 16, lbs: 16 };
  function unitFamily(u) {
    const x = String(u || '').toLowerCase().trim();
    if (VOL[x]) return 'vol';
    if (WT[x]) return 'wt';
    return x || 'each';
  }
  const cleanFrac = (q) => {
    const f = q - Math.floor(q + 0.02);
    return Math.abs(f) < 0.02 || FRACTIONS.some(([v]) => Math.abs(v - f) < 0.02);
  };
  function fmtAmount(fam, total, unit) {
    if (fam === 'pinch') return 'to taste';
    if (!total) return 'as needed';
    if (fam === 'vol') {
      for (const [div, label, min] of [[48, 'cup', 12], [3, 'tbsp', 3], [1, 'tsp', 0]]) {
        const q = total / div;
        if (total >= min && (cleanFrac(q) || (div === 1 && total < 3))) return `${fmtQty(q)} ${label}${label === 'cup' && q > 1.02 ? 's' : ''}`;
      }
    }
    if (fam === 'vol' && total >= 3) { const t = Math.round(total / 3 * 4) / 4; return `${fmtQty(t)} tbsp`; }
    if (fam === 'wt') {
      if (total >= 16 && cleanFrac(total / 16)) return `${fmtQty(total / 16)} lb`;
      return `${fmtQty(total)} oz`;
    }
    return `${fmtQty(total)} ${fam === 'each' ? '' : unit}`.trim();
  }
  const CATS = [['produce', 'Produce'], ['meat', 'Meat & Seafood'], ['dairy', 'Dairy & Refrigerated'], ['bakery', 'Bakery'], ['pantry', 'Pantry'], ['frozen', 'Frozen'], ['other', 'Other']];
  function catOf(aisle, name) {
    if (/mayo/.test(name)) return 'pantry';
    const a = String(aisle || '').toLowerCase();
    if (/produce/.test(a)) return 'produce';
    if (/meat|seafood/.test(a)) return 'meat';
    if (/refrig|dairy|egg/.test(a)) return 'dairy';
    if (/bakery|bread/.test(a)) return 'bakery';
    if (/frozen/.test(a)) return 'frozen';
    if (/pantry|dry|canned|spice/.test(a)) return 'pantry';
    return 'other';
  }
  function buildShopping() {
    const map = new Map();
    for (const { id } of plannedInWeek(state.view.sel)) {
      const r = state.byId[id];
      for (const i of r.ingredients) {
        const name = normName(i.item);
        const unit = String(i.unit || '').toLowerCase().trim();
        const fam = unit === 'pinch' ? 'pinch' : unitFamily(unit);
        const key = `${name}|${fam === 'vol' || fam === 'wt' || fam === 'each' || fam === 'pinch' ? fam : unit}`;
        const mult = fam === 'vol' ? VOL[unit] : fam === 'wt' ? WT[unit] : 1;
        let e = map.get(key);
        if (!e) { e = { key, name, fam: key.split('|')[1], unit, total: 0, cat: catOf(i.aisle, name), from: [] }; map.set(key, e); }
        let q = Number(i.quantity) || 0;
        if (Math.abs(q % 1 - 1 / 3) < 0.01) q = Math.floor(q) + 1 / 3; else if (Math.abs(q % 1 - 2 / 3) < 0.01) q = Math.floor(q) + 2 / 3;
        e.total += q * mult;
        if (!e.from.includes(r.name)) e.from.push(r.name);
      }
    }
    const items = [...map.values()].map((e) => ({ ...e, amt: fmtAmount(e.fam, e.total, e.unit), staple: isStaple(e.name) }));
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }
  const checkedSet = () => new Set(((read(KEY_SHOP, {}) || {})[state.view.sel]) || []);
  function toggleShop(key, on) {
    const set = checkedSet();
    on ? set.add(key) : set.delete(key);
    const all = read(KEY_SHOP, {}) || {};
    all[state.view.sel] = [...set];
    write(KEY_SHOP, all);
    renderShopping();
  }
  function uncheckAll() { const all = read(KEY_SHOP, {}) || {}; delete all[state.view.sel]; write(KEY_SHOP, all); renderShopping(); }
  function shopRow(it, done) {
    return `<li class="shop-row${done.has(it.key) ? ' done' : ''}"><label>
        <input type="checkbox" data-shop="${esc(it.key)}"${done.has(it.key) ? ' checked' : ''}>
        <span class="box" aria-hidden="true"></span>
        <span class="shop-main"><span class="shop-name">${esc(cap(it.name))}</span><small>for ${esc(it.from.join(', '))}</small></span>
        <span class="shop-amt${it.amt === 'to taste' || it.amt === 'as needed' ? ' soft' : ''}">${esc(it.amt)}</span>
      </label></li>`;
  }
  function renderShopping() {
    const view = $('#view-shopping');
    const wk = state.view.sel;
    const n = plannedInWeek(wk).length;
    const waiting = queueIds().length;
    const nav = `<div class="shop-week"><button class="navbtn" data-shop-week="-1" aria-label="Previous week">${ICON_PREV}</button><span class="sw-range"><b>${esc(fmtDay(wk))} – ${esc(fmtDay(addDays(wk, 6)))}, ${pdate(wk).getFullYear()}</b>${wk === weekKey(pdate(state.today)) ? '<small>This week</small>' : '<button class="linkbtn" data-shop-today>Back to this week</button>'}</span><button class="navbtn" data-shop-week="1" aria-label="Next week">${ICON_NEXT}</button></div>`;
    const hint = waiting ? `<p class="shop-hint">${waiting} selected ${waiting === 1 ? 'dinner isn’t' : 'dinners aren’t'} on the calendar yet, so ${waiting === 1 ? 'it’s' : 'they’re'} not on this list.</p>` : '';
    if (!n) {
      view.innerHTML = `
        <div class="view-head has-mascot"><div class="head-text"><h2>Shopping List</h2></div>${Art.decor('shoppingMascot', 'head-mascot ollie')}</div>${nav}
        <p class="shop-note">No dinners are planned for these dates yet. Plan some and everything you need shows up here.</p>${hint}
        <div class="empty"><button class="linkbtn" data-go="week">Plan This Week</button></div>`;
      return;
    }
    const items = buildShopping();
    const done = checkedSet();
    const buy = items.filter((i) => !i.staple);
    const staples = items.filter((i) => i.staple);
    const groups = CATS.map(([k, label]) => [label, buy.filter((i) => i.cat === k)]).filter(([, l]) => l.length);
    const anyDone = items.some((i) => done.has(i.key));
    view.innerHTML = `
      <div class="view-head has-mascot"><div class="head-text"><h2>Shopping List</h2></div>${Art.decor('shoppingMascot', 'head-mascot ollie')}</div>${nav}
      <p class="shop-note">Covers the ${n} ${n === 1 ? 'dinner' : 'dinners'} planned for these seven days.${anyDone ? ' <button class="linkbtn" data-uncheck>Uncheck all</button>' : ''}</p>${hint}
      ${groups.map(([label, list]) => `<section class="shop-group"><h3>${esc(label)}</h3><ul class="shop-list">${list.map((i) => shopRow(i, done)).join('')}</ul></section>`).join('')}
      ${staples.length ? `<details class="shop-group staples"><summary>Probably in your pantry (${staples.length})</summary><ul class="shop-list">${staples.map((i) => shopRow(i, done)).join('')}</ul></details>` : ''}`;
  }
  function afterPlanChange() {
    renderWeek(); renderShopping(); renderHome(); updateBadge();
    $$('[data-week]').forEach((b) => syncButtons(b.dataset.week));
  }
  function updateBadge() {
    const n = plannedInWeek(weekKey(pdate(state.today))).length;
    const b = $('#badge');
    b.textContent = n;
    b.hidden = n === 0;
  }

  /* ---------- amounts inline in the instructions ---------- */
  const ADJ = new Set(['fresh','boneless','skinless','unsalted','salted','large','small','medium','diced','chopped','minced','shredded','grated','low-sodium','extra-virgin','extra','virgin','light','dark','whole','sliced','cooked','canned','dried','frozen','ripe','plain','finely','roughly','thinly','crushed','toasted','baby','sweet','hot','mild','lean','thick','thin','cut','reduced-sodium','full-fat','low-fat','fat-free','heavy','italian','kosher','flaky','coarse','boneless,','skinless,','better','than']);
  const GENERIC = new Set(['salt','pepper','water']);
  const ingNorm = (s) => s.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[,;]/)[0].replace(/\s+/g, ' ').trim();
  function variants(phrase) {
    const out = new Set([phrase]);
    const w = phrase.split(' '); const last = w[w.length - 1];
    const sing = last.endsWith('ies') ? last.slice(0, -3) + 'y' : last.endsWith('oes') ? last.slice(0, -2) : last.endsWith('s') && !last.endsWith('ss') ? last.slice(0, -1) : null;
    const plur = last.endsWith('y') ? last.slice(0, -1) + 'ies' : last.endsWith('s') ? null : last + 's';
    for (const v of [sing, plur]) if (v) out.add([...w.slice(0, -1), v].join(' '));
    return [...out];
  }
  function candidates(item) {
    const alts = ingNorm(item).split(/\s+or\s+/).filter(Boolean);
    const cands = [];
    for (const a of alts) {
      let words = a.split(' ');
      while (words.length > 1 && ADJ.has(words[0])) words = words.slice(1);
      if (words.length > 1 && words[0].length >= 4 && !GENERIC.has(words[0]) && !ADJ.has(words[0])) cands.push({ ph: words[0], full: false });
      for (let k = 0; k < words.length; k++) {
        const ph = words.slice(k).join(' ');
        if (k > 0 && (GENERIC.has(ph) || ph.length < 4)) continue;
        cands.push({ ph, full: k === 0 });
      }
    }
    return cands;
  }
  function buildIndex(ings) {
    const map = new Map();   // phrase -> Set(idx)
    ings.forEach((ing, idx) => candidates(ing.item).forEach(({ ph, full }) => variants(ph).forEach((v) => {
      if (!map.has(v)) map.set(v, new Map()); map.get(v).set(idx, full);
    })));
    const list = [];
    for (const [ph, m] of map) {
      let idx = null;
      let full = false;
      if (m.size === 1) { idx = [...m.keys()][0]; full = m.get(idx); }
      else { const fulls = [...m].filter(([, f]) => f); if (fulls.length === 1) { idx = fulls[0][0]; full = true; } }
      if (idx != null) list.push({ ph, idx, full });
    }
    const words = ings.map((ing) => new Set(ingNorm(ing.item).split(' ').filter((w) => w.length >= 4)));
    list.sort((a, b) => b.ph.length - a.ph.length);
    list.words = words;
    return list;
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function annotate(step, index) {
    const NEXT = /^\s+(mixture|mix|blend|coating|crust|seasoning)\b/;
    const lower = step.toLowerCase(); const taken = new Array(step.length).fill(false); const hits = [];
    const seen = new Set();
    for (const { ph, idx, full } of index) {
      if (seen.has(idx)) continue;
      const re = new RegExp('(^|[^a-z])(' + escRe(ph) + ')(?![a-z])', 'g'); let m;
      while ((m = re.exec(lower))) {
        const s = m.index + m[1].length, e = s + ph.length;
        if (taken.slice(s, e).some(Boolean)) continue;
        if (!full) {
          const prev = (lower.slice(0, s).match(/([a-z]+)\s+$/) || [])[1];
          if (prev && !index.words[idx].has(prev) && index.words.some((w, k) => k !== idx && w.has(prev))) continue;
        }
        if (NEXT.test(lower.slice(e))) continue;
        if (ph === 'pepper' && /salt(,)?( and)?\s+$/.test(lower.slice(Math.max(0, s - 12), s))) continue;
        for (let i = s; i < e; i++) taken[i] = true;
        hits.push({ end: e, idx }); seen.add(idx); break;
      }
    }
    return hits.sort((a, b) => a.end - b.end);
  }

  /* ---------- rendering: full recipe ---------- */
  const DETAIL_TABS = [['overview', 'Overview'], ['ingredients', 'Ingredients'], ['instructions', 'Instructions'], ['notes', 'Notes']];

  function panel(r, tab) {
    if (tab === 'ingredients') {
      return `<ul class="ings">${r.ingredients.map((i) => {
        const row = ingredientRow(i);
        return `<li><span class="amt${row.soft ? ' soft' : ''}">${esc(row.amt)}</span><span>${esc(cap(i.item))}</span></li>`;
      }).join('')}</ul>`;
    }
    if (tab === 'instructions') {
      const index = buildIndex(r.ingredients);
      const used = new Set();
      const amtOf = (i) => { const a = ingredientRow(i).amt; return a === 'as needed' ? '' : a; };
      const steps = r.instructions.map((s) => {
        const hits = annotate(s, index);
        let out = '', pos = 0;
        hits.forEach((h) => {
          used.add(h.idx);
          out += esc(s.slice(pos, h.end));
          const a = amtOf(r.ingredients[h.idx]);
          if (a) out += `<span class="inl">${esc(a)}</span>`;
          pos = h.end;
        });
        return `<li>${out + esc(s.slice(pos))}</li>`;
      }).join('');
      const rest = r.ingredients.filter((_, k) => !used.has(k));
      const also = rest.length ? `<p class="also"><b>Also needed:</b> ${rest.map((i) => { const a = amtOf(i); return esc(i.item.replace(/,.*$/, '')) + (a ? ` (${esc(a)})` : ''); }).join(', ')}</p>` : '';
      return `<ol class="steps">${steps}</ol>${also}`;
    }
    if (tab === 'notes') {
      const out = [];
      if (r.rebeccaNotes) out.push(`<section><h3>Tips</h3><p>${esc(r.rebeccaNotes)}</p></section>`);
      if (r.dietaryNotes && r.dietaryNotes.length) out.push(`<section class="sub"><h3>Good to know</h3><ul class="plain">${r.dietaryNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`);
      if (r.leftoverRating) {
        const dots = [1, 2, 3].map((n) => `<i class="${n <= r.leftoverRating ? 'on' : ''}"></i>`).join('');
        const txt = ['Best eaten fresh', 'Reheats well', 'Great leftovers'][Math.min(2, Math.max(0, r.leftoverRating - 1))];
        out.push(`<section class="sub"><h3>Leftovers</h3><div class="leftovers"><span class="dots" aria-hidden="true">${dots}</span><span>${txt}</span></div></section>`);
      }
      return out.join('') || '<p>No notes for this recipe yet.</p>';
    }
    // overview: At a Glance
    const g = (icon, label, value) => `<div class="g"><span class="gi">${icon}</span><span><small>${label}</small><span>${esc(value)}</span></span></div>`;
    const items = [
      g(Art.protein(r.protein[0]), 'Main', cap(r.protein[0])),
      r.method ? g(Art.mealType(/sheet/i.test(r.method) ? 'sheet-pan' : /simmer/i.test(r.method) ? 'soup' : 'skillet'), 'Method', r.method) : '',
      g(Art.glance('hat'), 'Difficulty', cap(r.difficulty)),
      r.flavor ? g(Art.glance('lemon'), 'Flavor', r.flavor) : '',
      r.bestFor ? g(Art.glance('sun'), 'Best for', r.bestFor) : '',
    ].join('');
    return `<h3>At a glance</h3><div class="glance">${items}</div>`;
  }

  function renderPanel() {
    const r = state.byId[state.openId];
    if (!r) return;
    $$('.rtab').forEach((t) => t.setAttribute('aria-selected', t.dataset.rtab === state.detailTab));
    $('#panel').innerHTML = panel(r, state.detailTab);
  }

  function recipeView(r) {
    return `
      <div class="sheet-scroll">
        <div class="sheet-bar">
          <button class="iconbtn" data-close aria-label="Back">${ui('back')}</button>
          <span class="bar-title">Dinner Darling</span>
          <button class="iconbtn" data-share="${esc(r.id)}" aria-label="Share this recipe">${ui('share')}</button>
        </div>
        <div class="sheet-inner">
          <header class="rv-head">
            <div>
              ${kicker(r)}
              <h2>${esc(r.name)}</h2>
              <p class="lede">${esc(r.description)}</p>
              ${pills(r)}
            </div>
            <span class="art">${Art.dish(r)}</span>
          </header>

          <div class="stats">
            <div class="stat">${ui('serves')}<span>Serves<br><b>${r.servings}</b></span></div>
            <div class="stat">${ui('budget')}<span>Budget<br><b>${esc(r.cost)}</b></span></div>
            <div class="stat">${ui('clock')}<span>Prep<br><b>${r.prepMinutes != null ? r.prepMinutes + ' min' : '–'}</b></span></div>
            <div class="stat">${ui('pot')}<span>Cook<br><b>${r.cookMinutes != null ? r.cookMinutes + ' min' : '–'}</b></span></div>
          </div>

          <div class="tabs" role="tablist" aria-label="Recipe sections">
            ${DETAIL_TABS.map(([k, label]) => `<button class="rtab" role="tab" data-rtab="${k}" aria-selected="${k === state.detailTab}">${label}</button>`).join('')}
          </div>
          <div class="panel" id="panel" role="tabpanel"></div>
        </div>
      </div>
      <div class="sheet-actions">${favButton(r.id)}${weekButton(r.id)}</div>`;
  }

  function openSheet(id) {
    const r = state.byId[id];
    if (!r) { location.hash = tabHash(state.tab); return; }
    const sheet = $('#sheet');
    const wasHidden = sheet.hidden;
    if (wasHidden || state.openId !== id) state.detailTab = 'overview';
    state.openId = id;
    sheet.setAttribute('aria-label', r.name);
    sheet.innerHTML = recipeView(r);
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    renderPanel();
    if (wasHidden) sheet.querySelector('.iconbtn').focus({ preventScroll: true });
  }
  function closeSheet() {
    const sheet = $('#sheet');
    if (sheet.hidden) return;
    sheet.hidden = true;
    sheet.innerHTML = '';
    state.openId = null;
    document.body.classList.remove('sheet-open');
  }

  /* ---------- actions ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function syncButtons(id) {
    const on = state.favorites.has(id);
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', on);
      const ico = $('.ico', b), lbl = $('.lbl', b);
      if (ico) ico.textContent = on ? '♥' : '♡';
      if (lbl) lbl.textContent = on ? 'Saved' : 'Save';
    });
    $$(`[data-week="${CSS.escape(id)}"]`).forEach((b) => {
      const mini = b.classList.contains('mini');
      const w = wkState(id, mini);
      b.setAttribute('aria-pressed', w.on);
      $('.ico', b).textContent = w.ico;
      $('.lbl', b).textContent = w.lbl;
    });
  }

  function toggleFav(id) {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    saveFavs();
    syncButtons(id);
    renderFavorites();
    if (state.filters.favs) renderList();
  }

  function toggleWeek(id) {
    if (state.picking) { place(state.picking.date, id, { type: 'new' }, { discard: state.picking.replace }); return; }
    if (state.queue.includes(id)) { removeFromQueue(id); toast('Removed from Selected Dinners'); }
    else { addToQueue(id); toast('Added to Selected Dinners'); }
    saveQueue();
    afterPlanChange();
  }

  async function share(id) {
    const r = state.byId[id];
    if (!r) return;
    const url = `${location.origin}${location.pathname}#/recipe/${encodeURIComponent(id)}`;
    if (navigator.share) {
      try { await navigator.share({ title: r.name, text: `${r.name}: ${r.description}`, url }); } catch { /* cancelled */ }
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Sharing isn’t available here'); }
    } else {
      toast('Sharing isn’t available here');
    }
  }

  function clearFilters() {
    state.filters = emptyFilters();
    $('#q').value = '';
    renderFilters();
    renderList();
  }
  function setFilter(key, value) {
    const f = state.filters;
    if (key === 'quick' || key === 'favs') f[key] = !f[key];
    else if (key === 'easy') f.level = f.level === 'easy' ? null : 'easy';
    else f[key] = f[key] === value ? null : value;
    renderFilters();
    renderList();
  }

  /* ---------- calendar controls ---------- */
  function setViewMode(mode) {
    if (state.view.mode === mode) return;
    state.view.mode = mode;
    state.view.anchor = state.view.sel;
    write(KEY_VIEW, mode);
    renderWeek();
  }
  function calNav(n) {
    const v = state.view;
    if (v.mode === 'month') {
      const d = pdate(v.anchor);
      const first = dkey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
      v.anchor = first;
      const r = monthRange(first);
      v.sel = (state.today >= r.first && state.today <= r.last) ? weekOf(state.today) : weekOf(first);
      state.selDay = null;
    } else {
      v.anchor = addDays(v.anchor, (v.mode === '2weeks' ? 14 : 7) * n);
      v.sel = v.anchor;
    }
    renderWeek(); renderShopping();
  }
  function calToday() {
    const v = state.view;
    v.sel = weekOf(state.today);
    v.anchor = v.mode === 'month' ? state.today : v.sel;
    state.selDay = state.today;
    renderWeek(); renderShopping();
  }
  function menuAction(action) {
    const { date, id } = state.dlg || {};
    if (!date) return;
    if (action === 'open') { closeDlg(); state.canBack = true; location.hash = '#/recipe/' + encodeURIComponent(id); }
    else if (action === 'move') chooseDayDlg({ type: 'plan', date });
    else if (action === 'replace') startPicking(date, true);
    else if (action === 'unschedule') unplan(date, true);
    else if (action === 'remove') unplan(date, false);
  }

  /* ---------- routing (hash based, so Back works on phones) ---------- */
  const TABS = ['home', 'recipes', 'week', 'shopping', 'favorites'];
  function setTab(tab) {
    if (state.tab !== tab) window.scrollTo(0, 0);
    state.tab = tab;
    TABS.forEach((t) => { $('#view-' + t).hidden = t !== tab; });
    $$('.tab').forEach((t) => { if (t.dataset.tab === tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    $('.masthead').hidden = tab !== 'recipes';
    document.body.dataset.tab = tab;
  }
  function route() {
    const h = location.hash;
    const m = h.match(/^#\/recipe\/(.+)$/);
    if (m) { openSheet(decodeURIComponent(m[1])); return; }
    closeSheet();
    setTab({ '#/recipes': 'recipes', '#/week': 'week', '#/shopping': 'shopping', '#/favorites': 'favorites' }[h] || 'home');
  }
  const tabHash = (t) => (t === 'home' ? '#/' : '#/' + t);
  function closeFromUI() {
    if (state.canBack) { state.canBack = false; history.back(); } else location.hash = tabHash(state.tab);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open],[data-fav],[data-week],[data-quick],[data-protein],[data-meal],[data-level],[data-clear],[data-go],[data-close],[data-tab],[data-rtab],[data-share],[data-uncheck],[data-view-mode],[data-cal-nav],[data-cal-today],[data-day-select],[data-add-day],[data-meal-menu],[data-q-assign],[data-q-remove],[data-q-add],[data-dlg-close],[data-place-day],[data-place-queue],[data-place-date],[data-menu],[data-confirm],[data-pick-recipes],[data-pick-cancel],[data-shop-week],[data-shop-today],#more-btn');
    if (e.target.id === 'dlg') { closeDlg(); return; } // tapped the dimmed backdrop
    if (!t) return;
    const d = t.dataset;
    if (d.open) { state.canBack = true; location.hash = '#/recipe/' + encodeURIComponent(d.open); }
    else if (d.fav) toggleFav(d.fav);
    else if (d.week) toggleWeek(d.week);
    else if (d.quick) setFilter(d.quick === 'easy' ? 'easy' : d.quick);
    else if (d.protein) setFilter('protein', d.protein);
    else if (d.meal) setFilter('meal', d.meal);
    else if (d.level) setFilter('level', d.level);
    else if (t.hasAttribute('data-clear')) clearFilters();
    else if (d.go) location.hash = tabHash(d.go);
    else if (t.hasAttribute('data-close')) closeFromUI();
    else if (d.tab) { location.hash = tabHash(d.tab); window.scrollTo(0, 0); }
    else if (t.hasAttribute('data-uncheck')) uncheckAll();
    else if (d.viewMode) setViewMode(d.viewMode);
    else if (d.calNav) calNav(Number(d.calNav));
    else if (t.hasAttribute('data-cal-today')) calToday();
    else if (d.daySelect) { state.selDay = d.daySelect; state.view.sel = weekOf(d.daySelect); renderWeek(); renderShopping(); }
    else if (d.addDay) addDayDlg(d.addDay);
    else if (d.mealMenu) mealMenuDlg(d.mealMenu);
    else if (d.qAssign) chooseDayDlg({ type: 'queue', id: d.qAssign });
    else if (d.qAdd) { addToQueue(d.qAdd); saveQueue(); afterPlanChange(); toast('Added to Selected Dinners'); }
    else if (d.qRemove) { removeFromQueue(d.qRemove); saveQueue(); afterPlanChange(); }
    else if (t.hasAttribute('data-dlg-close')) closeDlg();
    else if (d.placeQueue) place(state.dlg.date, d.placeQueue, { type: 'queue' });
    else if (d.placeDay) { const src = state.dlg.src; place(d.placeDay, src.type === 'plan' ? state.plan[src.date] : src.id, src); }
    else if (t.hasAttribute('data-place-date')) {
      const v = ($('#dlg-date') || {}).value;
      if (!v || !isDate(v)) { toast('Pick a date first'); return; }
      const src = state.dlg.src;
      place(v, src.type === 'plan' ? state.plan[src.date] : src.id, src);
    }
    else if (d.menu) menuAction(d.menu);
    else if (d.confirm) { const c = state.dlg; place(c.date, c.id, c.src, { confirmed: true }); }
    else if (t.hasAttribute('data-pick-recipes')) startPicking(state.dlg.date, false);
    else if (t.hasAttribute('data-pick-cancel')) stopPicking();
    else if (t.hasAttribute('data-shop-today')) { setSel(weekOf(state.today)); renderShopping(); renderWeek(); }
    else if (d.shopWeek) { setSel(addDays(state.view.sel, 7 * Number(d.shopWeek))); renderShopping(); renderWeek(); }
    else if (d.rtab) { state.detailTab = d.rtab; renderPanel(); }
    else if (d.share) share(d.share);
    else if (t.id === 'more-btn') {
      const open = t.getAttribute('aria-expanded') !== 'true';
      t.setAttribute('aria-expanded', open);
      $('#more-panel').hidden = !open;
    }
  });
  $('#q').addEventListener('input', (e) => { state.filters.q = e.target.value; renderList(); });
  document.addEventListener('change', (e) => {
    const c = e.target.closest('input[data-shop]');
    if (c) toggleShop(c.dataset.shop, c.checked);
  });
  // Drag a dinner (from Selected Dinners, or already on the calendar) onto a day. Tap-to-assign always works too.
  let dragSrc = null;
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-drag]');
    if (!el) return;
    dragSrc = el.dataset.drag;
    e.dataTransfer.setData('text/plain', dragSrc);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => { dragSrc = null; e.target.classList && e.target.classList.remove('dragging'); $$('.over').forEach((z) => z.classList.remove('over')); });
  document.addEventListener('dragover', (e) => {
    const z = dragSrc && e.target.closest && e.target.closest('[data-drop]');
    $$('.over').forEach((o) => { if (o !== z) o.classList.remove('over'); });
    if (z) { e.preventDefault(); z.classList.add('over'); }
  });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest && e.target.closest('[data-drop]');
    if (!z || !dragSrc) return;
    e.preventDefault();
    const [kind, ref] = [dragSrc.slice(0, dragSrc.indexOf(':')), dragSrc.slice(dragSrc.indexOf(':') + 1)];
    dragSrc = null;
    $$('.over').forEach((o) => o.classList.remove('over'));
    if (kind === 'queue') place(z.dataset.drop, ref, { type: 'queue' });
    else if (kind === 'plan' && planned(ref)) place(z.dataset.drop, state.plan[ref], { type: 'plan', date: ref });
  });
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#dlg')) closeDlg();
    else if (!$('#sheet').hidden) closeFromUI();
  });

  /* ---------- boot ---------- */
  async function init() {
    try {
      const res = await fetch('recipes.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.recipes = data.recipes || [];
      state.byId = Object.fromEntries(state.recipes.map((r) => [r.id, r]));
    } catch (err) {
      $('#list').innerHTML = '<div class="empty"><p>Couldn’t load the recipes. Check your connection and reload.</p></div>';
      return;
    }
    try {
      const res = await fetch('assets/assets.json', { cache: 'no-cache' });
      if (res.ok) Art.configure(await res.json());
    } catch { /* artwork slots are optional */ }

    state.favorites = new Set([...state.favorites].filter((id) => state.byId[id]));
    loadPlan();
    $('#vine').innerHTML = Art.vine();
    renderFilters();
    renderList();
    renderFavorites();
    renderPick();
    afterPlanChange();
    route();
  }
  init();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkToday(); });
  window.addEventListener('pageshow', checkToday);
  window.addEventListener('focus', checkToday);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
