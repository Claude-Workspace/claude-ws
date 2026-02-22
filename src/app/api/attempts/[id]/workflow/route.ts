import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { workflowTracker } from '@/lib/workflow-tracker';

/**
 * GET /api/attempts/[id]/workflow
 *
 * Returns the workflow tree for an attempt.
 * - Running attempt: returns from workflowTracker in-memory state
 * - Completed attempt: returns from DB subagents table
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params;

  // Try in-memory state first (for running attempts)
  const expanded = workflowTracker.getExpandedWorkflow(attemptId);
  if (expanded) {
    return NextResponse.json({
      source: 'live',
      nodes: expanded.nodes,
      messages: expanded.messages,
      summary: expanded.summary,
    });
  }

  // Fall back to DB (for completed attempts)
  const subagents = await db.query.subagents.findMany({
    where: eq(schema.subagents.attemptId, attemptId),
  });

  if (subagents.length === 0) {
    return NextResponse.json({
      source: 'db',
      nodes: [],
      messages: [],
      summary: { chain: [], completedCount: 0, activeCount: 0, totalCount: 0 },
    });
  }

  // Build summary from DB records
  const rootNodes = subagents.filter(s => !s.parentId);
  const chain = rootNodes.map(s => s.name || s.type);
  const completedCount = subagents.filter(s => s.status === 'completed').length;
  const activeCount = subagents.filter(s => s.status === 'in_progress').length;

  // Map DB records to SubagentNode format
  const nodes = subagents
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return (a.startedAt || 0) - (b.startedAt || 0);
    })
    .map(s => ({
      id: s.id,
      type: s.type,
      name: s.name,
      status: s.status,
      parentId: s.parentId,
      depth: s.depth,
      teamName: s.teamName,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      durationMs: s.durationMs,
      error: s.error,
    }));

  return NextResponse.json({
    source: 'db',
    nodes,
    messages: [], // Messages are not persisted to DB
    summary: { chain, completedCount, activeCount, totalCount: subagents.length },
  });
}
