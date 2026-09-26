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
2. ~~**Multi-трейсы** (`LineTraceMulti`, `SphereTraceMulti`, `BoxTraceMulti`, `CapsuleTraceMulti`): OutHits — массив-аутпут, форма не наблюдалась.~~ **РЕШЕНО (copy-back CapsuleTraceMulti):** OutHits = struct HitResult + ContainerType=Array, без ref/const; Radius/HalfHeight float+0.0 после End. Добито: **ByProfile** = LineTraceSingle с ProfileName(name, «None») вместо TraceChannel (copy-back _118) — Q2 закрыт полностью.
3. **Siblings-ренеймы** (`Sphere/Box/CapsuleTraceSingle`, `LineTraceSingleForObjects`):
   имена выведены по Single-паттерну (Multi-суффикс подтверждён Q2; на тесте: O1/O2).
4. ~~**Pure-функции** (bIsPureFunc)~~ **ЧАСТИЧНО РЕШЕНО (Q6):** pure CallFunction = `bDefaultsToPureFunc=True`, без exec-пинов (BreakHitResult, verified:true). Осталось: **VarGet/VarSet self-пин** — не проверен.
5. **SHORT-форма ссылок** (legacy) — вставкой не проверена ни на одном движке.
6. ~~**Выходы BreakHitResult** — движок их сам НЕ достраивает.~~ **РЕШЕНО:** настоящий «Break Hit Result» = pure `GameplayStatics.BreakHitResult` (self + Hit + 18 выходов, copy-back BP_WheelActor); K2Node_BreakStruct выходы НЕ строит никогда (подтверждено живым графом).

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

## K-серия: 3/3 вставились, round-trip побайтовый (2026-09-25)

| Вариант | Ушло | Вернулось | Вывод |
|---|---|---|---|
| K1 LineTraceSingle полный | 15 пинов | 15/15 PinId сохранены + self добавлен (16) | эмиссия 1-в-1 с движком |
| K2 LineTraceSingle минимум | 3 пина | 3/3 сохранены, достроен до 16 | engine-completion работает |
| K3 Branch+Sequence+Knot+ForEachLoop | 4 ноды | 4/4, все PinId сохранены | control-flow + макрос верны |

Итого: **33/33 PinId сохранены**. NodeGuid движок перегенерирует ВСЕГДА
(все ноды + комментарии), имена нод сохраняет. ExportPath переписывает
под целевой ассет, позиции сдвигает на offset вставки.
Движок добавляет: self-пин с DefaultObject, PinToolTip, PersistentGuid=0000...,
AutogeneratedDefaultValue (= наш DefaultValue — все дефолты совпали!),
AdvancedPinDisplay=Hidden, NSLOCTEXT-friendly. Enum-пины Autogenerated не несут.
Порядок пинов K2-достройки = порядку реестра (сигнатуре).
Комментарий: NodeWidth=400 движок не сериализует обратно (дефолт?), NodeHeight=180 —
да; на вставку не влияет, форму не меняем.
Фикстура: tests/fixtures/k1-copyback.txt — реальный текст движка в тестах.

## L-серия (план): связи — exec, data, Knot, OutHit→Break (2026-09-25)

L1: exec-цепочка Sequence→PrintString(мин)→Delay (2 провода).
L2: data MakeVector.Vector→Knot→BreakVector.Vector + BreakVector.X→Delay.Duration (3 провода).
L3: OutHit→BreakHitResult, полный и минимальный трейд (дифференциал: съедает ли
engine-completion связи). BreakHitResult в реестре минимальный (только вход HitResult,
verified:false) — L3 покажет, достраивает ли движок выходы struct-нод.
Генератор: tools/gen-l-series.mjs. Все L: STRICT-OK, 0 варнингов.


## L-результаты: все 7 связей живые (2026-09-25)

| Вариант | Провода | Результат |
|---|---|---|
| L1 exec Sequence→Print→Delay | 2/2 | оба живы; Print 3→10 пинов; Delay.Duration double→float, движок добавил дефолт 0.2 + self/WCO/LatentInfo; пин Delay.then движок показывает как «Completed», имя пина — всё равно `then` |
| L2 data+knot | 3/3 | Make→Knot→Break живы; Knot wildcard→Vector разрешился; X(double)→Duration(float) — несовпадение типов провод НЕ убило; BreakVector.Vector = ref+const; MakeVector движок переупорядочил (Vector первым) + ShowPinForProperties |
| L3 OutHit→Break | 2/2 | оба живы, включая минимальный трейд (4→16 пинов) — engine-completion связи НЕ ест; BreakHitResult выходы сам НЕ построил (остался 1 пин) → вопрос Q6 |

Зафиксировано в коде: Delay.Duration = float + дефолт 0.2; входы Break-нод =
ref+const; LatentActionInfo в пуле структур; Knot wildcard = валидный клей;
sub-несовпадение и автодополнение проводам не вредят.
Раскладка: fitComment() в src/generator.js — коммент-боксы теперь считаются
по граням нод (было 400×180 мимо), gen-k/l-серии переведены на него.


## Q6 resolved: «Break Hit Result» = pure-функция (2026-09-25)

Copy-back из живого графа (BP_WheelActor): пункт палитры «Break Hit Result» — это
K2Node_CallFunction `GameplayStatics.BreakHitResult` с `bDefaultsToPureFunc=True`,
БЕЗ exec-пинов: self(hidden, DefaultObject) + Hit(struct HitResult, ref+const+ignored)
+ 18 выходов (bBlockingHit, bInitialOverlap, Time/Distance float, Location/ImpactPoint/
Normal/ImpactNormal/TraceStart/TraceEnd Vector, PhysMat/HitActor/HitComponent,
HitBoneName/BoneName dv "None", HitItem/ElementIndex/FaceIndex; 16 advanced).
Реестр: BreakHitResult_pure (verified:true, 19 пинов без self).
Эмиттер: regEntry.pure → `bDefaultsToPureFunc=True` перед FunctionReference
(src/generator.js + src/parser.js + index.html genBlock/createFromReg + парсинг обратно).
K2Node_BreakStruct_112 в том же графе — 1 пин: struct-нода выходы НЕ строит никогда.
Бонусы: первый name-пин (dv "None"); PhysMat из /Script/PhysicsCore (новый модуль в путях);
AdvancedPinDisplay=Shown = ручное раскрытие юзером (не эмитим — дефолт движка).
M1 (tools/gen-m-series.mjs): трейд + OutHit→Hit round-trip. Фикстура:
tests/fixtures/breakhitresult-copyback.txt (фрагмент: 2×E06 на вневыборочный _111).
Q4 частично закрыт (pure CallFunction), остался VarGet/VarSet self-пин.


## M1: pure round-trip 34/34 PinId, провод жив (2026-09-25)

Вставка M1 (трейд 15 пинов + pure BreakHitResult 19 пинов + OutHit→Hit): вернулись
все 34 PinId, движок добавил только self (трейд 15→16, pure 19→20), провод
двусторонний. Позиция self: у exec-ноды — третий (после execute/then), у pure-ноды —
первый. Имена нод сохранены, NodeGuid перегенерированы.
Уточнение K-примечания про комменты: дефолтный размер движок опускает, нестандартный
(700×698 от fitComment) сериализует обратно — fitComment round-trip-safe.
Pure-нода вернулась с AdvancedPinDisplay=Shown (трейд — Hidden): либо дефолт движка
для pure, либо раскрытие перед копипастом — на вставку не влияет, не эмитим.
Любопытное: тултип Normal в M1 полный («for a sphere trace this points towards...»),
в Q6-фикстуре (_105) — усечённый вариант; тултипы engine-managed, не эмитим.
Фикстура: tests/fixtures/m1-copyback.txt (STRICT-OK, 0 варнингов).


## Q2 resolved: OutHits = struct-массив без ref/const (2026-09-25)

Copy-back CapsuleTraceMulti (живой граф BP_WheelActor, 18 пинов с self): OutHits —
struct HitResult + ContainerType=Array, bIsReference=False, bIsConst=False (в отличие
от входного ActorsToIgnore: ref+const+ignored). Radius/HalfHeight — real/float dv "0.0",
позиция строго после End, перед TraceChannel. Остальной порядок пинов 1-в-1 с
LineTraceSingle. ReturnValue-тултип — Multi-вариант («blocking hit»), пин тот же.
Довески: ForEachLoop в связке резолвнул wildcard (Array→struct HitResult Array,
Array Element→struct HitResult — как Knot в L2); GraphGuid 99DBFD55 подтверждён;
pure BreakHitResult на Array Element — третий Shown подряд (Shown = раскрытие юзером
перед копипастом, не дефолт движка); тултип Normal снова полный (Q6 _105 был усечён).
Реестр: 238 (+CapsuleTraceMulti verified, +Line/Sphere/BoxTraceMulti verified:false;
singles Radius/HalfHeight → float+0.0). N1 (tools/gen-n-series.mjs): multi→foreach→break,
предсказание — движок резолвнет wildcard-макро при вставке с проводами.
Фикстура: tests/fixtures/capsuletracemulti-copyback.txt (0 ошибок, 0 варнингов).


## N1: предсказание сошлось — 42/42 PinId, wildcard-макро резолвнут (2026-09-25)

Вставка N1 (CapsuleTraceMulti 17 + ForEachLoop-wildcard 6 + pure Break 19, 3 провода):
вернулись все 42 PinId, движок добавил только 2 self (17→18, 19→20), все 3 провода
двусторонние. ForEachLoop при вставке с проводами резолвнул wildcard в struct HitResult
(Array — массив, Element — одиночный): генерация wildcard-нод с проводами доказана.
Новое: свежая вставка возвращается БЕЗ PinToolTip (движок кеширует тултипы позже —
стресс-подтверждение «тултипы не эмитим»); pure-нода без раскрытия вернулась
Hidden — дефолт AdvancedPinDisplay=Hidden доказан, Shown = раскрытие юзером.
Фикстура: tests/fixtures/n1-copyback.txt (0 ошибок, 0 варнингов).

## Раскладка: pin-aware выравнивание (N1+)

`linkPins` после соединения сдвигает целевой узел по Y так, чтобы строки пинов
совпали: Δ = (видимыйИндексFrom − видимыйИндексTo) × 22px (скрытые пины места не
занимают). Несколько линков в узел — побеждает последний (data-линки обычно идут
после exec и забирают выравнивание). Exec→exec не двигает — цепочки остаются в ряд.
Отказ: `linkPins(a, pa, b, pb, { align: false })`. X не трогаем (фиксированный ряд),
пересечений не разруливаем — это уровень «аккуратно», не «идеально».
Эффект на сериях: L1 плоский ряд; L2/M1/N1/L3 — data-провода горизонтальные
(N1: макро +198, pure +264). fitComment переиспользует тот же шаг PIN_ROW_H.
X-ряд тоже стал умным (O-фидбек про наложения при Δ320): `layoutRow` ставит ноды
по оценке ширины `estNodeWidth` (база по классу + длинные имена видимых пинов,
кап 480) с зазором ROW_GAP=120; fitComment считает правый край через estNodeWidth.
Вызывать до linkPins (выравнивание двигает только Y).


## Q2-done: LineTraceMulti 1:1 + ByProfile (2026-09-25)

Двойной copy-back (_117 + _118): наша Q2-аналогия LineTraceMulti сошлась с движком
ПОЛНОСТЬЮ 1-в-1 (15 пинов: имена, порядок, категории, сабы, дефолты, контейнеры,
флаги — программная сверка MATCH) → verified:true. Методология «аналогия по семейству»
доказана предсказанием.
LineTraceSingleByProfile = LineTraceSingle с заменой TraceChannel → ProfileName
(name-пин, dv "None", та же позиция; первый name-ВХОД). OutHit одиночный.
Реестр: 239 (+LineTraceSingleByProfile verified). O-серия (tools/gen-o-series.mjs):
O1 = Sphere/BoxTraceMulti полные предсказания; O2 = Single-заготовки + ForObjects
(completion-тест: движок достроит сигнатуры и форму ObjectTypes).
Тултипы снова варьируют между функциями (TraceChannel/OutHits тексты отличаются от
Single/Capsule) — engine-managed, игнорируем. Фикстура:
tests/fixtures/linetracemulti-byprofile-copyback.txt (0/0, без связей).


## O1/O2: трейды добиты — 5/5 verified, раскладка без наложений (2026-09-25)

Двойной copy-back O1+O2 (Sphere/BoxTraceMulti + Sphere/CapsuleTraceSingle +
LineTraceSingleForObjects):
- SphereTraceMulti: предсказание сошлось 1:1 (16 пинов) — вторая подтверждённая
  аналогия после LineTraceMulti → verified.
- BoxTraceMulti: аналогия почти сошлась, но движок вернул 17-й пин Orientation
  (struct Rotator, const, «0, 0, 0», сразу после HalfSize) + дефолт «0, 0, 0» у
  HalfSize (не-const!). Первое расхождение аналогии — модель поправлена по движку.
- O2-заготовки движок достроил до полных форм: Sphere/CapsuleSingle = LineTraceSingle
  + Radius (+ HalfHeight) после End, OutHit одиночный; sketch-id переименованы
  в func-имена (SphereTraceSingle, CapsuleTraceSingle, LineTraceSingleForObjects).
- ObjectTypes = byte + EObjectTypeQuery (новый энам в словаре) + Array + ref + const
  + ignored + DefaultValue «ObjectTypeQuery1» (дефолт ПРИ ignored — как в движке).
Все 5 — программная сверка MATCH 1:1. Реестр: 239 (переименования без новых записей).
Фикстуры: tests/fixtures/sphereboxtracemulti-copyback.txt (0/0),
tests/fixtures/tracesingle-forobjects-copyback.txt (0/0; тултипы только у SphereSingle —
движок закешировал их позже, свежая вставка без тултипов подтверждается снова).
Фидбек по раскладке: ряд Δ320 перекрывал широкие ноды → layoutRow: оценка ширины
по классу + именам пинов (трейды 400px) + зазор 120; fitComment накрывает по правым
краям. Все серии переведены на layoutRow, O1/O2 перегенерированы (0 варнингов).


## Sweep: полный прогон реестра по категориям (2026-09-25)

Вместо поштучных референсов — bulk-протокол: tools/gen-sweep.mjs строит ВСЕ записи
реестра через новый диспетчер createFromEntry (+ createGeneric для Switch/Variable/
Make-узлов/Select), раскладывает сеткой по 5 в ряд и пишет 21 файл sweep/NN-*.txt
с накрывающим комментом + sweep/MANIFEST.md (таблица, NEEDS-REFERENCE, strict-статусы).
Первый прогон: 238/239, 0 strict-ошибок; упал только Enhanced_GetActionValue
(InputActionValue вне FULL-словаря — первый кандидат на референс).
Попутно: MemberGuid у VariableReference/bSelfContext больше не переиспользует
NodeGuid (свежий guid32 в src/parser.js и index.html — синхронно).
Протокол для пользователя — в шапке MANIFEST.md: по одному файлу в чистый граф,
обратно — номер файла + сломанные ноды целиком.


## Раунд 1: Flow Control copy-back (2026-09-25)

14/14 встали; DoN — имя графа неверно (движок дропнул MacroGraphReference,
N/Counter осиротели) — нужен live-реф. Захвачены GraphGuid: ForLoopWithBreak
1FCFFE28…, WhileLoop FA93B260…, Gate 5FD0ADDB…, DoOnce 1281F542…
(ForLoop/ForEach/FlipFlop guid подтверждены). Ремонты движка, вшитые в реестр:
ForLoop — Index перед Completed; ForLoopWithBreak — Execute с большой буквы,
Break после LastIndex; Gate — +bStartClosed(true); DoOnce — Enter→execute,
+Start Closed (без dv); FlipFlop — безымянный exec-вход (поле PinName опускаем —
каноника), A/B, IsA-bool. Свитчи: порядок Default-первый, Selection dv "0"
у int (подтверждено), у enum dv не ставим (на проверке); SwitchEnum привязан
к EDrawDebugTrace (движок требует конкретный enum); движок добавляет скрытый
NotEqual-пин (IntInt/StriStri/ByteByte, bNotConnectable + ReadOnly) — пишем
его сразу (автопин в parser.js/index.html, как self). Макросы самоисцеляются
по имени графа (пины ребилдятся из сигнатуры) — критично только имя.
Sequence-3 визуально вышел за коммент — нижний отступ fitComment 60→110.
Copy-back сохраняет наши PinId — дифф по PinId работает. Валидатор: E04
«пин без PinName» понижен до W12 и только для связанных (FlipFlop).


## Раунд 1b: DoN + SwitchEnum live-рефы (2026-09-25)

DoN: настоящее имя графа — «Do N» (с пробелом!), guid E8C56B2F…,
пин n строчный (был N) — verified. SwitchEnum: живая структура —
узловые строки Enum="…" (quoted-full) + EnumEntries(i)="…" (по одной
на кейс), Default-пина НЕТ, Selection dv = имя первого энумератора,
порядок execute/Selection/NotEqual/кейсы. Наш SwitchEnum пересажен на
эту структуру (EDrawDebugTrace, 4 кейса) — на проверке. createGeneric
несёт enumRef/enumEntries (throw на неизвестном enum → NEEDS-REFERENCE);
эмиссия в parser.js/index.html + билдер песочницы. Известный пробел:
parse-capture Enum= не добавлен (paste→regen SwitchEnum теряет строки).


## Раунд 1-fix + 02: подтверждение copy-back (2026-09-25)

1-fix: 7/8 — идеальное 1:1 (все наши PinId сохранены). Безымянный пин
FlipFlop движок принял как есть; NotEqual-автопин принят с нашими PinId;
Execute/Break/bStartClosed/Start Closed/Index-first — всё kept.
SwitchEnum БЕЗ узловых Enum=/EnumEntries движок сдегенерировал в
execute/Selection(None,dv 0)/NotEqual (кейсы и Default снёс — как _113):
Enum-строки обязательны, 1-fix-2 (с ними) — решающий тест.
Раунд 02: форма переменных 1:1 (VariableReference со свежим MemberGuid
принят). Движок добавляет: dv по типу (0.0/false/"0, 0, 0") — не эмитим
(политика, как Autogenerated); self-пин у Get с BP-специфичным классом
(BP_WheelActor_C, без DefaultObject) — не эмитим (класс unknowable
статически, движок достраивает сам). Красное у переменных — только
unknown variable (ожидаемо). DoN live-реф _13 подтвердил 1-fix-2 1:1.


## Раунд 1-fix-2: вердикт — всё белое (2026-09-25)

DoN — идеальное 1:1. SwitchEnum принят целиком (Enum/Entries, 4 кейса,
Selection dv None, NotEqual с нашим PinId) с нормализацией None:
EnumEntries(0) движок переписал в "", у None-пина снёс PinName, кейсам
добавил PinFriendlyName NSLOCTEXT. Эмиттер: None->"" в EnumEntries
(в реестр/SwitchEnum verified=True; PinName/FriendlyName не эмитим —
движок достраивает). Файл 01: 14 verified, остался 1 noted (ForEachLoop).

## Раунд 3: вердикт и фикс операторов (2026-09-25)

14/30 белых с первого захода (все чистые CallFunction: Abs/Round/Fraction/
FClamp/ClampAngle/Lerp/MapRange x2/NormalizeToRange/SelectFloat/Exp/Loge/
Sqrt/Square). Сломаны 6 PromotableOperator: unquoted MemberParent движок
отторг — ноды дегенерировали в wildcard-пины + TimeManagement-реф
(Add_FrameNumberInteger и т.п.). Фикс: quoted-full MemberParent (форма как
у CallFunction); имена Add/Subtract/Multiply/Divide_DoubleDouble верны
(Epic Python API: add_double_double существует, add_float_float deprecated).
Percent и Power — вообще не операторы: CallFunction Percent_FloatFloat
(A/B) и MultiplyMultiply_FloatFloat (пины Base/Exp). Max/Min float — класс
K2Node_CommutativeAssociativeBinaryOperator, FMax/FMin (CallFunction Max/
Min = int-вариант, движок перетирает double-пины в int). Реестр: 4
переписки + 14 verified. Файл 03: 30/30, 14 verified.
Форвард-рефы (в реестр НЕ вносил — внесу к их раундам): Select blank =
K2Node_Select, Option 0/Option 1/Index(wildcard+index)/ReturnValue;
MinInt64/MaxInt64 = CommutativeAssociative int64; Percent Byte/Int/Int64 =
CallFunction Percent_ByteByte/IntInt/Int64Int64. bDefaultsToPureFunc,
PinToolTip, PinFriendlyName, dv+Autogenerated — движок добавляет сам,
не эмитим (17 белых CallFunction без флага это доказывают).

## Раунд 3b: F-имена и CoreUObject-дегенерация (2026-09-25)

Sign/Floor/Ceil/Trunc без префикса не существуют: настоящие имена
SignOfFloat, FFloor, FCeil, FTrunc (live-рефы _162/_163/_167/_169; пины
A double, RV double у Sign и int у остальных). Round без префикса —
белый (асимметрия UE). Реестр + sweep/03: 4 переименования; файл
03: 18 verified (FMod/GetMappedRange/GridSnap/IsNearlyZero — белые по
инференсу: не упомянуты среди сломанных). Copy-back старых операторов
(_120-_125): движок обнулил MemberParent в CoreUObject.Class и
сбросил пины в wildcard (PinId сохранены) — вторая форма дегенерации
(первая: TimeManagement + новые PinId). 3-fix (quoted-full) на момент
фикса ещё не тестился. Форвард-рефы к раунду 05: SignOfInteger,
SignOfInteger64, FFloor64, FCeil64.

## Раунд 3c: 3-fix белый, GridSnap/NearlyEqual (2026-09-25)

3-fix (8 нод) — всё белое с первого захода: quoted-full MemberParent
починил операторы, Percent/Power/Max(FMax)/Min(FMin) встали. Файл 03:
23 verified. GridSnap и IsNearlyZero не существуют: настоящие имена
GridSnap_Float (Location/GridSize) и NearlyEqual_FloatFloat (пины
A/B/ErrorTolerance, RV bool) — live-рефы _170/_171; IsNearlyZero
переименован в NearlyEqual_Float. FMod подтверждён белым (= division).
GetMappedRange возвращён в непроверенные (инференс 2/4 — жду явный
факт). 3-fix-2 (F-имена) на момент фикса не тестился. Дубли Percent/
Select/MinMax64/Sign/F-рефов — уже ingested, новой инфы ноль.
Заметка к раунду 07: NearlyEqual_Comparison (был дубль id
NearlyEqual_Float, переименован) хранит func NearlyEqual — сверить
с NearlyEqual_FloatFloat к раунду.

## Раунд 3d: 3-fix-2 частично, синглтон Trunc (2026-09-25)

Sign/FFloor/FCeil — белые (verified). FTrunc: движок осиротил наш
self-пин (субобъект снёс, свой создал, PinId 83E06D24 orphaned) при
байт-идентичных self у трёх соседей и 12 одинаковых self по 3-fix/
3-fix-2 (1 синглтон-орфан). Версия: флак вставки. Решение: Trunc в
verified не переводим, изолированный ретест 3-fix-4 (свежие GUID).
Если орфан повторится — эксперимент без self-пина. Файл 03:
26 verified / 4 noted (Trunc/GridSnap/NearlyEqual/GetMappedRange).

## Раунд 3e: 3-fix-3 белый, 3-fix-5 (2026-09-25)

GridSnap_Float + NearlyEqual_FloatFloat — белые (verified). Файл 03:
28 verified / 2 noted. Остаток: GetMappedRange (факт не получен) и
Trunc (синглтон-орфан) — отдельная проба 3-fix-5.

## Раунд 3f: Trunc белый, 3-fix-6 (2026-09-25)

Trunc_Float — белый по факту пользователя (синглтон-орфан из 3-fix-2
не повторился). GridSnap/NearlyEqual подтверждены повторно. Файл 03:
29 verified / 1 noted. Остаток: GetMappedRange — чистая проба 3-fix-6.

## Раунд 3g: MapRangeClamped вместо GetMappedRangeValueClamped (2026-09-25)

Факт: GetMappedRangeValueClamped в BP не существует (вставка дала пустой
комментарий) — это C++-only FMath. Настоящая нода — Map Range Clamped,
UKismetMathLibrary::MapRangeClamped(Value, InRangeA, InRangeB, OutRangeA,
OutRangeB). Реестр + sweep/03 + тест обновлены; проба 3-fix-7.
Дока: BlueprintAPI Math/Float/MapRangeClamped.

## Файл 03 CLOSED 30/30 (2026-09-25)

GetMappedRange (MapRangeClamped) — белая по факту пользователя;
MapRangeUnclamped уже была verified. Math/Float закрыт полностью.
Следующая глава: 04 Math/Interpolation (7 нод).

## Раунд 04: 5/7, фикс 4-fix (2026-09-25)

Белые: FInterpTo, VInterpTo, VInterpTo_Constant, RInterpTo, TInterpTo.
Сломаны 2: FInterpToConstant (настоящее имя FInterpTo_Constant, live-реф
_194) и Ease (не CallFunction — спец-нода K2Node_EaseFunction с
wildcard A/B/Result + enum-пин Function EEasingFunc, live-реф
K2Node_EaseFunction_0). Попутно из copy-back: у V/R/T InterpTo
DeltaTime/InterpSpeed — float (не double); у TInterpTo Current/Target —
const-ref. EEasingFunc добавлен в UE_ENUMS (src + index.html).

## Файл 04 CLOSED 7/7; предфикс операторов 05/07/08/14 (2026-09-25)

4-fix белый (FInterpTo_Constant + K2Node_EaseFunction) — Interpolation
закрыт. Перед раундом 05 найден и исправлен протухший MemberParent
(Class"..."') у операторов в sweep 05/07/08/14 — заменён на белую
quoted-full форму из 03 (18 мест). 05-math-integer: 9 нод, STRICT 0/3
(3xW09: Clamp/Max/Min int — имена перегрузок не подтверждены).

## Файл 05 CLOSED 8/9 + 1 skipped (2026-09-25)

Белые: 5 int-операторов (динамический тип — без указания int, как float),
Clamp/Max/Min int (имена Clamp/Max/Min подтверждены). IsPowerOfTwo не
существует в BP (только кастомная UBlueprintMath из вики + FMath C++) —
пропущено. +2 теста (189/0). Следующая глава: 06 Math/Trig (17 нод).
Риск: регистр имён Sin/sin и существование *Deg — движок арбитр.

## Раунд 06: 11/18, фикс 6-fix (2026-09-25)

Белые: Sin/Cos/Tan/Asin/Acos/Atan/Atan2 (верхний регистр подтверждён),
DegreesToRadians, RadiansToDegrees, GetTAU, GetPI. *Deg не существуют —
настоящие имена DegSin/DegCos/DegTan/DegAsin/DegAcos/DegAtan + DegAtan2
(live-рефы; DegAtan2 добавлен в реестр новым, стало 240 записей и 18
нод в файле 06). +2 теста (191/0).

## Файл 06 CLOSED 18/18 (2026-09-25)

6-fix белый (все 7 Deg*). Math/Trig закрыт полностью.

## Раунд 07: 7/8, фикс 7-fix + тестеры 08 (2026-09-25)

Белые: 6 операторов сравнения + InRange. NearlyEqual_Comparison сломан:
операторная форма NearlyEqual_DoubleDouble резолвится в wildcard-пины —
настоящая форма CallFunction NearlyEqual_FloatFloat как в 03 (live-реф
_8). +2 теста (193/0). 08-math-boolean: 7 нод, STRICT 0/0; риск: класс
AND/OR/NOT/XOR (может быть CommutativeAssociative, не PromotableOperator).

## Раунд 07: closed 8/8 + раунд 08: FAILED (вылет движка), 8-fix по live-рефам
- 07: NearlyEqual белая по факту пользователя → closed 8/8.
- 08: PromotableOperator+BooleanAND уронил движок. По 6 live-рефам пользователя:
  AND/OR/NAND = K2Node_CommutativeAssociativeBinaryOperator + bDefaultsToPureFunc (pure:true в реестре);
  NOT = K2Node_CallFunction Not_PreBool; XOR = CallFunction BooleanXOR; NOR = CallFunction BooleanNOR.
- Корень: createCallFunction называл все узлы префиксом K2Node_CallFunction — теперь имя = класс узла (как в живых копиях).
- 8-fix: все 7 boolean, STRICT 0/0, тесты 195/0 + 42/0. Ретест 08 + тестер 09 отправлены.

## Раунд 08-fix: 6/6 белых, Select не появился; раунд 09: 6/6 CLOSED
- 8-fix: AND/OR/NAND (CommutativeAssociative+pure), NOT (Not_PreBool), XOR, NOR — белые.
- SelectBool как CallFunction SelectBoolean движок отверг полностью (узел не появился):
  SelectBoolean не существует. Настоящий Select = K2Node_Select wildcard
  (Option 0/1, Index wildcard/index, RV wildcard) по live-рефу пустого Select.
- 09 Random: 6/6 белых, CLOSED. Отправлены 8-fix-select + тестеры 10 (Vector, 27) и 11 (Collision, 12).

## Раунд 08-fix-select-v2: bool-Select через IndexPinType
- Пустой Select (без IndexPinType) движок резолвит как int. По 5 live-рефам
  (bool/int/byte/int64/enum): тип индекса задаёт свойство узла IndexPinType.
- Bool-Select = IndexPinType bool + Index bool dv=false + Option 0/1/RV wildcard.
  IndexPinType выводится из пина Index (кроме wildcard); validate: W13-контроль.
- Enum-Select (NumOptionPins + Enum/EnumEntries) — раунд 19, пока не реализован.
- R10: фантомов нет в KML: Normal/IsZero/IsNearlyZero/Distance/DistanceSquared
  (Vector→Vector и A/B) и VSizeSquared2D. Каноны: Vector_IsNormal/Vector_IsZero/
  Vector_IsNearlyZero (A by ref const+ignored, bool), Tolerance FLOAT 0.000100,
  Vector_Distance/Vector_DistanceSquared (V1/V2), VSize2DSquared (вход Vector2D —
  асимметрия: белый VSize2D берёт Vector!). IsNormalized — дубликат, пропущен.
- R10: Make/Break Vector — pure CallFunction (struct-формы жёлтые): MakeVector
  X/Y/Z double + RV Vector; BreakVector InVec→X/Y/Z без ReturnValue.
  Make/Break Vector2D как struct-узлы — норма.
- R11: матрица трейсов 4 формы x ByChannel/ByProfile/ForObjects x Single/Multi = 24.
  Box ByChannel — короткие имена BoxTraceSingle/BoxTraceMulti (без ByChannel);
  Box Single HalfSize const=True, Multi — нет. Все 24 собраны из белых шаблонов.
- R11: struct BreakHitResult в живом тесте встаёт без выходов — канон только pure
  BreakHitResult_pure (Hit ref+const+ignored, 18 выходов). Struct-форма пропущена.
- Knot (K2Node_Knot): InputPin wildcard ignored=True + OutputPin wildcard —
  генератор уже совпадает 1:1 с live-рефом, фикса не было.

## Вердикты round8-fix / round10-fix / round11-fix (2026-09-25)

- round8-fix: `K2Node_Select` с `IndexPinType=(PinCategory="bool")` + Index bool dv false — белая, селектор булев. R08 закрыт 7/7.
- round10-fix: все 10 белые — VSize2DSquared (Vector2D), Vector_IsNormal, Vector_IsZero, Vector_IsNearlyZero, Vector_Distance, Vector_DistanceSquared (V1/V2), MakeVector/BreakVector (pure KML), Distance2D, DistanceSquared2D. R10 закрыт.
- round11-fix: матрица 4 формы × {ByChannel, ByProfile, ForObjects} × {Single, Multi} — 24/24 засчитано.
  CapsuleTrace{Single,Multi}ForObjects в тесте не вставились, но copy-back пользователя совпал с реестром 1:1
  (порядок пинов, float Radius/HalfHeight, ObjectTypes byte-enum Array ref+const ignored, dv ObjectTypeQuery1);
  сгенерированные ноды структурно идентичны белым SphereTrace*ForObjects (+HalfHeight). Причина сбоя — порча
  ручной перепечатки большой пасты, а не реестр. R11 закрыт.

## Вердикт round12 (2026-09-25)

- round12 Math/Rotator: все 15 белые — MakeRotator/BreakRotator (pure KML), MakeRotFromX/Y/Z/ZX, FindLookAtRotation, NormalizedDeltaRotator, ComposeRotators, NegateRotator, RLerp, SelectRotator, GetForwardVector/GetRightVector/GetUpVector. R12 закрыт 15/15.
  Подтверждает: pure KML Make/Break вместо struct-форм работает и для Rotator.

## Вердикт round14 (2026-09-25)

- round14 String: все 28 белые — Concat_StrStr, Len, ToUpper/ToLower, Contains (bUseCase/bSearchFromEnd), FindSubstring (StartPosition -1), Replace, ParseIntoArray (RV Array), JoinStringArray (SourceArray Array ref+const), Trim/TrimTrailing, Left/Right/Mid/LeftChop/RightChop, EqualEqual_StrStr/NotEqual_StrStr (CallFunction, не PromotableOperator), BuildString_Double/Int/Bool (+Suffix), Conv_Double/Int/Bool/VectorToString, IsEmpty, Conv_StringToInt/StringToDouble. R14 закрыт 28/28.
  Подтверждает: строковые параметры KismetStringLibrary можно слать без ref/const — движок восстанавливает сам.

## Вердикт round13 (2026-09-25)

- round13 Math/Transform: все 10 белые — MakeTransform/BreakTransform (pure KML, Scale dv 1,1,1; BreakTransform все 3 выхода), ComposeTransforms (компактный заголовок «*»), InvertTransform, Transform/InverseTransform Location/Direction/Rotation (T ref+const). R13 закрыт 10/10.

## Вердикт round15 (2026-09-25)

- round15 Array: все 18 белые (K2Node_CallArrayFunction + GetArrayItem с bReturnByRefDesired через `props`). Пользователь подтвердил «всё идеально» — R15 закрыт 18/18. Заодно повторно подтверждены R13 и R14.

## Вердикт round16 (2026-09-25)

- round16 Utilities: все 19 белые без изменений, включая сомнительные места pre-fix: PrintText (клон PrintString), pure IsValid/IsValidClass, GetSystemTime → GetRealTimeSeconds, QuitGame с enum EQuitPreference, SaveGame-функции GameplayStatics (class-пин SaveGameClass с SubCategoryObject). R16 закрыт 19/19.

## Round19-pre: Organization (2026-09-25)

- MakeArray/MakeSet/MakeMap — свежая wildcard-форма: входы `[0]`/`[1]` (Map: `Key 0`/`Value 0`), выход `Array`/`Set`/`Map` с ContainerType; NumInputs=2 у Array/Set. W03 валидатора теперь срабатывает только без ContainerType на выходе.
- Select — по образцу белого SelectBool: Option 0/1 wildcard, Index int (IndexPinType int, dv 0). Enum-Select — ещё не реализован.

## Вердикт round17 (2026-09-25)

- round17 Gameplay: все 12 на месте и работают — pure-геттеры GetPlayerController/Pawn/Character, GetGameMode/GameState/GameInstance (типизированные RV, WCO hidden), GetAllActorsOfClass/WithTag (OutActors Actor Array), SpawnActor как K2Node_SpawnActorFromClass (enum-дефолты CollisionHandlingOverride/TransformScaleMethod), SpawnEmitterAtLocation (EPSCPoolMethod), PlaySoundAtLocation без InitialParams, GetWorld → GetCurrentLevelName. R17 закрыт 12/12.

## Round20-pre: Text (2026-09-25)

- FormatText: KismetTextLibrary::Format — BlueprintInternalUseOnly → узел K2Node_FormatText (Format text → Result text); пины аргументов движок строит по {Имя}.

## Round21-pre: Enhanced Input (2026-09-25)

- Enhanced_GetActionValue: статического GetActionValue нет → член UEnhancedInputComponent::GetBoundActionValue (const → pure), self EnhancedInputComponent, Action InputAction (const), RV FInputActionValue. Добавлены struct InputActionValue (FULL) и lib EnhancedInputComponent. Свип строит 270/270.

## Вердикт round19 (2026-09-25)

- round19 Organization: все 6 белые — Reroute, Comment, MakeArray/MakeSet (NumInputs=2 даёт 2 входа), пустой wildcard MakeMap (одна пара Key 0/Value 0 — корректная нода), Select с Index int (движок тип индекса не меняет — к float подставит конвертацию float→int). R19 закрыт 6/6.

## Вердикт round20 (2026-09-25)

- round20 Text: FormatText (K2Node_FormatText, Format/Result) — белая. R20 закрыт 1/1.
- Copy-back (tests/fixtures/formattext-copyback.txt): дефолт text-пина сериализуется как `DefaultTextValue=NSLOCTEXT("[<namespace-guid>]", "<key>", "Hello")` + `PersistentGuid=0…0` (не `DefaultValue`). Парсер теперь читает NSLOCTEXT/INVTEXT, генератор пишет text-дефолты как `NSLOCTEXT("", <guid>, "...")` — вставкой пока не проверено.

## Вердикт round21 (2026-09-25) + Round21b-pre

- round21: EnhancedInputComponent::GetBoundActionValue — вставилась **пустой** (FAIL). Значение действия в BP берётся узлом «Get IA_X» (K2Node_GetInputActionValue) и событием K2Node_EnhancedInputAction — оба требуют ассет InputAction; ждём copy-back.
- Пользователь: подсистема Enhanced Input берётся своим узлом через Cast To PlayerController и т.п.; базовые ноды покрыты почти все, расширенные — почти нет. Открывается фаза 2 (расширенные узлы).
- round21b-pre (sweep/21b-enhanced-input-chain.txt, tools/gen-r21b.mjs): GetPlayerController → K2Node_DynamicCast (TargetType PlayerController, выход «AsPlayer Controller») → K2Node_GetSubsystemFromPC (CustomClass EnhancedInputLocalPlayerSubsystem) → AddMappingContext (член EnhancedInputSubsystemInterface, Options опущен). Всё без референсов.

## Вердикт round18 (2026-09-25)

- round18 Input: оба белые. K2Node_InputKey с `InputKey=SpaceBar` (без кавычек) принят; IsInputKeyDown как член PlayerController — движок сам назвал self «Target» (`PinFriendlyName=NSLOCTEXT("K2Node", "Target", "Target")`); у Key-пинов движок ставит `DefaultValue="None"`. Copy-back: tests/fixtures/input-r18-copyback.txt. R18 закрыт 2/2.
- Итог фазы 1: главы 01–20 закрыты, 21 (GetBoundActionValue) — FAIL, заменён черновиком 21b.

## Round22-pre: Casting (2026-09-25)

- Cast To Pawn/Character (форма DynamicCast как в 21b), Get Class (GameplayStatics::GetObjectClass), ClassIsChildOf, GetDisplayName/GetObjectName (KSL), EqualEqual/NotEqual_ObjectObject, EqualEqual_ClassClass, Conv_ObjectToString.

## Round23-pre: Actor (2026-09-25)

- Члены AActor по образцу белого IsInputKeyDown (MemberParent=Actor, явный self): K2_GetActorLocation/Rotation, GetTransform, GetActorForwardVector, K2_SetActorLocation/Rotation, K2_AddActorWorldOffset, K2_DestroyActor, SetActorHiddenInGame, GetOwner, ActorHasTag, GetComponentByClass, K2_AttachToActor (+enum EAttachmentRule, +lib Actor).

## Проверка text-дефолта + Round21c-pre (2026-09-25)

- FormatText с `DefaultTextValue=NSLOCTEXT("", <guid>, "Hello {Name}")` — работает: движок принял пустой namespace и построил пин аргумента Name. Генерация text-дефолтов подтверждена.
- round21c-pre (sweep/21c-enhanced-input-assets.txt): K2Node_EnhancedInputAction (событие, InputAction=ассет IA_Jump) и K2Node_GetInputActionValue (IA_Move → Vector2D), модуль /Script/InputBlueprintNodes. Генератор теперь берёт класс и ExportPath из реестра для узлов вне BlueprintGraph (вывод BlueprintGraph-узлов не изменился). Пути — из шаблона UE5 (/Game/Input/Actions/…), без референса.

## Round21b: Enhanced Input chain — VERIFIED (2026-09-25)

- Cast To PlayerController (K2Node_DynamicCast, TargetType=класс), Get EnhancedInputLocalPlayerSubsystem (K2Node_GetSubsystemFromPC, CustomClass), Add Mapping Context (EnhancedInputSubsystemInterface) — работают. Форма DynamicCast подтверждена для всех кастов.
- Подсказка пользователя: вместо Get Player Controller можно использовать Get Controller (self) у Pawn (добавлен в R24).

## Round24-pre: Pawn / Character / Controller

- sweep/24-pawn-character.txt, 18 узлов, члены Character/Pawn/Controller/Actor с явным self (как R23). Без референса.

## Round22: Casting — VERIFIED (2026-09-25) + каст к любому классу

- Все 10 записей Casting работают (DynamicCast, GetObjectClass, ClassIsChildOf, GetDisplayName/GetObjectName, ==/!= Object/Class, Conv_ObjectToString).
- K2Node_ClassDynamicCast — форма из копии пользователя (tests/fixtures/classcast-r22-copyback.txt): TargetType=класс, PureState=Impure, пины execute/then/CastFailed/Class(class Object)/As<Name>(class)/bSuccess(hidden). Запись ClassCastToPawn.
- Требование пользователя: каст к ЛЮБОМУ объекту/классу. `createCast(target, {kind:'object'|'class', pure})` в src/generator.js, CLI `node tools/gen-cast.mjs <Класс> [--class] [--pure]`.
  - target: `Pawn` → /Script/Engine.Pawn; `/Script/Mod.X` как есть; `/Game/.../BP_X` → `/Script/Engine.BlueprintGeneratedClass'/Game/.../BP_X.BP_X_C'` (не подтверждено).
  - Имя выхода: `As` + NameToDisplayString (упрощённо). Для BP-классов не подтверждено.
  - pure-каст (PureState=Pure) — не подтверждён.
- sweep/22b-cast-any.txt — демо: 4 объектных, 1 pure, 3 классовых каста.

## Round23: Actor — VERIFIED (2026-09-25) + Round23b-pre

- Все 13 записей Actor работают (включая Attach Actor To Actor с EAttachmentRule=KeepRelative).
- Замечание пользователя: нужны Right/Up vector, Add rotation, Combine Rotators и т.п., Attach Actor To Component, Component To Component.
  - Combine Rotators = KML ComposeRotators — уже verified в R12.
- sweep/23b-actor-ext.txt (tools/gen-subset.mjs), 19 узлов: GetActorRight/UpVector, GetActorScale3D, K2_AddActorWorld/LocalRotation, K2_AddActorLocalOffset, SetActorScale3D, K2_SetActorTransform, K2_SetActorLocationAndRotation, Actor.K2_AttachToComponent, K2_DetachFromActor (EDetachmentRule), SceneComponent: K2_AttachToComponent, K2_DetachFromComponent, K2_GetComponentLocation/Rotation, K2_SetWorldLocation, K2_SetRelativeLocation/Rotation, K2_AddLocalRotation. Без референса.

## Round21c, Round22b, Round23b — VERIFIED (2026-09-25)

- R21c: событие Enhanced Input Action (IA_Jump) и Get IA_Move — работают, пути шаблона /Game/Input/Actions подошли.
- R22b: каст к любому классу (объектные, pure, классовые) — работает (sweep/22b-cast-any.txt).
- R23b: все 19 досылок Actor/SceneComponent — работают (EDetachmentRule, Attach To Component и т.д.).

## Round25-pre: Events / Delegates

- sweep/25-events-delegates.txt (tools/gen-r25.mjs), 8 узлов, связанная сцена. K2Node_Event по-прежнему запрещён (E08).
- K2Node_CustomEvent: CustomFunctionName; параметры — строки `CustomProperties UserDefinedPin (...)` после пинов; OutputDelegate без MemberParent.
- K2Node_AddDelegate / RemoveDelegate / ClearDelegate: DelegateReference=(Actor, OnActorBeginOverlap), пин Delegate с сигнатурой /Script/Engine.ActorBeginOverlapSignature__DelegateSignature.
- K2Node_CreateDelegate: SelectedFunctionName.
- Вызов Custom Event: CallFunction с bSelfContext, MemberGuid = NodeGuid события.
- Генератор: пин `memberRef` → PinSubCategoryMemberReference, `userPins` → UserDefinedPin, `n.memberGuid`.

## Round24: Pawn / Character / Controller — VERIFIED (2026-09-25)

- Все 18 записей работают (включая CanJump/K2_GetPawn как pure, Crouch без bClientSimulation, SetControlRotation).

## Round26-pre: Timers / Latent

- sweep/26-timers-latent.txt (tools/gen-r26.mjs), 15 узлов: Custom Event OnTimerTick → Set Timer by Event (Delegate = /Script/Engine.TimerDynamicDelegate__DelegateSignature), Set Timer by Function Name, Clear Timer by Function Name, Pause/Unpause/Clear&Invalidate/Invalidate by Handle, 6 pure-геттеров хендла, Delay Until Next Tick.
- Новый struct FTimerHandle (/Script/Engine.TimerHandle). WorldContextObject опущен (как у verified Delay).
- ref-пины Handle (Clear&Invalidate, Invalidate) не подключены — им нужна переменная.

## Round22b: каст к любому классу — VERIFIED (2026-09-25)

- sweep/22b-cast-any.txt работает целиком: нативные и BP-классы (`AsBP AISupport Tester`), pure-каст (PureState=Pure), классовые касты.
- Требование пользователя: нужны не фиксированные примеры, а инструменты. Добавлены src/modules.js и tools/make-node.mjs (README → «Конструктор модулей»).
- sweep/25b-make-node.txt — модуль, собранный CLI: TakeAnyDamage → Cast BP → вызов события с параметрами (float, Actor, name[]); таймер на событие. VERIFIED («25b норма», 2026-09-26) — первый модуль make-node, подтверждённый движком целиком (event-for + AddDelegate, DynamicCast к BP-классу, `call` своего события с параметрами, create-event → Delegate таймера).

## Round23b — подтверждено повторно (2026-09-25)

## Round27-pre: Widgets / UI

- sweep/27-widgets-ui.txt собран конструктором (tools/make-node.mjs), 13 узлов.
- Create Widget: UMGEditor.K2Node_CreateWidget; Class = DefaultObject "/Game/UI/WBP_Test.WBP_Test_C"; выход типизирован UMG.WidgetBlueprintGeneratedClass (classRef: WBP_* → WidgetBlueprintGeneratedClass).
- Члены UserWidget (AddToViewport, AddToPlayerScreen, IsInViewport) и Widget (RemoveFromParent, SetVisibility / ESlateVisibility).
- WidgetBlueprintLibrary: SetInputMode_UIOnlyEx, SetInputMode_GameAndUIEx (EMouseLockMode), SetInputMode_GameOnly.
- Set/Get PlayerController.bShowMouseCursor: VariableSet/VariableGet с MemberParent=PlayerController и пином self.

## Round28-pre: Enhanced Input (full) — ждёт вердикта
- sweep/28-enhanced-input-full.txt собран конструктором (tools/make-node.mjs --chain), 25 узлов.
- Новые спеки: `ia-event <IA> [тип]`, `ia-value <IA> [тип]`; объектные пины в `fn` принимают ассет (`MappingContext=IMC_Default`, `Action=IA_Jump`) → DefaultObject.
- Сокращения: IA_* → /Game/Input/Actions/, IMC_* → /Game/Input/ (шаблон UE5).
- Подсистема (член IEnhancedInputSubsystemInterface): RemoveMappingContext, ClearAllMappings, HasMappingContext (pure), QueryKeysMappedToAction (pure), InjectInputForAction, InjectInputVectorForAction.
- UEnhancedInputLibrary (статик): RequestRebuildControlMappingsUsingContext, FlushPlayerInput, Make/Break InputActionValue, Conv_InputActionValueTo{Bool,Axis1D,Axis2D,Axis3D,String}.
- GetBoundActionValue сознательно не используется (R21 FAIL).

## Round25 — VERIFIED (движок, 2026-09-25)
- Все 8 форм Events / Delegates вставились и работают: Custom Event (с параметрами), Call, Bind/Unbind/Unbind all, Create Event.
- Create Event: движок предлагает «создать соответствующую функцию» — сигнатура делегата прочитана верно.

## Round29 — VERIFIED (движок, 2026-09-26)
- Пользователь: «R29 работает». 23 записи Components / Physics → verified; спека `call` (любая UFUNCTION) подтверждена.

## Round29-pre: Components / Physics — история
- sweep/29-components-physics.txt (make-node --chain), 30 узлов: 23 записи реестра + спека `call`.
- Источник компонента: Get Component by Class (StaticMeshComponent) → pure Cast To PrimitiveComponent → self всех членов.
- `call` — любая UFUNCTION без записи в реестре: SetAngularDamping/SetLinearDamping/GetAngularDamping (член), KismetMathLibrary.Abs (static pure).
- Class-пины в `fn` принимают нативный класс (`ComponentClass=StaticMeshComponent` → /Script/Engine.StaticMeshComponent).

## Round26 — VERIFIED (движок, 2026-09-26)
- Пользователь: «26 идеально». Все 14 записей Timers / Latent → verified.

## Round30-pre: декор раскладки (опционально) — ждёт вердикта
- Форма exec-knot'а взята из copy-back пользователя (BP_AISupportTester): K2Node_Knot, InputPin/OutputPin PinCategory="exec", у InputPin bDefaultValueIsIgnored=True.
- Правило пользователя: перенос на ряд ниже и позади → 2 knot'а в коридоре между рядами: один по вертикали под выходом первого ряда, второй — над входом второго ряда.
- make-node: `--wrap N` / `--width PX` (перенос рядов), спека `row` (принудительный перенос), `--decorate` (knot'ы + события-источники в ряд перед своими узлами + сетка 16). Exec вперёд с перепадом ≥48px → «ступенька» из 2 knot'ов. Без флагов раскладка прежняя.
- generator.js: createKnot(pos, category), layoutRows, decorateExec, snapToGrid, estNodeHeight, pinCenterY.
- sweep/30-decorate.txt — только узлы R26 (verified), проверяется именно декор: 11 узлов, 3+ ряда, 4 knot'а.

## Round31-pre: Audio — ждёт вердикта
- sweep/31-audio.txt собран make-node `call` + --chain --wrap 4 --decorate: PlaySound2D, PlaySoundAtLocation, SpawnSound2D → AudioComponent Play/SetVolumeMultiplier/SetPitchMultiplier/SetPaused/FadeIn/FadeOut/Stop, IsPlaying (pure), SpawnSoundAtLocation.
- Новый тип make-node `single` = C++ float (PinSubCategory="float"); `float` по-прежнему double.
- Sound-пины пустые (выбрать ассет в движке); WCO/advanced-пины опущены — движок достроит.

## Round27 — VERIFIED (движок, 2026-09-26)
- Пользователь: создаётся корректно; «Construct NONE» — класс виджета не выбран (выбирается локально), с классом компилируется без ошибок. 8 записей Widgets / UI → verified.
- Замечание: ужасная компоновка, нет горизонтального выравнивания (событие в нижнем ряду, Get Player Controller далеко от потребителей).
- Исправление: `--decorate` теперь раскладывает через generator.layoutDecorated — события-источники в ряд перед узлами, pure/данные подрядом под рядом своего первого потребителя, выходом левее его входа (глубже — левее); коридор knot'ов идёт ниже подряда. sweep/27b-widgets-ui-decorated.txt — тот же R27, перекомпонованный (--chain --decorate --wrap 4); ждёт оценки вида.


## Живые дампы: P0–P2 (2026-09-26, дамп BP_WheelActor SlipVel canonical)

Пользователь: валидатор валил живые копии. Исправлено:
- **E05**: PinId уникален только внутри ноды (движок резолвит пару «имя ноды + PinId»; две копии Dot в дампе несут
  одинаковые id пинов). Дубль NodeGuid → W15 (движок перегенерирует при вставке).
- **E06 → W14 в режиме фрагмента**: ссылки на `K2Node_Tunnel_*` (а также FunctionEntry/Result/Composite) — всегда
  warning + авто-фрагмент для всего файла; `--fragment` — любые внешние ноды; CLI по умолчанию `auto`: если у всех
  блоков есть ExportPath (живая копия; генератор без --root его не пишет) — фрагмент. `--strict-links` — строго.
- Реестр: `MakeVector2D_pure` (KML MakeVector2D, CallFunction pure).
- Формат (P1): см. HANDOFF «Формат пинов». Политика «PersistentGuid не пишем» (аномалия Branch_42) ОПРОВЕРГНУТА
  дампами — теперь `PersistentGuid=000…0` на каждом пине, порядок полей как у движка:
  `…bSerializeAsSinglePrecisionFloat=False,DefaultValue,AutogeneratedDefaultValue,DefaultObject,DefaultTextValue,LinkedTo,PersistentGuid,bHidden…`.
  ExportPath: только с `--root` в форме `Class'/Game/X/BP.BP:Graph.NodeName'` (без внутренних кавычек, как в fixtures).
- P2: `tools/inventory.mjs` + `validate --context` (E19). Причина: фрагмент выдумывал источники вместо `V_plane`,
  `WheelRadius_M`, `DeltaTime_s`, `ForwardVector/RightVector`.
- Не проверено движком: тултипы PromotableOperator для B/ReturnValue (по аналогии с A), local-set (форма по аналогии с get).

## Round32-pre: компоненты — жизненный цикл и запросы — ждёт вердикта
- sweep/32-components-lifecycle.txt (команда: sweep/gen32.sh; make-node --chain --decorate --wrap 4), всё через `call`:
  ActorComponent Deactivate / Activate(bReset) / SetComponentTickEnabled / IsComponentTickEnabled (pure) / K2_DestroyComponent
  (пин Object скрыт — не пишем, движок достроит); Actor K2_GetComponentsByClass, GetComponentsByTag (pure, DeterminesOutputType);
  WidgetBlueprintLibrary GetAllWidgetsOfClass (static, WCO опущен).
- Первый блок в НОВОМ формате P1 (PersistentGuid, Autogenerated-дефолты, self Target, без ExportPath) — проверяет и формат.

## Round30 — вердикт (2026-09-26): ноды корректны, декор требует правки
- Первый knot переноса должен быть соосен выходу последней ноды ряда (чуть правее правого края); estNodeWidth
  CallFunction завышает (Pause Timer ≈ 288, у нас 336). Второй knot — корректен.
- Петля Knot_111↔Knot_112 и двойные связи у Print «Resumed» — из испорченной чат-копии (файл корректен).
- План — docs/HANDOFF_TOPICS.md §2.

## Round31 — VERIFIED (движок, 2026-09-26)
- Пользователь: «31 норма». Audio через `call` (PlaySound2D, SpawnSound2D, AudioComponent члены), тип `single`.

## Round32 — VERIFIED (движок, 2026-09-26)
- Пользователь: «32 норма». Первый блок в формате P1 — формат подтверждён. UMG-классы только с модулем /Script/UMG.

## Round30-fix (2026-09-26): декор по вердикту, E20, --chain по событиям — ждёт повторной проверки вида
- `estNodeWidth` (src/generator.js) — теперь по геометрии Slate-ноды, а не по базе класса: max(шапка, тело пинов).
  Шапка = 64 + max(заголовок ×7.6, подзаголовок ×7.0); подзаголовок CallFunction — «Target is <Класс>» (он и задаёт
  ширину коротких узлов: Pause Timer by Handle → 281 ≈ 288 в движке; было 340), CustomEvent — «Custom Event».
  Тело = 12 + макс. вход (иконка + подпись ×6.2 + виджет дефолта: checkbox 18, число 40, текст по длине, вектор 120,
  комбо энама, class-пикер 120, ассет 140) + 24 + макс. выход + 12; скрытые и свёрнутые advanced-пины не считаются.
  Трейды ≈ 386 (были 400), Branch ≈ 197, Cast ≈ 254, событие ≈ 172. Числа — оценка ±1 клетка, движок ширину не сериализует.
- `decorateExec`: knot A переноса = правый край (оценка) + `KNOT_DX`=16, на сетке → соосно выходу последней ноды ряда
  (R30-вердикт: Pause Timer x=1040 → knot 1344, как пользователь и передвинул). Knot B — над входом первой ноды ряда (без изменений).
- `--chain` (make-node): КАЖДОЕ событие-источник (event / event-for / ia-event) начинает свою цепочку и (со второго)
  новый ряд; узлы до первого события подхватывает первое событие; основной выход — then, иначе первый exec-выход
  (ia-event → Triggered). Раньше цепочка шла сквозь события (Print «Done» → Print «Tick»).
- Валидатор **E20** (испорченная чат-копия R30): exec-выход с >1 связью, выход↔выход / вход↔вход (Direction mismatch),
  пин на собственную ноду (same node), exec↔данные, петля из одних knot'ов (Knot_111 ↔ Knot_112 — «loop»).
  `tests/fixtures/negative/` — фикстуры, которые ОБЯЗАНЫ падать (пока синтетическая копия дефектов; настоящий copy-back
  пользователя добавить дословно, когда пришлёт).
- Пересобраны: sweep/30-decorate.txt (sweep/gen30.sh) и sweep/27b-widgets-ui-decorated.txt (sweep/gen27b.sh) — те же узлы
  и связи, формат P1 (без ExportPath, PersistentGuid), knot'ы по новому правилу. Ждут оценки вида.

## Round30-fix2: PrintString width calibration (2026-09-26)

- Пользователь подтвердил: «30 норма», но knot A всё ещё сильно правее фактического края ноды.
- Copy-back из движка для PrintString: NodePosX=-9776, Knot_11 на x=-9600 (правильная граница, Δ=176), Knot_111 на x=-9472 (генератор раньше ставил слишком далеко).
- `estNodeWidth` теперь калибрует CallFunction PrintString = 176 px; 30/27b пересобраны. Проверка повторного размещения ждёт пользователя.


## Round28 — VERIFIED (движок, 2026-09-26)

- Пользователь: «28 норма». Полный блок Enhanced Input подтверждён.
- Copy-back также выявил ограничение текущей раскладки рядов: одинаковый NodePosY не гарантирует выравнивание exec-пинов при разной высоте заголовка (ClearAllMappings с двухстрочной шапкой vs FlushPlayerInput с одной строкой). Требуется layout по exec-pin center; оценку offset брать из заголовка/подзаголовка и порядка пинов, уже доступных генератору (не запрашивать ручной offset).

- Follow-up to exec-pin test (2026-09-26): user copy-back fixes expected positions: Branch NodePosY +16 vs ClearAllMappings; FlushPlayerInput shares ClearAllMappings NodePosY. A previous attempt to remove hidden-static-self header offset was wrong; reverted. `pinCenterY` uses Target header offset and per-pin Branch then/else offsets. Sequential sample rebuilt, awaiting confirmation.

- Latest copy-back (2026-09-26): Branch is 16px too low relative to ideal event/exec alignment. Reduced CustomEvent output-pin header offset by one grid cell; split test has Branch.then→ClearAllMappings and Branch.else→FlushPlayerInput. Rebuilt; needs UE re-check.

- Latest correction (2026-09-26): intended split is Branch.then → ClearAllMappings and Branch.else → FlushPlayerInput. Topology is right; false destination was still one cell too high with the 32px delta; moved it another 16px. Fixture now asserts target NodePosY delta=48px (true-to-false); awaiting UE confirmation.

- User provided collapsed-node copy-back with six outputs; consecutive pin rows are modeled at 32px (two 16px cells), independent of horizontal Knot offset (16px). `PIN_ROW_H=32`; first Composite pin center is NodePosY+56px. The 4-in/5-out probe is retained as a validated reference fixture. New recursive-level probe: `node tools/gen-collapsed-knot-test.mjs --inputs 1 --outputs 3 --levels 3` produces one input Knot and output levels 3→2→1 (7 total), stopping each side when a level contains only one Knot. The supplied UE copy-back calibrates the 1×3 Composite width directly: `NodePosX=-11440`, right port Knot `NodePosX=-11152`; less the measured 32px port gap gives width 256px. The fixture uses port column x=NodePosX+288 and recursive columns +304/+320. STRICT OK.
