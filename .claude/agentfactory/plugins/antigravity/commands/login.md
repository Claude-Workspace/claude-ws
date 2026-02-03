# Command: Antigravity Login

## Name
`/antigravity login`

## Description
Authenticate with Antigravity account and securely store encrypted token.

## Usage
```
/antigravity login
```

## Parameters
None (will prompt for credentials)

## Behavior

### Step 1: Prompt for Credentials
Will ask for:
- Email
- Password (for password-based auth)
- OR API Key (for API key-based auth)

### Step 2: Authenticate
- Send credentials to Antigravity API
- Receive session token
- Store token securely (encrypted)

### Step 3: Verify Access
- Test API connection
- Verify access to models
- Display success message

## Output

### Success
```
=== Antigravity Authentication ===

> Email: user@example.com
> Password: •••••••••

✓ Successfully authenticated with Antigravity!
✓ User: John Doe (john@example.com)
✓ Token: ag_t_xxxxxx (expires in 24h)
✓ Session secured with AES-256 encryption

✓ Access to 5 Claude models
✓ Access to 3 image generation models

Next steps:
- /antigravity list models - View available models
- /antigravity configure - Apply models to Claude.ws environment
```

### Error
```
✗ Authentication failed
✗ Error: Invalid email or password

Please check:
- Email and password are correct
- Account is active
- Internet connection

Or try:
- /antigravity login (if using API key instead)
```

## Error Handling

### Invalid Credentials
```
✗ Authentication failed
✗ Error: Invalid email or password

Please check:
- Email and password are correct
- Account is active
```

### API Unavailable
```
✗ Failed to connect to Antigravity API
✗ Error: Could not reach api.antigravity.com

Please check:
- Internet connection
- Antigravity API status
- Try again later
```

### Rate Limited
```
✗ Too many login attempts
✗ Error: Rate limit exceeded

Please wait a few minutes and try again.
```

## Security

### Token Encryption
- Tokens encrypted with AES-256-GCM
- PBKDF2 key derivation (100,000 iterations)
- Unique IV for each encryption
- Authentication tag for integrity

### Session Management
- Tokens stored securely in .env
- Sessions have limited lifetime (24h default)
- Auto-refresh supported

### Safe Storage
```
ANTIGRAVITY_API_TOKEN_ENCRYPTED=*** (encrypted value)
ANTIGRAVITY_API_TOKEN_IV=*** (initialization vector)
ANTIGRAVITY_API_TOKEN_TAG=*** (authentication tag)
```

## Example

### Password-based Authentication
```bash
/antigravity login

> Email: user@example.com
> Password: •••••••••

✓ Successfully authenticated with Antigravity!
✓ User: John Doe (john@example.com)
✓ Token expires: 2025-02-04 08:15:00

Next:
- /antigravity list models - View available models
- /antigravity configure - Apply models to Claude.ws
```

### API Key Authentication
```bash
/antigravity login

> Email: user@example.com
> API Key: •••••••••••••••••

✓ Successfully authenticated with Antigravity!
✓ User: John Doe (john@example.com)
✓ Token: ag_t_xxxxxx

Next:
- /antigravity list models
- /antigravity configure
```

## Implementation Notes

### Authentication Flow
1. Prompt for email and password/API key
2. Send POST request to `/api/v1/auth/token`
3. Receive access token, refresh token, expiry
4. Encrypt access token using AES-256-GCM
5. Store encrypted token in Claude.ws .env
6. Cache user session

### Encryption Details
```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.ANTI_ENCRYPTION_KEY || 'default-key',
  'salt',
  65536,
  128
);

const iv = crypto.randomBytes(16);
const tag = crypto.randomBytes(16);

const cipher = crypto.createCipherGcm('aes-256-gcm', ENCRYPTION_KEY);
cipher.setIV(iv);

let encrypted = cipher.update(plainText);
encrypted = Buffer.concat([encrypted, cipher.final()]);
encrypted = Buffer.concat([encrypted, cipher.getAuthTag()]);

return {
  encrypted: encrypted.toString('base64'),
  iv: iv.toString('base64'),
  tag: tag.toString('base64'),
  algorithm: 'aes-256-gcm',
  keyDerivation: 'PBKDF2',
  iterations: 100000
};
```

### Environment Variables
```bash
# Antigravity API
ANTI_API_ENDPOINT=https://api.antigravity.com

# Encrypted credentials
ANTIGRAVITY_API_TOKEN_ENCRYPTED=<encrypted_token>
ANTIGRAVITY_API_TOKEN_IV=<iv>
ANTIGRAVITY_API_TOKEN_TAG=<tag>

# User info
ANTIGRAVITY_AUTH_EMAIL=<email>
ANTIGRAVITY_AUTH_TOKEN=<refresh_token>

# Encryption settings
ANTI_ENCRYPTION_ALGORITHM=aes-256-gcm
ANTI_ENCRYPTION_ITERATIONS=100000
ANTI_ENCRYPTION_KEY_LENGTH=256
```

## Testing

### Unit Tests
```javascript
describe('Antigravity Login', () => {
  it('should authenticate with valid credentials', async () => {
    const result = await handleLogin({
      email: 'test@example.com',
      password: 'test123'
    });
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const result = await handleLogin({
      email: 'test@example.com',
      password: 'wrong'
    });
    expect(result.success).toBe(false);
  });

  it('should encrypt token before storing', async () => {
    const encrypted = await encryptToken('test-token');
    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
  });
});
```

### Integration Tests
```javascript
describe('Antigravity Login Integration', () => {
  it('should authenticate and list models', async () => {
    // Login
    const loginResult = await handleLogin({
      email: 'test@example.com',
      password: 'test123'
    });
    expect(loginResult.success).toBe(true);

    // List models
    const modelsResult = await handleListModels();
    expect(modelsResult.success).toBe(true);
    expect(modelsResult.claude.length).toBeGreaterThan(0);
    expect(modelsResult.image.length).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Common Issues

**"Token encryption failed"**
```bash
# Check encryption algorithm
$ echo $ANTI_ENCRYPTION_ALGORITHM

# Should be: aes-256-gcm

# Verify key derivation
$ echo $ANTI_ENCRYPTION_ITERATIONS
# Should be: 100000
```

**"Cannot access .env"**
```bash
# Check file permissions
ls -la .env

# Should be: -rw------- 1 user group .env

# Fix permissions
chmod 600 .env
```

**"Session expired"**
```bash
# Session expired - login again
/antigravity login

# This will refresh token and store new one
```

## See Also

- `/antigravity list models` - View available Claude and image models
- `/antigravity configure` - Apply models to Claude.ws environment
- `/antigravity backup` - Backup current .env file
- `/antigravity restore` - Restore .env from backup

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)
