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

async function apiFetch<T>(url: string, token: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-github-token': token,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as ApiError).error || `Request failed: ${res.status}`);
  }

  return data as T;
}

export function searchRepositories(params: SearchParams, token: string) {
  return apiFetch('/api/search', token, params);
}

export function analyzeRepository(fullName: string, token: string) {
  return apiFetch(`/api/analyze?repo=${encodeURIComponent(fullName)}`, token);
}

export function generateBlueprint(fullName: string, token: string) {
  return apiFetch(`/api/blueprint?repo=${encodeURIComponent(fullName)}`, token);
}
