# Phase 1 — AI-Powered Semantic Discovery

**Completed:** November 2026  
**Status:** Complete  
**Tests added:** 75 (261 total, up from 186)

---

## Overview

Phase 1 replaces keyword-only GitHub search with a full semantic discovery pipeline. Users
can now describe what they want to find in natural language and receive ranked results based
on semantic relevance, abandonment depth, and revival potential.

---

## New Services

### `src/services/query-understanding.ts` — `QueryUnderstandingService`

Interprets a natural-language query into a structured `SearchIntent`.

- **Groq path**: sends a structured prompt to `llama-3.3-70b-versatile`, parses and validates
  the response with Zod.
- **Deterministic fallback**: regex-based parser for language detection, star counts, year
  mentions, abandonment keywords, and technical issue terms. Always available, no API key
  required.
- **Output**: `SearchIntent` — keywords, languages, domains, minimumStars, maximumStars,
  abandonmentPreference, technicalIssues, sortPreference, pushedBefore, confidence.

### `src/services/embedding-service.ts` — `EmbeddingService`

Generates text embeddings for semantic similarity scoring.

- **Groq path**: calls `nomic-embed-text-v1_5` via Groq's embeddings API.
- **Deterministic fallback**: 256-dim bag-of-words embedding using a polynomial hash function.
  L2-normalised. Deterministic — same input always produces the same vector.
- **Cache**: in-memory cache keyed by input text. `clearCache()` for testing.
- **`embedRepository(repo)`**: concatenates `full_name`, description, language, and topics
  into a single text representation for embedding.
- **`cosineSimilarity(a, b)`**: public method for scoring.

### `src/services/repository-ranker.ts` — `RepositoryRanker`

Hybrid scoring model combining four components:

| Component | Default Weight | Source |
|---|---|---|
| Semantic similarity | 35% | Cosine similarity of query vs repo embedding |
| Abandonment score | 30% | REPOSOUL `RepositoryAnalysis.abandonmentScore` |
| Revival potential | 25% | REPOSOUL `RepositoryAnalysis.revivalPotential` |
| Technical opportunity | 10% | Dependency/security debt from `dependencyAnalysis` |

Weights are configurable via `RankingWeights`. Constructor validates weights sum to 1.0.

Each ranked result includes:
- `hybridScore` (0–100)
- `semanticScore` (0–1)
- `rank` (1-indexed)
- `matchReason` (human-readable explanation)
- `technicalProblems` (list of detected issues)

### `src/services/semantic-discovery.ts` — `SemanticDiscoveryService`

Full discovery pipeline orchestrator:

1. `QueryUnderstandingService.interpret(query)` → `SearchIntent`
2. Build `SearchFilters` from intent (language, stars, `pushed_before` date)
3. Dual GitHub search: primary (with language) + secondary (keyword-only, broader)
4. Embed query + all candidates (parallel, failures are non-fatal)
5. Light or full REPOSOUL analysis of candidates
6. `RepositoryRanker.rank()` → sorted `RankedRepository[]`
7. Return `SemanticSearchResult` with metadata

**Light analysis** (default): derives `abandonmentScore`, `revivalPotential`,
`communityEngagement`, and `technicalComplexity` from GitHub metadata alone — no extra API
calls, O(1) per candidate.

**Full analysis** (opt-in, `analyzeAll: true`): runs the complete REPOSOUL analysis pipeline
for each candidate. Only activated when `candidates.length <= 15` to avoid rate-limiting.

---

## New Types (`src/types/index.ts`)

| Type | Description |
|---|---|
| `SearchIntent` | Structured interpretation of a natural-language query |
| `RankedRepository` | Repository + analysis + scores + match explanation |
| `SemanticSearchResult` | Full search response with intent, results, metadata |
| `EmbeddingResult` | Vector + model name + dimensions + source text |
| `AIProviderConfig` | `groqApiKey` for passing credentials to AI services |

---

## New API Route

### `POST /api/ai-search` (web dashboard)

Request body:
```json
{
  "query": "abandoned Python ML libraries with 500+ stars",
  "maxResults": 12,
  "analyzeAll": false
}
```

Headers:
- `x-github-token`: GitHub PAT (optional, increases rate limits)
- `x-groq-api-key`: Groq API key (optional, activates AI features)

Response: `SemanticSearchResult` JSON.

---

## New Dashboard Page

### `/discover`

- Large natural-language textarea with keyboard shortcuts (Enter to search, Shift+Enter for newline)
- Six curated search suggestions
- Recent searches persisted to `localStorage` (last 5)
- AI provider status indicator (Groq active / fallback mode)
- Query intent summary (detected language, keywords, abandonment preference, min stars)
- Results grid using existing `RepoCard` component, extended with:
  - `matchReason` sentence per result
  - `technicalProblems` badges
  - `hybridScore`, `semanticScore`, and `rank`

---

## Tests Added

| File | Tests | Coverage area |
|---|---|---|
| `tests/unit/services/query-understanding.test.ts` | 30 | Fallback interpreter (language, stars, keywords, abandonment, years, stop words), Groq path (success, bad JSON, empty, rejection, Zod failure) |
| `tests/unit/services/embedding-service.test.ts` | 36 | Fallback determinism, normalisation, cache, Groq success/failure/string-cast, `embedRepository`, `cosineSimilarity` |
| `tests/unit/services/repository-ranker.test.ts` | 29 | Constructor validation, ranking order, score range, semantic influence, analysis influence, technical opportunity, `matchReason`, `technicalProblems` |

**Total tests: 261 (was 186 before Phase 1)**  
All 261 pass. No real network calls in any test.

---

## Coverage Impact

New services are fully covered by unit tests. Overall line coverage increases from ~33% to
above the 30% threshold. Functions and branches also remain above their respective thresholds.

---

## Degradation Behaviour

| Failure | Behaviour |
|---|---|
| No Groq API key | Deterministic fallback for both query understanding and embeddings |
| Groq query call fails | Logs warning, falls back to regex interpreter |
| Groq embedding call fails | Logs warning, falls back to 256-dim BOW |
| Repo embedding fails | Skipped — ranker uses neutral 0.5 semantic score |
| Repo analysis fails | Skipped — ranker uses neutral analysis scores |
| Primary GitHub search fails | Logged, secondary keyword search attempted |
| Secondary search fails | Non-fatal, proceeds with primary results only |

---

## Configuration

No new environment variables are required. The Groq API key is optional:

```env
GROQ_API_KEY=gsk_...   # optional — enables AI query understanding and embeddings
GITHUB_TOKEN=ghp_...   # recommended — prevents GitHub rate limiting
```

For the dashboard, the Groq key can also be passed per-request via `x-groq-api-key` header
(set by `web/lib/api.ts` `aiSearch()` helper).
