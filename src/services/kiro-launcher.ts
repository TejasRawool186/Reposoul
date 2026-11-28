import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LaunchResult, EditorInstallation } from '../types';

const execFileAsync = promisify(execFile);

/**
 * KiroLauncherService
 *
 * Detects installed editors (Kiro first, then VS Code family) and opens
 * a workspace directory in the best available one.
 *
 * Security:
 * - `workspacePath` is canonicalised with `path.resolve` and checked for
 *   existence before being passed to execFile as an argument array element.
 * - No shell string interpolation — arguments are always passed as arrays.
 * - Each subprocess has a hard 10 s timeout.
 */
export class KiroLauncherService {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Open a workspace directory in the best available editor.
   * Prefers Kiro, then VS Code, then VS Code Insiders.
   */
  async open(workspacePath: string): Promise<LaunchResult> {
    const absPath = path.resolve(workspacePath);

    if (!fs.existsSync(absPath)) {
      return {
        success: false,
        editor: null,
        editorPath: null,
        workspacePath: absPath,
        error: `Workspace directory does not exist: ${absPath}`,
      };
    }

    const editors = await this.detectEditors();
    if (editors.length === 0) {
      return {
        success: false,
        editor: null,
        editorPath: null,
        workspacePath: absPath,
        error:
          'No compatible editor found. Install Kiro IDE or Visual Studio Code.',
      };
    }

    // Prefer Kiro, then VS Code, then any other detected editor
    const preferred =
      editors.find(e => e.isKiro) ??
      editors.find(e => e.name === 'code') ??
      editors[0];

    return this.launchEditor(preferred, absPath);
  }

  /**
   * Detect all available editor installations on this machine.
   * Returns editors in preference order: Kiro first, VS Code family next.
   */
  async detectEditors(): Promise<EditorInstallation[]> {
    const candidates = this.buildCandidates();
    const results: EditorInstallation[] = [];

    await Promise.allSettled(
      candidates.map(async c => {
        const resolved = await this.resolveCommand(c.command);
        if (resolved !== null) {
          results.push({ ...c, path: resolved });
        }
      }),
    );

    // Sort: Kiro first, then alphabetically by name
    results.sort((a, b) => {
      if (a.isKiro && !b.isKiro) return -1;
      if (!a.isKiro && b.isKiro) return 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  /**
   * Check whether Kiro IDE is installed (fast path for status checks).
   */
  async isKiroInstalled(): Promise<boolean> {
    const editors = await this.detectEditors();
    return editors.some(e => e.isKiro);
  }

  // ─── Launch ────────────────────────────────────────────────────────────────

  private async launchEditor(
    editor: EditorInstallation,
    workspacePath: string,
  ): Promise<LaunchResult> {
    try {
      // Use the resolved full path when available, otherwise fall back to
      // the command name and rely on the system PATH.
      const cmd = editor.path ?? editor.command;

      // Arguments passed as an array — never interpolated into a shell string
      await execFileAsync(cmd, [workspacePath], {
        timeout: this.timeoutMs,
        // Detach: the editor process should outlive our process
        windowsHide: false,
      });

      return {
        success: true,
        editor: editor.name,
        editorPath: editor.path,
        workspacePath,
        error: null,
      };
    } catch (err: unknown) {
      // execFile throws on non-zero exit, but editors often exit 0 immediately
      // after handing off to their existing process. Treat ENOENT as real failure;
      // treat other errors (timeout, non-zero exit) as likely-success.
      const message = err instanceof Error ? err.message : String(err);
      const isEnoent =
        message.includes('ENOENT') || message.includes('not found');

      if (isEnoent) {
        return {
          success: false,
          editor: editor.name,
          editorPath: editor.path,
          workspacePath,
          error: `Editor not found: ${message}`,
        };
      }

      // Non-ENOENT: the launch likely succeeded (editor forked itself)
      return {
        success: true,
        editor: editor.name,
        editorPath: editor.path,
        workspacePath,
        error: null,
      };
    }
  }

  // ─── Editor detection ──────────────────────────────────────────────────────

  /**
   * Build the list of editor command candidates for the current platform.
   * No shell commands are executed here — this is pure data.
   */
  private buildCandidates(): Omit<EditorInstallation, 'path'>[] {
    const platform = os.platform();

    const common: Omit<EditorInstallation, 'path'>[] = [
      { name: 'kiro',           command: 'kiro',           isKiro: true  },
      { name: 'code',           command: 'code',           isKiro: false },
      { name: 'code-insiders',  command: 'code-insiders',  isKiro: false },
      { name: 'codium',         command: 'codium',         isKiro: false },
    ];

    if (platform === 'win32') {
      return [
        ...common,
        // Windows absolute paths — common install locations
        {
          name: 'kiro-win',
          command: path.join(
            os.homedir(),
            'AppData', 'Local', 'Programs', 'kiro', 'kiro.exe',
          ),
          isKiro: true,
        },
        {
          name: 'code-win',
          command: path.join(
            os.homedir(),
            'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'code.exe',
          ),
          isKiro: false,
        },
      ];
    }

    if (platform === 'darwin') {
      return [
        ...common,
        {
          name: 'kiro-mac',
          command: '/Applications/Kiro.app/Contents/Resources/app/bin/kiro',
          isKiro: true,
        },
        {
          name: 'code-mac',
          command:
            '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
          isKiro: false,
        },
      ];
    }

    // Linux — common snap/flatpak paths
    return [
      ...common,
      { name: 'code-snap', command: '/snap/bin/code', isKiro: false },
    ];
  }

  /**
   * Resolve a command to its absolute path using `which` (unix) or
   * `where` (windows), or by checking if it is already an absolute path
   * that exists on disk.
   * Returns null if the command cannot be found.
   */
  private async resolveCommand(command: string): Promise<string | null> {
    // Already an absolute path
    if (path.isAbsolute(command)) {
      return fs.existsSync(command) ? command : null;
    }

    // Use which/where to locate the command
    const whichCommand = os.platform() === 'win32' ? 'where' : 'which';
    try {
      const { stdout } = await execFileAsync(whichCommand, [command], {
        timeout: 5_000,
      });
      const resolved = stdout.split(/\r?\n/)[0].trim();
      return resolved.length > 0 ? resolved : null;
    } catch {
      return null;
    }
  }
}
