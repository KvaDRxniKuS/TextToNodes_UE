# Sweep manifest — полный прогон реестра по категориям

Дата: 2026-09-25; записей: 239; построено узлов: 238; упало: 1.
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
| 01 | 01-flow-control.txt | 14/14 | 14 | 1 | — | — |
| 02 | 02-variables.txt | 4/4 | 4 | 0 | — | — |
| 03 | 03-math-float.txt | 30/30 | 30 | 0 | — | 2xW09 |
| 04 | 04-math-interpolation.txt | 7/7 | 7 | 0 | — | — |
| 05 | 05-math-integer.txt | 9/9 | 0 | 3 | — | 3xW09 |
| 06 | 06-math-trig.txt | 17/17 | 0 | 0 | — | — |
| 07 | 07-math-comparison.txt | 8/8 | 1 | 0 | — | — |
| 08 | 08-math-boolean.txt | 7/7 | 0 | 4 | — | — |
| 09 | 09-math-random.txt | 6/6 | 0 | 0 | — | — |
| 10 | 10-math-vector.txt | 27/27 | 2 | 0 | — | — |
| 11 | 11-collision.txt | 12/12 | 12 | 2 | — | 1xW09 |
| 12 | 12-math-rotator.txt | 12/12 | 0 | 2 | — | — |
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

- 03-math-float.txt :: W09: K2Node_CallFunction_144: Max: Int overload func name uncertain — verify in engine
- 03-math-float.txt :: W09: K2Node_CallFunction_145: Min: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_165: Clamp: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_166: Max: Int overload func name uncertain — verify in engine
- 05-math-integer.txt :: W09: K2Node_CallFunction_167: Min: Int overload func name uncertain — verify in engine
- 11-collision.txt :: W09: K2Node_CallFunction_244: BoxTraceSingle: live-ref 2026-09-25 (BP_WheelActor): полный пин-лист; HalfSize bIsConst=True — в Single констный, в Multi нет (причуда движка, copy-back O1 подтверждает)
- 14-string.txt :: W09: K2Node_CallFunction_278: ParseIntoArray: Array/Set/Map output needs ContainerType support in generator — verify in engine
- 16-utilities.txt :: W09: K2Node_CallFunction_323: GetGameTimeInSeconds: Home library uncertain (KismetSystemLibrary vs GameplayStatics)
- 16-utilities.txt :: W09: K2Node_CallFunction_325: GetWorldDeltaSeconds: Home library uncertain (KismetSystemLibrary vs GameplayStatics)
- 17-gameplay.txt :: W09: K2Node_CallFunction_336: GetAllActorsOfClass: Array/Set/Map output needs ContainerType support in generator — verify in engine
- 17-gameplay.txt :: W09: K2Node_CallFunction_337: GetAllActorsWithTag: Array/Set/Map output needs ContainerType support in generator — verify in engine
- 17-gameplay.txt :: W09: K2Node_CallFunction_338: BeginSpawningActorFromClass: Engine node is K2Node_SpawnActorFromClass; this CallFunction BeginSpawningActorFromClass form is untested
- 17-gameplay.txt :: W09: K2Node_CallFunction_344: GetWorld: No static GetWorld in Kismet libs — member call needs Self/BP-class context
- 18-input.txt :: W09: K2Node_CallFunction_346: GetKey: Function not found as Kismet static — verify in engine before use
- 18-input.txt :: W09: K2Node_CallFunction_347: IsInputKeyDown: Member of PlayerController — needs Self context; static form untested
- 19-organization.txt :: W03: K2Node_MakeArray_351: K2Node_MakeArray требует ContainerType — текст может не вставиться; проверь в движке
- 19-organization.txt :: W03: K2Node_MakeSet_352: K2Node_MakeSet требует ContainerType — текст может не вставиться; проверь в движке
- 19-organization.txt :: W03: K2Node_MakeMap_353: K2Node_MakeMap требует ContainerType — текст может не вставиться; проверь в движке
- 20-text.txt :: W09: K2Node_CallFunction_356: Format: Returns FText (KismetTextLibrary::Format) — verify pin categories in engine
