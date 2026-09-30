// Секционная раскладка «расчётного» графа — по мотивам структурированного графа пользователя (2026-09-30):
//   • граф режется на логические секции, каждая в своём комментарии (A — базовые, B — …);
//   • в секции: Sequence слева сверху; Set-ноды столбиком справа (then_i → Set i);
//   • под Sequence — деревья чистых вычислений, листья (Get) слева, результат идёт в значение своего Set;
//   • последний выход Sequence уходит exec-шиной по низу секции (knot'ы) во вход Sequence следующей секции;
//   • ветвление: Branch в столбце Set'ов, его Set'ы — следующим столбцом справа.
// Ступень 1 (buildSections) — только ноды и связи, без координат.
// Ступень 2 (arrangeSections) — координаты, knot'ы шины, боксы-комментарии. Код нод не трогает.
import fs from 'fs';
import { createSequence, createBranch, createKnot, createComment, createFromEntry, linkPins, estNodeWidth } from './generator.js';
import { createSelfVar, createCustomEvent, createDelegateNode, createEventFor } from './modules.js';

const REG = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const byId = id => { const e = REG.find(x => x.id === id); if (!e) throw new Error(`нет в реестре: ${id}`); return e; };
// оп → [id реестра, входы]
const OPS = {
  '+': ['Add_Float', ['A', 'B']], '-': ['Subtract_Float', ['A', 'B']], '*': ['Multiply_Float', ['A', 'B']], '/': ['Divide_Float', ['A', 'B']],
  '>': ['Greater_Float', ['A', 'B']], '<': ['Less_Float', ['A', 'B']], '<=': ['LessEqual_Float', ['A', 'B']], '>=': ['GreaterEqual_Float', ['A', 'B']],
  abs: ['Abs_Float', ['A']], sign: ['Sign_Float', ['A']], sq: ['Square_Float', ['A']],
  max: ['Max_Float', ['A', 'B']], min: ['Min_Float', ['A', 'B']], clamp: ['Clamp_Float', ['Value', 'Min', 'Max']],
};

// ── ступень 1 ────────────────────────────────────────────────────────────────
/** spec: { event, bp, sections:[{ title, steps:[ {set, type?, expr} | {branch: expr, then:[set-steps], else:[set-steps]} ] }] }
 *  expr: 'Var' | число | [op, ...args] */
export function buildSections(spec) {
  const all = [];
  const add = n => (all.push(n), n);
  const get = name => add(createSelfVar('get', name, 'float', '', { bp: spec.bp }));
  let bus = null;                  // шина секции: '$Имя' → один выход ноды-вычисления + полоса knot'ов (ступень 2)
  function expr(e) {               // → { node, out, kids:[subtree] } | { literal }
    if (typeof e === 'number') return { literal: e.toFixed(6) };
    if (typeof e === 'string' && e[0] === '$') {
      const name = e.slice(1);
      if (!bus) throw new Error(`шина ${e}: только в секции layout:'chain' с bus:'${name}'`);
      if (bus.name !== name) throw new Error(`шина ${e}: в секции объявлена ${bus.name}`);
      return { node: bus.node, out: bus.out, kids: [], bus: true };
    }
    if (typeof e === 'string') { const n = get(e); return { node: n, out: e, kids: [] }; }
    const [op, ...args] = e; const [id, ins] = OPS[op] || [];
    if (!id) throw new Error(`оп ${op}`);
    const n = add(createFromEntry(byId(id)));
    const kids = [];
    args.forEach((a, i) => {
      const t = expr(a), pin = n.pins.find(p => p.name === ins[i] && p.direction === 'Input');
      if (t.literal) { pin.defaultValue = t.literal; return; }
      linkPins(t.node, t.out, n, ins[i]);
      if (t.bus) bus.uses.push({ node: n, pin: ins[i] }); else kids.push(t);
    });
    return { node: n, out: 'ReturnValue', kids };
  }
  function setStep(s) {
    const n = add(createSelfVar('set', s.set, s.type || 'float', '', { bp: spec.bp }));
    const t = s.expr === undefined ? null : expr(s.expr);
    if (t && t.literal) n.pins.find(p => p.name === s.set).defaultValue = t.literal;
    else if (t) { linkPins(t.node, t.out, n, s.set); if (t.bus) bus.uses.push({ node: n, pin: s.set }); }
    return { kind: 'set', node: n, tree: t && !t.literal && !t.bus ? t : null };
  }
  const entry = add(createCustomEvent(spec.event, []));
  const sections = spec.sections.map(sec => {
    if (sec.layout === 'bind') {        // ряд подписок: then_0 → Bind1 → Bind2 → …; под каждым Bind — своё событие и его ряд
      const binds = sec.binds.map(b => {
        const bind = add(createDelegateNode('bind', b.delegate));
        const ev = add(createEventFor(b.delegate, b.handler));
        linkPins(ev, 'OutputDelegate', bind, 'Delegate');
        const steps = b.steps.map(setStep);
        if (steps[0]) linkPins(ev, 'then', steps[0].node, 'execute');
        steps.slice(1).forEach((st, i) => linkPins(steps[i].node, 'then', st.node, 'execute'));
        return { node: bind, ev, steps };
      });
      const seq = add(createSequence(2));
      linkPins(seq, 'then_0', binds[0].node, 'execute');
      binds.slice(1).forEach((b, i) => linkPins(binds[i].node, 'then', b.node, 'execute'));
      return { title: sec.title, seq, steps: [], binds, bind: true, lastOut: 'then_1' };
    }
    bus = null;
    if (sec.bus) {
      // Правило пользователя (2026-09-30): шина — от ВЫХОДА НОДЫ, не от переменной. Переменную проще поставить
      // Get'ом у каждого потребителя; у несохранённого результата точка выхода одна — от неё и тянется шина.
      if (sec.layout !== 'chain') throw new Error(`bus '${sec.bus.name || sec.bus}' — только в layout:'chain'`);
      if (typeof sec.bus !== 'object' || !Array.isArray(sec.bus.expr))
        throw new Error(`bus: нужен { name, expr:[оп, …] } — шина тянется от выхода ноды; переменную ставьте Get'ом у каждого потребителя`);
      const t = expr(sec.bus.expr);
      bus = { name: sec.bus.name, node: t.node, out: t.out, tree: t, uses: [] };
    }
    const steps = sec.steps.map(s => {
      if (!s.branch) return setStep(s);
      const b = add(createBranch());
      const t = expr(s.branch); linkPins(t.node, t.out, b, 'Condition');
      const yes = s.then.map(setStep), no = s.else.map(setStep);
      if (yes[0]) linkPins(b, 'then', yes[0].node, 'execute');
      if (no[0]) linkPins(b, 'else', no[0].node, 'execute');
      [yes, no].forEach(ch => ch.slice(1).forEach((st, i) => linkPins(ch[i].node, 'then', st.node, 'execute')));
      return { kind: 'branch', node: b, tree: t, yes, no };
    });
    if (sec.layout === 'chain') {       // цепочка: then_0 → Set1 → Set2 → …, then_1 → дальше
      const seq = add(createSequence(2));
      linkPins(seq, 'then_0', steps[0].node, 'execute');
      steps.slice(1).forEach((st, i) => linkPins(steps[i].node, 'then', st.node, 'execute'));
      return { title: sec.title, seq, steps, chain: true, bus, lastOut: 'then_1' };
    }
    const seq = add(createSequence(steps.length + 1));
    steps.forEach((st, i) => linkPins(seq, `then_${i}`, st.node, 'execute'));
    return { title: sec.title, seq, steps, lastOut: `then_${steps.length}` };
  });
  linkPins(entry, 'then', sections[0].seq, 'execute');
  sections.slice(1).forEach((sec, i) => linkPins(sections[i].seq, sections[i].lastOut, sec.seq, 'execute'));
  return { entry, sections, nodes: all };
}

// ── ступень 2 ────────────────────────────────────────────────────────────────
const G = 16, snap = v => Math.round(v / G) * G;
const LEAF_H = 48, COL_GAP = 32, SET_STEP = 112, PAD = 64, TITLE = 64, SEC_GAP = 48, SEQ_W = 160;
const w = n => Math.max(estNodeWidth(n), n.varName ? 80 + 7 * n.varName.length : 0);
// высота поддерева: сумма детей, но не меньше собственной ноды (чистый оп ≈ 40 + 24·входов)
const ownH = n => n.varName ? LEAF_H : 48 + 24 * n.pins.filter(p => p.direction === 'Input' && !p.hidden).length;
const treeH = t => Math.max(ownH(t.node), t.kids.reduce((s, k) => s + treeH(k), 0));
const depth = t => 1 + Math.max(0, ...t.kids.map(depth));

/** Дерево справа налево: корень у правой границы xR, листья левее; узел — на уровне первого ребёнка. */
function placeTree(t, xR, y, colW, d = 0) {
  t.node.pos = { x: snap(xR - colW[d]), y: snap(y) };
  let yy = y;
  for (const k of t.kids) { placeTree(k, xR - colW[d] - COL_GAP, yy, colW, d + 1); yy += treeH(k); }
}
function colWidths(trees) {
  const cw = [];
  const walk = (t, d) => { cw[d] = Math.max(cw[d] || 0, w(t.node)); t.kids.forEach(k => walk(k, d + 1)); };
  trees.forEach(t => walk(t, 0));
  return cw;
}

function unlink(a, ap, b, bp) {
  const o = a.pins.find(p => p.name === ap && p.direction === 'Output'), i = b.pins.find(p => p.name === bp && p.direction === 'Input');
  o.linkedTo = o.linkedTo.filter(l => l.pinId !== i.id); i.linkedTo = i.linkedTo.filter(l => l.pinId !== o.id);
}

export function arrangeSections(built, origin = { x: 0, y: 0 }) {
  const knots = [], comments = [];
  let x0 = origin.x;
  built.entry.pos = { x: snap(x0), y: snap(origin.y + TITLE) };
  x0 += 256;
  built.sections.forEach((sec, si) => {
    const trees = sec.steps.flatMap(st => [st.tree, ...(st.yes || []).map(c => c.tree), ...(st.no || []).map(c => c.tree)]).filter(Boolean);
    const cw = colWidths(trees);
    const treesW = cw.reduce((a, b) => a + b + COL_GAP, 0);
    const top = origin.y + TITLE;
    const left = x0 + PAD;
    // Sequence слева сверху, деревья под ним, столбец Set'ов справа от деревьев
    sec.seq.pos = { x: snap(left), y: snap(top) };
    const setX = snap(left + Math.max(SEQ_W, treesW) + 96);
    let treeY = top + 32 + 24 * (sec.steps.length + 1);
    let setY = top, maxX = sec.chain || sec.bind ? left : setX, bottom = treeY;
    if (sec.bind) {                       // Bind'ы в ряд; под каждым — событие и его цепочка Set'ов, деревья ниже цепочки
      let cur = left + SEQ_W + 64; bottom = top + 112;
      const evY = top + 192;
      for (const b of sec.binds) {
        const bx = snap(cur);
        b.node.pos = { x: bx, y: snap(top) };
        b.ev.pos = { x: bx, y: snap(evY) };
        let rx = bx + Math.max(w(b.ev), 256) + 64;
        for (const st of b.steps) {
          const cwi = st.tree ? colWidths([st.tree]) : [];
          const tw = cwi.reduce((a, c) => a + c + COL_GAP, 0);
          const sx = snap(Math.max(rx, st.tree ? rx + tw - 128 : rx) + 32);
          st.node.pos = { x: sx, y: snap(evY) };
          if (st.tree) { placeTree(st.tree, sx - 32, evY + 144, cwi); bottom = Math.max(bottom, evY + 144 + treeH(st.tree)); }
          rx = sx + w(st.node) + 32;
        }
        bottom = Math.max(bottom, evY + 160);
        const colR = Math.max(bx + w(b.node), rx);
        maxX = Math.max(maxX, colR);
        cur = colR + 96;
      }
    }
    if (sec.chain) {                      // Set'ы в ряд; дерево каждого — в промежутке перед ним, ниже ряда
      let cur = left + SEQ_W + 64; bottom = top + 112;
      const busLane = sec.bus ? top + 144 : 0, treeTop = top + (sec.bus ? 208 : 144);
      if (sec.bus) {                      // дерево-источник шины — под Sequence, корень справа, листья левее
        const bcw = colWidths([sec.bus.tree]), bw = bcw.reduce((a, c) => a + c + COL_GAP, 0) - COL_GAP;
        placeTree(sec.bus.tree, left + bw, busLane, bcw);
        bottom = Math.max(bottom, busLane + treeH(sec.bus.tree));
        cur = Math.max(cur, left + bw + 64);
      }
      for (const st of sec.steps) {
        const cwi = st.tree ? colWidths([st.tree]) : [];
        const tw = cwi.reduce((a, b) => a + b + COL_GAP, 0);
        const sx = snap(cur + tw + 32);
        st.node.pos = { x: sx, y: snap(top) };
        if (st.tree) { placeTree(st.tree, sx - 32, treeTop, cwi); bottom = Math.max(bottom, treeTop + treeH(st.tree)); }
        cur = sx + w(st.node) + 32; maxX = Math.max(maxX, sx + w(st.node));
      }
      if (sec.bus) {                      // шина: выход ноды → knot → knot → … по полосе между рядом и деревьями; от knot'а — вниз к потребителю
        const b = sec.bus, uses = [...b.uses].sort((a, c) => a.node.pos.x - c.node.pos.x);
        const laneY = snap(busLane + 16);
        let prev = b.node, prevPin = b.out, lastX = -Infinity;
        for (const u of uses) {
          unlink(b.node, b.out, u.node, u.pin);
          let kx = snap(u.node.pos.x - 48);
          if (kx <= lastX + 32) kx = lastX + 32;   // knot'ы не касаются
          const src = b.node.pins.find(p => p.name === b.out && p.direction === 'Output');
          const k = createKnot({ x: kx, y: laneY }, src.category);
          k.pins.forEach(p => { p.subCategory = src.subCategory; p.subCategoryObject = src.subCategoryObject; });
          linkPins(prev, prevPin, k, 'InputPin'); linkPins(k, 'OutputPin', u.node, u.pin);
          knots.push(k); prev = k; prevPin = 'OutputPin'; lastX = kx;
        }
      }
    }
    for (const st of (sec.chain ? [] : sec.steps)) {
      st.node.pos = { x: setX, y: snap(setY) };
      if (st.tree) { placeTree(st.tree, setX - 96, treeY, cw); treeY += treeH(st.tree) + 16; }
      let rowH = SET_STEP;
      if (st.kind === 'branch') {         // ветки — следующим столбцом, then сверху, else снизу
        const kids = [...st.yes, ...st.no].map(c => c.tree).filter(Boolean);
        const kcw = colWidths(kids);
        const bx = snap(setX + 224 + kcw.reduce((a, b) => a + b + COL_GAP, 0)); let by = setY;
        for (const c of [...st.yes, ...st.no]) {
          c.node.pos = { x: bx, y: snap(by) };
          if (c.tree) { placeTree(c.tree, bx - 32, snap(by + 48), kcw); }
          by += Math.max(SET_STEP, (c.tree ? treeH(c.tree) : 0) + 64); maxX = Math.max(maxX, bx + w(c.node));
        }
        rowH = Math.max(SET_STEP, by - setY);
      }
      setY += rowH; maxX = Math.max(maxX, setX + w(st.node));
      bottom = Math.max(bottom, treeY, setY);
    }
    // шина: последний then Sequence → knot под деревьями → knot у правого края → следующая секция
    const busY = snap(bottom + 16);
    const last = sec.lastOut;
    if (si < built.sections.length - 1) {
      const k1 = createKnot({ x: snap(left + SEQ_W + 16), y: busY }, 'exec');
      const k2 = createKnot({ x: snap(maxX + PAD - 16), y: busY }, 'exec');
      const next = built.sections[si + 1].seq;
      unlink(sec.seq, last, next, 'execute');
      linkPins(sec.seq, last, k1, 'InputPin'); linkPins(k1, 'OutputPin', k2, 'InputPin'); linkPins(k2, 'OutputPin', next, 'execute');
      knots.push(k1, k2);
    }
    const boxR = maxX + PAD, boxB = busY + PAD;
    const cm = createComment(sec.title, { x: snap(x0), y: snap(origin.y) }, snap(boxR - x0), snap(boxB - origin.y));
    comments.push(cm);
    x0 = snap(boxR + SEC_GAP);
  });
  return { knots, comments };
}
