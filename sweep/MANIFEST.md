# Sweep manifest — полный прогон реестра по категориям

Записей в реестре: 409; построено узлов: 409; упало: 0.
MANIFEST и NN-*.txt побайтово воспроизводимы (дата не пишется): сверка — `node tools/gen-sweep.mjs --check`.
Генератор: tools/gen-sweep.mjs (сетка по 5 в ряд, внутри ряда layoutRow, накрыто fitComment).

Протокол: вставляйте файлы по одному в чистый граф → копируйте обратно → сообщайте номер файла и что сломалось.
Для сломанных нод прикладывайте copy-back целиком (пин Id не затирать) — по нему чиним реестр.

Известные оговорки (не баги свипа):
- 02-variables: VariableReference указывает на несуществующую переменную (MemberName из реестра, случайный MemberGuid) — движок подсветит неизвестную переменную, это ожидаемо; нужны референсы из BP с настоящими переменными.
- MakeArray/MakeSet/MakeMap: форма смоделирована по механике типов контейнера; проверяйте в движке при использовании. Enum Select для EDrawDebugTrace использует отдельную копию из UE (sweep/enum-select-test.txt); не обобщать её на пользовательские enum без reference.
- Макросы без GraphGuid (W07 в 01-flow-control): движок обычно прощает; guid доберём из copy-back.
- W09: у записи есть note — вставляйте внимательнее, это зафиксированные сомнения.

Колонка `Registry verified` буквально считает записи с `verified: true` в реестре; она не означает, что каждая запись категории была отдельно перепроверена в одном UE-сеансе. `Warn` — предупреждения локального валидатора.

| # | Файл | Нод | Registry verified | Notes | Err | Warn |
|---|---|---|---|---|---|---|
| 01 | 01-flow-control.txt | 14/14 | 14 | 2 | — | — |
| 02 | 02-variables.txt | 4/4 | 4 | 0 | — | — |
| 03 | 03-math-float.txt | 30/30 | 30 | 0 | — | — |
| 04 | 04-math-interpolation.txt | 7/7 | 7 | 0 | — | — |
| 05 | 05-math-integer.txt | 9/9 | 8 | 3 | — | 3xW09 |
| 06 | 06-math-trig.txt | 18/18 | 18 | 0 | — | — |
| 07 | 07-math-comparison.txt | 8/8 | 8 | 0 | — | — |
| 08 | 08-math-boolean.txt | 7/7 | 7 | 0 | — | — |
| 09 | 09-math-random.txt | 6/6 | 6 | 0 | — | — |
| 10 | 10-math-vector.txt | 31/31 | 30 | 0 | — | — |
| 11 | 11-collision.txt | 26/26 | 25 | 2 | — | 1xW09 |
| 12 | 12-math-rotator.txt | 15/15 | 15 | 8 | — | 8xW09 |
| 13 | 13-math-transform.txt | 10/10 | 10 | 8 | — | 8xW09 |
| 14 | 14-string.txt | 28/28 | 28 | 13 | — | 13xW09 |
| 15 | 15-array.txt | 18/18 | 18 | 18 | — | 17xW09 |
| 16 | 16-utilities.txt | 20/20 | 20 | 17 | — | 17xW09 |
| 17 | 17-gameplay.txt | 12/12 | 12 | 12 | — | 11xW09 |
| 18 | 18-input.txt | 2/2 | 2 | 2 | — | 1xW09 |
| 19 | 19-organization.txt | 7/7 | 7 | 5 | — | — |
| 20 | 20-text.txt | 1/1 | 1 | 1 | — | — |
| 21 | 21-enhanced-input.txt | 6/6 | 5 | 6 | — | 2xW09 |
| 22 | 22-casting.txt | 11/11 | 11 | 11 | — | 8xW09 |
| 23 | 23-actor.txt | 32/32 | 32 | 32 | — | 32xW09 |
| 24 | 24-pawn-character.txt | 18/18 | 18 | 18 | — | 18xW09 |
| 25 | 25-events-delegates.txt | 8/8 | 8 | ⊘ tools/gen-r25.mjs | — | 1xW09 |
| 26 | 26-timers-latent.txt | 14/14 | 14 | ⊘ tools/gen-r26.mjs | — | 14xW09 |
| 27 | 27-widgets-ui.txt | 8/8 | 8 | ⊘ ручная глава R27 (сверена с движком) — генератора нет, файл заморожен | — | 8xW09 |
| 28 | 28-enhanced-input-full.txt | 15/15 | 15 | ⊘ ручная глава R28 (InputAction-ассеты, CustomEvent SetupInput) — заморожен | — | 15xW09 |
| 29 | 29-components-physics.txt | 23/23 | 23 | ⊘ ручная глава R29 (damping-вызовы вне реестра) — заморожен | — | 23xW09 |
| 30 | 30-debug.txt | 1/1 | 1 | 0 | — | — |

## Покрытие: чем пересобран каждый файл

Все строки ниже побайтово воспроизводимы (`seedGuids` по имени файла), сверка — `node tools/check-fixtures.mjs`:

| файлы | команда пересборки |
|---|---|
| NN-*.txt категорий реестра, MANIFEST.md | `node tools/gen-sweep.mjs` (одна категория: `node tools/gen-sweep.mjs 11`) — кроме файлов с ⊘ в колонке Notes |
| 21b, 21c | `node tools/gen-r21b.mjs` |
| 22b | `node tools/gen-cast.mjs --demo` |
| 23b | `bash sweep/gen23b.sh` (gen-subset по 19 id реестра) |
| 25, 26 | `node tools/gen-r25.mjs`, `node tools/gen-r26.mjs` (ручная компоновка глав, см. колонку Notes выше) |
| 27b, 30, 32 | `bash sweep/gen27b.sh`, `bash sweep/gen30.sh`, `bash sweep/gen32.sh` (make-node; seed берётся из `-o`) |
| enum-select-test | `node tools/gen-enum-select-test.mjs` |
| collapsed-knot-4x5, collapsed-knot-1x3-3levels | `node tools/gen-collapsed-knot-test.mjs`, затем `--inputs 1 --outputs 3 --levels 3` |
| current-pipeline-smoke, dispatcher-probe-bound | `node tools/gen-current-pipeline-smoke.mjs`, `node tools/gen-dispatcher-bound-test.mjs` |

Заморожено — copy-back / ручные главы, сверенные с движком; генератора в репозитории нет, пересборка их перезаписывает — запрещено:
- `25b-make-node.txt` (VERIFIED 2026-09-26), `31-audio.txt` (VERIFIED) — продукты `tools/make-node.mjs`, команда сборки не зафиксирована;
- `27-widgets-ui.txt`, `28-enhanced-input-full.txt`, `29-components-physics.txt` — главы R27/R28/R29, собранные до того, как их содержимое попало в реестр (в нём нет, например, Set/GetAngularDamping, LinearDamping и CustomEvent SetupInput). Статистику по этим категориям MANIFEST считает по реестру, файл не трогает.

Замороженные копии созданы до отказа от `ExportPath` — строки `ExportPath=...` в них сохранены намеренно (это снятые с движка тексты).

## NEEDS-REFERENCE (не построилось — нужен copy-back из движка)

Пусто — построилось всё.

## STRICT-ошибки по файлам (наш валидатор; движок — арбитр)

Пусто.

## Варнинги по файлам (W09 = есть note в реестре, W07 = нет GraphGuid)

- 05-math-integer.txt :: W09: K2Node_CallFunction_165: Clamp: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_166: Max: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_167: Min: Int overload func name uncertain — verify in engine
- 11-collision.txt :: W09: K2Node_CallFunction_249: BoxTraceSingle: live-ref 2026-09-25 (BP_WheelActor): полный пин-лист; HalfSize bIsConst=True — в Single констный, в Multi нет (причуда движка, copy-back O1 подтверждает)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_271: MakeRotator: round12-pre: MakeStruct-форма у FRotator (HasNativeMake) по аналогии с Vector жёлтая — канон pure MakeRotator Roll/Pitch/Yaw float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_272: BreakRotator: round12-pre: BreakStruct-форма по аналогии с Vector жёлтая — канон pure BreakRotator InRot→Roll/Pitch/Yaw
- 12-math-rotator.txt :: W09: K2Node_CallFunction_278: NormalizedDeltaRotator: round12-pre: FindLookAtRotation2D в KismetMathLibrary нет — заменена на NormalizedDeltaRotator
- 12-math-rotator.txt :: W09: K2Node_CallFunction_280: NegateRotator: round12-pre: InverseTransformRotation — это Transform-функция; канон инверсии NegateRotator (Invert Rotator)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_281: RLerp: round12-pre: добавлен пин bShortestPath, Alpha float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_283: GetForwardVector: round12-pre: новая запись, не проверена движком
- 12-math-rotator.txt :: W09: K2Node_CallFunction_284: GetRightVector: round12-pre: новая запись, не проверена движком
- 12-math-rotator.txt :: W09: K2Node_CallFunction_285: GetUpVector: round12-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_287: MakeTransform: round13-pre: FTransform HasNativeMake — по аналогии с Vector канон pure KML MakeTransform
- 13-math-transform.txt :: W09: K2Node_CallFunction_288: BreakTransform: round13-pre: канон pure KML BreakTransform InTransform→Location/Rotation/Scale
- 13-math-transform.txt :: W09: K2Node_CallFunction_291: TransformLocation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_292: InverseTransformLocation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_293: TransformDirection: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_294: InverseTransformDirection: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_295: TransformRotation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_296: InverseTransformRotation: round13-pre: новая запись, не проверена движком
- 14-string.txt :: W09: K2Node_CallFunction_302: Contains: round14-pre: UseCase/SearchDir были byte — в UE это bool bUseCase/bSearchFromEnd
- 14-string.txt :: W09: K2Node_CallFunction_303: FindSubstring: round14-pre: bool bUseCase/bSearchFromEnd + StartPosition int (-1)
- 14-string.txt :: W09: K2Node_CallFunction_305: ParseIntoArray: round14-pre: ReturnValue — ContainerType=Array (было sub Array)
- 14-string.txt :: W09: K2Node_CallFunction_306: JoinStringArray: round14-pre: SourceArray — Array ref+const (как ActorsToIgnore у трейсов)
- 14-string.txt :: W09: K2Node_CallFunction_314: EqualEqual_StrStr: round14-pre: PromotableOperator только для KismetMathLibrary — канон CallFunction
- 14-string.txt :: W09: K2Node_CallFunction_315: NotEqual_StrStr: round14-pre: канон CallFunction
- 14-string.txt :: W09: K2Node_CallFunction_316: BuildString_Double: round14-pre: UE5 — BuildString_Double/InDouble + Suffix
- 14-string.txt :: W09: K2Node_CallFunction_317: BuildString_Int: round14-pre: добавлен Suffix
- 14-string.txt :: W09: K2Node_CallFunction_318: BuildString_Bool: round14-pre: добавлен Suffix
- 14-string.txt :: W09: K2Node_CallFunction_319: Conv_DoubleToString: round14-pre: UE5 — Conv_DoubleToString/InDouble
- 14-string.txt :: W09: K2Node_CallFunction_323: IsEmpty: round14-pre: новая запись
- 14-string.txt :: W09: K2Node_CallFunction_324: Conv_StringToInt: round14-pre: новая запись
- 14-string.txt :: W09: K2Node_CallFunction_325: Conv_StringToDouble: round14-pre: новая запись (UE5 double)
- 15-array.txt :: W09: K2Node_CallArrayFunction_327: Array_Add: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_328: Array_AddUnique: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_329: Array_Remove: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_330: Array_RemoveItem: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_331: Array_Clear: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_332: Array_Length: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_334: Array_Set: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_335: Array_Find: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_336: Array_Contains: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_337: Array_Insert: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_338: Array_Shuffle: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_339: Array_Reverse: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_340: Array_IsValidIndex: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_341: Array_Resize: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_342: Array_LastIndex: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_343: Array_Append: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_344: Array_Swap: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 16-utilities.txt :: W09: K2Node_CallFunction_347: PrintText: round16-pre: клон белого PrintString, InText — text const
- 16-utilities.txt :: W09: K2Node_CallFunction_350: RetriggerableDelay: round16-pre: как белый Delay: выход then, WCO/LatentInfo движок восстанавливает
- 16-utilities.txt :: W09: K2Node_CallFunction_351: IsValid: round16-pre: pure-форма «? Is Valid»; параметр Object (const UObject*)
- 16-utilities.txt :: W09: K2Node_CallFunction_352: IsValidClass: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_353: GetDisplayName: round22-pre: KSL::GetDisplayName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 16-utilities.txt :: W09: K2Node_CallFunction_354: GetObjectName: round22-pre: KSL::GetObjectName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 16-utilities.txt :: W09: K2Node_CallFunction_355: GetEngineVersion: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_356: GetPlatformName: round16-pre: живёт в GameplayStatics
- 16-utilities.txt :: W09: K2Node_CallFunction_357: GetGameTimeInSeconds: round16-pre: KismetSystemLibrary::GetGameTimeInSeconds → float
- 16-utilities.txt :: W09: K2Node_CallFunction_358: GetRealTimeSeconds: round16-pre: GetSystemTimeInSeconds не существует → GameplayStatics::GetRealTimeSeconds
- 16-utilities.txt :: W09: K2Node_CallFunction_359: GetWorldDeltaSeconds: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_360: QuitGame: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_361: OpenLevel: round16-pre: GameplayStatics::OpenLevel (by Name)
- 16-utilities.txt :: W09: K2Node_CallFunction_362: CreateSaveGameObject: round16-pre: GameplayStatics, exec
- 16-utilities.txt :: W09: K2Node_CallFunction_363: DoesSaveGameExist: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_364: SaveGameToSlot: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_365: LoadGameFromSlot: round16-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_367: GetPlayerController: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_368: GetPlayerPawn: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_369: GetPlayerCharacter: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_370: GetAllActorsOfClass: round17-pre: OutActors — Actor Array (container), ActorClass → Actor
- 17-gameplay.txt :: W09: K2Node_CallFunction_371: GetAllActorsWithTag: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_373: SpawnEmitterAtLocation: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_374: PlaySoundAtLocation: round17-pre: хвост (InitialParams) движок достроит сам
- 17-gameplay.txt :: W09: K2Node_CallFunction_375: GetGameMode: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_376: GetGameState: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_377: GetGameInstance: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_378: GetCurrentLevelName: round17-pre: статического GetWorld в Kismet нет → заменён на GameplayStatics::GetCurrentLevelName
- 18-input.txt :: W09: K2Node_CallFunction_381: IsInputKeyDown: round18-pre: член APlayerController (UFUNCTION BlueprintCallable, const → pure). MemberParent=PlayerController, пин self (Target) типа PlayerController, Key по значению; round18: белая (copy-back tests/fixtures/input-r18-copyback.txt: InputKey=SpaceBar принят, self → «Target», Key dv None)
- 21-enhanced-input.txt :: W09: K2Node_CallFunction_393: GetBoundActionValue: round21: FAIL — вставилась пустой (член EnhancedInputComponent::GetBoundActionValue движок не принял). Значение действия в BP берут узлом «Get IA_X» (K2Node_GetInputActionValue, нужен ассет) — ждём copy-back. round21-pre: статического GetActionValue нет — член UEnhancedInputComponent::GetBoundActionValue(const UInputAction*) const → pure; self = EnhancedInputComponent, RV FInputActionValue. Узел «Get IA_X» (K2Node_GetInputActionValue) требует ассет InputAction — не для свипа
- 21-enhanced-input.txt :: W09: K2Node_CallFunction_396: AddMappingContext: round21b VERIFIED (движок, 2026-09-25): член IEnhancedInputSubsystemInterface; Options (FModifyContextOptions) опущен — движок достроит; self типизирован подсистемой
- 22-casting.txt :: W09: K2Node_CallFunction_402: GetObjectClass: round22-pre: UGameplayStatics::GetObjectClass (в меню «Get Class») | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_403: ClassIsChildOf: round22-pre: KML::ClassIsChildOf(TSubclassOf TestClass, TSubclassOf ParentClass) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_404: GetDisplayName: round22-pre: KSL::GetDisplayName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_405: GetObjectName: round22-pre: KSL::GetObjectName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_406: EqualEqual_ObjectObject: round22-pre: CallFunction (не PromotableOperator), заголовок «==» | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_407: NotEqual_ObjectObject: round22-pre: заголовок «!=» | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_408: EqualEqual_ClassClass: round22-pre: KML::EqualEqual_ClassClass | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_409: Conv_ObjectToString: round22-pre: KSL(String)::Conv_ObjectToString(UObject* InObj) — компактный конвертер | R22 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_412: K2_GetActorLocation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_GetActorLocation const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_413: K2_GetActorRotation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_GetActorRotation const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_414: GetTransform: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). UFUNCTION GetTransform (DisplayName GetActorTransform) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_415: GetActorForwardVector: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_416: K2_SetActorLocation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_SetActorLocation(NewLocation,bSweep,out SweepHitResult,bTeleport) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_417: K2_SetActorRotation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_SetActorRotation(NewRotation,bTeleportPhysics) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_418: K2_AddActorWorldOffset: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_AddActorWorldOffset | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_419: K2_DestroyActor: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_DestroyActor | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_420: SetActorHiddenInGame: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). SetActorHiddenInGame(bool) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_421: GetOwner: R29 VERIFIED
- 23-actor.txt :: W09: K2Node_CallFunction_422: ActorHasTag: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). ActorHasTag(FName) const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_423: GetComponentByClass: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). GetComponentByClass(TSubclassOf<UActorComponent>) const; DeterminesOutputType — RV перетипизируется по классу | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_424: K2_AttachToActor: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_AttachToActor; enum EAttachmentRule (KeepRelative/KeepWorld/SnapToTarget) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_425: GetActorRightVector: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_426: GetActorUpVector: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_427: GetActorScale3D: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_428: K2_AddActorWorldRotation: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_429: K2_AddActorLocalRotation: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_430: K2_AddActorLocalOffset: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_431: SetActorScale3D: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_432: K2_SetActorTransform: round23b-pre: член Actor (как R23). NewTransform const FTransform& | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_433: K2_SetActorLocationAndRotation: round23b-pre: член Actor (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_434: K2_AttachToComponent: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_435: K2_DetachFromActor: round23b-pre: член Actor (как R23). EDetachmentRule (KeepRelative/KeepWorld) | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_436: K2_AttachToComponent: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_437: K2_DetachFromComponent: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_438: K2_GetComponentLocation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_439: K2_GetComponentRotation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_440: K2_SetWorldLocation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_441: K2_SetRelativeLocation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_442: K2_SetRelativeRotation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_443: K2_AddLocalRotation: round23b-pre: член SceneComponent (как R23). | R23b VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_445: Jump: round24-pre: член Character, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_446: StopJumping: round24-pre: член Character, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_447: CanJump: round24-pre: член Character, self=Target (по образцу AActor-членов R23). CanJump() const BlueprintCallable → pure | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_448: LaunchCharacter: round24-pre: член Character, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_449: Crouch: round24-pre: член Character, self=Target (по образцу AActor-членов R23). bClientSimulation скрыт (HidePin) | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_450: UnCrouch: round24-pre: член Character, self=Target (по образцу AActor-членов R23). bClientSimulation скрыт (HidePin) | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_451: AddMovementInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_452: AddControllerYawInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_453: AddControllerPitchInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_454: GetControlRotation: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_455: GetController: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). альтернатива Get Player Controller (self) — подсказка пользователя R21b | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_456: IsLocallyControlled: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_457: IsPlayerControlled: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_458: Possess: round24-pre: член Controller, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_459: UnPossess: round24-pre: член Controller, self=Target (по образцу AActor-членов R23).  | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_460: K2_GetPawn: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). K2_GetPawn const → pure, DisplayName Get Controlled Pawn | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_461: SetControlRotation: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). NewRotation const FRotator& → const+ref | R24 VERIFIED (движок, 2026-09-25)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_462: GetVelocity: round24-pre: член Actor, self=Target (по образцу AActor-членов R23). член AActor | R24 VERIFIED (движок, 2026-09-25)
- 25-events-delegates.txt :: W09: K2Node_CallFunction_467: OnDamaged: round25-pre: CallFunction без MemberParent, bSelfContext=True; MemberGuid = NodeGuid события; до компиляции может показать «не найдена функция» | R25 VERIFIED (движок, 2026-09-25): всё вставилось и работает; Create Event предложил «создать соответствующую функцию»
- 26-timers-latent.txt :: W09: K2Node_CallFunction_473: K2_SetTimerDelegate: round26-pre: K2_SetTimerDelegate(FTimerDynamicDelegate Delegate «Event», float Time, bLooping, bMaxOncePerFrame, InitialStartDelay/Variance advanced) → FTimerHandle | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_474: K2_SetTimer: round26-pre: K2_SetTimer(UObject* Object DefaultToSelf, FString FunctionName, ...) → FTimerHandle | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_475: K2_ClearTimer: round26-pre: K2_ClearTimer(Object, FunctionName) | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_476: K2_ClearAndInvalidateTimerHandle: round26-pre: WCO опущен (как Delay); Handle UPARAM(ref) → ref, нужна переменная | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_477: K2_PauseTimerHandle: round26-pre: WCO опущен | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_478: K2_UnPauseTimerHandle: round26-pre: WCO опущен | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_479: K2_InvalidateTimerHandle: round26-pre: Handle ref, BlueprintCallable → exec | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_480: K2_IsTimerActiveHandle: round26-pre: BlueprintPure | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_481: K2_IsTimerPausedHandle: round26-pre: BlueprintPure | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_482: K2_TimerExistsHandle: round26-pre: BlueprintPure | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_483: K2_IsValidTimerHandle: round26-pre: BlueprintPure, без WCO | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_484: K2_GetTimerElapsedTimeHandle: round26-pre: BlueprintPure → float | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_485: K2_GetTimerRemainingTimeHandle: round26-pre: BlueprintPure → float | R26 VERIFIED (движок, 2026-09-26)
- 26-timers-latent.txt :: W09: K2Node_CallFunction_486: DelayUntilNextTick: round26-pre: как Delay: WCO/LatentInfo движок восстановит (UE 5.2+) | R26 VERIFIED (движок, 2026-09-26)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_488: AddToViewport: round27-pre: член UUserWidget | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_489: AddToPlayerScreen: round27-pre: член UUserWidget → bool | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_490: IsInViewport: round27-pre: BlueprintPure const | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_491: RemoveFromParent: round27-pre: член UWidget (UE 5.1+) | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_492: SetVisibility: R29 VERIFIED
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_493: SetInputMode_UIOnlyEx: round27-pre: UWidgetBlueprintLibrary::SetInputMode_UIOnlyEx | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_494: SetInputMode_GameAndUIEx: round27-pre: UWidgetBlueprintLibrary::SetInputMode_GameAndUIEx | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 27-widgets-ui.txt :: W09: K2Node_CallFunction_495: SetInputMode_GameOnly: round27-pre: UWidgetBlueprintLibrary::SetInputMode_GameOnly | R27 VERIFIED (движок, 2026-09-26; Construct NONE — класс виджета выбирается локально)
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_497: RemoveMappingContext: R28 VERIFIED (движок, 2026-09-26): член IEnhancedInputSubsystemInterface; Options опущен (как в AddMappingContext R21b)
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_498: ClearAllMappings: R28 VERIFIED (движок, 2026-09-26): член IEnhancedInputSubsystemInterface
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_499: HasMappingContext: R28 VERIFIED (движок, 2026-09-26): const-член → pure в BP
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_500: QueryKeysMappedToAction: R28 VERIFIED (движок, 2026-09-26): const-член → pure, RV TArray<FKey>
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_501: InjectInputForAction: R28 VERIFIED (движок, 2026-09-26): Modifiers/Triggers AutoCreateRefTerm — можно не подключать
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_502: InjectInputVectorForAction: R28 VERIFIED (движок, 2026-09-26): Modifiers/Triggers AutoCreateRefTerm
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_503: RequestRebuildControlMappingsUsingContext: R28 VERIFIED (движок, 2026-09-26): статик UEnhancedInputLibrary, self скрыт
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_504: FlushPlayerInput: R28 VERIFIED (движок, 2026-09-26): статик UEnhancedInputLibrary
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_505: MakeInputActionValue: R28 VERIFIED (движок, 2026-09-26): pure; MatchValueType задаёт тип (без подключения — Boolean)
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_506: BreakInputActionValue: R28 VERIFIED (движок, 2026-09-26): pure; выход Type = EInputActionValueType
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_507: Conv_InputActionValueToBool: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_508: Conv_InputActionValueToAxis1D: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_509: Conv_InputActionValueToAxis2D: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_510: Conv_InputActionValueToAxis3D: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 28-enhanced-input-full.txt :: W09: K2Node_CallFunction_511: Conv_InputActionValueToString: R28 VERIFIED (движок, 2026-09-26): pure autocast
- 29-components-physics.txt :: W09: K2Node_CallFunction_513: SetSimulatePhysics: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_514: SetEnableGravity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_515: AddImpulse: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_516: AddForce: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_517: AddTorqueInRadians: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_518: SetPhysicsLinearVelocity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_519: GetPhysicsLinearVelocity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_520: GetMass: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_521: SetMassOverrideInKg: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_522: SetCollisionEnabled: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_523: SetCollisionResponseToChannel: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_524: SetCollisionProfileName: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_525: SetGenerateOverlapEvents: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_526: SetMaterial: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_527: SetVisibility: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_528: SetHiddenInGame: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_529: SetWorldScale3D: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_530: K2_AddWorldOffset: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_531: GetComponentVelocity: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_532: GetOwner: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_533: SetActive: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_534: IsActive: R29 VERIFIED
- 29-components-physics.txt :: W09: K2Node_CallFunction_535: ComponentHasTag: R29 VERIFIED

