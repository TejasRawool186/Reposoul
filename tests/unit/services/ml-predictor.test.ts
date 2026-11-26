/**
 * Tests for MLPredictor
 *
 * Models are not trained in the upstream codebase (accuracy: 0 placeholder).
 * Tests verify: loading behavior, graceful fallback when models unavailable,
 * and that enhanceAnalysis always returns a valid EnhancedRepositoryAnalysis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MLPredictor } from '../../../src/services/ml-predictor';
import { makeRepository } from '../../fixtures/github.fixtures';
import type { RepositoryAnalysis } from '../../../src/types';

// Mock the entire fs module so existsSync and readFileSync are controllable
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import * as fs from 'fs';

function makeBaseAnalysis(overrides: Partial<RepositoryAnalysis> = {}): RepositoryAnalysis {
  return {
    repository: makeRepository(),
    abandonmentScore: 60,
    revivalPotential: 50,
    lastCommitAge: 400,
    issueResponseTime: -1,
    dependencyHealth: 'unknown',
    communityEngagement: 30,
    technicalComplexity: 'medium',
    marketRelevance: 50,
    reasons: ['No commits in 1.1 years'],
    recommendations: ['High revival potential'],
    ...overrides,
  };
}

describe('MLPredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no models file
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
  });

  // ─── Model loading ────────────────────────────────────────────────────────

  describe('model loading', () => {
    it('reports ML unavailable when models file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const predictor = new MLPredictor();
      expect(predictor.isMLAvailable()).toBe(false);
    });

    it('reports ML unavailable when models file is invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');
      const predictor = new MLPredictor();
      expect(predictor.isMLAvailable()).toBe(false);
    });

    it('reports ML unavailable when models file has no model entries', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      const predictor = new MLPredictor();
      expect(predictor.isMLAvailable()).toBe(false);
    });

    it('reports ML available when at least two valid models are loaded', () => {
      const models = {
        abandonment: { type: 'abandonment', algorithm: 'linear_regression', accuracy: 0.7, features: [], weights: [0.1], model_data: {}, trained_at: '2024-01-01', training_samples: 100 },
        revival_success: { type: 'revival_success', algorithm: 'linear_regression', accuracy: 0.65, features: [], weights: [0.1], model_data: {}, trained_at: '2024-01-01', training_samples: 100 },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(models));
      const predictor = new MLPredictor();
      expect(predictor.isMLAvailable()).toBe(true);
    });
  });

  // ─── getModelInfo ─────────────────────────────────────────────────────────

  describe('getModelInfo', () => {
    it('returns empty object when no models loaded', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const predictor = new MLPredictor();
      expect(predictor.getModelInfo()).toEqual({});
    });

    it('returns info keyed by model name when models are loaded', () => {
      const models = {
        abandonment: { type: 'abandonment', algorithm: 'linear_regression', accuracy: 0.7, features: [], weights: [], model_data: {}, trained_at: '2024-01-01T00:00:00Z', training_samples: 50 },
        revival_success: { type: 'revival_success', algorithm: 'linear_regression', accuracy: 0.6, features: [], weights: [], model_data: {}, trained_at: '2024-01-01T00:00:00Z', training_samples: 50 },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(models));

      const predictor = new MLPredictor();
      const info = predictor.getModelInfo();

      expect(info).toHaveProperty('abandonment');
      expect(info.abandonment.accuracy).toBe(0.7);
      expect(info.abandonment.algorithm).toBe('linear_regression');
    });
  });

  // ─── enhanceAnalysis fallback ─────────────────────────────────────────────

  describe('enhanceAnalysis', () => {
    it('falls back to rule-based when ML is unavailable', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const predictor = new MLPredictor();
      const repo = makeRepository();
      const baseAnalysis = makeBaseAnalysis();

      const result = await predictor.enhanceAnalysis(repo, baseAnalysis, {
        useMLScoring: true,
        confidenceThreshold: 0.7,
        fallbackToRuleBase: true,
      });

      expect(result.scoringMethod).toBe('rule-based');
      expect(result.mlPrediction).toBeUndefined();
    });

    it('returns enhanced analysis with scoringMethod set', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const predictor = new MLPredictor();
      const result = await predictor.enhanceAnalysis(
        makeRepository(),
        makeBaseAnalysis(),
        { useMLScoring: false, confidenceThreshold: 0.7, fallbackToRuleBase: true }
      );

      expect(result).toHaveProperty('scoringMethod');
      expect(['rule-based', 'ml-enhanced', 'hybrid']).toContain(result.scoringMethod);
    });

    it('preserves base analysis fields in result', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const predictor = new MLPredictor();
      const baseAnalysis = makeBaseAnalysis({ abandonmentScore: 77, revivalPotential: 42 });

      const result = await predictor.enhanceAnalysis(
        makeRepository(),
        baseAnalysis,
        { useMLScoring: false, confidenceThreshold: 0.7, fallbackToRuleBase: true }
      );

      expect(result.abandonmentScore).toBe(77);
      expect(result.revivalPotential).toBe(42);
    });
  });
});
