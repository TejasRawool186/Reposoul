import { z } from 'zod';
import { SearchIntent, AIProviderConfig } from '../types';

/** Zod schema for validating the AI-generated search intent */
const SearchIntentSchema = z.object({
  keywords: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  minimumStars: z.number().int().min(0).nullable().default(null),
  maximumStars: z.number().int().min(0).nullable().default(null),
  abandonmentPreference: z.enum(['any', 'likely_abandoned', 'definitely_abandoned']).default('likely_abandoned'),
  technicalIssues: z
    .array(z.enum(['outdated_dependencies', 'no_tests', 'no_ci', 'security_vulnerabilities', 'no_documentation']))
    .default([]),
  sortPreference: z.enum(['revival_potential', 'stars', 'recent_activity', 'semantic_relevance']).default('revival_potential'),
  pushedBefore: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.8),
});

const SYSTEM_PROMPT = `You are a GitHub repository search query interpreter for REPOSOUL — an open-source resurrection workbench.

Your job is to convert a natural-language description of abandoned repositories into a structured JSON search intent.

Rules:
- Extract programming languages, technical domains, and keywords from the query.
- If the user wants abandoned projects, set abandonmentPreference accordingly.
- minimumStars/maximumStars should only be set if the user explicitly mentions star counts.
- pushedBefore: set to an ISO date string (YYYY-MM-DD) if the user implies the project should have been inactive for a period (e.g. "abandoned 2+ years" → "2023-01-01"). Use null otherwise.
- confidence: how confident you are in the interpretation (0.0–1.0).
- Keep keywords short and relevant for GitHub search.
- Only include languages that exist as GitHub language labels.
- Return ONLY valid JSON matching the schema. No explanations, no markdown.

Schema:
{
  "keywords": string[],
  "languages": string[],
  "domains": string[],
  "minimumStars": number | null,
  "maximumStars": number | null,
  "abandonmentPreference": "any" | "likely_abandoned" | "definitely_abandoned",
  "technicalIssues": Array<"outdated_dependencies" | "no_tests" | "no_ci" | "security_vulnerabilities" | "no_documentation">,
  "sortPreference": "revival_potential" | "stars" | "recent_activity" | "semantic_relevance",
  "pushedBefore": string | null,
  "confidence": number
}`;

/**
 * QueryUnderstandingService
 *
 * Converts natural-language user queries into validated SearchIntent objects
 * using the Groq LLM API. Provides a deterministic fallback when no API key
 * is configured or the AI call fails.
 */
export class QueryUnderstandingService {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(config: AIProviderConfig = {}) {
    this.apiKey = config.groqApiKey ?? process.env.GROQ_API_KEY;
    this.model = config.groqModel ?? 'llama-3.3-70b-versatile';
  }

  /**
   * Whether Groq AI is available (API key configured).
   */
  get isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Interpret a natural-language query into a structured SearchIntent.
   * Falls back to keyword extraction if AI is unavailable or fails.
   */
  async interpret(query: string): Promise<SearchIntent> {
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    const trimmed = query.trim().slice(0, 500); // cap at 500 chars

    if (this.isAvailable) {
      try {
        return await this.interpretWithGroq(trimmed);
      } catch (err) {
        console.warn('[QueryUnderstanding] Groq call failed, using fallback:', err instanceof Error ? err.message : err);
      }
    }

    return this.fallbackInterpret(trimmed);
  }

  // ─── Groq implementation ────────────────────────────────────────────────────

  private async interpretWithGroq(query: string): Promise<SearchIntent> {
    // Dynamic import to avoid loading groq-sdk when not configured
    const { Groq } = await import('groq-sdk');
    const client = new Groq({ apiKey: this.apiKey });

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Query: "${query}"` },
      ],
      temperature: 0.1, // low temperature for consistent structured output
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq');

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error(`Groq returned invalid JSON: ${content.slice(0, 100)}`);
    }

    const parsed = SearchIntentSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn('[QueryUnderstanding] Groq output failed schema validation, using fallback');
      return this.fallbackInterpret(query);
    }

    return {
      originalQuery: query,
      ...parsed.data,
    };
  }

  // ─── Deterministic fallback ─────────────────────────────────────────────────

  /**
   * Fallback when Groq is unavailable — extracts languages and keywords
   * using simple pattern matching. Always works without an API key.
   */
  fallbackInterpret(query: string): SearchIntent {
    const q = query.toLowerCase();

    // Language detection
    const LANGUAGE_MAP: Record<string, string> = {
      typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python',
      rust: 'Rust', go: 'Go', golang: 'Go', java: 'Java', kotlin: 'Kotlin',
      swift: 'Swift', 'c#': 'C#', 'c++': 'C++', cpp: 'C++',
      ruby: 'Ruby', php: 'PHP', dart: 'Dart', elixir: 'Elixir',
      scala: 'Scala', haskell: 'Haskell',
    };
    const languages = Object.entries(LANGUAGE_MAP)
      .filter(([key]) => q.includes(key))
      .map(([, label]) => label)
      .filter((v, i, a) => a.indexOf(v) === i);

    // Star extraction
    const starMatch = q.match(/(\d+)\+?\s*stars?/);
    const minimumStars = starMatch ? parseInt(starMatch[1], 10) : null;

    // Abandonment detection
    const abandonmentPreference: SearchIntent['abandonmentPreference'] =
      q.includes('definitely abandoned') || q.includes('dead') ? 'definitely_abandoned'
        : q.includes('abandoned') || q.includes('inactive') || q.includes('unmaintained') ? 'likely_abandoned'
          : 'any';

    // Technical issues
    const technicalIssues: SearchIntent['technicalIssues'] = [];
    if (q.includes('outdated') || q.includes('old dependencies')) technicalIssues.push('outdated_dependencies');
    if (q.includes('no tests') || q.includes('missing tests')) technicalIssues.push('no_tests');
    if (q.includes('no ci') || q.includes('no pipeline')) technicalIssues.push('no_ci');
    if (q.includes('vulnerabilit') || q.includes('security')) technicalIssues.push('security_vulnerabilities');
    if (q.includes('no docs') || q.includes('missing docs') || q.includes('no documentation')) technicalIssues.push('no_documentation');

    // Keywords — strip stop words, keep content words
    const stopWords = new Set(['find', 'search', 'for', 'with', 'and', 'or', 'the', 'a', 'an',
      'that', 'have', 'has', 'are', 'is', 'in', 'of', 'to', 'at', 'by', 'from', 'as', 'into',
      'abandoned', 'project', 'projects', 'repository', 'repositories', 'repo', 'repos',
      'old', 'want', 'need', 'show', 'me', 'get', 'give', 'list', 'some', 'any']);
    const keywords = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 5);

    // Pushed-before heuristic
    let pushedBefore: string | null = null;
    const yearMatch = q.match(/(\d+)\s*(?:years?|yr)/);
    if (yearMatch) {
      const years = parseInt(yearMatch[1], 10);
      const date = new Date();
      date.setFullYear(date.getFullYear() - years);
      pushedBefore = date.toISOString().split('T')[0];
    }

    return {
      originalQuery: query,
      keywords,
      languages,
      domains: [],
      minimumStars,
      maximumStars: null,
      abandonmentPreference,
      technicalIssues,
      sortPreference: 'revival_potential',
      pushedBefore,
      confidence: 0.6, // lower confidence for fallback
    };
  }
}
