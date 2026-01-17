/**
 * Claude Kanban API Demo
 *
 * Demonstrates how to interact with the Claude Kanban WebSocket and HTTP APIs
 * for task management, chat streaming, and interactive features.
 *
 * Run with: tsx docs/chat-demo.ts
 * Or compile: tsc docs/chat-demo.ts && node docs/chat-demo.js
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = process.env.API_BASE || 'http://localhost:33333';
const API_KEY = process.env.API_KEY || ''; // Set API_ACCESS_KEY in .env

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY && { 'x-api-key': API_KEY }),
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
  position: number;
  chatInit: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Attempt {
  id: string;
  taskId: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  sessionId: string | null;
  createdAt: number;
  completedAt: number | null;
}

interface Checkpoint {
  id: string;
  taskId: string;
  attemptId: string;
  sessionId: string;
  messageCount: number;
  summary: string | null;
  createdAt: number;
  attempt?: {
    displayPrompt: string | null;
    prompt: string;
  };
}

interface ClaudeOutput {
  type: 'system' | 'assistant' | 'user' | 'tool_use' | 'tool_result' | 'content_block_delta' | 'result';
  id?: string;
  tool_name?: string;
  tool_use_id?: string;
  message?: {
    role: string;
    content?: Array<{
      type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  delta?: {
    type: 'text_delta' | 'thinking_delta';
    text?: string;
    thinking?: string;
  };
}

// ============================================================================
// HTTP API HELPERS
// ============================================================================

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}/api${path}`, { headers });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiDelete(path: string) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

import { io } from 'socket.io-client';

class ChatClient {
  private socket: any;
  private currentAttemptId: string | null = null;
  private currentTaskId: string | null = null;
  private messageBuffer: ClaudeOutput[] = [];

  /**
   * Attempt = Conversation Turn
   *
   * Each attempt represents one user message (prompt) and Claude's full response.
   * The attempt streams messages in real-time via WebSocket events.
   *
   * Example flow:
   * 1. User: "Create a function"
   * 2.    → New attempt created with prompt="Create a function"
   * 3.    → Streams: system(init) → assistant(response) → tool_use(...) → tool_result(...) → result
   * 4.    → Attempt marked "completed"
   * 5. User: "Add error handling"
   * 6.    → NEW attempt created, RESUMING previous session
   */

  constructor() {
    this.socket = io(API_BASE);

    this.socket.on('connect', () => {
      console.log('✓ Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('✗ Disconnected from server');
    });

    // Setup message handlers
    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    // Task lifecycle events
    this.socket.on('task:started', (data: { taskId: string }) => {
      console.log(`\n📋 Task started: ${data.taskId}`);
    });

    this.socket.on('task:finished', (data: { taskId: string; status: string }) => {
      console.log(`\n✓ Task finished: ${data.taskId} (${data.status})`);
    });

    // Attempt events
    this.socket.on('attempt:started', (data: { attemptId: string; taskId: string }) => {
      this.currentAttemptId = data.attemptId;
      this.currentTaskId = data.taskId;
      console.log(`\n🚀 Attempt started: ${data.attemptId}`);
    });

    this.socket.on('attempt:finished', (data: { attemptId: string; status: string; code: number | null }) => {
      console.log(`\n✓ Attempt finished: ${data.attemptId} (${data.status})`);
      if (data.code !== null) {
        console.log(`   Exit code: ${data.code}`);
      }
    });

    // Streaming messages
    this.socket.on('output:json', (data: { attemptId: string; data: ClaudeOutput }) => {
      this.handleMessage(data.data);
    });

    // Interactive question from Claude
    this.socket.on('question:ask', (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => {
      this.handleQuestion(data);
    });

    // Errors
    this.socket.on('error', (data: { message: string }) => {
      console.error(`\n❌ Error: ${data.message}`);
    });
  }

  private handleMessage(output: ClaudeOutput) {
    // Skip streaming deltas (they're accumulated into complete messages)
    if (output.type === 'content_block_delta') {
      return;
    }

    this.messageBuffer.push(output);

    switch (output.type) {
      case 'system':
        console.log('\n🔧 System:', output.subtype || 'init');
        if (output.session_id) {
          console.log(`   Session ID: ${output.session_id}`);
        }
        break;

      case 'assistant':
        console.log('\n🤖 Assistant:');
        this.printAssistantMessage(output);
        break;

      case 'user':
        console.log('\n👤 User:');
        this.printUserMessage(output);
        break;

      case 'tool_use':
        console.log(`\n🔧 Tool: ${output.tool_name}`);
        if (output.id) {
          console.log(`   ID: ${output.id}`);
        }
        break;

      case 'tool_result':
        console.log(`\n✓ Tool Result: ${output.tool_use_id}`);
        if (output.result) {
          const preview = String(output.result).substring(0, 100);
          console.log(`   ${preview}${preview.length >= 100 ? '...' : ''}`);
        }
        break;

      case 'result':
        console.log('\n✨ Result:', output.subtype);
        break;

      default:
        console.log('\n📦 Unknown message type:', output.type);
    }
  }

  private printAssistantMessage(output: ClaudeOutput) {
    if (!output.message?.content) return;

    for (const block of output.message.content) {
      switch (block.type) {
        case 'text':
          console.log(`   ${block.text}`);
          break;
        case 'thinking':
          console.log(`   💭 ${block.thinking}`);
          break;
        case 'tool_use':
          console.log(`   🔧 ${block.name}(${block.id})`);
          break;
      }
    }
  }

  private printUserMessage(output: ClaudeOutput) {
    if (!output.message?.content) return;

    for (const block of output.message.content) {
      if (block.type === 'text') {
        console.log(`   ${block.text}`);
      }
    }
  }

  private handleQuestion(data: { attemptId: string; toolUseId: string; questions: unknown[] }) {
    console.log('\n❓ Question asked:');
    console.log(JSON.stringify(data.questions, null, 2));
    console.log('\nUse answerQuestion() to respond');
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /** Create a new task */
  async createTask(projectId: string, title: string, description?: string): Promise<Task> {
    const task = await apiPost('/tasks', {
      projectId,
      title,
      description: description || null,
      status: 'todo',
    });
    console.log(`✓ Created task: ${task.id}`);
    return task;
  }

  /** Start a conversation attempt (one turn = user message + Claude response) */
  async startAttempt(taskId: string, prompt: string, displayPrompt?: string): Promise<void> {
    this.messageBuffer = []; // Clear buffer for new attempt/conversation turn

    this.socket.emit('attempt:start', {
      taskId,
      prompt,
      displayPrompt: displayPrompt || prompt,
    });

    console.log(`📤 Starting attempt for task: ${taskId}`);
  }

  /** Cancel current attempt */
  cancelAttempt(): void {
    if (this.currentAttemptId) {
      this.socket.emit('attempt:cancel', { attemptId: this.currentAttemptId });
      console.log(`🛑 Cancelling attempt: ${this.currentAttemptId}`);
    }
  }

  /** Answer an interactive question from Claude */
  answerQuestion(answer: string): void {
    if (this.currentAttemptId) {
      this.socket.emit('question:answer', {
        attemptId: this.currentAttemptId,
        answer,
      });
      console.log(`📤 Answering question: ${answer}`);
    }
  }

  /** Get task conversation history */
  async getConversation(taskId: string): Promise<{ turns: unknown[] }> {
    return apiGet(`/tasks/${taskId}/conversation`);
  }

  /** Get checkpoints for a task */
  async getCheckpoints(taskId: string): Promise<Checkpoint[]> {
    return apiGet(`/checkpoints?taskId=${taskId}`);
  }

  /** Rewind to a checkpoint */
  async rewind(checkpointId: string): Promise<void> {
    const result = await apiPost('/checkpoints/rewind', {
      checkpointId,
      rewindFiles: true,
    });
    console.log('✓ Rewind successful:', result);
  }

  /** Disconnect */
  disconnect(): void {
    this.socket.disconnect();
    console.log('✓ Disconnected');
  }
}

// ============================================================================
// DEMO SCENARIOS
// ============================================================================

async function demo1_CreateAndRunTask() {
  console.log('\n=== DEMO 1: Create Task and Run Conversation ===\n');

  const client = new ChatClient();

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get first project (or create one)
  const projects: Project[] = await apiGet('/projects');
  if (projects.length === 0) {
    console.error('No projects found. Create one first.');
    return;
  }

  const project = projects[0];
  console.log(`Using project: ${project.name} (${project.path})`);

  // Create a task
  const task = await client.createTask(project.id, 'Create a hello world function');

  // Start a conversation
  await client.startAttempt(task.id, 'Create a simple hello world function in TypeScript');

  // Wait for completion (demo purposes)
  await new Promise(resolve => setTimeout(resolve, 30000));

  client.disconnect();
}

async function demo2_GetHistory() {
  console.log('\n=== DEMO 2: Get Conversation History ===\n');

  const projects: Project[] = await apiGet('/projects');
  if (projects.length === 0) {
    console.error('No projects found.');
    return;
  }

  // Get tasks for project
  const tasks: Task[] = await apiGet(`/tasks?projectId=${projects[0].id}`);
  if (tasks.length === 0) {
    console.log('No tasks found. Run demo 1 first.');
    return;
  }

  const task = tasks[0];
  console.log(`Getting history for task: ${task.title}`);

  const conversation = await apiGet(`/tasks/${task.id}/conversation`);
  console.log(`\n📜 Conversation has ${conversation.turns.length} turns:`);

  for (const turn of conversation.turns) {
    console.log(`\n[${turn.type}]`);
    if (turn.messages) {
      for (const msg of turn.messages) {
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') {
              console.log(`  ${block.text.substring(0, 100)}...`);
            }
          }
        }
      }
    }
  }
}

async function demo3_InteractiveQuestions() {
  console.log('\n=== DEMO 3: Handle Interactive Questions ===\n');

  const client = new ChatClient();
  await new Promise(resolve => setTimeout(resolve, 1000));

  const projects: Project[] = await apiGet('/projects');
  if (projects.length === 0) {
    console.error('No projects found.');
    client.disconnect();
    return;
  }

  const task = await client.createTask(projects[0].id, 'Interactive task');

  // Start a prompt that might ask questions
  await client.startAttempt(task.id, 'List all files in src directory and ask me which ones to analyze');

  // In a real scenario, you'd wait for the 'question:ask' event
  // Then present options to user and call:
  // client.answerQuestion('option-1');

  await new Promise(resolve => setTimeout(resolve, 30000));
  client.disconnect();
}

async function demo4_Rewind() {
  console.log('\n=== DEMO 4: Rewind Conversation ===\n');

  const projects: Project[] = await apiGet('/projects');
  if (projects.length === 0) {
    console.error('No projects found.');
    return;
  }

  const tasks: Task[] = await apiGet(`/tasks?projectId=${projects[0].id}`);
  if (tasks.length === 0) {
    console.log('No tasks found. Run demo 1 first.');
    return;
  }

  const task = tasks[0];
  console.log(`Getting checkpoints for task: ${task.title}`);

  const checkpoints: Checkpoint[] = await apiGet(`/checkpoints?taskId=${task.id}`);

  if (checkpoints.length === 0) {
    console.log('No checkpoints found. Complete a conversation first.');
    return;
  }

  console.log(`\n📋 Found ${checkpoints.length} checkpoints:`);
  checkpoints.forEach((cp, index) => {
    const date = new Date(cp.createdAt).toLocaleString();
    console.log(`\n${index + 1}. ${date}`);
    console.log(`   Messages: ${cp.messageCount}`);
    console.log(`   Summary: ${cp.summary || '(no summary)'}`);
    console.log(`   Attempt: ${cp.attempt?.displayPrompt || cp.attempt?.prompt}`);
  });

  // Uncomment to actually rewind:
  // const latestCheckpoint = checkpoints[0];
  // console.log(`\n⏪ Rewinding to: ${latestCheckpoint.id}`);
  // await apiPost('/checkpoints/rewind', {
  //   checkpointId: latestCheckpoint.id,
  //   rewindFiles: true,
  // });
}

async function demo5_MultiTurnConversation() {
  console.log('\n=== DEMO 5: Multi-Turn Conversation ===\n');

  const client = new ChatClient();
  await new Promise(resolve => setTimeout(resolve, 1000));

  const projects: Project[] = await apiGet('/projects');
  if (projects.length === 0) {
    console.error('No projects found.');
    client.disconnect();
    return;
  }

  const task = await client.createTask(projects[0].id, 'Multi-turn conversation');

  // First turn
  console.log('\n--- Turn 1 ---');
  await client.startAttempt(task.id, 'Create a simple counter function');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Second turn (resumes session automatically)
  console.log('\n--- Turn 2 ---');
  await client.startAttempt(task.id, 'Add error handling to it');
  await new Promise(resolve => setTimeout(resolve, 10000));

  client.disconnect();
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Claude Kanban API Demo                             ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const demo = args[0] || '1';

  const demos: Record<string, () => Promise<void>> = {
    '1': demo1_CreateAndRunTask,
    '2': demo2_GetHistory,
    '3': demo3_InteractiveQuestions,
    '4': demo4_Rewind,
    '5': demo5_MultiTurnConversation,
  };

  if (demos[demo]) {
    await demos[demo]();
  } else {
    console.log('\nUsage: tsx docs/chat-demo.ts [demo-number]\n');
    console.log('Available demos:');
    console.log('  1 - Create task and run conversation');
    console.log('  2 - Get conversation history');
    console.log('  3 - Handle interactive questions');
    console.log('  4 - Rewind conversation');
    console.log('  5 - Multi-turn conversation');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { ChatClient, apiGet, apiPost, apiDelete };
