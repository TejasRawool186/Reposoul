import { RevivalBlueprint, RiskItem, ActionItem, DependencyUpgrade } from '../types';

/**
 * BlueprintFormatter converts a RevivalBlueprint into one of several output formats.
 *
 * Supported formats:
 *   - json     — structured JSON (machine-readable)
 *   - markdown — rich Markdown document (human-readable, shareable)
 *   - text     — plain text summary (terminal-friendly)
 */
export class BlueprintFormatter {
  /**
   * Format a blueprint in the requested output format.
   */
  format(blueprint: RevivalBlueprint, format: 'json' | 'markdown' | 'text'): string {
    switch (format) {
      case 'json':     return this.toJson(blueprint);
      case 'markdown': return this.toMarkdown(blueprint);
      case 'text':     return this.toText(blueprint);
    }
  }

  // ─── JSON ─────────────────────────────────────────────────────────────────

  private toJson(blueprint: RevivalBlueprint): string {
    return JSON.stringify(blueprint, null, 2);
  }

  // ─── Markdown ─────────────────────────────────────────────────────────────

  private toMarkdown(blueprint: RevivalBlueprint): string {
    const lines: string[] = [];
    const { recommendation, overallScore, confidence } = blueprint;

    lines.push(`# Revival Blueprint: ${blueprint.repository}`);
    lines.push('');
    lines.push(`> Generated: ${new Date(blueprint.generatedAt).toUTCString()}`);
    lines.push('');

    // Header badges
    lines.push(`**Recommendation:** \`${recommendation.toUpperCase()}\`  `);
    lines.push(`**Overall Score:** ${overallScore}/100  `);
    lines.push(`**Confidence:** ${confidence}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Scores table
    lines.push('## Scores');
    lines.push('');
    lines.push('| Metric | Score |');
    lines.push('|---|---|');
    lines.push(`| Abandonment | ${blueprint.scores.abandonment}% |`);
    lines.push(`| Revival Potential | ${blueprint.scores.revivalPotential}% |`);
    lines.push(`| Community Engagement | ${blueprint.scores.communityEngagement}% |`);
    lines.push(`| Dependency Health | ${blueprint.scores.dependencyHealth}/100 |`);
    lines.push(`| Technical Complexity | ${blueprint.scores.technicalComplexity} |`);
    lines.push('');

    // Effort estimate
    const e = blueprint.effortEstimate;
    lines.push('## Effort Estimate');
    lines.push('');
    lines.push(`| Item | Value |`);
    lines.push('|---|---|');
    lines.push(`| Duration | ${e.minDays}–${e.maxDays} working days |`);
    lines.push(`| Team Size | ${e.teamSize} developer${e.teamSize > 1 ? 's' : ''} |`);
    lines.push(`| Complexity | ${e.complexity} |`);
    lines.push('');
    if (e.factors.length > 0) {
      lines.push('**Key factors:**');
      e.factors.forEach(f => lines.push(`- ${f}`));
      lines.push('');
    }

    // Sections
    for (const section of blueprint.sections) {
      if (section.id === 'risk-register' || section.id === 'action-items' || section.id === 'dependency-upgrades') {
        continue; // rendered separately below
      }
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
    }

    // Risk register
    if (blueprint.riskRegister.length > 0) {
      lines.push('## Risk Register');
      lines.push('');
      blueprint.riskRegister.forEach(r => {
        lines.push(`### [${r.severity.toUpperCase()}] ${r.title}`);
        lines.push('');
        lines.push(`**Category:** ${r.category}  `);
        lines.push(`**Probability:** ${r.probability}  `);
        lines.push(`**Impact:** ${r.impact}`);
        lines.push('');
        lines.push(r.description);
        lines.push('');
        lines.push(`**Mitigation:** ${r.mitigation}`);
        lines.push('');
      });
    }

    // Action items
    if (blueprint.actionItems.length > 0) {
      lines.push('## Action Items');
      lines.push('');
      lines.push('| # | Priority | Title | Phase | Effort | Category |');
      lines.push('|---|---|---|---|---|---|');
      blueprint.actionItems.forEach((a, i) => {
        lines.push(`| ${i + 1} | P${a.priority} | ${a.title} | ${a.phase} | ${a.effort} | ${a.category} |`);
      });
      lines.push('');

      // Detailed descriptions
      lines.push('### Details');
      lines.push('');
      blueprint.actionItems.forEach((a, i) => {
        lines.push(`**${i + 1}. ${a.title}**`);
        lines.push('');
        lines.push(a.description);
        lines.push('');
      });
    }

    // Dependency upgrades
    if (blueprint.dependencyUpgrades.length > 0) {
      lines.push('## Dependency Upgrades');
      lines.push('');
      lines.push('| Package | Current | Target | Reason | Breaking |');
      lines.push('|---|---|---|---|---|');
      blueprint.dependencyUpgrades.forEach(d => {
        lines.push(`| ${d.name} | ${d.currentVersion} | ${d.targetVersion} | ${d.reason} | ${d.breaking ? 'Yes' : 'No'} |`);
      });
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated by REPOSOUL — Give abandoned software a second life.*`);

    return lines.join('\n');
  }

  // ─── Plain text ───────────────────────────────────────────────────────────

  private toText(blueprint: RevivalBlueprint): string {
    const divider = '─'.repeat(60);
    const lines: string[] = [];

    lines.push(divider);
    lines.push(`REVIVAL BLUEPRINT: ${blueprint.repository}`);
    lines.push(divider);
    lines.push(`Generated:      ${new Date(blueprint.generatedAt).toUTCString()}`);
    lines.push(`Recommendation: ${blueprint.recommendation.toUpperCase()}`);
    lines.push(`Overall Score:  ${blueprint.overallScore}/100  (confidence: ${blueprint.confidence})`);
    lines.push('');

    lines.push('SCORES');
    lines.push(`  Abandonment:         ${blueprint.scores.abandonment}%`);
    lines.push(`  Revival Potential:   ${blueprint.scores.revivalPotential}%`);
    lines.push(`  Community:           ${blueprint.scores.communityEngagement}%`);
    lines.push(`  Dependency Health:   ${blueprint.scores.dependencyHealth}/100`);
    lines.push(`  Complexity:          ${blueprint.scores.technicalComplexity}`);
    lines.push('');

    lines.push('EFFORT ESTIMATE');
    lines.push(`  Duration:  ${blueprint.effortEstimate.minDays}–${blueprint.effortEstimate.maxDays} working days`);
    lines.push(`  Team:      ${blueprint.effortEstimate.teamSize} developer${blueprint.effortEstimate.teamSize > 1 ? 's' : ''}`);
    lines.push(`  Complexity:${blueprint.effortEstimate.complexity}`);
    lines.push('');

    lines.push('EXECUTIVE SUMMARY');
    // Strip markdown formatting for plain text
    const summary = blueprint.executiveSummary
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .split('\n')
      .map(l => `  ${l}`)
      .join('\n');
    lines.push(summary);
    lines.push('');

    if (blueprint.riskRegister.length > 0) {
      lines.push(`RISKS (${blueprint.riskRegister.length})`);
      blueprint.riskRegister.forEach((r, i) => {
        lines.push(`  ${i + 1}. [${r.severity.toUpperCase()}] ${r.title}`);
        lines.push(`     ${r.mitigation}`);
      });
      lines.push('');
    }

    if (blueprint.actionItems.length > 0) {
      lines.push(`ACTION ITEMS (${blueprint.actionItems.length})`);
      blueprint.actionItems.forEach((a, i) => {
        lines.push(`  ${i + 1}. [P${a.priority}] ${a.title} (${a.phase})`);
      });
      lines.push('');
    }

    if (blueprint.dependencyUpgrades.length > 0) {
      lines.push(`DEPENDENCY UPGRADES (${blueprint.dependencyUpgrades.length})`);
      blueprint.dependencyUpgrades.slice(0, 10).forEach(d => {
        lines.push(`  ${d.name}  ${d.currentVersion} → ${d.targetVersion}  [${d.reason}]`);
      });
      if (blueprint.dependencyUpgrades.length > 10) {
        lines.push(`  ... and ${blueprint.dependencyUpgrades.length - 10} more`);
      }
      lines.push('');
    }

    lines.push(divider);

    return lines.join('\n');
  }

  // ─── Report (full combined document) ─────────────────────────────────────

  /**
   * Generate a comprehensive Markdown report that combines all sections
   * into a single shareable document.
   */
  report(blueprint: RevivalBlueprint): string {
    // The report format is an extended version of the markdown blueprint
    // with additional metadata and table of contents
    const md = this.toMarkdown(blueprint);
    const toc = this.buildToc(blueprint);

    // Insert TOC after the first horizontal rule
    return md.replace('---\n', `---\n\n## Table of Contents\n\n${toc}\n\n---\n`);
  }

  private buildToc(blueprint: RevivalBlueprint): string {
    const items = [
      '- [Scores](#scores)',
      '- [Effort Estimate](#effort-estimate)',
    ];
    for (const section of blueprint.sections) {
      if (section.id === 'risk-register' || section.id === 'action-items' || section.id === 'dependency-upgrades') continue;
      const anchor = section.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      items.push(`- [${section.title}](#${anchor})`);
    }
    if (blueprint.riskRegister.length > 0) items.push('- [Risk Register](#risk-register)');
    if (blueprint.actionItems.length > 0) items.push('- [Action Items](#action-items)');
    if (blueprint.dependencyUpgrades.length > 0) items.push('- [Dependency Upgrades](#dependency-upgrades)');
    return items.join('\n');
  }
}
