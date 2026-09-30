#!/usr/bin/env node
// Демо секционной раскладки (src/section-layout.js): шаг баллистики снаряда, 4 секции.
// Структура по образцу графа пользователя: секции-комментарии, Sequence → столбец Set, локальные цепочки данных.
// Переменные — float-члены BP; в чужом BP ПКМ по ноде → Create variable.
import fs from 'node:fs';
import { seedGuids, generateUEText } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { buildSections, arrangeSections } from '../src/section-layout.js';
import { lintLayout } from '../src/layout-lint.js';

const out = process.argv[2] || 'sweep/layout/structured-demo.txt';
seedGuids('structured-demo');
const spec = {
  event: 'BallisticStep', bp: '/Game/Demo/BP_Projectile',
  sections: [
    { title: 'A - базовые переменные', steps: [
      { set: 'Speed', expr: ['max', ['abs', 'VelX'], 0.01] },
      { set: 'Rho', expr: ['*', 'AirDensity', 'DragScale'] },
      { set: 'Area', expr: ['*', ['sq', 'Radius'], 3.14159] },
    ] },
    { title: 'B - сопротивление', steps: [
      { set: 'Drag', expr: ['*', ['*', ['*', 0.5, 'Rho'], ['*', 'Cd', 'Area']], ['sq', 'Speed']] },
      { set: 'DragAx', expr: ['*', ['/', 'Drag', ['max', 'Mass', 0.001]], ['*', ['sign', 'VelX'], -1]] },
    ] },
    // шина — от выхода ноды (Dt·TimeScale не сохранён в переменную → одна точка выхода); переменные — Get'ом по месту
    { title: 'C - интегрирование (цепочка, шина Dt·TimeScale)', layout: 'chain', bus: { name: 'StepDt', expr: ['*', 'Dt', 'TimeScale'] }, steps: [
      { set: 'VelX', expr: ['+', 'VelX', ['*', 'DragAx', '$StepDt']] },
      { set: 'VelZ', expr: ['-', 'VelZ', ['*', 'Gravity', '$StepDt']] },
      { set: 'PosX', expr: ['+', 'PosX', ['*', 'VelX', '$StepDt']] },
      { set: 'PosZ', expr: ['+', 'PosZ', ['*', 'VelZ', '$StepDt']] },
    ] },
    { title: 'D - земля', steps: [
      { branch: ['<', 'PosZ', 'GroundZ'],
        then: [{ set: 'PosZ', expr: 'GroundZ' }, { set: 'VelZ', expr: ['*', ['*', 'VelZ', -1], ['clamp', 'Restitution', 0, 1]] }],
        else: [{ set: 'Airtime', expr: ['+', 'Airtime', 'Dt'] }] },
    ] },
    // ряд подписок: Bind'ы в линию, под каждым — своё событие-обработчик и его короткий ряд
    { title: 'E - подписки', layout: 'bind', binds: [
      { delegate: 'Actor.OnActorHit', handler: 'OnProjectileHit', steps: [
        { set: 'Hits', expr: ['+', 'Hits', 1] }, { set: 'VelX', expr: ['*', 'VelX', 0.5] }] },
      { delegate: 'Actor.OnDestroyed', handler: 'OnProjectileDestroyed', steps: [
        { set: 'Airtime', expr: 0 }] },
    ] },
  ],
};
const built = buildSections(spec);
const { knots, comments } = arrangeSections(built);
const text = generateUEText([...comments, ...built.nodes, ...knots]);
const v = validateStrict(text);
fs.writeFileSync(out, text);
console.log(`${out}: нод ${built.nodes.length + knots.length}, секций ${comments.length}, STRICT ${v.valid ? 'OK' : 'FAIL'}`);
const lint = lintLayout([...built.nodes, ...knots]);
lint.forEach(l => console.log(`  ${l.code} ${l.msg}`));
console.log(`линтер раскладки: ${lint.length} замечаний`);
if (!v.valid) { console.log(JSON.stringify(v.errors || v, null, 1).slice(0, 2000)); process.exit(1); }
