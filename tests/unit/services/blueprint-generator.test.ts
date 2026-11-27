/**
 * Tests for BlueprintGenerator
 *
 * BlueprintGenerator is a pure transformation service — no network calls,
 * no file I/O. All tests are synchronous-friendly and use deterministic fixtures.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlueprintGenerator } from '../../../src/services/blueprint-generator';
import {
  makeAnalysis,
  highPotentialAnalysis,
  lowPotentialAnalysis,
  activeAnalysis,
  makeDependencyAnalysis,
  criticalDepAnalysis,
} from '../../fixtures/github.fixtures';

describe('BlueprintGenerator', () => {
  let generator: BlueprintGenerator;

  beforeEach(() => {
    generator = new BlueprintGenerator();
  });

  // ─── Output shape ─────────────────────────────────────────────────────────

  describe('generate — output shape', () => {
    it('returns all required top-level fields', () => {
      const bp = generator.generate(makeAnalysis());

      expect(bp).toHaveProperty('repository');
      expect(bp).toHaveProperty('generatedAt');
      expect(bp).toHaveProperty('version', '1.0');
      expect(bp).toHaveProperty('recommendation');
      expect(bp).toHaveProperty('recommendationReason');
      expect(bp).toHaveProperty('overallScore');
      expect(bp).toHaveProperty('confidence');
      expect(bp).toHaveProperty('scores');
      expect(bp).toHaveProperty('effortEstimate');
      expect(bp).toHaveProperty('riskRegister');
      expect(bp).toHaveProperty('actionItems');
      expect(bp).toHaveProperty('dependencyUpgrades');
      expect(bp).toHaveProperty('executiveSummary');
      expect(bp).toHaveProperty('technicalAssessment');
      expect(bp).toHaveProperty('communityAssessment');
      expect(bp).toHaveProperty('revivalStrategy');
      expect(bp).toHaveProperty('sections');
      expect(bp).toHaveProperty('tags');
    });

    it('repository field matches analysis full_name', () => {
      const analysis = makeAnalysis();
      const bp = generator.generate(analysis);
      expect(bp.repository).toBe(analysis.repository.full_name);
    });

    it('generatedAt is a valid ISO string', () => {
      const bp = generator.generate(makeAnalysis());
      expect(() => new Date(bp.generatedAt)).not.toThrow();
      expect(new Date(bp.generatedAt).toISOString()).toBe(bp.generatedAt);
    });

    it('scores object contains all score fields', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.scores).toHaveProperty('abandonment');
      expect(bp.scores).toHaveProperty('revivalPotential');
      expect(bp.scores).toHaveProperty('communityEngagement');
      expect(bp.scores).toHaveProperty('dependencyHealth');
      expect(bp.scores).toHaveProperty('technicalComplexity');
    });

    it('scores reflect the input analysis values', () => {
      const analysis = makeAnalysis({ abandonmentScore: 77, revivalPotential: 42 });
      const bp = generator.generate(analysis);
      expect(bp.scores.abandonment).toBe(77);
      expect(bp.scores.revivalPotential).toBe(42);
    });

    it('riskRegister and actionItems are arrays', () => {
      const bp = generator.generate(makeAnalysis());
      expect(Array.isArray(bp.riskRegister)).toBe(true);
      expect(Array.isArray(bp.actionItems)).toBe(true);
    });

    it('sections contains expected section ids', () => {
      const bp = generator.generate(makeAnalysis());
      const ids = bp.sections.map(s => s.id);
      expect(ids).toContain('executive-summary');
      expect(ids).toContain('technical-assessment');
      expect(ids).toContain('community-assessment');
      expect(ids).toContain('revival-strategy');
      expect(ids).toContain('risk-register');
      expect(ids).toContain('action-items');
    });
  });

  // ─── Recommendation logic ─────────────────────────────────────────────────

  describe('recommendation', () => {
    it('recommends revive for high potential, clearly abandoned repo', () => {
      const bp = generator.generate(highPotentialAnalysis);
      expect(bp.recommendation).toBe('revive');
    });

    it('recommends archive for very low potential and community', () => {
      const bp = generator.generate(lowPotentialAnalysis);
      expect(bp.recommendation).toBe('archive');
    });

    it('recommends monitor for active repo (low abandonment)', () => {
      const bp = generator.generate(activeAnalysis);
      expect(bp.recommendation).toBe('monitor');
    });

    it('recommendationReason is a non-empty string', () => {
      const bp = generator.generate(makeAnalysis());
      expect(typeof bp.recommendationReason).toBe('string');
      expect(bp.recommendationReason.length).toBeGreaterThan(10);
    });

    it('recommendationReason mentions the recommendation type', () => {
      const bp = generator.generate(highPotentialAnalysis);
      expect(bp.recommendationReason.toLowerCase()).toContain('reviv');
    });
  });

  // ─── Overall score ────────────────────────────────────────────────────────

  describe('overallScore', () => {
    it('is between 0 and 100', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.overallScore).toBeGreaterThanOrEqual(0);
      expect(bp.overallScore).toBeLessThanOrEqual(100);
    });

    it('high-potential repo scores higher than low-potential', () => {
      const high = generator.generate(highPotentialAnalysis);
      const low = generator.generate(lowPotentialAnalysis);
      expect(high.overallScore).toBeGreaterThan(low.overallScore);
    });

    it('is an integer', () => {
      const bp = generator.generate(makeAnalysis());
      expect(Number.isInteger(bp.overallScore)).toBe(true);
    });
  });

  // ─── Confidence ───────────────────────────────────────────────────────────

  describe('confidence', () => {
    it('returns high confidence with mlEnhanced option', () => {
      const bp = generator.generate(makeAnalysis(), undefined, undefined, { mlEnhanced: true });
      expect(bp.confidence).toBe('high');
    });

    it('returns high confidence when scores are extreme', () => {
      const bp = generator.generate(lowPotentialAnalysis); // very low revival = decisive
      expect(bp.confidence).toBe('high');
    });

    it('confidence is one of the valid values', () => {
      const bp = generator.generate(makeAnalysis());
      expect(['high', 'medium', 'low']).toContain(bp.confidence);
    });
  });

  // ─── Effort estimate ──────────────────────────────────────────────────────

  describe('effortEstimate', () => {
    it('minDays is less than or equal to maxDays', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.effortEstimate.minDays).toBeLessThanOrEqual(bp.effortEstimate.maxDays);
    });

    it('teamSize is at least 1', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.effortEstimate.teamSize).toBeGreaterThanOrEqual(1);
    });

    it('complexity is a valid value', () => {
      const bp = generator.generate(makeAnalysis());
      expect(['trivial', 'low', 'medium', 'high', 'very-high']).toContain(bp.effortEstimate.complexity);
    });

    it('factors array is non-empty', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.effortEstimate.factors.length).toBeGreaterThan(0);
    });

    it('high complexity analysis has higher max days than low complexity', () => {
      const highComplexity = generator.generate(makeAnalysis({ technicalComplexity: 'high' }));
      const lowComplexity = generator.generate(makeAnalysis({ technicalComplexity: 'low' }));
      expect(highComplexity.effortEstimate.maxDays).toBeGreaterThan(lowComplexity.effortEstimate.maxDays);
    });

    it('critical deps increase effort estimate', () => {
      const withCritical = generator.generate(makeAnalysis(), criticalDepAnalysis);
      const withoutDeps = generator.generate(makeAnalysis());
      expect(withCritical.effortEstimate.maxDays).toBeGreaterThan(withoutDeps.effortEstimate.maxDays);
    });
  });

  // ─── Risk register ────────────────────────────────────────────────────────

  describe('riskRegister', () => {
    it('generates at least one risk for clearly abandoned repo', () => {
      // Use analysis with 800+ days since last commit — triggers the "extended inactivity" risk
      const longAbandoned = makeAnalysis({ lastCommitAge: 800, abandonmentScore: 85 });
      const bp = generator.generate(longAbandoned);
      expect(bp.riskRegister.length).toBeGreaterThan(0);
    });

    it('each risk has required fields', () => {
      const bp = generator.generate(makeAnalysis({ lastCommitAge: 800, repository: makeAnalysis().repository }));
      bp.riskRegister.forEach(r => {
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('title');
        expect(r).toHaveProperty('description');
        expect(r).toHaveProperty('severity');
        expect(r).toHaveProperty('probability');
        expect(r).toHaveProperty('impact');
        expect(r).toHaveProperty('mitigation');
        expect(r).toHaveProperty('category');
      });
    });

    it('risk ids are unique', () => {
      const bp = generator.generate(highPotentialAnalysis, criticalDepAnalysis);
      const ids = bp.riskRegister.map(r => r.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('critical vulnerability risk appears when deps have critical issues', () => {
      const bp = generator.generate(makeAnalysis(), criticalDepAnalysis);
      const hasCritical = bp.riskRegister.some(r => r.severity === 'critical');
      expect(hasCritical).toBe(true);
    });

    it('no-license risk appears when repo has no license', async () => {
      const { makeRepository } = await import('../../fixtures/github.fixtures');
      const bp = generator.generate(makeAnalysis({
        repository: makeRepository({ license: null }),
      }));
      const hasLicenseRisk = bp.riskRegister.some(r => r.category === 'legal');
      expect(hasLicenseRisk).toBe(true);
    });

    it('respects maxRisks option', () => {
      const bp = generator.generate(highPotentialAnalysis, criticalDepAnalysis, undefined, { maxRisks: 2 });
      expect(bp.riskRegister.length).toBeLessThanOrEqual(2);
    });

    it('risks are sorted — critical/high before medium/low', () => {
      const bp = generator.generate(highPotentialAnalysis, criticalDepAnalysis);
      const severityOrder = ['critical', 'high', 'medium', 'low'];
      for (let i = 1; i < bp.riskRegister.length; i++) {
        const prev = severityOrder.indexOf(bp.riskRegister[i - 1].severity);
        const curr = severityOrder.indexOf(bp.riskRegister[i].severity);
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });
  });

  // ─── Action items ─────────────────────────────────────────────────────────

  describe('actionItems', () => {
    it('generates action items for any repository', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.actionItems.length).toBeGreaterThan(0);
    });

    it('each action item has required fields', () => {
      const bp = generator.generate(makeAnalysis());
      bp.actionItems.forEach(a => {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('title');
        expect(a).toHaveProperty('description');
        expect(a).toHaveProperty('priority');
        expect(a).toHaveProperty('phase');
        expect(a).toHaveProperty('effort');
        expect(a).toHaveProperty('category');
        expect(a).toHaveProperty('done', false);
      });
    });

    it('action item ids are unique', () => {
      const bp = generator.generate(makeAnalysis(), makeDependencyAnalysis());
      const ids = bp.actionItems.map(a => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('priority is between 1 and 5', () => {
      const bp = generator.generate(makeAnalysis());
      bp.actionItems.forEach(a => {
        expect(a.priority).toBeGreaterThanOrEqual(1);
        expect(a.priority).toBeLessThanOrEqual(5);
      });
    });

    it('respects maxActionItems option', () => {
      const bp = generator.generate(makeAnalysis(), makeDependencyAnalysis(), undefined, {
        maxActionItems: 3,
      });
      expect(bp.actionItems.length).toBeLessThanOrEqual(3);
    });

    it('security action appears when critical vulnerabilities present', () => {
      const bp = generator.generate(makeAnalysis(), criticalDepAnalysis);
      const hasSecurityAction = bp.actionItems.some(a => a.category === 'security');
      expect(hasSecurityAction).toBe(true);
    });
  });

  // ─── Dependency upgrades ──────────────────────────────────────────────────

  describe('dependencyUpgrades', () => {
    it('returns empty array when no dependency analysis provided', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.dependencyUpgrades).toEqual([]);
    });

    it('returns upgrades for outdated/vulnerable dependencies', () => {
      const bp = generator.generate(makeAnalysis(), makeDependencyAnalysis());
      expect(bp.dependencyUpgrades.length).toBeGreaterThan(0);
    });

    it('each upgrade has required fields', () => {
      const bp = generator.generate(makeAnalysis(), makeDependencyAnalysis());
      bp.dependencyUpgrades.forEach(u => {
        expect(u).toHaveProperty('name');
        expect(u).toHaveProperty('currentVersion');
        expect(u).toHaveProperty('targetVersion');
        expect(u).toHaveProperty('reason');
        expect(u).toHaveProperty('priority');
      });
    });

    it('security reason assigned for packages with vulnerabilities', () => {
      const bp = generator.generate(makeAnalysis(), criticalDepAnalysis);
      const securityUpgrades = bp.dependencyUpgrades.filter(u => u.reason === 'security');
      expect(securityUpgrades.length).toBeGreaterThan(0);
    });
  });

  // ─── Narrative fields ─────────────────────────────────────────────────────

  describe('narrative fields', () => {
    it('executiveSummary contains repository name', () => {
      const analysis = makeAnalysis();
      const bp = generator.generate(analysis);
      expect(bp.executiveSummary).toContain(analysis.repository.full_name);
    });

    it('technicalAssessment mentions complexity', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.technicalAssessment.toLowerCase()).toContain('complex');
    });

    it('revivalStrategy mentions the recommendation', () => {
      const bp = generator.generate(highPotentialAnalysis);
      expect(bp.revivalStrategy.toLowerCase()).toContain('revive');
    });

    it('all narrative fields are non-empty strings', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.executiveSummary.length).toBeGreaterThan(20);
      expect(bp.technicalAssessment.length).toBeGreaterThan(20);
      expect(bp.communityAssessment.length).toBeGreaterThan(20);
      expect(bp.revivalStrategy.length).toBeGreaterThan(20);
    });
  });

  // ─── Tags ─────────────────────────────────────────────────────────────────

  describe('tags', () => {
    it('returns an array', () => {
      const bp = generator.generate(makeAnalysis());
      expect(Array.isArray(bp.tags)).toBe(true);
    });

    it('includes language tag when language is set', () => {
      const bp = generator.generate(makeAnalysis());
      expect(bp.tags).toContain('typescript'); // makeRepository defaults to TypeScript
    });

    it('includes abandoned tag for high abandonment score', () => {
      const bp = generator.generate(makeAnalysis({ abandonmentScore: 80 }));
      expect(bp.tags).toContain('abandoned');
    });
  });
});
