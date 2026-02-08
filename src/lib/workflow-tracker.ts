/**
 * Workflow Tracker - Track subagent execution workflow with 2-depth support
 *
 * Monitors Task tool usage to build real-time workflow visualization:
 * docs-manager → tester → code-reviewer → project-manager (7 done)
 */

import { EventEmitter } from 'events';

import { createLogger } from './logger';

const log = createLogger('WorkflowTracker');

/**
 * Subagent status
 */
export type SubagentStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Subagent node in workflow tree
 */
export interface SubagentNode {
  id: string; // tool_use_id from Task tool
  type: string; // subagent_type
  status: SubagentStatus;
  parentId: string | null; // null for top-level
  depth: number; // 0 for top-level, 1 for nested
  startedAt?: number;
  completedAt?: number;
  error?: string;
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
    parentToolUseId: string | null
  ): void {
    const workflow = this.initWorkflow(attemptId);

    // Determine depth (max 2 depth: 0 for top-level, 1 for nested)
    let depth = 0;
    if (parentToolUseId && workflow.nodes.has(parentToolUseId)) {
      const parent = workflow.nodes.get(parentToolUseId)!;
      depth = Math.min(parent.depth + 1, 1); // Cap at depth 1
    }

    // Only track if depth <= 1 (2 levels max)
    if (depth > 1) {
      log.info(`Skipping subagent at depth ${depth}: ${subagentType}`);
      return;
    }

    const node: SubagentNode = {
      id: toolUseId,
      type: subagentType,
      status: 'in_progress',
      parentId: parentToolUseId,
      depth,
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
   * Get workflow state for an attempt
   */
  getWorkflow(attemptId: string): WorkflowState | undefined {
    return this.workflows.get(attemptId);
  }

  /**
   * Get workflow summary for status line display
   * Format: "docs-manager → tester → code-reviewer (3 done)"
   */
  getWorkflowSummary(attemptId: string): {
    chain: string[];
    completedCount: number;
    activeCount: number;
    totalCount: number;
  } | null {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return null;

    // Build chain from root nodes (depth 0) in order
    const chain: string[] = [];
    for (const rootId of workflow.rootNodes) {
      const node = workflow.nodes.get(rootId);
      if (node) {
        chain.push(node.type);
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
