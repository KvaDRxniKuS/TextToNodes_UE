# Архитектура проекта

TextToNodes_UE — локальный набор инструментов для Unreal Engine Blueprint Text и браузерная песочница. Это не UE-плагин и не сервис, который напрямую редактирует `.uasset`: основной интеграционный формат — текст `Begin Object … End Object`, который пользователь вставляет в Unreal Editor.

## Data flow

```text
UE copy → parser → JSON graph → inspect/modify → generator → Blueprint Text → STRICT check → UE paste/copy-back
```

- `src/parser.js` читает и сериализует Blueprint Text.
- `src/creator.js` и `src/modules.js` создают семантические записи узлов/пинов; `linkPins()` записывает взаимные ссылки и не отвечает за координаты.
- `src/arranger.js` создаёт coarse-размещение по рядам, порядку и зазорам; для обратного exec flow может породить reroute knots.
- `src/decorator.js` уточняет положения пинов/нод, зазоры и сетку. ⚠ Ступень 3 приостановлена
  (2026-09-28) и в основной цикл не входит: он = генератор нод + расстановщик; см.
  [`docs/LAYOUT_PIPELINE.md`](LAYOUT_PIPELINE.md).
- `src/layout-pipeline.js` предоставляет orchestration двух позиционных этапов.
- `src/validate.js` проверяет текстовую и графовую структуру; он не эмулирует UE и не подтверждает визуальный layout или успешную компиляцию Blueprint.
- `index.html` — браузерная песочница. MCP server — отдельный stdio integration endpoint; его зависимости и запуск описаны в `mcp/README.md`.

Подробнее об обязанностях этапов, API и модельных ограничениях: [`LAYOUT_PIPELINE.md`](LAYOUT_PIPELINE.md).

## Реестр и engine evidence

`data/ue-functions.json` служит источником записей, используемых генераторами. `verified: true` означает, что запись прошла проверку в Unreal Editor, описанную в [`ENGINE_VERIFIED.md`](ENGINE_VERIFIED.md). Новая запись или успешная локальная валидация не являются доказательством приёма движком.

## Границы поддержки

- Проект ориентирован на переносимый Blueprint Text для проверяемых форм UE; конкретные поля и PinId могут зависеть от типа ноды и контекста Blueprint.
- Assets, custom project dispatchers/enums, variables и function-local names могут требовать настоящих путей/GUID из проекта.
- `tools/openai-tools.json` содержит tool schemas, а не реализацию создания всех перечисленных Unreal asset types.
- Поддержку конкретной UE версии следует сверять с engine fixtures и verdict пользователя; не считать автоматически каждый UE 5.x совместимым.

## Проверки разработчика

```bash
npm test
node src/validate.js path/to/blueprint.txt
node tools/gen-sweep.mjs zz
```

Статус sweep находится в [`../sweep/MANIFEST.md`](../sweep/MANIFEST.md). Текущие открытые темы и их фиксированный порядок — [`HANDOFF_TOPICS.md`](HANDOFF_TOPICS.md).
