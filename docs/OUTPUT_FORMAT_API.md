# Output Format API Documentation

## Overview

The attempt API now supports multiple output formats for Claude message responses. You can specify the format at creation time, and the system will return responses in that format.

## Features

1. **Flexible Output Format**: Support unlimited formats - built-in formats (HTML, Markdown, YAML, JSON, Raw) OR custom formats via natural language instructions
2. **Hybrid Execution Mode**: Choose between queue (async) or sync (blocking) execution

## API Endpoints

### POST /api/attempts

Create a new attempt with optional output format specification.

**Request Body:**
```typescript
{
  taskId: string                      // Required
  prompt: string                      // Required
  request_method?: 'sync' | 'queue'   // Optional, default 'queue'
  output_format?: 'json' | 'html' | 'markdown' | 'yaml' | 'raw' | 'custom'  // Optional
  output_schema?: string               // Required if output_format='custom' - natural language instructions
  timeout?: number                    // Optional, sync mode only, ms, default 300000
  force_create?: boolean              // Optional
  projectId?: string                  // Optional
  projectName?: string                // Optional
  taskTitle?: string                  // Optional
  projectRootPath?: string            // Optional
}
```

**output_format Options:**
- `json` (default) - Original ClaudeOutput JSON structure
- `html` - Styled HTML document with CSS
- `markdown` - Markdown format
- `yaml` - YAML format
- `raw` - Unmodified ClaudeOutput messages
- `custom` - Any format defined in `output_schema`

**output_schema (required when output_format='custom'):**
- Simple **string** with natural language instructions
- Example: `"CSV format with headers: name,age,city"`
- Example: `"XML with <users> root. Each user: <user id='{id}'>..."`

**Responses:**

**Queue Mode (Success - request_method='queue' or default):**
- Status: 201 Created
- Body: Attempt object with ID and status

```json
{
  "id": "attempt-123",
  "taskId": "task-456",
  "prompt": "List all files",
  "status": "running",
  "createdAt": 1234567890,
  "completedAt": null,
  "outputFormat": "html",
  "outputSchema": null
}
```

**Sync Mode (Success - request_method='sync'):**
- Status: 200 OK
- Body: FormattedResponse with formatted_data

```json
{
  "formatted_data": "<!-- HTML content -->",
  "format": "html",
  "attempt": {
    "id": "attempt-123",
    "taskId": "task-456",
    "prompt": "List all files",
    "status": "completed",
    "createdAt": 1234567890,
    "completedAt": 1234567900
  }
}
```

**Sync Mode (Timeout):**
- Status: 408 Request Timeout
- Body: Error with attemptId for fallback

```json
{
  "error": "Attempt timed out after 300000ms",
  "attemptId": "attempt-123",
  "retryUrl": "/api/attempts/attempt-123"
}
```

### GET /api/attempts/[id]

Get attempt with formatted output based on the format specified when the attempt was created.

**Query Parameters:**
- None (format is determined from the attempt record's `output_format` column)

**Responses:**

**JSON Format (Default - when output_format is null or 'json'):**
- Status: 200 OK
- Body: Attempt object with logs array

```json
{
  "id": "attempt-123",
  "taskId": "task-456",
  "prompt": "List all files",
  "status": "completed",
  "logs": [...],
  "createdAt": 1234567890,
  "completedAt": 1234567900
}
```

**Other Formats (when output_format was specified at creation):**
- Status: 200 OK
- Body: FormattedResponse with formatted_data

**Not Found:**
- Status: 404 Not Found
- Body: Error message

**Note:** The output format is locked at creation time. If you need a different format, create a new attempt.

## Usage Examples

### Queue Mode (Default - Real-time)

```javascript
// Create attempt with HTML format
const { id } = await fetch('/api/attempts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'task-123',
    prompt: 'List all files in the project',
    request_method: 'queue', // or omit - default
    output_format: 'html'
  })
}).then(r => r.json());

console.log('Attempt created:', id);

// Poll for results
const poll = setInterval(async () => {
  const result = await fetch(`/api/attempts/${id}`)
    .then(r => r.json());

  if (result.attempt?.status === 'completed') {
    clearInterval(poll);
    console.log('Done!', result.formatted_data);
  } else if (result.attempt?.status === 'failed') {
    clearInterval(poll);
    console.error('Attempt failed');
  }
}, 2000);
```

### Sync Mode (Simple One-shot)

```javascript
// One request, waits for completion
const result = await fetch('/api/attempts', {
  method: 'POST',
  headers: { Content-Type: 'application/json' },
  body: JSON.stringify({
    taskId: 'task-123',
    prompt: 'List all files in the project',
    request_method: 'sync', // NEW: wait for results
    output_format: 'html',
    timeout: 60000 // 1 minute
  })
}).then(r => r.json());

if (result.error) {
  console.error('Timeout or error:', result.error);
  // Fallback: GET attempt status
  const status = await fetch(result.retryUrl).then(r => r.json());
  console.log('Check status later:', status);
} else {
  console.log('Done! HTML output:', result.formatted_data);
}
```

### Custom Format Examples

**CSV Output:**
```javascript
const result = await fetch('/api/attempts', {
  method: 'POST',
  body: JSON.stringify({
    taskId: 'task-123',
    prompt: 'List 10 employees',
    request_method: 'sync',
    output_format: 'custom',
    output_schema: 'CSV format with headers: name, department, salary. Each row: {name},{department},{salary}'
  })
}).then(r => r.json());

// result.formatted_data = "John Doe,Engineering,85000\nJane Smith,Marketing,75000\n..."
```

**XML Output:**
```javascript
const result = await fetch('/api/attempts', {
  method: 'POST',
  body: JSON.stringify({
    taskId: 'task-123',
    prompt: 'Create product catalog',
    request_method: 'sync',
    output_format: 'custom',
    output_schema: 'XML with <catalog> root. Each product: <product id="..." name="..." price="...">...</product>'
  })
}).then(r => r.json());

// result.formatted_data = "<catalog>\n  <product id=\"1\" name=\"Laptop\" price=\"999\">...</product>\n</catalog>"
```

**Custom JSON Structure:**
```javascript
const result = await fetch('/api/attempts', {
  method: 'POST',
  body: JSON.stringify({
    taskId: 'task-123',
    prompt: 'Create restaurant menu',
    request_method: 'sync',
    output_format: 'custom',
    output_schema: 'JSON with: restaurantName, currency, menu.categories[]. Each category has id, name, items[] with id, name, price'
  })
}).then(r => r.json());

// result.formatted_data = "{\"restaurantName\":\"The Digital Bistro\",\"menu\":{\"categories\":[...]}}"
```

### Using with curl

**Queue Mode:**
```bash
# Create attempt
RESPONSE=$(curl -s -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "prompt": "List all files",
    "request_method": "queue",
    "output_format": "html"
  }')

ATTEMPT_ID=$(echo $RESPONSE | jq -r '.id')
echo "Created attempt: $ATTEMPT_ID"

# Poll for results
while true; do
  RESULT=$(curl -s "http://localhost:3000/api/attempts/$ATTEMPT_ID")
  STATUS=$(echo $RESULT | jq -r '.attempt.status')

  if [ "$STATUS" != "running" ]; then
    echo "Done!"
    echo $RESULT | jq -r '.formatted_data' > output.html
    break
  fi

  echo "Still running..."
  sleep 2
done
```

**Sync Mode:**
```bash
# One-shot command, waits for completion
curl -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "prompt": "List all files",
    "request_method": "sync",
    "output_format": "html",
    "timeout": 60000
  }' | jq -r '.formatted_data' > output.html

echo "Output saved to output.html"
```

**Custom Format (CSV):**
```bash
curl -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "prompt": "List 10 employees",
    "request_method": "sync",
    "output_format": "custom",
    "output_schema": "CSV format with headers: name,department,salary. Each row: {name},{department},{salary}"
  }' | jq -r '.formatted_data' > employees.csv
```

## Built-in Format Examples

### HTML Format

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Claude Output</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; }
    .claude-message-text { background: white; padding: 16px; margin: 12px 0; border-radius: 8px; }
    .claude-thinking details { background: white; padding: 12px; margin: 12px 0; }
    .claude-tool-use { margin: 16px 0; }
  </style>
</head>
<body>
  <div class="claude-message-text">
    <p>Response text here...</p>
  </div>

  <details class="claude-thinking" open>
    <summary>💭 Thinking</summary>
    <div>Thinking content...</div>
  </details>

  <div class="claude-tool-use">
    <strong>🔧 Tool Name</strong>
    <pre><code>Tool input...</code></pre>
  </div>
</body>
</html>
```

### Markdown Format

```markdown
Response text here...

> **💭 Thinking**
> Thinking content...

### 🔧 Tool Name

```
Tool input...
```
```

### YAML Format

```yaml
messages:
  - index: 0
    type: assistant
    role: assistant
    content:
      - type: text
        text: |-
          Response text here...
      - type: thinking
        thinking: |-
          Thinking content...
      - type: tool_use
        id: tool-123
        name: bash
        input: {"command":"ls -la"}
```

## Error Handling

### Invalid Format
```json
{
  "error": "Invalid output_format. Must be one of: json, html, markdown, yaml, raw, custom"
}
```

### Missing Schema for Custom Format
```json
{
  "error": "output_schema is required when output_format is \"custom\""
}
```

### Sync Mode Timeout
```json
{
  "error": "Attempt timed out after 60000ms",
  "attemptId": "attempt-123",
  "retryUrl": "/api/attempts/attempt-123"
}
```

## output_schema Guidelines

The `output_schema` is a simple **string** with natural language instructions. The system will:

1. **Prepend instructions to prompt**: Tell Claude how to format the response
2. **Extract output**: Parse Claude's response to get the formatted content
3. **Return as string**: The formatted_data will be the raw formatted output

**Best Practices:**
- Be specific about format (CSV, XML, JSON, etc.)
- Provide structure/field names
- Give examples if needed
- Keep it concise (1-3 sentences)

**Examples:**
```javascript
// CSV
"output_schema": "CSV format with headers: name,age,city. Each row: {name},{age},{city}"

// XML
"output_schema": "XML with <users> root. Each user: <user id='{id}' name='{name}'><email>{email}</email></user>"

// JSON structure
"output_schema": "JSON array of users. Each user: id, name, email, role, createdAt"

// TOML
"output_schema": "TOML format. [user] section with id, name, email fields"

// Custom text format
"output_schema": "Format: | {name} | {role} | {department} |"
```
