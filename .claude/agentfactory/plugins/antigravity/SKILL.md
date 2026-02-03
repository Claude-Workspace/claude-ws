# Antigravity Plugin for Claude.ws

## Overview

Plugin to integrate CLIProxyAPI-like OAuth flow with Antigravity API for Claude.ws, enabling:
- OAuth authentication (like CLIProxyAPI)
- Model extraction from providers (Claude, OpenAI Codex, Gemini, Qwen, etc.)
- Environment configuration (.env overwrite)
- Provider routing and model mapping
- Secure token management

## Features

### 1. OAuth Authentication (CLIProxyAPI Style)
- Support for multiple providers: Claude, OpenAI Codex, Gemini, Qwen, iFlow, Amp
- OAuth 2.0 flow (authorization code → access token)
- Token refresh mechanism
- Secure token storage (encrypted)
- Multi-account support with load balancing

### 2. Provider Routing
- Route requests through CLIProxyAPI
- Automatic provider fallback
- Model alias mapping (e.g., `claude-opus` → `gpt-4` via CLIProxyAPI)
- Smart routing based on availability and pricing

### 3. Model Extraction
- List models from all configured providers
- Cache model metadata locally (1 hour TTL)
- Model capabilities filtering
- Provider-specific features

### 4. Environment Integration
- Overwrite Claude.ws .env with mapped models
- Automatic backup before changes
- Safe rollback mechanism
- Provider switching support

### 5. Image Generation
- Generate images via CLIProxyAPI (OpenAI Codex, DALL-E)
- Custom resolution, steps, style presets
- Progress tracking with CLIProxyAPI websocket
- Cost estimation

## Installation

### Prerequisites
- Claude.ws with Agent Factory enabled
- CLIProxyAPI account (for OAuth)
- Node.js 20+
- Axios (for HTTP requests)
- Crypto (for token encryption)

### Setup

1. Copy plugin to `.claude/agentfactory/plugins/antigravity/`
2. Enable plugin in Claude.ws Agent Factory
3. Run `/antigravity oauth --provider <provider>` to authenticate
4. Run `/antigravity configure` to apply models to Claude.ws environment

## Commands

| Command | Description |
|---------|-------------|
| `/antigravity oauth --provider <provider>` | Authenticate with CLIProxyAPI OAuth for specified provider |
| `/antigravity list providers` | List all available CLIProxyAPI providers |
| `/antigravity list models --provider <provider>` | List models from specific provider |
| `/antigravity list models --all` | List all models from all providers |
| `/antigravity configure` | Configure provider routing and model mapping for Claude.ws |
| `/antigravity backup` | Backup current .env file |
| `/antigravity restore` | Restore .env from backup |

## Skills

| Skill | Description |
|-------|-------------|
| `/antigravity generate <prompt>` | Generate image using CLIProxyAPI (OpenAI Codex, DALL-E) |

## Providers

| Provider ID | Name | Models | Features |
|-------------|------|--------|----------|
| claude | Claude Code | claude-3-5-sonnet, claude-3-5-opus | chat, code, vision |
| openai | OpenAI Codex | gpt-4, gpt-4-turbo, gpt-3.5-turbo | chat, code, function_calling |
| gemini | Gemini Pro | gemini-pro, gemini-ultra-vision | chat, vision, code |
| qwen | Qwen Code | qwen-turbo, qwen-plus | chat, code |
| iflow | iFlow Code | iflow-v1 | chat, code |
| amp | Amp Models | amp-7b, amp-chat | chat, code |

## Configuration

### CLIProxyAPI Integration
```bash
# CLIProxyAPI endpoint
CLI_PROXY_API_ENDPOINT=https://router-for.me/api/v1

# OAuth Configuration
CLI_PROXY_OAUTH_CLIENT_ID=<your_client_id>
CLI_PROXY_OAUTH_CLIENT_SECRET=<your_client_secret>
CLI_PROXY_OAUTH_REDIRECT_URI=https://your-app.com/callback
```

### Provider Configuration
```bash
# Active provider for Claude.ws
ACTIVE_PROVIDER=claude

# Model mapping (Claude model → CLIProxyAPI model)
MODEL_MAP_CLAUDE_OPUS=claude-opus
MODEL_MAP_CLAUDE_SONNET=claude-sonnet
```

### Environment Variables (Applied to Claude.ws .env)
```bash
# Provider Routing
CLAUDE_WS_PROVIDER=cliproxyapi
CLAUDE_WS_API_ENDPOINT=https://router-for.me/api/v1

# OAuth Tokens
CLAUDE_WS_OAUTH_TOKEN=<encrypted_token>
CLAUDE_WS_OAUTH_REFRESH_TOKEN=<encrypted_refresh_token>

# Model Mapping
CLAUDE_WS_CLAUDE_MODEL=claude-opus
CLAUDE_WS_IMAGE_MODEL=gpt-4

# Provider Configuration
CLAUDE_WS_ACTIVE_PROVIDER=claude
CLAUDE_WS_PROVIDER_CAPABILITIES=chat,code,vision
```

## Usage Examples

### OAuth Authentication
```bash
# Authenticate with Claude
/antigravity oauth --provider claude

> Redirecting to CLIProxyAPI OAuth...
> Visit: https://console.anthropic.com/oauth/authorize?client_id=xxx...
> Approve access...

✓ Successfully authenticated with Claude via CLIProxyAPI!
✓ Access token stored securely
✓ Session expires in 24h
```

### List Providers
```bash
/antigravity list providers

=== Available Providers ===
1. claude - Claude Code
   - Models: claude-3-5-sonnet, claude-3-5-opus
   - Features: chat, code, vision
   - OAuth: ✓

2. openai - OpenAI Codex
   - Models: gpt-4, gpt-4-turbo, gpt-3.5-turbo
   - Features: chat, code, function_calling, multimodal
   - OAuth: ✓

[...]
```

### List Models from Specific Provider
```bash
/antigravity list models --provider openai

=== OpenAI Models (via CLIProxyAPI) ===
1. gpt-4-turbo
   - Type: claude-compatible
   - Context: 8192 tokens
   - Input: $0.01/1K tokens
   - Output: $0.03/1K tokens
   - Capabilities: chat, code, function_calling

2. gpt-3.5-turbo
   - Type: claude-compatible
   - Context: 16384 tokens
   - Input: $0.0035/1K tokens
   - Output: $0.015/1K tokens
   - Capabilities: chat, code, multimodal

[...]
```

### Configure Provider and Models
```bash
/antigravity configure

=== Provider Configuration ===

Select active provider:
1. claude (Claude Code) - Recommended
2. openai (OpenAI Codex)
3. gemini (Gemini Pro)
4. qwen (Qwen Code)
5. iflow (iFlow Code)
6. amp (Amp Models)

Select provider [1]: 1

=== Model Mapping ===

Claude models available via CLIProxyAPI:
1. claude-opus (recommended)
2. claude-sonnet

Map Claude model -> CLIProxyAPI model:
- claude-opus → claude-3-5-opus-20241022
- claude-sonnet → claude-3-5-sonnet-20241022

Select Claude model for Claude.ws [1]: 1

Select image generation provider:
1. openai (OpenAI Codex) - Recommended
2. gemini (Gemini Pro)

Select image provider [1]: 1

=== Provider Routing ===

CLIProxyAPI endpoint: https://router-for.me/api/v1
Provider alias mapping:
  - claude → CLIProxyAPI (provider: claude)
  - openai → CLIProxyAPI (provider: openai)
  - gemini → CLIProxyAPI (provider: gemini)

✓ Provider configuration saved!

=== Proposed Changes ===

Claude model:
  Current: Not set
  New: claude-opus

Image model:
  Current: Not set
  New: gpt-4-turbo (via CLIProxyAPI)

Apply these changes? [y/N]: y

✓ Backed up .env → .env.backup.20250203_091500
✓ Updated .env with CLIProxyAPI configuration
✓ CLAUDE_WS_PROVIDER=cliproxyapi
✓ CLAUDE_WS_CLAUDE_MODEL=claude-opus
✓ CLAUDE_WS_IMAGE_MODEL=gpt-4-turbo
✓ Reloading Claude.ws...

✓ Provider integration active!
✓ Routing requests through CLIProxyAPI
✓ Models mapped and ready for use

Next:
- /antigravity generate <prompt> - Generate image via CLIProxyAPI
- Check provider status
- Monitor usage and quotas
```

### Image Generation via CLIProxyAPI
```bash
/antigravity generate "A beautiful sunset over mountains"

=== Generating Image ===
Provider: openai (via CLIProxyAPI)
Model: gpt-4-turbo
Prompt: "A beautiful sunset over mountains"
Resolution: 1024x1024
Steps: 30

[████████████████] 100%

✓ Image generated successfully!
✓ Saved to: ./generated/cliproxyapi_20250203_092000.png
✓ Size: 2.3 MB
✓ Time: 8.2s
✓ Cost: $0.012

Preview: [image thumbnail]

Next: /antigravity generate <prompt> - Generate another
```

### Switch Providers
```bash
/antigravity configure --switch-provider openai

=== Switch Provider ===

Current provider: claude
New provider: openai

This will:
- Switch routing to OpenAI via CLIProxyAPI
- Remap models to OpenAI equivalents
- Backup current configuration
- Apply new provider settings

Switch provider? [y/N]: y

✓ Backed up .env → .env.backup.20250203_092000
✓ Switched provider: claude → openai
✓ Remapped models: claude-sonnet → gpt-4-turbo
✓ Updated routing configuration
✓ Provider switched successfully!

Next:
- /antigravity list models --provider openai - View OpenAI models
- Test new configuration
- /antigravity backup - Create additional backup
```

## Architecture

### Provider Routing System
```
Claude.ws App
  ↓
Antigravity Plugin
  ↓
CLIProxyAPI (Proxy Server)
  ├─ Claude Code (OAuth)
  ├─ OpenAI Codex (OAuth)
  ├─ Gemini Pro (OAuth)
  ├─ Qwen Code (OAuth)
  ├─ iFlow Code (OAuth)
  └─ Amp Models (OAuth)
  ↓
AI Models
  ↓
Back to Claude.ws with mapped responses
```

### Model Mapping
```javascript
const modelMapping = {
  // Claude models → CLIProxyAPI provider models
  'claude-opus': {
    provider: 'claude',
    alias: 'claude-3-5-opus-20241022'
  },
  'claude-sonnet': {
    provider: 'claude',
    alias: 'claude-3-5-sonnet-20241022'
  },

  // CLIProxyAPI provider models (e.g., OpenAI Codex)
  'gpt-4-turbo': {
    provider: 'openai',
    alias: 'gpt-4-0125-preview'
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    alias: 'gpt-3.5-turbo-0125'
  }
};
```

## Security

- ✅ OAuth 2.0 flow with PKCE
- ✅ All tokens encrypted at rest (AES-256-GCM)
- ✅ HTTPS only for API calls
- ✅ Tokens stored securely via CLIProxyAPI
- ✅ Sessions have limited lifetime (24h default)
- ✅ Automatic token refresh via CLIProxyAPI
- ✅ Safe .env backup before changes
- ✅ Secure rollback mechanism

## Performance

- ✅ Model list caching (1 hour TTL)
- ✅ Provider-specific API optimization
- ✅ Intelligent routing based on availability
- ✅ Load balancing across multiple accounts
- ✅ Rate limiting and quota management via CLIProxyAPI
- ✅ Efficient environment file operations

## Compatibility

- ✅ Claude.ws with Agent Factory support
- ✅ Node.js 20+
- ✅ Works on Windows, macOS, Linux
- ✅ Compatible with all Claude CLI versions
- ✅ CLIProxyAPI integration tested

## Error Handling

### Common Errors

| Error | Solution |
|-------|----------|
| UNAUTHORIZED | `/antigravity oauth --provider <provider>` - Update credentials |
| INVALID_PROVIDER | `/antigravity list providers` - Check provider name |
| MODEL_NOT_FOUND | `/antigravity list models` - Try different model |
| PROVIDER_DOWN | CLIProxyAPI unavailable - Try fallback provider |
| RATE_LIMITED | `/antigravity generate` - Wait and retry |

### Logging

All operations are logged with appropriate levels:
- `debug`: Detailed API calls and routing
- `info`: User actions and provider status
- `warn`: Rate limiting and provider unavailability
- `error`: Failures and exceptions

## Contributing

To contribute improvements:

1. Fork plugin repository
2. Create feature branch: `git checkout -b feature/improvement`
3. Add new providers or features
4. Test thoroughly with CLIProxyAPI
5. Submit pull request

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Test OAuth flow
npm run test:oauth

# Test provider routing
npm run test:routing

# Test CLIProxyAPI integration
npm run test:cliproxyapi
```

## Documentation Links

### CLIProxyAPI
- Main Docs: https://help.router-for.me/
- Management API: https://help.router-for.me/management/api
- OAuth Flow: https://help.router-for.me/oauth-flow
- SDK Docs: https://help.router-for.me/sdk-usage

### Provider Docs
- Claude: https://console.anthropic.com/docs
- OpenAI: https://platform.openai.com/docs
- Gemini: https://ai.google.dev/docs
- Qwen: https://help.aliyun.com/zh/dashscope

## Roadmap

- [ ] OAuth flow for all CLIProxyAPI providers
- [ ] Real-time image generation progress via WebSocket
- [ ] Batch image generation
- [ ] Image editing skills (inpainting, outpainting)
- [ ] Style library management
- [ ] Usage analytics dashboard
- [ ] Cost optimization suggestions
- [ ] Model comparison tool
- [ ] Custom model fine-tuning via CLIProxyAPI

## License

MIT

## Credits

Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)

## Acknowledgments

This plugin integrates with CLIProxyAPI (https://github.com/router-for-me/CLIProxyAPI)

CLIProxyAPI provides OAuth-based authentication for multiple AI providers including:
- Claude Code
- OpenAI Codex (GPT models)
- Gemini Pro
- Qwen Code
- iFlow Code
- Amp Models

Special thanks to CLIProxyAPI for making this integration possible.
