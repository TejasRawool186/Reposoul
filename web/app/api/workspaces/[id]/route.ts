import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

/**
 * GET /api/workspaces/[id]
 * Return a single workspace entry. Touches lastAccessedAt.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const registry = new WorkspaceRegistry();

    const workspace = registry.get(params.id);
    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${params.id}` },
        { status: 404 },
      );
    }

    registry.touch(params.id);
    return NextResponse.json({ workspace });
  } catch (err: any) {
    console.error('[/api/workspaces/[id] GET]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to get workspace' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/[id]
 * Update status, tags, or statusNote on a workspace entry.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const registry = new WorkspaceRegistry();

    const existing = registry.get(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: `Workspace not found: ${params.id}` },
        { status: 404 },
      );
    }

    // Only allow patching safe fields from the API
    const allowedPatch: Record<string, unknown> = {};
    if (body.status !== undefined)     allowedPatch.status     = body.status;
    if (body.statusNote !== undefined) allowedPatch.statusNote = body.statusNote;
    if (body.tags !== undefined)       allowedPatch.tags       = body.tags;
    if (body.hasClone !== undefined)   allowedPatch.hasClone   = body.hasClone;
    if (body.hasBlueprint !== undefined) allowedPatch.hasBlueprint = body.hasBlueprint;

    const updated = registry.update(params.id, allowedPatch);
    return NextResponse.json({ workspace: updated });
  } catch (err: any) {
    console.error('[/api/workspaces/[id] PATCH]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to update workspace' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/[id]
 * Remove the workspace from the registry.
 * Does NOT delete files on disk.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const registry = new WorkspaceRegistry();

    const removed = registry.remove(params.id);
    if (!removed) {
      return NextResponse.json(
        { error: `Workspace not found: ${params.id}` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[/api/workspaces/[id] DELETE]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to delete workspace' },
      { status: 500 },
    );
  }
}
