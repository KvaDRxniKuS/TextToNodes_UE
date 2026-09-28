# Project handoff

Сводка актуального состояния репозитория. Дата проверки документации: 2026-09-26. Подробности engine copy-back хранятся в [`ENGINE_VERIFIED.md`](ENGINE_VERIFIED.md), очередь открытых тем — в [`HANDOFF_TOPICS.md`](HANDOFF_TOPICS.md).

## Проект

TextToNodes_UE парсит, создаёт, проверяет и экспортирует Unreal Engine Blueprint Text. STRICT-проверки выявляют структурные ошибки, но только вставка и проверка в UE подтверждают поведение конкретной версии редактора.

## Архитектура

Новый код строить через три явных этапа:

1. **Генератор нод (creator):** `src/stage1.js` (спека → только код нод, самопроверка round-trip) поверх `src/creator.js`, `src/modules.js` и фабрик `src/generator.js`. Создать ноды/пины; координаты не считать (0,0), провода не писать — соединения и `@row/@col` остаются закладкой, их материализует ступень 2 (`applyConnections`). `linkPins()` не перемещает ноды; knot'ы и комментарии на этой ступени не создаются.
2. **Arranger:** `src/arranger.js`. Задать визуальные ряды и coarse-порядок; обратные exec-связи могут получить reroute knots. Результат включает созданные ноды.
3. **Decorator ⚠ в разработке:** `src/decorator.js`. Плоские ряды (одинаковый Y exec-нод), столбец детей форка, зазор 5 клеток сетки по X, стадиумы из 4 knot'ов соосно пинам на каждом несоосном exec-проводе; ноды, провода и состав уровней не трогает (проверка: `tools/check-decoration.mjs`). С 2026-09-28 в основной цикл (ступени 1–2) не входит: `positionBlueprint()` её не вызывает, фикстура `.stage3-decorator.WIP.txt` не коммитится, в `npm test` её проверки не включены; прогон — `npm run stages:wip`.

`src/layout-pipeline.js` предоставляет общий orchestration API (`positionBlueprint()` = ступень 2; ступень 3 — только явно через опцию `decorate`); раздельный прогон ступеней с обменом текстом — `tools/gen-three-stage-test.mjs` (фикстуры `tests/three-stage-01.stage{1,2}-*.txt`, `npm run stages`). Оценки ширины и pin-center пока модельные: не считать UE-визуальную корректность подтверждённой без проверки в редакторе. Старые генераторы в `tools/make-node.mjs` используют совместимый layout path; не приписывать ему новые этапы, если он явно не переведён.

## Проверки и источники истины

- Полный тестовый набор: `npm test`.
- STRICT одного файла: `node src/validate.js PATH`.
- Сверить sweep-корпус с генератором (без записей): `node tools/gen-sweep.mjs --check` (`npm run check:sweep`).
- Пересобрать sweep одной категории и manifest: `node tools/gen-sweep.mjs NN` (MANIFEST переписывается при любом прогоне; `zz` — способ обновить только его).
- Пересобрать ВСЕ sweep-фикстуры и сравнить байты: `node tools/check-fixtures.mjs` (`npm run check:fixtures`; входит в `npm test`, при дрейфе откатывает файлы). Таблица покрытия — `node tools/check-fixtures.mjs --report` и раздел «Покрытие» в `sweep/MANIFEST.md`.
- Сводка покрытия: `sweep/MANIFEST.md`. Корпус побайтово воспроизводим (`seedGuids` по имени файла) — правка реестра обязана заканчиваться пересборкой и коммитом, а не «тихим» расхождением txt с генератором.
- Факты, подтверждённые copy-back из UE: `docs/ENGINE_VERIFIED.md` и `tests/fixtures/`.
- Реестр: `data/ue-functions.json`; `verified: true` указывает на engine verification, а не просто на успешный локальный STRICT.

## Важные правила взаимодействия

- Отвечать пользователю по-русски.
- Любой Blueprint-текст для вставки выдавать дословно из созданного файла; не сокращать и не править вручную.
- Замороженные фикстуры `sweep/` (`25b-make-node.txt`, `31-audio.txt`, `27-widgets-ui.txt`,
  `28-enhanced-input-full.txt`, `29-components-physics.txt`) не пересобирать и не «синхронизировать»
  генератором: это снятые с движка тексты без recipe. Их правят только новым copy-back из UE.
- Не открывать сгенерированные файлы в viewer после правок.
- Для визуальных и функциональных заявлений в UE ждать copy-back или прямой verdict пользователя.
- Следовать очереди из `HANDOFF_TOPICS.md`, не переставлять темы самовольно.
- Не добавлять приватные дампы пользователя в fixtures без его решения; настоящие copy-back fixtures сохранять дословно.

## Текущий UE follow-up

Трёхступенчатый тест: `tests/three-stage-01.sequence.md` (эталонная последовательность и критерии
приёмки) → `tests/three-stage-01.stage1-generator.txt` / `.stage2-arranger.txt`. Ступени 1 и 2
приняты и составляют основной цикл; ступень 3 (декоратор) переписана по ТЗ (плоские ряды, столбец
форка, stadium-переносы), но с 2026-09-28 приостановлена и из цикла вынута — её выход
`.stage3-decorator.WIP.txt` генерируется `npm run stages:wip` и не коммитится. Правила, отступления
и координаты decorated-варианта — в §4 спеки.

Dispatcher fixture: `sweep/dispatcher-probe-bound.txt`, генератор `tools/gen-dispatcher-bound-test.mjs`. Последняя перестройка использует creator → arranger (декоратор приостановлен), но её spacing и pin alignment в Unreal Editor ещё должны быть визуально подтверждены пользователем. См. историю решений и следующий порядок тем в `HANDOFF_TOPICS.md`.
