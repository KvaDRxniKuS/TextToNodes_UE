#!/usr/bin/env node
// Демо «HUD здоровья»: Create Widget + Format Text + RepNotify-переменная. Связная схема для вставки в BP персонажа.
// Ассет WBP_HUD (TextBlock HealthText, ProgressBar HealthBar) создаётся вручную — пузыри на нодах говорят, что сделать.
// Стадии: генератор (ноды+связи) → расстановщик (arrangeRows). Декоратор отложен.
import fs from 'node:fs';
import { createCallFunction, createOperator, createBranch, linkPins } from '../src/generator.js';
import { createCall, createCustomEvent, createCallCustomEvent, createSelfVar, createReplicatedVarSet, createWidget, createFormatText, createMemberVar } from '../src/modules.js';
import { positionBlueprint } from '../src/layout-pipeline.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { createComment, fitComment } from '../src/generator.js';

const out = process.argv[2] || 'sweep/chapters/hud-health-demo.txt';
seedGuids('hud-health-demo');
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const op = (id) => createOperator(reg.find(x => x.id === id));
const fn = (id) => { const e = reg.find(x => x.id === id); if (!e) throw new Error(id); return createCallFunction(e); };
const BP = '/Game/Blueprints/BP_HealthDemo';
const HUD_CLS = '/Game/UI/WBP_HUD';
const sv = (k, name, type, v = '') => createSelfVar(k, name, type, v, { bp: BP });
const HUD_T = 'object:/Game/UI/WBP_HUD';   // переменная HUD — ссылка на WBP_HUD (не UserWidget): виджеты берутся как его поля
// GetWidgetFromName в BP не выставлен (не вставился) → поля WBP_HUD напрямую (TextBlock/ProgressBar с Is Variable)
const widgetVar = (name, cls) => createMemberVar('get', `${HUD_CLS}.${name}`, `object:${cls}`);

// ── ряд A: InitHUD → Create WBP_HUD → Set HUD → Add to Viewport → UpdateHUD
// K2Node_Event вставкой ломается (E08) → свой Custom Event, пользователь подключает его к Event BeginPlay
const begin = createCustomEvent('InitHUD');
begin.bubble = 'Вызовите из Event BeginPlay (только у локального игрока: Is Locally Controlled)';
const pc = fn('GetPlayerController');
const create = createWidget(HUD_CLS);
create.bubble = 'СНАЧАЛА создайте Widget Blueprint /Game/UI/WBP_HUD: TextBlock HealthText и ProgressBar HealthBar, у обоих галка Is Variable';
const setHud = sv('set', 'HUD', HUD_T);
setHud.bubble = 'Переменная HUD: тип WBP_HUD (Object Reference)';
const add = fn('AddToViewport');
const update = createCustomEvent('UpdateHUD');
update.bubble = 'Вызывайте из OnRep_Health (движок создаст функцию, когда Health = RepNotify)';
const callUpdA = createCallCustomEvent(update);
linkPins(begin, 'then', create, 'execute');
linkPins(pc, 'ReturnValue', create, 'OwningPlayer');
linkPins(create, 'then', setHud, 'execute');
linkPins(create, 'ReturnValue', setHud, 'HUD');
linkPins(setHud, 'then', add, 'execute');
linkPins(setHud, 'Output_Get', add, 'self');
linkPins(add, 'then', callUpdA, 'execute');

// ── ряд B: TakeHit(Damage) → Health = clamp(Health − Damage, 0, MaxHealth) [RepNotify]
const hit = createCustomEvent('TakeHit', ['Damage:float']);
hit.bubble = 'Вызывать на сервере (Health реплицируется, OnRep_Health обновит HUD у клиентов)';
const getH = sv('get', 'Health', 'float'), getMax = sv('get', 'MaxHealth', 'float');
const sub = op('Subtract_Float'), clamp = fn('Clamp_Float');
const setH = createReplicatedVarSet('Health', 'float', '', { bp: BP });
linkPins(getH, 'Health', sub, 'A');
linkPins(hit, 'Damage', sub, 'B');
linkPins(sub, 'ReturnValue', clamp, 'Value');
linkPins(getMax, 'MaxHealth', clamp, 'Max');
linkPins(clamp, 'ReturnValue', setH, 'Health');
linkPins(hit, 'then', setH, 'execute');

// ── ряд C: UpdateHUD → IsValid(HUD)? → HealthText.SetText(Format) → HealthBar.SetPercent(Health / Max)
const getHud = sv('get', 'HUD', HUD_T);
const valid = fn('IsValid_Object');
const br = createBranch();
const hText = widgetVar('HealthText', '/Script/UMG.TextBlock');
const fmt = createFormatText('HP: {Health} / {MaxHealth}', { Health: 'float', MaxHealth: 'float' });
const getH2 = sv('get', 'Health', 'float'), getMax2 = sv('get', 'MaxHealth', 'float');
const setText = fn('SetText');
const getHud2 = sv('get', 'HUD', HUD_T); // Get у каждого потребителя, без шины от переменной
const hBar = widgetVar('HealthBar', '/Script/UMG.ProgressBar');
const getH3 = sv('get', 'Health', 'float'), getMax3 = sv('get', 'MaxHealth', 'float');
const div = op('Divide_Float');
const setPct = fn('SetPercent');
linkPins(getHud, 'HUD', valid, 'Object');
linkPins(valid, 'ReturnValue', br, 'Condition');
linkPins(update, 'then', br, 'execute');
linkPins(getHud, 'HUD', hText, 'self');
linkPins(br, 'then', setText, 'execute');
linkPins(hText, 'HealthText', setText, 'self');
linkPins(getH2, 'Health', fmt, 'Health');
linkPins(getMax2, 'MaxHealth', fmt, 'MaxHealth');
linkPins(fmt, 'Result', setText, 'InText');
linkPins(setText, 'then', setPct, 'execute');
linkPins(getHud2, 'HUD', hBar, 'self');
linkPins(hBar, 'HealthBar', setPct, 'self');
linkPins(getH3, 'Health', div, 'A');
linkPins(getMax3, 'MaxHealth', div, 'B');
linkPins(div, 'ReturnValue', setPct, 'InPercent');

const rows = [
  [begin, pc, create, setHud, add, callUpdA],
  [hit, getH, getMax, sub, clamp, setH],
  [update, getHud, valid, br, hText, getH2, getMax2, fmt, setText],
  [getHud2, hBar, getH3, getMax3, div, setPct],
];
const all = rows.flat();
const res = positionBlueprint(all, { rows, arrange: { x: 0, y: 0, gap: 64, rowGap: 288 } });
const titles = ['A — создание HUD', 'B — урон (Health = RepNotify)', 'C — обновление HUD: текст', 'C — обновление HUD: полоска'];
const comments = rows.map((r, i) => fitComment(titles[i], r, 96, 128, 96));
const text = generateUEText([...comments, ...res.nodes]);
const v = validateStrict(text);
fs.writeFileSync(out, text);
console.log(`${out}: нод ${res.nodes.length}, ряды ${rows.map(r => r.length).join('/')}, STRICT ${v.valid ? 'OK' : 'FAIL'} errors=${v.errors.length} warnings=${v.warnings.length}`);
v.errors.forEach(e => console.log('  ERR ' + e));
v.warnings.forEach(e => console.log('  W ' + e));
if (!v.valid) process.exit(1);
