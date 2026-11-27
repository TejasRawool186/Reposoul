import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

const srcPath = path.resolve(process.cwd(), '..', 'src');

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token') ?? '';
    const repo = req.nextUrl.searchParams.get('repo');

    if (!repo || !repo.includes('/')) {
      return NextResponse.json({ error: 'repo parameter must be owner/name' }, { status: 400 });
    }

    const { ReposoulHunter } = await import(path.join(srcPath, 'reposoul'));

    const auth = token
      ? token.startsWith('gho_') ? { oauthToken: token, tokenType: 'oauth' as const } : { token, tokenType: 'pat' as const }
      : {};

    const hunter = new ReposoulHunter(auth);
    const analysis = await hunter.analyzeRepository(repo);

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error('[/api/analyze]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Analysis failed' }, { status: 500 });
  }
}
