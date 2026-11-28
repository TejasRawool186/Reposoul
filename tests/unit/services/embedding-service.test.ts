/**
 * Tests for EmbeddingService
 *
 * Groq SDK is mocked — no real network calls.
 * The deterministic bag-of-words fallback is fully exercised.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../../../src/services/embedding-service';
import { makeRepository, abandonedRepo } from '../../fixtures/github.fixtures';

// ─── Mock groq-sdk ────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
vi.mock('groq-sdk', () => ({
  Groq: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate,
    },
  })),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── isAvailable ───────────────────────────────────────────────────────────

  describe('isAvailable', () => {
    it('returns false without an API key', () => {
      const service = new EmbeddingService();
      expect(service.isAvailable).toBe(false);
    });

    it('returns true with an API key', () => {
      const service = new EmbeddingService({ groqApiKey: 'test-key' });
      expect(service.isAvailable).toBe(true);
    });
  });

  // ─── Deterministic fallback ─────────────────────────────────────────────────

  describe('deterministic fallback embedding', () => {
    let service: EmbeddingService;

    beforeEach(() => {
      service = new EmbeddingService(); // no key → fallback
    });

    it('returns a 256-dimensional vector', async () => {
      const result = await service.embed('machine learning library');
      expect(result.dimensions).toBe(256);
      expect(result.vector.length).toBe(256);
    });

    it('uses the deterministic-bow-256 model name', async () => {
      const result = await service.embed('some text');
      expect(result.model).toBe('deterministic-bow-256');
    });

    it('is deterministic — same input produces the same output', async () => {
      const a = await service.embed('abandoned python machine learning');
      service.clearCache(); // bypass cache to test pure determinism
      const b = await service.embed('abandoned python machine learning');
      expect(a.vector).toEqual(b.vector);
    });

    it('different inputs produce different vectors', async () => {
      const a = await service.embed('python machine learning');
      const b = await service.embed('rust systems programming');
      expect(a.vector).not.toEqual(b.vector);
    });

    it('vector is L2-normalised', async () => {
      const result = await service.embed('some words to embed here');
      const norm = Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    });

    it('empty string produces a zero vector without throwing', async () => {
      const result = await service.embed('');
      expect(result.vector.length).toBe(256);
      // All zeros
      expect(result.vector.every(v => v === 0)).toBe(true);
    });

    it('embedRepository combines repo metadata', async () => {
      const repo = makeRepository({
        description: 'A machine learning toolkit for tabular data',
        topics: ['ml', 'data-science'],
      });
      const result = await service.embedRepository(repo);
      // full_name is normalised — '/' becomes a space
      expect(result.inputText).toContain('owner test-repo');
      expect(result.inputText).toContain('machine learning toolkit');
      expect(result.inputText).toContain('data-science');
    });

    it('caches identical inputs', async () => {
      const first = await service.embed('cached text input');
      const second = await service.embed('cached text input');
      // Same object reference — served from cache
      expect(second).toBe(first);
    });
  });

  // ─── Cosine similarity ─────────────────────────────────────────────────────

  describe('cosineSimilarity', () => {
    let service: EmbeddingService;

    beforeEach(() => {
      service = new EmbeddingService();
    });

    it('identical vectors have similarity 1', () => {
      const v = [0.1, 0.2, 0.3];
      expect(service.cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it('orthogonal vectors have similarity 0', () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(service.cosineSimilarity(a, b)).toBe(0);
    });

    it('zero vector has similarity 0', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(service.cosineSimilarity(a, b)).toBe(0);
    });

    it('different-length vectors return 0', () => {
      expect(service.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it('semantically related text scores higher than unrelated text', async () => {
      const query = await service.embed('python machine learning library');
      const related = await service.embed('A Python machine learning library for classification');
      const unrelated = await service.embed('Rust embedded systems driver for SPI peripherals');

      const relSim = service.cosineSimilarity(query.vector, related.vector);
      const unrelSim = service.cosineSimilarity(query.vector, unrelated.vector);
      expect(relSim).toBeGreaterThan(unrelSim);
    });
  });

  // ─── Groq path ─────────────────────────────────────────────────────────────

  describe('Groq embedding path', () => {
    it('returns Groq vector when API succeeds', async () => {
      const service = new EmbeddingService({ groqApiKey: 'test-key' });
      const groqVector = Array.from({ length: 8 }, (_, i) => i + 1);
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: groqVector }],
      });

      const result = await service.embed('some text');
      expect(result.vector).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(result.model).toBe('nomic-embed-text-v1_5');
      expect(result.dimensions).toBe(8);
    });

    it('handles string-typed embedding elements from Groq SDK', async () => {
      const service = new EmbeddingService({ groqApiKey: 'test-key' });
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: ['1.5', '2.5', '3.5'] }],
      });

      const result = await service.embed('text');
      expect(result.vector).toEqual([1.5, 2.5, 3.5]);
    });

    it('falls back to deterministic when Groq fails', async () => {
      const service = new EmbeddingService({ groqApiKey: 'test-key' });
      mockCreate.mockRejectedValueOnce(new Error('API down'));

      const result = await service.embed('some text');
      expect(result.model).toBe('deterministic-bow-256');
      expect(result.dimensions).toBe(256);
    });

    it('falls back when Groq returns an empty embedding', async () => {
      const service = new EmbeddingService({ groqApiKey: 'test-key' });
      mockCreate.mockResolvedValueOnce({ data: [{ embedding: [] }] });

      const result = await service.embed('some text');
      expect(result.model).toBe('deterministic-bow-256');
    });
  });

  // ─── repositoryToText ───────────────────────────────────────────────────────

  describe('repositoryToText', () => {
    it('uses a public method for repo text — accessible via embedRepository', async () => {
      const service = new EmbeddingService();
      const repo = abandonedRepo;
      const result = await service.embedRepository(repo);
      expect(result.inputText).toContain('old-owner/abandoned-repo'.replace('/', ' '));
    });

    it('handles repo with null description and no topics', async () => {
      const service = new EmbeddingService();
      const repo = makeRepository({ description: null, topics: [], language: null });
      const result = await service.embedRepository(repo);
      expect(result.inputText.length).toBeGreaterThan(0); // at least the full_name
    });
  });
});
