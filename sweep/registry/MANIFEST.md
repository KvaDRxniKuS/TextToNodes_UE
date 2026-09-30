# Sweep manifest — полный прогон реестра по категориям

Записей в реестре: 1204; построено узлов: 1204; упало: 0.
MANIFEST и NN-*.txt побайтово воспроизводимы (дата не пишется): сверка — `node tools/gen-sweep.mjs --check`.
Генератор: tools/gen-sweep.mjs (сетка по 5 в ряд, внутри ряда layoutRow, накрыто fitComment).

Протокол: вставляйте файлы по одному в чистый граф → копируйте обратно → сообщайте номер файла и что сломалось.
Для сломанных нод прикладывайте copy-back целиком (пин Id не затирать) — по нему чиним реестр.

Известные оговорки (не баги свипа):
- 02-variables: VariableReference указывает на несуществующую переменную (MemberName из реестра, случайный MemberGuid) — движок подсветит неизвестную переменную, это ожидаемо; нужны референсы из BP с настоящими переменными.
- MakeArray/MakeSet/MakeMap: форма смоделирована по механике типов контейнера; проверяйте в движке при использовании. Enum Select для EDrawDebugTrace использует отдельную копию из UE (sweep/chapters/enum-select.txt); не обобщать её на пользовательские enum без reference.
- Макросы без GraphGuid (W07 в 01-flow-control): движок обычно прощает; guid доберём из copy-back.
- W09: у записи есть note — вставляйте внимательнее, это зафиксированные сомнения.

Колонка `Registry verified` буквально считает записи с `verified: true` в реестре; она не означает, что каждая запись категории была отдельно перепроверена в одном UE-сеансе. `Warn` — предупреждения локального валидатора.

| # | Файл | Нод | Registry verified | Notes | Err | Warn |
|---|---|---|---|---|---|---|
| 01 | 01-flow-control.txt | 16/16 | 16 | 2 | — | — |
| 02 | 02-variables.txt | 4/4 | 4 | 0 | — | — |
| 03 | 03-math-float.txt | 36/36 | 36 | 0 | — | — |
| 04 | 04-math-interpolation.txt | 7/7 | 7 | 0 | — | — |
| 05 | 05-math-integer.txt | 13/13 | 12 | 3 | — | 3xW09 |
| 06 | 06-math-trig.txt | 18/18 | 18 | 0 | — | — |
| 07 | 07-math-comparison.txt | 8/8 | 8 | 0 | — | — |
| 08 | 08-math-boolean.txt | 7/7 | 7 | 0 | — | — |
| 09 | 09-math-random.txt | 17/17 | 17 | 0 | — | — |
| 10 | 10-math-vector.txt | 41/41 | 40 | 0 | — | — |
| 11 | 11-collision.txt | 29/29 | 28 | 2 | — | 1xW09 |
| 12 | 12-math-rotator.txt | 25/25 | 25 | 8 | — | 5xW09 |
| 13 | 13-math-transform.txt | 10/10 | 10 | 8 | — | 8xW09 |
| 14 | 14-string.txt | 48/48 | 48 | 13 | — | 13xW09 |
| 15 | 15-array.txt | 18/18 | 18 | 18 | — | 17xW09 |
| 16 | 16-utilities.txt | 82/82 | 82 | 17 | — | 16xW09 |
| 17 | 17-gameplay.txt | 12/12 | 12 | 12 | — | 10xW09 |
| 18 | 18-input.txt | 10/10 | 10 | 2 | — | 1xW09 |
| 19 | 19-organization.txt | 7/7 | 7 | 5 | — | — |
| 20 | 20-text.txt | 15/15 | 15 | 1 | — | — |
| 21 | 21-enhanced-input.txt | 6/6 | 5 | 6 | — | 2xW09 |
| 22 | 22-casting.txt | 12/12 | 12 | 11 | — | 8xW09 |
| 23 | 23-actor.txt | 70/70 | 70 | 32 | — | 32xW09 |
| 24 | 24-pawn-character.txt | 52/52 | 52 | 18 | — | 17xW09 |
| 25 | 25-events-delegates.txt | 8/8 | 8 | 8 | — | 1xW09 |
| 26 | 26-timers-latent.txt | 15/15 | 15 | 14 | — | 14xW09 |
| 27 | 27-widgets-ui.txt | 104/104 | 104 | 8 | — | 8xW09 |
| 28 | 28-enhanced-input-full.txt | 15/15 | 15 | 15 | — | 15xW09 |
| 29 | 29-components-physics.txt | 66/66 | 66 | 23 | — | 21xW09 |
| 30 | 30-debug.txt | 9/9 | 9 | 0 | — | — |
| 31 | 31-data-save.txt | 7/7 | 7 | 0 | — | — |
| 32 | 32-ai-navigation.txt | 57/57 | 57 | 0 | — | — |
| 33 | 33-animation.txt | 38/38 | 38 | 0 | — | — |
| 34 | 34-materials-fx.txt | 38/38 | 38 | 0 | — | — |
| 35 | 35-camera.txt | 21/21 | 21 | 0 | — | — |
| 36 | 36-player-controller.txt | 51/51 | 51 | 0 | — | — |
| 37 | 37-level-streaming.txt | 6/6 | 6 | 0 | — | — |
| 38 | 38-gameplay-tags.txt | 9/9 | 9 | 0 | — | — |
| 39 | 39-networking.txt | 12/12 | 12 | 0 | — | — |
| 40 | 40-damage.txt | 4/4 | 4 | 0 | — | — |
| 41 | 41-game-framework.txt | 64/64 | 64 | 0 | — | — |
| 42 | 42-components-scene.txt | 42/42 | 42 | 0 | — | — |
| 43 | 43-lights.txt | 7/7 | 7 | 0 | — | — |
| 44 | 44-audio.txt | 31/31 | 31 | 0 | — | — |
| 45 | 45-containers.txt | 16/16 | 16 | 0 | — | — |
| 46 | 46-math-vector2d.txt | 7/7 | 7 | 0 | — | — |
| 47 | 47-math-color.txt | 6/6 | 6 | 0 | — | — |
| 48 | 48-math-time.txt | 8/8 | 8 | 0 | — | — |

Остальные папки sweep/ (chapters, probes, layout, copyback) и команды их пересборки — в `sweep/README.md`; сверка всего — `node tools/check-sweep.mjs`.

## NEEDS-REFERENCE (не построилось — нужен copy-back из движка)

Пусто — построилось всё.

## STRICT-ошибки по файлам (наш валидатор; движок — арбитр)

Пусто.

## Варнинги по файлам (W09 = есть note в реестре, W07 = нет GraphGuid)

- 05-math-integer.txt :: W09: K2Node_CallFunction_173: Clamp: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_174: Max: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_175: Min: Int overload func name uncertain — verify in engine
- 11-collision.txt :: W09: K2Node_CallFunction_282: BoxTraceSingle: live-ref 2026-09-25 (BP_WheelActor): полный пин-лист; HalfSize bIsConst=True — в Single констный, в Multi нет (причуда движка, copy-back O1 подтверждает)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_307: MakeRotator: round12-pre: MakeStruct-форма у FRotator (HasNativeMake) по аналогии с Vector жёлтая — канон pure MakeRotator Roll/Pitch/Yaw float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_308: BreakRotator: round12-pre: BreakStruct-форма по аналогии с Vector жёлтая — канон pure BreakRotator InRot→Roll/Pitch/Yaw
- 12-math-rotator.txt :: W09: K2Node_CallFunction_314: NormalizedDeltaRotator: round12-pre: FindLookAtRotation2D в KismetMathLibrary нет — заменена на NormalizedDeltaRotator
- 12-math-rotator.txt :: W09: K2Node_CallFunction_316: NegateRotator: round12-pre: InverseTransformRotation — это Transform-функция; канон инверсии NegateRotator (Invert Rotator)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_317: RLerp: round12-pre: добавлен пин bShortestPath, Alpha float
- 13-math-transform.txt :: W09: K2Node_CallFunction_333: MakeTransform: round13-pre: FTransform HasNativeMake — по аналогии с Vector канон pure KML MakeTransform
- 13-math-transform.txt :: W09: K2Node_CallFunction_334: BreakTransform: round13-pre: канон pure KML BreakTransform InTransform→Location/Rotation/Scale
- 13-math-transform.txt :: W09: K2Node_CallFunction_337: TransformLocation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_338: InverseTransformLocation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_339: TransformDirection: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_340: InverseTransformDirection: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_341: TransformRotation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_342: InverseTransformRotation: round13-pre: новая запись, не проверена движком
- 14-string.txt :: W09: K2Node_CallFunction_348: Contains: round14-pre: UseCase/SearchDir были byte — в UE это bool bUseCase/bSearchFromEnd
- 14-string.txt :: W09: K2Node_CallFunction_349: FindSubstring: round14-pre: bool bUseCase/bSearchFromEnd + StartPosition int (-1)
- 14-string.txt :: W09: K2Node_CallFunction_351: ParseIntoArray: round14-pre: ReturnValue — ContainerType=Array (было sub Array)
- 14-string.txt :: W09: K2Node_CallFunction_352: JoinStringArray: round14-pre: SourceArray — Array ref+const (как ActorsToIgnore у трейсов)
- 14-string.txt :: W09: K2Node_CallFunction_360: EqualEqual_StrStr: round14-pre: PromotableOperator только для KismetMathLibrary — канон CallFunction
- 14-string.txt :: W09: K2Node_CallFunction_361: NotEqual_StrStr: round14-pre: канон CallFunction
- 14-string.txt :: W09: K2Node_CallFunction_362: BuildString_Double: round14-pre: UE5 — BuildString_Double/InDouble + Suffix
- 14-string.txt :: W09: K2Node_CallFunction_363: BuildString_Int: round14-pre: добавлен Suffix
- 14-string.txt :: W09: K2Node_CallFunction_364: BuildString_Bool: round14-pre: добавлен Suffix
- 14-string.txt :: W09: K2Node_CallFunction_365: Conv_DoubleToString: round14-pre: UE5 — Conv_DoubleToString/InDouble
- 14-string.txt :: W09: K2Node_CallFunction_369: IsEmpty: round14-pre: новая запись
- 14-string.txt :: W09: K2Node_CallFunction_370: Conv_StringToInt: round14-pre: новая запись
- 14-string.txt :: W09: K2Node_CallFunction_371: Conv_StringToDouble: round14-pre: новая запись (UE5 double)
- 15-array.txt :: W09: K2Node_CallArrayFunction_393: Array_Add: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_394: Array_AddUnique: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_395: Array_Remove: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_396: Array_RemoveItem: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_397: Array_Clear: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_398: Array_Length: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_400: Array_Set: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_401: Array_Find: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_402: Array_Contains: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_403: Array_Insert: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_404: Array_Shuffle: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_405: Array_Reverse: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_406: Array_IsValidIndex: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_407: Array_Resize: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_408: Array_LastIndex: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_409: Array_Append: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_410: Array_Swap: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 16-utilities.txt :: W09: K2Node_CallFunction_413: PrintText: round16-pre: клон белого PrintString, InText — text const
- 16-utilities.txt :: W09: K2Node_CallFunction_416: RetriggerableDelay: round16-pre: как белый Delay: выход then, WCO/LatentInfo движок восстанавливает
- 16-utilities.txt :: W09: K2Node_CallFunction_418: IsValidClass: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_419: GetDisplayName: round22-pre: KSL::GetDisplayName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 16-utilities.txt :: W09: K2Node_CallFunction_420: GetObjectName: round22-pre: KSL::GetObjectName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 16-utilities.txt :: W09: K2Node_CallFunction_421: GetEngineVersion: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_422: GetPlatformName: round16-pre: живёт в GameplayStatics
- 16-utilities.txt :: W09: K2Node_CallFunction_423: GetGameTimeInSeconds: round16-pre: KismetSystemLibrary::GetGameTimeInSeconds → float
- 16-utilities.txt :: W09: K2Node_CallFunction_424: GetRealTimeSeconds: round16-pre: GetSystemTimeInSeconds не существует → GameplayStatics::GetRealTimeSeconds
- 16-utilities.txt :: W09: K2Node_CallFunction_425: GetWorldDeltaSeconds: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_426: QuitGame: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_427: OpenLevel: round16-pre: GameplayStatics::OpenLevel (by Name)
- 16-utilities.txt :: W09: K2Node_CallFunction_428: CreateSaveGameObject: round16-pre: GameplayStatics, exec
- 16-utilities.txt :: W09: K2Node_CallFunction_429: DoesSaveGameExist: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_430: SaveGameToSlot: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_431: LoadGameFromSlot: round16-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_496: GetPlayerPawn: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_497: GetPlayerCharacter: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_498: GetAllActorsOfClass: round17-pre: OutActors — Actor Array (container), ActorClass → Actor
- 17-gameplay.txt :: W09: K2Node_CallFunction_499: GetAllActorsWithTag: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_501: SpawnEmitterAtLocation: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_502: PlaySoundAtLocation: round17-pre: хвост (InitialParams) движок достроит сам
- 17-gameplay.txt :: W09: K2Node_CallFunction_503: GetGameMode: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_504: GetGameState: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_505: GetGameInstance: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_506: GetCurrentLevelName: round17-pre: статического GetWorld в Kismet нет → заменён на GameplayStatics::GetCurrentLevelName
- 18-input.txt :: W09: K2Node_CallFunction_509: IsInputKeyDown: round18-pre: член APlayerController (UFUNCTION BlueprintCallable, const → pure). MemberParent=PlayerController, пин self (Target) типа PlayerController, Key по значению; round18: белая (copy-back sweep/copyback/input-r18.txt: InputKey=SpaceBar принят, self → «Target», Key dv None)
- 21-enhanced-input.txt :: W09: K2Node_CallFunction_543: GetBoundActionValue: round21: FAIL — вставилась пустой (член EnhancedInputComponent::GetBoundActionValue движок не принял). Значение действия в BP берут узлом «Get IA_X» (K2Node_GetInputActionValue, нужен ассет) — ждём copy-back. round21-pre: статического GetActionValue нет — член UEnhancedInputComponent::GetBoundActionValue(const UInputAction*) const → pure; self = EnhancedInputComponent, RV FInputActionValue. Узел «Get IA_X» (K2Node_GetInputActionValue) требует ассет InputAction — не для свипа
- 21-enhanced-input.txt :: W09: K2Node_CallFunction_546: AddMappingContext: round21b VERIFIED (движок, 2026-09-25): член IEnhancedInputSubsystemInterface; Options (FModifyContextOptions) опущен — движок достроит; self типизирован подсистемой
- 22-casting.txt :: W09: K2Node_CallFunction_552: GetObjectClass: round22-pre: UGameplayStatics::GetObjectClass (в меню «Get Class») | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_553: ClassIsChildOf: round22-pre: KML::ClassIsChildOf(TSubclassOf TestClass, TSubclassOf ParentClass) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_554: GetDisplayName: round22-pre: KSL::GetDisplayName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_555: GetObjectName: round22-pre: KSL::GetObjectName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_556: EqualEqual_ObjectObject: round22-pre: CallFunction (не PromotableOperator), заголовок «==» | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_557: NotEqual_ObjectObject: round22-pre: заголовок «!=» | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_558: EqualEqual_ClassClass: round22-pre: KML::EqualEqual_ClassClass | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_559: Conv_ObjectToString: round22-pre: KSL(String)::Conv_ObjectToString(UObject* InObj) — компактный конвертер | R22 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_563: K2_GetActorLocation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_GetActorLocation const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_564: K2_GetActorRotation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_GetActorRotation const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_565: GetTransform: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). UFUNCTION GetTransform (DisplayName GetActorTransform) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_566: GetActorForwardVector: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_567: K2_SetActorLocation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_SetActorLocation(NewLocation,bSweep,out SweepHitResult,bTeleport) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_568: K2_SetActorRotation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_SetActorRotation(NewRotation,bTeleportPhysics) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_569: K2_AddActorWorldOffset: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_AddActorWorldOffset | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_570: K2_DestroyActor: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_DestroyActor | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_571: SetActorHiddenInGame: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). SetActorHiddenInGame(bool) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_572: GetOwner: R29 VERIFIED
- 23-actor.txt :: W09: K2Node_CallFunction_573: ActorHasTag: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). ActorHasTag(FName) const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_574: GetComponentByClass: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). GetComponentByClass(TSubclassOf<UActorComponent>) const; DeterminesOutputType — RV перетипизируется по классу | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_575: K2_AttachToActor: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_AttachToActor; enum EAttachmentRule (KeepRelative/KeepWorld/SnapToTarget) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_576: GetActorRightVector: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_577: GetActorUpVector: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_578: GetActorScale3D: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_579: K2_AddActorWorldRotation: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_580: K2_AddActorLocalRotation: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_581: K2_AddActorLocalOffset: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_582: SetActorScale3D: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_583: K2_SetActorTransform: round23b-pre: член Actor (как R23). NewTransform const FTransform& | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_584: K2_SetActorLocationAndRotation: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_585: K2_AttachToComponent: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_586: K2_DetachFromActor: round23b-pre: член Actor (как R23). EDetachmentRule (KeepRelative/KeepWorld) | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_587: K2_AttachToComponent: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_588: K2_DetachFromComponent: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_589: K2_GetComponentLocation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_590: K2_GetComponentRotation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_591: K2_SetWorldLocation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_592: K2_SetRelativeLocation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_593: K2_SetRelativeRotation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_594: K2_AddLocalRotation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_634: Jump: round24-pre: член Character, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_635: StopJumping: round24-pre: член Character, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_636: CanJump: round24-pre: член Character, self=Target (по образцу AActor-членов R23). CanJump() const BlueprintCallable → pure | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_637: LaunchCharacter: round24-pre: член Character, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_638: Crouch: round24-pre: член Character, self=Target (по образцу AActor-членов R23). bClientSimulation скрыт (HidePin) | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_639: UnCrouch: round24-pre: член Character, self=Target (по образцу AActor-членов R23). bClientSimulation скрыт (HidePin) | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_640: AddMovementInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_641: AddControllerYawInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_642: AddControllerPitchInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_644: GetController: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). альтернатива Get Player Controller (self) — подсказка пользователя R21b | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_645: IsLocallyControlled: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_646: IsPlayerControlled: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_647: Possess: round24-pre: член Controller, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_648: UnPossess: round24-pre: член Controller, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_649: K2_GetPawn: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). K2_GetPawn const → pure, DisplayName Get Controlled Pawn | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_650: SetControlRotation: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). NewRotation const FRotator& → const+ref | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_651: GetVelocity: round24-pre: член Actor, self=Target (по образцу AActor-членов R23). член AActor | R24 VERIFIED (движок, 2026-09-25)
- 25-events-delegates.txt :: W09: K2Node_CallFunction_690: OnDamaged: round25-pre: CallFunction без MemberParent, bSelfContext=True; MemberGuid = NodeGuid события; до компиляции может показать «не найдена функция» | R25 VERIFIED (движок, 2026-09-25): всё вставилось и работает; Create Event предложил «создать соответствующую функцию»
- 26-timers-latent.txt :: W09: K2Node_CallFunction_696: K2_SetTimerDelegate: round26-pre: K2_SetTimerDelegate(FTimerDynamicDelegate Delegate «Event», float Time, bLooping, bMaxOncePerFrame, InitialStartDelay/Variance advanced) → FTimerHandle | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_697: K2_SetTimer: round26-pre: K2_SetTimer(UObject* Object DefaultToSelf, FString FunctionName, ...) → FTimerHandle | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_698: K2_ClearTimer: round26-pre: K2_ClearTimer(Object, FunctionName) | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_699: K2_ClearAndInvalidateTimerHandle: round26-pre: WCO опущен (как Delay); Handle UPARAM(ref) → ref, нужна переменная | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_700: K2_PauseTimerHandle: round26-pre: WCO опущен | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_701: K2_UnPauseTimerHandle: round26-pre: WCO опущен | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_702: K2_InvalidateTimerHandle: round26-pre: Handle ref, BlueprintCallable → exec | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_703: K2_IsTimerActiveHandle: round26-pre: BlueprintPure | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_704: K2_IsTimerPausedHandle: round26-pre: BlueprintPure | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_705: K2_TimerExistsHandle: round26-pre: BlueprintPure | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_706: K2_IsValidTimerHandle: round26-pre: BlueprintPure, без WCO | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_707: K2_GetTimerElapsedTimeHandle: round26-pre: BlueprintPure → float | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_708: K2_GetTimerRemainingTimeHandle: round26-pre: BlueprintPure → float | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_709: DelayUntilNextTick: round26-pre: как Delay: WCO/LatentInfo движок восстановит (UE 5.2+) | R26 VERIFIED (движок, 2026-09-26)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_712: AddToViewport: round27-pre: член UUserWidget | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_713: AddToPlayerScreen: round27-pre: член UUserWidget → bool | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_714: IsInViewport: round27-pre: BlueprintPure const | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_715: RemoveFromParent: round27-pre: член UWidget (UE 5.1+) | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_716: SetVisibility: R29 VERIFIED
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_717: SetInputMode_UIOnlyEx: round27-pre: UWidgetBlueprintLibrary::SetInputMode_UIOnlyEx | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_718: SetInputMode_GameAndUIEx: round27-pre: UWidgetBlueprintLibrary::SetInputMode_GameAndUIEx | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_719: SetInputMode_GameOnly: round27-pre: UWidgetBlueprintLibrary::SetInputMode_GameOnly | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_817: RemoveMappingContext: R28 VERIFIED (движок, 2026-09-26): член IEnhancedInputSubsystemInterface; Options опущен (как в AddMappingContext R21b)
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_818: ClearAllMappings: R28 VERIFIED (движок, 2026-09-26): член IEnhancedInputSubsystemInterface
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_819: HasMappingContext: R28 VERIFIED (движок, 2026-09-26): const-член → pure в BP
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_820: QueryKeysMappedToAction: R28 VERIFIED (движок, 2026-09-26): const-член → pure, RV TArray<FKey>
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_821: InjectInputForAction: R28 VERIFIED (движок, 2026-09-26): Modifiers/Triggers AutoCreateRefTerm — можно не подключать
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_822: InjectInputVectorForAction: R28 VERIFIED (движок, 2026-09-26): Modifiers/Triggers AutoCreateRefTerm
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_823: RequestRebuildControlMappingsUsingContext: R28 VERIFIED (движок, 2026-09-26): статик UEnhancedInputLibrary, self скрыт
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_824: FlushPlayerInput: R28 VERIFIED (движок, 2026-09-26): статик UEnhancedInputLibrary
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_825: MakeInputActionValue: R28 VERIFIED (движок, 2026-09-26): pure; MatchValueType задаёт тип (без подключения — Boolean)
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_826: BreakInputActionValue: R28 VERIFIED (движок, 2026-09-26): pure; выход Type = EInputActionValueType
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_827: Conv_InputActionValueToBool: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_828: Conv_InputActionValueToAxis1D: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_829: Conv_InputActionValueToAxis2D: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_830: Conv_InputActionValueToAxis3D: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_831: Conv_InputActionValueToString: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 29-components-physics.txt :: W09: K2Node_CallFunction_833: SetSimulatePhysics: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_834: SetEnableGravity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_837: AddTorqueInRadians: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_838: SetPhysicsLinearVelocity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_839: GetPhysicsLinearVelocity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_840: GetMass: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_841: SetMassOverrideInKg: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_842: SetCollisionEnabled: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_843: SetCollisionResponseToChannel: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_844: SetCollisionProfileName: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_845: SetGenerateOverlapEvents: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_846: SetMaterial: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_847: SetVisibility: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_848: SetHiddenInGame: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_849: SetWorldScale3D: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_850: K2_AddWorldOffset: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_851: GetComponentVelocity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_852: GetOwner: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_853: SetActive: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_854: IsActive: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_855: ComponentHasTag: R29 VERIFIED

