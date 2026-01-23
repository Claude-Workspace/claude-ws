# Claude Workspace API Documentation

This directory contains comprehensive API documentation for the Claude Workspace project.

## 📚 Documentation Files

### 1. **swagger.yaml** (2,102 lines)
The main OpenAPI 3.0 specification in YAML format. This is the primary source of truth for API documentation.

**What's included:**
- All 67 API endpoints
- Complete request/response schemas
- Parameter definitions
- Authentication requirements
- Data type definitions
- Error response formats

**How to use:**
```bash
# View locally
cat docs/swagger/swagger.yaml

# Validate with Swagger CLI
docker run --rm -v $(pwd):/local swaggerapi/swagger-validator swagger validate /local/swagger.yaml

# Convert to JSON
# Use https://editor.swagger.io or:
npx @apidevtools/swagger-cli bundle docs/swagger/swagger.yaml --outfile openapi.json
```

### 2. **api-docs.html**
Interactive API documentation viewer using Swagger UI.

**Features:**
- Beautiful dark-themed interface
- Interactive "Try it out" functionality
- Real-time API testing
- Schema visualization
- Request/response examples

**How to use:**
```bash
# Start your dev server
npm run dev

# Open in browser
open docs/swagger/api-docs.html
# or navigate to the file directly
```

### 3. **COMPLETE_API_LIST.md** ⭐ **START HERE**
Comprehensive guide covering all 67 API endpoints across 15 categories.

### 4. **INDEX.html**
Visual documentation landing page with navigation to all resources.

### 5. **SWAGGER_README.md**
This file - quick start guide and overview.

## 🔗 Quick Links

- **[Interactive Docs](api-docs.html)** - Open Swagger UI
- **[Complete Guide](COMPLETE_API_LIST.md)** - Full API documentation
- **[Visual Index](INDEX.html)** - Beautiful navigation page
- **[OpenAPI Spec](swagger.yaml)** - Download YAML specification

## 📊 API Statistics

- **Total Endpoints**: 67
- **Categories**: 15
- **Routes**: 67 route.ts files
- **Authentication**: API Key (X-API-Key)

## 🚀 Quick Start

### Option 1: Interactive HTML Viewer (Recommended)

```bash
npm run dev
# Open docs/swagger/api-docs.html in your browser
```

### Option 2: Online Swagger Editor

1. Go to [https://editor.swagger.io/](https://editor.swagger.io/)
2. Copy the contents of `docs/swagger/swagger.yaml`
3. Paste into the editor
4. Interactive docs + validation

### Option 3: Redoc (Alternative Viewer)

```bash
npm install -g @redocly/cli
redocly preview-docs docs/swagger/swagger.yaml
```

## 📊 API Statistics

- **Total Endpoints**: 67
- **Categories**: 15
- **Routes**: 67 route.ts files
- **Authentication**: API Key (X-API-Key)

## 🗂️ API Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Agent Factory | 24 | Component discovery and plugin management |
| Attempts | 5 | Task execution and status tracking |
| Auth | 1 | API key verification |
| Checkpoints | 3 | Conversation state management |
| Code | 2 | Inline code editing |
| Commands | 3 | Claude Code slash commands |
| Files | 4 | File system operations |
| Filesystem | 1 | Directory browsing |
| Git | 16 | Git repository operations |
| Language | 2 | Code intelligence (goto-definition) |
| Projects | 7 | Project and settings management |
| Search | 2 | File and content search |
| Shells | 1 | Shell command execution |
| Tasks | 11 | Task and conversation management |
| Uploads | 3 | File upload handling |

## 🔐 Authentication

Most endpoints are open, but some require API key authentication:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/agent-factory/plugins
```

**Protected endpoints:**
- All Agent Factory endpoints (`/api/agent-factory/*`)
- Project settings (`/api/projects/{id}/settings`)
- Auth verification (`/api/auth/verify`)

## 🧪 Testing the API

### Example: List Projects

```bash
curl http://localhost:3000/api/projects
```

### Example: Create Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "abc123",
    "title": "Fix authentication bug"
  }'
```

### Example: Create Attempt (Sync Mode)

```bash
curl -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_abc",
    "prompt": "Fix the SAML login issue",
    "request_method": "sync",
    "timeout": 120000
  }'
```

### Example: Git Status

```bash
curl "http://localhost:3000/api/git/status?path=/path/to/project"
```

## 📖 Data Models

### Task Status
```typescript
type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
```

### Attempt Status
```typescript
type AttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled'
```

### Output Formats
```typescript
type OutputFormat = 'json' | 'html' | 'markdown' | 'yaml' | 'raw' | 'custom'
```

## 🛠️ Development

### Adding New Endpoints

1. Create the route file:
   ```bash
   src/app/api/category/endpoint-name/route.ts
   ```

2. Implement handlers (GET, POST, PUT, DELETE):
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';

   export async function GET(request: NextRequest) {
     return NextResponse.json({ data: 'response' });
   }
   ```

3. Update `swagger.yaml` with the new endpoint documentation

4. Test using `api-docs.html`

### Updating Documentation

When adding or modifying endpoints:

1. **Update the route code** in `src/app/api/`
2. **Update swagger.yaml** with:
   - New endpoint path
   - HTTP methods
   - Parameters
   - Request body schema
   - Response schemas
   - Error codes
3. **Test in Swagger UI** (`api-docs.html`)
4. **Update this README** if needed

## 🐛 Troubleshooting

### Swagger UI Not Loading

- Ensure dev server is running: `npm run dev`
- Check console for errors
- Verify `swagger.yaml` is valid YAML

### API Returns 401 Unauthorized

- Check if endpoint requires API key
- Verify `X-API-Key` header is set correctly
- Ensure API key is valid

### "Invalid YAML" Errors

- Use [https://www.yamllint.com/](https://www.yamllint.com/) to validate
- Check for proper indentation (2 spaces)
- Ensure special characters are quoted

## 📚 Additional Resources

- **Complete API Guide**: See `COMPLETE_API_LIST.md`
- **Project README**: `../README.md`
- **Database Schema**: `../src/lib/db/schema.ts`
- **Type Definitions**: `../src/types/index.ts`

## 🤝 Contributing

When contributing to the API:

1. Follow existing code patterns in route files
2. Document all new endpoints in `swagger.yaml`
3. Include error handling
4. Add input validation
5. Update `COMPLETE_API_LIST.md` if adding new category

## 📝 License

MIT License - See LICENSE file for details

---

**Last Updated**: 2025-01-22
**API Version**: 0.1.25
**OpenAPI Version**: 3.0.3
