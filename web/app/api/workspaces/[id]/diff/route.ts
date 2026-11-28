import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

/**
 * GET /api/workspaces/[id]/diff
 *
 * Returns the uncommitted git diff for the cloned repository inside
 * this workspace.
 *
 * Query params:
 *   ?path=src/index.ts   — scope diff to a single file (optional)
 *
 * Response: WorkspaceDiff
 *   200 — diff result (entries may be empty when nothing is changed)
 *   404 — workspace id not found in registry
 *   500 — unexpected error
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry }       = req2('./services/workspace-registry') as any;
    const { WorkspaceMonitorService } = req2('./services/workspace-monitor') as any;

    const registry  = new WorkspaceRegistry();
    const workspace = registry.get(params.id);

    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${params.id}` },
        { status: 404 },
      );
    }

    registry.touch(params.id);

    const monitor = new WorkspaceMonitorService(
      params.id,
      workspace.workspacePath,
    );

    const diff = await monitor.getDiff();

    // Optional single-file filter
    const { searchParams } = new URL(req.url);
    const fileFilter = searchParams.get('path');
    if (fileFilter) {
      diff.entries = diff.entries.filter(
        (e: any) => e.path === fileFilter,
      );
      diff.totalChanges = diff.entries.length;
    }

    return NextResponse.json(diff);
  } catch (err: any) {
    console.error('[/api/workspaces/[id]/diff GET]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to get workspace diff' },
      { status: 500 },
    );
  }
}
