import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

/**
 * GET /api/workspaces
 * Returns all registered workspaces, most-recently-accessed first.
 * Optionally filters by ?repository=owner/repo
 */
export async function GET(req: NextRequest) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const registry = new WorkspaceRegistry();

    // Reconcile on every list — mark missing paths
    registry.reconcile();

    const { searchParams } = new URL(req.url);
    const repoFilter = searchParams.get('repository');

    let workspaces = registry.list();
    if (repoFilter) {
      const norm = repoFilter.toLowerCase();
      workspaces = workspaces.filter(
        (w: any) => w.repository.toLowerCase() === norm,
      );
    }

    return NextResponse.json({ workspaces, total: workspaces.length });
  } catch (err: any) {
    console.error('[/api/workspaces GET]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to list workspaces' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces
 * Register a new workspace (or upsert by path).
 * Body: CreateWorkspacePayload
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repository, workspacePath } = body;

    if (!repository || typeof repository !== 'string') {
      return NextResponse.json(
        { error: 'repository is required' },
        { status: 400 },
      );
    }
    if (!workspacePath || typeof workspacePath !== 'string') {
      return NextResponse.json(
        { error: 'workspacePath is required' },
        { status: 400 },
      );
    }

    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const registry = new WorkspaceRegistry();

    const entry = registry.register({
      repository,
      workspacePath,
      hasClone: body.hasClone ?? false,
      hasBlueprint: body.hasBlueprint ?? false,
      defaultBranch: body.defaultBranch ?? null,
      headCommit: body.headCommit ?? null,
      tags: body.tags ?? [],
      statusNote: body.statusNote ?? null,
    });

    return NextResponse.json({ workspace: entry }, { status: 201 });
  } catch (err: any) {
    console.error('[/api/workspaces POST]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to register workspace' },
      { status: 500 },
    );
  }
}
