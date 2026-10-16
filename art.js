/* Dinner Darling illustrations: flat vector drawings, one per recipe.
   A recipe's optional "image" field (a path to a PNG/WebP) overrides these. */
(function () {
  const C = {
    tomato: '#C73E2B', tomatoD: '#9E2A1B', olive: '#66703D', oliveL: '#8F9A5A',
    butter: '#F5E3B5', gold: '#EBC15F', goldD: '#C99A3E', cream: '#FFF9EE',
    rose: '#D4959A', roseL: '#F4DEDB', salmon: '#F08D68', salmonD: '#DB6B4B',
    brown: '#8A5A3C', brownD: '#5E3A24', lemon: '#F5D55C', ink: '#3B2B25',
    white: '#FFFDF7', pan: '#6A5A52', carrot: '#E88A3C', pink: '#E9A9A0'
  };
  const S = `stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
  const svg = (vb, body, cls) => `<svg viewBox="${vb}" class="${cls || ''}" aria-hidden="true" focusable="false">${body}</svg>`;

  /* ---------- small parts ---------- */
  const leaf = (x, y, r, s = 1, c = C.olive) =>
    `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0C6-8 16-8 22 0C16 8 6 8 0 0z" fill="${c}" ${S}/>`;
  const sprig = (x, y, r) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0C14-3 28-3 42 0" fill="none" stroke="${C.olive}" stroke-width="2" stroke-linecap="round"/>` +
    leaf(8, -1, -40, .8) + leaf(14, 1, 40, .8, C.oliveL) + leaf(22, -1, -40, .8) + leaf(28, 1, 40, .8, C.oliveL) + leaf(36, 0, -10, .8) + `</g>`;
  const tomato = (x, y, r = 10) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.tomato}" ${S}/><path d="M${x - r * .5} ${y - r * .9}l${r * .5} ${r * .35} ${r * .5}-${r * .35}" fill="none" stroke="${C.olive}" stroke-width="2.2" stroke-linecap="round"/>`;
  const lemonSlice = (x, y, r = 9) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.lemon}" ${S}/><circle cx="${x}" cy="${y}" r="${r - 2.5}" fill="#FBEB9E"/>` +
    [0, 60, 120].map((a) => `<path d="M${x} ${y - r + 2.5}V${y + r - 2.5}" transform="rotate(${a} ${x} ${y})" stroke="${C.lemon}" stroke-width="1.2"/>`).join('');
  const lemonWedge = (x, y, r = 1) =>
    `<path transform="translate(${x} ${y}) scale(${r})" d="M-10 0a10 10 0 0 0 20 0z" fill="${C.lemon}" ${S}/><path transform="translate(${x} ${y}) scale(${r})" d="M-7 1.5a7 7 0 0 0 14 0z" fill="#FBEB9E"/>`;
  const dots = (pts, r, fill) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
  const nest = (cx, cy, rx, ry) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.gold}" ${S}/>` +
    [.75, .5, .28].map((f) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx * f}" ry="${ry * f}" fill="none" stroke="${C.goldD}" stroke-width="2"/>`).join('') +
    `<circle cx="${cx}" cy="${cy - 1}" r="3" fill="${C.goldD}"/>`;
  const plate = () =>
    `<ellipse cx="60" cy="68" rx="46" ry="38" fill="${C.cream}" ${S}/><ellipse cx="60" cy="68" rx="36" ry="29" fill="none" stroke="${C.butter}" stroke-width="2.5"/>`;
  const bowl = (inner) =>
    `<path d="M12 62h96c0 28-20 44-48 44S12 90 12 62z" fill="${C.cream}" ${S}/><path d="M26 80c9 9 22 13 34 13" fill="none" stroke="${C.rose}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<ellipse cx="60" cy="62" rx="48" ry="12" fill="${C.cream}" ${S}/>` + inner;
  const rice = () => `<ellipse cx="60" cy="60" rx="38" ry="9.5" fill="${C.white}"/>` + dots([[34, 60], [42, 56], [50, 63], [64, 57], [74, 62], [84, 58], [58, 60], [90, 62]], 1.1, '#E4D9C2');
  const cuke = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="${C.oliveL}" ${S}/><circle cx="${x}" cy="${y}" r="3.6" fill="#CBD6A0"/>`;
  const salmonPiece = (x, y, r) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-10" y="-5.5" width="20" height="11" rx="4.5" fill="${C.salmon}" ${S}/><path d="M-6-1.5h12M-6 2h12" stroke="#FBC4A8" stroke-width="1.4" stroke-linecap="round"/></g>`;

  /* ---------- dish illustrations (120 x 120) ---------- */
  const DISHES = {
    'sesame-bowl': () =>
      sprig(2, 22, -30) + sprig(78, 12, 25) + bowl(
        rice() + salmonPiece(46, 56, -12) + salmonPiece(62, 52, 8) + salmonPiece(78, 57, -5) + cuke(36, 62) + cuke(86, 63) +
        dots([[52, 62], [58, 64], [70, 63], [66, 59], [44, 63]], 1.2, C.ink)) + lemonWedge(100, 102, 1),
    'lemon-herb-bowl': () =>
      sprig(0, 26, -35) + sprig(82, 18, 30) + bowl(
        rice() + `<path d="M40 58c4-7 24-9 38-3 4 2 3 7-2 8-10 3-26 3-34 0-3-1-3-4-2-5z" fill="${C.salmon}" ${S}/><path d="M48 58h26M46 61h28" stroke="#FBC4A8" stroke-width="1.4" stroke-linecap="round"/>` +
        cuke(32, 61) + cuke(90, 62) + tomato(80, 56, 5) + tomato(40, 55, 5)) + lemonSlice(98, 100, 9) + leaf(10, 98, -30, .9),
    'taco-bowl': () =>
      sprig(2, 24, -30) + sprig(80, 14, 25) + bowl(
        rice() + `<path d="M30 58c10-8 50-8 60 0-8 6-52 6-60 0z" fill="${C.brown}" ${S}/>` +
        dots([[44, 57], [52, 55], [60, 57], [68, 55], [76, 57]], 2.6, C.brownD) + dots([[38, 60], [84, 60], [60, 61]], 2.2, C.ink) +
        dots([[48, 60], [56, 62], [72, 61], [80, 58]], 1.8, C.lemon) + leaf(28, 62, -20, .8, C.oliveL) + leaf(86, 60, 200, .8, C.oliveL) + tomato(60, 54, 4.5)) + lemonWedge(100, 102, 1),
    'chicken-skillet': () =>
      sprig(0, 20, -25) + sprig(80, 8, 30) +
      `<circle cx="56" cy="66" r="40" fill="${C.pan}" ${S}/><path d="M92 76l24 12" stroke="${C.pan}" stroke-width="9" stroke-linecap="round"/><path d="M92 76l24 12" stroke="${C.ink}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".4"/>` +
      `<circle cx="56" cy="66" r="33" fill="${C.butter}" ${S}/>` +
      `<path d="M30 62c4-10 20-14 28-8 6 4 2 14-8 17-10 3-22 0-20-9z" fill="${C.gold}" ${S}/><path d="M56 70c4-9 20-12 28-5 5 5 0 13-9 15-9 2-21-1-19-10z" fill="${C.gold}" ${S}/>` +
      leaf(34, 52, -30, .9, C.oliveL) + leaf(70, 54, 200, .9) + leaf(46, 82, 20, .8, C.oliveL) + lemonSlice(80, 84, 8) + dots([[44, 66], [62, 64], [70, 74]], 1.2, C.goldD),
    'sheet-pan': () =>
      sprig(0, 24, -30) + sprig(82, 10, 28) +
      `<rect x="8" y="34" width="104" height="76" rx="10" fill="#D8CCB4" ${S}/><rect x="14" y="40" width="92" height="64" rx="6" fill="#EADFC8"/>` +
      `<rect x="20" y="46" width="34" height="20" rx="8" fill="${C.gold}" ${S}/><rect x="22" y="72" width="34" height="20" rx="8" fill="${C.gold}" ${S}/>` +
      dots([[28, 52], [36, 56], [44, 51], [30, 80], [40, 84], [48, 78]], 1.6, C.goldD) +
      [0, 1, 2, 3].map((i) => `<path d="M64 ${50 + i * 12}c10-4 24-4 36 0" stroke="${C.olive}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`).join('') +
      tomato(72, 94, 6) + tomato(90, 90, 6),
    'pasta': () =>
      sprig(0, 22, -28) + sprig(80, 8, 28) + plate() + nest(60, 66, 30, 23) +
      leaf(46, 58, -20, .9, C.oliveL) + leaf(62, 52, 20, .9) + leaf(70, 66, 160, .9, C.oliveL) +
      dots([[54, 70], [66, 72], [50, 64], [72, 60]], 2, C.oliveL) + lemonWedge(98, 100, 1),
    'bolognese': () =>
      sprig(30, 12, 15) + tomato(14, 40, 11) + tomato(30, 24, 8) + plate() + nest(62, 68, 30, 23) +
      `<path d="M44 62c8-9 28-10 34-2 3 5-3 10-10 11-9 1-26-1-24-9z" fill="${C.tomato}" ${S}/>` + dots([[54, 62], [62, 66], [70, 62], [58, 69]], 2, C.tomatoD) +
      leaf(56, 56, -30, .9) + leaf(64, 60, 30, .8, C.oliveL),
    'soup': () =>
      sprig(0, 24, -30) + sprig(80, 10, 28) +
      `<path d="M40 22c-5 6 5 10 0 16M60 18c-5 6 5 10 0 16M80 22c-5 6 5 10 0 16" fill="none" stroke="${C.rose}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M10 56h100c0 30-20 48-50 48S10 86 10 56z" fill="${C.tomato}" ${S}/><ellipse cx="60" cy="56" rx="50" ry="13" fill="${C.cream}" ${S}/><ellipse cx="60" cy="57" rx="42" ry="9.5" fill="#E8B65C"/>` +
      dots([[36, 56], [74, 58], [52, 60]], 3.2, C.carrot) + dots([[44, 55], [60, 59], [82, 56], [66, 54], [50, 58], [92, 58]], 1.5, C.white) + leaf(58, 54, -20, .6) + leaf(40, 60, 20, .5, C.oliveL),
    'pork-chop': () =>
      sprig(0, 22, -28) + sprig(78, 8, 28) + plate() +
      `<path d="M30 60c2-12 24-18 40-12 12 5 16 16 8 24-8 9-26 12-38 8-9-3-12-11-10-20z" fill="${C.pink}" ${S}/><path d="M40 62c8-8 22-8 30-2" stroke="${C.brown}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="66" cy="72" r="3.6" fill="${C.cream}" ${S}/>` +
      `<ellipse cx="88" cy="84" rx="8" ry="6" fill="#E7C98C" ${S}/><ellipse cx="78" cy="92" rx="7" ry="5.5" fill="#E7C98C" ${S}/><ellipse cx="94" cy="72" rx="6" ry="5" fill="#E7C98C" ${S}/>` +
      sprig(24, 98, -12),
    'tacos': () =>
      sprig(0, 22, -28) + sprig(80, 8, 28) + plate() +
      [[38, 70, -8], [70, 66, 8]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-22 14a22 22 0 0 1 44 0z" fill="#F2D49B" ${S}/>` + leaf(-14, 6, -50, 1) + leaf(-2, 0, -80, .9, C.oliveL) + leaf(8, 4, -120, 1) + dots([[-10, 9], [0, 8], [8, 9]], 2.6, C.tomato) + `</g>`).join('') +
      lemonWedge(96, 98, 1),
    'flatbread': () =>
      sprig(0, 24, -28) + sprig(80, 8, 28) +
      `<rect x="10" y="38" width="100" height="56" rx="14" fill="#D8CCB4" ${S}/><ellipse cx="60" cy="66" rx="44" ry="22" fill="#F2D49B" ${S}/><ellipse cx="60" cy="66" rx="36" ry="16" fill="#FFF3D6"/>` +
      tomato(42, 64, 6) + tomato(62, 58, 6) + tomato(80, 68, 6) + tomato(56, 76, 5) +
      `<path d="M34 72c6-3 12-3 18 0M66 62c6-3 12-2 16 1" stroke="${C.olive}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` + dots([[50, 66], [72, 72], [38, 70]], 2, C.brownD),
    'steak': () =>
      sprig(0, 24, -28) + sprig(80, 8, 28) + plate() +
      `<path d="M26 64c2-14 28-20 44-12 14 7 16 18 6 26-10 8-30 10-42 4-6-3-9-9-8-18z" fill="${C.tomatoD}" ${S}/><path d="M34 62c10-8 26-8 36 0" stroke="${C.brownD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/><path d="M34 72c12-6 26-6 38 0" stroke="${C.brownD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>` +
      leaf(78, 80, -30, 1) + leaf(84, 72, 20, .9, C.oliveL) + leaf(90, 84, 170, .9, C.olive) + lemonWedge(96, 96, .9)
  };

  /* ---------- protein icons (48 x 48) ---------- */
  const PROTEIN = {
    chicken: `<path d="M8 28c0-10 10-17 22-15 9 2 12 11 8 18-4 8-14 10-22 7-5-2-8-5-8-10z" fill="#F0CE7A" ${S}/><path d="M15 26c3-5 10-7 16-4" fill="none" stroke="#D9AC4A" stroke-width="2" stroke-linecap="round"/>`,
    salmon: `<path d="M6 26c3-9 15-14 25-10 6 2 11 6 12 12-1 7-8 11-17 11-9 0-18-4-20-13z" fill="${C.salmon}" ${S}/><path d="M16 26c6-4 14-4 22 0M15 32c7-3 15-3 23 0" fill="none" stroke="#FBC4A8" stroke-width="2" stroke-linecap="round"/>`,
    turkey: `<path d="M8 26c0-9 8-15 17-13 7 2 10 8 8 14-2 7-9 10-16 8-6-2-9-5-9-9z" fill="#B97A4B" ${S}/><path d="M30 31l10 10" stroke="${C.ink}" stroke-width="1.4" stroke-linecap="round"/><circle cx="41" cy="39" r="3" fill="${C.cream}" ${S}/><circle cx="37" cy="43" r="3" fill="${C.cream}" ${S}/><path d="M15 22c3-3 8-4 12-2" fill="none" stroke="#D49A68" stroke-width="2" stroke-linecap="round"/>`,
    pork: `<path d="M7 26c1-9 11-14 21-11 9 3 14 10 11 18-3 8-13 11-22 8-7-2-11-8-10-15z" fill="${C.pink}" ${S}/><circle cx="29" cy="30" r="4" fill="${C.cream}" ${S}/><path d="M13 24c3-3 8-4 12-3" fill="none" stroke="#D07F78" stroke-width="2" stroke-linecap="round"/>`,
    fish: `<path d="M4 25c6-9 18-12 27-6l10-8v26l-10-8C22 36 10 34 4 25z" fill="#DCE6EA" ${S}/><path d="M14 20c3 3 3 9 0 12M20 19c3 4 3 10 0 14" fill="none" stroke="#9DB4BE" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="23" r="1.6" fill="${C.ink}"/>`,
    beef: `<ellipse cx="24" cy="26" rx="18" ry="12" fill="#A9553F" ${S}/><path d="M10 24c5-4 13-5 20-2M14 31c6-3 14-3 21 0" fill="none" stroke="#C98068" stroke-width="2" stroke-linecap="round"/>${dots([[18, 27], [28, 24], [33, 30], [22, 32]], 1.3, '#7A3A2A')}`,
    vegetarian: `<path d="M9 36C8 20 20 9 40 8c1 20-9 31-25 31-2 0-4-1-6-3z" fill="${C.oliveL}" ${S}/><path d="M10 38C18 28 26 21 34 15" fill="none" stroke="${C.olive}" stroke-width="2.2" stroke-linecap="round"/>`,
    steak: `<path d="M6 26c2-9 13-14 23-11 9 3 14 10 11 18-3 8-14 11-24 8-7-2-12-8-10-15z" fill="#B9423A" ${S}/><path d="M13 25c5-6 15-7 22-2M14 31c6-4 15-4 22 0" fill="none" stroke="#E58A7F" stroke-width="2" stroke-linecap="round"/>`
  };
  const PROTEIN_FALLBACK = `<path d="M6 22h36c0 10-8 18-18 18S6 32 6 22z" fill="${C.butter}" ${S}/>`;

  /* ---------- glance icons (48 x 48) ---------- */
  const GLANCE = {
    rice: `<path d="M6 22h36c0 10-8 18-18 18S6 32 6 22z" fill="${C.cream}" ${S}/><path d="M10 22c3-9 25-9 28 0z" fill="${C.white}" ${S}/>`,
    pasta: nest(24, 26, 17, 14).replace(/<ellipse/, '<ellipse'),
    greens: leaf(8, 30, -50, 1.1, C.oliveL) + leaf(10, 32, -10, 1.2) + leaf(20, 34, 30, 1.1, C.oliveL) + leaf(14, 22, -60, 1),
    potato: `<ellipse cx="24" cy="26" rx="16" ry="11" fill="#E7C98C" ${S}/>` + dots([[18, 24], [28, 22], [24, 30], [32, 28]], 1.2, '#B88B4A'),
    pan: `<circle cx="20" cy="26" r="14" fill="${C.pan}" ${S}/><circle cx="20" cy="26" r="9" fill="${C.butter}"/><path d="M33 31l12 6" stroke="${C.pan}" stroke-width="5" stroke-linecap="round"/>`,
    lemon: `<path d="M8 28c0-10 10-16 22-14 6 1 10 4 10 8s-4 8-12 12c-10 4-20 0-20-6z" fill="${C.lemon}" ${S}/><path d="M32 14c2-4 6-5 9-4" fill="none" stroke="${C.olive}" stroke-width="2.4" stroke-linecap="round"/>`,
    sun: `<circle cx="24" cy="24" r="8" fill="#F2A33A" ${S}/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M24 8v5" transform="rotate(${a} 24 24)" stroke="#F2A33A" stroke-width="2.6" stroke-linecap="round"/>`).join(''),
    soup: `<path d="M6 22h36c0 10-8 18-18 18S6 32 6 22z" fill="${C.tomato}" ${S}/><ellipse cx="24" cy="22" rx="18" ry="5" fill="#E8B65C" ${S}/>`,
    sheetpan: `<rect x="5" y="12" width="38" height="26" rx="5" fill="#D8CCB4" ${S}/><rect x="10" y="17" width="12" height="7" rx="3" fill="${C.gold}"/><path d="M27 19h12M27 25h12M27 31h12" stroke="${C.olive}" stroke-width="3" stroke-linecap="round"/>`,
    taco: `<path d="M5 34a19 19 0 0 1 38 0z" fill="#F2D49B" ${S}/>` + leaf(12, 28, -50, 0.9) + leaf(22, 22, -80, 0.8, C.oliveL) + leaf(32, 26, -120, 0.9) + dots([[16, 31], [24, 30], [31, 31]], 2, C.tomato),
    flatbread: `<ellipse cx="24" cy="25" rx="20" ry="13" fill="#F2D49B" ${S}/><ellipse cx="24" cy="25" rx="15" ry="9" fill="#FFF3D6"/>` + dots([[17, 24], [26, 21], [31, 27], [22, 30]], 3, C.tomato) + leaf(25, 25, -30, 0.7) + leaf(15, 28, 200, 0.6, C.oliveL),
    hat: `<path d="M12 28c-6-2-7-12 1-13 2-6 11-8 15-3 6-2 11 4 8 9 3 3 1 7-3 7v6H12z" fill="${C.cream}" ${S}/><path d="M12 36h24" stroke="${C.ink}" stroke-width="1.4"/>`
  };

  /* ---------- the tomato vine for the masthead ---------- */
  const VINE = svg('0 0 170 130',
    `<path d="M170 8C140 14 112 34 94 66" fill="none" stroke="${C.olive}" stroke-width="2.4" stroke-linecap="round"/>` +
    leaf(150, 12, 160, 1.3) + leaf(128, 24, 200, 1.2, C.oliveL) + leaf(112, 40, 150, 1.2) + leaf(136, 34, 70, 1.1, C.oliveL) + leaf(104, 52, 210, 1.1) +
    tomato(146, 56, 17) + tomato(118, 84, 15) + tomato(158, 96, 14) + tomato(96, 70, 9) +
    `<path d="M146 40l-4-18M118 70l4-18M158 82l-6-24" stroke="${C.olive}" stroke-width="2" stroke-linecap="round" fill="none"/>`, 'vine');

  /* ---------- public helpers ---------- */
  // assets.json maps slots to image files. Any slot left empty uses the drawings above.
  let assets = { header: '', protein: {}, mealType: {}, glance: {}, decor: {}, mascot: {}, recipes: {} };
  const MEAL_ICON = { bowls: 'rice', pasta: 'pasta', skillet: 'pan', 'sheet-pan': 'sheetpan', soup: 'soup', tacos: 'taco', 'flatbread-pizza': 'flatbread' };
  const imgTag = (src, cls) => `<img class="${cls}" src="${src}" alt="" loading="lazy" decoding="async">`;
  window.DDArt = {
    configure: (a) => { assets = Object.assign({ header: '', protein: {}, mealType: {}, glance: {}, decor: {}, mascot: {}, recipes: {} }, a || {}); },
    decor: (k, cls) => (assets.decor && assets.decor[k]) ? imgTag(assets.decor[k], cls || 'decor') : '',
    mascot: (k, cls) => (assets.mascot && assets.mascot[k]) ? imgTag(assets.mascot[k], cls || 'mascot') : '',
    vine: () => (assets.header ? imgTag(assets.header, 'vine') : VINE),
    protein: (p, cls) => (assets.protein && assets.protein[p]) ? imgTag(assets.protein[p], cls || '') : svg('0 0 48 48', PROTEIN[p] || PROTEIN_FALLBACK, cls),
    mealType: (m, cls) => (assets.mealType && assets.mealType[m]) ? imgTag(assets.mealType[m], cls || '') : svg('0 0 48 48', GLANCE[MEAL_ICON[m]] || GLANCE.pan, cls),
    glance: (k, cls) => (assets.glance && assets.glance[k]) ? imgTag(assets.glance[k], cls || '') : svg('0 0 48 48', GLANCE[k] || GLANCE.pan, cls),
    dish: (r, cls) => {
      const src = r.image || (assets.recipes && assets.recipes[r.id]);
      if (src) return imgTag(src, cls || 'dish');
      const f = DISHES[r.art];
      return f ? svg('0 0 120 120', f(), cls || 'dish') : svg('0 0 48 48', PROTEIN[r.protein && r.protein[0]] || PROTEIN_FALLBACK, cls || 'dish');
    }
  };
})();
