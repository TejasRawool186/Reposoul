import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

/**
 * GET /api/workspaces/[id]/status
 *
 * Returns a point-in-time git + filesystem status snapshot for the workspace.
 *
 * Response: WorkspaceStatusSnapshot
 *   200 — snapshot (hasRepo may be false if repo/ not cloned)
 *   404 — workspace id not found in registry
 *   500 — unexpected error
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry }    = req2('./services/workspace-registry') as any;
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

    const snapshot = await monitor.getStatus();
    return NextResponse.json(snapshot);
  } catch (err: any) {
    console.error('[/api/workspaces/[id]/status GET]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to get workspace status' },
      { status: 500 },
    );
  }
}
