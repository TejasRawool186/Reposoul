import {
  RepositoryAnalysis,
  DependencyAnalysis,
  ForkComparison,
  RevivalBlueprint,
  RiskItem,
  ActionItem,
  DependencyUpgrade,
  EffortEstimate,
  BlueprintSection,
  BlueprintOptions,
  Severity,
} from '../types';

/**
 * BlueprintGenerator produces a structured RevivalBlueprint from repository analysis data.
 *
 * It is a pure transformation service — no network calls, no file I/O.
 * All inputs come from the existing analysis pipeline.
 */
export class BlueprintGenerator {
  /**
   * Generate a complete revival blueprint from analysis results.
   */
  generate(
    analysis: RepositoryAnalysis,
    dependencyAnalysis?: DependencyAnalysis,
    forkComparison?: ForkComparison,
    options: BlueprintOptions = {}
  ): RevivalBlueprint {
    const { maxActionItems = 20, maxRisks = 10 } = options;

    const recommendation = this.deriveRecommendation(analysis);
    const effortEstimate = this.estimateEffort(analysis, dependencyAnalysis);
    const riskRegister = this.buildRiskRegister(analysis, dependencyAnalysis).slice(0, maxRisks);
    const actionItems = this.buildActionItems(analysis, dependencyAnalysis).slice(0, maxActionItems);
    const dependencyUpgrades = this.buildDependencyUpgrades(dependencyAnalysis);
    const overallScore = this.computeOverallScore(analysis);
    const confidence = this.computeConfidence(analysis, options.mlEnhanced);

    const executiveSummary = this.writeExecutiveSummary(analysis, recommendation, overallScore);
    const technicalAssessment = this.writeTechnicalAssessment(analysis, dependencyAnalysis);
    const communityAssessment = this.writeCommunityAssessment(analysis, forkComparison);
    const revivalStrategy = this.writeRevivalStrategy(analysis, recommendation, effortEstimate);

    const sections = this.assembleSections(
      executiveSummary,
      technicalAssessment,
      communityAssessment,
      revivalStrategy,
      riskRegister,
      actionItems,
      dependencyUpgrades
    );

    return {
      repository: analysis.repository.full_name,
      generatedAt: new Date().toISOString(),
      version: '1.0',
      recommendation,
      recommendationReason: this.recommendationReason(recommendation, analysis),
      overallScore,
      confidence,
      scores: {
        abandonment: analysis.abandonmentScore,
        revivalPotential: analysis.revivalPotential,
        communityEngagement: analysis.communityEngagement,
        dependencyHealth: dependencyAnalysis?.healthScore ?? 100,
        technicalComplexity: analysis.technicalComplexity,
      },
      effortEstimate,
      riskRegister,
      actionItems,
      dependencyUpgrades,
      executiveSummary,
      technicalAssessment,
      communityAssessment,
      revivalStrategy,
      sections,
      tags: this.deriveTags(analysis),
    };
  }

  // ─── Recommendation ───────────────────────────────────────────────────────

  private deriveRecommendation(
    analysis: RepositoryAnalysis
  ): RevivalBlueprint['recommendation'] {
    const { abandonmentScore, revivalPotential, communityEngagement } = analysis;

    if (abandonmentScore < 40) return 'monitor';
    if (revivalPotential >= 60 && abandonmentScore >= 60) return 'revive';
    if (revivalPotential >= 40 && communityEngagement >= 30) return 'fork';
    return 'archive';
  }

  private recommendationReason(
    rec: RevivalBlueprint['recommendation'],
    analysis: RepositoryAnalysis
  ): string {
    switch (rec) {
      case 'revive':
        return `Strong revival candidate: abandonment score ${analysis.abandonmentScore}%, revival potential ${analysis.revivalPotential}%. Active community signals and viable codebase complexity.`;
      case 'fork':
        return `Forking is recommended over direct revival. The project shows community interest (${analysis.communityEngagement}% engagement) but may benefit from a fresh start under active maintainership.`;
      case 'monitor':
        return `Project shows activity signals (abandonment score only ${analysis.abandonmentScore}%). Monitor for further decline before committing revival resources.`;
      case 'archive':
        return `Low revival potential (${analysis.revivalPotential}%) combined with low community engagement (${analysis.communityEngagement}%). Archiving is the recommended course of action.`;
    }
  }

  // ─── Effort estimation ────────────────────────────────────────────────────

  private estimateEffort(
    analysis: RepositoryAnalysis,
    deps?: DependencyAnalysis
  ): EffortEstimate {
    const factors: string[] = [];
    let baseMin = 5;
    let baseMax = 15;

    // Complexity multiplier
    switch (analysis.technicalComplexity) {
      case 'low':
        baseMin *= 1; baseMax *= 1;
        factors.push('Low codebase complexity');
        break;
      case 'medium':
        baseMin *= 1.5; baseMax *= 2;
        factors.push('Medium codebase complexity');
        break;
      case 'high':
        baseMin *= 2.5; baseMax *= 4;
        factors.push('High codebase complexity');
        break;
    }

    // Dependency health
    if (deps) {
      if (deps.criticalVulnerabilities > 0) {
        baseMin += 3; baseMax += 10;
        factors.push(`${deps.criticalVulnerabilities} critical vulnerabilities to address`);
      }
      if (deps.outdatedDependencies > 10) {
        baseMin += 2; baseMax += 5;
        factors.push(`${deps.outdatedDependencies} outdated dependencies`);
      }
    }

    // Test coverage (inferred from health signals)
    if (analysis.abandonmentScore > 70) {
      baseMin += 3; baseMax += 7;
      factors.push('Likely degraded test suite requires restoration');
    }

    // Last commit age
    const ageFactor = Math.floor(analysis.lastCommitAge / 365);
    if (ageFactor >= 2) {
      baseMin += ageFactor * 2; baseMax += ageFactor * 3;
      factors.push(`${ageFactor}+ years of accumulated drift`);
    }

    const minDays = Math.round(baseMin);
    const maxDays = Math.round(baseMax);

    const complexity: EffortEstimate['complexity'] =
      maxDays <= 5 ? 'trivial' :
      maxDays <= 15 ? 'low' :
      maxDays <= 30 ? 'medium' :
      maxDays <= 60 ? 'high' : 'very-high';

    const teamSize = maxDays <= 15 ? 1 : maxDays <= 45 ? 2 : 3;

    return { minDays, maxDays, teamSize, complexity, factors };
  }

  // ─── Risk register ────────────────────────────────────────────────────────

  private buildRiskRegister(
    analysis: RepositoryAnalysis,
    deps?: DependencyAnalysis
  ): RiskItem[] {
    const risks: RiskItem[] = [];
    let id = 1;

    // Stale dependency risks
    if (deps && deps.criticalVulnerabilities > 0) {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'Critical security vulnerabilities in dependencies',
        description: `${deps.criticalVulnerabilities} critical vulnerabilities detected across ${deps.vulnerableDependencies} packages.`,
        severity: 'critical',
        probability: 'high',
        impact: 'Security breach, data exposure, or supply-chain attack if deployed.',
        mitigation: 'Run dependency audit immediately. Upgrade or replace affected packages before any deployment.',
        category: 'dependency',
      });
    }

    if (deps && deps.outdatedDependencies > 20) {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'Severely outdated dependency tree',
        description: `${deps.outdatedDependencies} of ${deps.totalDependencies} dependencies are outdated.`,
        severity: 'high',
        probability: 'high',
        impact: 'Build failures, incompatibility with modern tooling, missing security patches.',
        mitigation: 'Prioritize updating dependencies in batches, starting with direct dependencies and those with known vulnerabilities.',
        category: 'dependency',
      });
    }

    // No recent activity
    if (analysis.lastCommitAge > 730) {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'Extended period of inactivity',
        description: `Last commit was ${Math.round(analysis.lastCommitAge / 365 * 10) / 10} years ago.`,
        severity: 'high',
        probability: 'high',
        impact: 'Undocumented breaking changes in the ecosystem, missing critical patches.',
        mitigation: 'Conduct a full compatibility audit against current Node.js, TypeScript, and dependency major versions before resuming development.',
        category: 'technical',
      });
    }

    // No issue response
    if (analysis.issueResponseTime < 0 || analysis.issueResponseTime > 60) {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'Poor historical issue response',
        description: analysis.issueResponseTime < 0
          ? 'No closed issues found — unclear issue handling history.'
          : `Average issue response time was ${Math.round(analysis.issueResponseTime)} days.`,
        severity: 'medium',
        probability: 'medium',
        impact: 'Community trust deficit. Revived project may struggle to attract contributors.',
        mitigation: 'Establish a clear issue triage process and SLA in CONTRIBUTING.md from day one.',
        category: 'community',
      });
    }

    // Low stars / unknown market
    if (analysis.marketRelevance < 30) {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'Low market relevance score',
        description: `Market relevance scored ${analysis.marketRelevance}/100, indicating limited current ecosystem demand.`,
        severity: 'medium',
        probability: 'medium',
        impact: 'Revival effort may not attract sufficient users or contributors to sustain the project.',
        mitigation: 'Validate demand before investing heavily. Consider a narrowed scope or integration with active projects.',
        category: 'operational',
      });
    }

    // High complexity
    if (analysis.technicalComplexity === 'high') {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'High technical complexity',
        description: 'The codebase size and structure indicate significant technical complexity.',
        severity: 'medium',
        probability: 'high',
        impact: 'Longer onboarding time for contributors, higher defect risk during modernisation.',
        mitigation: 'Start with comprehensive documentation, then incrementally modernise module by module with tests covering each change.',
        category: 'technical',
      });
    }

    // No license
    if (!analysis.repository.license) {
      risks.push({
        id: `R${String(id++).padStart(3, '0')}`,
        title: 'No license file detected',
        description: 'The repository has no licence, making legal use and redistribution ambiguous.',
        severity: 'high',
        probability: 'high',
        impact: 'Cannot legally fork or redistribute without explicit permission.',
        mitigation: 'Contact original authors or add a permissive licence (MIT, Apache-2.0) with appropriate attribution.',
        category: 'legal',
      });
    }

    return risks.sort((a, b) => {
      const order: Severity[] = ['critical', 'high', 'medium', 'low'];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    });
  }

  // ─── Action items ─────────────────────────────────────────────────────────

  private buildActionItems(
    analysis: RepositoryAnalysis,
    deps?: DependencyAnalysis
  ): ActionItem[] {
    const items: ActionItem[] = [];
    let id = 1;

    const item = (
      title: string,
      description: string,
      priority: ActionItem['priority'],
      phase: ActionItem['phase'],
      effort: ActionItem['effort'],
      category: ActionItem['category']
    ): ActionItem => ({
      id: `A${String(id++).padStart(3, '0')}`,
      title,
      description,
      priority,
      phase,
      effort,
      category,
      done: false,
    });

    // Immediate priorities
    if (deps && deps.criticalVulnerabilities > 0) {
      items.push(item(
        'Fix critical security vulnerabilities',
        `Upgrade or replace ${deps.vulnerableDependencies} packages with known vulnerabilities. Run 'npm audit fix' and review breaking changes.`,
        1, 'immediate', 'days', 'security'
      ));
    }

    items.push(item(
      'Set up CI/CD pipeline',
      'Create GitHub Actions workflows for automated testing, linting, and dependency auditing on every pull request.',
      1, 'immediate', 'hours', 'ci-cd'
    ));

    items.push(item(
      'Write a comprehensive test suite',
      'Establish unit and integration tests for core functionality. Target >60% line coverage as a minimum.',
      1, 'immediate', 'days', 'testing'
    ));

    // Short-term
    if (deps && deps.outdatedDependencies > 0) {
      items.push(item(
        `Update ${deps.outdatedDependencies} outdated dependencies`,
        'Incrementally upgrade outdated packages, testing after each batch. Prioritise packages with security advisories.',
        2, 'short-term', 'days', 'dependency'
      ));
    }

    items.push(item(
      'Update README and documentation',
      'Rewrite README with current installation instructions, API reference, and usage examples. Remove obsolete content.',
      2, 'short-term', 'hours', 'documentation'
    ));

    items.push(item(
      'Audit and update CONTRIBUTING.md',
      'Define contribution workflow, code style requirements, commit message conventions, and issue triage process.',
      2, 'short-term', 'hours', 'documentation'
    ));

    // Medium-term
    if (analysis.technicalComplexity !== 'low') {
      items.push(item(
        'Refactor high-complexity modules',
        'Identify and incrementally refactor modules with high cyclomatic complexity. Add tests before each refactor.',
        3, 'medium-term', 'weeks', 'refactor'
      ));
    }

    items.push(item(
      'Engage with open issue backlog',
      `Triage all ${analysis.repository.open_issues_count} open issues. Close duplicates, add labels, and prioritise bugs.`,
      3, 'medium-term', 'days', 'community'
    ));

    items.push(item(
      'Publish release notes and changelog',
      'Document what has changed since the last active version. Use semantic versioning and tag the first revived release.',
      3, 'medium-term', 'hours', 'documentation'
    ));

    // Long-term
    items.push(item(
      'Recruit maintainers and contributors',
      'Post about the revival on relevant forums, link to good-first-issue labelled issues, and respond promptly to new contributors.',
      4, 'long-term', 'weeks', 'community'
    ));

    items.push(item(
      'Establish a project roadmap',
      'Define a public roadmap with prioritised milestones so the community understands the project direction.',
      4, 'long-term', 'days', 'documentation'
    ));

    return items;
  }

  // ─── Dependency upgrades ──────────────────────────────────────────────────

  private buildDependencyUpgrades(deps?: DependencyAnalysis): DependencyUpgrade[] {
    if (!deps || !deps.dependencies) return [];

    return deps.dependencies
      .filter(d => d.isOutdated || d.vulnerabilities.length > 0)
      .map(d => {
        const hasVulnerability = d.vulnerabilities.length > 0;
        const severity: Severity = d.vulnerabilities.some(v => v.severity === 'critical')
          ? 'critical'
          : d.vulnerabilities.some(v => v.severity === 'high')
          ? 'high'
          : d.isOutdated ? 'medium' : 'low';

        return {
          name: d.name,
          currentVersion: d.currentVersion,
          targetVersion: d.latestVersion || 'latest',
          reason: hasVulnerability ? 'security' : 'outdated',
          breaking: false, // conservative default — user must verify
          priority: severity,
          notes: d.vulnerabilities.length > 0
            ? `${d.vulnerabilities.length} known vulnerabilities`
            : undefined,
        } as DependencyUpgrade;
      })
      .sort((a, b) => {
        const order: Severity[] = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.priority) - order.indexOf(b.priority);
      })
      .slice(0, 30); // cap at 30 for readability
  }

  // ─── Narrative sections ───────────────────────────────────────────────────

  private writeExecutiveSummary(
    analysis: RepositoryAnalysis,
    recommendation: RevivalBlueprint['recommendation'],
    overallScore: number
  ): string {
    const repo = analysis.repository;
    const ageYears = (analysis.lastCommitAge / 365).toFixed(1);

    return [
      `**${repo.full_name}** has an overall revival score of **${overallScore}/100**.`,
      ``,
      `The repository was last active approximately ${ageYears} years ago and shows an abandonment score of ${analysis.abandonmentScore}%`,
      `with a revival potential of ${analysis.revivalPotential}%.`,
      ``,
      `**Recommendation: ${recommendation.toUpperCase()}**`,
      ``,
      `${this.recommendationReason(recommendation, analysis)}`,
      ``,
      `The project has ${repo.stargazers_count.toLocaleString()} stars and ${repo.forks_count.toLocaleString()} forks,`,
      `indicating ${analysis.marketRelevance > 60 ? 'strong' : analysis.marketRelevance > 30 ? 'moderate' : 'limited'} historical interest.`,
      `${repo.language ? `The primary language is **${repo.language}**.` : ''}`,
    ].join('\n');
  }

  private writeTechnicalAssessment(
    analysis: RepositoryAnalysis,
    deps?: DependencyAnalysis
  ): string {
    const lines = [
      `**Technical complexity:** ${analysis.technicalComplexity}`,
      `**Last commit age:** ${Math.round(analysis.lastCommitAge)} days (${(analysis.lastCommitAge / 365).toFixed(1)} years)`,
      `**Open issues:** ${analysis.repository.open_issues_count}`,
      ``,
    ];

    if (deps) {
      lines.push(
        `**Dependency health:** ${deps.dependencyHealth} (score: ${deps.healthScore}/100)`,
        `- Total dependencies: ${deps.totalDependencies}`,
        `- Outdated: ${deps.outdatedDependencies}`,
        `- Vulnerable: ${deps.vulnerableDependencies}`,
        `- Critical vulnerabilities: ${deps.criticalVulnerabilities}`,
        ``
      );
      if (deps.recommendations.length > 0) {
        lines.push('**Dependency recommendations:**');
        deps.recommendations.forEach(r => lines.push(`- ${r}`));
      }
    } else {
      lines.push('Dependency analysis was not performed for this blueprint.');
    }

    return lines.join('\n');
  }

  private writeCommunityAssessment(
    analysis: RepositoryAnalysis,
    forks?: ForkComparison
  ): string {
    const lines = [
      `**Community engagement score:** ${analysis.communityEngagement}/100`,
      `**Market relevance score:** ${analysis.marketRelevance}/100`,
      `**Stars:** ${analysis.repository.stargazers_count.toLocaleString()}`,
      `**Forks:** ${analysis.repository.forks_count.toLocaleString()}`,
      `**Issue response time:** ${analysis.issueResponseTime < 0 ? 'Unknown' : `${Math.round(analysis.issueResponseTime)} days average`}`,
      ``,
    ];

    if (forks) {
      lines.push(
        `**Fork ecosystem:**`,
        `- Total forks analysed: ${forks.analyzedForks}`,
        `- Active forks: ${forks.activeForks.length}`,
        ``
      );
      if (forks.insights.length > 0) {
        lines.push('**Fork insights:**');
        forks.insights.forEach(i => lines.push(`- ${i}`));
      }
    }

    return lines.join('\n');
  }

  private writeRevivalStrategy(
    analysis: RepositoryAnalysis,
    recommendation: RevivalBlueprint['recommendation'],
    effort: EffortEstimate
  ): string {
    const lines = [
      `## Recommended Approach`,
      ``,
      `**Strategy:** ${recommendation.toUpperCase()}`,
      `**Estimated effort:** ${effort.minDays}–${effort.maxDays} working days`,
      `**Team size:** ${effort.teamSize} developer${effort.teamSize > 1 ? 's' : ''}`,
      `**Complexity:** ${effort.complexity}`,
      ``,
    ];

    if (recommendation === 'revive') {
      lines.push(
        `### Phase 1 — Stabilise (Week 1–2)`,
        `1. Fix all critical security vulnerabilities`,
        `2. Establish CI/CD pipeline with automated testing`,
        `3. Update README and contribution guidelines`,
        ``,
        `### Phase 2 — Modernise (Week 3–6)`,
        `1. Update dependency tree to current versions`,
        `2. Expand test coverage to >60%`,
        `3. Refactor highest-complexity modules`,
        `4. Triage and address open issues`,
        ``,
        `### Phase 3 — Grow (Week 7+)`,
        `1. Publish revived release with changelog`,
        `2. Announce revival to community`,
        `3. Establish maintainer roadmap`
      );
    } else if (recommendation === 'fork') {
      lines.push(
        `### Fork Strategy`,
        `1. Create a new repository with clear naming`,
        `2. Import and audit existing code`,
        `3. Establish fresh CI/CD and test infrastructure`,
        `4. Modernise dependencies`,
        `5. Document differences from the original`
      );
    } else if (recommendation === 'monitor') {
      lines.push(
        `### Monitor Strategy`,
        `1. Watch the repository for further activity decline`,
        `2. Set a review checkpoint in 90 days`,
        `3. Engage with existing maintainers if possible`
      );
    } else {
      lines.push(
        `### Archive Assessment`,
        `The project is not recommended for revival given current metrics.`,
        `Consider archiving or searching for more viable alternatives.`
      );
    }

    return lines.join('\n');
  }

  // ─── Sections assembly ────────────────────────────────────────────────────

  private assembleSections(
    executive: string,
    technical: string,
    community: string,
    strategy: string,
    risks: RiskItem[],
    actions: ActionItem[],
    deps: DependencyUpgrade[]
  ): BlueprintSection[] {
    return [
      { id: 'executive-summary', title: 'Executive Summary', content: executive },
      { id: 'technical-assessment', title: 'Technical Assessment', content: technical },
      { id: 'community-assessment', title: 'Community Assessment', content: community },
      { id: 'revival-strategy', title: 'Revival Strategy', content: strategy },
      {
        id: 'risk-register',
        title: 'Risk Register',
        content: risks.length > 0
          ? risks.map(r => `**[${r.severity.toUpperCase()}] ${r.title}**\n${r.description}\nMitigation: ${r.mitigation}`).join('\n\n')
          : 'No significant risks identified.',
      },
      {
        id: 'action-items',
        title: 'Action Items',
        content: actions.map((a, i) => `${i + 1}. **[P${a.priority}] ${a.title}** (${a.phase}, ${a.effort})\n   ${a.description}`).join('\n\n'),
      },
      {
        id: 'dependency-upgrades',
        title: 'Dependency Upgrades',
        content: deps.length > 0
          ? deps.map(d => `- **${d.name}** ${d.currentVersion} → ${d.targetVersion} [${d.reason}${d.breaking ? ', BREAKING' : ''}]${d.notes ? ` — ${d.notes}` : ''}`).join('\n')
          : 'No dependency upgrades required.',
      },
    ];
  }

  // ─── Scoring helpers ──────────────────────────────────────────────────────

  private computeOverallScore(analysis: RepositoryAnalysis): number {
    // Composite: 40% revival potential + 30% community + 20% market + 10% inverse abandonment
    const score =
      analysis.revivalPotential * 0.4 +
      analysis.communityEngagement * 0.3 +
      analysis.marketRelevance * 0.2 +
      (100 - analysis.abandonmentScore) * 0.1;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private computeConfidence(
    analysis: RepositoryAnalysis,
    mlEnhanced?: boolean
  ): RevivalBlueprint['confidence'] {
    if (mlEnhanced) return 'high';
    // Higher confidence when scores are extreme (decisive), lower when in the middle
    const revival = analysis.revivalPotential;
    if (revival < 20 || revival > 80) return 'high';
    if (revival < 35 || revival > 65) return 'medium';
    return 'low';
  }

  private deriveTags(analysis: RepositoryAnalysis): string[] {
    const tags: string[] = [];
    if (analysis.repository.language) tags.push(analysis.repository.language.toLowerCase());
    if (analysis.abandonmentScore > 70) tags.push('abandoned');
    if (analysis.revivalPotential > 70) tags.push('high-potential');
    if (analysis.repository.stargazers_count > 1000) tags.push('popular');
    if (analysis.technicalComplexity === 'high') tags.push('complex');
    if (analysis.communityEngagement > 60) tags.push('active-community');
    return tags;
  }
}
