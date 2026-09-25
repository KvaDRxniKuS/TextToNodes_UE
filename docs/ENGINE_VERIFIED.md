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
