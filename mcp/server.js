#!/usr/bin/env node
// MCP Server — UE Blueprint Toolkit
// Даёт LLM доступ к инструментам как у NeoStack, но открыто и локально.
// Запуск: node mcp/server.js  (подключается к Claude Desktop / Cursor / ChatGPT MCP)
// Требует: npm i @modelcontextprotocol/sdk

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseToGraphs, generateUEText } from "../src/parser.js";
import { validateStrict } from "../src/validate.js";
import fs from "fs";

const server = new Server({ name: "ue-blueprint-toolkit", version: "1.0.0" }, { capabilities: { tools: {} } });

// Загружаем реестр функций UE
const UE_FUNCS = JSON.parse(fs.readFileSync(new URL("../data/ue-functions.json", import.meta.url)));

server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "blueprint_generate",
      description: "Сгенерировать Blueprint граф в формате Begin Object из текстового описания. Валидирует и возвращает код для Ctrl+V в UE. Используй реестр UE_FUNCS для подсказок.",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "Описание логики, например: если StaticMu > DynamicMu то вызвать F_UpdateGraphics" },
          variables: { type: "array", items: { type: "string" }, description: "Имена переменных, например [StaticMu, DynamicMu]" }
        },
        required: ["description"]
      }
    },
    {
      name: "blueprint_parse",
      description: "Распарсить скопированный из UE текст Begin Object и вернуть JSON графа для анализа/изменения.",
      inputSchema: {
        type: "object",
        properties: { ueText: { type: "string" } },
        required: ["ueText"]
      }
    },
    {
      name: "blueprint_validate",
      description: "СТРОГО валидировать Blueprint текст перед вставкой в UE: баланс Begin/End, GUID, двусторонние связи, MemberParent, StructType, MacroInstance, Delay/then, запрещённые классы. Возвращает errors (чинить обязательно) и warnings.",
      inputSchema: { type: "object", properties: { ueText: { type: "string" } }, required: ["ueText"] }
    },
    {
      name: "ue_functions_search",
      description: "Найти функции UE по ключевому слову (как палитра ПКМ в редакторе). Возвращает ноды KismetMathLibrary и т.д.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
    }
  ]
}));

server.setRequestHandler("tools/call", async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "blueprint_parse") {
    const graphs = parseToGraphs(args.ueText);
    return { content: [{ type: "text", text: JSON.stringify(graphs, null, 2) }] };
  }
  if (name === "blueprint_validate") {
    const v = validateStrict(args.ueText);
    return { content: [{ type: "text", text: JSON.stringify(v, null, 2) }] };
  }
  if (name === "ue_functions_search") {
    const q = args.query.toLowerCase();
    const found = UE_FUNCS.filter(f => f.title.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || f.func.toLowerCase().includes(q));
    return { content: [{ type: "text", text: JSON.stringify(found.slice(0, 20), null, 2) }] };
  }
  if (name === "blueprint_generate") {
    // В реальном сервере здесь вызов LLM с system-prompt.md
    // Заглушка: возвращаем инструкцию как использовать промпт
    const prompt = fs.readFileSync(new URL("../prompt/system-prompt.md", import.meta.url), "utf8");
    return {
      content: [{
        type: "text",
        text: `Используй этот System Prompt для генерации Begin Object:\n\n${prompt.slice(0, 4000)}\n\nЗапрос: ${args.description}\nПеременные: ${(args.variables||[]).join(", ")}\n\nСгенерируй блоки Begin Object ... End Object с шагом 240/160 и двусторонними LinkedTo.`
      }]
    };
  }
  throw new Error(`Unknown tool ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("UE Blueprint Toolkit MCP running — tools: blueprint_generate, blueprint_parse, blueprint_validate, ue_functions_search");
