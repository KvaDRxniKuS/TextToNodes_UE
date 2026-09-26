#!/usr/bin/env node
// tools/inventory.mjs — P2 «контекст-первый»: инвентарь целевой функции/графа ДО генерации фрагмента.
//
//   node tools/inventory.mjs dump.txt [-o ctx.json]
//
// dump.txt — копия графа из UE (Ctrl+A → Ctrl+C) или экспорт песочницы. Извлекает:
//   members   — свои переменные BP (VariableGet/Set с bSelfContext)            { name, type, guid }
//   locals    — локалы функций (LocalVariables(i) у FunctionEntry + MemberScope) { scope, name, type, guid }
//   params    — входы/выходы функций (FunctionEntry/FunctionResult, UserDefinedPin) { scope, name, type, dir }
//   external  — свойства чужих классов (MemberParent)                           { owner, name, type }
//   composites/tunnels — свёрнутые графы и их туннели (K2Node_Tunnel_* — порты фрагмента)
//   calls     — вызываемые функции (для справки)
// Результат — ctx.json для `make-node --context` и `validate --context`: любая VariableGet/Set вне
// инвентаря = E19 (или явно `--new Имя` — «создаю новую», завести в BP вручную).
import fs from 'node:fs';
import { inventory } from '../src/inventory.js';

const argv = process.argv.slice(2);
const oi = argv.indexOf('-o');
const out = oi >= 0 ? argv[oi + 1] : '';
const file = argv.find((a, i) => !a.startsWith('-') && i !== oi + 1);
if (!file) { console.error('usage: node tools/inventory.mjs dump.txt [-o ctx.json]'); process.exit(1); }

const inv = inventory(fs.readFileSync(file, 'utf8'));
inv.source = file;
const json = JSON.stringify(inv, null, 1);
if (out) fs.writeFileSync(out, json + '\n'); else process.stdout.write(json + '\n');
const fmt = l => l.map(v => `${v.scope ? v.scope + '.' : ''}${v.name}:${v.type}`).join(', ') || '—';
console.error(`inventory: members=${inv.members.length} locals=${inv.locals.length} params=${inv.params.length} external=${inv.external.length} composites=${inv.composites.length} tunnels=${inv.tunnels.length}`);
console.error(`  members: ${fmt(inv.members)}\n  locals:  ${fmt(inv.locals)}\n  params:  ${fmt(inv.params)}`);
