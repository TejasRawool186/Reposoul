import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Resolve the core src directory relative to this file
const srcPath = path.resolve(process.cwd(), '..', 'src');

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token') ?? '';
    const body = await req.json();

    const { GitHubService } = await import(path.join(srcPath, 'services', 'github'));
    const { SearchFilters } = await import(path.join(srcPath, 'types')).catch(() => ({ SearchFilters: null }));

    const auth = token
      ? token.startsWith('gho_') ? { oauthToken: token, tokenType: 'oauth' as const } : { token, tokenType: 'pat' as const }
      : {};

    const github = new GitHubService(auth);

    const filters = {
      language: body.language || undefined,
      minStars: body.minStars ? Number(body.minStars) : undefined,
      maxStars: body.maxStars ? Number(body.maxStars) : undefined,
      pushedBefore: body.pushedBefore || undefined,
    };

    const perPage = Math.min(Number(body.limit) || 12, 30);
    const results = await github.searchRepositories(filters, 1, perPage);

    return NextResponse.json(results);
  } catch (err: any) {
    console.error('[/api/search]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Search failed' }, { status: 500 });
  }
}
