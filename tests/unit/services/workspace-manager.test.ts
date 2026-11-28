/**
 * Tests for WorkspaceManager
 *
 * simple-git is mocked throughout — no real network calls or file I/O.
 * File system operations are tested against a real temp directory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WorkspaceManager } from '../../../src/services/workspace-manager';
import { makeAnalysis } from '../../fixtures/github.fixtures';
import type { RevivalBlueprint } from '../../../src/types';

// ─── Mock simple-git ──────────────────────────────────────────────────────────

const mockClone = vi.fn();
const mockLog   = vi.fn();
const mockRemote = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    clone: mockClone,
    log:   mockLog,
    remote: mockRemote,
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlueprint(overrides: Partial<RevivalBlueprint> = {}): RevivalBlueprint {
  return {
    version: '1.0',
    repository: 'owner/repo',
    generatedAt: new Date().toISOString(),
    recommendation: 'revive',
    recommendationReason: 'High revival potential and active forks.',
    overallScore: 73,
    confidence: 'medium',
    scores: {
      abandonment: 75,
      revivalPotential: 80,
      communityEngagement: 65,
      dependencyHealth: 60,
      technicalComplexity: 'medium',
    },
    effortEstimate: {
      minDays: 7,
      maxDays: 21,
      teamSize: 2,
      complexity: 'medium',
      factors: ['Outdated dependencies', 'No CI/CD pipeline'],
    },
    riskRegister: [],
    actionItems: [],
    dependencyUpgrades: [],
    executiveSummary: 'This repository has strong revival potential.',
    technicalAssessment: 'Dependencies are outdated.',
    communityAssessment: 'Active fork ecosystem.',
    revivalStrategy: 'Update dependencies, add tests, restore CI.',
    sections: [],
    tags: [],
    ...overrides,
  };
}

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reposoul-ws-test-'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceManager', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = makeTempDir();

    // Default happy-path mock responses
    mockClone.mockResolvedValue(undefined);
    mockLog.mockResolvedValue({ latest: { hash: 'abc123def456' } });
    mockRemote.mockResolvedValue('  HEAD branch: main\n');
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ─── prepareNoClone ─────────────────────────────────────────────────────────

  describe('prepareNoClone', () => {
    it('writes blueprint.md, blueprint.json, WORKSPACE.md, and .reposoul-workspace.json', async () => {
      const manager = new WorkspaceManager();
      const blueprint = makeBlueprint();
      const outDir = path.join(tempDir, 'output');

      const result = await manager.prepareNoClone('owner/repo', blueprint, outDir);

      expect(result.filesWritten).toContain('blueprint.md');
      expect(result.filesWritten).toContain('blueprint.json');
      expect(result.filesWritten).toContain('WORKSPACE.md');
      expect(result.filesWritten).toContain('.reposoul-workspace.json');

      expect(fs.existsSync(path.join(outDir, 'blueprint.md'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'blueprint.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'WORKSPACE.md'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, '.reposoul-workspace.json'))).toBe(true);
    });

    it('creates the output directory if it does not exist', async () => {
      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'new', 'nested', 'dir');
      expect(fs.existsSync(outDir)).toBe(false);

      await manager.prepareNoClone('owner/repo', makeBlueprint(), outDir);
      expect(fs.existsSync(outDir)).toBe(true);
    });

    it('blueprint.json contains valid JSON matching the input blueprint', async () => {
      const manager = new WorkspaceManager();
      const blueprint = makeBlueprint({ overallScore: 99 });
      const outDir = path.join(tempDir, 'output');

      await manager.prepareNoClone('owner/repo', blueprint, outDir);

      const json = JSON.parse(fs.readFileSync(path.join(outDir, 'blueprint.json'), 'utf-8'));
      expect(json.overallScore).toBe(99);
      expect(json.recommendation).toBe('revive');
    });

    it('WORKSPACE.md contains the repository name', async () => {
      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'output');

      await manager.prepareNoClone('facebook/react', makeBlueprint(), outDir);

      const ws = fs.readFileSync(path.join(outDir, 'WORKSPACE.md'), 'utf-8');
      expect(ws).toContain('facebook/react');
    });

    it('metadata file hasClone is false', async () => {
      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'output');

      await manager.prepareNoClone('owner/repo', makeBlueprint(), outDir);

      const meta = JSON.parse(fs.readFileSync(path.join(outDir, '.reposoul-workspace.json'), 'utf-8'));
      expect(meta.hasClone).toBe(false);
      expect(meta.hasBlueprint).toBe(true);
    });

    it('cloned is null', async () => {
      const manager = new WorkspaceManager();
      const result = await manager.prepareNoClone('owner/repo', makeBlueprint(), tempDir);
      expect(result.cloned).toBeNull();
    });

    it('records durationMs', async () => {
      const manager = new WorkspaceManager();
      const result = await manager.prepareNoClone('owner/repo', makeBlueprint(), tempDir);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── prepare (with clone) ───────────────────────────────────────────────────

  describe('prepare', () => {
    it('calls simple-git clone with the correct URL', async () => {
      // Create fake repo dir so post-clone steps succeed
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });

      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'ws');

      await manager.prepare('facebook/react', makeBlueprint(), outDir);

      expect(mockClone).toHaveBeenCalledWith(
        'https://github.com/facebook/react.git',
        expect.any(String),
        expect.any(Array),
      );
    });

    it('passes --depth=1 for shallow clone by default', async () => {
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });

      const manager = new WorkspaceManager({ cloneDepth: 1 });
      await manager.prepare('owner/repo', makeBlueprint(), path.join(tempDir, 'ws'));

      const cloneArgs = mockClone.mock.calls[0][2] as string[];
      expect(cloneArgs.some((a: string) => a.startsWith('--depth='))).toBe(true);
    });

    it('omits --depth flag when cloneDepth is 0 (full history)', async () => {
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });

      const manager = new WorkspaceManager({ cloneDepth: 0 });
      await manager.prepare('owner/repo', makeBlueprint(), path.join(tempDir, 'ws'));

      const cloneArgs = mockClone.mock.calls[0][2] as string[];
      expect(cloneArgs.some((a: string) => a.startsWith('--depth='))).toBe(false);
    });

    it('writes all blueprint files even when clone succeeds', async () => {
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });

      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'ws');
      const result = await manager.prepare('owner/repo', makeBlueprint(), outDir);

      expect(result.filesWritten).toContain('blueprint.md');
      expect(result.filesWritten).toContain('blueprint.json');
      expect(result.filesWritten).toContain('WORKSPACE.md');
    });

    it('returns success=false clone result when git clone throws', async () => {
      mockClone.mockRejectedValueOnce(new Error('Repository not found'));

      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'ws');
      const result = await manager.prepare('owner/repo', makeBlueprint(), outDir);

      expect(result.cloned?.success).toBe(false);
      expect(result.cloned?.error).toContain('Repository not found');
    });

    it('still writes blueprint files even when clone fails', async () => {
      mockClone.mockRejectedValueOnce(new Error('Network unreachable'));

      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'ws');
      const result = await manager.prepare('owner/repo', makeBlueprint(), outDir);

      expect(result.filesWritten).toContain('blueprint.md');
      expect(fs.existsSync(path.join(outDir, 'blueprint.md'))).toBe(true);
    });

    it('records headCommit from git log', async () => {
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });
      mockLog.mockResolvedValueOnce({ latest: { hash: 'deadbeef1234' } });

      const manager = new WorkspaceManager();
      const result = await manager.prepare('owner/repo', makeBlueprint(), path.join(tempDir, 'ws'));

      expect(result.cloned?.headCommit).toBe('deadbeef1234');
    });

    it('records defaultBranch from git remote', async () => {
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });
      mockRemote.mockResolvedValueOnce('  HEAD branch: develop\n');

      const manager = new WorkspaceManager();
      const result = await manager.prepare('owner/repo', makeBlueprint(), path.join(tempDir, 'ws'));

      expect(result.cloned?.defaultBranch).toBe('develop');
    });
  });

  // ─── cloneOnly ──────────────────────────────────────────────────────────────

  describe('cloneOnly', () => {
    it('returns success=true when clone succeeds', async () => {
      mockClone.mockImplementation(async (_url: string, dir: string) => {
        fs.mkdirSync(dir, { recursive: true });
      });

      const manager = new WorkspaceManager();
      const result = await manager.cloneOnly('owner/repo', tempDir);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns success=false when clone fails', async () => {
      mockClone.mockRejectedValueOnce(new Error('auth failed'));

      const manager = new WorkspaceManager();
      const result = await manager.cloneOnly('owner/repo', tempDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('auth failed');
    });
  });

  // ─── readInfo ───────────────────────────────────────────────────────────────

  describe('readInfo', () => {
    it('returns null for a directory with no metadata file', () => {
      const manager = new WorkspaceManager();
      expect(manager.readInfo(tempDir)).toBeNull();
    });

    it('reads back the metadata written by prepareNoClone', async () => {
      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'ws');
      await manager.prepareNoClone('owner/repo', makeBlueprint(), outDir);

      const info = manager.readInfo(outDir);
      expect(info).not.toBeNull();
      expect(info!.repository).toBe('owner/repo');
      expect(info!.hasBlueprint).toBe(true);
      expect(info!.hasClone).toBe(false);
    });

    it('returns null when metadata file is corrupted JSON', () => {
      const manager = new WorkspaceManager();
      const metaPath = path.join(tempDir, '.reposoul-workspace.json');
      fs.writeFileSync(metaPath, 'not json {{{{ broken', 'utf-8');
      expect(manager.readInfo(tempDir)).toBeNull();
    });
  });

  // ─── validateRepository ──────────────────────────────────────────────────────

  describe('input validation', () => {
    it('accepts valid owner/repo format', async () => {
      const manager = new WorkspaceManager();
      await expect(
        manager.prepareNoClone('facebook/react', makeBlueprint(), tempDir),
      ).resolves.toBeDefined();
    });

    it('accepts repos with hyphens and dots', async () => {
      const manager = new WorkspaceManager();
      const outDir = path.join(tempDir, 'out');
      await expect(
        manager.prepareNoClone('my-org/my-repo.js', makeBlueprint(), outDir),
      ).resolves.toBeDefined();
    });

    it('rejects repo with path traversal attempt', async () => {
      const manager = new WorkspaceManager();
      await expect(
        manager.prepareNoClone('../../../etc/passwd', makeBlueprint(), tempDir),
      ).rejects.toThrow(/Invalid repository format/);
    });

    it('rejects repo with spaces', async () => {
      const manager = new WorkspaceManager();
      await expect(
        manager.prepareNoClone('owner/my repo', makeBlueprint(), tempDir),
      ).rejects.toThrow(/Invalid repository format/);
    });

    it('rejects repo without slash separator', async () => {
      const manager = new WorkspaceManager();
      await expect(
        manager.prepareNoClone('noslash', makeBlueprint(), tempDir),
      ).rejects.toThrow(/Invalid repository format/);
    });

    it('rejects empty string', async () => {
      const manager = new WorkspaceManager();
      await expect(
        manager.prepareNoClone('', makeBlueprint(), tempDir),
      ).rejects.toThrow(/Invalid repository format/);
    });
  });

  // ─── progress callback ───────────────────────────────────────────────────────

  describe('progress callback', () => {
    it('calls onProgress at least once during prepareNoClone', async () => {
      const messages: string[] = [];
      const manager = new WorkspaceManager({
        onProgress: (msg) => messages.push(msg),
      });

      await manager.prepareNoClone('owner/repo', makeBlueprint(), tempDir);
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});
