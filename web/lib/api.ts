/**
 * Client-side API helpers — thin wrappers around the Next.js API routes.
 * The GitHub token is passed as a request header; it is never stored server-side.
 */

export interface SearchParams {
  language?: string;
  minStars?: number;
  maxStars?: number;
  pushedBefore?: string;
  limit?: number;
  category?: string;
}

export interface ApiError {
  error: string;
  status: number;
}

async function apiFetch<T>(url: string, token: string, body?: object, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-github-token': token,
      ...(extraHeaders ?? {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as ApiError).error || `Request failed: ${res.status}`);
  }

  return data as T;
}

/**
 * Parse a repository identifier — accepts:
 *   "owner/repo"
 *   "https://github.com/owner/repo"
 *   "github.com/owner/repo"
 * Returns "owner/repo" or throws if unparseable.
 */
export function parseRepo(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:https?:\/\/)?github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i);
  if (urlMatch) return urlMatch[1];
  if (trimmed.includes('/')) return trimmed;
  throw new Error(`Cannot parse repository: "${trimmed}". Use owner/repo or a GitHub URL.`);
}

export function searchRepositories(params: SearchParams, token: string) {
  return apiFetch('/api/search', token, params);
}

export function analyzeRepository(fullName: string, token: string) {
  const repo = parseRepo(fullName);
  return apiFetch(`/api/analyze?repo=${encodeURIComponent(repo)}`, token);
}

export function generateBlueprint(fullName: string, token: string) {
  const repo = parseRepo(fullName);
  return apiFetch(`/api/blueprint?repo=${encodeURIComponent(repo)}`, token);
}

export interface AiSearchParams {
  query: string;
  maxResults?: number;
  analyzeAll?: boolean;
  groqApiKey?: string;
}

export function aiSearch(params: AiSearchParams, token: string) {
  const headers: Record<string, string> = {};
  if (params.groqApiKey) headers['x-groq-api-key'] = params.groqApiKey;
  return apiFetch('/api/ai-search', token, params, headers);
}
