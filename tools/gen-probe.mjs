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
import { UE_LIBS, UE_STRUCTS } from '../src/ue-types.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { createCall, createAddComponentByClass } from '../src/modules.js';

const args = process.argv.slice(2);
const batch = (args[args.indexOf('--batch') + 1] && args.includes('--batch')) ? args[args.indexOf('--batch') + 1] : '36';
const CHECK = args.includes('--check');
const STDOUT = args.includes('--stdout'); // текст пробы в stdout, без записи (тесты; пробы после вердикта в git не хранятся)
const REGISTER = args.includes('--register'); // после вердикта «встали»: завести подтверждённые пробы в реестр

// Шорткаты: статическая функция библиотеки / член класса. Слова пинов — как в createCall: «Имя:тип[=значение]», «->».
const lib = (key, words, pure = false) => () => createCall(key, words, { pure, isStatic: true });
const mem = (key, words, pure = false) => () => createCall(key, words, { pure });
// ref(фабрика, пины…): пометить пины by-ref (bIsReference=True), как в copy-back
const ref = (make, ...names) => () => { const n = make(); n.pins.forEach(p => { if (names.includes(p.name)) p.isRef = true; }); return n; };
const macro = (graph, pins) => () => createMacroInstance({ id: graph, title: graph, pins });

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
const cm = fitComment(`R${batch}: пробы новых нод (${list.length}). Над каждой нодой — пузырь с её названием. Пришлите copy-back тех, что не встали или встали неправильно.`, nodes, 64, 176, 96);
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
  fs.writeFileSync(out, text);
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
      if (p.isConst) o.const = true;
      if (p.isRef) o.ref = true;
      if (p.container !== 'None') o.container = p.container;
      if (p.defaultValue) o.dv = p.defaultValue;
      if ((p.autoDefault || '') !== (p.defaultValue || '')) o.autoDv = p.autoDefault || '';
      return o;
    });
    const e = n.macroGraph
      ? { id: n.macroGraph, title: n.macroGraph, category: 'Flow Control', className: '/Script/BlueprintGraph.K2Node_MacroInstance', pins }
      : { id: n.funcName, title: title(n.funcName), category: topicCat, className: '/Script/BlueprintGraph.K2Node_CallFunction', func: n.funcName, lib: libByRef[n.memberParent], pins };
    if (!n.macroGraph && !e.lib) throw new Error(`${n.funcName}: нет UE_LIBS-ключа для ${n.memberParent}`);
    if (n.pure) e.pure = true;
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
