import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pluginDependencies } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';

// POST /api/agent-factory/dependencies/:id/install - Install a dependency
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    // Get dependency
    const dependency = await db
      .select()
      .from(pluginDependencies)
      .where(eq(pluginDependencies.id, id))
      .get();

    if (!dependency) {
      return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
    }

    // For skill/agent dependencies, just mark as installed if component exists
    if (dependency.dependencyType === 'skill' || dependency.dependencyType === 'agent') {
      if (dependency.pluginDependencyId) {
        // Component dependency exists, mark as installed
        await db
          .update(pluginDependencies)
          .set({ installed: true })
          .where(eq(pluginDependencies.id, id));
      }
      return NextResponse.json({ success: true, message: 'Component dependency referenced' });
    }

    // For package dependencies, return installation command
    // In a real implementation, this would execute the installation
    let installCommand = '';
    if (dependency.dependencyType === 'python') {
      installCommand = `pip install ${dependency.spec}`;
    } else if (dependency.dependencyType === 'npm') {
      installCommand = `npm install ${dependency.spec}`;
    } else if (dependency.dependencyType === 'system') {
      installCommand = `# System package: ${dependency.spec}`;
    }

    // Mark as installed (in real implementation, this would happen after successful install)
    await db
      .update(pluginDependencies)
      .set({ installed: true })
      .where(eq(pluginDependencies.id, id));

    return NextResponse.json({
      success: true,
      message: 'Dependency marked as installed',
      installCommand,
    });
  } catch (error) {
    console.error('Error installing dependency:', error);
    return NextResponse.json({ error: 'Failed to install dependency' }, { status: 500 });
  }
}
