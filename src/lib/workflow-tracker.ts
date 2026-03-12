/**
 * Workflow Tracker - Track subagent execution workflow with full tree support
 *
 * Monitors Task tool usage to build real-time workflow visualization:
 * Full agent tree with unlimited depth, team tracking, and inter-agent messages.
 */

import { EventEmitter } from 'events';
import { createLogger } from './logger';
import {
  buildWorkflowSummary,
  buildWorkflowTree,
  buildExpandedWorkflow,
} from './workflow-state-query-helpers';
import type {
  SubagentStatus,
  SubagentNode,
  AgentMessage,
  WorkflowState,
  WorkflowSummary,
} from './workflow-tracker-types';

// Re-export types for consumers that import from workflow-tracker
export type { SubagentStatus, SubagentNode, AgentMessage, WorkflowState, WorkflowSummary };

const log = createLogger('WorkflowTracker');

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

  /** Initialize workflow for an attempt */
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

  /** Track a subagent start (from Task tool use) */
  trackSubagentStart(
    attemptId: string,
    toolUseId: string,
    subagentType: string,
    parentToolUseId: string | null,
    options?: { teamName?: string; name?: string }
  ): void {
    const workflow = this.initWorkflow(attemptId);

    let depth = 0;
    if (parentToolUseId && workflow.nodes.has(parentToolUseId)) {
      depth = workflow.nodes.get(parentToolUseId)!.depth + 1;
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
    if (depth === 0) workflow.rootNodes.push(toolUseId);
    workflow.activeNodes.push(toolUseId);

    this.emit('subagent-start', { attemptId, node });
    this.emit('workflow-update', { attemptId, workflow });
  }

  /** Track a subagent completion (from tool_result) */
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

    node.status = success ? 'completed' : 'failed';
    node.completedAt = Date.now();
    node.durationMs = node.startedAt ? Date.now() - node.startedAt : undefined;
    if (error) node.error = error;

    workflow.activeNodes = workflow.activeNodes.filter((id) => id !== toolUseId);
    if (success) {
      workflow.completedNodes.push(toolUseId);
    } else {
      workflow.failedNodes.push(toolUseId);
    }

    this.emit('subagent-end', { attemptId, node });
    this.emit('workflow-update', { attemptId, workflow });
  }

  /** Track a TeamCreate tool use */
  trackTeamCreate(attemptId: string, teamName: string): void {
    const workflow = this.initWorkflow(attemptId);
    if (!workflow.teams.includes(teamName)) workflow.teams.push(teamName);
    this.emit('workflow-update', { attemptId, workflow });
  }

  /** Track a SendMessage tool use */
  trackMessage(
    attemptId: string,
    input: { type?: string; recipient?: string; content?: string; summary?: string }
  ): void {
    const workflow = this.initWorkflow(attemptId);
    workflow.messages.push({
      fromType: 'agent',
      toType: input.recipient || input.type || 'unknown',
      content: input.content || '',
      summary: input.summary || '',
      timestamp: Date.now(),
    });
    this.emit('workflow-update', { attemptId, workflow });
  }

  /** Mark all in-progress subagents as orphaned (for disconnect cleanup) */
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

  /** Get workflow state for an attempt */
  getWorkflow(attemptId: string): WorkflowState | undefined {
    return this.workflows.get(attemptId);
  }

  /** Get workflow summary (chain of root agent names + counts) */
  getWorkflowSummary(attemptId: string): WorkflowSummary | null {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return null;
    return buildWorkflowSummary(workflow);
  }

  /** Get full expanded workflow data for socket emission */
  getExpandedWorkflow(attemptId: string): {
    nodes: SubagentNode[];
    messages: AgentMessage[];
    summary: WorkflowSummary;
  } | null {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return null;
    return buildExpandedWorkflow(workflow);
  }

  /** Get workflow tree sorted by depth then startedAt (for debugging/advanced UI) */
  getWorkflowTree(attemptId: string): SubagentNode[] {
    const workflow = this.workflows.get(attemptId);
    if (!workflow) return [];
    return buildWorkflowTree(workflow);
  }

  /** Clear workflow for an attempt */
  clearWorkflow(attemptId: string): void {
    this.workflows.delete(attemptId);
  }

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
