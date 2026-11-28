/**
 * Tests for WorkspaceEventService
 *
 * No external dependencies — all interactions are in-memory.
 * ReadableStream is available in Node 18+ (used in test environment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceEventService } from '../../../src/services/workspace-events';
import type { WorkspaceEvent } from '../../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  workspaceId: string,
  type: WorkspaceEvent['type'] = 'file_changed',
  id = `evt-${Math.random().toString(36).slice(2)}`,
): WorkspaceEvent {
  return {
    id,
    workspaceId,
    type,
    path: 'src/index.ts',
    timestamp: new Date().toISOString(),
  };
}

function makeService(bufferSize = 10): WorkspaceEventService {
  return new WorkspaceEventService(bufferSize);
}

/** Drain the first N SSE lines from a ReadableStream as text */
async function drainStream(stream: ReadableStream<Uint8Array>, timeoutMs = 200): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let result = '';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<{ done: boolean; value: undefined }>(resolve =>
        setTimeout(() => resolve({ done: true, value: undefined }), timeoutMs),
      ),
    ]);
    if (done || !value) break;
    result += dec.decode(value);
  }

  reader.releaseLock();
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceEventService', () => {

  // ─── push + getBuffer ──────────────────────────────────────────────────────

  describe('push + getBuffer', () => {
    it('returns empty buffer for unknown workspaceId', () => {
      const svc = makeService();
      expect(svc.getBuffer('unknown')).toEqual([]);
    });

    it('buffers a pushed event', () => {
      const svc = makeService();
      const evt = makeEvent('ws-1');
      svc.push(evt);
      expect(svc.getBuffer('ws-1')).toHaveLength(1);
      expect(svc.getBuffer('ws-1')[0].id).toBe(evt.id);
    });

    it('buffers multiple events', () => {
      const svc = makeService();
      svc.push(makeEvent('ws-1'));
      svc.push(makeEvent('ws-1'));
      svc.push(makeEvent('ws-1'));
      expect(svc.getBuffer('ws-1')).toHaveLength(3);
    });

    it('respects buffer size (ring buffer — oldest is dropped)', () => {
      const svc = makeService(3); // max 3
      for (let i = 0; i < 5; i++) {
        svc.push(makeEvent('ws-ring', 'file_changed', `evt-${i}`));
      }
      const buf = svc.getBuffer('ws-ring');
      expect(buf).toHaveLength(3);
      // oldest two are gone
      expect(buf[0].id).toBe('evt-2');
      expect(buf[2].id).toBe('evt-4');
    });

    it('keeps buffers separate per workspaceId', () => {
      const svc = makeService();
      svc.push(makeEvent('ws-a'));
      svc.push(makeEvent('ws-b'));
      svc.push(makeEvent('ws-b'));
      expect(svc.getBuffer('ws-a')).toHaveLength(1);
      expect(svc.getBuffer('ws-b')).toHaveLength(2);
    });

    it('getBuffer with sinceId returns events after that id', () => {
      const svc = makeService();
      const e1 = makeEvent('ws-1', 'file_added',   'id-1');
      const e2 = makeEvent('ws-1', 'file_changed', 'id-2');
      const e3 = makeEvent('ws-1', 'file_deleted', 'id-3');
      svc.push(e1); svc.push(e2); svc.push(e3);

      const after = svc.getBuffer('ws-1', 'id-1');
      expect(after).toHaveLength(2);
      expect(after[0].id).toBe('id-2');
      expect(after[1].id).toBe('id-3');
    });

    it('getBuffer returns all events when sinceId is unknown', () => {
      const svc = makeService();
      svc.push(makeEvent('ws-1', 'file_added', 'id-1'));
      svc.push(makeEvent('ws-1', 'file_added', 'id-2'));
      expect(svc.getBuffer('ws-1', 'nonexistent-id')).toHaveLength(2);
    });

    it('emits event and event:<workspaceId> on the EventEmitter', () => {
      const svc = makeService();
      const listener = vi.fn();
      svc.on('event', listener);
      svc.on('event:ws-em', listener);

      const evt = makeEvent('ws-em');
      svc.push(evt);

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  // ─── subscriberCount ──────────────────────────────────────────────────────

  describe('subscriberCount', () => {
    it('returns 0 when no streams are open', () => {
      const svc = makeService();
      expect(svc.subscriberCount('ws-1')).toBe(0);
    });

    it('increments when a stream is created', () => {
      const svc = makeService();
      svc.createStream('ws-sub');
      expect(svc.subscriberCount('ws-sub')).toBe(1);
    });

    it('tracks multiple streams per workspace', () => {
      const svc = makeService();
      svc.createStream('ws-multi');
      svc.createStream('ws-multi');
      expect(svc.subscriberCount('ws-multi')).toBe(2);
    });

    it('keeps streams for different workspaces separate', () => {
      const svc = makeService();
      svc.createStream('ws-x');
      svc.createStream('ws-y');
      svc.createStream('ws-y');
      expect(svc.subscriberCount('ws-x')).toBe(1);
      expect(svc.subscriberCount('ws-y')).toBe(2);
    });
  });

  // ─── createStream ─────────────────────────────────────────────────────────

  describe('createStream', () => {
    it('returns a ReadableStream', () => {
      const svc = makeService();
      const stream = svc.createStream('ws-stream');
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('sends a connected event as the first chunk', async () => {
      const svc = makeService();
      const stream = svc.createStream('ws-conn');
      const text = await drainStream(stream, 300);
      expect(text).toContain('event: connected');
      expect(text).toContain('"workspaceId":"ws-conn"');
    });

    it('replays buffered events', async () => {
      const svc = makeService();
      const evt = makeEvent('ws-replay', 'file_changed', 'replay-id');
      svc.push(evt);

      const stream = svc.createStream('ws-replay');
      const text = await drainStream(stream, 300);
      expect(text).toContain('id: replay-id');
      expect(text).toContain('event: file_changed');
    });

    it('fan-out: pushes after subscribe are delivered', async () => {
      const svc = makeService();
      const stream = svc.createStream('ws-fanout');

      // Read initial data first
      const reader = stream.getReader();
      const dec = new TextDecoder();
      let received = '';

      const readPromise = (async () => {
        const deadline = Date.now() + 400;
        while (Date.now() < deadline) {
          const { done, value } = await Promise.race([
            reader.read(),
            new Promise<{ done: boolean; value: undefined }>(r =>
              setTimeout(() => r({ done: true, value: undefined }), 300),
            ),
          ]);
          if (done || !value) break;
          received += dec.decode(value);
          if (received.includes('live-event-id')) break;
        }
        reader.releaseLock();
      })();

      // Push a live event
      await new Promise(r => setTimeout(r, 10));
      svc.push(makeEvent('ws-fanout', 'git_commit', 'live-event-id'));

      await readPromise;
      expect(received).toContain('live-event-id');
    });

    it('replay uses sinceId to skip old events', async () => {
      const svc = makeService();
      svc.push(makeEvent('ws-since', 'file_added',   'old-id'));
      svc.push(makeEvent('ws-since', 'file_changed', 'new-id'));

      const stream = svc.createStream('ws-since', 'old-id');
      const text = await drainStream(stream, 300);
      expect(text).not.toContain('old-id');
      expect(text).toContain('new-id');
    });
  });

  // ─── closeStreams ─────────────────────────────────────────────────────────

  describe('closeStreams', () => {
    it('reduces subscriber count to 0', () => {
      const svc = makeService();
      svc.createStream('ws-close');
      svc.createStream('ws-close');
      expect(svc.subscriberCount('ws-close')).toBe(2);

      svc.closeStreams('ws-close');
      expect(svc.subscriberCount('ws-close')).toBe(0);
    });

    it('does not affect other workspace streams', () => {
      const svc = makeService();
      svc.createStream('ws-keep');
      svc.createStream('ws-delete');
      svc.closeStreams('ws-delete');
      expect(svc.subscriberCount('ws-keep')).toBe(1);
    });

    it('is a no-op for unknown workspaceId', () => {
      const svc = makeService();
      expect(() => svc.closeStreams('nonexistent')).not.toThrow();
    });
  });

  // ─── attachMonitor ────────────────────────────────────────────────────────

  describe('attachMonitor', () => {
    it('forwards events from the monitor to the bus', () => {
      const svc = makeService();
      const received: WorkspaceEvent[] = [];
      svc.on('event', e => received.push(e));

      // Create a minimal EventEmitter-like mock monitor
      const { EventEmitter } = require('events');
      const mockMonitor = new EventEmitter();
      (mockMonitor as any).isWatching = false;
      (mockMonitor as any).stop = vi.fn().mockResolvedValue(undefined);

      svc.attachMonitor(mockMonitor as any, 'ws-attach');
      mockMonitor.emit('event', makeEvent('ws-attach', 'file_added', 'fwd-id'));

      expect(received.some(e => e.id === 'fwd-id')).toBe(true);
    });

    it('is idempotent — attaching same workspaceId twice is a no-op', () => {
      const svc = makeService();
      const { EventEmitter } = require('events');
      const m1 = new EventEmitter();
      (m1 as any).isWatching = false;
      (m1 as any).stop = vi.fn();

      svc.attachMonitor(m1 as any, 'ws-idem');
      svc.attachMonitor(m1 as any, 'ws-idem'); // second call

      expect(svc.getMonitor('ws-idem')).toBe(m1);
    });

    it('getMonitor returns undefined for unknown workspaceId', () => {
      const svc = makeService();
      expect(svc.getMonitor('nonexistent')).toBeUndefined();
    });
  });

  // ─── detachMonitor ────────────────────────────────────────────────────────

  describe('detachMonitor', () => {
    it('removes the monitor', async () => {
      const svc = makeService();
      const { EventEmitter } = require('events');
      const m = new EventEmitter();
      (m as any).isWatching = false;
      (m as any).stop = vi.fn().mockResolvedValue(undefined);

      svc.attachMonitor(m as any, 'ws-detach');
      expect(svc.getMonitor('ws-detach')).toBeDefined();

      await svc.detachMonitor('ws-detach');
      expect(svc.getMonitor('ws-detach')).toBeUndefined();
    });

    it('calls stop() when monitor is watching', async () => {
      const svc = makeService();
      const { EventEmitter } = require('events');
      const m = new EventEmitter();
      const stopFn = vi.fn().mockResolvedValue(undefined);
      (m as any).isWatching = true;
      (m as any).stop = stopFn;

      svc.attachMonitor(m as any, 'ws-stop');
      await svc.detachMonitor('ws-stop');
      expect(stopFn).toHaveBeenCalledOnce();
    });

    it('is a no-op for unknown workspaceId', async () => {
      const svc = makeService();
      await expect(svc.detachMonitor('nonexistent')).resolves.not.toThrow();
    });
  });
});
