// src/ue-types.js — единый источник правды для путей движка UE.
// Используют: src/generator.js, src/parser.js, src/validate.js, docs, prompt.
// ВАЖНО: дублируется мини-копией в index.html
// (UE_VERSION/UE_LIBS/UE_STRUCTS/UE_ENUMS/classRef/macroRefs) — при изменении синхронизируй оба места.
//
// v5: ground truth от UE4 (copy-back H1/G1, 2026-09-25).
// UE4 пишет ссылки В КАВЫЧКАХ, ПОЛНОЙ формой, БЕЗ внутренних двойных кавычек:
//   MemberParent="/Script/CoreUObject.Class'/Script/Engine.KismetSystemLibrary'"
//   PinSubCategoryObject="/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Vector'"
//   PinSubCategoryObject="/Script/CoreUObject.Class'/Script/CoreUObject.Object'"  (WCO-пин)
// Короткую форму (Class'"..."') UE4 на входе ТОЖЕ принимает (H1 вставился с короткой),
// но каноника — полная в кавычках, её и генерируем.
// Struct-пины: PinSubCategory="" (ПУСТО! имя типа только из SubCategoryObject).
// Core-структуры в UE4 живут в /Script/CoreUObject.* (в UE5 — /Script/Core.*)!
// UE5-формы (короткие, с внутренними кавычками) — по blueprintue-знаниям, движком НЕ проверены.

// Версия движка-цели: 'UE4' (проверено copy-back) | 'UE5' (не проверено).
export const UE_VERSION = 'UE4';

const LIBS_UE4 = {
  KismetMathLibrary:   `"/Script/CoreUObject.Class'/Script/Engine.KismetMathLibrary'"`,
  KismetSystemLibrary: `"/Script/CoreUObject.Class'/Script/Engine.KismetSystemLibrary'"`,
  KismetStringLibrary: `"/Script/CoreUObject.Class'/Script/Engine.KismetStringLibrary'"`,
  KismetTextLibrary:   `"/Script/CoreUObject.Class'/Script/Engine.KismetTextLibrary'"`,
  KismetArrayLibrary:  `"/Script/CoreUObject.Class'/Script/Engine.KismetArrayLibrary'"`,
  GameplayStatics:     `"/Script/CoreUObject.Class'/Script/Engine.GameplayStatics'"`,
};
const LIBS_UE5 = {
  KismetMathLibrary:   `Class'"/Script/Engine.KismetMathLibrary"'`,
  KismetSystemLibrary: `Class'"/Script/Engine.KismetSystemLibrary"'`,
  KismetStringLibrary: `Class'"/Script/Engine.KismetStringLibrary"'`,
  KismetTextLibrary:   `Class'"/Script/Engine.KismetTextLibrary"'`,
  KismetArrayLibrary:  `Class'"/Script/Engine.KismetArrayLibrary"'`,
  GameplayStatics:     `Class'"/Script/Engine.GameplayStatics"'`,
};
export const UE_LIBS = UE_VERSION === 'UE5' ? LIBS_UE5 : LIBS_UE4;

// PinSubCategoryObject / StructType для struct-пинов.
const STRUCTS_UE4 = {
  Vector:      `"/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Vector'"`,      // confirmed (паттерн LinearColor из copy-back)
  Rotator:     `"/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Rotator'"`,
  Vector2D:    `"/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Vector2D'"`,
  Transform:   `"/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Transform'"`,
  LinearColor: `"/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.LinearColor'"`, // confirmed (copy-back H1)
  HitResult:   `"/Script/CoreUObject.ScriptStruct'/Script/Engine.HitResult'"`,
  Key:         `"/Script/CoreUObject.ScriptStruct'/Script/InputCore.Key'"`,
  // InputActionValue — только UE5 (EnhancedInput): в UE4-словаре отсутствует намеренно.
};
const STRUCTS_UE5 = {
  Vector:           `ScriptStruct'"/Script/Core.Vector"'`,
  Rotator:          `ScriptStruct'"/Script/Core.Rotator"'`,
  Vector2D:         `ScriptStruct'"/Script/Core.Vector2D"'`,
  Transform:        `ScriptStruct'"/Script/Core.Transform"'`,
  LinearColor:      `ScriptStruct'"/Script/Core.LinearColor"'`,
  HitResult:        `ScriptStruct'"/Script/Engine.HitResult"'`,
  Key:              `ScriptStruct'"/Script/InputCore.Key"'`,
  InputActionValue: `ScriptStruct'"/Script/EnhancedInput.InputActionValue"'`,
};
export const UE_STRUCTS = UE_VERSION === 'UE5' ? STRUCTS_UE5 : STRUCTS_UE4;

// Enum-пины: PinCategory="byte" + PinSubCategoryObject=путь энама (+ DefaultValue с именем элемента).
const ENUMS_UE4 = {
  ETraceTypeQuery: `"/Script/CoreUObject.Enum'/Script/Engine.ETraceTypeQuery'"`, // medium (паттерн; J4 проверит)
};
const ENUMS_UE5 = {
  ETraceTypeQuery: `Enum'"/Script/Engine.ETraceTypeQuery"'`,
};
export const UE_ENUMS = UE_VERSION === 'UE5' ? ENUMS_UE5 : ENUMS_UE4;

// Все известные значения (обе версии) — для валидатора (пул без ложных W10).
export const ALL_SUBOBJ = [...Object.values(STRUCTS_UE4), ...Object.values(STRUCTS_UE5), ...Object.values(ENUMS_UE4), ...Object.values(ENUMS_UE5)];

// Стандартные макросы StandardMacros — для K2Node_MacroInstance.
// guid:null = GUID не захвачен из движка: вставь ноду в UE, скопируй обратно, впиши GraphGuid.
export const UE_MACROS = {
  ForLoop:          { graph: 'ForLoop',          guid: '55C904AF4B45FE1761FB55A8DB9FB801' }, // confirmed (доки Epic)
  FlipFlop:         { graph: 'FlipFlop',         guid: 'BFFFAAE4434E166F549665AD1AA89B60' }, // medium (дамп UE5)
  ForLoopWithBreak: { graph: 'ForLoopWithBreak', guid: null },
  WhileLoop:        { graph: 'WhileLoop',        guid: null },
  Gate:             { graph: 'Gate',             guid: null },
  DoOnce:           { graph: 'DoOnce',           guid: null },
  DoN:              { graph: 'DoN',              guid: null },
};

// Class-ссылка для object-пинов (WCO): путь класса → ссылка в стиле версии.
// UE4: "/Script/CoreUObject.Class'/Script/CoreUObject.Object'" (copy-back H1).
export function classRef(classPath){
  return UE_VERSION === 'UE5' ? `Class'"${classPath}"'` : `"/Script/CoreUObject.Class'${classPath}'"`;
}

export function memberParentRef(lib){
  const p = UE_LIBS[lib];
  if(!p) throw new Error(`Unknown UE lib: ${lib}`);
  return `MemberParent=${p}`;
}

export function structRef(structName){
  const p = UE_STRUCTS[structName];
  if(!p) throw new Error(`Unknown UE struct for ${UE_VERSION}: ${structName}`);
  return p;
}

const MACRO_GRAPH_TPL = g => UE_VERSION === 'UE5'
  ? `EdGraph'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:${g}"'`
  : `"/Script/Engine.EdGraph'/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:${g}'"`;
const MACRO_BP_TPL = UE_VERSION === 'UE5'
  ? `Blueprint'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros"'`
  : `"/Script/Engine.Blueprint'/Engine/EditorBlueprintResources/StandardMacros.StandardMacros'"`;

export function macroGraphRef(graph, guid){
  const g = MACRO_GRAPH_TPL(graph);
  const gp = (guid && guid.length >= 32) ? guid : null;
  const guidPart = gp ? `,GraphGuid=${gp.slice(0,8)}${gp.slice(8,12)}${gp.slice(12,16)}${gp.slice(16,20)}${gp.slice(20,32)}` : '';
  return `MacroGraphReference=(MacroGraph=${g},GraphBlueprint=${MACRO_BP_TPL}${guidPart})`;
}
