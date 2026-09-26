# HANDOFF — продолжение в новом чате

> Оставшиеся темы, открытые вердикты и журнал вердиктов — `docs/HANDOFF_TOPICS.md` (читать вторым).

Прочитать первым делом в новом чате (без очереди N+1 протокол эха можно упростить).

## Что это
TextToNodes_UE — генератор текста для вставки Blueprint-узлов в UE 5.x (Ctrl+V в EventGraph).
Цель пользователя: НЕ фиксированные примеры, а инструменты сборки корректных модулей любых классов.

## Инструменты
- `tools/make-node.mjs` — конструктор модулей (см. шапку файла и README «Конструктор модулей»).
  Спеки: cast, event, event-for, call-event, bind/unbind/clear, create-event, widget, ia-event, ia-value,
  get/set, self-get/self-set (своя переменная), local-get/local-set <Функция>.<Имя> (локал/параметр),
  fn <id реестра>, call <Класс.Функция> (любая UFUNCTION), link, row.
  Флаги: --chain, --wrap N / --width PX, --decorate (exec-knot'ы на переносах + данные подрядом под потребителем,
  layoutDecorated, сетка 16), --title, -o, --root <реальный путь графа> (ExportPath; без него не пишется),
  --bp <путь BP>, --context ctx.json [--new A,B].
- `tools/inventory.mjs dump.txt -o ctx.json` — КОНТЕКСТ-ПЕРВЫЙ: инвентарь целевой функции (members/locals/params/
  композиты/туннели) из живой копии. Перед генерацией фрагмента в существующую функцию — сначала инвентарь,
  затем make-node --context: переменная вне инвентаря = E19 (или явно --new).
- `data/ue-functions.json` — реестр (verified=true — проверено движком). Писать indent=1, ensure_ascii=False.
- `src/modules.js` (конструкторы), `src/generator.js` (узлы, раскладка, decorateExec, estNodeWidth по геометрии ноды),
  `src/validate.js` (strict), `src/inventory.js`. Валидатор: PinId уникален только внутри ноды; ссылки на K2Node_Tunnel_* → W14
  (авто-фрагмент); `--fragment` / авто по ExportPath (живая копия) — внешние ноды = warning; `--strict-links` — строго;
  E20 — связи, которые движок отвергает (exec-выход ×2, выход↔выход, своя нода, петля knot'ов) → `tests/fixtures/negative/`.
- `--chain`: каждое событие (event/event-for/ia-event) начинает СВОЮ цепочку и новый ряд (со второго); узлы до первого
  события подхватывает первое событие. Главы с несколькими событиями — одним вызовом make-node.
- `tests/fixtures/` — живые копии из движка; КАЖДЫЙ новый дамп пользователя = новый fixture (тест прогоняет все).
  `tests/fixtures/negative/` — то, что ОБЯЗАНО падать (E20); пока там синтетика R30, настоящий copy-back — когда пришлёт.
- `tools/gen-sweep.mjs NN` — пересборка старых глав; `zz` — только MANIFEST. Главы ≥23 собраны make-node, НЕ пересобирать gen-sweep.
  Команды сборки make-node-глав — `sweep/gen27b.sh`, `sweep/gen30.sh`, `sweep/gen32.sh` (для новых глав заводить такой же genNN.sh).
- Тесты: `node tests/validate.test.mjs`, `node tests/sandbox.test.mjs`.
- Журнал проверок в движке: `docs/ENGINE_VERIFIED.md` (раунды, формы, провалы).

## Статус раундов (2026-09-26)
- VERIFIED: R07–R20, R21b, R21c, R22(+b), R23(+b), R24, R25, 25b (модуль make-node, «25b норма» 2026-09-26), R26, R27 (Widgets/UI;
  вид переделан как 27b), R29 (+`call`), R31 (Audio), R32 (компоненты + формат P1). R30 — ноды корректны («30 норма»); knot A дополнительно откалиброван по PrintString copy-back (176px), пересобран, ждёт re-check. Для раскладки: выравнивать каждый конкретный linked exec output/input pin pair, не один общий pin на ноду и не NodePosY; учитывать Target-header offset и отдельные ряды выходов Branch; copy-back подтвердил отдельные ветви true→Clear / false→Flush; Branch ещё на 16px ниже нормы, CustomEvent offset уменьшен на 16px и тест ждёт повторной проверки. Y намеренно может быть не на сетке. Последний тест: Branch норм, Flush был на строку выше; поправлено, ждёт re-check.
- FAIL: R21 (GetBoundActionValue — скрыт).
- VERIFIED: 28 Enhanced Input full («28 норма», 2026-09-26).
- R30: «норма», проверку расположения knot продолжить по copy-back. 27b: «норма», кроме первого knot (слишком далеко от края); ждём copy-back SetVisibility + правильного knot для калибровки.
- Отложено: Enum-Select, Event Dispatcher (K2Node_CallDelegate), Timeline, MoveComponentTo, GetAllWidgetsOfClass,
  AddComponentByClass, K2_DestroyComponent.

## Протокол работы с пользователем
- Объяснения по-русски. Сначала КОД (вставка), в конце — состав узлов/связи/сомнения.
- Каждый ответ — следующий блок (глава), пока пользователь не скажет иначе. Сообщение ≤ ~90KB.
- Пасты копировать из файла дословно, никогда не перепечатывать руками.
- Пользователь присылает вердикт + рефы (copy-back из движка) → флипнуть записи реестра, поправить формы, тесты, docs, коммит.
- Файлы в examples/ не создавать. Превью-сервер поднимать только по просьбе.

## Ключевые правила форм (выжимка; подробности в ENGINE_VERIFIED.md)
- Члены классов: видимый self с классом владельца; статики: self скрыт, DefaultObject Default__Lib (парсер добавит сам).
- WCO/LatentInfo можно не писать — движок восстановит пины. Пропущенные advanced-пины тоже.
- Каст: K2Node_DynamicCast, выход As<DisplayName>; классы: K2Node_ClassDynamicCast.
- Knot: K2Node_Knot, InputPin (ignored) / OutputPin; exec-knot — PinCategory="exec".
- Фантомы (не существуют): FInterpToConstant, SinDeg/CosDeg, IsPowerOfTwo, FindLookAtRotation2D; см. Errors в docs.
- Формат пинов (P1, паритет с дампами): DefaultValue+AutogeneratedDefaultValue на входах И выходах у узлов-функций
  (real "0.0", bool "false", int "0", name "None", Vector/Rotator "0, 0, 0"); пользовательское значение — только
  DefaultValue; byte-энамы без auto; у Cast и пр. K2-узлов типовых дефолтов нет. PersistentGuid=000…0 на каждом пине.
  self: PinFriendlyName=NSLOCTEXT("K2Node", "Target", "Target"). PromotableOperator: PinToolTip="A\nFloat (double-precision)";
  у CallFunction тултипов не пишем. Локал: VariableReference=(MemberScope,MemberName,MemberGuid), без self-пина.
  Своя переменная: self = BlueprintGeneratedClass'/Game/.../BP_X.BP_X_C'.
