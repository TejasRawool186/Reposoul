/**
 * Server-side helper that loads REPOSOUL services from the compiled dist/.
 *
 * Uses Node.js createRequire() which is fully CommonJS-compatible and works
 * with Turbopack's server runtime. Only imported in API routes.
 */

import { createRequire } from 'module';
import path from 'path';

// createRequire from a path inside dist/ so relative requires work correctly
function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

function buildAuth(token: string) {
  if (!token) return {};
  if (token.startsWith('gho_') || token.length > 100) {
    return { oauthToken: token, tokenType: 'oauth' as const };
  }
  return { token, tokenType: 'pat' as const };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGitHubService(token: string): any {
  const req = getRequire();
  const { GitHubService } = req('./services/github') as any;
  return new GitHubService(buildAuth(token));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getReposoulHunter(token: string): any {
  const req = getRequire();
  const { ReposoulHunter } = req('./reposoul') as any;
  return new ReposoulHunter(buildAuth(token));
}
