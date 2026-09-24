# Архитектура — чем отличается от NeoStack

## NeoStack AI (Fab, $49, закрытый плагин)

- Работает **внутри** Unreal Editor (Slate UI, C++ плагин)
- Подключается к Claude/Codex/OpenRouter через свой Cloud
- Имеет доступ к проекту через индексацию (читает .uasset, .cpp)
- Генерирует ассеты напрямую через Editor API (создаёт файлы на диске)
- Поддерживает 15+ систем: Blueprints, Materials, Behaviour Trees, Structs и т.д.
- Плюс: нативно, быстро. Минус: закрыто, платно, требует установки плагина, зависит от их бэкенда

## UE Blueprint Toolkit (этот репо, открытый набор инструментов)

Работает **снаружи** UE, без плагина, как `text-to-cad`:

```
[Пользователь] → LLM (с tools/openai-tools.json + prompt/system-prompt.md + data/ue-functions.json)
                ↓
        Begin Object ... End Object (текст)
                ↓
        Песочница index.html (визуальная проверка, бесконечная канва, Collapsed Graph, ПКМ-палитра)
                ↓
        Ctrl+V в UE EventGraph
```

### Почему именно набор инструментов, а не плагин?

1. **LLM-агностик** — работает с любой моделью (ChatGPT, Claude, локальная Llama) через function calling / MCP, а не только через NeoStack Cloud
2. **Аудируемо** — LLM выдаёт текст, который можно проверить в песочнице до вставки в проект (NeoStack сразу пишет в .uasset)
3. **Не требует UE** для генерации — можно генерить на сервере, в CI, в браузере
4. **Расширяемо** — добавить новую ноду = добавить запись в `data/ue-functions.json`, без перекомпиляции плагина
5. **Совместимо с Arena** — можно скинуть ссылку на репо в чат и сказать «хочу такую нодовую структуру» — LLM прочитает `prompt/system-prompt.md` и `tools/openai-tools.json` как контекст

### Что уже покрыто (MVP)

| Система NeoStack | Статус в toolkit | Файл |
|---|---|---|
| Blueprints | ✅ Полностью | `src/parser.js`, `index.html` (бесконечная канва, Comment → тащит, Composite вход, ПКМ палитра) |
| Materials | 🔧 Tools spec готов | `tools/openai-tools.json` → `create_material` |
| Structs / Enums | 🔧 Tools spec готов | `create_struct`, `create_enum` |
| DataTables | 🔧 Tools spec готов | `create_datatable` |
| Behaviour Trees | 🔧 Tools spec готов | `create_behavior_tree` |
| Animation, Niagara, PCG... | 📋 Запланировано | Добавляется аналогично — одна запись в tools |

### Как LLM использует toolkit

#### Вариант 1: OpenAI Function Calling

```js
import tools from './tools/openai-tools.json'
const res = await openai.chat.completions.create({
  model: "gpt-4o",
  tools, // 7 функций
  messages: [{role:"user", content:"Создай BP_HealthPickup с SphereCollision и логикой Greater"}]
})
// LLM вызовет create_blueprint → ты сгенерируешь Begin Object через system-prompt.md → вернёшь в UE
```

#### Вариант 2: MCP (Claude Desktop / Cursor)

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "ue-toolkit": {"command": "node", "args": ["./mcp/server.js"]}
  }
}
```

MCP даёт те же 4 тулза: `blueprint_generate`, `blueprint_parse`, `blueprint_validate`, `ue_functions_search` — как у NeoStack, но локально.

#### Вариант 3: Песочница (без кода)

1. Открой `index.html`
2. ПКМ → выбери ноду из палитры (там же список переменных проекта)
3. Экспорт → `Copy UE Text` → вставь в UE

### Даташит

`data/ue-functions.json` — 32 ноды сейчас, расширяется до 150+ (KismetMathLibrary: Add, Multiply, Clamp, Lerp, VSize, Dot, FindLookAtRotation и т.д.). Каждая запись содержит `className`, `func`, `pins` — LLM не выдумывает несуществующие функции.

### Двусторонний цикл (как в NeoStack Context Attachments)

- **UE → песочница → LLM**: скопировал ноды в UE (`Ctrl+C`) → вставил в песочницу → Export JSON → скормил LLM как `currentGraphJSON` в `modify_blueprint_graph`
- **LLM → песочница → UE**: LLM вернул обновлённый `Begin Object` → вставил в песочницу для проверки → `Ctrl+V` в UE

Это полный аналог NeoStack «Attach Blueprint nodes», но без плагина.
