# Command: Antigravity OAuth

## Name
`/antigravity oauth --provider <provider>`

## Description
Authenticate with CLIProxyAPI OAuth for specified provider (Claude, OpenAI, Gemini, Qwen, etc.)

## Usage
```
/antigravity oauth --provider claude
/antigravity oauth --provider openai
/antigravity oauth --provider gemini
/antigravity oauth --provider qwen
```

## Parameters

### Required
- `--provider` - Provider to authenticate with

**Supported providers:**
- `claude` - Claude Code (Anthropic)
- `openai` - OpenAI Codex (GPT models)
- `gemini` - Gemini Pro
- `qwen` - Qwen Code
- `iflow` - iFlow Code
- `amp` - Amp Models

### Optional
- `--redirect-uri` - Custom redirect URI (default: http://localhost:3000/callback)
- `--response-type` - Response type: `code` or `token` (default: `code`)
- `--force` - Force re-authentication (default: false)

## Behavior

### Step 1: Check Current Session
Verify if user is already authenticated with CLIProxyAPI for specified provider.

### Step 2: Initiate OAuth Request
Send OAuth request to CLIProxyAPI with provider and redirect URI.

### Step 3: Display Authorization URL
Show authorization URL and wait for user approval.

### Step 4: Wait for Callback
Wait for authorization code or token via callback handler.

### Step 5: Exchange Code for Token
Exchange authorization code for access and refresh tokens.

### Step 6: Store Session
Store CLIProxyAPI session securely (encrypted) and update .env.

## Output

### Already Authenticated
```bash
/antigravity oauth --provider claude

=== CLIProxyAPI OAuth ===
✓ Already authenticated with Claude
✓ Session expires in: 23h 45m
✓ Access token: ag_t_xxxxxx (encrypted)

To refresh:
/antigravity oauth --provider claude --force

Or continue to:
- /antigravity list models --provider claude
- /antigravity configure
```

### Initiate OAuth
```bash
/antigravity oauth --provider claude

=== CLIProxyAPI OAuth ===

Provider: Claude (Anthropic)
Redirect URI: http://localhost:3000/callback
Response Type: code

To complete authentication:
1. Visit this authorization URL:
   https://console.anthropic.com/oauth/authorize?client_id=xxx&redirect_uri=http://localhost:3000/callback&response_type=code&state=random_state_string

2. Approve access on Anthropic's website

3. You will be redirected back here with authorization code

Waiting for callback...
```

### Callback Received
```bash
=== CLIProxyAPI OAuth Callback ===

Authorization code received: auth_code_here
State: random_state_string

Exchanging code for tokens...

✓ Successfully authenticated!
✓ Provider: Claude (Anthropic)
✓ Access token: ag_t_xxxxxx (expires in 1h)
✓ Refresh token: rt_xxxxxx (expires in 24h)
✓ Session stored securely

Next steps:
- /antigravity list models --provider claude
- /antigravity configure --provider claude
- /antigravity generate <prompt> --provider claude
```

## Provider-Specific Flows

### Claude Code (Anthropic)
```bash
/antigravity oauth --provider claude

Authorization URL:
https://console.anthropic.com/oauth/authorize

Scopes:
- read (read conversations)
- write (create messages)
- model_selection (select specific models)
```

### OpenAI Codex (GPT Models)
```bash
/antigravity oauth --provider openai

Authorization URL:
https://auth0.openai.com/authorize

Scopes:
- model.read (access models)
- model.write (create completions)
- image.create (generate images)
```

### Gemini Pro
```bash
/antigravity oauth --provider gemini

Authorization URL:
https://accounts.google.com/oauth/authorize

Scopes:
- https://www.googleapis.com/auth/generative-language.readonly
- https://www.googleapis.com/auth/generative-language
```

### Qwen Code
```bash
/antigravity oauth --provider qwen

Authorization URL:
https://oauth.console.aliyun.com/authorize

Scopes:
- read (access Qwen models)
- write (create completions)
```

### iFlow Code
```bash
/antigravity oauth --provider iflow

Authorization URL:
https://api.iflow.tech/oauth/authorize

Scopes:
- model.read (access iFlow models)
- model.write (create completions)
```

### Amp Models
```bash
/antigravity oauth --provider amp

Authorization URL:
https://api.amp.chat/oauth/authorize

Scopes:
- model.read (access Amp models)
- model.write (create completions)
```

## Error Handling

### Invalid Provider
```bash
/antigravity oauth --provider invalid

✗ Invalid provider: "invalid"

Supported providers:
- claude - Claude Code (Anthropic)
- openai - OpenAI Codex (GPT models)
- gemini - Gemini Pro
- qwen - Qwen Code
- iflow - iFlow Code
- amp - Amp Models

Use: /antigravity oauth --provider <provider>
```

### OAuth Error
```bash
✗ OAuth failed

Error: invalid_client
Solution: Check client_id in CLIProxyAPI configuration

Error: redirect_uri_mismatch
Solution: Use matching redirect URI

Error: access_denied
Solution: User denied access, try again

Error: invalid_scope
Solution: Requested scopes not supported by provider

Error: invalid_grant
Solution: Invalid grant_type, use "authorization_code"

Error: invalid_request
Solution: Check all OAuth parameters
```

### CLIProxyAPI Error
```bash
✗ CLIProxyAPI authentication failed

Error: provider_unavailable
Solution: Provider may be down or blocked

Error: rate_limit_exceeded
Solution: Too many requests, wait a few minutes

Error: insufficient_quota
Solution: Check CLIProxyAPI plan limits

Error: provider_error
Solution: Provider returned error, check CLIProxyAPI status

## Options

### Force Re-authentication
```bash
/antigravity oauth --provider claude --force

This will:
- Discard existing session
- Initiate new OAuth flow
- Get fresh tokens
```

### Custom Redirect URI
```bash
/antigravity oauth --provider claude --redirect-uri https://your-app.com/callback

Use this for production deployments.
```

### Token Response Type
```bash
# Default: authorization_code flow (more secure)
/antigravity oauth --provider claude

# Alternative: direct token exchange (for testing)
/antigravity oauth --provider claude --response-type token
```

## Security

### OAuth Security Best Practices
- ✅ State parameter to prevent CSRF attacks
- ✅ PKCE (Proof Key for Code Exchange) if supported
- ✅ HTTPS only for OAuth endpoints
- ✅ Short-lived access tokens (1 hour default)
- ✅ Long-lived refresh tokens (24 hours default)
- ✅ Secure token storage (AES-256-GCM encrypted)
- ✅ Automatic token refresh
- ✅ Token revocation support

### State Parameter
Random state string included in all OAuth requests to prevent CSRF attacks:
```bash
State: AbCdEfGhIjKlMnOpQrStUvWxyz
```

### PKCE Flow
Proof Key for Code Exchange (PKCE) is supported for enhanced security:
```bash
# PKCE parameters
code_challenge: "E9Melhoa2O1vP8JQWJNKQpQ"
code_verifier: "J94dVY5q"
```

## Session Management

### Token Storage
```bash
# Encrypted token storage
ANTI_GRAVITY_CLI_PROXY_ACCESS_TOKEN=<encrypted_access_token>
ANTI_GRAVITY_CLI_PROXY_REFRESH_TOKEN=<encrypted_refresh_token>
ANTI_GRAVITY_CLI_PROXY_PROVIDER=claude
ANTI_GRAVITY_CLI_PROXY_EXPIRES_AT=<timestamp>
```

### Session Refresh
```bash
# Automatic refresh when access token expires
# Uses refresh_token to get new access_token without user interaction

Manual refresh:
/antigravity oauth --provider claude --refresh

✓ Session refreshed!
✓ New access token: ag_t_xxxxxx (expires in 1h)
✓ Refresh token: rt_xxxxxx (expires in 24h)
```

### Session Cleanup
```bash
# Logout and clear session
/antigravity logout

✓ Logged out from CLIProxyAPI!
✓ Local session cleared
✓ Tokens removed from storage

To authenticate again:
/antigravity oauth --provider <provider>
```

## Implementation Notes

### OAuth Flow
```javascript
async function authenticateOAuth(provider, redirectUri) {
  // 1. Get provider config
  const providerConfig = getProviderConfig(provider);

  // 2. Initiate OAuth
  const response = await cliProxyAPI.request('POST', '/oauth/authorize', {
    provider,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: generateRandomState(),
    scopes: providerConfig.scopes
  });

  return response;
}
```

### Callback Handler
```javascript
async function handleOAuthCallback(code, state, provider) {
  // 1. Verify state (CSRF protection)
  if (!verifyState(state)) {
    throw new Error('Invalid state parameter');
  }

  // 2. Exchange code for tokens
  const response = await cliProxyAPI.request('POST', '/oauth/token', {
    provider,
    code,
    redirect_uri: redirectUri,
    client_id: process.env.CLI_PROXY_OAUTH_CLIENT_ID,
    client_secret: process.env.CLI_PROXY_OAUTH_CLIENT_SECRET,
    grant_type: 'authorization_code'
  });

  // 3. Store tokens securely
  await storeTokens(response.tokens, provider);

  // 4. Update session
  await updateSession(response.session);

  return response;
}
```

### Token Encryption
```javascript
// Encrypt CLIProxyAPI tokens
const crypto = require('crypto');

function encryptTokens(accessToken, refreshToken) {
  const key = crypto.scryptSync(
    process.env.ANTI_GRAVITY_ENCRYPTION_KEY || 'default-key',
    'salt',
    65536,
    128
  );

  const iv = crypto.randomBytes(16);
  const tag = crypto.randomBytes(16);

  const cipher = crypto.createCipherGcm('aes-256-gcm', key);
  cipher.setIV(iv);

  let encrypted = cipher.update(accessToken);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  encrypted = Buffer.concat([encrypted, cipher.getAuthTag()]);

  return {
    accessToken: encrypted.toString('base64'),
    refreshToken: refreshToken ? encryptToken(refreshToken, key, iv, tag) : null,
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}
```

## Usage Examples

### Simple Authentication
```bash
# Authenticate with Claude
/antigravity oauth --provider claude

> Visit this authorization URL:
> https://console.anthropic.com/oauth/authorize?...

# After approval...
✓ Successfully authenticated!
✓ Provider: Claude (Anthropic)
✓ Session stored

Next:
- /antigravity list models
- /antigravity configure
```

### Switch Provider
```bash
# Switch from Claude to OpenAI
/antigravity oauth --provider openai

> Visit this authorization URL:
> https://auth0.openai.com/authorize?...

✓ Successfully authenticated with OpenAI!

Next:
- /antigravity list models --provider openai
- /antigravity configure --provider openai
```

### Refresh Session
```bash
/antigravity oauth --provider claude --refresh

✓ Session refreshed!
✓ New access token valid
✓ Refresh token valid

Next:
- Continue using CLIProxyAPI services
```

## Troubleshooting

### Common Issues

**"Redirect URI mismatch"**
```bash
# Solution: Ensure redirect URI matches exactly
/antigravity oauth --provider claude --redirect-uri https://your-app.com/callback
```

**"OAuth flow failed"**
```bash
# Solution: Check provider availability
/antigravity list providers

# Solution: Verify CLIProxyAPI configuration
cat ~/.cliproxyapi/config.json
```

**"Session expired"**
```bash
# Solution: Refresh session
/antigravity oauth --provider claude --refresh

# Solution: Or re-authenticate
/antigravity oauth --provider claude --force
```

## See Also

- `/antigravity list providers` - List all CLIProxyAPI providers
- `/antigravity list models --provider <provider>` - List models from specific provider
- `/antigravity configure` - Configure active provider and model mapping
- `/antigravity logout` - Logout and clear session

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)

## Acknowledgments

Integrates with CLIProxyAPI (https://github.com/router-for-me/CLIProxyAPI)
