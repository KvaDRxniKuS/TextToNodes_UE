# Project handoff

Сводка актуального состояния репозитория. Дата проверки документации: 2026-09-26. Подробности engine copy-back хранятся в [`ENGINE_VERIFIED.md`](ENGINE_VERIFIED.md), очередь открытых тем — в [`HANDOFF_TOPICS.md`](HANDOFF_TOPICS.md).

## Проект

TextToNodes_UE парсит, создаёт, проверяет и экспортирует Unreal Engine Blueprint Text. STRICT-проверки выявляют структурные ошибки, но только вставка и проверка в UE подтверждают поведение конкретной версии редактора.

## Архитектура

Новый код строить через три явных этапа:

1. **Генератор нод (creator):** `src/stage1.js` (спека → только код нод, самопроверка round-trip) поверх `src/creator.js`, `src/modules.js` и фабрик `src/generator.js`. Создать ноды/пины; координаты не считать (0,0), провода не писать — соединения и `@row/@col` остаются закладкой, их материализует ступень 2 (`applyConnections`). `linkPins()` не перемещает ноды; knot'ы и комментарии на этой ступени не создаются.
2. **Arranger:** `src/arranger.js`. Задать визуальные ряды и coarse-порядок; обратные exec-связи могут получить reroute knots. Результат включает созданные ноды.
3. **Decorator:** `src/decorator.js`. Плоские ряды (одинаковый Y exec-нод), столбец детей форка, зазор 5 клеток сетки по X, стадиумы из 4 knot'ов соосно пинам на каждом несоосном exec-проводе; ноды, провода и состав уровней не трогает (проверка: `tools/check-decoration.mjs`).

`src/layout-pipeline.js` предоставляет общий orchestration API; раздельный прогон ступеней с обменом текстом — `tools/gen-three-stage-test.mjs` (фикстуры `tests/three-stage-01.stage*.txt`, `npm run stages`). Оценки ширины и pin-center пока модельные: не считать UE-визуальную корректность подтверждённой без проверки в редакторе. Старые генераторы в `tools/make-node.mjs` используют совместимый layout path; не приписывать ему новые этапы, если он явно не переведён.

## Проверки и источники истины

- Полный тестовый набор: `npm test`.
- STRICT одного файла: `node src/validate.js PATH`.
- Обновить только sweep manifest: `node tools/gen-sweep.mjs zz`.
- Обновить sweep-файл одной категории и manifest: `node tools/gen-sweep.mjs NN`.
- Сводка покрытия: `sweep/MANIFEST.md`.
- Факты, подтверждённые copy-back из UE: `docs/ENGINE_VERIFIED.md` и `tests/fixtures/`.
- Реестр: `data/ue-functions.json`; `verified: true` указывает на engine verification, а не просто на успешный локальный STRICT.

## Важные правила взаимодействия

- Отвечать пользователю по-русски.
- Любой Blueprint-текст для вставки выдавать дословно из созданного файла; не сокращать и не править вручную.
- Не открывать сгенерированные файлы в viewer после правок.
- Для визуальных и функциональных заявлений в UE ждать copy-back или прямой verdict пользователя.
- Следовать очереди из `HANDOFF_TOPICS.md`, не переставлять темы самовольно.
- Не добавлять приватные дампы пользователя в fixtures без его решения; настоящие copy-back fixtures сохранять дословно.

## Текущий UE follow-up

Трёхступенчатый тест: `tests/three-stage-01.sequence.md` (эталонная последовательность и критерии
приёмки ступени 1) → `tests/three-stage-01.stage1-generator.txt` / `.stage2-arranger.txt` /
`.stage3-decorator.txt`. Ступени 1 и 2 приняты; ступень 3
переписана по ТЗ (плоские ряды, столбец форка, stadium-переносы) и ждёт визуальной проверки в UE.
Правила и отступления — в §4 спеки.

Dispatcher fixture: `sweep/dispatcher-probe-bound.txt`, генератор `tools/gen-dispatcher-bound-test.mjs`. Последняя перестройка использует creator → arranger → decorator, но её spacing и pin alignment в Unreal Editor ещё должны быть визуально подтверждены пользователем. См. историю решений и следующий порядок тем в `HANDOFF_TOPICS.md`.
