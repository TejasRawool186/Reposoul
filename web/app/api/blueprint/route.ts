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
    const blueprint = await hunter.generateBlueprint(repo);

    return NextResponse.json(blueprint);
  } catch (err: any) {
    console.error('[/api/blueprint]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Blueprint generation failed' }, { status: 500 });
  }
}
