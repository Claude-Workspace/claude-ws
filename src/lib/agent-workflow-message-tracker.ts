/**
 * Agent Workflow Message Tracker - Parse raw SDK/CLI messages to track subagent workflow events
 *
 * Extracted from agent-event-wiring.ts. Processes assistant/user message blocks to track
 * Task tool subagent starts/ends, TeamCreate events, SendMessage events, and Bash BGPID patterns.
 */

import { workflowTracker } from '@/lib/workflow-tracker';
import { isServerCommand } from '@/lib/agent-output-handler';
import type { EventWiringContext } from '@/lib/agent-event-wiring';

/**
 * Track workflow from raw SDK/CLI messages (subagent starts/ends, team creation, Bash commands).
 */
export function trackWorkflowFromMessage(
  ctx: EventWiringContext,
  attemptId: string,
  message: unknown
): void {
  const msg = message as {
    type: string;
    message?: { content: Array<{ type: string; id?: string; name?: string; input?: unknown }> };
    parent_tool_use_id?: string | null;
  };

  if (msg.type === 'assistant' && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === 'tool_use' && block.name === 'Task' && block.id) {
        const taskInput = (block as { input?: { subagent_type?: string; team_name?: string; name?: string } }).input;
        workflowTracker.trackSubagentStart(
          attemptId, block.id, taskInput?.subagent_type || 'unknown',
          msg.parent_tool_use_id || null,
          { teamName: taskInput?.team_name, name: taskInput?.name },
        );
      }
      if (block.type === 'tool_use' && block.name === 'TeamCreate' && block.id) {
        const teamInput = (block as { input?: { team_name?: string } }).input;
        if (teamInput?.team_name) workflowTracker.trackTeamCreate(attemptId, teamInput.team_name);
      }
      if (block.type === 'tool_use' && block.name === 'SendMessage' && block.id) {
        const msgInput = (block as { input?: { type?: string; recipient?: string; content?: string; summary?: string } }).input;
        if (msgInput) workflowTracker.trackMessage(attemptId, msgInput);
      }
      // Track Bash tool_uses for BGPID correlation
      if (block.type === 'tool_use' && block.name === 'Bash' && block.id) {
        const bashInput = block.input as { command?: string } | undefined;
        const toolId = block.id;
        if (bashInput?.command) {
          ctx.pendingBashCommands.set(toolId, { command: bashInput.command, attemptId });
          setTimeout(() => ctx.pendingBashCommands.delete(toolId), 5 * 60 * 1000);
        }
      }
    }
  }

  if (msg.type === 'user' && msg.message?.content) {
    const userContent = msg.message.content as Array<{
      type: string;
      tool_use_id?: string;
      is_error?: boolean;
      content?: string | unknown[];
    }>;

    for (const block of userContent) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        workflowTracker.trackSubagentEnd(attemptId, block.tool_use_id, !block.is_error);

        // Detect BGPID pattern
        let content = '';
        if (typeof block.content === 'string') {
          content = block.content;
        } else if (Array.isArray(block.content)) {
          content = (block.content as Array<{ text?: string }>)
            .filter(c => c && typeof c === 'object' && 'text' in c)
            .map(c => c.text || '').join('');
        }

        const bgpidMatch = content.match(/BGPID:(\d+)/);
        const emptyBgpidMatch = content.match(/BGPID:\s*$/m) || content.trim() === 'BGPID:';

        if (bgpidMatch && block.tool_use_id) {
          const pid = parseInt(bgpidMatch[1], 10);
          const bashInfo = ctx.pendingBashCommands.get(block.tool_use_id);
          const command = bashInfo?.command || `Background process (PID: ${pid})`;
          const logMatch = command.match(/>\s*([^\s]+\.log)/);
          ctx.emit('trackedProcess', { attemptId, pid, command, logFile: logMatch?.[1] });
          ctx.pendingBashCommands.delete(block.tool_use_id);
        } else if (emptyBgpidMatch && block.tool_use_id) {
          const bashInfo = ctx.pendingBashCommands.get(block.tool_use_id);
          if (bashInfo?.command && isServerCommand(bashInfo.command)) {
            const nohupMatch = bashInfo.command.match(/nohup\s+(.+?)\s*>\s*\/tmp\//);
            if (nohupMatch) {
              ctx.emit('backgroundShell', {
                attemptId,
                shell: {
                  toolUseId: block.tool_use_id,
                  command: nohupMatch[1].trim(),
                  description: 'Auto-spawned from empty BGPID',
                  originalCommand: bashInfo.command,
                },
              });
            }
          }
          ctx.pendingBashCommands.delete(block.tool_use_id);
        }
      }
    }
  }
}
