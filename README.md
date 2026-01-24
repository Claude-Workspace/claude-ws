# 🚀 Claude Workspace API Documentation

Complete API documentation has been created for the Claude Workspace project.

## 📚 Documentation Location

All API documentation is located in the **`public/docs/swagger/`** directory.

## 🔗 Quick Access

### 🌐 Web Interface (Recommended)
Start the dev server and open in your browser:
```bash
npm run dev
# Open http://localhost:3000/docs/swagger
```

### 📖 Interactive API Documentation
Open **[public/docs/swagger/INDEX.html](public/docs/swagger/api-docs.html)** in your browser for a beautiful visual interface to all documentation.

## 📁 Documentation Files

```
docs/swagger/
├── INDEX.html              # Visual navigation page (START HERE)
├── api-docs.html           # Interactive Swagger UI
├── swagger.yaml            # OpenAPI 3.0 specification
├── COMPLETE_API_LIST.md    # Comprehensive API guide
└── SWAGGER_README.md       # Quick start guide
```

## 🚀 Quick Start

### Option 1: Web Interface (Recommended)
```bash
# Start dev server
npm run dev

# Open in browser
open http://localhost:3000/docs/swagger

# Note: You can change the server address in the Swagger UI
# Use the server dropdown at the top of the page
```

### Option 2: Visual Index
```bash
# Open in browser
open docs/swagger/INDEX.html
# or double-click the file
```

### Option 3: Read Complete Guide
```bash
# View in terminal or editor
cat docs/swagger/COMPLETE_API_LIST.md
```

## 💡 Usage Example

### List Projects
```bash
curl http://localhost:3000/api/projects
```

### Create Task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "abc123",
    "title": "Fix authentication bug"
  }'
```

### Get Git Status
```bash
curl "http://localhost:3000/api/git/status?path=/path/to/project"
```

## 🔐 Authentication

Some endpoints require API key authentication:
```bash
curl -H "X-API-Key: your-key" \
  http://localhost:3000/api/agent-factory/plugins
```

## 📖 More Information

- **Interactive Documentation**: [docs/swagger/INDEX.html](docs/swagger/INDEX.html)
- **Complete API Guide**: [docs/swagger/COMPLETE_API_LIST.md](docs/swagger/COMPLETE_API_LIST.md)
- **OpenAPI Specification**: [docs/swagger/swagger.yaml](docs/swagger/swagger.yaml)
- **Change Server Address**: [docs/swagger/CHANGE_SERVER.md](docs/swagger/CHANGE_SERVER.md) ⭐

## 🛠️ Development

To add new API endpoints:
1. Create route in `src/app/api/`
2. Update `docs/swagger/swagger.yaml`
3. Test with `docs/swagger/api-docs.html`

## 📝 License

MIT License - See LICENSE file for details

---

**Version**: 0.1.25 | **OpenAPI**: 3.0.3 | **Last Updated**: 2025-01-22
