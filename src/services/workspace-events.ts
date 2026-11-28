import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceEvent } from '../types';

/** A connected SSE subscriber */
interface Subscriber {
  id: string;
  workspaceId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  connectedAt: string;
}

/**
 * WorkspaceEventService
 *
 * Singleton-style in-process event bus for workspace monitoring events.
 *
 * Responsibilities:
 * - Receive WorkspaceEvents from WorkspaceMonitorService instances
 * - Buffer the last N events per workspace (ring buffer)
 * - Fan-out to all active SSE subscribers for that workspace
 * - Provide a ReadableStream factory for Next.js SSE responses
 *
 * Design:
 * - One WorkspaceEventService instance is shared across the process
 * - WorkspaceMonitorService instances are keyed by workspaceId
 * - SSE streams are plain ReadableStream<Uint8Array> (no extra deps)
 */
export class WorkspaceEventService extends EventEmitter {
  /** Max events kept per workspace (ring buffer) */
  private readonly bufferSize: number;
  /** workspaceId → circular event buffer */
  private readonly buffers: Map<string, WorkspaceEvent[]> = new Map();
  /** Active SSE subscribers */
  private readonly subscribers: Map<string, Subscriber> = new Map();
  /** Active monitor instances */
  private readonly monitors: Map<string, import('./workspace-monitor').WorkspaceMonitorService> = new Map();

  constructor(bufferSize = 100) {
    super();
    this.bufferSize = bufferSize;
  }

  // ─── Monitor management ────────────────────────────────────────────────────

  /**
   * Register a monitor and start forwarding its events into the bus.
   * Idempotent — calling twice with the same workspaceId is a no-op.
   */
  attachMonitor(
    monitor: import('./workspace-monitor').WorkspaceMonitorService,
    workspaceId: string,
  ): void {
    if (this.monitors.has(workspaceId)) return;

    this.monitors.set(workspaceId, monitor);
    monitor.on('event', (event: WorkspaceEvent) => {
      this.push(event);
    });
  }

  /** Detach and stop a monitor. */
  async detachMonitor(workspaceId: string): Promise<void> {
    const monitor = this.monitors.get(workspaceId);
    if (!monitor) return;

    if (monitor.isWatching) await monitor.stop();
    monitor.removeAllListeners('event');
    this.monitors.delete(workspaceId);
  }

  getMonitor(
    workspaceId: string,
  ): import('./workspace-monitor').WorkspaceMonitorService | undefined {
    return this.monitors.get(workspaceId);
  }

  // ─── Event publishing ──────────────────────────────────────────────────────

  /**
   * Push an event into the buffer and fan-out to all subscribers.
   * Can also be called directly for synthetic events (e.g. git commits).
   */
  push(event: WorkspaceEvent): void {
    // Buffer
    const buf = this.buffers.get(event.workspaceId) ?? [];
    buf.push(event);
    if (buf.length > this.bufferSize) buf.shift();
    this.buffers.set(event.workspaceId, buf);

    // Fan-out
    for (const sub of this.subscribers.values()) {
      if (sub.workspaceId === event.workspaceId) {
        this.sendToSubscriber(sub, event);
      }
    }

    // Also emit on the EventEmitter for other internal listeners
    this.emit('event', event);
    this.emit(`event:${event.workspaceId}`, event);
  }

  /**
   * Return buffered events for a workspace, optionally since a given event id.
   */
  getBuffer(workspaceId: string, sinceId?: string): WorkspaceEvent[] {
    const buf = this.buffers.get(workspaceId) ?? [];
    if (!sinceId) return [...buf];

    const idx = buf.findIndex(e => e.id === sinceId);
    return idx === -1 ? [...buf] : buf.slice(idx + 1);
  }

  // ─── SSE stream factory ────────────────────────────────────────────────────

  /**
   * Create a ReadableStream<Uint8Array> suitable for a Next.js SSE response.
   *
   * The stream:
   * - Sends a 'connected' event immediately
   * - Replays buffered events (or events since `lastEventId`)
   * - Keeps the connection alive with 20 s keepalive comments
   * - Cleans up subscriber on stream cancellation
   *
   * Usage in a Next.js route:
   *   const stream = eventService.createStream(workspaceId);
   *   return new Response(stream, {
   *     headers: {
   *       'Content-Type': 'text/event-stream',
   *       'Cache-Control': 'no-cache',
   *       'Connection': 'keep-alive',
   *     }
   *   });
   */
  createStream(workspaceId: string, lastEventId?: string): ReadableStream<Uint8Array> {
    const subscriberId = uuidv4();
    const enc = new TextEncoder();
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const subscriber: Subscriber = {
          id: subscriberId,
          workspaceId,
          controller,
          connectedAt: new Date().toISOString(),
        };
        this.subscribers.set(subscriberId, subscriber);

        // Send connected message
        controller.enqueue(enc.encode(
          `event: connected\ndata: ${JSON.stringify({
            workspaceId,
            subscriberId,
            connectedAt: subscriber.connectedAt,
          })}\n\n`,
        ));

        // Replay buffered events
        const replayed = this.getBuffer(workspaceId, lastEventId);
        for (const event of replayed) {
          this.sendToSubscriber(subscriber, event);
        }

        // Keepalive every 20 s
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(enc.encode(`: keepalive\n\n`));
          } catch {
            // Stream already closed
          }
        }, 20_000);
      },

      cancel: () => {
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        this.subscribers.delete(subscriberId);
      },
    });

    return stream;
  }

  /** Number of active SSE subscribers for a workspace. */
  subscriberCount(workspaceId: string): number {
    let count = 0;
    for (const sub of this.subscribers.values()) {
      if (sub.workspaceId === workspaceId) count++;
    }
    return count;
  }

  /** Close all SSE streams for a workspace (e.g. when it's deleted). */
  closeStreams(workspaceId: string): void {
    for (const [id, sub] of this.subscribers.entries()) {
      if (sub.workspaceId === workspaceId) {
        try { sub.controller.close(); } catch { /* already closed */ }
        this.subscribers.delete(id);
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private sendToSubscriber(sub: Subscriber, event: WorkspaceEvent): void {
    const enc = new TextEncoder();
    try {
      sub.controller.enqueue(enc.encode(
        `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      ));
    } catch {
      // Stream closed — remove subscriber
      this.subscribers.delete(sub.id);
    }
  }
}

/**
 * Process-level singleton.
 * Import this in API routes and other services that need the shared bus.
 */
export const globalEventService = new WorkspaceEventService();
