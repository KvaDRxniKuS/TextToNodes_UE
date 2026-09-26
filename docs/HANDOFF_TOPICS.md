# Открытые темы и очередность

Актуальное состояние на 2026-09-26. Этот файл сохраняет порядок следующих UE-задач; completed-пункты не повторять как незавершённые. Длинная история copy-back и прежних гипотез находится в [`ENGINE_VERIFIED.md`](ENGINE_VERIFIED.md).

## Проверенные раунды

Статусы ниже относятся к verdict пользователя в Unreal Editor; локальный STRICT сам по себе статус VERIFIED не присваивает.

| Тема | Текущий статус |
|---|---|
| R07–R20, R21b/R21c, R22/R22b, R23/R23b, R24–R27, R28, R29, R31, R32 | VERIFIED; детали и версии — в `ENGINE_VERIFIED.md` |
| R21 GetBoundActionValue | Не использовать: нода скрыта/не доступна в проверенной конфигурации |
| Enum Select для `EDrawDebugTrace` | Точная форма сверена с UE copy-back: 4 options, enum IndexPinType, Enum/EnumEntries и friendly names; fixture `sweep/enum-select-test.txt`. Кастомный BP enum отдельно не подтверждён |
| Dispatcher layout follow-up | `sweep/dispatcher-probe-bound.txt` обновлён инструментами трёх этапов; новая визуальная раскладка ещё ждёт verdict пользователя |
| Трёхступенчатый конвейер отдельными инструментами | Ступень 1 (генератор нод, `src/stage1.js`) откалибрована на `tests/three-stage-01.sequence.md` под правило «не двигает и не соединяет»: 12 нод, все координаты 0, ноль `LinkedTo`, 5 уровней и 11 соединений заложены, STRICT + round-trip чистые; визуальный verdict пользователя ещё не получен. Ступень 2: коридор knot-переносов исправлен по замечанию пользователя (knot'ы «под уровнем» → «между уровнями», `rerouteCorridorY` + привязка к сетке) и принят. Ступень 3 переписана по ТЗ: 4 прохода (exec-скелет ряда, данные, щели уровней, knot'ы по пинам), код нод и состав уровней не трогает; критерии — `tools/check-decoration.mjs` в `npm test`. Остальные расхождения — в `tests/three-stage-01.sequence.md` §4 |
| R30/27b и другие старые layout probes | Не считать последнее ручное смещение универсально откалиброванным. При необходимости сверять с актуальным UE copy-back, а не возрождать старые offsets из журнала |

## Следующие темы — в заданном порядке

1. **Завершить UE-проверку текущего layout pipeline** на dispatcher fixture: последовательность слева направо, реальный зазор между exec-пинами, pin-center alignment и handler. Новые позиции/solver утверждать только после copy-back пользователя. Параллельно идёт калибровка ступеней по одному инструменту на `tests/three-stage-01.*`: ступень 2 принята (шаблон «делегат левее ниже» и дробные уровни — открытые пункты), ступень 3 переписана по ТЗ: Y пинов совмещён, зазор 5 клеток, knot'ы по X пинов в середине коридора — ждёт copy-back.
2. **MoveComponentTo** — latent узел, `ExpandEnumAsExecs`, несколько exec-выходов; расширить creator/arranger для таких форм после получения канонического UE reference.
3. **AddComponentByClass / Add Static Mesh Component** — специальная K2-нода, нужен copy-back и проверка формы пинов.
4. **Timeline** — K2Node_Timeline и референс с curve asset.
5. **Blueprint Interfaces** — Message nodes и Does Implement Interface.
6. **Расширенные loops/array by-ref** — ForEachLoopWithBreak, ReverseForEach, WhileLoop, Get/Set by ref.
7. **Пользовательские structs** — Make/Break и Set Members in Struct.
8. **Save Game** — CreateSaveGameObject, Save/Load Game to Slot, DoesSaveGameExist и async варианты.
9. **Data Table** — GetDataTableRow / GetDataTableRowNames.
10. **AI** — AI MoveTo, Blackboard Get/Set, Run Behavior Tree, GetAIController.
11. **Animation** — Play Montage, Montage_Play/Stop, Anim Instance.
12. **Materials** — Dynamic Material Instance, parameter operations, MPC.
13. **Niagara/FX** — spawn и variable operations.
14. **Camera** — SpringArm/Camera, view target, camera shake.
15. **Level streaming** — Open Level, Load/Unload Stream Level, Get Streaming Level.
16. **Gameplay Tags** — HasTag, containers, Matches Tag.
17. **Random streams / math extras** — stream-based random, seed, noise.
18. **Networking** — replicated custom events, authority, local control.
19. **Input остаток** — альтернативы скрытому GetBoundActionValue и mapping-context priority.
20. **Tooling follow-ups** — оценить синхронизацию embedded generator в `index.html` с каноническим serializer/layout API и fallback-реестра (сейчас 239 записей против 406 в JSON; по HTTP загружается актуальный файл); проверить дефолты и local-set по copy-back; рассмотреть getter duplication; расширять regression fixtures только из реальных copy-back.

## Зафиксированные решения, не менять без нового UE evidence

- Вставки и copy-back из пользователя передавать дословно, не редактировать вручную.
- Ступени конвейера обмениваются ТЕКСТОМ; ступень 2/3 вправе менять в чужом блоке только `NodePosX/Y` и `LinkedTo` (`generateUEText(…, { syncLinks: true })`) — остальной код ноды остаётся дословным.
- Ступень 1 не угадывает позиционирование и не трогает геометрию: без `@row`/`@col` узел не создаётся, координаты остаются 0, `LinkedTo` не пишутся, knot'ы и комментарии генератор не создаёт. Расположение и соединения — закладка для ступени 2 (`connections` → `applyConnections`).
- Полноценный enum Select не сводить к двум wildcard options: для указанного EDrawDebugTrace эталон — четыре enum options; см. fixture и `ENGINE_VERIFIED.md`.
- Composite/Knot геометрию из завершённых тестов не смешивать с dispatcher/layout work.
- Реальные пользовательские проектные дампы, которые пользователь не разрешал включать в toolkit, не добавлять в Git.
