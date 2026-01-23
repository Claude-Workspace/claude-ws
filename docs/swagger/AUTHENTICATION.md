# API Authentication in Swagger Documentation

## Overview

The Swagger documentation now includes authentication support for endpoints that require API keys. You can authorize requests directly from the Swagger UI and test protected endpoints.

## Authentication Methods

### 1. API Key Authentication (X-API-Key)

**Used by:** Agent Factory endpoints, Project Settings endpoints

**Header:** `X-API-Key: <your-api-key>`

**How to get an API key:**
- Check your project settings
- Generate via Claude Code CLI
- Stored in project configuration

### 2. Bearer Authentication (JWT)

**Status:** Configured but optional (for future use)

**Header:** `Authorization: Bearer <token>`

## How to Use Authentication in Swagger UI

### Step 1: Open the Documentation

```bash
npm run dev
# Open: http://localhost:3000/docs/swagger
```

### Step 2: Click "Authorize" Button

Look for the **padlock icon** 🔒 or **"Authorize"** button near the top right of the page.

### Step 3: Enter Your API Key

1. Click "Authorize"
2. Select "ApiKeyAuth" from the list
3. Enter your API key in the popup dialog
4. Click "Authorize"
5. Click "Close"

### Step 4: Test Protected Endpoints

Now you can:
- Use the "Try it out" feature
- Make requests to protected endpoints
- Your API key will be automatically included in the `X-API-Key` header

## Endpoints Requiring Authentication

### Agent Factory Endpoints (all require API key)

- `POST /api/agent-factory/compare` - Compare components
- `POST /api/agent-factory/discover` - Discover components
- `GET /api/agent-factory/plugins` - List plugins
- `POST /api/agent-factory/plugins` - Create plugin
- `PUT /api/agent-factory/plugins/{id}` - Update plugin
- `DELETE /api/agent-factory/plugins/{id}` - Delete plugin
- And all other agent-factory endpoints

### Project Settings Endpoints (require API key)

- `GET /api/projects/{id}/settings` - Get project settings
- `POST /api/projects/{id}/settings` - Update project settings

### Auth Endpoint (requires API key)

- `POST /api/auth/verify` - Verify API key validity

## API Key Format

The API key is typically a string that you:

1. **Generate** from your Claude Code configuration
2. **Store** in your project settings (`.claude/project-settings.json`)
3. **Include** in the `X-API-Key` header

Example:
```bash
X-API-Key: your-api-key-here
```

## Testing Authentication

### Using curl

```bash
# Without authentication (will fail for protected endpoints)
curl http://localhost:3000/api/agent-factory/plugins

# With authentication
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/agent-factory/plugins
```

### Using Swagger UI

1. Click "Authorize" button
2. Enter your API key
3. Use "Try it out" on any protected endpoint
4. Swagger UI automatically includes the API key

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Invalid or missing API key"
}
```

**Causes:**
- Missing API key
- Invalid API key
- API key expired
- API key doesn't have required permissions

### 403 Forbidden

```json
{
  "error": "Invalid API key"
}
```

**Causes:**
- API key doesn't have access to this resource
- Insufficient permissions

## Security Best Practices

### 1. Never Commit API Keys

```bash
# Add to .gitignore
.env.local
*.key
claude-ws.config.json
```

### 2. Use Environment Variables

```bash
# In .env.local
NEXT_PUBLIC_API_KEY=your-api-key-here
```

### 3. Rotate Keys Regularly

Change your API keys periodically for security.

### 4. Use Different Keys for Different Environments

- **Development:** Local test key
- **Staging:** Staging environment key
- **Production:** Production key with limited access

## Configuration in Your Application

### Frontend Setup

```javascript
// Include API key in requests
const response = await fetch('http://localhost:3000/api/agent-factory/plugins', {
  headers: {
    'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
  }
});
```

### Backend Validation

```typescript
// Middleware to validate API key
export async function validateApiKey(request: Request) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key' },
      { status: 401 }
    );
  }
  
  // Validate key
  const isValid = await validateKey(apiKey);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }
  
  return true;
}
```

## Swagger Configuration

The swagger.yaml includes:

### Security Schemes
```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for authentication
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### Applied to Endpoints
```yaml
/api/agent-factory/plugins:
  get:
    security:
      - ApiKeyAuth: []
```

## Troubleshooting

### "Authorize" button not visible

**Solution:** Make sure you're on a protected endpoint page. Some endpoints don't require authentication.

### API key not being sent

**Solution:**
1. Check that you clicked "Authorize"
2. Verify the key was entered correctly
3. Check browser console for errors

### 401 errors in Swagger UI

**Solution:**
1. Verify your API key is valid
2. Check you're using the correct endpoint
3. Ensure the key hasn't expired

### Keys work in curl but not in Swagger

**Solution:** Swagger UI may have different requirements:
- Check CORS settings
- Verify the server URL is correct
- Ensure authentication middleware is configured

## Examples

### Get Plugin List (Authenticated)

```bash
# Using curl
curl -H "X-API-Key: your-key" \
  http://localhost:3000/api/agent-factory/plugins

# Using Swagger UI
# 1. Click "Authorize"
# 2. Enter API key
# 3. Open GET /api/agent-factory/plugins
# 4. Click "Try it out"
# 5. Click "Execute"
```

### Create Plugin (Authenticated)

```bash
# Using curl
curl -X POST http://localhost:3000/api/agent-factory/plugins \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "type": "skill",
    "name": "my-skill",
    "description": "My custom skill"
  }'

# Using Swagger UI
# Same process as above, but with POST request body
```

## Files Modified

- `public/docs/swagger/swagger.yaml` - Added security schemes and secured endpoints
- `docs/swagger/swagger.yaml` - Synced to source

## Related Documentation

- [Complete API List](COMPLETE_API_LIST.md) - All endpoints and their auth requirements
- [Change Server](CHANGE_SERVER.md) - How to configure server address
- [YAML Fixes](YAML_COMPLETE.md) - Swagger configuration details

---
**Last Updated:** 2025-01-23
**Status:** ✅ Authentication Configured
**Supported Methods:** API Key (X-API-Key), Bearer (JWT)
