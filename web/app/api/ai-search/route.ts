import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

function getRequire() {
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  return createRequire(path.join(distDir, '__placeholder__.js'));
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token') ?? '';
    const groqApiKey = req.headers.get('x-groq-api-key') ?? process.env.GROQ_API_KEY ?? '';

    const body = await req.json();
    const { query, maxResults = 12, analyzeAll = false } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const req2 = getRequire();

    // Load services from dist
    const { GitHubService } = req2('./services/github') as any;
    const { RepositoryAnalyzer } = req2('./services/analyzer') as any;
    const { SemanticDiscoveryService } = req2('./services/semantic-discovery') as any;

    // Build auth
    const auth = token
      ? token.startsWith('gho_') || token.length > 100
        ? { oauthToken: token, tokenType: 'oauth' }
        : { token, tokenType: 'pat' }
      : {};

    const github = new GitHubService(auth);
    const analyzer = new RepositoryAnalyzer(github);

    const discovery = new SemanticDiscoveryService(github, analyzer, {
      aiConfig: groqApiKey ? { groqApiKey } : {},
      maxCandidates: 30,
      maxResults: Math.min(Number(maxResults) || 12, 24),
      analyzeAll: Boolean(analyzeAll),
    });

    const result = await discovery.search(query.trim());

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[/api/ai-search]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'AI search failed' }, { status: 500 });
  }
}
