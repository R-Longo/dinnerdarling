(() => {
  'use strict';

  const MAX_WEEK = 3;
  const KEY_FAV = 'dd.favorites.v1';
  const KEY_WEEK = 'dd.week.v1'; // legacy: single current week { key, ids }
  const KEY_SHOP = 'dd.shop.v1'; // { "YYYY-MM-DD": [checked item keys] } — current week only
  const KEY_WEEKS = 'dd.weeks.v2'; // { "YYYY-MM-DD" (Monday): [recipeId, …] } — every week is kept
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

  function weekKey(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back to Monday
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }
  function weekLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ---------- state ---------- */
  const emptyFilters = () => ({ q: '', protein: null, meal: null, level: null, quick: false, favs: false });
  const state = {
    recipes: [], byId: {},
    favorites: new Set(read(KEY_FAV, [])),
    weeks: {},                         // all stored weeks, keyed by Monday
    week: { key: weekKey(), ids: [], extra: [] }, // the current week (ids = known recipes)
    filters: emptyFilters(),
    tab: 'home', canBack: false,
    openId: null, detailTab: 'overview',
  };

  const isWeeks = (v) => v && typeof v === 'object' && !Array.isArray(v);
  function readWeeks() {
    let weeks = read(KEY_WEEKS, null);
    if (!isWeeks(weeks)) {
      weeks = {};
      const legacy = read(KEY_WEEK, null); // migrate the old single-week format, keeping its week
      if (legacy && typeof legacy.key === 'string' && Array.isArray(legacy.ids) && legacy.ids.length) weeks[legacy.key] = legacy.ids;
    }
    for (const k of Object.keys(weeks)) if (!Array.isArray(weeks[k])) delete weeks[k];
    return weeks;
  }
  // Point state.week at the current Monday's entry. Other weeks stay untouched in state.weeks.
  function loadWeek() {
    if (!Object.keys(state.weeks).length) state.weeks = readWeeks();
    const key = weekKey();
    const stored = (state.weeks[key] || []).filter((id) => typeof id === 'string').slice(0, MAX_WEEK);
    state.week = { key, ids: stored.filter((id) => state.byId[id]), extra: stored.filter((id) => !state.byId[id]) };
    saveWeek();
  }
  function saveWeek() {
    const { key, ids, extra } = state.week;
    const all = [...ids, ...extra];
    if (all.length) state.weeks[key] = all; else delete state.weeks[key];
    write(KEY_WEEKS, state.weeks);
  }
  // Called when the app becomes visible again: if Monday has rolled over, start the new (empty) week.
  function checkWeek() {
    if (weekKey() === state.week.key) return;
    loadWeek();
    afterWeekChange();
    $$('[data-week]').forEach((b) => syncButtons(b.dataset.week));
  }
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
  function weekButton(id, mini) {
    const on = state.week.ids.includes(id);
    const lbl = mini ? (on ? 'This Week' : 'Add to Week') : (on ? 'In This Week' : 'Add to Week');
    return `<button class="act wk${mini ? ' mini' : ''}" data-week="${esc(id)}" aria-pressed="${on}"><span class="ico" aria-hidden="true">${on ? '✓' : '＋'}</span><span class="lbl">${lbl}</span></button>`;
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
  function slotCard(r) {
    return `
      <article class="slot">
        <button class="slot-main" data-open="${esc(r.id)}" aria-label="Open ${esc(r.name)}">
          <span class="art">${Art.dish(r)}</span>
          <span class="card-body">
            <span class="card-title">${esc(r.name)}</span>
            <span class="meta">${r.timeMinutes} min · ${esc(cap(r.difficulty))} · ${esc(r.cost)}</span>
          </span>
        </button>
        <button class="linkbtn slot-remove" data-remove="${esc(r.id)}" aria-label="Remove ${esc(r.name)} from this week">Remove</button>
      </article>`;
  }
  function renderWeek() {
    const ids = state.week.ids;
    const slots = ids.map((id) => slotCard(state.byId[id]));
    for (let i = ids.length; i < MAX_WEEK; i++) {
      slots.push('<button class="act slot slot-empty" data-go="recipes"><span class="plus" aria-hidden="true">＋</span>Pick a dinner</button>');
    }
    $('#view-week').innerHTML = `
      <div class="view-head"><h2>This Week</h2><p>Week of ${esc(weekLabel(state.week.key))}. ${ids.length} of ${MAX_WEEK} dinners picked.</p></div>
      <div class="slots">${slots.join('')}</div>
      ${Art.decor('weekRosemary', 'decor list-end mascot')}`;
  }
  function renderFavorites() {
    const items = state.recipes.filter((r) => state.favorites.has(r.id));
    $('#view-favorites').innerHTML = `
      <div class="view-head"><h2>Favorites</h2><p>${items.length ? 'Dinners you saved.' : ''}</p></div>` +
      (items.length
        ? `<div class="list">${items.map(card).join('')}</div>${Art.decor('favoritesFooter', 'decor list-end')}`
        : `<div class="empty">${Art.decor('favoritesEmpty', 'decor')}<p>No favorites yet. Tap Save on any recipe to keep it here.</p><button class="linkbtn" data-go="recipes">Browse recipes</button></div>`);
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
    const n = state.week.ids.length;
    const say = ['What sounds good this week?', 'Nice start — 2 more to go.', 'Almost there — one more.', 'Dinner’s decided.'][Math.min(n, 3)];
    const pips = Array.from({ length: MAX_WEEK }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
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
        <span class="ws-text"><b>This Week</b><span>${n} of ${MAX_WEEK} dinners picked</span></span>
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
    'salmon': 'salmon fillets', 'celery ribs': 'celery', 'celery rib': 'celery', 'flour': 'all-purpose flour',
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
    for (const id of state.week.ids) {
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
  const checkedSet = () => new Set((read(KEY_SHOP, {})[state.week.key]) || []);
  function toggleShop(key, on) {
    const set = checkedSet();
    on ? set.add(key) : set.delete(key);
    write(KEY_SHOP, { [state.week.key]: [...set] }); // keeps only the current week
    renderShopping();
  }
  function uncheckAll() { write(KEY_SHOP, {}); renderShopping(); }
  function shopRow(it, done) {
    return `<li class="shop-row${done.has(it.key) ? ' done' : ''}"><label>
        <input type="checkbox" data-shop="${esc(it.key)}"${done.has(it.key) ? ' checked' : ''}>
        <span class="box" aria-hidden="true"></span>
        <span class="shop-main"><span class="shop-name">${esc(cap(it.name))}</span><small>for ${esc(it.from.join(', '))}</small></span>
        <span class="shop-amt${it.amt === 'to taste' ? ' soft' : ''}">${esc(it.amt)}</span>
      </label></li>`;
  }
  function renderShopping() {
    const view = $('#view-shopping');
    const n = state.week.ids.length;
    if (!n) {
      view.innerHTML = `
        <div class="view-head"><h2>Shopping List</h2><p>Pick dinners for the week and everything you need shows up here.</p></div>
        ${Art.decor('shoppingEmpty', 'decor')}
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
      <div class="view-head"><h2>Shopping List</h2><p>For this week’s ${n} ${n === 1 ? 'dinner' : 'dinners'}.${anyDone ? ' <button class="linkbtn" data-uncheck>Uncheck all</button>' : ''}</p></div>
      ${groups.map(([label, list]) => `<section class="shop-group"><h3>${esc(label)}</h3><ul class="shop-list">${list.map((i) => shopRow(i, done)).join('')}</ul></section>`).join('')}
      ${staples.length ? `<details class="shop-group staples"><summary>Probably in your pantry (${staples.length})</summary><ul class="shop-list">${staples.map((i) => shopRow(i, done)).join('')}</ul></details>` : ''}`;
  }
  function afterWeekChange() { renderWeek(); renderShopping(); renderHome(); updateBadge(); }
  function updateBadge() {
    const n = state.week.ids.length;
    const b = $('#badge');
    b.textContent = n;
    b.hidden = n === 0;
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
      return `<ol class="steps">${r.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
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
    const inWeek = state.week.ids.includes(id);
    $$(`[data-week="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', inWeek);
      $('.ico', b).textContent = inWeek ? '✓' : '＋';
      $('.lbl', b).textContent = b.classList.contains('mini') ? (inWeek ? 'This Week' : 'Add to Week') : (inWeek ? 'In This Week' : 'Add to Week');
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
    const ids = state.week.ids;
    if (ids.includes(id)) state.week.ids = ids.filter((x) => x !== id);
    else if (ids.length + state.week.extra.length >= MAX_WEEK) { toast(`${MAX_WEEK} dinners picked. Remove one to swap.`); return; }
    else ids.push(id);
    saveWeek();
    syncButtons(id);
    afterWeekChange();
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
    const t = e.target.closest('[data-open],[data-fav],[data-week],[data-remove],[data-quick],[data-protein],[data-meal],[data-level],[data-clear],[data-go],[data-close],[data-tab],[data-rtab],[data-share],[data-uncheck],#more-btn');
    if (!t) return;
    const d = t.dataset;
    if (d.open) { state.canBack = true; location.hash = '#/recipe/' + encodeURIComponent(d.open); }
    else if (d.fav) toggleFav(d.fav);
    else if (d.week) toggleWeek(d.week);
    else if (d.remove) toggleWeek(d.remove);
    else if (d.quick) setFilter(d.quick === 'easy' ? 'easy' : d.quick);
    else if (d.protein) setFilter('protein', d.protein);
    else if (d.meal) setFilter('meal', d.meal);
    else if (d.level) setFilter('level', d.level);
    else if (t.hasAttribute('data-clear')) clearFilters();
    else if (d.go) location.hash = tabHash(d.go);
    else if (t.hasAttribute('data-close')) closeFromUI();
    else if (d.tab) { location.hash = tabHash(d.tab); window.scrollTo(0, 0); }
    else if (t.hasAttribute('data-uncheck')) uncheckAll();
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
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeFromUI(); });

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
    loadWeek();
    $('#vine').innerHTML = Art.vine();
    renderFilters();
    renderList();
    renderFavorites();
    afterWeekChange();
    route();
  }
  init();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkWeek(); });
  window.addEventListener('pageshow', checkWeek);
  window.addEventListener('focus', checkWeek);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
