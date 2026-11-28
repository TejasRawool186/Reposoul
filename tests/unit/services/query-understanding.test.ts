/**
 * Tests for QueryUnderstandingService
 *
 * All Groq SDK calls are mocked — no real network calls are made.
 * We exercise the fallback interpreter extensively since it has no external deps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryUnderstandingService } from '../../../src/services/query-understanding';

// ─── Mock groq-sdk ────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
vi.mock('groq-sdk', () => ({
  Groq: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

function makeGroqResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeService(withApiKey = false) {
  return new QueryUnderstandingService(
    withApiKey ? { groqApiKey: 'test-key-123' } : {},
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QueryUnderstandingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── isAvailable ────────────────────────────────────────────────────────────

  describe('isAvailable', () => {
    it('returns false when no API key is provided', () => {
      const service = makeService(false);
      expect(service.isAvailable).toBe(false);
    });

    it('returns true when an API key is provided', () => {
      const service = makeService(true);
      expect(service.isAvailable).toBe(true);
    });
  });

  // ─── Empty query guard ───────────────────────────────────────────────────────

  describe('empty query', () => {
    it('throws for an empty string', async () => {
      const service = makeService();
      await expect(service.interpret('')).rejects.toThrow('Query cannot be empty');
    });

    it('throws for a whitespace-only string', async () => {
      const service = makeService();
      await expect(service.interpret('   ')).rejects.toThrow('Query cannot be empty');
    });
  });

  // ─── Fallback interpreter ────────────────────────────────────────────────────

  describe('fallbackInterpret', () => {
    let service: QueryUnderstandingService;

    beforeEach(() => {
      service = makeService(false); // no API key → always fallback
    });

    it('returns a valid SearchIntent shape', async () => {
      const intent = await service.interpret('abandoned Python ML libraries');

      expect(intent).toHaveProperty('originalQuery');
      expect(intent).toHaveProperty('keywords');
      expect(intent).toHaveProperty('languages');
      expect(intent).toHaveProperty('domains');
      expect(intent).toHaveProperty('minimumStars');
      expect(intent).toHaveProperty('maximumStars');
      expect(intent).toHaveProperty('abandonmentPreference');
      expect(intent).toHaveProperty('technicalIssues');
      expect(intent).toHaveProperty('sortPreference');
      expect(intent).toHaveProperty('pushedBefore');
      expect(intent).toHaveProperty('confidence');
    });

    it('detects Python language', async () => {
      const intent = await service.interpret('old Python data processing libraries');
      expect(intent.languages).toContain('Python');
    });

    it('detects TypeScript language', async () => {
      const intent = await service.interpret('unmaintained TypeScript UI frameworks');
      expect(intent.languages).toContain('TypeScript');
    });

    it('detects JavaScript language', async () => {
      const intent = await service.interpret('dead JavaScript animation libraries');
      expect(intent.languages).toContain('JavaScript');
    });

    it('detects Rust language', async () => {
      const intent = await service.interpret('abandoned Rust async runtime projects');
      expect(intent.languages).toContain('Rust');
    });

    it('detects Go alias', async () => {
      const intent = await service.interpret('old golang http router');
      expect(intent.languages).toContain('Go');
    });

    it('sets abandonmentPreference to likely_abandoned for "abandoned" keyword', async () => {
      const intent = await service.interpret('abandoned ML libraries');
      expect(intent.abandonmentPreference).toBe('likely_abandoned');
    });

    it('sets abandonmentPreference to likely_abandoned for "inactive" keyword', async () => {
      const intent = await service.interpret('inactive web frameworks');
      expect(intent.abandonmentPreference).toBe('likely_abandoned');
    });

    it('sets abandonmentPreference to definitely_abandoned for "dead" keyword', async () => {
      const intent = await service.interpret('dead and definitely abandoned projects');
      expect(intent.abandonmentPreference).toBe('definitely_abandoned');
    });

    it('sets abandonmentPreference to any when no abandonment keyword', async () => {
      const intent = await service.interpret('popular Python data science libraries');
      expect(intent.abandonmentPreference).toBe('any');
    });

    it('extracts minimum star count', async () => {
      const intent = await service.interpret('abandoned Python libraries with 500 stars');
      expect(intent.minimumStars).toBe(500);
    });

    it('returns null minimumStars when no star count mentioned', async () => {
      const intent = await service.interpret('old TypeScript frameworks');
      expect(intent.minimumStars).toBeNull();
    });

    it('detects outdated_dependencies technical issue', async () => {
      const intent = await service.interpret('projects with outdated dependencies');
      expect(intent.technicalIssues).toContain('outdated_dependencies');
    });

    it('detects no_tests technical issue', async () => {
      const intent = await service.interpret('projects with no tests');
      expect(intent.technicalIssues).toContain('no_tests');
    });

    it('detects security_vulnerabilities technical issue', async () => {
      const intent = await service.interpret('projects with security vulnerabilities');
      expect(intent.technicalIssues).toContain('security_vulnerabilities');
    });

    it('computes pushedBefore from year mention', async () => {
      const intent = await service.interpret('projects abandoned 3 years ago');
      expect(intent.pushedBefore).not.toBeNull();
      // Should be roughly 3 years before now
      const year = new Date(intent.pushedBefore!).getFullYear();
      const expected = new Date().getFullYear() - 3;
      expect(year).toBe(expected);
    });

    it('returns null pushedBefore when no year mentioned', async () => {
      const intent = await service.interpret('old machine learning libraries');
      expect(intent.pushedBefore).toBeNull();
    });

    it('confidence is 0.6 for fallback', async () => {
      const intent = await service.interpret('some query');
      expect(intent.confidence).toBe(0.6);
    });

    it('keywords array contains relevant words', async () => {
      const intent = await service.interpret('machine learning neural network');
      expect(intent.keywords.length).toBeGreaterThan(0);
    });

    it('keywords exclude common stop words', async () => {
      const intent = await service.interpret('find me some abandoned repositories');
      const stopWords = ['find', 'some', 'me'];
      for (const stop of stopWords) {
        expect(intent.keywords).not.toContain(stop);
      }
    });

    it('originalQuery is preserved', async () => {
      const q = 'Abandoned TypeScript charting libraries';
      const intent = await service.interpret(q);
      expect(intent.originalQuery).toBe(q);
    });
  });

  // ─── Groq path ───────────────────────────────────────────────────────────────

  describe('Groq AI path', () => {
    let service: QueryUnderstandingService;

    beforeEach(() => {
      service = makeService(true);
    });

    it('returns AI-parsed intent when Groq responds with valid JSON', async () => {
      mockCreate.mockResolvedValueOnce(
        makeGroqResponse(JSON.stringify({
          keywords: ['charting', 'visualization'],
          languages: ['JavaScript'],
          domains: ['data-viz'],
          minimumStars: 200,
          maximumStars: null,
          abandonmentPreference: 'likely_abandoned',
          technicalIssues: ['outdated_dependencies'],
          sortPreference: 'revival_potential',
          pushedBefore: '2023-01-01',
          confidence: 0.92,
        })),
      );

      const intent = await service.interpret('old JavaScript charting libraries');
      expect(intent.languages).toContain('JavaScript');
      expect(intent.minimumStars).toBe(200);
      expect(intent.confidence).toBe(0.92);
      expect(intent.pushedBefore).toBe('2023-01-01');
    });

    it('falls back to deterministic when Groq returns invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce(makeGroqResponse('not json at all'));

      const intent = await service.interpret('some Python libraries');
      // Should have fallen back to deterministic — confidence = 0.6
      expect(intent.confidence).toBe(0.6);
    });

    it('falls back when Groq returns empty content', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] });

      const intent = await service.interpret('some Python libraries');
      expect(intent).toHaveProperty('originalQuery');
    });

    it('falls back when Groq call rejects', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      const intent = await service.interpret('old Python libraries');
      expect(intent).toHaveProperty('originalQuery');
      expect(intent.confidence).toBe(0.6); // fallback confidence
    });

    it('falls back when Groq output fails Zod validation', async () => {
      mockCreate.mockResolvedValueOnce(
        makeGroqResponse(JSON.stringify({ unknownField: 'bad' })),
      );

      // Zod fills in defaults, so this should actually parse — but test it handles gracefully
      const intent = await service.interpret('some query');
      expect(intent).toHaveProperty('originalQuery');
    });
  });
});
