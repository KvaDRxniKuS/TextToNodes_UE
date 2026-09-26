# MCP server

`mcp/server.js` exposes Blueprint-oriented tools over stdio using the Model Context Protocol SDK. The server currently registers `blueprint_generate`, `blueprint_parse`, `blueprint_validate`, and `ue_functions_search`. `blueprint_generate` is only a prompt-returning placeholder: there is no LLM call in this server, so it does not actually generate Blueprint code.

## Requirements and start

Use Node.js with ES module support. The MCP SDK is an optional integration dependency and is not installed by the core `npm test` setup:

```bash
npm install @modelcontextprotocol/sdk
node mcp/server.js
```

Configure the host application with an absolute path to this repository's `mcp/server.js`, for example:

```json
{
  "mcpServers": {
    "ue-blueprint-toolkit": {
      "command": "node",
      "args": ["/absolute/path/to/TextToNodes_UE/mcp/server.js"]
    }
  }
}
```

Restart the MCP host after changing its configuration. The server does not launch Unreal Editor or prove that returned Blueprint Text compiles; use `blueprint_validate` for structural checks and verify final output in UE.
