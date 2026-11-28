import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

/**
 * POST /api/workspaces/[id]/open
 *
 * Open the workspace directory in the best available editor
 * (Kiro IDE preferred, VS Code as fallback).
 *
 * Returns:
 *   200 — { success: true,  editor, editorPath, workspacePath }
 *   404 — workspace id not found in registry
 *   422 — workspace path missing on disk
 *   500 — unexpected error
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const { KiroLauncherService } = req2('./services/kiro-launcher') as any;

    const registry = new WorkspaceRegistry();
    const workspace = registry.get(params.id);

    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${params.id}` },
        { status: 404 },
      );
    }

    // Touch lastAccessedAt
    registry.touch(params.id);

    const launcher = new KiroLauncherService();
    const result = await launcher.open(workspace.workspacePath);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, workspacePath: result.workspacePath },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      editor: result.editor,
      editorPath: result.editorPath,
      workspacePath: result.workspacePath,
    });
  } catch (err: any) {
    console.error('[/api/workspaces/[id]/open POST]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to open workspace' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/workspaces/[id]/open
 * Check whether a compatible editor is installed (non-destructive probe).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const req2 = getRequire();
    const { WorkspaceRegistry } = req2('./services/workspace-registry') as any;
    const { KiroLauncherService } = req2('./services/kiro-launcher') as any;

    const registry = new WorkspaceRegistry();
    const workspace = registry.get(params.id);
    if (!workspace) {
      return NextResponse.json(
        { error: `Workspace not found: ${params.id}` },
        { status: 404 },
      );
    }

    const launcher = new KiroLauncherService();
    const [editors, isKiro] = await Promise.all([
      launcher.detectEditors(),
      launcher.isKiroInstalled(),
    ]);

    return NextResponse.json({
      workspaceId: params.id,
      workspacePath: workspace.workspacePath,
      isKiroInstalled: isKiro,
      availableEditors: editors.map((e: any) => ({
        name: e.name,
        isKiro: e.isKiro,
        path: e.path,
      })),
    });
  } catch (err: any) {
    console.error('[/api/workspaces/[id]/open GET]', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to check editor' },
      { status: 500 },
    );
  }
}
