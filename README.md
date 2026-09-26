# UE Blueprint Toolkit — Text-to-Blueprint for AI

> **Онлайн-песочница + набор инструментов для нейросетей, которые генерируют копируемый код нод Unreal Engine Blueprint в формате `Begin Object ... End Object`.**
>
> Вставь код из UE → увидишь граф как в редакторе. Попроси LLM сгенерировать граф → вставь обратно в UE через `Ctrl+V`. Работает двусторонне, с поддержкой Collapsed Graph, reroute, comment.

**Live Demo:** открой `index.html` (бесконечная канва в стиле UE, ПКМ → поиск нод, комментарии тащат содержимое, двойной клик по Collapsed Graph — вход внутрь).

Inspired by [text-to-cad](https://github.com/earthtojake/text-to-cad) — but for Unreal Engine Blueprints.

---

## 🎯 Что это

Инструмент решает главную проблему: нейросети не умеют выдавать визуальные блюпринты. Этот репозиторий дает им **строгий формат, парсер, реестр всех функций UE и промпт**, чтобы они генерировали текст, который напрямую вставляется в Unreal Editor.

```
Текстовый промпт → LLM → Begin Object ... End Object → Ctrl+V в UE → Готовый граф
UE Ctrl+C → Песочница → JSON → LLM (как контекст) → Изменение графа → Снова в UE
```

**Фишки песочницы:**
- 1-в-1 парсер `Begin Object` (все `K2Node_*`, `Knot`, `Comment`, `Composite` с вложенными графами)
- Бесконечная канва (как в UE) — тяни в любую сторону, нет границ
- Комментарий перетаскивает всё своё содержимое (как в UE)
- Двойной клик по **Collapsed Graph** → вход внутрь, хлебные крошки → выход
- ПКМ на графе → палитра как в UE: поиск функций/переменных, создание переменной
- Переменные проекта — клик `Get`/`Set`, ссылаются на реальные имена из движка
- Экспорт: `UE Text` (для вставки), `JSON` (для AI), `Compact` (для промпта)

---

## 📁 Структура репозитория

```
/
├── index.html                  # песочница (открой в браузере, без сборки)
├── README.md
├── package.json
├── src/
│   ├── parser.js               # парсер UE текста → граф (используй в Node/Python)
│   ├── generator.js            # граф → валидный UE текст (для LLM)
│   └── schema.json             # JSON Schema для валидации ответа нейросети
├── data/
│   └── ue-functions.json       # полный список 150+ функций UE (из KismetMathLibrary, KismetSystemLibrary...)
├── prompt/
│   └── system-prompt.md        # System Prompt для ChatGPT/Claude — скопируй 1-в-1
├── tools/
│   └── openai-tools.json       # 7 tools для LLM как у NeoStack (create_blueprint, create_material, create_struct...)
├── mcp/
│   └── server.js               # MCP Server для Claude Desktop / Cursor (как NeoStack Cloud)
├── docs/
│   ├── ARCHITECTURE.md         # чем отличается от NeoStack (закрытый плагин vs открытый toolkit)
│   └── FAB_LISTING.md          # черновик листинга для Fab
└── examples/
    ├── wheel-mu.txt            # пример из задания (StaticMu > DynamicMu)
    └── wheel-mu.json           # тот же граф в JSON для AI
```

> **Как у [NeoStack AI](https://www.fab.com/listings/0e725daa-0233-408a-9597-960d20b4d919) (Fab, $49, закрытый плагин для Blueprints/Materials/Behaviour Trees/DataTables…), но в виде открытого набора инструментов.**  
> Подробнее: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — сравнение, MCP, OpenAI tools, двусторонний цикл UE ↔ LLM.

---

## 🚀 Быстрый старт

### 1. Песочница (без установки)

```bash
# просто открой файл
open index.html
# или запусти локальный сервер
npx serve .
```

1. В UE выдели ноды в Blueprint → `Ctrl+C`
2. Вставь в левое поле в песочнице → **Распарсить**
3. Выдели ноды → справа **Копировать** → `Ctrl+V` в UE EventGraph

### 2. Подключение нейросети

**Вариант A — прямой (скопируй промпт):**

```js
import SYSTEM_PROMPT from './prompt/system-prompt.md'
import UE_FUNCTIONS from './data/ue-functions.json'

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {role: "system", content: SYSTEM_PROMPT},
    {role: "user", content: "Сделай логику: если StaticMu > DynamicMu то вызови F_UpdateGraphics иначе установи StaticMu = 0.5, с рерутами и комментарием. Доступные функции: " + JSON.stringify(UE_FUNCTIONS.slice(0,20))}
  ]
})
// response.choices[0].message.content содержит Begin Object ... End Object
// вставь его в песочницу для визуальной проверки, затем в UE
```

**Вариант B — через парсер (валидация):**

```js
import { parseToGraphs, generateUEText } from './src/parser.js'
import { validate } from './src/generator.js'

// Текст от нейросети
const ueText = llmOutput.match(/Begin Object[\s\S]+?End Object/g).join('\n\n')

// Валидация перед вставкой в UE
const result = validate(ueText)
if(!result.valid) console.error(result.errors)

// Парсинг для предпросмотра в песочнице
const graphs = parseToGraphs(ueText)
```

---

## 🧠 Как это работает для AI

### System Prompt (сокращенно, полный в `prompt/system-prompt.md`)

```
Ты — генератор Unreal Engine Blueprint.
Выдавай ТОЛЬКО блоки Begin Object ... End Object.

ПРАВИЛА:
- NodePosX/Y с шагом 240/160, чтобы граф не слипался
- PinId и NodeGuid — уникальные HEX 32, генерируй случайно
- Для каждой связи указывай LinkedTo=(NodeName PinId) в ОБЕИХ нодах (двусторонне)
- PinCategory: exec, bool, real (double), int, byte, object, string, text, struct, class
- Классы: VariableGet/Set, PromotableOperator, IfThenElse (Branch), ExecutionSequence, Switch, CallFunction/CallArrayFunction, MacroInstance, MakeStruct/BreakStruct, Knot, Comment, Composite
- Для CallFunction указывай FunctionReference с ПОЛНЫМ MemberParent библиотеки (см. реестр lib)
- ЗАПРЕЩЕНО: K2Node_Event, K2Node_ForLoop/WhileLoop/Gate/DoOnceMultiInput/FlipFlop/DoN (макросы — только MacroInstance)
- Struct-пины — только с полным PinSubCategoryObject; Delay — выход then; MakeStruct — выход = имя структуры
- В начале ответа краткий комментарий, затем код
- Перед выдачей: node src/validate.js — ноль ошибок (подробности: docs/ENGINE_VERIFIED.md)
```

### JSON Schema (для function calling)

```json
{
  "type": "object",
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id","className","pos","pins"],
        "properties": {
          "id": {"type": "string"},
          "className": {"type": "string", "enum": ["K2Node_VariableGet", "K2Node_IfThenElse", "..."]},
          "pos": {"type": "object", "properties": {"x": {"type": "number"}, "y": {"type": "number"}}},
          "pins": {"type": "array"}
        }
      }
    }
  }
}
```

Полная схема в `src/schema.json`.

### Реестр функций

`data/ue-functions.json` содержит 231 ноду, сгруппированную как в UE. Каждая запись несёт движковые метаданные:

- `lib` — библиотека-хозяин для `MemberParent` (KismetMathLibrary, GameplayStatics...)
- `verified` — `true`, только если нода реально вставлялась в UE из сгенерированного текста (✅ в палитре песочницы, иначе 🧪)
- `note` — предупреждение/спорное место, валидатор показывает его как warning
- `macro` / `struct` — имя+GUID стандартного макроса / полный путь структуры

Проверенные вставкой ноды и протокол проверки — в `docs/ENGINE_VERIFIED.md`.

Категории:

- **Math / Float**: `Add, Subtract, Multiply, Divide, Greater, Less, Clamp, Lerp, MapRange, Sin, Cos, Sqrt, Power, FInterpTo...`
- **Math / Vector**: `Add_VectorVector, VSize, Dot, Cross, Normal, MakeVector, BreakVector, FindLookAtRotation...`
- **Flow Control**: `Branch, Sequence, ForLoop, Gate, DoOnce, FlipFlop...`
- **String**: `Concat, Len, Contains, ToUpper...`
- **Utilities**: `PrintString, Delay, GetGameTime, IsValid, LineTraceByChannel...`
- **System**: `GetPlatformName, QuitGame, GetPlayerPawn...`

Используй его чтобы LLM не выдумывала несуществующие ноды.

---

## 📖 Примеры

### Пример 1 — промпт для нейросети

```
Хочу нодовую структуру: проверка му колес.
Если StaticMu > DynamicMu то вызвать F_UpdateGraphics,
иначе установить StaticMu = 0.5.
Добавь reroute ноды и комментарий "Wheel mu logic".
```

**Ожидаемый ответ сети (вставляется в UE):**
```text
Begin Object Class=/Script/BlueprintGraph.K2Node_VariableGet Name="K2Node_VariableGet_38" ...
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_PromotableOperator Name="K2Node_PromotableOperator_25" ...
End Object
...
```

Полный пример в `examples/wheel-mu.txt`.

### Пример 2 — дать сети текущий граф как контекст

```js
import { generateCompact } from './src/generator.js'
const context = generateCompact(graphs['EventGraph'].nodes)
// Отправь сети:
// "Вот текущий граф:\n" + context + "\n\nДобавь ветвление для проверки IsValid"
// Сеть вернет обновленный Begin Object, который ты вставишь обратно
```

---

## 🛠 API парсера

```js
import { parseToGraphs, generateUEText, generateJSON } from './src/parser.js'

// UE → Граф
const graphs = parseToGraphs(ueText)
// graphs = { EventGraph: {nodes:[...]}, "84F04E6F..._Graph": {nodes:[...]} }

// Граф → UE (для вставки в движок)
const ueText2 = generateUEText(graphs['EventGraph'].nodes)

// Граф → JSON (для нейросети)
const json = generateJSON(selectedNodes)
```

**Особенности:**
- Поддерживает вложенные `K2Node_Composite` (Collapsed Graph) — двойной клик для входа
- `EdGraphNode_Comment` с `NodeWidth/Height` — тащит содержимое при перетаскивании
- `K2Node_Knot` — reroute
- `K2Node_Tunnel` внутри Composite — entry/exit

---

## 🌐 Даташит функций UE

Полный список взят из:
- `UKismetMathLibrary` — https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Kismet/UKismetMathLibrary
- `UKismetSystemLibrary`
- `UGameplayStatics`
- `UKismetStringLibrary`

Актуально для **UE 5.3 — 5.8**. Если нужна функция из 5.5+, добавь её в `data/ue-functions.json` в том же формате:

```json
{
  "id": "MyCustomFunc",
  "title": "My Custom Func",
  "category": "Custom",
  "className": "/Script/BlueprintGraph.K2Node_CallFunction",
  "func": "MyCustomFunc",
  "pins": [
    {"name": "execute", "dir": "Input", "cat": "exec"},
    {"name": "ReturnValue", "dir": "Output", "cat": "real"}
  ]
}
```

---

## 🤝 Для контрибьюторов

1. Форкни репо
2. Добавь новые ноды в `data/ue-functions.json`
3. Проверь что `index.html` парсит твой пример (вставь из UE)
4. PR с примером в `examples/`

---

## 📄 Лицензия

MIT — делай что хочешь, указывай авторство.

---

## 🔗 Связанные проекты

- [text-to-cad](https://github.com/earthtojake/text-to-cad) — вдохновение (набор инструментов для LLM → CAD)
- [Unreal Engine Blueprint Docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-visual-scripting-in-unreal-engine)

> **Хочешь такую нодовую структуру?** Скинь ссылку на это репо нейросети и скажи: *«Сгенерируй Blueprint граф в формате Begin Object, используя реестр из data/ue-functions.json и system-prompt.md»* — получишь готовый код для `Ctrl+V` в UE.

## Конструктор модулей — `tools/make-node.mjs`

Собирает узлы по параметрам (любые классы, события, делегаты, функции реестра), а не по фиксированным примерам. Библиотека: `src/modules.js`.

```bash
node tools/make-node.mjs [--chain] [--title "коммент"] [-o out.txt] "<спека>" ...
```

| Спека | Узел |
|---|---|
| `cast <Класс> [class] [pure]` | Cast To (объект / класс / pure) |
| `event <Имя> [Парам:тип ...]` | Custom Event с параметрами |
| `event-for <Класс.Делегат> <Имя>` | Custom Event с сигнатурой делегата |
| `call-event <Имя> [Парам=значение ...]` | вызов своего события |
| `bind` / `unbind` / `clear <Класс.Делегат>` | Bind / Unbind / Unbind all |
| `create-event <Функция>` | Create Event |
| `widget <WBP-путь \| none>` | Create Widget (класс WBP; `none` — выбрать в движке) |
| `ia-event <IA> [bool\|float\|vector2d\|vector]` | Событие Enhanced Input любого IA (`IA_Jump` → `/Game/Input/Actions/IA_Jump`) |
| `ia-value <IA> [тип]` | Pure «Get IA_X» — значение действия |
| `call <Класс.Функция> [pure] [static] Пин:тип[=v] … [-> Выход:тип …]` | Любая UFUNCTION, даже не из реестра (член → видимый self, static → библиотека) |
| `row` | следующий узел — с нового ряда (номер узла не занимает) |
| `get` / `set <Класс.Свойство> <тип> [значение]` | Get/Set свойства любого класса (`set PlayerController.bShowMouseCursor bool true`) |
| `fn <id или функция реестра> [Пин=значение ...]` | любой узел реестра |
| `link <i>.<Пин> <j>.<Пин>` | связь (номера узлов с 1, `As*` — префикс) |

- Классы: `Actor`, `/Script/Module.Class`, `/Game/Path/BP_X`.
- Типы: `bool int int64 byte float string name text vector rotator transform vector2d linearcolor hitresult key timerhandle`, `object:Класс`, `class:Класс`, `enum:EИмя`; суффикс `[]` означает массив.
- Делегаты движка берутся из таблицы `DELEGATES` в `src/modules.js`:
  - Actor: BeginOverlap, EndOverlap, Destroyed, Hit, TakeAnyDamage.
  - PrimitiveComponent: ComponentBeginOverlap, ComponentEndOverlap, ComponentHit.
- Для BP-диспетчера сигнатура выводится из владельца, параметры задаются в спеке: `bind /Game/BP_Door.OnOpened Who:object:Actor`.
- Для другого нативного делегата: `--sig /Script/Module.SigName Парам:тип ...`.
- `--chain` делает две вещи:
  - соединяет exec по порядку спек (`then` → `execute`); **каждое событие** (`event`, `event-for`, `ia-event`) начинает
    свою цепочку и, начиная со второго, новый ряд; узлы, идущие до первого события, подхватывает первое событие;
  - подключает выходы `event-for` / `create-event` к свободным входам Delegate.
- Ошибки ввода (неизвестный тип, делегат, пин, запись реестра) останавливают генерацию с сообщением, а не выдают сломанный текст.

Пример:

```bash
node tools/make-node.mjs --chain "event Go" "cast /Game/BP/BP_Enemy" "fn Delay Duration=1.5"
```

### Декор раскладки (опционально)
`--wrap N` / `--width PX` — перенос исполняемых узлов на новые ряды; `--decorate` — exec-связи на переносе
идут через 2 reroute-knot'а в коридоре между рядами (первый — соосно выходу последней ноды ряда, правый край + 16;
второй — над входом первой ноды следующего ряда), события встают в ряд перед своими узлами, pure/данные — подрядом
под своим потребителем. Горизонтальный knot-offset — 16px; вертикальный шаг между видимыми pin-строками — 32px
(калиброван по copy-back `K2Node_Composite`, 6 выходов). Y может смещаться от сетки для точного совпадения центров пинов.
Без флагов раскладка прежняя. Тест collapsed-графа с 4 входами/5 выходами и 16 свободными Knot-пробами (две колонки Knot с каждой стороны, центральной нет):
`node tools/gen-collapsed-knot-test.mjs` → `sweep/collapsed-knot-4x5-test.txt`. Число входов/выходов и уровней задаётся флагами; например `node tools/gen-collapsed-knot-test.mjs --inputs 1 --outputs 3 --levels 3` строит `sweep/collapsed-knot-1x3-3levels-test.txt`: уровни Knot-ов рекурсивно делят интервалы между соседними pin centers, добавляя каждый уровень на 16px наружу. Следующий уровень не создаётся, если на текущем один Knot.
Ширина нод оценивается по геометрии редактора (`estNodeWidth`: шапка «Заголовок / Target is Класс» против тела пинов
с виджетами дефолтов) — движок ширину не сериализует, поэтому это оценка ±1 клетка сетки.

Валидатор (`node src/validate.js файл`) отдельно ловит связи, которые движок отвергает при компиляции — **E20**:
exec-выход с двумя связями, выход↔выход, пин на собственную ноду, петля из knot'ов (типичный результат
перепечатанной руками вставки — копируйте текст из файла дословно).

```
node tools/make-node.mjs --chain --wrap 3 --decorate "event Go" "fn Delay" "fn PrintString" "fn Delay" "fn PrintString"
```
