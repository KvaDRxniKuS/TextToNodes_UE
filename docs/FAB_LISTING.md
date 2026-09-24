# Черновик листинга для Fab (если захочешь продавать как NeoStack)

**Название:** UE Blueprint Toolkit — Open Text-to-Blueprint

**Кратко:** Открытый набор инструментов для AI-генерации Blueprints, Materials, Structs и DataTables. Работает как NeoStack, но без закрытого плагина — через текст `Begin Object` и LLM tools.

**Описание (как у NeoStack):**

The ultimate open toolkit for AI-powered Unreal Editor — complete support of Blueprints, Materials, Data Structures & more, via text!

- **Blueprints** — infinite canvas sandbox, Comment grouping, Collapsed Graph navigation, right-click palette
- **Materials** — MaterialExpression nodes via `create_material` tool
- **Structs / Enums / DataTables** — via `create_struct` / `create_datatable`
- **Behaviour Trees** — via `create_behavior_tree`
- Works with **any LLM** (Claude, GPT, local) through OpenAI tools / MCP, not locked to a cloud
- **Sandbox validation** — preview graph in browser before pasting to UE (`Ctrl+V`)
- **Bidirectional** — copy from UE → sandbox → LLM → back to UE

Includes: `index.html` sandbox, `src/parser.js`, `data/ue-functions.json` (150+ nodes), `prompt/system-prompt.md`, `mcp/server.js`, `tools/openai-tools.json`

**Демо:** открой `index.html` → ПКМ → выбери `Branch` → Export → вставь в UE

**Документация:** `docs/ARCHITECTURE.md` + `README.md`

**Совместимость:** UE 5.3–5.8, Windows/Mac/Linux, без установки плагина

**Теги:** Blueprint, AI, Materials, PCG, Niagara, Editor Utilities

**Цена:** Free / MIT (в отличие от NeoStack $49) — или продавай как поддержку
