/**
 * Workflow Tracker - Track subagent execution workflow with full tree support
 *
 * Monitors Task tool usage to build real-time workflow visualization:
 * Full agent tree with unlimited depth, team tracking, and inter-agent messages.
 */

import { EventEmitter } from 'events';

import { createLogger } from './logger';

const log = createLogger('WorkflowTracker');

/**
 * Subagent status
 */
export type SubagentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'orphaned';

/**
 * Subagent node in workflow tree
 */
export interface SubagentNode {
  id: string; // tool_use_id from Task tool
  type: string; // subagent_type
  name?: string; // agent name (from Task tool input)
  status: SubagentStatus;
  parentId: string | null; // null for top-level
  depth: number; // 0 for top-level, increments with nesting
  teamName?: string; // team name if part of a team
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

/**
 * Inter-agent message
 */
export interface AgentMessage {
  fromType: string; // sender agent type or name
  toType: string; // recipient agent type or name
  content: string;
  summary: string;
  timestamp: number;
}

/**
 * Workflow state for an attempt
 */
export interface WorkflowState {
  attemptId: string;
  nodes: Map<string, SubagentNode>;
  rootNodes: string[]; // IDs of top-level agents
  activeNodes: string[]; // Currently running
  completedNodes: string[]; // Successfully completed
  failedNodes: string[]; // Failed agents
  messages: AgentMessage[]; // Inter-agent messages
  teams: string[]; // Team names created in this workflow
}

/**
 * Workflow summary for status line and global events
 */
export interface WorkflowSummary {
  chain: string[];
  completedCount: number;
  activeCount: number;
  totalCount: number;
}

interface WorkflowTrackerEvents {
  'workflow-update': (data: { attemptId: string; workflow: WorkflowState }) => void;
  'subagent-start': (data: { attemptId: string; node: SubagentNode }) => void;
  'subagent-end': (data: { attemptId: string; node: SubagentNode }) => void;
}

/**
 * WorkflowTracker - Singleton to track subagent workflows
 */
class WorkflowTracker extends EventEmitter {
  private workflows = new Map<string, WorkflowState>();

  constructor() {
    super();
  }

  /**
   * Initialize workflow for an attempt
   */
  initWorkflow(attemptId: string): WorkflowState {
    if (!this.workflows.has(attemptId)) {
      const workflow: WorkflowState = {
        attemptId,
        nodes: new Map(),
        rootNodes: [],
        activeNodes: [],
        completedNodes: [],
        failedNodes: [],
        messages: [],
        teams: [],
      };
      this.workflows.set(attemptId, workflow);
    }
    return this.workflows.get(attemptId)!;
  }

  /**
   * Track a subagent start (from Task tool use)
   */
  trackSubagentStart(
    attemptId: string,
    toolUseId: string,
    subagentType: string,
    parentToolUseId: string | null,
    options?: { teamName?: string; name?: string }
  ): void {
    const workflow = this.initWorkflow(attemptId);

    // Determine depth - no cap, full tree support
    let depth = 0;
    if (parentToolUseId && workflow.nodes.has(parentToolUseId)) {
      const parent = workflow.nodes.get(parentToolUseId)!;
      depth = parent.depth + 1;
    }

    const node: SubagentNode = {
      id: toolUseId,
      type: subagentType,
      name: options?.name,
      status: 'in_progress',
      parentId: parentToolUseId,
      depth,
      teamName: options?.teamName,
      startedAt: Date.now(),
    };

    workflow.nodes.set(toolUseId, node);

    // Track root nodes
    if (depth === 0) {
      workflow.rootNodes.push(toolUseId);
    }

    // Track active
    workflow.activeNodes.push(toolUseId);

    this.emit('subagent-start', { attemptId, node });
    this.emit('workflow-update', { attemptId, workflow });
  }

  /**
   * Track a subagent completion (from tool_result)
   */
  trackSubagentEnd(
    attemptId: string,
    toolUseId: string,
    success: boolean,
    error?: string
  ): void {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return;

    const node = workflow.nodes.get(toolUseId);
    if (!node) return;

    // Update node status
    node.status = success ? 'completed' : 'failed';
    node.completedAt = Date.now();
    node.durationMs = node.startedAt ? Date.now() - node.startedAt : undefined;
    if (error) node.error = error;

    // Remove from active
    workflow.activeNodes = workflow.activeNodes.filter((id) => id !== toolUseId);

    // Add to completed/failed
    if (success) {
      workflow.completedNodes.push(toolUseId);
    } else {
      workflow.failedNodes.push(toolUseId);
    }

    this.emit('subagent-end', { attemptId, node });
    this.emit('workflow-update', { attemptId, workflow });
  }

  /**
   * Track a TeamCreate tool use
   */
  trackTeamCreate(attemptId: string, teamName: string): void {
    const workflow = this.initWorkflow(attemptId);
    if (!workflow.teams.includes(teamName)) {
      workflow.teams.push(teamName);
    }
    this.emit('workflow-update', { attemptId, workflow });
  }

  /**
   * Track a SendMessage tool use
   */
  trackMessage(
    attemptId: string,
    input: { type?: string; recipient?: string; content?: string; summary?: string }
  ): void {
    const workflow = this.initWorkflow(attemptId);

    const message: AgentMessage = {
      fromType: 'agent', // We don't have sender info from the tool_use block
      toType: input.recipient || input.type || 'unknown',
      content: input.content || '',
      summary: input.summary || '',
      timestamp: Date.now(),
    };

    workflow.messages.push(message);
    this.emit('workflow-update', { attemptId, workflow });
  }

  /**
   * Mark all in-progress subagents as orphaned (for disconnect cleanup)
   */
  markOrphaned(attemptId: string): SubagentNode[] {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return [];

    const orphaned: SubagentNode[] = [];
    for (const nodeId of workflow.activeNodes) {
      const node = workflow.nodes.get(nodeId);
      if (node) {
        node.status = 'orphaned';
        node.completedAt = Date.now();
        node.durationMs = node.startedAt ? Date.now() - node.startedAt : undefined;
        orphaned.push(node);
      }
    }
    workflow.activeNodes = [];
    return orphaned;
  }

  /**
   * Get workflow state for an attempt
   */
  getWorkflow(attemptId: string): WorkflowState | undefined {
    return this.workflows.get(attemptId);
  }

  /**
   * Get workflow summary for status line display
   * Format: "docs-manager → tester → code-reviewer (3 done)"
   */
  getWorkflowSummary(attemptId: string): WorkflowSummary | null {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return null;

    // Build chain from root nodes (depth 0) in order
    const chain: string[] = [];
    for (const rootId of workflow.rootNodes) {
      const node = workflow.nodes.get(rootId);
      if (node) {
        chain.push(node.name || node.type);
      }
    }

    return {
      chain,
      completedCount: workflow.completedNodes.length,
      activeCount: workflow.activeNodes.length,
      totalCount: workflow.nodes.size,
    };
  }

  /**
   * Get full expanded workflow data for socket emission
   */
  getExpandedWorkflow(attemptId: string): {
    nodes: SubagentNode[];
    messages: AgentMessage[];
    summary: WorkflowSummary;
  } | null {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return null;

    const summary = this.getWorkflowSummary(attemptId);
    if (!summary) return null;

    return {
      nodes: Array.from(workflow.nodes.values()).sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return (a.startedAt || 0) - (b.startedAt || 0);
      }),
      messages: workflow.messages,
      summary,
    };
  }

  /**
   * Get detailed workflow tree (for debugging/advanced UI)
   */
  getWorkflowTree(attemptId: string): SubagentNode[] {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return [];

    // Return nodes as array, sorted by depth and startedAt
    return Array.from(workflow.nodes.values()).sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return (a.startedAt || 0) - (b.startedAt || 0);
    });
  }

  /**
   * Clear workflow for an attempt
   */
  clearWorkflow(attemptId: string): void {
    this.workflows.delete(attemptId);
  }

  // Type-safe event emitter methods
  override on<K extends keyof WorkflowTrackerEvents>(
    event: K,
    listener: WorkflowTrackerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof WorkflowTrackerEvents>(
    event: K,
    ...args: Parameters<WorkflowTrackerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const workflowTracker = new WorkflowTracker();
