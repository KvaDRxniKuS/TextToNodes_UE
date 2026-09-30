#!/usr/bin/env node
// tools/gen-probe.mjs — пробы новых нод для проверки в UE (R36+).
//
// Порядок работы (решение пользователя 2026-09-30): генератор сам собирает нужные ноды, у КАЖДОЙ — открытый
// пузырь-комментарий «что это за нода» (bCommentBubbleVisible=True + NodeComment). Пользователь вставляет файл в UE
// и присылает copy-back только тех нод, что не встали или встали неправильно; остальные считаются подтверждёнными.
//
// Ноды без проводов, раскладка — сетка по темам (без расстановщика: связей нет). GUID детерминированы
// (seedGuids), поэтому повторный запуск даёт тот же файл; --check сверяет с файлом на диске.
//
// Запуск: node tools/gen-probe.mjs [--batch 36] [--check]

import fs from 'node:fs';
import { fitComment, estNodeWidth, estNodeHeight, createMacroInstance, createCallFunction } from '../src/generator.js';
import { UE_LIBS, UE_STRUCTS, UE_ENUMS } from '../src/ue-types.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { createCall, createAddComponentByClass, createCustomEvent } from '../src/modules.js';

const args = process.argv.slice(2);
const batch = (args[args.indexOf('--batch') + 1] && args.includes('--batch')) ? args[args.indexOf('--batch') + 1] : '36';
const CHECK = args.includes('--check');
const STDOUT = args.includes('--stdout'); // текст пробы в stdout, без записи (тесты; пробы после вердикта в git не хранятся)
const REGISTER = args.includes('--register'); // после вердикта «встали»: завести подтверждённые пробы в реестр

// Шорткаты: статическая функция библиотеки / член класса. Слова пинов — как в createCall: «Имя:тип[=значение]», «->».
const lib = (key, words, pure = false) => () => createCall(key, words, { pure, isStatic: true });
const mem = (key, words, pure = false) => () => createCall(key, words, { pure });
// ref(фабрика, пины…): пометить пины by-ref (bIsReference=True), как в copy-back
// R45b: флаги пинов по copy-back: '&' by-ref, '!' const, '~' bDefaultValueIsIgnored
const pf = (make, spec) => () => { const n = make(); for (const [nm, v] of Object.entries(spec)) { const q = n.pins.find(x => x.name === nm); if (v.includes('&')) q.isRef = true; if (v.includes('!')) q.isConst = true; if (v.includes('~')) q.ignored = true; } return n; };
const ref = (make, ...names) => () => { const n = make(); n.pins.forEach(p => { if (names.includes(p.name)) p.isRef = true; }); return n; };
const macro = (graph, pins) => () => createMacroInstance({ id: graph, title: graph, pins });

// R42: реплицируемый Custom Event. FunctionFlags = база события (BlueprintCallable|BlueprintEvent|Public = 0x0C020000)
// + FUNC_Net 0x40 [+ Reliable 0x80] + Server 0x200000 | Multicast 0x4000 | Client 0x1000000. Гипотеза — ждёт copy-back.
const repEvent = (name, bits) => () => { const n = createCustomEvent(name, []); n.rawProps.push(`FunctionFlags=${(0x0C020000 | 0x40 | bits) >>> 0}`); return n; }; // R42 VERIFIED (Details совпали)


// R45: контейнерные wildcard-пины (BlueprintMapLibrary/BlueprintSetLibrary, CustomThunk). spec: { Пин: 'Map'|'Set'|'Array'|'' , ... }
// '' — одиночный wildcard; суффикс '&' — by-ref, '!' — const. Тип резолвится движком при подключении.
const wild = (make, spec) => () => { const n = make(); for (const [nm, v] of Object.entries(spec)) {
  const p = n.pins.find(x => x.name === nm); const c = v.replace(/[&!]/g, '');
  p.category = 'wildcard'; p.subCategory = ''; p.subCategoryObject = ''; p.container = c || 'None';
  if (c === 'Map') p.valueType = 'wildcard'; if (c && p.direction === 'Input') p.ignored = true; if (v.includes('&') && p.direction === 'Input') p.isRef = true; if (v.includes('!')) p.isConst = true; } return n; };

/* Пакеты проб. Каждая проба: [тема, текст пузыря, фабрика]. Текст пузыря — что за нода и чего ждём. */
const BATCHES = {
  '36': [
    // 4 — Blueprint Interfaces (Message-ноды требуют ассет интерфейса — только Does Implement)
    ['Interfaces', 'Does Implement Interface (KismetSystemLibrary, pure). Ждём: bool-выход, пин Interface', lib('KismetSystemLibrary.DoesImplementInterface', ['TestObject:object:/Script/CoreUObject.Object', 'Interface:class:/Script/CoreUObject.Interface', '->', 'ReturnValue:bool'], true)],
    // 5 — циклы (макросы StandardMacros; GUID графов — из copy-back R36, см. UE_MACROS)
    ['Loops', 'ForEachLoopWithBreak (макрос StandardMacros)', macro('ForEachLoopWithBreak', [
      { name: 'Exec', dir: 'Input', cat: 'exec' }, { name: 'Array', dir: 'Input', cat: 'wildcard', container: 'Array' }, { name: 'Break', dir: 'Input', cat: 'exec' },
      { name: 'LoopBody', dir: 'Output', cat: 'exec' }, { name: 'Array Element', dir: 'Output', cat: 'wildcard' }, { name: 'Array Index', dir: 'Output', cat: 'int' }, { name: 'Completed', dir: 'Output', cat: 'exec' }])],
    ['Loops', 'ReverseForEachLoop (макрос StandardMacros; выходы ArrayIndex/ArrayElement без пробела)', macro('ReverseForEachLoop', [
      { name: 'Exec', dir: 'Input', cat: 'exec' }, { name: 'Array', dir: 'Input', cat: 'wildcard', container: 'Array' },
      { name: 'LoopBody', dir: 'Output', cat: 'exec' }, { name: 'ArrayIndex', dir: 'Output', cat: 'int' }, { name: 'ArrayElement', dir: 'Output', cat: 'wildcard' }, { name: 'Completed', dir: 'Output', cat: 'exec' }])],
    // 7 — Save Game (Create/Save/Load/DoesExist уже VERIFIED в реестре — не повторяем)
    ['SaveGame', 'Delete Game in Slot (GameplayStatics)', lib('GameplayStatics.DeleteGameInSlot', ['SlotName:string', 'UserIndex:int', '->', 'ReturnValue:bool'])],
    // 8 — Data Table (Get Data Table Row — особая K2-нода, отдельно)
    ['DataTable', 'Get Data Table Row Names (DataTableFunctionLibrary). Ждём: Table → массив Name', lib('DataTableFunctionLibrary.GetDataTableRowNames', ['Table:object:DataTable', '->', 'OutRowNames:name[]'])],
    ['DataTable', 'Does Data Table Row Exist (DataTableFunctionLibrary, pure)', lib('DataTableFunctionLibrary.DoesDataTableRowExist', ['Table:object:DataTable', 'RowName:name', '->', 'ReturnValue:bool'], true)],
    // 9 — AI (AI MoveTo — отдельный async-узел)
    ['AI', 'Get AI Controller (AIBlueprintHelperLibrary, pure)', lib('/Script/AIModule.AIBlueprintHelperLibrary.GetAIController', ['ControlledActor:object:Actor', '->', 'ReturnValue:object:/Script/AIModule.AIController'], true)],
    ['AI', 'Simple Move to Location (AIBlueprintHelperLibrary)', lib('/Script/AIModule.AIBlueprintHelperLibrary.SimpleMoveToLocation', ['Controller:object:Controller', 'Goal:vector'])],
    ['AI', 'Run Behavior Tree (член AIController)', mem('/Script/AIModule.AIController.RunBehaviorTree', ['BTAsset:object:/Script/AIModule.BehaviorTree', '->', 'ReturnValue:bool'])],
    ['AI', 'Get Blackboard (AIBlueprintHelperLibrary, pure)', lib('/Script/AIModule.AIBlueprintHelperLibrary.GetBlackboard', ['Target:object:Actor', '->', 'ReturnValue:object:/Script/AIModule.BlackboardComponent'], true)],
    ['AI', 'Set Value as Vector (член BlackboardComponent)', mem('/Script/AIModule.BlackboardComponent.SetValueAsVector', ['KeyName:name', 'VectorValue:vector'])],
    ['AI', 'Get Value as Vector (член BlackboardComponent, pure)', mem('/Script/AIModule.BlackboardComponent.GetValueAsVector', ['KeyName:name', '->', 'ReturnValue:vector'], true)],
    // 10 — Animation
    ['Animation', 'Play Anim Montage (член Character). Ждём: AnimMontage, InPlayRate, StartSectionName → float', mem('Character.PlayAnimMontage', ['AnimMontage:object:AnimMontage', 'InPlayRate:single=1.000000', 'StartSectionName:name', '->', 'ReturnValue:single'])],
    ['Animation', 'Get Anim Instance (член SkeletalMeshComponent, pure)', mem('SkeletalMeshComponent.GetAnimInstance', ['->', 'ReturnValue:object:AnimInstance'], true)],
    ['Animation', 'Montage Play (член AnimInstance)', mem('AnimInstance.Montage_Play', ['MontageToPlay:object:AnimMontage', 'InPlayRate:single=1.000000', '->', 'ReturnValue:single'])],
    ['Animation', 'Montage Stop (член AnimInstance)', mem('AnimInstance.Montage_Stop', ['InBlendOutTime:single', 'Montage:object:AnimMontage'])],
    // 11 — Materials
    ['Materials', 'Create Dynamic Material Instance (член PrimitiveComponent)', mem('PrimitiveComponent.CreateDynamicMaterialInstance', ['ElementIndex:int', 'SourceMaterial:object:MaterialInterface', 'OptionalName:name', '->', 'ReturnValue:object:MaterialInstanceDynamic'])],
    ['Materials', 'Set Scalar Parameter Value (член MaterialInstanceDynamic)', mem('MaterialInstanceDynamic.SetScalarParameterValue', ['ParameterName:name', 'Value:single'])],
    ['Materials', 'Set Vector Parameter Value (член MaterialInstanceDynamic)', mem('MaterialInstanceDynamic.SetVectorParameterValue', ['ParameterName:name', 'Value:linearcolor'])],
    ['Materials', 'Set Scalar Parameter Value для MPC (KismetMaterialLibrary)', lib('KismetMaterialLibrary.SetScalarParameterValue', ['Collection:object:MaterialParameterCollection', 'ParameterName:name', 'ParameterValue:single'])],
    // 12 — Niagara
    ['Niagara', 'Spawn System at Location (NiagaraFunctionLibrary). Ждём полный набор пинов после вставки', lib('/Script/Niagara.NiagaraFunctionLibrary.SpawnSystemAtLocation', ['SystemTemplate:object:/Script/Niagara.NiagaraSystem', 'Location:vector', 'Rotation:rotator', '->', 'ReturnValue:object:/Script/Niagara.NiagaraComponent'])],
    ['Niagara', 'Set Float Parameter (член NiagaraComponent: SetVariableFloat)', mem('/Script/Niagara.NiagaraComponent.SetVariableFloat', ['InVariableName:name', 'InValue:single'])],
    // 13 — Camera
    ['Camera', 'Get Player Camera Manager (GameplayStatics, pure)', lib('GameplayStatics.GetPlayerCameraManager', ['PlayerIndex:int', '->', 'ReturnValue:object:PlayerCameraManager'], true)],
    ['Camera', 'Start Camera Shake (член PlayerCameraManager)', mem('PlayerCameraManager.StartCameraShake', ['ShakeClass:class:CameraShakeBase', 'Scale:single=1.000000', '->', 'ReturnValue:object:CameraShakeBase'])],
    ['Camera', 'Set View Target with Blend (член PlayerController)', mem('PlayerController.SetViewTargetWithBlend', ['NewViewTarget:object:Actor', 'BlendTime:single'])],
    // 14 — Level streaming (OpenLevel уже VERIFIED; Load/Unload Stream Level — latent, отдельно)
    ['Levels', 'Get Streaming Level (GameplayStatics, pure)', lib('GameplayStatics.GetStreamingLevel', ['PackageName:name', '->', 'ReturnValue:object:LevelStreaming'], true)],
    // 15 — Gameplay Tags
    ['Tags', 'Matches Tag (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.MatchesTag', ['TagOne:gameplaytag', 'TagTwo:gameplaytag', 'bExactMatch:bool', '->', 'ReturnValue:bool'], true)],
    ['Tags', 'Has Tag (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.HasTag', ['TagContainer:gameplaytagcontainer', 'Tag:gameplaytag', 'bExactMatch:bool', '->', 'ReturnValue:bool'], true)],
    // 16 — Random streams / noise
    ['Random', 'Random Float from Stream (KismetMathLibrary, pure)', lib('KismetMathLibrary.RandomFloatFromStream', ['Stream:randomstream', '->', 'ReturnValue:real'], true)],
    ['Random', 'Random Integer from Stream (KismetMathLibrary, pure)', lib('KismetMathLibrary.RandomIntegerFromStream', ['Stream:randomstream', 'Max:int', '->', 'ReturnValue:int'], true)],
    ['Random', 'Perlin Noise 1D (KismetMathLibrary, pure)', lib('KismetMathLibrary.PerlinNoise1D', ['Value:single', '->', 'ReturnValue:single'], true)],
    // 17 — Networking (IsLocallyControlled уже VERIFIED)
    ['Network', 'Has Authority (член Actor, pure)', mem('Actor.HasAuthority', ['->', 'ReturnValue:bool'], true)],
    ['Network', 'Is Server (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.IsServer', ['->', 'ReturnValue:bool'], true)],
    // досылка R35: вариант с выбранным классом ещё не сверен
    ['R35', 'Add Component by Class с выбранным классом StaticMeshComponent (вариант не сверен copy-back)', () => createAddComponentByClass('StaticMeshComponent')],
  ],
  '38': [
    // Actor
    ['Actor', 'Set Life Span (член Actor)', mem('Actor.SetLifeSpan', ['InLifespan:single'])],
    ['Actor', 'Get Distance To (член Actor, pure)', mem('Actor.GetDistanceTo', ['OtherActor:object:Actor', '->', 'ReturnValue:single'], true)],
    ['Actor', 'Get Overlapping Actors (член Actor). Ждём: ClassFilter → массив Actor', mem('Actor.GetOverlappingActors', ['ClassFilter:class:Actor', '->', 'OverlappingActors:object:Actor[]'])],
    ['Actor', 'Is Overlapping Actor (член Actor, pure)', mem('Actor.IsOverlappingActor', ['Other:object:Actor', '->', 'ReturnValue:bool'], true)],
    // Damage / Game
    ['Game', 'Apply Damage (GameplayStatics)', lib('GameplayStatics.ApplyDamage', ['DamagedActor:object:Actor', 'BaseDamage:single', 'EventInstigator:object:Controller', 'DamageCauser:object:Actor', 'DamageTypeClass:class:DamageType', '->', 'ReturnValue:single'])],
    ['Game', 'Set Game Paused (GameplayStatics)', lib('GameplayStatics.SetGamePaused', ['bPaused:bool', '->', 'ReturnValue:bool'])],
    ['Game', 'Set Global Time Dilation (GameplayStatics)', lib('GameplayStatics.SetGlobalTimeDilation', ['TimeDilation:single'])],
    ['Game', 'Get Time Seconds (GameplayStatics, pure)', lib('GameplayStatics.GetTimeSeconds', ['->', 'ReturnValue:double'], true)],
    ['Game', 'Get Player State (GameplayStatics, pure)', lib('GameplayStatics.GetPlayerState', ['PlayerStateIndex:int', '->', 'ReturnValue:object:PlayerState'], true)],
    // Timers
    // Timers: K2_ClearTimerHandle в UE 5.8 нет — ряд пропал при вставке (вердикт R38); весь набор K2_*Timer* уже VERIFIED в реестре (R26)
    // Debug
    ['Debug', 'Draw Debug Line (KismetSystemLibrary). Ждём: остальные пины движок достроит', lib('KismetSystemLibrary.DrawDebugLine', ['LineStart:vector', 'LineEnd:vector', 'LineColor:linearcolor', 'Duration:single', 'Thickness:single'])],
    ['Debug', 'Draw Debug Sphere (KismetSystemLibrary)', lib('KismetSystemLibrary.DrawDebugSphere', ['Center:vector', 'Radius:single=100.000000', 'Segments:int=12', 'LineColor:linearcolor', 'Duration:single', 'Thickness:single'])],
    // UI
    ['UI', 'Set Text (член TextBlock)', mem('/Script/UMG.TextBlock.SetText', ['InText:text'])],
    ['UI', 'Set Percent (член ProgressBar)', mem('/Script/UMG.ProgressBar.SetPercent', ['InPercent:single'])],
    ['UI', 'Project World Location to Screen (член PlayerController). Ждём: ScreenLocation Vector2D + bool', mem('PlayerController.ProjectWorldLocationToScreen', ['WorldLocation:vector', 'bPlayerViewportRelative:bool', '->', 'ScreenLocation:vector2d', 'ReturnValue:bool'])],
    ['UI', 'Set Focus to Game Viewport (WidgetBlueprintLibrary; из copy-back R38)', lib('/Script/UMG.WidgetBlueprintLibrary.SetFocusToGameViewport', [])],
    ['UI', 'Clear User Focus (WidgetBlueprintLibrary, pure; Reply by-ref; из copy-back R38)', ref(lib('/Script/UMG.WidgetBlueprintLibrary.ClearUserFocus', ['Reply:eventreply', 'bInAllUsers:bool=false', '->', 'ReturnValue:eventreply'], true), 'Reply')],
    // Components
    ['Components', 'Activate (член ActorComponent)', mem('ActorComponent.Activate', ['bReset:bool'])],
    ['Components', 'Deactivate (член ActorComponent)', mem('ActorComponent.Deactivate', [])],
    ['Components', 'Set Static Mesh (член StaticMeshComponent)', mem('/Script/Engine.StaticMeshComponent.SetStaticMesh', ['NewMesh:object:StaticMesh', '->', 'ReturnValue:bool'])],
    ['Components', 'Set Field of View (член CameraComponent)', mem('/Script/Engine.CameraComponent.SetFieldOfView', ['InFieldOfView:single'])],
    ['Components', 'Set Intensity (член LightComponent)', mem('/Script/Engine.LightComponent.SetIntensity', ['NewIntensity:single'])],
    ['Components', 'Set Light Color (член LightComponent)', mem('/Script/Engine.LightComponent.SetLightColor', ['NewLightColor:linearcolor', 'bSRGB:bool=true'])],
    // Audio
    ['Audio', 'Spawn Sound at Location (GameplayStatics). Ждём: → AudioComponent', lib('GameplayStatics.SpawnSoundAtLocation', ['Sound:object:SoundBase', 'Location:vector', '->', 'ReturnValue:object:AudioComponent'])],
    ['Audio', 'Fade In (член AudioComponent)', mem('/Script/Engine.AudioComponent.FadeIn', ['FadeInDuration:single', 'FadeVolumeLevel:single=1.000000', 'StartTime:single'])],
    ['Audio', 'Fade Out (член AudioComponent)', mem('/Script/Engine.AudioComponent.FadeOut', ['FadeOutDuration:single', 'FadeVolumeLevel:single'])],
    ['Audio', 'Set Volume Multiplier (член AudioComponent)', mem('/Script/Engine.AudioComponent.SetVolumeMultiplier', ['NewVolumeMultiplier:single'])],
    // AI
    ['AI', 'Stop Movement (член Controller)', mem('Controller.StopMovement', [])],
    ['AI', 'Set Focus (член AIController). Пин InPriority движок достроит', mem('/Script/AIModule.AIController.SetFocus', ['NewFocus:object:Actor'])],
    ['AI', 'Clear Focus (член AIController)', mem('/Script/AIModule.AIController.ClearFocus', [])],
    ['AI', 'Set Value as Object (член BlackboardComponent)', mem('/Script/AIModule.BlackboardComponent.SetValueAsObject', ['KeyName:name', 'ObjectValue:object:/Script/CoreUObject.Object'])],
    ['AI', 'Get Value as Object (член BlackboardComponent, pure)', mem('/Script/AIModule.BlackboardComponent.GetValueAsObject', ['KeyName:name', '->', 'ReturnValue:object:/Script/CoreUObject.Object'], true)],
    ['AI', 'Set Value as Bool (член BlackboardComponent)', mem('/Script/AIModule.BlackboardComponent.SetValueAsBool', ['KeyName:name', 'BoolValue:bool'])],
    ['AI', 'Get Value as Bool (член BlackboardComponent, pure)', mem('/Script/AIModule.BlackboardComponent.GetValueAsBool', ['KeyName:name', '->', 'ReturnValue:bool'], true)],
    ['AI', 'Set Value as Float (член BlackboardComponent)', mem('/Script/AIModule.BlackboardComponent.SetValueAsFloat', ['KeyName:name', 'FloatValue:single'])],
    ['AI', 'Get Value as Float (член BlackboardComponent, pure)', mem('/Script/AIModule.BlackboardComponent.GetValueAsFloat', ['KeyName:name', '->', 'ReturnValue:single'], true)],
    ['AI', 'Clear Value (член BlackboardComponent)', mem('/Script/AIModule.BlackboardComponent.ClearValue', ['KeyName:name'])],
    // Animation
    ['Animation', 'Montage Is Playing (член AnimInstance, pure)', mem('AnimInstance.Montage_IsPlaying', ['Montage:object:AnimMontage', '->', 'ReturnValue:bool'], true)],
    ['Animation', 'Montage Jump to Section (член AnimInstance)', mem('AnimInstance.Montage_JumpToSection', ['SectionName:name', 'Montage:object:AnimMontage'])],
    ['Animation', 'Get Curve Value (член AnimInstance, pure)', mem('AnimInstance.GetCurveValue', ['CurveName:name', '->', 'ReturnValue:single'], true)],
    // Tags
    ['Tags', 'Has Any Tags (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.HasAnyTags', ['TagContainer:gameplaytagcontainer', 'OtherContainer:gameplaytagcontainer', 'bExactMatch:bool', '->', 'ReturnValue:bool'], true)],
    ['Tags', 'Make Gameplay Tag Container from Tag (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.MakeGameplayTagContainerFromTag', ['SingleTag:gameplaytag', '->', 'ReturnValue:gameplaytagcontainer'], true)],
  ],
  '39': [
    ['Actor', 'Set Actor Enable Collision (член Actor)', mem('Actor.SetActorEnableCollision', ['bNewActorEnableCollision:bool'])],
    ['Actor', 'Set Actor Tick Enabled (член Actor)', mem('Actor.SetActorTickEnabled', ['bEnabled:bool'])],
    ['Actor', 'Set Actor Tick Interval (член Actor)', mem('Actor.SetActorTickInterval', ['TickInterval:single'])],
    ['Actor', 'Get Game Time Since Creation (член Actor, pure)', mem('Actor.GetGameTimeSinceCreation', ['->', 'ReturnValue:single'], true)],
    ['Actor', 'Get Socket Location (член SceneComponent, pure)', mem('SceneComponent.GetSocketLocation', ['InSocketName:name', '->', 'ReturnValue:vector'], true)],
    ['Actor', 'Does Socket Exist (член SceneComponent, pure)', mem('SceneComponent.DoesSocketExist', ['InSocketName:name', '->', 'ReturnValue:bool'], true)],
    ['Input', 'Get Mouse Position (член PlayerController). Ждём: LocationX/LocationY float + bool', mem('PlayerController.GetMousePosition', ['->', 'LocationX:single', 'LocationY:single', 'ReturnValue:bool'], true)],
    ['Input', 'Get Viewport Size (член PlayerController, pure)', mem('PlayerController.GetViewportSize', ['->', 'SizeX:int', 'SizeY:int'], true)],
    ['Input', 'Was Input Key Just Pressed (член PlayerController, pure)', mem('PlayerController.WasInputKeyJustPressed', ['Key:key', '->', 'ReturnValue:bool'], true)],
    ['Input', 'Deproject Screen Position to World (член PlayerController)', mem('PlayerController.DeprojectScreenPositionToWorld', ['ScreenX:single', 'ScreenY:single', '->', 'WorldLocation:vector', 'WorldDirection:vector', 'ReturnValue:bool'], true)],
    ['UI', 'Play Animation (член UserWidget). Пины PlayMode и др. движок достроит', mem('/Script/UMG.UserWidget.PlayAnimation', ['InAnimation:object:/Script/UMG.WidgetAnimation', 'StartAtTime:single', 'NumLoopsToPlay:int=1', '->', 'ReturnValue:object:/Script/UMG.UMGSequencePlayer'])],
    ['UI', 'Stop Animation (член UserWidget)', mem('/Script/UMG.UserWidget.StopAnimation', ['InAnimation:object:/Script/UMG.WidgetAnimation'])],
    ['UI', 'Set Render Opacity (член Widget)', mem('/Script/UMG.Widget.SetRenderOpacity', ['InOpacity:single'])],
    ['UI', 'Set Is Enabled (член Widget)', mem('/Script/UMG.Widget.SetIsEnabled', ['bInIsEnabled:bool'])],
    ['UI', 'Set Brush from Texture (член Image)', mem('/Script/UMG.Image.SetBrushFromTexture', ['Texture:object:Texture2D', 'bMatchSize:bool'])],
    ['Materials', 'Set Texture Parameter Value (член MaterialInstanceDynamic)', mem('MaterialInstanceDynamic.SetTextureParameterValue', ['ParameterName:name', 'Value:object:Texture'])],
    ['Materials', 'Get Scalar Parameter Value (член MaterialInstanceDynamic: K2_GetScalarParameterValue, pure)', mem('MaterialInstanceDynamic.K2_GetScalarParameterValue', ['ParameterName:name', '->', 'ReturnValue:single'], true)],
    ['Materials', 'Get Material (член PrimitiveComponent, pure)', mem('PrimitiveComponent.GetMaterial', ['ElementIndex:int', '->', 'ReturnValue:object:MaterialInterface'], true)],
    ['Materials', 'Spawn Decal at Location (GameplayStatics)', lib('GameplayStatics.SpawnDecalAtLocation', ['DecalMaterial:object:MaterialInterface', 'DecalSize:vector', 'Location:vector', 'Rotation:rotator', 'LifeSpan:single', '->', 'ReturnValue:object:DecalComponent'])],
    ['Niagara', 'Spawn System Attached (NiagaraFunctionLibrary). Ждём полный набор пинов после вставки', lib('/Script/Niagara.NiagaraFunctionLibrary.SpawnSystemAttached', ['SystemTemplate:object:/Script/Niagara.NiagaraSystem', 'AttachToComponent:object:SceneComponent', 'AttachPointName:name', 'Location:vector', 'Rotation:rotator', '->', 'ReturnValue:object:/Script/Niagara.NiagaraComponent'])],
    ['Niagara', 'Set Vector Parameter (член NiagaraComponent: SetVariableVec3)', mem('/Script/Niagara.NiagaraComponent.SetVariableVec3', ['InVariableName:name', 'InValue:vector'])],
    ['Niagara', 'Set Color Parameter (член NiagaraComponent: SetVariableLinearColor)', mem('/Script/Niagara.NiagaraComponent.SetVariableLinearColor', ['InVariableName:name', 'InValue:linearcolor'])],
    ['Niagara', 'Set Bool Parameter (член NiagaraComponent: SetVariableBool)', mem('/Script/Niagara.NiagaraComponent.SetVariableBool', ['InVariableName:name', 'InValue:bool'])],
    ['Niagara', 'Set Asset (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.SetAsset', ['InAsset:object:/Script/Niagara.NiagaraSystem', 'bResetExistingOverrideParameters:bool=true'])],
    ['Movement', 'Get Movement Component (член Pawn, pure)', mem('Pawn.GetMovementComponent', ['->', 'ReturnValue:object:PawnMovementComponent'], true)],
    ['Movement', 'Stop Movement Immediately (член MovementComponent)', mem('/Script/Engine.MovementComponent.StopMovementImmediately', [])],
    ['Camera', 'Client Start Camera Shake (член PlayerController)', mem('PlayerController.ClientStartCameraShake', ['Shake:class:CameraShakeBase', 'Scale:single=1.000000'])],
    ['Camera', 'Play World Camera Shake (GameplayStatics)', lib('GameplayStatics.PlayWorldCameraShake', ['Shake:class:CameraShakeBase', 'Epicenter:vector', 'InnerRadius:single', 'OuterRadius:single', 'Falloff:single=1.000000', 'bOrientShakeTowardsEpicenter:bool'])],
    ['Animation', 'Montage Pause (член AnimInstance)', mem('AnimInstance.Montage_Pause', ['Montage:object:AnimMontage'])],
    ['Animation', 'Montage Resume (член AnimInstance)', mem('AnimInstance.Montage_Resume', ['Montage:object:AnimMontage'])],
    ['Animation', 'Montage Set Play Rate (член AnimInstance)', mem('AnimInstance.Montage_SetPlayRate', ['Montage:object:AnimMontage', 'NewPlayRate:single=1.000000'])],
    ['Animation', 'Montage Get Position (член AnimInstance, pure)', mem('AnimInstance.Montage_GetPosition', ['Montage:object:AnimMontage', '->', 'ReturnValue:single'], true)],
    ['Animation', 'Is Any Montage Playing (член AnimInstance, pure)', mem('AnimInstance.IsAnyMontagePlaying', ['->', 'ReturnValue:bool'], true)],
    ['Animation', 'Stop Anim Montage (член Character)', mem('Character.StopAnimMontage', ['AnimMontage:object:AnimMontage'])],
    ['Tags', 'Add Gameplay Tag to Container (BlueprintGameplayTagLibrary; TagContainer by-ref)', ref(lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.AddGameplayTag', ['TagContainer:gameplaytagcontainer', 'Tag:gameplaytag']), 'TagContainer')],
    ['Tags', 'Remove Gameplay Tag (BlueprintGameplayTagLibrary; TagContainer by-ref)', ref(lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.RemoveGameplayTag', ['TagContainer:gameplaytagcontainer', 'Tag:gameplaytag', '->', 'ReturnValue:bool']), 'TagContainer')],
    ['Tags', 'Get Tag Name (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.GetTagName', ['GameplayTag:gameplaytag', '->', 'ReturnValue:name'], true)],
    ['Tags', 'Equal (Gameplay Tag) (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.EqualEqual_GameplayTag', ['A:gameplaytag', 'B:gameplaytag', '->', 'ReturnValue:bool'], true)],
    ['Tags', 'Has All Tags (BlueprintGameplayTagLibrary, pure)', lib('/Script/GameplayTags.BlueprintGameplayTagLibrary.HasAllTags', ['TagContainer:gameplaytagcontainer', 'OtherContainer:gameplaytagcontainer', 'bExactMatch:bool', '->', 'ReturnValue:bool'], true)],
    ['Random', 'Make Random Stream (KismetMathLibrary, pure)', lib('KismetMathLibrary.MakeRandomStream', ['InitialSeed:int', '->', 'ReturnValue:randomstream'], true)],
    ['Random', 'Random Bool from Stream (KismetMathLibrary, pure)', lib('KismetMathLibrary.RandomBoolFromStream', ['Stream:randomstream', '->', 'ReturnValue:bool'], true)],
    ['Random', 'Random Unit Vector from Stream (KismetMathLibrary, pure)', lib('KismetMathLibrary.RandomUnitVectorFromStream', ['Stream:randomstream', '->', 'ReturnValue:vector'], true)],
    ['Random', 'Seed Random Stream (KismetMathLibrary; Stream by-ref)', ref(lib('KismetMathLibrary.SeedRandomStream', ['Stream:randomstream']), 'Stream')],
    ['System', 'Execute Console Command (KismetSystemLibrary)', lib('KismetSystemLibrary.ExecuteConsoleCommand', ['Command:string', 'SpecificPlayer:object:PlayerController'])],
    ['System', 'Get Game Name (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.GetGameName', ['->', 'ReturnValue:string'], true)],
    ['System', 'Is Packaged for Distribution (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.IsPackagedForDistribution', ['->', 'ReturnValue:bool'], true)],
    ['System', 'Get Class Display Name (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.GetClassDisplayName', ['Class:class:/Script/CoreUObject.Object', '->', 'ReturnValue:string'], true)],
  ],
  '41': [
    ['Movement', 'Is Falling (член CharacterMovementComponent — NavMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.IsFalling', ['->', 'ReturnValue:bool'], true)],
    ['Movement', 'Is Moving On Ground (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.IsMovingOnGround', ['->', 'ReturnValue:bool'], true)],
    ['Movement', 'Disable Movement (член CharacterMovementComponent)', mem('/Script/Engine.CharacterMovementComponent.DisableMovement', [])],
    ['Movement', 'Set Movement Mode (член CharacterMovementComponent). Ждём: NewMovementMode enum, NewCustomMode byte', mem('/Script/Engine.CharacterMovementComponent.SetMovementMode', ['NewMovementMode:enum:EMovementMode', 'NewCustomMode:byte'])],
    ['Audio', 'Play Sound 2D (GameplayStatics). Пины Concurrency/Owning движок достроит', lib('GameplayStatics.PlaySound2D', ['Sound:object:/Script/Engine.SoundBase', 'VolumeMultiplier:single=1.000000', 'PitchMultiplier:single=1.000000', 'StartTime:single'])],
    ['World', 'Get Global Time Dilation (GameplayStatics, pure)', lib('GameplayStatics.GetGlobalTimeDilation', ['->', 'ReturnValue:single'], true)],
    ['World', 'Is Game Paused (GameplayStatics, pure)', lib('GameplayStatics.IsGamePaused', ['->', 'ReturnValue:bool'], true)],
    ['World', 'Get Actor Of Class (GameplayStatics). Выход по классу', lib('GameplayStatics.GetActorOfClass', ['ActorClass:class:Actor', '->', 'ReturnValue:object:Actor'])],
    ['Text', 'To String (Text) — Conv_TextToString (KismetTextLibrary, pure)', lib('KismetTextLibrary.Conv_TextToString', ['InText:text', '->', 'ReturnValue:string'], true)],
    ['Text', 'To Text (String) — Conv_StringToText (KismetTextLibrary, pure)', lib('KismetTextLibrary.Conv_StringToText', ['InString:string', '->', 'ReturnValue:text'], true)],
    ['Text', 'Text Is Empty (KismetTextLibrary, pure)', lib('KismetTextLibrary.TextIsEmpty', ['InText:text', '->', 'ReturnValue:bool'], true)],
    ['Input', 'Get Hit Result Under Cursor by Channel (член PlayerController)', mem('PlayerController.GetHitResultUnderCursorByChannel', ['TraceChannel:enum:ETraceTypeQuery', 'bTraceComplex:bool', '->', 'HitResult:hitresult', 'ReturnValue:bool'], true)],
    ['Math', 'Random Point in Bounding Box (KismetMathLibrary)', lib('KismetMathLibrary.RandomPointInBoundingBox', ['Center:vector', 'HalfSize:vector', '->', 'ReturnValue:vector'])],
    ['Nav', 'Get Random Reachable Point in Radius (NavigationSystemV1)', lib('/Script/NavigationSystem.NavigationSystemV1.K2_GetRandomReachablePointInRadius', ['Origin:vector', 'Radius:single', 'NavData:object:/Script/NavigationSystem.NavigationData', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', '->', 'RandomLocation:vector', 'ReturnValue:bool'])],
    ['Actor', 'Get Components by Class (член Actor, pure). Выход — массив по классу', mem('Actor.K2_GetComponentsByClass', ['ComponentClass:class:ActorComponent', '->', 'ReturnValue:object:ActorComponent[]'], true)],
    ['UI', 'Set Value (член Slider)', mem('/Script/UMG.Slider.SetValue', ['InValue:single'])],
    ['UI', 'Get Value (член Slider, pure)', mem('/Script/UMG.Slider.GetValue', ['->', 'ReturnValue:single'], true)],
  ],
  '42': [
    ['Net', 'Get Local Role (член Actor, pure). Ждём: выход ENetRole', mem('Actor.GetLocalRole', ['->', 'ReturnValue:enum:ENetRole'], true)],
    ['Net', 'Get Remote Role (член Actor, pure)', mem('Actor.GetRemoteRole', ['->', 'ReturnValue:enum:ENetRole'], true)],
    ['Net', 'Set Replicates (член Actor)', mem('Actor.SetReplicates', ['bInReplicates:bool'])],
    ['Net', 'Set Replicate Movement (член Actor)', mem('Actor.SetReplicateMovement', ['bInReplicateMovement:bool'])],
    ['Net', 'Set Owner (член Actor)', mem('Actor.SetOwner', ['NewOwner:object:Actor'])],
    ['Net', 'Force Net Update (член Actor)', mem('Actor.ForceNetUpdate', [])],
    ['Net', 'Set Net Dormancy (член Actor)', mem('Actor.SetNetDormancy', ['NewDormancy:enum:ENetDormancy'])],
    ['Net', 'Flush Net Dormancy (член Actor)', mem('Actor.FlushNetDormancy', [])],
    ['Net', 'Set Is Replicated (член ActorComponent)', mem('ActorComponent.SetIsReplicated', ['ShouldReplicate:bool'])],
    ['NetWorld', 'Is Standalone (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.IsStandalone', ['->', 'ReturnValue:bool'], true)],
    ['NetWorld', 'Is Dedicated Server (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.IsDedicatedServer', ['->', 'ReturnValue:bool'], true)],
    ['NetWorld', 'Is Local Controller (член Controller, pure)', mem('Controller.IsLocalController', ['->', 'ReturnValue:bool'], true)],
    ['NetWorld', 'Is Local Player Controller (член PlayerController, pure)', mem('PlayerController.IsLocalPlayerController', ['->', 'ReturnValue:bool'], true)],
    ['NetWorld', 'Get Player Controller ID (GameplayStatics, pure)', lib('GameplayStatics.GetPlayerControllerID', ['Player:object:PlayerController', '->', 'ReturnValue:int'], true)],
    ['RPC', 'Custom Event «Run on Server», Reliable. Проверьте в Details: Replicates = Run on Server, Reliable ✓', repEvent('R42_ServerReliable', 0x80 | 0x200000)],
    ['RPC', 'Custom Event «Multicast», не Reliable. Details: Replicates = Multicast', repEvent('R42_Multicast', 0x4000)],
    ['RPC', 'Custom Event «Run on owning Client», Reliable. Details: Run on owning Client, Reliable ✓', repEvent('R42_ClientReliable', 0x80 | 0x1000000)],
    ['Input', 'Enable Input (член Actor)', mem('Actor.EnableInput', ['PlayerController:object:PlayerController'])],
    ['Input', 'Disable Input (член Actor)', mem('Actor.DisableInput', ['PlayerController:object:PlayerController'])],
    ['Input', 'Get Input Key Time Down (член PlayerController, pure)', mem('PlayerController.GetInputKeyTimeDown', ['Key:key', '->', 'ReturnValue:single'], true)],
    ['Input', 'Was Input Key Just Released (член PlayerController, pure)', mem('PlayerController.WasInputKeyJustReleased', ['Key:key', '->', 'ReturnValue:bool'], true)],
    ['Input', 'Get Input Analog Key State (член PlayerController, pure)', mem('PlayerController.GetInputAnalogKeyState', ['Key:key', '->', 'ReturnValue:single'], true)],
    ['Input', 'Set Mouse Location (член PlayerController)', mem('PlayerController.SetMouseLocation', ['X:int', 'Y:int'])],
    // copy-back R42: FlushPressedKeys не BP-функция; в движке — EnhancedInputLibrary.FlushPlayerInput(PlayerController)
    ['Input', 'Flush Player Input (EnhancedInputLibrary)', lib('/Script/EnhancedInput.EnhancedInputLibrary.FlushPlayerInput', ['PlayerController:object:PlayerController'])],
  ],
  '43': [
    ['Actor', 'Get Attach Parent Actor (член Actor, pure)', mem('Actor.GetAttachParentActor', ['->', 'ReturnValue:object:Actor'], true)],
    ['Actor', 'Get Dot Product To (член Actor, pure)', mem('Actor.GetDotProductTo', ['OtherActor:object:Actor', '->', 'ReturnValue:single'], true)],
    ['Actor', 'Get Horizontal Distance To (член Actor, pure)', mem('Actor.GetHorizontalDistanceTo', ['OtherActor:object:Actor', '->', 'ReturnValue:single'], true)],
    ['Actor', 'Get Actor Bounds (член Actor, pure). Ждём: выходы Origin, Box Extent', mem('Actor.GetActorBounds', ['bOnlyCollidingComponents:bool', 'bIncludeFromChildActors:bool', '->', 'Origin:vector', 'BoxExtent:vector'], true)],
    ['Actor', 'Is Actor Being Destroyed (член Actor, pure)', mem('Actor.IsActorBeingDestroyed', ['->', 'ReturnValue:bool'], true)],
    ['Actor', 'Teleport (член Actor, K2_TeleportTo)', mem('Actor.K2_TeleportTo', ['DestLocation:vector', 'DestRotation:rotator', '->', 'ReturnValue:bool'])],
    ['Actor', 'Was Recently Rendered (член Actor, pure)', mem('Actor.WasRecentlyRendered', ['Tolerance:single=0.200000', '->', 'ReturnValue:bool'], true)],
    ['Actor', 'Set Component Tick Enabled (член ActorComponent)', mem('ActorComponent.SetComponentTickEnabled', ['bEnabled:bool'])],
    ['Math', 'Get Unit Direction (Vector) — GetDirectionUnitVector (KismetMathLibrary, pure)', lib('KismetMathLibrary.GetDirectionUnitVector', ['From:vector', 'To:vector', '->', 'ReturnValue:vector'], true)],
    ['Math', 'Rotate Vector — GreaterGreater_VectorRotator (KismetMathLibrary, pure)', lib('KismetMathLibrary.GreaterGreater_VectorRotator', ['A:vector', 'B:rotator', '->', 'ReturnValue:vector'], true)],
    ['Math', 'Distance 2D (Vector) — Vector_Distance2D (KismetMathLibrary, pure)', lib('KismetMathLibrary.Vector_Distance2D', ['v1:vector', 'v2:vector', '->', 'ReturnValue:double'], true)],
    ['Math', 'RInterp To Constant (KismetMathLibrary, pure)', lib('KismetMathLibrary.RInterpTo_Constant', ['Current:rotator', 'Target:rotator', 'DeltaTime:single', 'InterpSpeed:single', '->', 'ReturnValue:rotator'], true)],
    // copy-back R43: Ease — не KismetMathLibrary-вызов, а K2Node_EaseFunction → src/special-nodes.js createEaseFunction
    ['Math', 'Random Unit Vector in Cone in Degrees (KismetMathLibrary, pure)', lib('KismetMathLibrary.RandomUnitVectorInConeInDegrees', ['ConeDir:vector', 'ConeHalfAngleInDegrees:single', '->', 'ReturnValue:vector'], true)],
    ['Math', 'Mirror Vector by Normal (KismetMathLibrary, pure)', lib('KismetMathLibrary.MirrorVectorByNormal', ['InVect:vector', 'InNormal:vector', '->', 'ReturnValue:vector'], true)],
    ['Math', 'Clamp Vector Size 2D — Vector_ClampSize2D (KismetMathLibrary, pure)', lib('KismetMathLibrary.Vector_ClampSize2D', ['A:vector', 'Min:double', 'Max:double', '->', 'ReturnValue:vector'], true)],
    ['Damage', 'Apply Point Damage (GameplayStatics). Hit Info — HitResult by-ref', ref(lib('GameplayStatics.ApplyPointDamage', ['DamagedActor:object:Actor', 'BaseDamage:single', 'HitFromDirection:vector', 'HitInfo:hitresult', 'EventInstigator:object:Controller', 'DamageCauser:object:Actor', 'DamageTypeClass:class:/Script/Engine.DamageType', '->', 'ReturnValue:single']), 'HitInfo')],
    ['Damage', 'Apply Radial Damage (GameplayStatics). Ignore Actors — массив by-ref', ref(lib('GameplayStatics.ApplyRadialDamage', ['BaseDamage:single', 'Origin:vector', 'DamageRadius:single', 'DamageTypeClass:class:/Script/Engine.DamageType', 'IgnoreActors:object:Actor[]', 'DamageCauser:object:Actor', 'InstigatedByController:object:Controller', 'bDoFullDamage:bool', 'DamagePreventionChannel:enum:ECollisionChannel', '->', 'ReturnValue:bool']), 'IgnoreActors')],
    ['World', 'Get All Actors of Class with Tag (GameplayStatics)', lib('GameplayStatics.GetAllActorsOfClassWithTag', ['ActorClass:class:Actor', 'Tag:name', '->', 'OutActors:object:Actor[]'])],
    ['World', 'Suggest Projectile Velocity Custom Arc (GameplayStatics). Ждём: выход Out Launch Velocity + bool', lib('GameplayStatics.SuggestProjectileVelocity_CustomArc', ['StartPos:vector', 'EndPos:vector', 'OverrideGravityZ:single', 'ArcParam:single=0.500000', '->', 'OutLaunchVelocity:vector', 'ReturnValue:bool'])],
    ['World', 'Set Timer for Next Tick by Function Name (KismetSystemLibrary, K2_SetTimerForNextTick)', lib('KismetSystemLibrary.K2_SetTimerForNextTick', ['Object:object:/Script/CoreUObject.Object', 'FunctionName:string', '->', 'ReturnValue:timerhandle'])],
    // copy-back R43: в FunctionReference движок пишет GetMaxSpeed (не K2_GetMaxSpeed), выход real/float
    ['Movement', 'Get Max Speed (член MovementComponent, pure). Цель — Character Movement и т.п.', mem('MovementComponent.GetMaxSpeed', ['->', 'ReturnValue:single'], true)],
    ['Capsule', 'Set Capsule Size (член CapsuleComponent)', mem('/Script/Engine.CapsuleComponent.SetCapsuleSize', ['InRadius:single', 'InHalfHeight:single', 'bUpdateOverlaps:bool=true'])],
    ['Capsule', 'Get Scaled Capsule Half Height (член CapsuleComponent, pure)', mem('/Script/Engine.CapsuleComponent.GetScaledCapsuleHalfHeight', ['->', 'ReturnValue:single'], true)],
    ['Mesh', 'Get Socket Rotation (член SceneComponent, pure)', mem('SceneComponent.GetSocketRotation', ['InSocketName:name', '->', 'ReturnValue:rotator'], true)],
    ['Mesh', 'Set Skeletal Mesh Asset (член SkeletalMeshComponent)', mem('SkeletalMeshComponent.SetSkeletalMeshAsset', ['NewMesh:object:/Script/Engine.SkeletalMesh'])],
    ['Mesh', 'Set Anim Instance Class (член SkeletalMeshComponent)', mem('SkeletalMeshComponent.SetAnimInstanceClass', ['NewClass:class:/Script/Engine.AnimInstance'])],
    ['Mesh', 'Set Play Rate (член SkeletalMeshComponent)', mem('SkeletalMeshComponent.SetPlayRate', ['Rate:single'])],
  ],
  '44': [
    ['Anim', 'Montage Set Next Section (член AnimInstance)', mem('/Script/Engine.AnimInstance.Montage_SetNextSection', ['SectionNameToChange:name', 'NextSection:name', 'Montage:object:/Script/Engine.AnimMontage'])],
    ['Anim', 'Montage Is Active (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.Montage_IsActive', ['Montage:object:/Script/Engine.AnimMontage', '->', 'ReturnValue:bool'], true)],
    ['Anim', 'Get Current Active Montage (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.GetCurrentActiveMontage', ['->', 'ReturnValue:object:/Script/Engine.AnimMontage'], true)],
    ['Anim', 'Try Get Pawn Owner (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.TryGetPawnOwner', ['->', 'ReturnValue:object:Pawn'], true)],
    ['Anim', 'Set Animation Mode (член SkeletalMeshComponent). Ждём: EAnimationMode + bForceInitAnimScriptInstance', mem('SkeletalMeshComponent.SetAnimationMode', ['InAnimationMode:enum:EAnimationMode', 'bForceInitAnimScriptInstance:bool=true'])],
    ['Anim', 'Get Play Rate (член SkeletalMeshComponent, pure)', mem('SkeletalMeshComponent.GetPlayRate', ['->', 'ReturnValue:single'], true)],
    ['Anim', 'Is Playing (член SkeletalMeshComponent, pure)', mem('SkeletalMeshComponent.IsPlaying', ['->', 'ReturnValue:bool'], true)],
    ['Anim', 'Stop (член SkeletalMeshComponent — одиночная анимация)', mem('SkeletalMeshComponent.Stop', [])],
    ['Anim', 'Set Position (член SkeletalMeshComponent)', mem('SkeletalMeshComponent.SetPosition', ['InPos:single', 'bFireNotifies:bool=true'])],
    ['Camera', 'Set Aspect Ratio (член CameraComponent)', mem('CameraComponent.SetAspectRatio', ['InAspectRatio:single'])],
    ['Camera', 'Set Constraint Aspect Ratio (член CameraComponent)', mem('CameraComponent.SetConstraintAspectRatio', ['bInConstrainAspectRatio:bool'])],
    ['Camera', 'Set Post Process Blend Weight (член CameraComponent)', mem('CameraComponent.SetPostProcessBlendWeight', ['InPostProcessBlendWeight:single'])],
    ['Camera', 'Set Projection Mode (член CameraComponent). ECameraProjectionMode', mem('CameraComponent.SetProjectionMode', ['InProjectionMode:enum:ECameraProjectionMode'])],
    ['Camera', 'Set Ortho Width (член CameraComponent)', mem('CameraComponent.SetOrthoWidth', ['InOrthoWidth:single'])],
    ['Camera', 'Get View Target (член PlayerController, pure)', mem('PlayerController.GetViewTarget', ['->', 'ReturnValue:object:Actor'], true)],
    ['CameraManager', 'Stop All Camera Shakes (член PlayerCameraManager)', mem('PlayerCameraManager.StopAllCameraShakes', ['bImmediately:bool=true'])],
    ['CameraManager', 'Start Camera Fade (член PlayerCameraManager)', mem('PlayerCameraManager.StartCameraFade', ['FromAlpha:single', 'ToAlpha:single', 'Duration:single', 'Color:linearcolor', 'bShouldFadeAudio:bool', 'bHoldWhenFinished:bool'])],
    ['CameraManager', 'Stop Camera Fade (член PlayerCameraManager)', mem('PlayerCameraManager.StopCameraFade', [])],
    ['CameraManager', 'Set Manual Camera Fade (член PlayerCameraManager)', mem('PlayerCameraManager.SetManualCameraFade', ['InFadeAmount:single', 'Color:linearcolor', 'bInFadeAudio:bool'])],
    ['CameraManager', 'Get Camera Location (член PlayerCameraManager, pure)', mem('PlayerCameraManager.GetCameraLocation', ['->', 'ReturnValue:vector'], true)],
    ['CameraManager', 'Get Camera Rotation (член PlayerCameraManager, pure)', mem('PlayerCameraManager.GetCameraRotation', ['->', 'ReturnValue:rotator'], true)],
    ['CameraManager', 'Get FOV Angle (член PlayerCameraManager, pure)', mem('PlayerCameraManager.GetFOVAngle', ['->', 'ReturnValue:single'], true)],
    ['SpringArm', 'Get Unfixed Camera Position (член SpringArmComponent, pure)', mem('/Script/Engine.SpringArmComponent.GetUnfixedCameraPosition', ['->', 'ReturnValue:vector'], true)],
    ['SpringArm', 'Is Collision Fix Applied (член SpringArmComponent, pure)', mem('/Script/Engine.SpringArmComponent.IsCollisionFixApplied', ['->', 'ReturnValue:bool'], true)],
    ['SpringArm', 'Get Target Rotation (член SpringArmComponent, pure)', mem('/Script/Engine.SpringArmComponent.GetTargetRotation', ['->', 'ReturnValue:rotator'], true)],
    ['Spline', 'Get Location at Distance Along Spline (член SplineComponent, pure)', mem('/Script/Engine.SplineComponent.GetLocationAtDistanceAlongSpline', ['Distance:single', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:vector'], true)],
    ['Spline', 'Get Rotation at Distance Along Spline (pure)', mem('/Script/Engine.SplineComponent.GetRotationAtDistanceAlongSpline', ['Distance:single', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:rotator'], true)],
    ['Spline', 'Get Direction at Distance Along Spline (pure)', mem('/Script/Engine.SplineComponent.GetDirectionAtDistanceAlongSpline', ['Distance:single', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:vector'], true)],
    ['Spline', 'Get Tangent at Distance Along Spline (pure)', mem('/Script/Engine.SplineComponent.GetTangentAtDistanceAlongSpline', ['Distance:single', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:vector'], true)],
    ['Spline', 'Get Transform at Distance Along Spline (pure)', mem('/Script/Engine.SplineComponent.GetTransformAtDistanceAlongSpline', ['Distance:single', 'CoordinateSpace:enum:ESplineCoordinateSpace', 'bUseScale:bool', '->', 'ReturnValue:transform'], true)],
    ['Spline', 'Get Spline Length (pure)', mem('/Script/Engine.SplineComponent.GetSplineLength', ['->', 'ReturnValue:single'], true)],
    ['Spline', 'Get Number of Spline Points (pure)', mem('/Script/Engine.SplineComponent.GetNumberOfSplinePoints', ['->', 'ReturnValue:int'], true)],
    ['Spline', 'Get Location at Spline Point (pure)', mem('/Script/Engine.SplineComponent.GetLocationAtSplinePoint', ['PointIndex:int', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:vector'], true)],
    ['Spline', 'Get Distance Along Spline at Spline Point (pure)', mem('/Script/Engine.SplineComponent.GetDistanceAlongSplineAtSplinePoint', ['PointIndex:int', '->', 'ReturnValue:single'], true)],
    ['Spline', 'Find Location Closest to World Location (pure)', mem('/Script/Engine.SplineComponent.FindLocationClosestToWorldLocation', ['WorldLocation:vector', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:vector'], true)],
    ['Spline', 'Find Rotation Closest to World Location (pure)', mem('/Script/Engine.SplineComponent.FindRotationClosestToWorldLocation', ['WorldLocation:vector', 'CoordinateSpace:enum:ESplineCoordinateSpace', '->', 'ReturnValue:rotator'], true)],
    ['Spline', 'Find Input Key Closest to World Location (pure)', mem('/Script/Engine.SplineComponent.FindInputKeyClosestToWorldLocation', ['WorldLocation:vector', '->', 'ReturnValue:single'], true)],
    ['Spline', 'Is Closed Loop (pure)', mem('/Script/Engine.SplineComponent.IsClosedLoop', ['->', 'ReturnValue:bool'], true)],
    ['SplineEdit', 'Add Spline Point (член SplineComponent)', mem('/Script/Engine.SplineComponent.AddSplinePoint', ['Position:vector', 'CoordinateSpace:enum:ESplineCoordinateSpace', 'bUpdateSpline:bool=true'])],
    ['SplineEdit', 'Clear Spline Points', mem('/Script/Engine.SplineComponent.ClearSplinePoints', ['bUpdateSpline:bool=true'])],
    ['SplineEdit', 'Set Location at Spline Point', mem('/Script/Engine.SplineComponent.SetLocationAtSplinePoint', ['PointIndex:int', 'InLocation:vector', 'CoordinateSpace:enum:ESplineCoordinateSpace', 'bUpdateSpline:bool=true'])],
    ['SplineEdit', 'Set Closed Loop', mem('/Script/Engine.SplineComponent.SetClosedLoop', ['bInClosedLoop:bool', 'bUpdateSpline:bool=true'])],
    ['SplineEdit', 'Set Spline Point Type. ESplinePointType', mem('/Script/Engine.SplineComponent.SetSplinePointType', ['PointIndex:int', 'Type:enum:ESplinePointType', 'bUpdateSpline:bool=true'])],
    ['SplineEdit', 'Update Spline', mem('/Script/Engine.SplineComponent.UpdateSpline', [])],
  ],
  '45': [
    ['Render', 'Get Vector Parameter Value (член MaterialInstanceDynamic; copy-back: с exec)', mem('MaterialInstanceDynamic.K2_GetVectorParameterValue', ['ParameterName:name', '->', 'ReturnValue:linearcolor'])],
    ['Render', 'Set Render Custom Depth (член PrimitiveComponent)', mem('PrimitiveComponent.SetRenderCustomDepth', ['bValue:bool'])],
    ['Render', 'Set Custom Depth Stencil Value (член PrimitiveComponent)', mem('PrimitiveComponent.SetCustomDepthStencilValue', ['Value:int'])],
    ['Render', 'Set Overlay Material (член MeshComponent)', mem('/Script/Engine.MeshComponent.SetOverlayMaterial', ['NewOverlayMaterial:object:/Script/Engine.MaterialInterface', 'bSetMaterialSlot:bool', 'SlotIndex:int'])],
    ['Render', 'Spawn Decal Attached (GameplayStatics). EAttachLocation', lib('GameplayStatics.SpawnDecalAttached', ['DecalMaterial:object:/Script/Engine.MaterialInterface', 'DecalSize:vector', 'AttachToComponent:object:SceneComponent', 'AttachPointName:name', 'Location:vector', 'Rotation:rotator', 'LocationType:enum:EAttachLocation', 'LifeSpan:single', '->', 'ReturnValue:object:/Script/Engine.DecalComponent'])],
    ['Render', 'Set Fade Out (член DecalComponent)', mem('/Script/Engine.DecalComponent.SetFadeOut', ['StartDelay:single', 'Duration:single', 'DestroyOwnerAfterFade:bool=true'])],
    ['Render', 'Set Decal Material (член DecalComponent)', mem('/Script/Engine.DecalComponent.SetDecalMaterial', ['NewDecalMaterial:object:/Script/Engine.MaterialInterface'])],
    ['Light', 'Set Attenuation Radius (член LocalLightComponent)', mem('/Script/Engine.LocalLightComponent.SetAttenuationRadius', ['NewRadius:single'])],
    ['Light', 'Set Source Radius (член PointLightComponent)', mem('/Script/Engine.PointLightComponent.SetSourceRadius', ['bNewValue:single'])],
    ['Light', 'Set Inner Cone Angle (член SpotLightComponent)', mem('/Script/Engine.SpotLightComponent.SetInnerConeAngle', ['NewInnerConeAngle:single'])],
    ['Light', 'Set Outer Cone Angle (член SpotLightComponent)', mem('/Script/Engine.SpotLightComponent.SetOuterConeAngle', ['NewOuterConeAngle:single'])],
    ['Light', 'Set Cast Shadows (член LightComponentBase)', mem('/Script/Engine.LightComponentBase.SetCastShadows', ['bNewValue:bool'])],
    ['Physics', 'Set Linear Damping (член PrimitiveComponent)', mem('PrimitiveComponent.SetLinearDamping', ['InDamping:single'])],
    ['Physics', 'Set Angular Damping (член PrimitiveComponent)', mem('PrimitiveComponent.SetAngularDamping', ['InDamping:single'])],
    ['Physics', 'Add Radial Impulse (член PrimitiveComponent). ERadialImpulseFalloff', mem('PrimitiveComponent.AddRadialImpulse', ['Origin:vector', 'Radius:single', 'Strength:single', 'Falloff:enum:ERadialImpulseFalloff', 'bVelChange:bool'])],
    ['Physics', 'Add Radial Force (член PrimitiveComponent)', mem('PrimitiveComponent.AddRadialForce', ['Origin:vector', 'Radius:single', 'Strength:single', 'Falloff:enum:ERadialImpulseFalloff', 'bAccelChange:bool'])],
    ['Physics', 'Wake Rigid Body (член PrimitiveComponent)', mem('PrimitiveComponent.WakeRigidBody', ['BoneName:name'])],
    ['Physics', 'Put Rigid Body to Sleep (член PrimitiveComponent)', mem('PrimitiveComponent.PutRigidBodyToSleep', ['BoneName:name'])],
    ['Physics', 'Set Physics Angular Velocity in Degrees (член PrimitiveComponent)', mem('PrimitiveComponent.SetPhysicsAngularVelocityInDegrees', ['NewAngVel:vector', 'bAddToCurrent:bool', 'BoneName:name'])],
    ['Physics', 'Get Center of Mass (член PrimitiveComponent, pure)', mem('PrimitiveComponent.GetCenterOfMass', ['BoneName:name', '->', 'ReturnValue:vector'], true)],
    ['Physics', 'Fire Impulse (член RadialForceComponent)', mem('/Script/Engine.RadialForceComponent.FireImpulse', [])],
    ['Constraint', 'Set Constrained Components (член PhysicsConstraintComponent)', mem('/Script/Engine.PhysicsConstraintComponent.SetConstrainedComponents', ['Component1:object:PrimitiveComponent', 'BoneName1:name', 'Component2:object:PrimitiveComponent', 'BoneName2:name'])],
    ['Constraint', 'Break Constraint (член PhysicsConstraintComponent)', mem('/Script/Engine.PhysicsConstraintComponent.BreakConstraint', [])],
    ['Constraint', 'Set Linear X Limit. ELinearConstraintMotion', mem('/Script/Engine.PhysicsConstraintComponent.SetLinearXLimit', ['ConstraintType:enum:ELinearConstraintMotion', 'LimitSize:single'])],
    ['Constraint', 'Set Angular Swing 1 Limit. EAngularConstraintMotion', mem('/Script/Engine.PhysicsConstraintComponent.SetAngularSwing1Limit', ['MotionType:enum:EAngularConstraintMotion', 'Swing1LimitAngle:single'])],
    ['Constraint', 'Set Linear Position Drive', mem('/Script/Engine.PhysicsConstraintComponent.SetLinearPositionDrive', ['bEnableDriveX:bool', 'bEnableDriveY:bool', 'bEnableDriveZ:bool'])],
    ['Constraint', 'Set Angular Velocity Target', (() => { const n = mem('/Script/Engine.PhysicsConstraintComponent.SetAngularVelocityTarget', ['InVelTarget:vector'])(); const q = n.pins.find(x => x.name === 'InVelTarget'); q.isRef = true; q.isConst = true; return n; })],
    ['Grab', 'Grab Component at Location (член PhysicsHandleComponent)', mem('/Script/Engine.PhysicsHandleComponent.GrabComponentAtLocation', ['Component:object:PrimitiveComponent', 'InBoneName:name', 'GrabLocation:vector'])],
    ['Grab', 'Grab Component at Location with Rotation', mem('/Script/Engine.PhysicsHandleComponent.GrabComponentAtLocationWithRotation', ['Component:object:PrimitiveComponent', 'InBoneName:name', 'Location:vector', 'Rotation:rotator'])],
    ['Grab', 'Release Component', mem('/Script/Engine.PhysicsHandleComponent.ReleaseComponent', [])],
    ['Grab', 'Set Target Location', mem('/Script/Engine.PhysicsHandleComponent.SetTargetLocation', ['NewLocation:vector'])],
    ['Grab', 'Set Target Location and Rotation', mem('/Script/Engine.PhysicsHandleComponent.SetTargetLocationAndRotation', ['NewLocation:vector', 'NewRotation:rotator'])],
    ['Grab', 'Get Grabbed Component (pure)', mem('/Script/Engine.PhysicsHandleComponent.GetGrabbedComponent', ['->', 'ReturnValue:object:PrimitiveComponent'], true)],
    ['String', 'Starts With (KismetStringLibrary, pure). ESearchCase', lib('KismetStringLibrary.StartsWith', ['SourceString:string', 'InPrefix:string', 'SearchCase:enum:ESearchCase', '->', 'ReturnValue:bool'], true)],
    ['String', 'Ends With (pure)', lib('KismetStringLibrary.EndsWith', ['SourceString:string', 'InSuffix:string', 'SearchCase:enum:ESearchCase', '->', 'ReturnValue:bool'], true)],
    ['String', 'Split (pure). Выходы Left/Right, ESearchDir', lib('KismetStringLibrary.Split', ['SourceString:string', 'InStr:string', 'SearchCase:enum:ESearchCase', 'SearchDir:enum:ESearchDir', '->', 'LeftS:string', 'RightS:string', 'ReturnValue:bool'], true)],
    ['String', 'Reverse (pure)', lib('KismetStringLibrary.Reverse', ['SourceString:string', '->', 'ReturnValue:string'], true)],
    ['String', 'Is Numeric (pure)', lib('KismetStringLibrary.IsNumeric', ['SourceString:string', '->', 'ReturnValue:bool'], true)],
    ['String', 'String to Double — Conv_StringToDouble (pure)', lib('KismetStringLibrary.Conv_StringToDouble', ['InString:string', '->', 'ReturnValue:double'], true)],
    ['String', 'Left Pad (pure)', lib('KismetStringLibrary.LeftPad', ['SourceString:string', 'ChCount:int', '->', 'ReturnValue:string'], true)],
    ['String', 'Get Character as Number (pure)', lib('KismetStringLibrary.GetCharacterAsNumber', ['SourceString:string', 'Index:int', '->', 'ReturnValue:int'], true)],
    ['Map', 'Map Add (BlueprintMapLibrary). Пины wildcard-Map', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Add', ['TargetMap:int', 'Key:int', 'Value:int']), { TargetMap: 'Map&', Key: '&!', Value: '&!' })],
    ['Map', 'Map Remove', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Remove', ['TargetMap:int', 'Key:int', '->', 'ReturnValue:bool']), { TargetMap: 'Map&', Key: '&!' })],
    ['Map', 'Map Find (pure). Выход Value + bool', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Find', ['TargetMap:int', 'Key:int', '->', 'Value:int', 'ReturnValue:bool'], true), { TargetMap: 'Map&!', Key: '&!' })],
    ['Map', 'Map Contains (pure)', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Contains', ['TargetMap:int', 'Key:int', '->', 'ReturnValue:bool'], true), { TargetMap: 'Map&!', Key: '&!' })],
    ['Map', 'Map Keys (copy-back: с exec)', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Keys', ['TargetMap:int', '->', 'Keys:int']), { TargetMap: 'Map&!', Keys: 'Array&' })],
    ['Map', 'Map Values (copy-back: с exec)', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Values', ['TargetMap:int', '->', 'Values:int']), { TargetMap: 'Map&!', Values: 'Array&' })],
    ['Map', 'Map Length (pure)', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Length', ['TargetMap:int', '->', 'ReturnValue:int'], true), { TargetMap: 'Map&!' })],
    ['Map', 'Map Clear', wild(lib('/Script/Engine.BlueprintMapLibrary.Map_Clear', ['TargetMap:int']), { TargetMap: 'Map&' })],
    ['Set', 'Set Add (BlueprintSetLibrary)', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_Add', ['TargetSet:int', 'NewItem:int']), { TargetSet: 'Set&', NewItem: '&!' })],
    ['Set', 'Set Add Items', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_AddItems', ['TargetSet:int', 'NewItems:int']), { TargetSet: 'Set&', NewItems: 'Array&!' })],
    ['Set', 'Set Remove', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_Remove', ['TargetSet:int', 'Item:int', '->', 'ReturnValue:bool']), { TargetSet: 'Set&', Item: '&!' })],
    ['Set', 'Set Contains (pure)', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_Contains', ['TargetSet:int', 'ItemToFind:int', '->', 'ReturnValue:bool'], true), { TargetSet: 'Set&!', ItemToFind: '&!' })],
    ['Set', 'Set Length (pure)', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_Length', ['TargetSet:int', '->', 'ReturnValue:int'], true), { TargetSet: 'Set&!' })],
    ['Set', 'Set To Array (copy-back: с exec)', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_ToArray', ['A:int', '->', 'Result:int']), { A: 'Set&!', Result: 'Array&' })],
    ['Set', 'Set Union (copy-back: с exec)', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_Union', ['A:int', 'B:int', '->', 'Result:int']), { A: 'Set&!', B: 'Set&!', Result: 'Set&' })],
    ['Set', 'Set Clear', wild(lib('/Script/Engine.BlueprintSetLibrary.Set_Clear', ['TargetSet:int']), { TargetSet: 'Set&' })],
    ['UI', 'Set Is Checked (член CheckBox)', mem('/Script/UMG.CheckBox.SetIsChecked', ['InIsChecked:bool'])],
    ['UI', 'Is Checked (член CheckBox, pure)', mem('/Script/UMG.CheckBox.IsChecked', ['->', 'ReturnValue:bool'], true)],
    ['UI', 'Get Checked State (член CheckBox, pure). ECheckBoxState', mem('/Script/UMG.CheckBox.GetCheckedState', ['->', 'ReturnValue:enum:ECheckBoxState'], true)],
    ['UI', 'Add Option (член ComboBoxString)', mem('/Script/UMG.ComboBoxString.AddOption', ['Option:string'])],
    ['UI', 'Get Selected Option (член ComboBoxString, pure)', mem('/Script/UMG.ComboBoxString.GetSelectedOption', ['->', 'ReturnValue:string'], true)],
    ['UI', 'Set Selected Option (член ComboBoxString)', mem('/Script/UMG.ComboBoxString.SetSelectedOption', ['Option:string'])],
    ['UI', 'Clear Options (член ComboBoxString)', mem('/Script/UMG.ComboBoxString.ClearOptions', [])],
    ['UI', 'Scroll to End (член ScrollBox)', mem('/Script/UMG.ScrollBox.ScrollToEnd', [])],
    ['UI', 'Scroll to Start (член ScrollBox)', mem('/Script/UMG.ScrollBox.ScrollToStart', [])],
    ['UI', 'Set Scroll Offset (член ScrollBox)', mem('/Script/UMG.ScrollBox.SetScrollOffset', ['NewScrollOffset:single'])],
    ['UI', 'Get Scroll Offset (член ScrollBox, pure)', mem('/Script/UMG.ScrollBox.GetScrollOffset', ['->', 'ReturnValue:single'], true)],
    ['UILayout', 'Add Child (член PanelWidget)', mem('/Script/UMG.PanelWidget.AddChild', ['Content:object:Widget', '->', 'ReturnValue:object:/Script/UMG.PanelSlot'])],
    ['UILayout', 'Clear Children (член PanelWidget)', mem('/Script/UMG.PanelWidget.ClearChildren', [])],
    ['UILayout', 'Get Children Count (член PanelWidget, pure)', mem('/Script/UMG.PanelWidget.GetChildrenCount', ['->', 'ReturnValue:int'], true)],
    ['UILayout', 'Slot as Canvas Slot (WidgetLayoutLibrary, pure)', lib('/Script/UMG.WidgetLayoutLibrary.SlotAsCanvasSlot', ['Widget:object:Widget', '->', 'ReturnValue:object:/Script/UMG.CanvasPanelSlot'], true)],
    ['UILayout', 'Set Size (член CanvasPanelSlot)', mem('/Script/UMG.CanvasPanelSlot.SetSize', ['InSize:vector2d'])],
    ['UILayout', 'Set Alignment (член CanvasPanelSlot)', mem('/Script/UMG.CanvasPanelSlot.SetAlignment', ['InAlignment:vector2d'])],
    ['UILayout', 'Set ZOrder (член CanvasPanelSlot)', mem('/Script/UMG.CanvasPanelSlot.SetZOrder', ['InZOrder:int'])],
    ['UILayout', 'Set Auto Size (член CanvasPanelSlot)', mem('/Script/UMG.CanvasPanelSlot.SetAutoSize', ['InbAutoSize:bool'])],
    ['UILayout', 'Set Color and Opacity (член Image)', mem('/Script/UMG.Image.SetColorAndOpacity', ['InColorAndOpacity:linearcolor'])],
    ['UILayout', 'Set Justification (член TextLayoutWidget). ETextJustify', mem('/Script/UMG.TextLayoutWidget.SetJustification', ['InJustification:enum:ETextJustify'])],
  ],
  '45b': [
    // R45 досылка: OnMaterials живут в MeshComponent (не PrimitiveComponent); Widget.* ушли в /Script/Engine.Widget по короткому ключу — теперь полный путь UMG
    ['Render', 'Set Scalar Parameter Value on Materials (член MeshComponent)', pf(mem('/Script/Engine.MeshComponent.SetScalarParameterValueOnMaterials', ['ParameterName:name', 'ParameterValue:single']), { ParameterName: '!', ParameterValue: '!' })],
    ['Render', 'Set Vector Parameter Value on Materials (член MeshComponent)', pf(mem('/Script/Engine.MeshComponent.SetVectorParameterValueOnMaterials', ['ParameterName:name', 'ParameterValue:vector']), { ParameterName: '!', ParameterValue: '!' })],
    ['UILayout', 'Set Render Transform Angle (член Widget)', mem('/Script/UMG.Widget.SetRenderTransformAngle', ['Angle:single'])],
    ['UILayout', 'Set Tool Tip Text (член Widget)', pf(mem('/Script/UMG.Widget.SetToolTipText', ['InToolTipText:text']), { InToolTipText: '&!~' })],
    ['UILayout', 'Set Keyboard Focus (член Widget)', mem('/Script/UMG.Widget.SetKeyboardFocus', [])],
    ['UILayout', 'Has Keyboard Focus (член Widget, pure)', mem('/Script/UMG.Widget.HasKeyboardFocus', ['->', 'ReturnValue:bool'], true)],
    // бонус из copy-back движка (ноды поставлены пользователем в UE — подтверждены)
    ['Render', 'Set Scalar Parameter Value By Info (член MID)', pf(mem('/Script/Engine.MaterialInstanceDynamic.SetScalarParameterValueByInfo', ['ParameterInfo:materialparameterinfo', 'Value:single']), { ParameterInfo: '&!~' })],
    ['Render', 'Set Vector Parameter Value By Info (член MID)', pf(mem('/Script/Engine.MaterialInstanceDynamic.SetVectorParameterValueByInfo', ['ParameterInfo:materialparameterinfo', 'Value:linearcolor']), { ParameterInfo: '&!~' })],
    ['UILayout', 'Set Render Transform (член Widget)', mem('/Script/UMG.Widget.SetRenderTransform', ['InTransform:widgettransform'])],
    ['UILayout', 'Set Render Transform Pivot (член Widget)', mem('/Script/UMG.Widget.SetRenderTransformPivot', ['Pivot:vector2d'])],
    ['UILayout', 'Set Tool Tip (член Widget)', mem('/Script/UMG.Widget.SetToolTip', ['Widget:object:/Script/UMG.Widget'])],
  ],
  '46': [
    // R46: Networking/Input (новые, без дублей реестра)
    ['Net', 'Is Standalone (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.IsStandalone', ['->', 'ReturnValue:bool'], true)],
    ['Net', 'Is Packaged For Distribution (KismetSystemLibrary, pure)', lib('KismetSystemLibrary.IsPackagedForDistribution', ['->', 'ReturnValue:bool'], true)],
    ['Net', 'Get Num Player States (GameplayStatics, pure)', lib('GameplayStatics.GetNumPlayerStates', ['->', 'ReturnValue:int'], true)],
    ['Net', 'Get Player State (GameplayStatics, pure)', lib('GameplayStatics.GetPlayerState', ['PlayerStateIndex:int', '->', 'ReturnValue:object:/Script/Engine.PlayerState'], true)],
    ['Net', 'Get Player Controller From ID (GameplayStatics, pure)', lib('GameplayStatics.GetPlayerControllerFromID', ['ControllerID:int', '->', 'ReturnValue:object:PlayerController'], true)],
    ['Net', 'Create Player (GameplayStatics)', lib('GameplayStatics.CreatePlayer', ['ControllerId:int=-1', 'bSpawnPlayerController:bool=true', '->', 'ReturnValue:object:PlayerController'])],
    ['Net', 'Remove Player (GameplayStatics)', lib('GameplayStatics.RemovePlayer', ['Player:object:PlayerController', 'bDestroyPawn:bool'])],
    ['Player', 'Get Player Name (член PlayerState, pure)', mem('/Script/Engine.PlayerState.GetPlayerName', ['->', 'ReturnValue:string'], true)],
    ['Player', 'Get Player Id (член PlayerState, pure)', mem('/Script/Engine.PlayerState.GetPlayerId', ['->', 'ReturnValue:int'], true)],
    ['Player', 'Get Score (член PlayerState, pure)', mem('/Script/Engine.PlayerState.GetScore', ['->', 'ReturnValue:single'], true)],
    ['Player', 'Get Ping In Milliseconds (член PlayerState, pure)', mem('/Script/Engine.PlayerState.GetPingInMilliseconds', ['->', 'ReturnValue:single'], true)],
    ['Player', 'Is Player Controlled (член Pawn, pure)', mem('/Script/Engine.Pawn.IsPlayerControlled', ['->', 'ReturnValue:bool'], true)],
    ['Player', 'Is Bot Controlled (член Pawn, pure)', mem('/Script/Engine.Pawn.IsBotControlled', ['->', 'ReturnValue:bool'], true)],
    ['Player', 'Is Pawn Controlled (член Pawn, pure)', mem('/Script/Engine.Pawn.IsPawnControlled', ['->', 'ReturnValue:bool'], true)],
    ['Player', 'Get Base Aim Rotation (член Pawn, pure)', mem('/Script/Engine.Pawn.GetBaseAimRotation', ['->', 'ReturnValue:rotator'], true)],
    ['Controller', 'Possess (член Controller)', mem('/Script/Engine.Controller.Possess', ['InPawn:object:Pawn'])],
    ['Controller', 'Un Possess (член Controller)', mem('/Script/Engine.Controller.UnPossess', [])],
    ['Controller', 'Get Controlled Pawn (член Controller, pure)', mem('/Script/Engine.Controller.K2_GetPawn', ['->', 'ReturnValue:object:Pawn'], true)],
    ['Controller', 'Get Control Rotation (член Controller, pure)', mem('/Script/Engine.Controller.GetControlRotation', ['->', 'ReturnValue:rotator'], true)],
    ['Controller', 'Set Control Rotation (член Controller)', mem('/Script/Engine.Controller.SetControlRotation', ['NewRotation:rotator'])],
    ['Controller', 'Is Player Controller (член Controller, pure)', mem('/Script/Engine.Controller.IsPlayerController', ['->', 'ReturnValue:bool'], true)],
    ['Controller', 'Set View Target with Blend (член PlayerController). EViewTargetBlendFunction', mem('/Script/Engine.PlayerController.SetViewTargetWithBlend', ['NewViewTarget:object:Actor', 'BlendTime:single', 'BlendFunc:enum:EViewTargetBlendFunction', 'BlendExp:single', 'bLockOutgoing:bool'])],
    ['Controller', 'Set Cinematic Mode (член PlayerController)', mem('/Script/Engine.PlayerController.SetCinematicMode', ['bInCinematicMode:bool', 'bHidePlayer:bool', 'bAffectsHUD:bool', 'bAffectsMovement:bool', 'bAffectsTurning:bool'])],
    ['Screen', 'Get Input Mouse Delta (член PlayerController, pure)', mem('/Script/Engine.PlayerController.GetInputMouseDelta', ['->', 'DeltaX:single', 'DeltaY:single'], true)],
    ['Screen', 'Get Viewport Size (член PlayerController, pure)', mem('/Script/Engine.PlayerController.GetViewportSize', ['->', 'SizeX:int', 'SizeY:int'], true)],
    ['Screen', 'Deproject Mouse Position To World (член PlayerController, pure)', mem('/Script/Engine.PlayerController.DeprojectMousePositionToWorld', ['->', 'WorldLocation:vector', 'WorldDirection:vector', 'ReturnValue:bool'], true)],
    ['Screen', 'Deproject Screen Position To World (член PlayerController, pure)', mem('/Script/Engine.PlayerController.DeprojectScreenPositionToWorld', ['ScreenX:single', 'ScreenY:single', '->', 'WorldLocation:vector', 'WorldDirection:vector', 'ReturnValue:bool'], true)],
    ['Screen', 'Project World Location To Screen (член PlayerController, pure)', mem('/Script/Engine.PlayerController.ProjectWorldLocationToScreen', ['WorldLocation:vector', 'bPlayerViewportRelative:bool', '->', 'ScreenLocation:vector2d', 'ReturnValue:bool'], true)],
    ['Screen', 'Get Input Touch State (член PlayerController, pure)', mem('/Script/Engine.PlayerController.GetInputTouchState', ['FingerIndex:byte', '->', 'LocationX:single', 'LocationY:single', 'bIsCurrentlyPressed:bool'], true)],
    ['MoveInput', 'Add Controller Roll Input (член Pawn)', mem('/Script/Engine.Pawn.AddControllerRollInput', ['Val:single'])],
    ['MoveInput', 'Get Pending Movement Input Vector (член Pawn, pure)', mem('/Script/Engine.Pawn.GetPendingMovementInputVector', ['->', 'ReturnValue:vector'], true)],
    ['MoveInput', 'Get Last Movement Input Vector (член Pawn, pure)', mem('/Script/Engine.Pawn.GetLastMovementInputVector', ['->', 'ReturnValue:vector'], true)],
    ['MoveInput', 'Consume Movement Input Vector (член Pawn)', mem('/Script/Engine.Pawn.ConsumeMovementInputVector', ['->', 'ReturnValue:vector'])],
    ['Keys', 'Is Gamepad Key (KismetInputLibrary, pure)', lib('/Script/Engine.KismetInputLibrary.Key_IsGamepadKey', ['Key:key', '->', 'ReturnValue:bool'], true)],
    ['Keys', 'Is Mouse Button (KismetInputLibrary, pure)', lib('/Script/Engine.KismetInputLibrary.Key_IsMouseButton', ['Key:key', '->', 'ReturnValue:bool'], true)],
    ['Keys', 'Is Keyboard Key (KismetInputLibrary, pure)', lib('/Script/Engine.KismetInputLibrary.Key_IsKeyboardKey', ['Key:key', '->', 'ReturnValue:bool'], true)],
    ['Keys', 'Key Is Valid (KismetInputLibrary, pure)', lib('/Script/Engine.KismetInputLibrary.Key_IsValid', ['Key:key', '->', 'ReturnValue:bool'], true)],
    ['Keys', 'Get Key Display Name (KismetInputLibrary, pure)', lib('/Script/Engine.KismetInputLibrary.Key_GetDisplayName', ['Key:key', 'bLongDisplayName:bool=true', '->', 'ReturnValue:text'], true)],
    ['Keys', 'Equal (Key) (KismetInputLibrary, pure)', lib('/Script/Engine.KismetInputLibrary.EqualEqual_KeyKey', ['A:key', 'B:key', '->', 'ReturnValue:bool'], true)],
  ],
  '47': [
    // R47: Sound/FX/Damage/AI/Blackboard/Nav/Game/HUD/UI (без дублей реестра)
    ['Sound', 'Spawn Sound 2D (GameplayStatics)', lib('GameplayStatics.SpawnSound2D', ['Sound:object:/Script/Engine.SoundBase', 'VolumeMultiplier:single=1.000000', 'PitchMultiplier:single=1.000000', 'StartTime:single', 'ConcurrencySettings:object:/Script/Engine.SoundConcurrency', 'bPersistAcrossLevelTransition:bool', 'bAutoDestroy:bool=true', '->', 'ReturnValue:object:/Script/Engine.AudioComponent'])],
    ['Sound', 'Spawn Sound Attached (GameplayStatics)', lib('GameplayStatics.SpawnSoundAttached', ['Sound:object:/Script/Engine.SoundBase', 'AttachToComponent:object:SceneComponent', 'AttachPointName:name', 'Location:vector', 'Rotation:rotator', 'LocationType:enum:EAttachLocation', 'bStopWhenAttachedToDestroyed:bool', 'VolumeMultiplier:single=1.000000', 'PitchMultiplier:single=1.000000', 'StartTime:single', 'AttenuationSettings:object:/Script/Engine.SoundAttenuation', 'ConcurrencySettings:object:/Script/Engine.SoundConcurrency', 'bAutoDestroy:bool=true', '->', 'ReturnValue:object:/Script/Engine.AudioComponent'])],
    ['Sound', 'Push Sound Mix Modifier (GameplayStatics)', lib('GameplayStatics.PushSoundMixModifier', ['InSoundMixModifier:object:/Script/Engine.SoundMix'])],
    ['Sound', 'Pop Sound Mix Modifier (GameplayStatics)', lib('GameplayStatics.PopSoundMixModifier', ['InSoundMixModifier:object:/Script/Engine.SoundMix'])],
    ['Sound', 'Clear Sound Mix Modifiers (GameplayStatics)', lib('GameplayStatics.ClearSoundMixModifiers', [])],
    ['Sound', 'Play (член AudioComponent)', mem('/Script/Engine.AudioComponent.Play', ['StartTime:single'])],
    ['Sound', 'Stop (член AudioComponent)', mem('/Script/Engine.AudioComponent.Stop', [])],
    ['Sound', 'SetPaused (член AudioComponent)', mem('/Script/Engine.AudioComponent.SetPaused', ['bPause:bool'])],
    ['Sound', 'IsPlaying (член AudioComponent, pure)', mem('/Script/Engine.AudioComponent.IsPlaying', ['->', 'ReturnValue:bool'], true)],
    ['Sound', 'SetPitchMultiplier (член AudioComponent)', mem('/Script/Engine.AudioComponent.SetPitchMultiplier', ['NewPitchMultiplier:single'])],
    ['Sound', 'SetSound (член AudioComponent)', mem('/Script/Engine.AudioComponent.SetSound', ['NewSound:object:/Script/Engine.SoundBase'])],
    ['Sound', 'AdjustVolume (член AudioComponent)', mem('/Script/Engine.AudioComponent.AdjustVolume', ['AdjustVolumeDuration:single', 'AdjustVolumeLevel:single', 'FadeCurve:enum:EAudioFaderCurve'])],
    ['Sound', 'SetUISound (член AudioComponent)', mem('/Script/Engine.AudioComponent.SetUISound', ['bInUISound:bool'])],
    ['FX', 'SetVariableInt (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.SetVariableInt', ['InVariableName:name', 'InValue:int'])],
    ['FX', 'SetVariableVec2 (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.SetVariableVec2', ['InVariableName:name', 'InValue:vector2d'])],
    ['FX', 'SetVariableActor (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.SetVariableActor', ['InVariableName:name', 'Actor:object:Actor'])],
    ['FX', 'SetVariableObject (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.SetVariableObject', ['InVariableName:name', 'Object:object:/Script/CoreUObject.Object'])],
    ['FX', 'Reinitialize System (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.ReinitializeSystem', [])],
    ['FX', 'Reset System (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.ResetSystem', [])],
    ['FX', 'Set Paused (член NiagaraComponent)', mem('/Script/Niagara.NiagaraComponent.SetPaused', ['bInPaused:bool'])],
    ['FX', 'Get Asset (член NiagaraComponent, pure)', mem('/Script/Niagara.NiagaraComponent.GetAsset', ['->', 'ReturnValue:object:/Script/Niagara.NiagaraSystem'], true)],
    ['FX', 'Spawn Emitter Attached (GameplayStatics, Cascade)', lib('GameplayStatics.SpawnEmitterAttached', ['EmitterTemplate:object:/Script/Engine.ParticleSystem', 'AttachToComponent:object:SceneComponent', 'AttachPointName:name', 'Location:vector', 'Rotation:rotator', 'Scale:vector', 'LocationType:enum:EAttachLocation', 'bAutoDestroy:bool=true', 'PoolingMethod:enum:EPSCPoolMethod', 'bAutoActivate:bool=true', '->', 'ReturnValue:object:/Script/Engine.ParticleSystemComponent'])],
    ['FX', 'Play Dynamic Force Feedback (член PlayerController)', mem('/Script/Engine.PlayerController.K2_ClientPlayForceFeedback', ['ForceFeedbackEffect:object:/Script/Engine.ForceFeedbackEffect', 'Tag:name', 'bLooping:bool', 'bIgnoreTimeDilation:bool', 'bPlayWhilePaused:bool'])],
    ['FX', 'Client Stop Force Feedback (член PlayerController)', mem('/Script/Engine.PlayerController.ClientStopForceFeedback', ['ForceFeedbackEffect:object:/Script/Engine.ForceFeedbackEffect', 'Tag:name'])],
    ['FX', 'Stop Camera Shake (член PlayerCameraManager)', mem('/Script/Engine.PlayerCameraManager.StopCameraShake', ['ShakeInstance:object:/Script/Engine.CameraShakeBase', 'bImmediately:bool=true'])],
    ['Damage', 'Apply Radial Damage with Falloff (GameplayStatics)', lib('GameplayStatics.ApplyRadialDamageWithFalloff', ['BaseDamage:single', 'MinimumDamage:single', 'Origin:vector', 'DamageInnerRadius:single', 'DamageOuterRadius:single', 'DamageFalloff:single', 'DamageTypeClass:class:/Script/Engine.DamageType', 'IgnoreActors:object:Actor[]', 'DamageCauser:object:Actor', 'InstigatedByController:object:Controller', 'DamagePreventionChannel:enum:ECollisionChannel', '->', 'ReturnValue:bool'])],
    ['Damage', 'Get Instigator (член Actor, pure)', mem('/Script/Engine.Actor.GetInstigator', ['->', 'ReturnValue:object:Pawn'], true)],
    ['Damage', 'Get Instigator Controller (член Actor, pure)', mem('/Script/Engine.Actor.GetInstigatorController', ['->', 'ReturnValue:object:Controller'], true)],
    ['Damage', 'Set Life Span (член Actor)', mem('/Script/Engine.Actor.SetLifeSpan', ['InLifespan:single'])],
    ['Damage', 'Get Life Span (член Actor, pure)', mem('/Script/Engine.Actor.GetLifeSpan', ['->', 'ReturnValue:single'], true)],
    ['AI', 'Simple Move To Actor (AIBlueprintHelperLibrary)', lib('/Script/AIModule.AIBlueprintHelperLibrary.SimpleMoveToActor', ['Controller:object:Controller', 'Goal:object:Actor'])],
    ['AI', 'Spawn AI From Class (AIBlueprintHelperLibrary)', lib('/Script/AIModule.AIBlueprintHelperLibrary.SpawnAIFromClass', ['PawnClass:class:Pawn', 'BehaviorTree:object:/Script/AIModule.BehaviorTree', 'Location:vector', 'Rotation:rotator', 'bNoCollisionFail:bool', 'Owner:object:Actor', '->', 'ReturnValue:object:Pawn'])],
    ['AI', 'Move To Location (член AIController). EPathFollowingRequestResult', mem('/Script/AIModule.AIController.MoveToLocation', ['Dest:vector', 'AcceptanceRadius:single=-1.000000', 'bStopOnOverlap:bool=true', 'bUsePathfinding:bool=true', 'bProjectDestinationToNavigation:bool', 'bCanStrafe:bool=true', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', 'bAllowPartialPath:bool=true', '->', 'ReturnValue:enum:EPathFollowingRequestResult'])],
    ['AI', 'Move To Actor (член AIController)', mem('/Script/AIModule.AIController.MoveToActor', ['Goal:object:Actor', 'AcceptanceRadius:single=-1.000000', 'bStopOnOverlap:bool=true', 'bUsePathfinding:bool=true', 'bCanStrafe:bool=true', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', 'bAllowPartialPath:bool=true', '->', 'ReturnValue:enum:EPathFollowingRequestResult'])],
    ['AI', 'Stop Movement (член Controller)', mem('/Script/Engine.Controller.StopMovement', [])],
    ['AI', 'Get Move Status (член AIController, pure). EPathFollowingStatus', mem('/Script/AIModule.AIController.GetMoveStatus', ['->', 'ReturnValue:enum:EPathFollowingStatus'], true)],
    ['AI', 'Set Focal Point (член AIController)', mem('/Script/AIModule.AIController.K2_SetFocalPoint', ['FP:vector'])],
    ['AI', 'Get Focal Point (член AIController, pure)', mem('/Script/AIModule.AIController.GetFocalPoint', ['->', 'ReturnValue:vector'], true)],
    ['AI', 'Get Focus Actor (член AIController, pure)', mem('/Script/AIModule.AIController.GetFocusActor', ['->', 'ReturnValue:object:Actor'], true)],
    ['AI', 'Use Blackboard (член AIController)', mem('/Script/AIModule.AIController.UseBlackboard', ['BlackboardAsset:object:/Script/AIModule.BlackboardData', '->', 'BlackboardComponent:object:/Script/AIModule.BlackboardComponent', 'ReturnValue:bool'])],
    ['AI', 'Get Path Following Component (член AIController, pure)', mem('/Script/AIModule.AIController.GetPathFollowingComponent', ['->', 'ReturnValue:object:/Script/AIModule.PathFollowingComponent'], true)],
    ['AI', 'Has Partial Path (член AIController, pure)', mem('/Script/AIModule.AIController.HasPartialPath', ['->', 'ReturnValue:bool'], true)],
    ['AI', 'Get Immediate Move Destination (член AIController, pure)', mem('/Script/AIModule.AIController.GetImmediateMoveDestination', ['->', 'ReturnValue:vector'], true)],
    ['Blackboard', 'Set Value as Int (член BlackboardComponent)', pf(mem('/Script/AIModule.BlackboardComponent.SetValueAsInt', ['KeyName:name', 'IntValue:int']), { KeyName: '&!' })],
    ['Blackboard', 'Get Value as Int (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetValueAsInt', ['KeyName:name', '->', 'ReturnValue:int'], true), { KeyName: '&!' })],
    ['Blackboard', 'Set Value as Name (член BlackboardComponent)', pf(mem('/Script/AIModule.BlackboardComponent.SetValueAsName', ['KeyName:name', 'NameValue:name']), { KeyName: '&!' })],
    ['Blackboard', 'Get Value as Name (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetValueAsName', ['KeyName:name', '->', 'ReturnValue:name'], true), { KeyName: '&!' })],
    ['Blackboard', 'Set Value as String (член BlackboardComponent)', pf(mem('/Script/AIModule.BlackboardComponent.SetValueAsString', ['KeyName:name', 'StringValue:string']), { KeyName: '&!' })],
    ['Blackboard', 'Get Value as String (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetValueAsString', ['KeyName:name', '->', 'ReturnValue:string'], true), { KeyName: '&!' })],
    ['Blackboard', 'Set Value as Rotator (член BlackboardComponent)', pf(mem('/Script/AIModule.BlackboardComponent.SetValueAsRotator', ['KeyName:name', 'VectorValue:rotator']), { KeyName: '&!' })],
    ['Blackboard', 'Get Value as Rotator (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetValueAsRotator', ['KeyName:name', '->', 'ReturnValue:rotator'], true), { KeyName: '&!' })],
    ['Blackboard', 'Set Value as Enum (член BlackboardComponent)', pf(mem('/Script/AIModule.BlackboardComponent.SetValueAsEnum', ['KeyName:name', 'EnumValue:byte']), { KeyName: '&!' })],
    ['Blackboard', 'Get Value as Enum (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetValueAsEnum', ['KeyName:name', '->', 'ReturnValue:byte'], true), { KeyName: '&!' })],
    ['Blackboard', 'Set Value as Class (член BlackboardComponent)', pf(mem('/Script/AIModule.BlackboardComponent.SetValueAsClass', ['KeyName:name', 'ClassValue:class:/Script/CoreUObject.Object']), { KeyName: '&!' })],
    ['Blackboard', 'Get Value as Class (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetValueAsClass', ['KeyName:name', '->', 'ReturnValue:class:/Script/CoreUObject.Object'], true), { KeyName: '&!' })],
    ['Blackboard', 'Is Vector Value Set (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.IsVectorValueSet', ['KeyName:name', '->', 'ReturnValue:bool'], true), { KeyName: '&!' })],
    ['Blackboard', 'Get Location From Entry (член BlackboardComponent, pure)', pf(mem('/Script/AIModule.BlackboardComponent.GetLocationFromEntry', ['KeyName:name', '->', 'ResultLocation:vector', 'ReturnValue:bool'], true), { KeyName: '&!' })],
    ['Nav', 'Get Random Reachable Point In Radius (NavigationSystemV1)', lib('/Script/NavigationSystem.NavigationSystemV1.K2_GetRandomReachablePointInRadius', ['Origin:vector', 'Radius:single', 'NavData:object:/Script/NavigationSystem.NavigationData', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', '->', 'RandomLocation:vector', 'ReturnValue:bool'])],
    ['Nav', 'Get Random Location In Navigable Radius (NavigationSystemV1)', lib('/Script/NavigationSystem.NavigationSystemV1.K2_GetRandomLocationInNavigableRadius', ['Origin:vector', 'Radius:single', 'NavData:object:/Script/NavigationSystem.NavigationData', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', '->', 'RandomLocation:vector', 'ReturnValue:bool'])],
    ['Nav', 'Project Point To Navigation (NavigationSystemV1)', lib('/Script/NavigationSystem.NavigationSystemV1.K2_ProjectPointToNavigation', ['Point:vector', 'NavData:object:/Script/NavigationSystem.NavigationData', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', 'QueryExtent:vector', '->', 'ProjectedLocation:vector', 'ReturnValue:bool'])],
    ['Nav', 'Find Path To Location Synchronously (NavigationSystemV1)', lib('/Script/NavigationSystem.NavigationSystemV1.FindPathToLocationSynchronously', ['PathStart:vector', 'PathEnd:vector', 'PathfindingContext:object:Actor', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', '->', 'ReturnValue:object:/Script/NavigationSystem.NavigationPath'])],
    ['Nav', 'Find Path To Actor Synchronously (NavigationSystemV1)', lib('/Script/NavigationSystem.NavigationSystemV1.FindPathToActorSynchronously', ['PathStart:vector', 'GoalActor:object:Actor', 'TetherDistance:single=50.000000', 'PathfindingContext:object:Actor', 'FilterClass:class:/Script/NavigationSystem.NavigationQueryFilter', '->', 'ReturnValue:object:/Script/NavigationSystem.NavigationPath'])],
    ['Nav', 'GetPathLength (член NavigationPath, pure)', mem('/Script/NavigationSystem.NavigationPath.GetPathLength', ['->', 'ReturnValue:double'], true)],
    ['Nav', 'GetPathCost (член NavigationPath, pure)', mem('/Script/NavigationSystem.NavigationPath.GetPathCost', ['->', 'ReturnValue:double'], true)],
    ['Nav', 'IsValid (член NavigationPath, pure)', mem('/Script/NavigationSystem.NavigationPath.IsValid', ['->', 'ReturnValue:bool'], true)],
    ['Nav', 'IsPartial (член NavigationPath, pure)', mem('/Script/NavigationSystem.NavigationPath.IsPartial', ['->', 'ReturnValue:bool'], true)],
    ['Game', 'Restart Player (член GameModeBase)', mem('/Script/Engine.GameModeBase.RestartPlayer', ['NewPlayer:object:Controller'])],
    ['Game', 'Restart Player At Player Start (член GameModeBase)', mem('/Script/Engine.GameModeBase.RestartPlayerAtPlayerStart', ['NewPlayer:object:Controller', 'StartSpot:object:Actor'])],
    ['Game', 'Restart Player At Transform (член GameModeBase)', mem('/Script/Engine.GameModeBase.RestartPlayerAtTransform', ['NewPlayer:object:Controller', 'SpawnTransform:transform'])],
    ['Game', 'Find Player Start (член GameModeBase)', mem('/Script/Engine.GameModeBase.K2_FindPlayerStart', ['Player:object:Controller', 'IncomingName:string', '->', 'ReturnValue:object:Actor'])],
    ['Game', 'Get Num Players (член GameModeBase)', mem('/Script/Engine.GameModeBase.GetNumPlayers', ['->', 'ReturnValue:int'])],
    ['Game', 'Get Num Spectators (член GameModeBase)', mem('/Script/Engine.GameModeBase.GetNumSpectators', ['->', 'ReturnValue:int'])],
    ['Game', 'Change Name (член GameModeBase)', mem('/Script/Engine.GameModeBase.ChangeName', ['Controller:object:Controller', 'NewName:string', 'bNameChange:bool'])],
    ['Game', 'Get Server World Time Seconds (член GameStateBase, pure)', mem('/Script/Engine.GameStateBase.GetServerWorldTimeSeconds', ['->', 'ReturnValue:double'], true)],
    ['Game', 'Get HUD (член PlayerController, pure)', mem('/Script/Engine.PlayerController.GetHUD', ['->', 'ReturnValue:object:/Script/Engine.HUD'], true)],
    ['Game', 'Get Real Time Seconds (GameplayStatics, pure)', lib('GameplayStatics.GetRealTimeSeconds', ['->', 'ReturnValue:double'], true)],
    ['Game', 'Get Unpaused Time Seconds (GameplayStatics, pure)', lib('GameplayStatics.GetUnpausedTimeSeconds', ['->', 'ReturnValue:double'], true)],
    ['Game', 'Get Current Level Name (GameplayStatics, pure)', lib('GameplayStatics.GetCurrentLevelName', ['bRemovePrefixString:bool=true', '->', 'ReturnValue:string'], true)],
    ['Game', 'Set Player Controller ID (GameplayStatics)', lib('GameplayStatics.SetPlayerControllerID', ['Player:object:PlayerController', 'ControllerId:int'])],
    ['HUD', 'Draw Text (член HUD)', mem('/Script/Engine.HUD.DrawText', ['Text:string', 'TextColor:linearcolor', 'ScreenX:single', 'ScreenY:single', 'Font:object:/Script/Engine.Font', 'Scale:single=1.000000', 'bScalePosition:bool'])],
    ['HUD', 'Draw Rect (член HUD)', mem('/Script/Engine.HUD.DrawRect', ['RectColor:linearcolor', 'ScreenX:single', 'ScreenY:single', 'ScreenW:single', 'ScreenH:single'])],
    ['HUD', 'Draw Line (член HUD)', mem('/Script/Engine.HUD.DrawLine', ['StartScreenX:single', 'StartScreenY:single', 'EndScreenX:single', 'EndScreenY:single', 'LineColor:linearcolor', 'LineThickness:single'])],
    ['HUD', 'Draw Texture Simple (член HUD)', mem('/Script/Engine.HUD.DrawTextureSimple', ['Texture:object:/Script/Engine.Texture', 'ScreenX:single', 'ScreenY:single', 'Scale:single=1.000000', 'bScalePosition:bool'])],
    ['HUD', 'Get Text Size (член HUD)', mem('/Script/Engine.HUD.GetTextSize', ['Text:string', 'Font:object:/Script/Engine.Font', 'Scale:single=1.000000', '->', 'OutWidth:single', 'OutHeight:single'])],
    ['HUD', 'Project (член HUD)', mem('/Script/Engine.HUD.Project', ['Location:vector', 'bClampToZeroPlane:bool', '->', 'ReturnValue:vector'])],
    ['HUD', 'Get Owning Player Controller (член HUD, pure)', mem('/Script/Engine.HUD.GetOwningPlayerController', ['->', 'ReturnValue:object:PlayerController'], true)],
    ['HUD', 'Get Owning Pawn (член HUD, pure)', mem('/Script/Engine.HUD.GetOwningPawn', ['->', 'ReturnValue:object:Pawn'], true)],
    ['UI', 'Is Animation Playing (член UserWidget, pure)', mem('/Script/UMG.UserWidget.IsAnimationPlaying', ['InAnimation:object:/Script/UMG.WidgetAnimation', '->', 'ReturnValue:bool'], true)],
    ['UI', 'Pause Animation (член UserWidget)', mem('/Script/UMG.UserWidget.PauseAnimation', ['InAnimation:object:/Script/UMG.WidgetAnimation', '->', 'ReturnValue:single'])],
    ['UI', 'Set Owning Player (член UserWidget)', mem('/Script/UMG.UserWidget.SetOwningPlayer', ['LocalPlayerController:object:PlayerController'])],
    ['UI', 'Get Owning Player (член UserWidget, pure)', mem('/Script/UMG.UserWidget.GetOwningPlayer', ['->', 'ReturnValue:object:PlayerController'], true)],
    ['UI', 'Get Owning Player Pawn (член UserWidget, pure)', mem('/Script/UMG.UserWidget.GetOwningPlayerPawn', ['->', 'ReturnValue:object:Pawn'], true)],
    ['UI', 'Set Fill Color and Opacity (член ProgressBar)', mem('/Script/UMG.ProgressBar.SetFillColorAndOpacity', ['InColor:linearcolor'])],
    ['UI', 'Set Text (член EditableTextBox)', mem('/Script/UMG.EditableTextBox.SetText', ['InText:text'])],
    ['UI', 'Get Text (член EditableTextBox, pure)', mem('/Script/UMG.EditableTextBox.GetText', ['->', 'ReturnValue:text'], true)],
    ['UI', 'Set Hint Text (член EditableTextBox)', mem('/Script/UMG.EditableTextBox.SetHintText', ['InText:text'])],
    ['UI', 'Set Brush From Material (член Image)', mem('/Script/UMG.Image.SetBrushFromMaterial', ['Material:object:/Script/Engine.MaterialInterface'])],
    ['UI', 'Get Dynamic Material (член Image)', mem('/Script/UMG.Image.GetDynamicMaterial', ['->', 'ReturnValue:object:MaterialInstanceDynamic'])],
    ['UI', 'Set Color and Opacity (член TextBlock)', mem('/Script/UMG.TextBlock.SetColorAndOpacity', ['InColorAndOpacity:linearcolor'])],
    ['UI', 'Get Text (член TextBlock, pure)', mem('/Script/UMG.TextBlock.GetText', ['->', 'ReturnValue:text'], true)],
    ['UI', 'Set Min Value (член Slider)', mem('/Script/UMG.Slider.SetMinValue', ['InValue:single'])],
    ['UI', 'Set Max Value (член Slider)', mem('/Script/UMG.Slider.SetMaxValue', ['InValue:single'])],
    ['UI', 'Get Selected Option (член ComboBoxString, pure)', mem('/Script/UMG.ComboBoxString.GetSelectedOption', ['->', 'ReturnValue:string'], true)],
    ['UI', 'Set Background Color (член Button)', mem('/Script/UMG.Button.SetBackgroundColor', ['InBackgroundColor:linearcolor'])],
    ['UI', 'Is Hovered (член Widget, pure)', mem('/Script/UMG.Widget.IsHovered', ['->', 'ReturnValue:bool'], true)],
    ['UI', 'Get Is Enabled (член Widget, pure)', mem('/Script/UMG.Widget.GetIsEnabled', ['->', 'ReturnValue:bool'], true)],
    ['UI', 'Get Visibility (член Widget, pure)', mem('/Script/UMG.Widget.GetVisibility', ['->', 'ReturnValue:enum:ESlateVisibility'], true)],
    ['UI', 'Get Parent (член Widget, pure)', mem('/Script/UMG.Widget.GetParent', ['->', 'ReturnValue:object:/Script/UMG.PanelWidget'], true)],
    ['UI', 'Remove Child At (член PanelWidget)', mem('/Script/UMG.PanelWidget.RemoveChildAt', ['Index:int', '->', 'ReturnValue:bool'])],
    ['UI', 'Get Child At (член PanelWidget, pure)', mem('/Script/UMG.PanelWidget.GetChildAt', ['Index:int', '->', 'ReturnValue:object:/Script/UMG.Widget'], true)],
  ],
  '48': [
    // R48: Text/String/Math/Time/CharMove/Actor/Scene/Prim/Debug/Data+Anim (без дублей реестра)
    ['Text', 'Conv_IntToText (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.Conv_IntToText', ['Value:int', 'bAlwaysSign:bool', 'bUseGrouping:bool=true', 'MinimumIntegralDigits:int=1', 'MaximumIntegralDigits:int=324', '->', 'ReturnValue:text'], true)],
    ['Text', 'Conv_DoubleToText (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.Conv_DoubleToText', ['Value:double', 'RoundingMode:enum:ERoundingMode', 'bAlwaysSign:bool', 'bUseGrouping:bool=true', 'MinimumIntegralDigits:int=1', 'MaximumIntegralDigits:int=324', 'MinimumFractionalDigits:int=0', 'MaximumFractionalDigits:int=3', '->', 'ReturnValue:text'], true)],
    ['Text', 'Conv_BoolToText (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.Conv_BoolToText', ['InBool:bool', '->', 'ReturnValue:text'], true)],
    ['Text', 'Conv_NameToText (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.Conv_NameToText', ['InName:name', '->', 'ReturnValue:text'], true)],
    ['Text', 'EqualEqual_TextText (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.EqualEqual_TextText', ['A:text', 'B:text', '->', 'ReturnValue:bool'], true)],
    ['Text', 'NotEqual_TextText (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.NotEqual_TextText', ['A:text', 'B:text', '->', 'ReturnValue:bool'], true)],
    ['Text', 'TextToUpper (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.TextToUpper', ['InText:text', '->', 'ReturnValue:text'], true)],
    ['Text', 'TextToLower (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.TextToLower', ['InText:text', '->', 'ReturnValue:text'], true)],
    ['Text', 'TextTrimPrecedingAndTrailing (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.TextTrimPrecedingAndTrailing', ['InText:text', '->', 'ReturnValue:text'], true)],
    ['Text', 'AsDateTime_DateTime (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.AsDateTime_DateTime', ['InDateTime:datetime', '->', 'ReturnValue:text'], true)],
    ['Text', 'AsTimespan_Timespan (KismetTextLibrary, pure)', lib('/Script/Engine.KismetTextLibrary.AsTimespan_Timespan', ['InTimespan:timespan', '->', 'ReturnValue:text'], true)],
    ['String', 'Conv_NameToString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_NameToString', ['InName:name', '->', 'ReturnValue:string'], true)],
    ['String', 'Conv_StringToName (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_StringToName', ['InString:string', '->', 'ReturnValue:name'], true)],
    ['String', 'Conv_RotatorToString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_RotatorToString', ['InRot:rotator', '->', 'ReturnValue:string'], true)],
    ['String', 'Conv_ColorToString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_ColorToString', ['InColor:linearcolor', '->', 'ReturnValue:string'], true)],
    ['String', 'Conv_Vector2dToString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_Vector2dToString', ['InVec:vector2d', '->', 'ReturnValue:string'], true)],
    ['String', 'Conv_TransformToString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_TransformToString', ['InTrans:transform', '->', 'ReturnValue:string'], true)],
    ['String', 'GetSubstring (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.GetSubstring', ['SourceString:string', 'StartIndex:int=0', 'Length:int=1', '->', 'ReturnValue:string'], true)],
    ['String', 'TimeSecondsToString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.TimeSecondsToString', ['InSeconds:single', '->', 'ReturnValue:string'], true)],
    ['String', 'EqualEqual_StriStri (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.EqualEqual_StriStri', ['A:string', 'B:string', '->', 'ReturnValue:bool'], true)],
    ['String', 'Conv_StringToVector (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_StringToVector', ['InString:string', '->', 'OutConvertedVector:vector', 'OutIsValid:bool'], true)],
    ['String', 'Conv_StringToRotator (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.Conv_StringToRotator', ['InString:string', '->', 'OutConvertedRotator:rotator', 'OutIsValid:bool'], true)],
    ['String', 'MatchesWildcard (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.MatchesWildcard', ['SourceString:string', 'Wildcard:string', 'SearchCase:enum:ESearchCase', '->', 'ReturnValue:bool'], true)],
    ['String', 'GetCharacterArrayFromString (KismetStringLibrary, pure)', lib('/Script/Engine.KismetStringLibrary.GetCharacterArrayFromString', ['SourceString:string', '->', 'ReturnValue:string[]'], true)],
    ['MathVec', 'NegateVector (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.NegateVector', ['A:vector', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'Vector_GetAbs (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Vector_GetAbs', ['A:vector', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'ClampVectorSize (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.ClampVectorSize', ['A:vector', 'Min:double', 'Max:double', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'RotateAngleAxis (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.RotateAngleAxis', ['InVect:vector', 'AngleDeg:double', 'Axis:vector', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'LessLess_VectorRotator (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.LessLess_VectorRotator', ['A:vector', 'B:rotator', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'Conv_VectorToRotator (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Conv_VectorToRotator', ['InVec:vector', '->', 'ReturnValue:rotator'], true)],
    ['MathVec', 'Conv_RotatorToVector (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Conv_RotatorToVector', ['InRot:rotator', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'GetReflectionVector (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.GetReflectionVector', ['Direction:vector', 'SurfaceNormal:vector', '->', 'ReturnValue:vector'], true)],
    ['MathVec', 'RandomUnitVector (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.RandomUnitVector', ['->', 'ReturnValue:vector'], true)],
    ['MathVec', 'RandomRotator (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.RandomRotator', ['bRoll:bool', '->', 'ReturnValue:rotator'], true)],
    ['MathVec', 'EqualEqual_VectorVector (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.EqualEqual_VectorVector', ['A:vector', 'B:vector', 'ErrorTolerance:single=0.000100', '->', 'ReturnValue:bool'], true)],
    ['MathVec', 'Vector_Normal2D (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Vector_Normal2D', ['A:vector', 'Tolerance:single=0.000100', '->', 'ReturnValue:vector'], true)],
    ['MathMisc', 'FInterpEaseInOut (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.FInterpEaseInOut', ['A:double', 'B:double', 'Alpha:double', 'Exponent:double', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'SafeDivide (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.SafeDivide', ['A:double', 'B:double', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'FWrap (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.FWrap', ['Value:double', 'Min:double', 'Max:double', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'Hypotenuse (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Hypotenuse', ['Width:double', 'Height:double', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'Log (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Log', ['A:double', 'Base:double=1.000000', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'MultiplyByPi (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.MultiplyByPi', ['Value:double', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'Abs_Int (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Abs_Int', ['A:int', '->', 'ReturnValue:int'], true)],
    ['MathMisc', 'SignOfInteger (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.SignOfInteger', ['A:int', '->', 'ReturnValue:int'], true)],
    ['MathMisc', 'MaxOfIntArray (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.MaxOfIntArray', ['IntArray:int[]', '->', 'IndexOfMaxValue:int', 'MaxValue:int'], true)],
    ['MathMisc', 'MinOfFloatArray (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.MinOfFloatArray', ['FloatArray:double[]', '->', 'IndexOfMinValue:int', 'MinValue:double'], true)],
    ['MathMisc', 'NormalizeAxis (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.NormalizeAxis', ['Angle:double', '->', 'ReturnValue:double'], true)],
    ['MathMisc', 'Multiply_RotatorFloat (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Multiply_RotatorFloat', ['A:rotator', 'B:single', '->', 'ReturnValue:rotator'], true)],
    ['MathMisc', 'EqualEqual_RotatorRotator (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.EqualEqual_RotatorRotator', ['A:rotator', 'B:rotator', 'ErrorTolerance:single=0.000100', '->', 'ReturnValue:bool'], true)],
    ['MathMisc', 'GetAxes (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.GetAxes', ['A:rotator', '->', 'X:vector', 'Y:vector', 'Z:vector'], true)],
    ['MathMisc', 'RotatorFromAxisAndAngle (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.RotatorFromAxisAndAngle', ['Axis:vector', 'Angle:single', '->', 'ReturnValue:rotator'], true)],
    ['Vec2Color', 'Add_Vector2DVector2D (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Add_Vector2DVector2D', ['A:vector2d', 'B:vector2d', '->', 'ReturnValue:vector2d'], true)],
    ['Vec2Color', 'Subtract_Vector2DVector2D (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Subtract_Vector2DVector2D', ['A:vector2d', 'B:vector2d', '->', 'ReturnValue:vector2d'], true)],
    ['Vec2Color', 'Multiply_Vector2DFloat (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Multiply_Vector2DFloat', ['A:vector2d', 'B:double', '->', 'ReturnValue:vector2d'], true)],
    ['Vec2Color', 'Normal2D (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Normal2D', ['A:vector2d', '->', 'ReturnValue:vector2d'], true)],
    ['Vec2Color', 'Vector2DInterpTo (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Vector2DInterpTo', ['Current:vector2d', 'Target:vector2d', 'DeltaTime:single', 'InterpSpeed:single', '->', 'ReturnValue:vector2d'], true)],
    ['Vec2Color', 'BreakVector2D (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.BreakVector2D', ['InVec:vector2d', '->', 'X:double', 'Y:double'], true)],
    ['Vec2Color', 'LinearColorLerp (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.LinearColorLerp', ['A:linearcolor', 'B:linearcolor', 'Alpha:single', '->', 'ReturnValue:linearcolor'], true)],
    ['Vec2Color', 'MakeColor (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.MakeColor', ['R:single', 'G:single', 'B:single', 'A:single=1.000000', '->', 'ReturnValue:linearcolor'], true)],
    ['Vec2Color', 'BreakColor (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.BreakColor', ['InColor:linearcolor', '->', 'R:single', 'G:single', 'B:single', 'A:single'], true)],
    ['Vec2Color', 'HSVToRGB (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.HSVToRGB', ['H:single', 'S:single', 'V:single', 'A:single=1.000000', '->', 'ReturnValue:linearcolor'], true)],
    ['Vec2Color', 'RGBToHSV (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.RGBToHSV', ['InColor:linearcolor', '->', 'H:single', 'S:single', 'V:single', 'A:single'], true)],
    ['Vec2Color', 'CInterpTo (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.CInterpTo', ['Current:linearcolor', 'Target:linearcolor', 'DeltaTime:single', 'InterpSpeed:single', '->', 'ReturnValue:linearcolor'], true)],
    ['Time', 'Now (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Now', ['->', 'ReturnValue:datetime'], true)],
    ['Time', 'UtcNow (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.UtcNow', ['->', 'ReturnValue:datetime'], true)],
    ['Time', 'Today (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Today', ['->', 'ReturnValue:datetime'], true)],
    ['Time', 'BreakDateTime (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.BreakDateTime', ['InDateTime:datetime', '->', 'Year:int', 'Month:int', 'Day:int', 'Hour:int', 'Minute:int', 'Second:int', 'Millisecond:int'], true)],
    ['Time', 'MakeDateTime (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.MakeDateTime', ['Year:int', 'Month:int', 'Day:int', 'Hour:int', 'Minute:int', 'Second:int', 'Millisecond:int', '->', 'ReturnValue:datetime'], true)],
    ['Time', 'Subtract_DateTimeDateTime (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.Subtract_DateTimeDateTime', ['A:datetime', 'B:datetime', '->', 'ReturnValue:timespan'], true)],
    ['Time', 'GetTotalSeconds (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.GetTotalSeconds', ['A:timespan', '->', 'ReturnValue:double'], true)],
    ['Time', 'FromSeconds (KismetMathLibrary, pure)', lib('/Script/Engine.KismetMathLibrary.FromSeconds', ['Seconds:double', '->', 'ReturnValue:timespan'], true)],
    ['CharMove', 'IsWalking (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.IsWalking', ['->', 'ReturnValue:bool'], true)],
    ['CharMove', 'IsSwimming (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.IsSwimming', ['->', 'ReturnValue:bool'], true)],
    ['CharMove', 'IsFlying (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.IsFlying', ['->', 'ReturnValue:bool'], true)],
    ['CharMove', 'IsCrouching (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.IsCrouching', ['->', 'ReturnValue:bool'], true)],
    ['CharMove', 'SetWalkableFloorAngle (член CharacterMovementComponent)', mem('/Script/Engine.CharacterMovementComponent.SetWalkableFloorAngle', ['InWalkableFloorAngle:single'])],
    ['CharMove', 'K2_GetWalkableFloorAngle (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.K2_GetWalkableFloorAngle', ['->', 'ReturnValue:single'], true)],
    ['CharMove', 'AddImpulse (член CharacterMovementComponent)', mem('/Script/Engine.CharacterMovementComponent.AddImpulse', ['Impulse:vector', 'bVelocityChange:bool'])],
    ['CharMove', 'AddForce (член CharacterMovementComponent)', mem('/Script/Engine.CharacterMovementComponent.AddForce', ['Force:vector'])],
    ['CharMove', 'GetMaxAcceleration (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.GetMaxAcceleration', ['->', 'ReturnValue:single'], true)],
    ['CharMove', 'GetCurrentAcceleration (член CharacterMovementComponent, pure)', mem('/Script/Engine.CharacterMovementComponent.GetCurrentAcceleration', ['->', 'ReturnValue:vector'], true)],
    ['CharMove', 'SetAvoidanceEnabled (член CharacterMovementComponent)', mem('/Script/Engine.CharacterMovementComponent.SetAvoidanceEnabled', ['bEnable:bool'])],
    ['CharMove', 'ClearAccumulatedForces (член CharacterMovementComponent)', mem('/Script/Engine.CharacterMovementComponent.ClearAccumulatedForces', [])],
    ['CharMove', 'IsJumpProvidingForce (член Character, pure)', mem('/Script/Engine.Character.IsJumpProvidingForce', ['->', 'ReturnValue:bool'], true)],
    ['CharMove', 'CanCrouch (член Character, pure)', mem('/Script/Engine.Character.CanCrouch', ['->', 'ReturnValue:bool'], true)],
    ['CharMove', 'IsPlayingRootMotion (член Character, pure)', mem('/Script/Engine.Character.IsPlayingRootMotion', ['->', 'ReturnValue:bool'], true)],
    ['Actor', 'GetActorEyesViewPoint (член Actor, pure)', mem('/Script/Engine.Actor.GetActorEyesViewPoint', ['->', 'OutLocation:vector', 'OutRotation:rotator'], true)],
    ['Actor', 'K2_GetRootComponent (член Actor, pure)', mem('/Script/Engine.Actor.K2_GetRootComponent', ['->', 'ReturnValue:object:SceneComponent'], true)],
    ['Actor', 'GetSquaredDistanceTo (член Actor, pure)', mem('/Script/Engine.Actor.GetSquaredDistanceTo', ['OtherActor:object:Actor', '->', 'ReturnValue:double'], true)],
    ['Actor', 'GetVerticalDistanceTo (член Actor, pure)', mem('/Script/Engine.Actor.GetVerticalDistanceTo', ['OtherActor:object:Actor', '->', 'ReturnValue:double'], true)],
    ['Actor', 'GetActorTickInterval (член Actor, pure)', mem('/Script/Engine.Actor.GetActorTickInterval', ['->', 'ReturnValue:single'], true)],
    ['Actor', 'IsActorTickEnabled (член Actor, pure)', mem('/Script/Engine.Actor.IsActorTickEnabled', ['->', 'ReturnValue:bool'], true)],
    ['Actor', 'GetParentActor (член Actor, pure)', mem('/Script/Engine.Actor.GetParentActor', ['->', 'ReturnValue:object:Actor'], true)],
    ['Actor', 'GetAttachedActors (член Actor, pure)', mem('/Script/Engine.Actor.GetAttachedActors', ['bResetArray:bool=true', 'bRecursivelyIncludeAttachedActors:bool', '->', 'OutActors:object:Actor[]'], true)],
    ['Actor', 'AddTickPrerequisiteActor (член Actor)', mem('/Script/Engine.Actor.AddTickPrerequisiteActor', ['PrerequisiteActor:object:Actor'])],
    ['Actor', 'GetComponentsByTag (член Actor, pure)', mem('/Script/Engine.Actor.GetComponentsByTag', ['ComponentClass:class:ActorComponent', 'Tag:name', '->', 'ReturnValue:object:ActorComponent[]'], true)],
    ['Actor', 'GetActorEnableCollision (член Actor, pure)', mem('/Script/Engine.Actor.GetActorEnableCollision', ['->', 'ReturnValue:bool'], true)],
    ['Actor', 'GetActorRelativeScale3D (член Actor, pure)', mem('/Script/Engine.Actor.GetActorRelativeScale3D', ['->', 'ReturnValue:vector'], true)],
    ['Actor', 'K2_DestroyComponent (член ActorComponent)', mem('/Script/Engine.ActorComponent.K2_DestroyComponent', ['Object:object:/Script/CoreUObject.Object'])],
    ['Scene', 'K2_GetComponentToWorld (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.K2_GetComponentToWorld', ['->', 'ReturnValue:transform'], true)],
    ['Scene', 'GetForwardVector (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetForwardVector', ['->', 'ReturnValue:vector'], true)],
    ['Scene', 'GetRightVector (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetRightVector', ['->', 'ReturnValue:vector'], true)],
    ['Scene', 'GetUpVector (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetUpVector', ['->', 'ReturnValue:vector'], true)],
    ['Scene', 'K2_SetWorldRotation (член SceneComponent)', mem('/Script/Engine.SceneComponent.K2_SetWorldRotation', ['NewRotation:rotator', 'bSweep:bool', 'bTeleport:bool', '->', 'SweepHitResult:hitresult'])],
    ['Scene', 'K2_SetWorldTransform (член SceneComponent)', mem('/Script/Engine.SceneComponent.K2_SetWorldTransform', ['NewTransform:transform', 'bSweep:bool', 'bTeleport:bool', '->', 'SweepHitResult:hitresult'])],
    ['Scene', 'K2_AddRelativeLocation (член SceneComponent)', mem('/Script/Engine.SceneComponent.K2_AddRelativeLocation', ['DeltaLocation:vector', 'bSweep:bool', 'bTeleport:bool', '->', 'SweepHitResult:hitresult'])],
    ['Scene', 'K2_GetComponentScale (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.K2_GetComponentScale', ['->', 'ReturnValue:vector'], true)],
    ['Scene', 'GetAttachParent (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetAttachParent', ['->', 'ReturnValue:object:SceneComponent'], true)],
    ['Scene', 'GetChildrenComponents (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetChildrenComponents', ['bIncludeAllDescendants:bool', '->', 'Children:object:SceneComponent[]'], true)],
    ['Scene', 'GetNumChildrenComponents (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetNumChildrenComponents', ['->', 'ReturnValue:int'], true)],
    ['Scene', 'GetSocketTransform (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.GetSocketTransform', ['InSocketName:name', 'TransformSpace:enum:ERelativeTransformSpace', '->', 'ReturnValue:transform'], true)],
    ['Scene', 'IsVisible (член SceneComponent, pure)', mem('/Script/Engine.SceneComponent.IsVisible', ['->', 'ReturnValue:bool'], true)],
    ['Scene', 'ToggleVisibility (член SceneComponent)', mem('/Script/Engine.SceneComponent.ToggleVisibility', ['bPropagateToChildren:bool'])],
    ['Scene', 'SetMobility (член SceneComponent)', mem('/Script/Engine.SceneComponent.SetMobility', ['NewMobility:enum:EComponentMobility'])],
    ['Prim', 'GetPhysicsAngularVelocityInDegrees (член PrimitiveComponent, pure)', mem('/Script/Engine.PrimitiveComponent.GetPhysicsAngularVelocityInDegrees', ['BoneName:name', '->', 'ReturnValue:vector'], true)],
    ['Prim', 'SetCollisionObjectType (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.SetCollisionObjectType', ['Channel:enum:ECollisionChannel'])],
    ['Prim', 'SetCollisionResponseToAllChannels (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.SetCollisionResponseToAllChannels', ['NewResponse:enum:ECollisionResponse'])],
    ['Prim', 'K2_IsCollisionEnabled (член PrimitiveComponent, pure)', mem('/Script/Engine.PrimitiveComponent.K2_IsCollisionEnabled', ['->', 'ReturnValue:bool'], true)],
    ['Prim', 'IsSimulatingPhysics (член PrimitiveComponent, pure)', mem('/Script/Engine.PrimitiveComponent.IsSimulatingPhysics', ['BoneName:name', '->', 'ReturnValue:bool'], true)],
    ['Prim', 'SetNotifyRigidBodyCollision (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.SetNotifyRigidBodyCollision', ['bNewNotifyRigidBodyCollision:bool'])],
    ['Prim', 'IgnoreActorWhenMoving (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.IgnoreActorWhenMoving', ['Actor:object:Actor', 'bShouldIgnore:bool'])],
    ['Prim', 'GetOverlappingComponents (член PrimitiveComponent, pure)', mem('/Script/Engine.PrimitiveComponent.GetOverlappingComponents', ['->', 'OutOverlappingComponents:object:PrimitiveComponent[]'], true)],
    ['Prim', 'SetCastShadow (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.SetCastShadow', ['NewCastShadow:bool'])],
    ['Prim', 'SetMaterialByName (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.SetMaterialByName', ['MaterialSlotName:name', 'Material:object:/Script/Engine.MaterialInterface'])],
    ['Prim', 'GetNumMaterials (член PrimitiveComponent, pure)', mem('/Script/Engine.PrimitiveComponent.GetNumMaterials', ['->', 'ReturnValue:int'], true)],
    ['Prim', 'SetPhysMaterialOverride (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.SetPhysMaterialOverride', ['NewPhysMaterial:object:/Script/PhysicsCore.PhysicalMaterial'])],
    ['Prim', 'AddAngularImpulseInDegrees (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.AddAngularImpulseInDegrees', ['Impulse:vector', 'BoneName:name', 'bVelChange:bool'])],
    ['Prim', 'AddForceAtLocation (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.AddForceAtLocation', ['Force:vector', 'Location:vector', 'BoneName:name'])],
    ['Prim', 'AddImpulseAtLocation (член PrimitiveComponent)', mem('/Script/Engine.PrimitiveComponent.AddImpulseAtLocation', ['Impulse:vector', 'Location:vector', 'BoneName:name'])],
    ['Debug', 'SphereOverlapActors (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.SphereOverlapActors', ['SpherePos:vector', 'SphereRadius:single', 'ObjectTypes:enum:EObjectTypeQuery[]', 'ActorClassFilter:class:Actor', 'ActorsToIgnore:object:Actor[]', '->', 'OutActors:object:Actor[]', 'ReturnValue:bool'])],
    ['Debug', 'BoxOverlapActors (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.BoxOverlapActors', ['BoxPos:vector', 'BoxExtent:vector', 'ObjectTypes:enum:EObjectTypeQuery[]', 'ActorClassFilter:class:Actor', 'ActorsToIgnore:object:Actor[]', '->', 'OutActors:object:Actor[]', 'ReturnValue:bool'])],
    ['Debug', 'SphereOverlapComponents (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.SphereOverlapComponents', ['SpherePos:vector', 'SphereRadius:single', 'ObjectTypes:enum:EObjectTypeQuery[]', 'ComponentClassFilter:class:ActorComponent', 'ActorsToIgnore:object:Actor[]', '->', 'OutComponents:object:PrimitiveComponent[]', 'ReturnValue:bool'])],
    ['Debug', 'DrawDebugBox (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.DrawDebugBox', ['Center:vector', 'Extent:vector', 'LineColor:linearcolor', 'Rotation:rotator', 'Duration:single', 'Thickness:single'])],
    ['Debug', 'DrawDebugPoint (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.DrawDebugPoint', ['Position:vector', 'Size:single', 'PointColor:linearcolor', 'Duration:single'])],
    ['Debug', 'DrawDebugString (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.DrawDebugString', ['TextLocation:vector', 'Text:string', 'TestBaseActor:object:Actor', 'TextColor:linearcolor', 'Duration:single'])],
    ['Debug', 'DrawDebugCapsule (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.DrawDebugCapsule', ['Center:vector', 'HalfHeight:single', 'Radius:single', 'Rotation:rotator', 'LineColor:linearcolor', 'Duration:single', 'Thickness:single'])],
    ['Debug', 'DrawDebugCylinder (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.DrawDebugCylinder', ['Start:vector', 'End:vector', 'Radius:single', 'Segments:int=12', 'LineColor:linearcolor', 'Duration:single', 'Thickness:single'])],
    ['Debug', 'FlushPersistentDebugLines (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.FlushPersistentDebugLines', [])],
    ['Debug', 'GetPathName (KismetSystemLibrary, pure)', lib('/Script/Engine.KismetSystemLibrary.GetPathName', ['Object:object:/Script/CoreUObject.Object', '->', 'ReturnValue:string'], true)],
    ['Debug', 'GetPlatformUserName (KismetSystemLibrary, pure)', lib('/Script/Engine.KismetSystemLibrary.GetPlatformUserName', ['->', 'ReturnValue:string'], true)],
    ['Debug', 'GetFrameCount (KismetSystemLibrary, pure)', lib('/Script/Engine.KismetSystemLibrary.GetFrameCount', ['->', 'ReturnValue:int64'], true)],
    ['Debug', 'LaunchURL (KismetSystemLibrary)', lib('/Script/Engine.KismetSystemLibrary.LaunchURL', ['URL:string'])],
    ['Debug', 'GetProjectDirectory (KismetSystemLibrary, pure)', lib('/Script/Engine.KismetSystemLibrary.GetProjectDirectory', ['->', 'ReturnValue:string'], true)],
    ['DataAnim', 'GetDataTableColumnAsString (DataTableFunctionLibrary)', lib('/Script/Engine.DataTableFunctionLibrary.GetDataTableColumnAsString', ['DataTable:object:/Script/Engine.DataTable', 'PropertyName:name', '->', 'ReturnValue:string[]'])],
    ['DataAnim', 'GetFloatValue (член CurveFloat, pure)', mem('/Script/Engine.CurveFloat.GetFloatValue', ['InTime:single', '->', 'ReturnValue:single'], true)],
    ['DataAnim', 'GetVectorValue (член CurveVector, pure)', mem('/Script/Engine.CurveVector.GetVectorValue', ['InTime:single', '->', 'ReturnValue:vector'], true)],
    ['DataAnim', 'GetLinearColorValue (член CurveLinearColor, pure)', mem('/Script/Engine.CurveLinearColor.GetLinearColorValue', ['InTime:single', '->', 'ReturnValue:linearcolor'], true)],
    ['DataAnim', 'Montage_GetCurrentSection (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.Montage_GetCurrentSection', ['Montage:object:/Script/Engine.AnimMontage', '->', 'ReturnValue:name'], true)],
    ['DataAnim', 'Montage_GetPlayRate (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.Montage_GetPlayRate', ['Montage:object:/Script/Engine.AnimMontage', '->', 'ReturnValue:single'], true)],
    ['DataAnim', 'PlaySlotAnimationAsDynamicMontage (член AnimInstance)', mem('/Script/Engine.AnimInstance.PlaySlotAnimationAsDynamicMontage', ['Asset:object:/Script/Engine.AnimSequenceBase', 'SlotNodeName:name', 'BlendInTime:single=0.250000', 'BlendOutTime:single=0.250000', 'InPlayRate:single=1.000000', 'LoopCount:int=1', 'BlendOutTriggerTime:single=-1.000000', 'InTimeToStartMontageAt:single=0.000000', '->', 'ReturnValue:object:/Script/Engine.AnimMontage'])],
    ['DataAnim', 'StopSlotAnimation (член AnimInstance)', mem('/Script/Engine.AnimInstance.StopSlotAnimation', ['InBlendOutTime:single=0.250000', 'SlotNodeName:name'])],
    ['DataAnim', 'IsPlayingSlotAnimation (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.IsPlayingSlotAnimation', ['Asset:object:/Script/Engine.AnimSequenceBase', 'SlotNodeName:name', '->', 'ReturnValue:bool'], true)],
    ['DataAnim', 'GetOwningActor (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.GetOwningActor', ['->', 'ReturnValue:object:Actor'], true)],
    ['DataAnim', 'GetOwningComponent (член AnimInstance, pure)', mem('/Script/Engine.AnimInstance.GetOwningComponent', ['->', 'ReturnValue:object:SkeletalMeshComponent'], true)],
    ['DataAnim', 'PlayAnimation (член SkeletalMeshComponent)', mem('/Script/Engine.SkeletalMeshComponent.PlayAnimation', ['NewAnimToPlay:object:/Script/Engine.AnimationAsset', 'bLooping:bool'])],
    ['DataAnim', 'SetAnimation (член SkeletalMeshComponent)', mem('/Script/Engine.SkeletalMeshComponent.SetAnimation', ['NewAnimToPlay:object:/Script/Engine.AnimationAsset'])],
    ['DataAnim', 'GetPosition (член SkeletalMeshComponent, pure)', mem('/Script/Engine.SkeletalMeshComponent.GetPosition', ['->', 'ReturnValue:single'], true)],
    ['DataAnim', 'GetBoneIndex (член SkinnedMeshComponent, pure)', mem('/Script/Engine.SkinnedMeshComponent.GetBoneIndex', ['BoneName:name', '->', 'ReturnValue:int'], true)],
    ['DataAnim', 'UnHideBoneByName (член SkinnedMeshComponent)', mem('/Script/Engine.SkinnedMeshComponent.UnHideBoneByName', ['BoneName:name'])],
    ['DataAnim', 'IsBoneHiddenByName (член SkinnedMeshComponent)', mem('/Script/Engine.SkinnedMeshComponent.IsBoneHiddenByName', ['BoneName:name', '->', 'ReturnValue:bool'])],
  ],
  '48b': [
    // R48 copy-back пользователя: у Character есть только геттер (сеттер SetAnimRootMotionTranslationScale не BP)
    ['CharMove', 'Get Anim Root Motion Translation Scale (член Character, pure)', mem('/Script/Engine.Character.GetAnimRootMotionTranslationScale', ['->', 'ReturnValue:single'], true)],
  ],
};

const list = BATCHES[batch];
if (!list) { console.error(`нет пакета ${batch}; есть: ${Object.keys(BATCHES).join(', ')}`); process.exit(1); }
const out = new URL(`../sweep/probes/r${batch}-probe.txt`, import.meta.url);

seedGuids(`probe:${batch}`);
const nodes = [], GAPX = 64, GAPY = 96;
let y = 0;
const topics = [...new Set(list.map(p => p[0]))];
for (const topic of topics) {
  let x = 0, rowH = 0;
  for (const [, bubble, make] of list.filter(p => p[0] === topic)) {
    const n = make();
    n.pos = { x, y };
    n.probeTopic = topic;
    n.bubble = `R${batch} · ${topic}: ${bubble}`;
    nodes.push(n);
    x += Math.max(estNodeWidth(n), 320) + GAPX;
    rowH = Math.max(rowH, estNodeHeight(n));
  }
  y += rowH + GAPY + 48; // +48 — место под пузырь над нодой следующего ряда
}
// fitComment(текст, ноды) возвращает НОВЫЙ коммент по габаритам нод (R36-фикс: раньше коммент создавался минимальным,
// а результат fitComment терялся). Верхний отступ больше — над каждой нодой висит пузырь.
const perRow = topics.map(t => `${t} ${list.filter(p => p[0] === t).length}`).join(', ');
const cm = fitComment(`R${batch}: пробы новых нод (${list.length}). Ряды сверху вниз: ${perRow}. Над каждой нодой — пузырь с её названием. Пришлите copy-back тех, что не встали или встали неправильно.`, nodes, 64, 176, 96);
const text = generateUEText([cm, ...nodes]);
const v = validateStrict(text);
if (!STDOUT) console.log(`R${batch}: нод=${nodes.length} тем=${topics.length} STRICT errors=${v.errors.length} warnings=${v.warnings.length}`);
v.errors.forEach(e => console.log('  ERR ' + e));
if (!v.valid) process.exit(1);
if (STDOUT) {
  process.stdout.write(text);
} else if (CHECK) {
  const disk = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (disk !== text) { console.log(`✗ sweep/probes/r${batch}-probe.txt расходится с генератором`); process.exit(1); }
  console.log(`✓ sweep/probes/r${batch}-probe.txt совпадает с генератором`);
} else {
  fs.mkdirSync('sweep/probes', { recursive: true }); fs.writeFileSync(out, text);
  console.log(`→ sweep/probes/r${batch}-probe.txt`);
}

// ── --register: пробы, подтверждённые движком, → записи data/ue-functions.json ──────────────────────────
// Запись строится из самой ноды пробы и сверяется: createCallFunction/createMacroInstance(запись) обязаны дать
// тот же текст ноды (без GUID/имён), что проба, которую пользователь уже вставил в UE.
if (REGISTER) {
  const regPath = new URL('../data/ue-functions.json', import.meta.url);
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const have = new Set(reg.map(e => e.id));
  const libByRef = Object.fromEntries(Object.entries(UE_LIBS).map(([k, v]) => [v, k]));
  const enumByRef = Object.fromEntries(Object.entries(UE_ENUMS).map(([k, v]) => [v, k]));
  const structByRef = Object.fromEntries(Object.entries(UE_STRUCTS).map(([k, v]) => [v, k]));
  const objPath = ref => (ref.match(/'([^'"]+)'"?$/) || ref.match(/"([^"]+)"'$/) || [])[1] || ref;
  const title = f => f.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  const strip = t => t.replace(/[0-9A-F]{32}/g, 'G').replace(/Name="[^"]*"/, '').replace(/\n\s*NodePos[XY]=-?\d+/g, '').replace(/\n\s*bCommentBubbleVisible=True\n\s*NodeComment="[^"]*"/, '');
  const topicCat = 'Gameplay Systems'; // одна категория для всех проб (R36+)
  const added = [];
  for (const n of nodes) {
    if (!n.funcName && !n.macroGraph) continue;               // AddComponentByClass — модульная нода, не запись реестра
    const bubble = n.bubble.replace(/^R\d+ · [^:]+: /, '');
    const pins = n.pins.map(p => {
      const o = { name: p.name, dir: p.direction, cat: p.category };
      if (p.category === 'real') o.sub = p.subCategory;
      if (p.category === 'struct') o.sub = structByRef[p.subCategoryObject];
      if ((p.category === 'object' || p.category === 'class') && p.subCategoryObject) o.object = objPath(p.subCategoryObject);
      if (p.category === 'byte' && p.subCategoryObject) o.enum = enumByRef[p.subCategoryObject] || p.subCategoryObject; // R41: энам-пины
      if (p.isConst) o.const = true;
      if (p.isRef) o.ref = true;
      if (p.container !== 'None') o.container = p.container;
      if (p.valueType) o.valueType = p.valueType;
      if (p.ignored) o.ignored = true;
      if (p.defaultValue) o.dv = p.defaultValue;
      if ((p.autoDefault || '') !== (p.defaultValue || '')) o.autoDv = p.autoDefault || '';
      return o;
    });
    const e = n.macroGraph
      ? { id: n.macroGraph, title: n.macroGraph, category: 'Flow Control', className: '/Script/BlueprintGraph.K2Node_MacroInstance', pins }
      : { id: n.funcName, title: title(n.funcName), category: topicCat, className: '/Script/BlueprintGraph.K2Node_CallFunction', func: n.funcName, lib: libByRef[n.memberParent], pins };
    if (!n.macroGraph && !e.lib) throw new Error(`${n.funcName}: нет UE_LIBS-ключа для ${n.memberParent}`);
    if (n.pure) e.pure = true;
    if (!n.macroGraph && reg.some(x => x.func === e.func && x.lib === e.lib)) { console.log(`  = ${e.func} (${e.lib}) уже в реестре`); continue; } // R42: FlushPlayerInput уже был
    if (have.has(e.id)) e.id = `${e.id}_${e.lib}`;           // SetScalarParameterValue: MID-член и MPC-версия KismetMaterialLibrary
    if (have.has(e.id)) { console.log(`  = ${e.id} уже в реестре`); continue; }
    e.verified = true;
    e.desc = bubble.split(/[.(]/)[0].trim();
    e.probe = `R${batch} проба (${n.probeTopic}) → VERIFIED движком ${new Date().toISOString().slice(0,10)}; остальные пины движок достраивает сам при вставке (без note: note всплывает как W09). ${bubble}`;
    const back = n.macroGraph ? createMacroInstance(e) : createCallFunction(e);
    const a = strip(generateUEText([n])), b = strip(generateUEText([back]));
    if (a !== b) { console.log(`✗ ${e.id}: запись не воспроизводит пробу\n--- проба\n${a}\n--- запись\n${b}`); process.exit(1); }
    reg.push(e); have.add(e.id); added.push(e.id);
  }
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  console.log(`реестр: +${added.length} (${added.join(', ')}) → всего ${reg.length}`);
}
