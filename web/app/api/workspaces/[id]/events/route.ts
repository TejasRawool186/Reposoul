import { NextRequest } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

/**
 * GET /api/workspaces/[id]/events
 *
 * Server-Sent Events (SSE) stream for a workspace.
 *
 * The client connects and receives:
 *   - An immediate 'connected' event with subscriber metadata
 *   - Buffered events that occurred since `Last-Event-ID` (if provided)
 *   - Live events as they are emitted by the WorkspaceMonitorService
 *   - A `: keepalive` comment every 20 s to prevent proxy timeouts
 *
 * The monitor is started on first connection and kept running while
 * there is at least one subscriber. It is stopped automatically when
 * the last subscriber disconnects.
 *
 * Query params:
 *   ?autoStart=true  — start the filesystem watcher immediately (default: true)
 *
 * Headers sent by client:
 *   Last-Event-ID    — resume from this event id
 *
 * Response: text/event-stream (never-ending)
 *   404 — workspace id not found in registry
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const req2 = getRequire();
  const { WorkspaceRegistry }       = req2('./services/workspace-registry') as any;
  const { WorkspaceMonitorService } = req2('./services/workspace-monitor') as any;
  const { globalEventService }      = req2('./services/workspace-events') as any;

  const registry  = new WorkspaceRegistry();
  const workspace = registry.get(params.id);

  if (!workspace) {
    return new Response(
      JSON.stringify({ error: `Workspace not found: ${params.id}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Retrieve or create a monitor for this workspace
  let monitor = globalEventService.getMonitor(params.id);
  if (!monitor) {
    monitor = new WorkspaceMonitorService(params.id, workspace.workspacePath);
    globalEventService.attachMonitor(monitor, params.id);
  }

  // Start the watcher unless it's already running
  const autoStart = req.nextUrl.searchParams.get('autoStart') !== 'false';
  if (autoStart && !monitor.isWatching) {
    try {
      await monitor.start();
    } catch (err: any) {
      console.warn('[/api/workspaces/[id]/events] Monitor start failed:', err?.message);
      // Non-fatal — stream still sends buffered events
    }
  }

  // Resume support via Last-Event-ID header
  const lastEventId = req.headers.get('Last-Event-ID') ?? undefined;

  const stream = globalEventService.createStream(params.id, lastEventId);

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
