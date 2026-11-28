import fs from 'fs';
import path from 'path';
import { simpleGit, SimpleGit, SimpleGitProgressEvent } from 'simple-git';
import {
  WorkspaceCloneResult,
  WorkspaceResult,
  WorkspaceInfo,
  WorkspaceProgressCallback,
  RevivalBlueprint,
} from '../types';
import { BlueprintFormatter } from './blueprint-formatter';

/** Minimal shape returned by both prepare() and prepareNoClone() */
export interface WorkspaceResultLike {
  repository: string;
  workspacePath: string;
  blueprintPath: string;
  blueprintJsonPath: string;
  cloned: WorkspaceCloneResult | null;
  filesWritten: string[];
  durationMs: number;
}

export interface WorkspaceManagerOptions {
  /**
   * Git clone depth. Defaults to 1 (shallow clone) for speed.
   * Pass 0 to clone full history.
   */
  cloneDepth?: number;
  /**
   * Timeout in milliseconds for the git clone operation.
   * Default: 120000 (2 minutes).
   */
  cloneTimeoutMs?: number;
  /**
   * Maximum allowed clone size in bytes. Rejects clones above this.
   * Default: 500 MB.
   */
  maxSizeBytes?: number;
  /** Progress callback for long-running operations */
  onProgress?: WorkspaceProgressCallback;
}

/**
 * WorkspaceManager
 *
 * Prepares a Kiro IDE workspace directory for a repository being revived.
 * Responsibilities:
 * - Create a workspace directory
 * - Shallow-clone the target repository
 * - Write blueprint.md, blueprint.json, WORKSPACE.md
 * - Track workspace metadata
 */
export class WorkspaceManager {
  private readonly cloneDepth: number;
  private readonly cloneTimeoutMs: number;
  private readonly maxSizeBytes: number;
  private readonly onProgress: WorkspaceProgressCallback;

  constructor(options: WorkspaceManagerOptions = {}) {
    this.cloneDepth    = options.cloneDepth    ?? 1;
    this.cloneTimeoutMs = options.cloneTimeoutMs ?? 120_000;
    this.maxSizeBytes  = options.maxSizeBytes  ?? 500 * 1024 * 1024; // 500 MB
    this.onProgress    = options.onProgress    ?? (() => {});
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Prepare a full workspace: clone the repository and write all blueprint files.
   */
  async prepare(
    repository: string,
    blueprint: RevivalBlueprint,
    outputDir: string,
  ): Promise<WorkspaceResult> {
    const start = Date.now();

    // Validate inputs — never pass repository names into shell strings
    const cleanRepo = this.validateRepository(repository);
    const absOutput = path.resolve(outputDir);

    this.ensureDirectory(absOutput);

    // Clone
    this.onProgress('Cloning repository…', cleanRepo);
    const cloneResult = await this.cloneRepository(cleanRepo, absOutput);

    // Write blueprint files
    this.onProgress('Writing blueprint files…');
    const filesWritten: string[] = [];

    const formatter = new BlueprintFormatter();

    const blueprintMdPath = path.join(absOutput, 'blueprint.md');
    fs.writeFileSync(blueprintMdPath, formatter.format(blueprint, 'markdown'), 'utf-8');
    filesWritten.push('blueprint.md');

    const blueprintJsonPath = path.join(absOutput, 'blueprint.json');
    fs.writeFileSync(blueprintJsonPath, JSON.stringify(blueprint, null, 2), 'utf-8');
    filesWritten.push('blueprint.json');

    const workspaceMdPath = path.join(absOutput, 'WORKSPACE.md');
    fs.writeFileSync(workspaceMdPath, this.buildWorkspaceMd(repository, blueprint, cloneResult), 'utf-8');
    filesWritten.push('WORKSPACE.md');

    // Write metadata file for `info` lookups
    const metaPath = path.join(absOutput, '.reposoul-workspace.json');
    const meta: WorkspaceInfo = {
      repository,
      workspacePath: absOutput,
      createdAt: new Date().toISOString(),
      defaultBranch: cloneResult?.defaultBranch ?? null,
      headCommit: cloneResult?.headCommit ?? null,
      hasBlueprint: true,
      hasClone: cloneResult?.success ?? false,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    filesWritten.push('.reposoul-workspace.json');

    return {
      repository,
      workspacePath: absOutput,
      blueprintPath: blueprintMdPath,
      blueprintJsonPath,
      cloned: cloneResult,
      filesWritten,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Prepare workspace without cloning — blueprint files only.
   * Faster and useful when the user just wants the documentation scaffold.
   */
  async prepareNoClone(
    repository: string,
    blueprint: RevivalBlueprint,
    outputDir: string,
  ): Promise<WorkspaceResultLike> {
    const start = Date.now();
    const cleanRepo = this.validateRepository(repository);
    const absOutput = path.resolve(outputDir);
    this.ensureDirectory(absOutput);

    this.onProgress('Writing workspace files…', repository);
    const filesWritten: string[] = [];
    const formatter = new BlueprintFormatter();

    const blueprintMdPath = path.join(absOutput, 'blueprint.md');
    fs.writeFileSync(blueprintMdPath, formatter.format(blueprint, 'markdown'), 'utf-8');
    filesWritten.push('blueprint.md');

    const blueprintJsonPath = path.join(absOutput, 'blueprint.json');
    fs.writeFileSync(blueprintJsonPath, JSON.stringify(blueprint, null, 2), 'utf-8');
    filesWritten.push('blueprint.json');

    const workspaceMdPath = path.join(absOutput, 'WORKSPACE.md');
    fs.writeFileSync(workspaceMdPath, this.buildWorkspaceMd(repository, blueprint, null), 'utf-8');
    filesWritten.push('WORKSPACE.md');

    const metaPath = path.join(absOutput, '.reposoul-workspace.json');
    const meta: WorkspaceInfo = {
      repository: cleanRepo,
      workspacePath: absOutput,
      createdAt: new Date().toISOString(),
      defaultBranch: null,
      headCommit: null,
      hasBlueprint: true,
      hasClone: false,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    filesWritten.push('.reposoul-workspace.json');

    return {
      repository,
      workspacePath: absOutput,
      blueprintPath: blueprintMdPath,
      blueprintJsonPath,
      cloned: null,
      filesWritten,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Clone only — returns clone details without blueprint generation.
   * Used when blueprints are not available yet.
   */
  async cloneOnly(
    repository: string,
    outputDir: string,
  ): Promise<WorkspaceCloneResult> {
    const cleanRepo = this.validateRepository(repository);
    const absOutput = path.resolve(outputDir);
    this.ensureDirectory(absOutput);
    return this.cloneRepository(cleanRepo, absOutput);
  }

  /**
   * Read metadata from an existing workspace.
   */
  readInfo(workspacePath: string): WorkspaceInfo | null {
    const metaPath = path.join(path.resolve(workspacePath), '.reposoul-workspace.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as WorkspaceInfo;
    } catch {
      return null;
    }
  }

  // ─── Git operations ──────────────────────────────────────────────────────────

  /**
   * Shallow-clone a repository into a subdirectory of `outputDir`.
   * Uses argument arrays throughout — never shell interpolation of untrusted input.
   */
  private async cloneRepository(
    repository: string,
    outputDir: string,
  ): Promise<WorkspaceCloneResult> {
    const repoDir = path.join(outputDir, 'repo');
    const cloneUrl = `https://github.com/${repository}.git`;

    // Build git clone options as an array — no shell interpolation
    const cloneOptions: string[] = ['--no-tags'];
    if (this.cloneDepth > 0) {
      cloneOptions.push(`--depth=${this.cloneDepth}`);
    }

    // Set up git instance with timeout
    const git: SimpleGit = simpleGit(outputDir, {
      progress: ({ method, stage, progress }: SimpleGitProgressEvent) => {
        if (method === 'clone') {
          this.onProgress(
            `Cloning (${stage})…`,
            `${progress}%`,
          );
        }
      },
      timeout: { block: this.cloneTimeoutMs },
    });

    try {
      // simpleGit.clone uses argument arrays internally — safe against injection
      await git.clone(cloneUrl, repoDir, cloneOptions);

      // Gather post-clone metadata
      const repoGit = simpleGit(repoDir, {
        timeout: { block: 15_000 },
      });

      let defaultBranch: string | null = null;
      let headCommit: string | null = null;

      try {
        const log = await repoGit.log(['-1']);
        headCommit = log.latest?.hash ?? null;
      } catch { /* non-fatal */ }

      try {
        const remote = await repoGit.remote(['show', 'origin']);
        const match = typeof remote === 'string'
          ? remote.match(/HEAD branch:\s*(\S+)/)
          : null;
        defaultBranch = match?.[1] ?? null;
      } catch { /* non-fatal */ }

      // Measure size
      const sizeBytes = this.measureDirSize(repoDir);

      if (sizeBytes > this.maxSizeBytes) {
        // Remove oversized clone
        fs.rmSync(repoDir, { recursive: true, force: true });
        return {
          success: false,
          path: null,
          sizeBytes,
          totalFiles: null,
          defaultBranch: null,
          headCommit: null,
          error: `Repository is too large (${Math.round(sizeBytes / 1024 / 1024)} MB > ${Math.round(this.maxSizeBytes / 1024 / 1024)} MB limit). Set --no-clone to skip.`,
        };
      }

      const totalFiles = this.countFiles(repoDir);

      return {
        success: true,
        path: repoDir,
        sizeBytes,
        totalFiles,
        defaultBranch,
        headCommit,
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Remove partial clone directory if it exists
      if (fs.existsSync(repoDir)) {
        fs.rmSync(repoDir, { recursive: true, force: true });
      }
      return {
        success: false,
        path: null,
        sizeBytes: null,
        totalFiles: null,
        defaultBranch: null,
        headCommit: null,
        error: `Clone failed: ${message}`,
      };
    }
  }

  // ─── Workspace document ──────────────────────────────────────────────────────

  private buildWorkspaceMd(
    repository: string,
    blueprint: RevivalBlueprint,
    clone: WorkspaceCloneResult | null,
  ): string {
    const sections: string[] = [
      `# Workspace: ${repository}`,
      '',
      `> Generated by REPOSOUL on ${new Date().toUTCString()}`,
      '',
    ];

    if (clone?.success) {
      sections.push(
        `## Repository`,
        '',
        `- **Cloned to:** \`repo/\``,
        `- **Branch:**     \`${clone.defaultBranch ?? 'unknown'}\``,
        `- **Commit:**     \`${clone.headCommit?.slice(0, 12) ?? 'unknown'}\``,
        `- **Files:**      ${clone.totalFiles ?? 'unknown'}`,
        `- **Size:**       ${clone.sizeBytes ? `${Math.round(clone.sizeBytes / 1024 / 1024 * 10) / 10} MB` : 'unknown'}`,
        '',
      );
    } else if (clone && !clone.success) {
      sections.push(
        `## Repository (clone failed)`,
        '',
        `> ${clone.error}`,
        '',
        `Run \`git clone https://github.com/${repository}.git repo\` manually.`,
        '',
      );
    }

    sections.push(
      `## Revival Plan`,
      '',
      `- **Recommendation:** \`${blueprint.recommendation.toUpperCase()}\``,
      `- ${blueprint.recommendationReason}`,
      '',
      `## Scores`,
      '',
      `| Metric | Score |`,
      `|--------|-------|`,
      `| Abandonment | ${blueprint.scores.abandonment}% |`,
      `| Revival potential | ${blueprint.scores.revivalPotential}% |`,
      `| Community engagement | ${blueprint.scores.communityEngagement}% |`,
      `| Overall | ${blueprint.overallScore}/100 |`,
      '',
      `## Effort Estimate`,
      '',
      `- Duration: ${blueprint.effortEstimate.minDays}–${blueprint.effortEstimate.maxDays} working days`,
      `- Team size: ${blueprint.effortEstimate.teamSize} developer${blueprint.effortEstimate.teamSize > 1 ? 's' : ''}`,
      '',
      `## Quick Start`,
      '',
      '1. Review `blueprint.md` for the full revival plan',
      '2. Work through the P1 immediate actions first',
      '3. Run `reposoul validate <repo>` after each milestone',
      '',
      `## Files in this workspace`,
      '',
      '| File | Purpose |',
      '|------|---------|',
      '| `WORKSPACE.md` | This onboarding guide |',
      '| `blueprint.md` | Full Markdown revival blueprint |',
      '| `blueprint.json` | Machine-readable blueprint data |',
      '| `repo/` | Cloned repository source code |',
      '',
    );

    return sections.join('\n');
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  /**
   * Validate repository format — owner/repo, alphanumeric + hyphens + underscores + dots.
   * Returns cleaned string. Throws if format is invalid.
   * This is the only gate before the value is used in a git URL.
   */
  private validateRepository(repository: string): string {
    const clean = repository.trim();
    // owner/repo — both segments: letters, digits, hyphens, underscores, dots
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(clean)) {
      throw new Error(
        `Invalid repository format: "${clean}". Expected owner/repo (e.g. facebook/react).`,
      );
    }
    return clean;
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Recursively measure total bytes of a directory.
   * Skips symlinks and unreadable paths.
   */
  private measureDirSize(dir: string): number {
    let total = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          total += this.measureDirSize(full);
        } else {
          try {
            total += fs.statSync(full).size;
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
    return total;
  }

  /**
   * Count files in a directory recursively (excluding symlinks).
   */
  private countFiles(dir: string): number {
    let count = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          count += this.countFiles(full);
        } else {
          count++;
        }
      }
    } catch { /* skip */ }
    return count;
  }
}
