# Command: List Providers

## Name
`/antigravity list providers`

## Description
List all available CLIProxyAPI providers that can be used for authentication and model access.

## Usage
```
/antigravity list providers
```

## Parameters
None

## Behavior

### Step 1: Query CLIProxyAPI Management API
Request list of all supported providers.

### Step 2: Display Provider Information
Show provider details including:
- Provider ID
- Provider name
- Status (active/inactive)
- Capabilities (chat, code, vision, image_generation, etc.)
- OAuth support
- Models available

## Output

### Success - All Providers
```
=== Available CLIProxyAPI Providers ===

1. claude - Claude Code (Anthropic)
   Status: ✓ Active
   OAuth: ✓ Supported
   Capabilities: chat, code, vision, analysis
   Models: claude-3-5-opus, claude-3-5-sonnet, claude-3-haiku

2. openai - OpenAI Codex (GPT Models)
   Status: ✓ Active
   OAuth: ✓ Supported
   Capabilities: chat, code, function_calling, multimodal
   Models: gpt-4, gpt-4-turbo, gpt-3.5-turbo

3. gemini - Gemini Pro (Google)
   Status: ✓ Active
   OAuth: ✓ Supported
   Capabilities: chat, code, vision, video
   Models: gemini-pro, gemini-ultra-vision

4. qwen - Qwen Code (Alibaba)
   Status: ✓ Active
   OAuth: ✓ Supported
   Capabilities: chat, code
   Models: qwen-turbo, qwen-plus, qwen-max

5. iflow - iFlow Code
   Status: ✓ Active
   OAuth: ✓ Supported
   Capabilities: chat, code
   Models: iflow-v1, iflow-turbo

6. amp - Amp Models
   Status: ✓ Active
   OAuth: ✓ Supported
   Capabilities: chat, code
   Models: amp-7b, amp-chat

Total: 6 providers available

Cached at: 2025-02-03 09:20:00

Next:
- /antigravity oauth --provider <provider> - Authenticate with specific provider
- /antigravity list models --provider <provider> - List models from provider
- /antigravity configure --provider <provider> - Configure provider
```

### Filtered Results
```bash
# Show only active providers
/antigravity list providers --active

=== Active Providers ===
3/6 providers active

1. claude (Active)
   - OAuth: ✓
   - Models: 12 available

2. gemini (Active)
   - OAuth: ✓
   - Models: 5 available

3. openai (Active)
   - OAuth: ✓
   - Models: 8 available
```

### Provider Details
```bash
/antigravity list providers --details

=== Provider Details ===

1. claude - Claude Code
   - Provider ID: claude
   - Base URL: https://console.anthropic.com
   - OAuth Endpoint: https://console.anthropic.com/oauth/authorize
   - Token Endpoint: https://console.anthropic.com/oauth/token
   - Models Endpoint: https://api.anthropic.com/v1/models
   - Chat Endpoint: https://api.anthropic.com/v1/messages
   - Capabilities: chat, code, vision, analysis
   - OAuth Scopes: read, write, model_selection
   - OAuth Response Type: code

2. openai - OpenAI Codex
   - Provider ID: openai
   - Base URL: https://api.openai.com
   - OAuth Endpoint: https://auth0.openai.com/authorize
   - Token Endpoint: https://api.openai.com/v1/oauth/token
   - Models Endpoint: https://api.openai.com/v1/models
   - Chat Endpoint: https://api.openai.com/v1/chat/completions
   - Capabilities: chat, code, function_calling, multimodal
   - OAuth Scopes: model.read, model.write, function.calling
   - OAuth Response Type: code

[...]
```

## Options

### Active Only
```bash
# Show only active providers
/antigravity list providers --active
```

### Filter by Capability
```bash
# Show only providers with image generation
/antigravity list providers --capability image_generation

# Show only providers with vision
/antigravity list providers --capability vision
```

### JSON Output
```bash
# Output in JSON format
/antigravity list providers --format json

{
  "providers": [
    {
      "id": "claude",
      "name": "Claude Code",
      "status": "active",
      "capabilities": ["chat", "code", "vision"],
      "oauth": true
    },
    {
      "id": "openai",
      "name": "OpenAI Codex",
      "status": "active",
      "capabilities": ["chat", "code", "function_calling", "multimodal"],
      "oauth": true
    }
  ]
}
```

## Implementation Notes

### CLIProxyAPI API
```javascript
async function listProviders() {
  const response = await fetch('https://router-for.me/api/v1/providers');
  const data = await response.json();
  return data.providers;
}
```

### Caching Strategy
```javascript
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getCachedProviders() {
  const cached = await getFromCache('providers');
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}
```

### Provider Object Structure
```typescript
interface Provider {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'deprecated';
  capabilities: string[];
  oauth: boolean;
  models: number;
  base_url: string;
  oauth_endpoint: string;
  token_endpoint: string;
  models_endpoint: string;
  chat_endpoint: string;
  image_endpoint: string;
  scopes: string[];
  pricing: {
    currency: string;
    input_token_cost: number;
    output_token_cost: number;
  };
  rate_limits: {
    rpm: number;
    tpm: number;
  };
}
```

## Error Handling

### API Error
```
✗ Failed to fetch providers

Error: Could not connect to CLIProxyAPI Management API

Please check:
- Internet connection
- CLIProxyAPI status: https://status.router-for.me
- Your CLIProxyAPI account

Or try again later.
```

### No Providers Found
```
✗ No providers available

Error: No providers returned from CLIProxyAPI

This might indicate:
- CLIProxyAPI service is down
- Your account does not have access to any providers
- Configuration error

Please contact CLIProxyAPI support.
```

## Usage Examples

### List All Providers
```bash
/antigravity list providers

=== Available Providers ===

1. claude - Claude Code
   Status: Active
   OAuth: Supported

[...]
```

### List Active Providers Only
```bash
/antigravity list providers --active

=== Active Providers ===

3/6 providers active
1. claude (Active)
2. gemini (Active)
3. openai (Active)
```

### JSON Output
```bash
/antigravity list providers --format json

{
  "providers": [
    {
      "id": "claude",
      "name": "Claude Code",
      "status": "active",
      "capabilities": ["chat", "code", "vision"],
      "oauth": true
    }
  ]
}
```

### Provider Search
```bash
/antigravity list providers --search claude

=== Search Results ===

Found 1 provider matching "claude":

claude - Claude Code
  Status: Active
  OAuth: Supported
  Capabilities: chat, code, vision, analysis
```

## Next Steps

After listing providers, you can:

1. **Authenticate with Provider**
   ```bash
   /antigravity oauth --provider claude
   ```

2. **List Models from Provider**
   ```bash
   /antigravity list models --provider claude
   ```

3. **Configure Provider**
   ```bash
   /antigravity configure --provider claude
   ```

## See Also

- `/antigravity oauth` - Authenticate with CLIProxyAPI OAuth
- `/antigravity list models` - List models from providers
- `/antigravity configure` - Configure provider routing and model mapping

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)

## Acknowledgments

Provider listing via CLIProxyAPI (https://github.com/router-for-me/CLIProxyAPI)
