#!/usr/bin/env node
// round22: каст к любому классу.
//   node tools/gen-cast.mjs <Класс> [--class] [--pure]
//   <Класс>: Pawn | /Script/Module.Class | /Game/Path/BP_Name (BP → BlueprintGeneratedClass, _C добавится сам)
//   node tools/gen-cast.mjs --demo → sweep/22b-cast-any.txt
import fs from 'node:fs';
import { createCast, layoutRow, fitComment } from '../src/generator.js';
import { generateUEText } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';

const args = process.argv.slice(2);
if (args[0] === '--demo') {
  const nodes = [
    createCast('StaticMeshActor'),
    createCast('/Script/Engine.CharacterMovementComponent'),
    createCast('GameModeBase'),
    createCast('/Game/Blueprints/BP_AISupportTester'),
    createCast('Character', { pure: true }),
    createCast('Pawn', { kind: 'class' }),
    createCast('Actor', { kind: 'class' }),
    createCast('/Game/Blueprints/BP_AISupportTester', { kind: 'class' }),
  ];
  layoutRow(nodes.slice(0, 4), 0, 0);
  layoutRow(nodes.slice(4), 0, 360);
  const cm = fitComment('SWEEP 22b: Cast к любому классу — объект (4), pure (1), класс (3)', nodes);
  const t = generateUEText([cm, ...nodes]);
  const v = validateStrict(t);
  fs.writeFileSync(new URL('../sweep/22b-cast-any.txt', import.meta.url), t);
  console.log(`22b: nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length}`);
  v.errors.forEach(e => console.log('  ', e));
} else if (args[0]) {
  const n = createCast(args[0], { kind: args.includes('--class') ? 'class' : 'object', pure: args.includes('--pure') });
  process.stdout.write(generateUEText([n]) + '\n');
} else {
  console.error('usage: node tools/gen-cast.mjs <Class> [--class] [--pure] | --demo');
  process.exit(1);
}
