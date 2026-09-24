# Engine-verified: что реально вставляется в UE

Метод проверки: сгенерированный текст вставляется в Unreal Editor через `Ctrl+V`
в EventGraph → граф копируется обратно `Ctrl+C` → сверка «что ушло / что вернулось».
Расхождения = баги формата. Все найденные баги исправлены в этом репозитории
(реестр, генератор, парсер, промпт, валидатор) и покрыты строгой проверкой
`node src/validate.js`.

## v1: стресс-тест 26 нод → вердикт движка

| Нода | Ушло | Вернулось | Вывод |
|---|---|---|---|
| Sequence, SwitchInt, Print, Concat, Conv, VSize, Greater, Branch, Knot, Comment | ок | ок | формат базовых нод верный |
| K2Node_Event ReceiveBeginPlay | K2Node_Event | сломанный custom event | **K2Node_Event запрещён** — вставлять только в граф с существующим эвентом |
| Delay | выход `Completed` | провод оторван | выход Delay обязан называться **`then`** |
| MakeVector (CallFunction) | `ReturnValue` | пин переименован в `Vector` | Make/Break — только **`K2Node_MakeStruct`/`BreakStruct`** + `StructType`, выход = имя структуры |
| LineTraceByChannel | CallFunction + короткие пути | **нода пропала целиком** | короткие пути структур/библиотек не годятся |
| ForLoop (K2Node_ForLoop) | K2Node_ForLoop | нода-пустышка | такого K2Node **нет** — только **`K2Node_MacroInstance`** |
| VarGet/VarSet | ок | ок | VariableReference с bSelfContext верный |

## v2: фиксы + полные пути → вердикт движка

| Проверка | Результат |
|---|---|
| Delay с выходом `then` | ✅ вставился чисто |
| MakeStruct + `StructType=/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Vector'` + выход `Vector` | ✅ чисто, связи Make→Knot→VSize живые |
| LineTraceByChannel даже с полными путями | ❌ **снова пропал** — дело не только в путях |
| ForLoop как MacroInstance + `MacroGraphReference` + GraphGuid | ✅ чисто |
| `Knot_43.OutputPin → Branch_42.execute` | ⚠️ провод пропал: у вставленного `Branch_42.execute` оказался **перегенерированный PinId** |

### Аномалия Branch_42 (важно для генератора)

Один пин движок пересоздал (новый PinId), из-за чего порвалась одна связь,
остальные 26 связей уцелели. Подозрение: malformed-строка пина
(невалидный/нулевой `PersistentGuid` и т.п.). Выводы, заложенные в код:

- `PersistentGuid` **не генерируем вообще** (минимальный формат движок принимает чисто);
- валидатор требует `PinId`/`NodeGuid` строго 32-HEX, уникальность, двусторонность связей;
- каждый `CustomProperties Pin` обязан содержать `PinId=` и `PinName=`.

### Ensure про StaticMesh — НЕ относится к тулкиту

`Ensure: KnownStaticMesh != StaticMesh ... BP_WheelActor/...Disk` — это шум
проектного актора (компонент меша в transient-мире при компиляции/PIE),
к вставленным текстовым нодам отношения не имеет.

## Правила, выведенные из тестов (закреплены в коде)

1. `FunctionReference` библиотечных функций — всегда с полным `MemberParent`
   (`/Script/CoreUObject.Class'/Script/Engine.KismetMathLibrary'` и т.д., поле `lib` реестра).
   `bSelfContext=True` — только для методов самого блюпринта.
2. Struct-пины — всегда с полным `PinSubCategoryObject` (`ScriptStruct'...'`).
3. Make/Break структур — `K2Node_MakeStruct`/`BreakStruct` + `StructType`, выход Make = имя структуры.
4. ForLoop, WhileLoop, Gate, DoOnce, FlipFlop, DoN, ForLoopWithBreak — только
   `K2Node_MacroInstance` + `MacroGraphReference` (имя/_guid из поля `macro` реестра).
5. Delay: выход `then`. PrintString: `bPrintToScreen`/`bPrintToLog`. Switch: case-пины + `Default`.
6. `K2Node_Event`, `K2Node_ForLoop/WhileLoop/Gate/DoOnceMultiInput/FlipFlop/DoN` — запрещены.
7. `DefaultValue="..."` — для пинов со значением (Selection, TraceChannel, флаги).
8. Перед выдачей — `node src/validate.js`, ноль ошибок.

## Проверено вставкой (реестр `verified: true`, 18 шт.)

Branch, Sequence, Sequence3, SwitchInt, Delay, PrintString, Concat_StrStr,
Conv_IntToString, VSize, Greater_Float, ForLoop, MakeVector,
VarGet, VarSet, VarGetBool, VarGetVector, Reroute, Comment.

Всё остальное в реестре — `verified: false`: класс/функция правдоподобны,
но вставка не подтверждена. Спорные места помечены полем `note`.

## v3: «cannot be pasted in this graph» — неверные пути структур

Симптом: движок отклоняет вставку нод со struct-пинами целиком.
Причина: пути `...ScriptStruct'/Script/CoreUObject.Vector'` (и Rotator/Transform/Vector2D/LinearColor)
**не существуют** — Core-структуры живут в модуле Core, пакет `/Script/Core`.
Правильно: `/Script/CoreUObject.ScriptStruct'/Script/Core.Vector'`.
Выводы: v1-падение LineTrace — bSelfContext без MemberParent; v2-падение — неверный путь Vector.
Попутно из реального дампа движка: `ExportPath` пишется в формате
`ExportPath=/Script/....X'"/Game/...."'` (генераторы поправлены);
`PinFriendlyName` движок хранит как NSLOCTEXT — мы его не генерируем вообще.
Валидатор: struct-пин с `None` — варнинг W10 (движок восстановит по сигнатуре);
битый/неизвестный путь — E14/W10.

## v4: короткая clipboard-форма ссылок (A2/D2/E дропнуты целиком — 2026-09-25)

Ретест A2/D2/E: функция не вставилась ни в одном варианте, **комментарий вставился**.
Copy-back комментария из UE показал `ExportPath="..."` **в двойных кавычках**.
Диагноз: полная текстовая форма (`/Script/CoreUObject.Class'...'`,
`/Script/CoreUObject.ScriptStruct'...'`) — это формат asset-дампов, а буфер обмена
требует **короткую форму**: `MemberParent=Class'"/Script/Engine.KismetSystemLibrary"'`
(без внешних кавычек!), `PinSubCategoryObject=ScriptStruct'"/Script/Core.Vector"'`,
`StructType=ScriptStruct'"/Script/..."'`, `MacroGraph=EdGraph'"/Engine/..."'`,
`GraphBlueprint=Blueprint'"/Engine/..."'`. Комментарий выжил именно потому, что в нём
нет ссылок. Валидатор: полная форма теперь варнинг W11; генераторы переведены на короткую форму.

## v5: каноника UE4 из copy-back (G1/H1 вставились — 2026-09-25)

Диагностика F1/G1/H1/F4: **G1 (Branch) и H1 (PrintString) вставились**, F1 (без пинов)
и F4 (UE4-short Vector) — нет. Движок пользователя — **UE4** (доказательство:
`/Script/CoreUObject.LinearColor` в TextColor). **[v6-поправка: движок — UE 5.8.0-55116800, пакет CoreUObject есть и в UE5 — UE4-критерий v5 был неверным; формат quoted-full подтверждён: именно так пишет UE 5.8.]** Copy-back дал ground truth:
- UE4 пишет ссылки В КАВЫЧКАХ, ПОЛНОЙ формой, БЕЗ внутренних двойных кавычек:
  `MemberParent="/Script/CoreUObject.Class'/Script/Engine.KismetSystemLibrary'"`
  (короткую форму на входе тоже принимает — H1 вставился с короткой!),
  `SubCategoryObject="/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.LinearColor'"`,
  WCO: `SubCategoryObject="/Script/CoreUObject.Class'/Script/CoreUObject.Object'"`
  + `bIsConst=True` + `bHidden=True`.
- Struct-пины: `PinSubCategory=""` (ПУСТО — главный подозреваемый в убийствах A3–F4!),
  имя типа — только из SubCategoryObject.
- Движок САМ добавляет: недостающие пины сигнатуры (H1: 3 → 10!),
  `PersistentGuid=0000...`, `PinFriendlyName=NSLOCTEXT`,
  `DefaultValue/AutogeneratedDefaultValue`, `AdvancedPinDisplay=Hidden`,
  self-пин с `DefaultObject`.
- NodeGuid движок ПЕРЕГЕНЕРИРУЕТ, PinId — сохраняет.
- UE4 vs UE5: пакеты Core-структур (`/Script/CoreUObject.*` vs `/Script/Core.*`)
  и стиль ссылок различаются → UE_VERSION в src/ue-types.js (дефолт UE4; UE5 не проверен).
- J-серия: J1 минимальный LineTrace; J2 +WCO-наш; J2b +WCO-каноника; J3a структуры None+"";
  J3b структуры каноника; J3c SubCategory="Vector"+каноника (тест яда); J4 энам;
  J5 real/double; J6 MakeVector; J7 ForLoop.
- НЕ ПРОВЕРЕНО: VariableGet/Set (self-пин), pure-функции (bIsPureFunc), массивы в пинах.

## Открытые вопросы (нужен движок)

1. ~~**LineTraceByChannel пропадает.**~~ **РЕШЕНО в v6:** имя функции не существовало;
   настоящий узел — `LineTraceSingle` (copy-back UE 5.8 в реестре, verified:true).
   Ретест: K1 (полный) / K2 (минимальный).
2. **Multi-трейсы и ByProfile** (`LineTraceMulti`, `SphereTraceMulti`, `BoxTraceMulti`,
   `CapsuleTraceMulti`, `LineTraceSingleByProfile`): OutHits — массив-аутпут,
   форма не наблюдалась. Нужен copy-back хотя бы одного.
3. **Siblings-ренеймы** (`Sphere/Box/CapsuleTraceSingle`, `LineTraceSingleForObjects`):
   имена выведены по Single-паттерну, вставка не подтверждена.
4. **Pure-функции** (bIsPureFunc), **VarGet/VarSet self-пин** — не проверены.
5. **SHORT-форма ссылок** (legacy) — вставкой не проверена ни на одном движке.

## v6: движок — UE 5.8.0, киллер J1–J4 — имя функции (2026-09-25)

Матрица J-серии: **0/7 трейсов, 3/3 нетрейсов** (J5 PrintString, J6 MakeVector,
J7 ForLoop вставились; комментарии 10/10). Дифференциальный диагноз:
J1 (минимум) = J4 (энам), J2 (WCO None) = J2b (WCO каноника),
J3a = J3b = J3c (структуры) — все упали одинаково, а J5 с тем же
MemberParent/классом/генератором выжил → убийца уровня узла, не пинов:
**MemberName="LineTraceByChannel" не существует**. Настоящий узел
«Line Trace By Channel» = **MemberName="LineTraceSingle"**
(ручной copy-back + внешний дамп пасты).

Ground truth из copy-back LineTraceSingle (16 пинов, UE 5.8):
- Struct-входы (Start/End) — bIsConst=True, DefaultValue="0, 0, 0";
- TraceChannel — byte + "/Script/CoreUObject.Enum'/Script/Engine.ETraceTypeQuery'",
  DefaultValue="TraceTypeQuery1" (без Autogenerated);
- ActorsToIgnore — object Actor + ContainerType=Array + bIsReference=True +
  bIsConst=True + bDefaultValueIsIgnored=True, без DefaultValue;
- DrawDebugType — новый энам "/Script/CoreUObject.Enum'/Script/Engine.EDrawDebugTrace'";
- OutHit — struct HitResult, output, bIsReference=False;
- TraceColor/TraceHitColor/DrawTime — bAdvancedView=True; DrawTime real/float;
- ReturnValue (bool, output) несёт DefaultValue="false";
- self-пин движок добавляет сам (с DefaultObject) — не генерируем.
Движок чинит несовпавшие пины по сигнатуре, не роняя узел (J5: Duration
double→float) — второе доказательство, что J1 убило имя функции.

Бонусные copy-back: IfThenElse (Condition default "true", NSLOCTEXT then/else),
ExecutionSequence (then_0/then_1), Knot (wildcard + InputPin ignored),
ForEachLoop (MacroGuid 99DBFD5540A796041F72A5A9DA655026, пины
Exec/Array(wildcard+Array)/LoopBody/Array Element/Array Index/Completed),
J6 StructType quoted-full + ShowPinForProperties + X/Y/Z real/double.
Реестр: ForLoop FirstIndex/LastIndex без пробелов, Reroute wildcard,
PrintString/Branch полные сигнатуры.

K-серия (генератор tools/gen-k-series.mjs): K1 LineTraceSingle полный
(15 пинов), K2 LineTraceSingle минимальный (engine-completion),
K3 control-flow (Branch+Sequence+Knot+ForEachLoop).
