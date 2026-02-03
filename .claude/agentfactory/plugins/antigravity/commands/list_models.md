# Command: List Models

## Name
`/antigravity list models --provider <provider>`

## Description
List all available models from specific CLIProxyAPI provider with caching and details.

## Usage
```
/antigravity list models --provider <provider>
/antigravity list models --all
```

## Parameters

### Required
- `--provider <id>` - Provider to list models from

**Supported providers:**
- `claude` - Claude Code (Anthropic)
- `openai` - OpenAI Codex (GPT models)
- `gemini` - Gemini Pro (Google)
- `qwen` - Qwen Code (Alibaba)
- `iflow` - iFlow Code
- `amp` - Amp Models

### Optional
- `--all` - List models from all providers
- `--available` - Show only available models (exclude unavailable)
- `--details` - Show full model details (capabilities, pricing, etc.)
- `--json` - Output in JSON format
- `--refresh` - Force refresh of model list cache

## Behavior

### Step 1: Check Authentication
Verify user is authenticated with CLIProxyAPI for specified provider.
Display session info if logged in.

### Step 2: Fetch Models
Request model list from CLIProxyAPI for specified provider.
Use cached data if available (1 hour TTL) and `--refresh` not set.

### Step 3: Display Models
Show models with details organized by provider and model type.

## Output

### Success - Single Provider
```bash
/antigravity list models --provider claude

=== Claude Models (via CLIProxyAPI) ===
Cached at: 2025-02-03 09:15:00
Total: 12 models

1. claude-3-5-sonnet-20241022
   - Context: 200K tokens
   - Input: $3.00/m tokens
   - Output: $15.00/m tokens
   - Capabilities: chat, code, vision, analysis
   - Status: Available

2. claude-3-5-opus-20241022
   - Context: 200K tokens
   - Input: $15.00/m tokens
   - Output: $75.00/m tokens
   - Capabilities: chat, code, vision, analysis
   - Status: Available

[... 10 more models]

Image Models (via CLIProxyAPI routing):
Total: 4 models

1. dall-e-3
   - Type: text-to-image
   - Resolution: 1024x1024, 1024x1792, 1792x1024
   - Quality: standard, hd
   - Status: Available

2. dall-e-2
   - Type: text-to-image
   - Resolution: 256x256, 512x512
   - Quality: standard, hd
   - Status: Available

[... 2 more models]

Next:
- /antigravity configure --provider claude - Apply models to Claude.ws
- /antigravity generate <prompt> --provider claude - Generate image with DALL-E
```

### Success - All Providers
```bash
/antigravity list models --all

=== All Models (All Providers) ===
Total: 36 models from 6 providers

Claude Models (12 models):
[... list ...]

OpenAI Codex (8 models):
- gpt-4
- gpt-4-turbo
- gpt-3.5-turbo
- o1-mini
- o1-preview
- o1-preview-mini
- o1-preview-vision

Gemini Pro (5 models):
- gemini-pro
- gemini-pro-vision
- gemini-1.5-pro
- gemini-ultra
- gemini-flash

Qwen Code (4 models):
- qwen-turbo
- qwen-plus
- qwen-max
- qwen-coder

Amp Models (3 models):
- amp-7b
- amp-chat-1.5
- amp-vision

Cached at: 2025-02-03 09:15:00

Next:
- /antigravity configure --provider claude - Configure Claude models
- /antigravity configure --provider openai - Configure OpenAI models
- /antigravity list models --provider gemini --details - View Gemini model details
```

### JSON Output
```bash
/antigravity list models --provider claude --json

{
  "provider": "claude",
  "cached_at": "2025-02-03 09:15:00",
  "claude": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "type": "claude",
      "context": 200000,
      "capabilities": ["text", "code", "vision", "analysis"],
      "pricing": {
        "input": 0.003,
        "output": 0.015
      },
      "status": "available"
    },
    {
      "id": "claude-3-5-opus-20241022",
      "name": "Claude 3.5 Opus",
      "type": "claude",
      "context": 200000,
      "capabilities": ["text", "code", "vision", "analysis"],
      "pricing": {
        "input": 0.015,
        "output": 0.075
      },
      "status": "available"
    }
  ],
  "image": [
    {
      "id": "dall-e-3",
      "name": "DALL-E 3",
      "type": "text-to-image",
      "resolution": {
        "default": "1024x1024",
        "available": ["1024x1024", "1024x1792", "1792x1024"]
      },
      "pricing": {
        "per_image": {
          "1024x1024": 0.04,
          "1024x1792": 0.08
        }
      },
      "status": "available"
    }
  ]
}
```

## Options

### Refresh Cache
```bash
# Force refresh from CLIProxyAPI (ignore cache)
/antigravity list models --refresh
```

### Filtered Results
```bash
# Show only available models
/antigravity list models --available

# Show only Claude models
/antigravity list models --provider claude --claude-only

# Show only image generation models
/antigravity list models --image-only

# Filter by capability
/antigravity list models --capability vision
/antigravity list models --capability code
```

### Output Formats
```bash
# Default: Table format
/antigravity list models --provider claude

# JSON format
/antigravity list models --provider claude --json

# Detailed format
/antigravity list models --provider claude --details
```

## Error Handling

### Not Authenticated
```
✗ Authentication required
✗ Please run: /antigravity oauth --provider <provider>

Your session has expired or you haven't logged in yet.
```

### Invalid Provider
```
✗ Invalid provider: "invalid"

Supported providers:
- claude - Claude Code (Anthropic)
- openai - OpenAI Codex (GPT models)
- gemini - Gemini Pro (Google)
- qwen - Qwen Code (Alibaba)
- iflow - iFlow Code
- amp - Amp Models

Use: /antigravity list models --provider <provider>
```

### Provider Not Available
```
✗ Provider "claude" not available

This might indicate:
- Provider is down for maintenance
- Your account does not have access to this provider
- Provider is blocked in your region

Please try:
- /antigravity list providers - Check provider status
- /antigravity list models --provider <different_provider>
```

### No Models Found
```
✗ No models available

This might indicate:
- Provider does not support model listing
- Configuration error
- API access denied

Please check:
- /antigravity list providers
- /antigravity list models --refresh
- Contact CLIProxyAPI support
```

## Implementation

### Model List Structure
```typescript
interface Model {
  id: string;
  name: string;
  type: 'claude' | 'gpt' | 'gemini' | 'qwen' | 'image';
  context?: number;
  pricing?: {
    input: number;  // $/million tokens
    output: number;  // $/million tokens
    per_image?: Record<string, number>;
  };
  capabilities?: string[];
  status: 'available' | 'unavailable' | 'deprecated';
  resolution?: string[];
  parameters?: {
    max_tokens?: number;
    temperature?: { min: number; max: number };
    top_p?: number;
  };
}

interface ModelsResponse {
  provider: string;
  cached_at: string;
  claude?: Model[];
  gpt?: Model[];
  gemini?: Model[];
  qwen?: Model[];
  image?: Model[];
}
```

### Caching Strategy
```javascript
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getCachedModels(provider) {
  const cached = await getFromCache(`models:${provider}`);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

async function setCachedModels(provider, data) {
  await setToCache(`models:${provider}`, {
    data,
    timestamp: Date.now()
  });
}
```

### CLIProxyAPI Integration
```javascript
async function fetchModelsFromCLIProxyAPI(provider) {
  const token = await getCLIToken();
  
  const response = await fetch('https://router-for.me/api/v1/models', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      provider
    })
  });
  
  const data = await response.json();
  return data;
}
```

### Provider-Specific Mappings
```javascript
const providerMappings = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    modelsEndpoint: '/claude/v1/models',
    chatEndpoint: '/claude/v1/messages'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Codex',
    modelsEndpoint: '/openai/v1/models',
    chatEndpoint: '/openai/v1/chat/completions'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini Pro',
    modelsEndpoint: '/gemini/v1beta/models',
    chatEndpoint: '/gemini/v1beta/generateContent'
  },
  // ... other providers
};
```

## Usage Examples

### List Claude Models
```bash
/antigravity list models --provider claude

=== Claude Models (via CLIProxyAPI) ===
Total: 12 models

1. claude-3-5-sonnet-20241022
   - Context: 200K tokens
   - Input: $3.00/m tokens
   - Output: $15.00/m tokens

[...]
```

### List All Models (With Cache Refresh)
```bash
/antigravity list models --all --refresh

=== Fetching models from all providers ===

Claude Models:
[... list ...]

OpenAI Models:
[... list ...]

Gemini Models:
[... list ...]

Total: 36 models cached at: 2025-02-03 09:20:00
```

### List Models with Full Details
```bash
/antigravity list models --provider openai --details

=== OpenAI Codex Models ===
Total: 8 models

1. gpt-4
   - Type: gpt
   - Context: 8192 tokens
   - Capabilities: chat, code, function_calling, multimodal
   - Pricing: Input: $0.03/1K, Output: $0.06/1K
   - Parameters: Max tokens: 8192, Temp: 0.0-1.0, Top P: 1.0
   - Status: Available

2. gpt-4-turbo
   - Type: gpt
   - Context: 128000 tokens
   - Capabilities: chat, code, function_calling, multimodal
   - Pricing: Input: $0.01/1K, Output: $0.03/1K
   - Parameters: Max tokens: 128000, Temp: 0.0-1.0, Top P: 1.0
   - Status: Available

[... 6 more models]
```

### List Only Available Models
```bash
/antigravity list models --provider gemini --available

=== Gemini Pro Models (Available) ===
Total: 3 models available

1. gemini-pro
   - Capabilities: chat, code, vision
   - Status: Available

2. gemini-1.5-pro
   - Capabilities: chat, code
   - Status: Available

3. gemini-ultra
   - Capabilities: chat, code, vision
   - Status: Available
```

## Testing

### Unit Tests
```javascript
describe('List Models Command', () => {
  it('should list models from provider', async () => {
    const result = await handleListModels({ provider: 'claude' });
    expect(result.success).toBe(true);
    expect(result.models).toBeDefined();
    expect(result.models.claude.length).toBeGreaterThan(0);
  });

  it('should use cached models', async () => {
    // Set cache
    await setCachedModels('claude', mockModels);

    // Fetch (should use cache)
    const result = await handleListModels({ provider: 'claude' });
    expect(result.cached).toBe(true);
  });

  it('should filter by capability', async () => {
    const result = await handleListModels({
      provider: 'claude',
      capability: 'vision'
    });
    expect(result.success).toBe(true);
    expect(result.models.claude.length).toBeGreaterThan(0);
    expect(result.models.claude.every(m => m.capabilities.includes('vision'))).toBe(true);
  });
});
```

## Performance

### Caching
- First call: ~1-2s (API request to CLIProxyAPI)
- Cached calls: ~10-50ms (from memory)
- Cache validity: 1 hour

### Model Details
- Total models: ~36 (across 6 providers)
- JSON size: ~10-15 KB
- Display time: ~100-200ms

## See Also

- `/antigravity oauth` - Authenticate with CLIProxyAPI
- `/antigravity list providers` - List all CLIProxyAPI providers
- `/antigravity configure` - Configure provider routing and model mapping
- `/antigravity generate` - Generate image using CLIProxyAPI models

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)
