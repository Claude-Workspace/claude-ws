# CLAUDE.md

Project-specific instructions for Claude Code.

## Plugins

**MUST use `agent-sdk-dev` plugin** when working with Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`).

This plugin provides:
- `/new-sdk-app` command to scaffold new SDK applications
- `agent-sdk-verifier-ts` agent to verify TypeScript SDK apps
- `agent-sdk-verifier-py` agent to verify Python SDK apps

Use it for:
- Creating new Agent SDK projects
- Verifying SDK usage and best practices
- Debugging SDK integration issues
