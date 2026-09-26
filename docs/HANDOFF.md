# HANDOFF — продолжение в новом чате

Прочитать первым делом в новом чате (без очереди N+1 протокол эха можно упростить).

## Что это
TextToNodes_UE — генератор текста для вставки Blueprint-узлов в UE 5.x (Ctrl+V в EventGraph).
Цель пользователя: НЕ фиксированные примеры, а инструменты сборки корректных модулей любых классов.

## Инструменты
- `tools/make-node.mjs` — конструктор модулей (см. шапку файла и README «Конструктор модулей»).
  Спеки: cast, event, event-for, call-event, bind/unbind/clear, create-event, widget, ia-event, ia-value,
  get/set, fn <id реестра>, call <Класс.Функция> (любая UFUNCTION), link, row.
  Флаги: --chain, --wrap N / --width PX, --decorate (exec-knot'ы на переносах, сетка 16), --title, -o.
- `data/ue-functions.json` — реестр (verified=true — проверено движком). Писать indent=1, ensure_ascii=False.
- `src/modules.js` (конструкторы), `src/generator.js` (узлы, раскладка, decorateExec), `src/validate.js` (strict).
- `tools/gen-sweep.mjs NN` — пересборка старых глав; `zz` — только MANIFEST. Главы ≥23 собраны make-node, НЕ пересобирать gen-sweep.
- Тесты: `node tests/validate.test.mjs`, `node tests/sandbox.test.mjs`.
- Журнал проверок в движке: `docs/ENGINE_VERIFIED.md` (раунды, формы, провалы).

## Статус раундов (2026-09-26)
- VERIFIED: R07–R20, R21b, R21c, R22(+b), R23(+b), R24, R25, R26.
- FAIL: R21 (GetBoundActionValue — скрыт).
- Ждут вердикта: 25b (make-node модуль), 27 Widgets/UI, 28 Enhanced Input (full), 29 Components/Physics + `call`,
  30 декор (knot'ы), 31 Audio (через `call`, тип `single` = C++ float).
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
