# Sweep manifest — полный прогон реестра по категориям

Дата: 2026-09-25; записей: 259; построено узлов: 258; упало: 1.
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
| 08 | 08-math-boolean.txt | 7/7 | 6 | 1 | — | — |
| 09 | 09-math-random.txt | 6/6 | 6 | 0 | — | — |
| 10 | 10-math-vector.txt | 29/29 | 18 | 10 | — | 10xW09 |
| 11 | 11-collision.txt | 26/26 | 11 | 16 | — | 15xW09 |
| 12 | 12-math-rotator.txt | 15/15 | 0 | 8 | — | 8xW09 |
| 13 | 13-math-transform.txt | 4/4 | 0 | 0 | — | — |
| 14 | 14-string.txt | 26/26 | 2 | 3 | — | 1xW09 |
| 15 | 15-array.txt | 15/15 | 0 | 0 | — | — |
| 16 | 16-utilities.txt | 19/19 | 2 | 2 | — | 2xW09 |
| 17 | 17-gameplay.txt | 12/12 | 0 | 4 | — | 4xW09 |
| 18 | 18-input.txt | 2/2 | 0 | 2 | — | 2xW09 |
| 19 | 19-organization.txt | 6/6 | 2 | 4 | — | 3xW03 |
| 20 | 20-text.txt | 1/1 | 0 | 1 | — | 1xW09 |
| 21 | 21-enhanced-input.txt | 0/1 | 0 | 1 | — | — |

## NEEDS-REFERENCE (не построилось — нужен copy-back из движка)

- 21-enhanced-input.txt :: Enhanced_GetActionValue (GetActionValue) — Unknown struct in registry: InputActionValue (Enhanced_GetActionValue.ReturnValue)

## STRICT-ошибки по файлам (наш валидатор; движок — арбитр)

Пусто.

## Варнинги по файлам (W09 = есть note в реестре, W07 = нет GraphGuid)

- 05-math-integer.txt :: W09: K2Node_CallFunction_165: Clamp: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_166: Max: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_167: Min: Int overload func name uncertain — verify in engine
- 10-math-vector.txt :: W09: K2Node_CallFunction_222: VSize2DSquared: round10: VSizeSquared2D не существует — канон VSize2DSquared, вход Vector2D (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_223: Vector_IsNormal: round10: Normal (Vector→Vector) не существует — канон Vector_IsNormal bool, A by ref (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_227: Vector_IsZero: round10: IsZero не существует — канон Vector_IsZero, A by ref (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_228: Vector_IsNearlyZero: round10: IsNearlyZero не существует — канон Vector_IsNearlyZero + Tolerance FLOAT 0.000100 (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_229: Vector_Distance: round10: Distance (A/B) не существует — канон Vector_Distance V1/V2 (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_230: Vector_DistanceSquared: round10: DistanceSquared (A/B) не существует — канон Vector_DistanceSquared V1/V2 (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_233: MakeVector: round10: MakeStruct-форма жёлтая — канон pure CallFunction MakeVector (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_234: BreakVector: round10: BreakStruct-форма жёлтая — канон pure CallFunction BreakVector InVec→X/Y/Z без ReturnValue (live-реф)
- 10-math-vector.txt :: W09: K2Node_CallFunction_239: Distance2D: round10: новый (live-реф); V1/V2 Vector2D без dv
- 10-math-vector.txt :: W09: K2Node_CallFunction_240: DistanceSquared2D: round10: новый (live-реф); V1/V2 Vector2D без dv
- 11-collision.txt :: W09: K2Node_CallFunction_247: BoxTraceSingle: live-ref 2026-09-25 (BP_WheelActor): полный пин-лист; HalfSize bIsConst=True — в Single констный, в Multi нет (причуда движка, copy-back O1 подтверждает)
- 11-collision.txt :: W09: K2Node_CallFunction_254: LineTraceMultiByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов LineTraceSingleByProfile)
- 11-collision.txt :: W09: K2Node_CallFunction_255: LineTraceMultiForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов LineTraceSingleForObjects)
- 11-collision.txt :: W09: K2Node_CallFunction_256: SphereTraceSingleByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов SphereTraceSingle)
- 11-collision.txt :: W09: K2Node_CallFunction_257: SphereTraceMultiByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов SphereTraceMulti)
- 11-collision.txt :: W09: K2Node_CallFunction_258: SphereTraceSingleForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов SphereTraceSingle)
- 11-collision.txt :: W09: K2Node_CallFunction_259: SphereTraceMultiForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов SphereTraceMulti)
- 11-collision.txt :: W09: K2Node_CallFunction_260: BoxTraceSingleByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов BoxTraceByChannel)
- 11-collision.txt :: W09: K2Node_CallFunction_261: BoxTraceMultiByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов BoxTraceMulti)
- 11-collision.txt :: W09: K2Node_CallFunction_262: BoxTraceSingleForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов BoxTraceByChannel)
- 11-collision.txt :: W09: K2Node_CallFunction_263: BoxTraceMultiForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов BoxTraceMulti)
- 11-collision.txt :: W09: K2Node_CallFunction_264: CapsuleTraceSingleByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов CapsuleTraceSingle)
- 11-collision.txt :: W09: K2Node_CallFunction_265: CapsuleTraceMultiByProfile: round11: новый (матрица 24 кастов; собран из белых шаблонов CapsuleTraceMulti)
- 11-collision.txt :: W09: K2Node_CallFunction_266: CapsuleTraceSingleForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов CapsuleTraceSingle)
- 11-collision.txt :: W09: K2Node_CallFunction_267: CapsuleTraceMultiForObjects: round11: новый (матрица 24 кастов; собран из белых шаблонов CapsuleTraceMulti)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_269: MakeRotator: round12-pre: MakeStruct-форма у FRotator (HasNativeMake) по аналогии с Vector жёлтая — канон pure MakeRotator Roll/Pitch/Yaw float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_270: BreakRotator: round12-pre: BreakStruct-форма по аналогии с Vector жёлтая — канон pure BreakRotator InRot→Roll/Pitch/Yaw
- 12-math-rotator.txt :: W09: K2Node_CallFunction_276: NormalizedDeltaRotator: round12-pre: FindLookAtRotation2D в KismetMathLibrary нет — заменена на NormalizedDeltaRotator
- 12-math-rotator.txt :: W09: K2Node_CallFunction_278: NegateRotator: round12-pre: InverseTransformRotation — это Transform-функция; канон инверсии NegateRotator (Invert Rotator)
- 12-math-rotator.txt :: W09: K2Node_CallFunction_279: RLerp: round12-pre: добавлен пин bShortestPath, Alpha float
- 12-math-rotator.txt :: W09: K2Node_CallFunction_281: GetForwardVector: round12-pre: новая запись, не проверена движком
- 12-math-rotator.txt :: W09: K2Node_CallFunction_282: GetRightVector: round12-pre: новая запись, не проверена движком
- 12-math-rotator.txt :: W09: K2Node_CallFunction_283: GetUpVector: round12-pre: новая запись, не проверена движком
- 14-string.txt :: W09: K2Node_CallFunction_298: ParseIntoArray: Array/Set/Map output needs ContainerType support in generator — verify in engine
- 16-utilities.txt :: W09: K2Node_CallFunction_343: GetGameTimeInSeconds: Home library uncertain (KismetSystemLibrary vs GameplayStatics)
- 16-utilities.txt :: W09: K2Node_CallFunction_345: GetWorldDeltaSeconds: Home library uncertain (KismetSystemLibrary vs GameplayStatics)
- 17-gameplay.txt :: W09: K2Node_CallFunction_356: GetAllActorsOfClass: Array/Set/Map output needs ContainerType support in generator — verify in engine
- 17-gameplay.txt :: W09: K2Node_CallFunction_357: GetAllActorsWithTag: Array/Set/Map output needs ContainerType support in generator — verify in engine
- 17-gameplay.txt :: W09: K2Node_CallFunction_358: BeginSpawningActorFromClass: Engine node is K2Node_SpawnActorFromClass; this CallFunction BeginSpawningActorFromClass form is untested
- 17-gameplay.txt :: W09: K2Node_CallFunction_364: GetWorld: No static GetWorld in Kismet libs — member call needs Self/BP-class context
- 18-input.txt :: W09: K2Node_CallFunction_366: GetKey: Function not found as Kismet static — verify in engine before use
- 18-input.txt :: W09: K2Node_CallFunction_367: IsInputKeyDown: Member of PlayerController — needs Self context; static form untested
- 19-organization.txt :: W03: K2Node_MakeArray_371: K2Node_MakeArray требует ContainerType — текст может не вставиться; проверь в движке
- 19-organization.txt :: W03: K2Node_MakeSet_372: K2Node_MakeSet требует ContainerType — текст может не вставиться; проверь в движке
- 19-organization.txt :: W03: K2Node_MakeMap_373: K2Node_MakeMap требует ContainerType — текст может не вставиться; проверь в движке
- 20-text.txt :: W09: K2Node_CallFunction_376: Format: Returns FText (KismetTextLibrary::Format) — verify pin categories in engine
