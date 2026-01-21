# CLAUDE.md

Project-specific instructions for Claude Code.

## Language Rule

**Always respond in English, regardless of the user's input language.**

- All responses must be in English
- All code changes, comments, and documentation must be in English
- Even if the user communicates in another language, respond in English

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

Dont try start run dev when finish a conversation only when you are asked to.

## Dependencies Management

**CRITICAL: NO devDependencies - ONLY dependencies**

- **NEVER** add packages to `devDependencies`
- **ALWAYS** add ALL packages to `dependencies` only
- This is a published npm package - all imports must be available in production
- Production code imports from devDependencies will cause build failures
- The `scripts/check-dependencies.sh` script validates this rule before builds

**Why:** When users install this package via npm, devDependencies are not installed. Any production code importing from devDependencies will fail at runtime.