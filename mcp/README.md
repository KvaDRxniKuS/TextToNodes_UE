# MCP Server

Даёт Claude Desktop / Cursor доступ к toolkit как у NeoStack.

## Установка

```bash
npm i @modelcontextprotocol/sdk
node mcp/server.js
```

## Подключение к Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ue-blueprint-toolkit": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.js"]
    }
  }
}
```

Инструменты: `blueprint_generate`, `blueprint_parse`, `blueprint_validate`, `ue_functions_search`
