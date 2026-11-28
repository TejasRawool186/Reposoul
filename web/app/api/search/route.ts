import { NextRequest, NextResponse } from 'next/server';
import { getGitHubService } from '@/lib/reposoul-server';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token') ?? '';
    const body = await req.json();

    const github = getGitHubService(token);

    const filters = {
      language:     body.language    || undefined,
      minStars:     body.minStars    ? Number(body.minStars)  : undefined,
      maxStars:     body.maxStars    ? Number(body.maxStars)  : undefined,
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
