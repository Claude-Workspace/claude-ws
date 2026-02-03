# Command: Configure

## Name
`/antigravity configure`

## Description
Configure CLIProxyAPI provider routing, model mapping, and apply to Claude.ws environment with automatic backup.

## Usage
```
/antigravity configure
```

## Parameters

### Required
None (will prompt for selections)

### Optional
- `--provider <id>` - Pre-select provider
- `--claude-model <id>` - Pre-select Claude model
- `--image-model <id>` - Pre-select image model
- `--skip-backup` - Skip .env backup
- `--dry-run` - Preview without applying changes

## Behavior

### Step 1: Check Authentication
Verify user is authenticated with CLIProxyAPI.
Display session info if logged in.

### Step 2: List Providers
Display all available CLIProxyAPI providers with their capabilities.

### Step 3: Select Provider
User selects active provider for Claude.ws:
- claude - Claude Code (Anthropic)
- openai - OpenAI Codex (GPT models)
- gemini - Gemini Pro
- qwen - Qwen Code
- iflow - iFlow Code
- amp - Amp Models

### Step 4: List Models
Display available models from selected provider.

### Step 5: Select Models
User selects:
- Claude model (for chat/code)
- Image model (for image generation)

### Step 6: Show Proposed Changes
Display what will be updated in Claude.ws .env.

### Step 7: Confirm and Apply
Backup current .env (if not skipped), apply changes, and reload.

## Output

### Success
```
=== CLIProxyAPI Configuration ===

✓ Authenticated with CLIProxyAPI
✓ Session: claude (expires in 23h 45m)

=== Select Provider ===

Available providers:
1. claude - Claude Code
2. openai - OpenAI Codex
3. gemini - Gemini Pro
4. qwen - Qwen Code
5. iflow - iFlow Code
6. amp - Amp Models

Select provider [1]: 1

=== Select Claude Model ===

Available Claude models:
1. claude-3-5-sonnet-20241022 (recommended)
   - Context: 200K tokens
   - Input: $3.00/m tokens
   - Output: $15.00/m tokens

2. claude-3-5-opus-20241022
   - Context: 200K tokens
   - Input: $15.00/m tokens
   - Output: $75.00/m tokens

3. claude-3-haiku-20240307
   - Context: 200K tokens
   - Input: $0.25/m tokens
   - Output: $1.25/m tokens

Select Claude model [1]: 1

=== Select Image Model ===

Available image models:
1. gpt-4-turbo (via OpenAI Codex)
2. gpt-4 (via OpenAI Codex)
3. dall-e-3 (via OpenAI Codex)

Select image model [1]: 1

=== Proposed Changes ===

Provider routing:
  Current: Not configured
  New: CLIProxyAPI (claude)

Claude model:
  Current: Not set
  New: claude-opus (maps to claude-3-5-opus-20241022)

Image model:
  Current: Not set
  New: gpt-4-turbo (maps to gpt-4-turbo-0129-preview)

Environment variables to add:
  - ANTI_GRAVITY_CLI_PROXY_ENDPOINT=https://router-for.me/api/v1
  - ANTI_GRAVITY_CLI_PROXY_ACCESS_TOKEN=<encrypted_token>
  - ANTI_GRAVITY_CLI_PROXY_REFRESH_TOKEN=<encrypted_refresh_token>
  - ANTI_GRAVITY_CLAUDE_MODEL=claude-opus
  - ANTI_GRAVITY_IMAGE_MODEL=gpt-4-turbo

Apply these changes? [y/N]: y

✓ Backed up .env → .env.backup.20250203_095500
✓ Updated .env with CLIProxyAPI configuration
✓ Provider routing configured
✓ Models mapped and ready for use
✓ Reloading Claude.ws...

✓ Configuration applied successfully!

Next steps:
- /antigravity generate <prompt> - Generate images via CLIProxyAPI
- /antigravity list models --provider openai - View OpenAI models
- /antigravity oauth --provider gemini - Switch to Gemini

Configuration saved at: 2025-02-03 09:55:00
```

### Dry Run (Preview Only)
```bash
/antigravity configure --dry-run

=== Dry Run: Proposed Changes ===

Provider routing:
  Current: Not configured
  New: CLIProxyAPI (claude)

Claude model:
  Current: Not set
  New: claude-3-5-sonnet-20241022

Image model:
  Current: Not set
  New: gpt-4-turbo

Environment variables to add:
  - ANTI_GRAVITY_CLI_PROXY_ENDPOINT=...
  - ANTI_GRAVITY_CLI_PROXY_ACCESS_TOKEN=...
  - ANTI_GRAVITY_CLAUDE_MODEL=...
  - ANTI_GRAVITY_IMAGE_MODEL=...

No changes were made.
```

## Error Handling

### Not Authenticated
```bash
✗ Authentication required
✗ Please run: /antigravity oauth --provider <provider>

Your session has expired or you haven't logged in yet.
```

### No Providers Available
```bash
✗ No providers available
✗ Please run: /antigravity list providers

Your CLIProxyAPI account may not have access to any providers.
```

### Model Not Available
```bash
✗ Model not available
✗ Error: Model "claude-3-5-sonnet-20241022" is not currently available

Please:
- /antigravity list models --provider claude
- Select a different model
- /antigravity list models --all to see all available models
```

### Write Error
```bash
✗ Failed to write .env
✗ Error: Permission denied

Please check:
- File permissions for .env
- Disk space
- Try running with elevated permissions
```

## Options

### Pre-select Provider
```bash
# Pre-select claude
/antigravity configure --provider claude

# Pre-select openai
/antigravity configure --provider openai
```

### Pre-select Models
```bash
# Pre-select Claude model
/antigravity configure --claude-model claude-opus

# Pre-select image model
/antigravity configure --image-model gpt-4-turbo
```

### Skip Backup
```bash
# Skip .env backup (use with caution)
/antigravity configure --skip-backup
```

### Dry Run (Preview)
```bash
# Preview changes without applying
/antigravity configure --dry-run
```

## Implementation

### Configuration File Structure
```javascript
const config = {
  provider: {
    id: 'claude',
    name: 'Claude Code',
    base_url: 'https://api.anthropic.com'
  },
  models: {
    claude: 'claude-opus', // Maps to actual model ID
    image: 'gpt-4-turbo'     // Maps to actual model ID
  },
  routing: {
    enabled: true,
    fallback_providers: ['openai', 'gemini']
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    key_derivation: 'pbkdf2',
    iterations: 100000
  }
};
```

### Environment Update
```javascript
async function updateEnv(updates, options) {
  // Create backup if needed
  if (!options.skipBackup) {
    await backupEnv({ timestamp: true });
  }

  // Read current .env
  const currentEnv = await readEnv();

  // Merge updates
  const newEnv = {
    ...currentEnv,
    ...updates
  };

  // Write new .env
  await writeEnvFile(newEnv);

  // Apply model mapping
  await applyModelMapping();

  return {
    success: true,
    changes: updates,
    backed_up: !options.skipBackup
  };
}
```

### Model Mapping
```javascript
const modelMapping = {
  // Claude models
  'claude-opus': 'claude-3-5-opus-20241022',
  'claude-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-haiku': 'claude-3-haiku-20240307',

  // CLIProxyAPI models
  'gpt-4-turbo': 'gpt-4-turbo-0129-preview',
  'gpt-4': 'gpt-4-0613-preview',
  'gemini-pro': 'gemini-pro',
  'gemini-ultra-vision': 'gemini-pro-vision',

  // Image models
  'dall-e-3': 'dall-e-3',
  'midjourney': 'midjourney-v6'
  'stable-diffusion-xl': 'stable-diffusion-xl-1024-v1-0'
};

// Resolve actual model ID
function resolveModelId(modelName) {
  return modelMapping[modelName] || modelName;
}
```

## Testing

### Unit Tests
```javascript
describe('Configure Command', () => {
  it('should display available providers', async () => {
    const result = await handleConfigure({});
    expect(result.providers).toBeDefined();
    expect(result.providers.length).toBeGreaterThan(0);
  });

  it('should validate model selection', async () => {
    const result = await handleConfigure({
      provider: 'claude',
      claudeModel: 'claude-opus'
    });
    expect(result.valid).toBe(true);
  });

  it('should backup .env before changes', async () => {
    const result = await handleConfigure({
      provider: 'claude',
      claudeModel: 'claude-opus'
    });
    expect(result.backed_up).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('Configure Integration', () => {
  it('should update .env with provider config', async () => {
    // Configure claude provider
    const result = await handleConfigure({
      provider: 'claude',
      claudeModel: 'claude-opus'
    });
    expect(result.success).toBe(true);

    // Verify .env was updated
    const env = await readEnv();
    expect(env.ANTI_GRAVITY_PROVIDER).toBe('cliProxyAPI');
  });

  it('should apply model mapping', async () => {
    // Configure with custom model
    const result = await handleConfigure({
      provider: 'openai',
      imageModel: 'dall-e-3'
    });
    expect(result.success).toBe(true);

    // Verify mapping was applied
    const env = await readEnv();
    expect(env.ANTI_GRAVITY_IMAGE_MODEL).toBe('dall-e-3');
  });
});
```

## Troubleshooting

### Common Issues

**"Provider not found"**
```bash
# Solution
/antigravity list providers
# Verify provider name and status
```

**"Model mapping failed"**
```bash
# Solution
/antigravity configure --provider claude
# Select a different model
# Check CLIProxyAPI model list
```

**".env backup failed"**
```bash
# Solution
# Check file permissions
# Check disk space
# Run with elevated permissions if needed
```

**"Reload failed"**
```bash
# Solution
# Restart Claude.ws manually
# Check .env syntax
# Verify all required variables are set
```

## Security

### Secure .env Updates
- ✅ Always create backup before modifications
- ✅ Verify .env syntax after changes
- ✅ Encrypt tokens before writing
- ✅ Set appropriate file permissions (0600)
- ✅ Validate model IDs before applying

### Provider Security
- ✅ Only use HTTPS for all API calls
- ✅ Verify provider SSL certificates
- ✅ Validate provider responses
- ✅ Check provider status before routing

### Token Security
- ✅ All CLIProxyAPI tokens encrypted at rest
- ✅ Never log tokens to console
- ✅ Clear tokens from memory after use
- ✅ Implement token refresh properly

## See Also

- `/antigravity oauth` - Authenticate with CLIProxyAPI
- `/antigravity list providers` - List all CLIProxyAPI providers
- `/antigravity list models` - List models from specific provider
- `/antigravity backup` - Backup .env file
- `/antigravity restore` - Restore .env from backup

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)

## Acknowledgments

CLIProxyAPI integration - https://github.com/router-for-me/CLIProxyAPI
