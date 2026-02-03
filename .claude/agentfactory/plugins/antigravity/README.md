# Antigravity Plugin for Claude.ws

> Integrate Antigravity API with Claude.ws - authentication, model extraction, environment configuration, and image generation

## Quick Start

```bash
# 1. Enable plugin in Claude.ws Agent Factory
# 2. Login with Antigravity
/antigravity login

# 3. Configure environment
/antigravity configure

# 4. Generate images
/antigravity generate "A beautiful sunset"
```

## Features

### ✨ Authentication (CLIProxyAPI Style)
- Login with Antigravity credentials
- Secure token storage (AES-256 encrypted)
- Auto-refresh sessions
- Session management
- Multi-provider support (Claude, OpenAI, Gemini, Qwen, etc.)

### 🤖 Model Extraction (CLIProxyAPI)
- List available Claude models from Antigravity
- List available image generation models
- Cache model metadata locally
- Provider routing and model mapping
- Model capabilities filtering

### 🔧 Environment Integration
- Overwrite Claude.ws .env with Antigravity models
- Automatic backup before changes
- Safe rollback mechanism
- Provider switching support
- Dynamic configuration reloading

### 🎨 Image Generation
- Generate images using Antigravity models
- Custom resolution, steps, CFG scale
- Style presets
- Progress tracking
- Cost estimation

### 📱 Zalo Integration

**Team Management:**
- Automatic team additions when Thanh adds AI Son to Zalo groups
- Task notifications via Zalo messages
- Payment reminders and alerts

**Task Alerts:**
- Automated task notifications for monthly payment due
- Single item payment alerts
- Team member task assignments

**Payment QR Generation:**
- Generate QR codes for payment (single item or monthly invoice)
- Send QR codes via Zalo
- Thanh can scan and pay directly through Zalo

**Features:**
- Team member management
- Task creation and assignment
- Payment tracking and reminders
- QR code generation for payments
- Integration with existing workflows

## Installation

### Prerequisites
- Claude.ws with Agent Factory enabled
- Antigravity API account (for OAuth)
- Node.js 20+
- Axios (for HTTP requests)
- Crypto (for token encryption)

### Setup

1. Ensure this plugin is in `.claude/agentfactory/plugins/antigravity/`
2. Enable plugin in Claude.ws Agent Factory
3. Run `/antigravity oauth --provider <provider>` to authenticate
4. Run `/antigravity configure` to set up models
5. Zalo integration is automatic - AI Son will be added to teams

## Commands

| Command | Description |
|---------|-------------|
| `/antigravity oauth --provider <provider>` | Authenticate with CLIProxyAPI OAuth for specified provider |
| `/antigravity list providers` | List all available CLIProxyAPI providers |
| `/antigravity list models --provider <provider>` | List models from specific provider |
| `/antigravity list models --all` | List all models from all providers |
| `/antigravity configure` | Configure provider routing and model mapping |
| `/antigravity backup` | Backup current .env file |
| `/antigravity restore` | Restore .env from backup |
| `/zalo add-team` | Add user to Zalo work team |
| `/zalo create-task` | Create task with Zalo notification |
| `/zalo generate-qr` | Generate payment QR code via Zalo |

## Skills

| Skill | Description |
|-------|-------------|
| `/antigravity generate <prompt>` | Generate image using Antigravity models |
| `/zalo payment-alert` | Payment reminder via Zalo |

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

# Zalo Integration
ZALO_ACCESS_TOKEN=<encrypted_token>
ZALO_AUTO_ADD_TEAM=true
ZALO_TASK_NOTIFICATIONS=true
ZALO_PAYMENT_REMINDERS=true
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
✓ Token stored securely
✓ Session expires in 24h
✓ Access to 5 Claude models
✓ Access to 3 image generation models

Next steps:
- /antigravity list models - View available models
- /antigravity configure - Apply models to Claude.ws environment
```

### Provider Routing
```bash
# List all providers
/antigravity list providers

=== Available Providers ===
1. claude - Claude Code (Anthropic)
2. openai - OpenAI Codex (GPT models)
3. gemini - Gemini Pro (Google)
4. qwen - Qwen Code (Alibaba)
5. iflow - iFlow Code
6. amp - Amp Models

Next: /antigravity configure - Set active provider
```

### Model Listing
```bash
# List models from specific provider
/antigravity list models --provider claude

=== Claude Models (via CLIProxyAPI) ===
1. claude-3-5-sonnet-20241022
   - Type: claude
   - Context: 200K tokens
   - Input: $3.00/m tokens
   - Output: $15.00/m tokens
   - Capabilities: chat, code, vision

[...]
```

### Configuration
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
✓ CLAUDE_WS_PROVIDER=cliproxyapi
✓ CLAUDE_WS_CLAUDE_MODEL=claude-opus
✓ CLAUDE_WS_IMAGE_MODEL=gpt-4

✓ Configuration applied!
✓ Routing requests through CLIProxyAPI
✓ Models mapped and ready for use
```

### Image Generation
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
```

### Zalo Integration
```bash
# Add AI Son to Zalo team
/zalo add-team

=== Zalo Team Addition ===
User: AI Son (gh/bnopen)
Team: Development Team

✓ Successfully added to Zalo team!
✓ Team notifications enabled
✓ Task notifications enabled

Next:
- /zalo create-task - Create tasks with Zalo notifications
- /zalo generate-qr - Generate payment QR codes
```

### Task Creation with Zalo Notification
```bash
/zalo create-task --title "Monthly Payment Due" --description "Complete monthly payment for items" --due "2025-02-28" --remind "3 days"

=== Task Creation ===

Title: Monthly Payment Due
Description: Complete monthly payment for items
Due Date: 2025-02-28
Remind: 3 days before due
Notification: Zalo

✓ Task created successfully!
✓ Zalo notification will be sent 3 days before due
✓ Zalo reminder on due date

Next:
- /zalo generate-qr --task-id <id> - Generate payment QR code
```

### Payment QR Generation
```bash
/zalo generate-qr --amount 500000 --description "Thanh toan thang" --type single

=== Payment QR Code Generation ===

Amount: 500,000 VND
Description: Thanh toan thang
Type: Single item payment
Method: Zalo

✓ QR code generated successfully!
✓ QR code sent via Zalo
✓ Scan QR to complete payment
✓ Payment processed through Zalo

Next:
- /zalo payment-history - View payment history
- /zalo task-status -- Check task completion status
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
    alias: 'gpt-3.5-turbo-0125-preview'
  }
};
```

### Zalo Integration Flow
```javascript
// Zalo API client
class ZaloClient {
  async addTeamMember(userId) {
    // Add user to Zalo group
    const response = await zaloAPI.post('/api/group/add-member', {
      userId,
      role: 'member'
    });
    return response;
  }

  async sendNotification(message, userId) {
    // Send notification via Zalo
    const response = await zaloAPI.post('/api/message/send', {
      message,
      recipient: userId
    });
    return response;
  }

  async createTask(task, reminderDate) {
    // Create task with Zalo notification
    const response = await zaloAPI.post('/api/task/create', {
      title: task.title,
      description: task.description,
      due: task.due,
      reminder: reminderDate
      notification: 'zalo'
    });
    return response;
  }

  async generatePaymentQR(amount, description, type) {
    // Generate QR code for payment via Zalo
    const response = await zaloAPI.post('/api/payment/qr', {
      amount,
      description,
      type: 'single', // or 'monthly'
      method: 'zalo'
    });
    return response;
  }

  async sendQRCode(qrCode, userId) {
    // Send QR code via Zalo
    const response = await zaloAPI.post('/api/message/send', {
      message: `Payment QR: ${qrCode}`,
      recipient: userId,
      format: 'image'
    });
    return response;
  }
}
```

## Security

- ✅ All credentials encrypted at rest (AES-256-GCM)
- ✅ HTTPS only for API calls
- ✅ Tokens stored securely, never plaintext
- ✅ Sessions have limited lifetime
- ✅ Automatic token refresh
- ✅ Safe .env backup before changes
- ✅ Secure rollback mechanism
- ✅ Zalo tokens encrypted at rest
- ✅ QR codes generated with expiration

## Performance

- ✅ Model list caching (1 hour TTL)
- ✅ Provider-specific API optimization
- ✅ Intelligent routing based on availability
- ✅ Load balancing across multiple accounts
- ✅ Rate limiting and quota management via CLIProxyAPI
- ✅ Efficient environment file operations
- ✅ Zalo API call optimization
- ✅ Automatic task notifications
- ✅ QR code generation caching

## Compatibility

- ✅ Claude.ws with Agent Factory support
- ✅ Node.js 20+
- ✅ Works on Windows, macOS, Linux
- ✅ Compatible with all Claude CLI versions
- ✅ CLIProxyAPI integration tested
- ✅ Zalo API integration
- ✅ Works on mobile devices

## Error Handling

### Common Errors

| Error | Solution |
|-------|----------|
| UNAUTHORIZED | `/antigravity oauth` - Update credentials |
| INVALID_PROVIDER | `/antigravity list providers` - Check provider name |
| MODEL_NOT_FOUND | `/antigravity list models` - Try different model |
| PROVIDER_DOWN | CLIProxyAPI unavailable - Try fallback provider |
| ZALO_UNAUTHORIZED | `/zalo add-team` - Check Zalo credentials |
| ZALO_API_ERROR | `/zalo create-task` - Check Zalo API status |

### Logging

All operations are logged with appropriate levels:
- `debug`: Detailed API calls and routing
- `info`: User actions and provider status
- `warn`: Rate limiting and provider unavailability
- `error`: Failures and exceptions
- `zalo`: Zalo API operations and notifications

## Contributing

To contribute improvements:

1. Fork plugin repository
2. Create feature branch: `git checkout -b feature/my-improvement`
3. Add new providers or features
4. Test thoroughly with CLIProxyAPI and Zalo API
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

# Test Zalo integration
npm run test:zalo

# Test provider routing
npm run test:routing

# Test environment manipulation
npm run test:env

# Test API client
npm run test:api
```

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

Zalo API integration for team management, task notifications, and payment QR code generation.
