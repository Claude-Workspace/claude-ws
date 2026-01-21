# Claude Workspace

> ⚠️ **DISCLAIMER:** This software is provided "AS IS" without warranty. The owners and contributors accept **no liability** for any damages or claims arising from its use. [Read full disclaimer](./DISCLAIMER.md).

**Visual workspace for Claude Code with Kanban board, code editor, and Git integration.**

Local-first SQLite database. Real-time streaming. Plugin system for custom agents and skills.

---

## Why Claude Workspace?

| Feature | Benefit |
|---------|---------|
| 🌍 **Work Everywhere** | SQLite-based local storage—no cloud dependency, works offline anywhere |
| ⚡ **Consistent Performance** | Lightweight footprint, instant startup, responsive UI on any connection |
| 🎯 **Unique Workflow** | Conversation checkpoints—rewind, branch, and continue at any point |
| ✨ **Intuitive Management** | Drag-and-drop Kanban, live streaming, file browser with Git status |
| 🔌 **Flexible Plugins** | Agent Factory—install only the skills and agents your project needs |
| 🔋 **Claude Code Native** | Full CLI integration with real-time streaming and file attachments |

---

## Features

**Task Management**
- Kanban board: To Do → In Progress → In Review → Done → Cancelled
- Drag-and-drop task cards with auto-save
- Full conversation history per task

**AI Interaction**
- Real-time streaming of Claude responses via Socket.io
- Checkpoints: Save and rewind to any conversation state
- File attachments for context
- Custom commands: `/cook`, `/plan`, `/fix`, `/brainstorm`
- Detachable chat window

**Code Editor**
- Tabbed CodeMirror editor with syntax highlighting
- AI-powered inline code suggestions
- Go-to-definition navigation
- Multi-file editing

**File System**
- Interactive file tree browser
- Unified search (files + content)
- File preview

**Git Integration**
- Full Git workflow: status, stage, commit, diff
- Visual Git graph
- Checkpoint Git snapshots for time-travel debugging

**Agent Factory**
- Plugin system for Claude skills, commands, agents
- Dependency management
- Per-project plugin installation

**Developer Tools**
- Background shell process manager
- Terminal output streaming
- Multi-project workspace support
- Themes: Light, Dark, VS Code variants, Dracula

---

## Quick Start

### Option 1: Run with npx

**Prerequisites:** Node.js 20+, pnpm 9+, [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

```bash
npx -y claude-ws
```

The `-y` flag skips the "Ok to proceed?" prompt.

The first run will:
- Auto-create SQLite database in `~/.claude-ws/`
- Install dependencies and build automatically
- Start the server on http://localhost:8556

### Option 2: Install globally (Recommended)

```bash
npm install -g claude-ws
claude-ws
```

Global installation avoids npx prompts and rebuilding on every run.

### Option 3: Development from source

```bash
git clone https://github.com/Claude-Workspace/claude-ws.git
cd claude-ws
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:8556](http://localhost:8556)

---

## Configuration

### API Authentication (Optional)

For secure deployments, you can enable API authentication by setting an `API_ACCESS_KEY`:

1. Create a `.env` file in your project directory (or use the global one in `~/.claude-ws/.env`)
2. Add your API access key:

```bash
# .env
API_ACCESS_KEY=your-secret-key-here
```

3. All API requests must include the key in the `x-api-key` header:

```bash
curl -H "x-api-key: your-secret-key-here" http://localhost:8556/api/conversations
```

**Note:** Leave `API_ACCESS_KEY` empty to disable authentication (default for local development).

### Claude Code CLI Path

Claude Workspace requires the Claude Code CLI to be installed. Set the `CLAUDE_PATH` environment variable to point to your Claude executable:

**Linux/Ubuntu:**
```bash
CLAUDE_PATH=/home/$(whoami)/.local/bin/claude
```

**macOS (Homebrew):**
```bash
CLAUDE_PATH=/opt/homebrew/bin/claude
```

**Windows:**
```bash
CLAUDE_PATH=%USERPROFILE%\.local\bin\claude.exe
```

Add this to your `.env` file in the project directory, or the global `.env` at `~/.claude-ws/.env`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_PATH` | Path to Claude Code CLI executable | Auto-detected |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `API_ACCESS_KEY` | API authentication key | (empty, no auth) |
| `DATABASE_URL` | SQLite database path | `./data.db` |
| `AGENT_FACTORY_DIR` | Agent Factory plugins directory | `~/.claude/agentfactory` |

---

## Work Everywhere with Cloudflare Tunnel

Access Claude Workspace securely from anywhere using Cloudflare Tunnel + Access.

### 1. Install cloudflared

```bash
# macOS
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# Windows
winget install Cloudflare.cloudflared
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

### 3. Create Tunnel

```bash
cloudflared tunnel create claude-workspace
```

### 4. Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: claude-workspace
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: claude-ws.yourdomain.com
    service: http://localhost:8556
  - service: http_status:404
```

### 5. Add DNS Record

```bash
cloudflared tunnel route dns claude-workspace claude-ws.yourdomain.com
```

### 6. Run Tunnel

```bash
# Foreground
cloudflared tunnel run claude-workspace

# Or as service (recommended)
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### 7. Setup Cloudflare Access (Authentication)

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Applications** → **Add an application**
3. Select **Self-hosted**
4. Configure:
   - **Application name**: Claude Workspace
   - **Session duration**: 24 hours (or your preference)
   - **Application domain**: `claude-ws.yourdomain.com`
5. Add **Access Policy**:
   - **Policy name**: Allowed Users
   - **Action**: Allow
   - **Include**: Emails ending in `@yourdomain.com` or specific email addresses
6. Save and deploy

Now access `https://claude-ws.yourdomain.com` from anywhere with Cloudflare authentication.

---

## Updating

### Check current version
```bash
claude-ws --version
```

### Update to latest version
```bash
npm update -g claude-ws
```

### Force reinstall
```bash
npm install -g claude-ws@latest
```

---

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Database**: SQLite + Drizzle ORM
- **Real-time**: Socket.io
- **Styling**: Tailwind CSS 4
- **UI**: Radix UI primitives
- **State**: Zustand
- **Drag & Drop**: dnd-kit

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:migrate` | Run database migrations |
| `pnpm pm2:start` | Start with PM2 process manager |
| `pnpm pm2:stop` | Stop PM2 process |
| `pnpm pm2:restart` | Restart PM2 process |
| `pnpm pm2:logs` | View PM2 logs |
| `pnpm pm2:monit` | Monitor PM2 process |

### Running with PM2

For production deployments with auto-restart and process management:

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the server
pnpm pm2:start

# View logs
pnpm pm2:logs

# Monitor process
pnpm pm2:monit

# Restart
pnpm pm2:restart

# Stop
pnpm pm2:stop
```

PM2 Features:
- Auto-restart on crash (max 10 attempts)
- Memory limit monitoring (500MB)
- Log rotation and management
- Process status tracking

---

## License

MIT
