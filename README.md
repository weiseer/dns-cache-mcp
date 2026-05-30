# @weiseer/dns-cache-mcp

> DNS/WHOIS/SSL/geo-IP cache MCP server for AI agents. stdio MCP server.

Part of [weiseer](https://github.com/weiseer) — AI-agent-native cached oracles.

## Install

```bash
npm install -g @weiseer/dns-cache-mcp
```

## Use with Claude Desktop / Cursor / Cline / Continue / Windsurf

```json
{
  "mcpServers": {
    "dns-cache": {
      "command": "npx",
      "args": ["-y", "@weiseer/dns-cache-mcp"]
    }
  }
}
```

## Why use this instead of your agent doing it itself

The DIY cost in token-spend, latency, and rate-limit risk is 100-1500x our cost. See the [weiseer organization README](https://github.com/weiseer/.github) for the economic argument.

## Environment

- `DNS_CACHE_URL` — override remote snapshot URL
- `DNS_CACHE_LOCAL_ONLY=1` — skip remote fetch

## License

Apache-2.0
