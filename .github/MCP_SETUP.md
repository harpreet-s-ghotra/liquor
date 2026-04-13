# MCP Setup Conventions

This repository keeps shared MCP server definitions in `.vscode/mcp.json` so all contributors can use the same tools.

## Figma MCP

Configured server:

- `figma` → `https://mcp.figma.com/mcp`

## Finix MCP

- `finix` -> `{
    "mcpServers": {
        "finix-redocly-mcp": {
            "type": "http",
            "url": "https://docs.finix.com/mcp"
        }
    }
}`

## Notes

- Keeping agent instructions in `.github` is common.
- MCP config location is client-dependent; for this project we use workspace-level VS Code config in `.vscode/mcp.json`.
