import { EmbeddingResult, AIProviderConfig, GitHubRepository } from '../types';

/**
 * EmbeddingService
 *
 * Provider abstraction for generating text embeddings.
 * Supports Groq's embedding endpoint and falls back to a TF-IDF-inspired
 * deterministic bag-of-words representation when no provider is configured.
 *
 * The in-memory cache prevents re-embedding the same text within a session.
 */
export class EmbeddingService {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly cache = new Map<string, EmbeddingResult>();

  constructor(config: AIProviderConfig = {}) {
    this.apiKey = config.groqApiKey ?? process.env.GROQ_API_KEY;
    // Groq currently supports nomic-embed-text-v1_5 for embeddings
    this.model = config.embeddingModel ?? 'nomic-embed-text-v1_5';
  }

  get isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Generate an embedding for the given text.
   * Returns a cached result when the same text has already been embedded.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const key = text.trim().slice(0, 200);

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    let result: EmbeddingResult;

    if (this.isAvailable) {
      try {
        result = await this.embedWithGroq(text);
      } catch (err) {
        console.warn('[EmbeddingService] Groq embedding failed, using fallback:', err instanceof Error ? err.message : err);
        result = this.deterministicEmbed(text);
      }
    } else {
      result = this.deterministicEmbed(text);
    }

    this.cache.set(key, result);
    return result;
  }

  /**
   * Embed a repository's searchable metadata into a single vector.
   */
  async embedRepository(repo: GitHubRepository): Promise<EmbeddingResult> {
    const text = this.repositoryToText(repo);
    return this.embed(text);
  }

  /**
   * Cosine similarity between two equal-length vectors (0–1).
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
  }

  /** Clear the in-memory cache (useful between searches). */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Groq embedding ────────────────────────────────────────────────────────

  private async embedWithGroq(text: string): Promise<EmbeddingResult> {
    const { Groq } = await import('groq-sdk');
    const client = new Groq({ apiKey: this.apiKey });

    const response = await client.embeddings.create({
      model: this.model,
      input: text.slice(0, 2048), // model context limit
    });

    const rawVector = response.data[0]?.embedding;
    if (!rawVector || rawVector.length === 0) {
      throw new Error('Empty embedding returned from Groq');
    }
    // Groq SDK types embedding as number[] | string — cast array elements to number[]
    const embeddingArray: number[] = Array.isArray(rawVector)
      ? (rawVector as Array<number | string>).map(v => typeof v === 'number' ? v : parseFloat(v as string))
      : JSON.parse(rawVector as string) as number[];
    const vector = embeddingArray;

    return {
      vector,
      model: this.model,
      dimensions: vector.length,
      inputText: text,
    };
  }

  // ─── Deterministic fallback ─────────────────────────────────────────────────

  /**
   * Bag-of-words embedding using a fixed 256-dimension vocabulary.
   * Deterministic — same input always produces the same vector.
   * Suitable for approximate semantic matching when no AI provider is available.
   */
  private deterministicEmbed(text: string): EmbeddingResult {
    const DIMS = 256;
    const vector = new Array<number>(DIMS).fill(0);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

    for (const word of words) {
      // Hash the word into a bucket using a simple polynomial hash
      let h = 5381;
      for (let i = 0; i < word.length; i++) {
        h = ((h << 5) + h + word.charCodeAt(i)) & 0x7fffffff;
      }
      const bucket = h % DIMS;
      vector[bucket] += 1;
    }

    // L2-normalise
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    const normalised = norm === 0 ? vector : vector.map(v => v / norm);

    return {
      vector: normalised,
      model: 'deterministic-bow-256',
      dimensions: DIMS,
      inputText: text,
    };
  }

  // ─── Repository text representation ────────────────────────────────────────

  repositoryToText(repo: GitHubRepository): string {
    const parts: string[] = [];
    if (repo.full_name) parts.push(repo.full_name.replace('/', ' '));
    if (repo.description) parts.push(repo.description);
    if (repo.language) parts.push(repo.language);
    if (repo.topics?.length) parts.push(repo.topics.join(' '));
    return parts.join(' ').trim();
  }
}
