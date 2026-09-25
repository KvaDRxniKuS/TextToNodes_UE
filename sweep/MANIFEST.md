# Sweep manifest — полный прогон реестра по категориям

Дата: 2026-09-25; записей: 336; построено узлов: 336; упало: 0.
Генератор: tools/gen-sweep.mjs (сетка по 5 в ряд, внутри ряда layoutRow, накрыто fitComment).

Протокол: вставляйте файлы по одному в чистый граф → копируйте обратно → сообщайте номер файла и что сломалось.
Для сломанных нод прикладывайте copy-back целиком (пин Id не затирать) — по нему чиним реестр.

Известные оговорки (не баги свипа):
- 02-variables: VariableReference указывает на несуществующую переменную (MemberName из реестра, случайный MemberGuid) — движок подсветит неизвестную переменную, это ожидаемо; нужны референсы из BP с настоящими переменными.
- MakeArray/MakeSet/MakeMap/Select (19-organization): форма смоделирована механически (sub Array/Set/Map → ContainerType) — движок арбитр, ждём copy-back.
- Макросы без GraphGuid (W07 в 01-flow-control): движок обычно прощает; guid доберём из copy-back.
- W09: у записи есть note — вставляйте внимательнее, это зафиксированные сомнения.

| # | Файл | Нод | Verified | Noted | Err | Warn |
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
| 10 | 10-math-vector.txt | 29/29 | 28 | 0 | — | — |
| 11 | 11-collision.txt | 26/26 | 25 | 2 | — | 1xW09 |
| 12 | 12-math-rotator.txt | 15/15 | 15 | 8 | — | 8xW09 |
| 13 | 13-math-transform.txt | 10/10 | 10 | 8 | — | 8xW09 |
| 14 | 14-string.txt | 28/28 | 28 | 13 | — | 13xW09 |
| 15 | 15-array.txt | 18/18 | 18 | 18 | — | 17xW09 |
| 16 | 16-utilities.txt | 19/19 | 19 | 17 | — | 17xW09 |
| 17 | 17-gameplay.txt | 12/12 | 12 | 12 | — | 11xW09 |
| 18 | 18-input.txt | 2/2 | 2 | 2 | — | 1xW09 |
| 19 | 19-organization.txt | 6/6 | 6 | 4 | — | — |
| 20 | 20-text.txt | 1/1 | 1 | 1 | — | — |
| 21 | 21-enhanced-input.txt | 6/6 | 3 | 6 | — | 2xW09 |
| 22 | 22-casting.txt | 11/11 | 11 | 11 | — | 8xW09 |
| 23 | 23-actor.txt | 32/32 | 13 | 32 | — | 32xW09 |
| 24 | 24-pawn-character.txt | 18/18 | 0 | 18 | — | 18xW09 |

## NEEDS-REFERENCE (не построилось — нужен copy-back из движка)

Пусто — построилось всё.

## STRICT-ошибки по файлам (наш валидатор; движок — арбитр)

Пусто.

## Варнинги по файлам (W09 = есть note в реестре, W07 = нет GraphGuid)

- 05-math-integer.txt :: W09: K2Node_CallFunction_165: Clamp: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_166: Max: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_167: Min: Int overload func name uncertain — verify in engine
- 11-collision.txt :: W09: K2Node_CallFunction_247: BoxTraceSingle: live-ref 2026-09-25 (BP_WheelActor): полный пин-лист; HalfSize bIsConst=True — в Single констный, в Multi нет (причуда движка, copy-back O1 подтверждает)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_269: MakeRotator: round12-pre: MakeStruct-форма у FRotator (HasNativeMake) по аналогии с Vector жёлтая — канон pure MakeRotator Roll/Pitch/Yaw float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_270: BreakRotator: round12-pre: BreakStruct-форма по аналогии с Vector жёлтая — канон pure BreakRotator InRot→Roll/Pitch/Yaw
- 12-math-rotator.txt :: W09: K2Node_CallFunction_276: NormalizedDeltaRotator: round12-pre: FindLookAtRotation2D в KismetMathLibrary нет — заменена на NormalizedDeltaRotator
- 12-math-rotator.txt :: W09: K2Node_CallFunction_278: NegateRotator: round12-pre: InverseTransformRotation — это Transform-функция; канон инверсии NegateRotator (Invert Rotator)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_279: RLerp: round12-pre: добавлен пин bShortestPath, Alpha float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_281: GetForwardVector: round12-pre: новая запись, не проверена движком
- 12-math-rotator.txt :: W09: K2Node_CallFunction_282: GetRightVector: round12-pre: новая запись, не проверена движком
- 12-math-rotator.txt :: W09: K2Node_CallFunction_283: GetUpVector: round12-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_285: MakeTransform: round13-pre: FTransform HasNativeMake — по аналогии с Vector канон pure KML MakeTransform
- 13-math-transform.txt :: W09: K2Node_CallFunction_286: BreakTransform: round13-pre: канон pure KML BreakTransform InTransform→Location/Rotation/Scale
- 13-math-transform.txt :: W09: K2Node_CallFunction_289: TransformLocation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_290: InverseTransformLocation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_291: TransformDirection: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_292: InverseTransformDirection: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_293: TransformRotation: round13-pre: новая запись, не проверена движком
- 13-math-transform.txt :: W09: K2Node_CallFunction_294: InverseTransformRotation: round13-pre: новая запись, не проверена движком
- 14-string.txt :: W09: K2Node_CallFunction_300: Contains: round14-pre: UseCase/SearchDir были byte — в UE это bool bUseCase/bSearchFromEnd
- 14-string.txt :: W09: K2Node_CallFunction_301: FindSubstring: round14-pre: bool bUseCase/bSearchFromEnd + StartPosition int (-1)
- 14-string.txt :: W09: K2Node_CallFunction_303: ParseIntoArray: round14-pre: ReturnValue — ContainerType=Array (было sub Array)
- 14-string.txt :: W09: K2Node_CallFunction_304: JoinStringArray: round14-pre: SourceArray — Array ref+const (как ActorsToIgnore у трейсов)
- 14-string.txt :: W09: K2Node_CallFunction_312: EqualEqual_StrStr: round14-pre: PromotableOperator только для KismetMathLibrary — канон CallFunction
- 14-string.txt :: W09: K2Node_CallFunction_313: NotEqual_StrStr: round14-pre: канон CallFunction
- 14-string.txt :: W09: K2Node_CallFunction_314: BuildString_Double: round14-pre: UE5 — BuildString_Double/InDouble + Suffix
- 14-string.txt :: W09: K2Node_CallFunction_315: BuildString_Int: round14-pre: добавлен Suffix
- 14-string.txt :: W09: K2Node_CallFunction_316: BuildString_Bool: round14-pre: добавлен Suffix
- 14-string.txt :: W09: K2Node_CallFunction_317: Conv_DoubleToString: round14-pre: UE5 — Conv_DoubleToString/InDouble
- 14-string.txt :: W09: K2Node_CallFunction_321: IsEmpty: round14-pre: новая запись
- 14-string.txt :: W09: K2Node_CallFunction_322: Conv_StringToInt: round14-pre: новая запись
- 14-string.txt :: W09: K2Node_CallFunction_323: Conv_StringToDouble: round14-pre: новая запись (UE5 double)
- 15-array.txt :: W09: K2Node_CallArrayFunction_325: Array_Add: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_326: Array_AddUnique: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_327: Array_Remove: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_328: Array_RemoveItem: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_329: Array_Clear: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_330: Array_Length: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_332: Array_Set: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_333: Array_Find: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_334: Array_Contains: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_335: Array_Insert: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_336: Array_Shuffle: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_337: Array_Reverse: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_338: Array_IsValidIndex: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_339: Array_Resize: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_340: Array_LastIndex: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_341: Array_Append: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 15-array.txt :: W09: K2Node_CallArrayFunction_342: Array_Swap: round15-pre: KismetArrayLibrary CustomThunk — TargetArray wildcard Array by-ref (const у pure/Shuffle/Swap), элемент wildcard const-ref; тип резолвится при подключении
- 16-utilities.txt :: W09: K2Node_CallFunction_345: PrintText: round16-pre: клон белого PrintString, InText — text const
- 16-utilities.txt :: W09: K2Node_CallFunction_347: RetriggerableDelay: round16-pre: как белый Delay: выход then, WCO/LatentInfo движок восстанавливает
- 16-utilities.txt :: W09: K2Node_CallFunction_348: IsValid: round16-pre: pure-форма «? Is Valid»; параметр Object (const UObject*)
- 16-utilities.txt :: W09: K2Node_CallFunction_349: IsValidClass: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_350: GetDisplayName: round22-pre: KSL::GetDisplayName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 16-utilities.txt :: W09: K2Node_CallFunction_351: GetObjectName: round22-pre: KSL::GetObjectName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 16-utilities.txt :: W09: K2Node_CallFunction_352: GetEngineVersion: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_353: GetPlatformName: round16-pre: живёт в GameplayStatics
- 16-utilities.txt :: W09: K2Node_CallFunction_354: GetGameTimeInSeconds: round16-pre: KismetSystemLibrary::GetGameTimeInSeconds → float
- 16-utilities.txt :: W09: K2Node_CallFunction_355: GetRealTimeSeconds: round16-pre: GetSystemTimeInSeconds не существует → GameplayStatics::GetRealTimeSeconds
- 16-utilities.txt :: W09: K2Node_CallFunction_356: GetWorldDeltaSeconds: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_357: QuitGame: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_358: OpenLevel: round16-pre: GameplayStatics::OpenLevel (by Name)
- 16-utilities.txt :: W09: K2Node_CallFunction_359: CreateSaveGameObject: round16-pre: GameplayStatics, exec
- 16-utilities.txt :: W09: K2Node_CallFunction_360: DoesSaveGameExist: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_361: SaveGameToSlot: round16-pre
- 16-utilities.txt :: W09: K2Node_CallFunction_362: LoadGameFromSlot: round16-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_364: GetPlayerController: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_365: GetPlayerPawn: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_366: GetPlayerCharacter: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_367: GetAllActorsOfClass: round17-pre: OutActors — Actor Array (container), ActorClass → Actor
- 17-gameplay.txt :: W09: K2Node_CallFunction_368: GetAllActorsWithTag: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_370: SpawnEmitterAtLocation: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_371: PlaySoundAtLocation: round17-pre: хвост (InitialParams) движок достроит сам
- 17-gameplay.txt :: W09: K2Node_CallFunction_372: GetGameMode: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_373: GetGameState: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_374: GetGameInstance: round17-pre
- 17-gameplay.txt :: W09: K2Node_CallFunction_375: GetCurrentLevelName: round17-pre: статического GetWorld в Kismet нет → заменён на GameplayStatics::GetCurrentLevelName
- 18-input.txt :: W09: K2Node_CallFunction_378: IsInputKeyDown: round18-pre: член APlayerController (UFUNCTION BlueprintCallable, const → pure). MemberParent=PlayerController, пин self (Target) типа PlayerController, Key по значению; round18: белая (copy-back tests/fixtures/input-r18-copyback.txt: InputKey=SpaceBar принят, self → «Target», Key dv None)
- 21-enhanced-input.txt :: W09: K2Node_CallFunction_389: GetBoundActionValue: round21: FAIL — вставилась пустой (член EnhancedInputComponent::GetBoundActionValue движок не принял). Значение действия в BP берут узлом «Get IA_X» (K2Node_GetInputActionValue, нужен ассет) — ждём copy-back. round21-pre: статического GetActionValue нет — член UEnhancedInputComponent::GetBoundActionValue(const UInputAction*) const → pure; self = EnhancedInputComponent, RV FInputActionValue. Узел «Get IA_X» (K2Node_GetInputActionValue) требует ассет InputAction — не для свипа
- 21-enhanced-input.txt :: W09: K2Node_CallFunction_392: AddMappingContext: round21b VERIFIED (движок, 2026-09-25): член IEnhancedInputSubsystemInterface; Options (FModifyContextOptions) опущен — движок достроит; self типизирован подсистемой
- 22-casting.txt :: W09: K2Node_CallFunction_398: GetObjectClass: round22-pre: UGameplayStatics::GetObjectClass (в меню «Get Class») | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_399: ClassIsChildOf: round22-pre: KML::ClassIsChildOf(TSubclassOf TestClass, TSubclassOf ParentClass) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_400: GetDisplayName: round22-pre: KSL::GetDisplayName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_401: GetObjectName: round22-pre: KSL::GetObjectName(const UObject*) | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_402: EqualEqual_ObjectObject: round22-pre: CallFunction (не PromotableOperator), заголовок «==» | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_403: NotEqual_ObjectObject: round22-pre: заголовок «!=» | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_404: EqualEqual_ClassClass: round22-pre: KML::EqualEqual_ClassClass | R22 VERIFIED (движок, 2026-09-25)
- 22-casting.txt :: W09: K2Node_CallFunction_405: Conv_ObjectToString: round22-pre: KSL(String)::Conv_ObjectToString(UObject* InObj) — компактный конвертер | R22 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_408: K2_GetActorLocation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_GetActorLocation const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_409: K2_GetActorRotation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_GetActorRotation const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_410: GetTransform: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). UFUNCTION GetTransform (DisplayName GetActorTransform) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_411: GetActorForwardVector: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_412: K2_SetActorLocation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_SetActorLocation(NewLocation,bSweep,out SweepHitResult,bTeleport) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_413: K2_SetActorRotation: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_SetActorRotation(NewRotation,bTeleportPhysics) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_414: K2_AddActorWorldOffset: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_AddActorWorldOffset | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_415: K2_DestroyActor: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_DestroyActor | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_416: SetActorHiddenInGame: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). SetActorHiddenInGame(bool) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_417: GetOwner: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). GetOwner const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_418: ActorHasTag: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). ActorHasTag(FName) const | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_419: GetComponentByClass: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). GetComponentByClass(TSubclassOf<UActorComponent>) const; DeterminesOutputType — RV перетипизируется по классу | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_420: K2_AttachToActor: round23-pre: член AActor, self=Target Actor (по образцу белого IsInputKeyDown). K2_AttachToActor; enum EAttachmentRule (KeepRelative/KeepWorld/SnapToTarget) | R23 VERIFIED (движок, 2026-09-25)
- 23-actor.txt :: W09: K2Node_CallFunction_421: GetActorRightVector: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_422: GetActorUpVector: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_423: GetActorScale3D: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_424: K2_AddActorWorldRotation: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_425: K2_AddActorLocalRotation: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_426: K2_AddActorLocalOffset: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_427: SetActorScale3D: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_428: K2_SetActorTransform: round23b-pre: член Actor (как R23). NewTransform const FTransform&
- 23-actor.txt :: W09: K2Node_CallFunction_429: K2_SetActorLocationAndRotation: round23b-pre: член Actor (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_430: K2_AttachToComponent: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_431: K2_DetachFromActor: round23b-pre: член Actor (как R23). EDetachmentRule (KeepRelative/KeepWorld)
- 23-actor.txt :: W09: K2Node_CallFunction_432: K2_AttachToComponent: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_433: K2_DetachFromComponent: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_434: K2_GetComponentLocation: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_435: K2_GetComponentRotation: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_436: K2_SetWorldLocation: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_437: K2_SetRelativeLocation: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_438: K2_SetRelativeRotation: round23b-pre: член SceneComponent (как R23).
- 23-actor.txt :: W09: K2Node_CallFunction_439: K2_AddLocalRotation: round23b-pre: член SceneComponent (как R23).
- 24-pawn-character.txt :: W09: K2Node_CallFunction_441: Jump: round24-pre: член Character, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_442: StopJumping: round24-pre: член Character, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_443: CanJump: round24-pre: член Character, self=Target (по образцу AActor-членов R23). CanJump() const BlueprintCallable → pure
- 24-pawn-character.txt :: W09: K2Node_CallFunction_444: LaunchCharacter: round24-pre: член Character, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_445: Crouch: round24-pre: член Character, self=Target (по образцу AActor-членов R23). bClientSimulation скрыт (HidePin)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_446: UnCrouch: round24-pre: член Character, self=Target (по образцу AActor-членов R23). bClientSimulation скрыт (HidePin)
- 24-pawn-character.txt :: W09: K2Node_CallFunction_447: AddMovementInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_448: AddControllerYawInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_449: AddControllerPitchInput: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_450: GetControlRotation: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_451: GetController: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). альтернатива Get Player Controller (self) — подсказка пользователя R21b
- 24-pawn-character.txt :: W09: K2Node_CallFunction_452: IsLocallyControlled: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_453: IsPlayerControlled: round24-pre: член Pawn, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_454: Possess: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_455: UnPossess: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). 
- 24-pawn-character.txt :: W09: K2Node_CallFunction_456: K2_GetPawn: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). K2_GetPawn const → pure, DisplayName Get Controlled Pawn
- 24-pawn-character.txt :: W09: K2Node_CallFunction_457: SetControlRotation: round24-pre: член Controller, self=Target (по образцу AActor-членов R23). NewRotation const FRotator& → const+ref
- 24-pawn-character.txt :: W09: K2Node_CallFunction_458: GetVelocity: round24-pre: член Actor, self=Target (по образцу AActor-членов R23). член AActor
