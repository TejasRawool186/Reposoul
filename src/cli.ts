#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { ReposoulHunter } from './reposoul';
import { GitHubAuthConfig } from './services/github';
import { SearchFilters, ProjectCategory, ForkAnalysisOptions, PredictionConfig } from './types';
import { ForkAnalyzer } from './services/fork-analyzer';
import { MLTrainer } from './services/ml-trainer';
import { MLPredictor } from './services/ml-predictor';
import { OrganizationScanner } from './services/organization-scanner';
// ImprovedMLTrainer will be imported dynamically

// Load environment variables from multiple locations
function loadEnvironmentVariables() {
  // Suppress dotenv output for clean JSON
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  // Temporarily suppress console output
  console.log = () => {};
  console.error = () => {};
  
  try {
    // First try current working directory
    dotenv.config({ debug: false });
    
    // If no GITHUB_TOKEN found, try the reposoul installation directory
    if (!process.env.GITHUB_TOKEN) {
      // This file is compiled to dist/cli.js, so we need to go up to the project root
      // __dirname points to dist/ folder, so go up one level to get project root
      const reposoulDir = path.join(__dirname, '..');
      const reposoulEnvPath = path.join(reposoulDir, '.env');
      
      if (fs.existsSync(reposoulEnvPath)) {
        dotenv.config({ path: reposoulEnvPath, debug: false });
      }
    }
  } finally {
    // Restore console output
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
}

// Load environment variables
loadEnvironmentVariables();

/**
 * Create GitHub authentication configuration from CLI options
 */
function createGitHubAuthFromOptions(options: any): GitHubAuthConfig | undefined {
  if (options.oauthToken) {
    return { oauthToken: options.oauthToken, tokenType: 'oauth' };
  }
  
  if (options.token) {
    const tokenType = options.tokenType === 'oauth' ? 'oauth' : 'pat';
    return { token: options.token, tokenType };
  }
  
  // Return undefined to use default environment variable loading
  return undefined;
}

const program = new Command();

program
  .name('reposoul')
  .description('🔥 REPOSOUL — Give abandoned software a second life. Discover abandoned GitHub repositories and assess their revival potential.')
  .version('1.0.0')
  .option('--token <token>', 'GitHub personal access token or OAuth token')
  .option('--oauth-token <token>', 'GitHub OAuth token (alternative to --token)')
  .option('--token-type <type>', 'Token type: pat or oauth (auto-detected if not specified)', /^(pat|oauth)$/i);

// Hunt command
program
  .command('hunt')
  .description('Search for abandoned repositories')
  .option('-l, --language <language>', 'Programming language (e.g., typescript, javascript)')
  .option('-c, --category <category>', 'Project category (cli-tool, build-tool, dev-tool, etc.)')
  .option('--min-stars <number>', 'Minimum star count', parseInt)
  .option('--max-stars <number>', 'Maximum star count', parseInt)
  .option('--pushed-before <date>', 'Last push before date (YYYY-MM-DD)')
  .option('--pushed-after <date>', 'Last push after date (YYYY-MM-DD)')
  .option('--sort <field>', 'Sort by: stars, updated, created', 'stars')
  .option('--order <direction>', 'Sort order: asc, desc', 'desc')
  .option('--limit <number>', 'Maximum results to analyze', parseInt, 10)
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .option('--skip-dependencies', 'Skip dependency analysis (faster but less detailed)', false)
  .option('--ml-enhanced', 'Use machine learning enhanced scoring (requires trained models)', false)
  .option('--ml-confidence <threshold>', 'ML confidence threshold (0.1-1.0)', parseFloat, 0.7)
  .option('--include-private', 'Include private repositories (requires repo scope token)', false)
  .action(async (options, command) => {
    // Only show spinner for non-JSON output to keep JSON clean
    const spinner = options.output === 'json' ? null : ora('🔥 REPOSOUL is scanning for abandoned repositories...').start();
    
    try {
      const filters: SearchFilters = {
        language: options.language,
        category: options.category as ProjectCategory,
        minStars: options.minStars,
        maxStars: options.maxStars,
        pushedBefore: options.pushedBefore,
        pushedAfter: options.pushedAfter,
        includePrivate: options.includePrivate,
        sort: options.sort,
        order: options.order
      };

      // Create GitHub auth configuration from global options
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);
      
      // Configure ML settings
      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: options.mlConfidence || 0.7,
        fallbackToRuleBase: true
      };
      
      const results = await reposoul.hunt(filters, options.limit, options.mlEnhanced, mlConfig);
      
      if (spinner) spinner.stop();
      
      if (options.output === 'json') {
        // For JSON output, only output the JSON (no other messages)
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.green(`\n🎯 Found ${results.totalFound} repositories, analyzed ${results.analyzed.length}\n`));
        
        if (options.output === 'markdown') {
          printMarkdownResults(results.analyzed);
        } else {
          printTableResults(results.analyzed);
        }
      }
      
    } catch (error) {
      if (spinner) spinner.stop();
      console.error(chalk.red('❌ Hunt failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze <repository>')
  .description('Analyze a specific repository (format: owner/repo)')
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .option('--ml-enhanced', 'Use machine learning enhanced analysis', false)
  .option('--ml-confidence <threshold>', 'ML confidence threshold (0.1-1.0)', parseFloat, 0.7)
  .action(async (repository, options, command) => {
    const spinner = ora(`🔍 Analyzing ${repository}...`).start();
    
    try {
      // Create GitHub auth configuration from global options
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);
      
      // Configure ML settings
      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: options.mlConfidence || 0.7,
        fallbackToRuleBase: true
      };
      
      const analysis = await reposoul.analyzeRepository(repository, options.mlEnhanced, mlConfig);
      
      spinner.stop();
      
      if (options.output === 'json') {
        console.log(JSON.stringify(analysis, null, 2));
      } else if (options.output === 'markdown') {
        printMarkdownAnalysis(analysis);
      } else {
        printTableAnalysis(analysis);
      }
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Analysis failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Fork analysis command
program
  .command('forks <repository>')
  .description('Analyze forks of an abandoned repository (format: owner/repo)')
  .option('--max-forks <number>', 'Maximum forks to analyze', parseInt, 20)
  .option('--min-stars <number>', 'Minimum stars to consider', parseInt, 1)
  .option('--min-activity <days>', 'Maximum days since last activity', parseInt, 365)
  .option('--sort <field>', 'Sort by: activity, stars, divergence, health', 'activity')
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .action(async (repository, options) => {
    const spinner = options.output === 'json' ? null : ora(`🍴 Analyzing forks of ${repository}...`).start();
    
    try {
      const [owner, repo] = repository.split('/');
      
      if (!owner || !repo) {
        throw new Error('Repository must be in format "owner/repo"');
      }

      const reposoul = new ReposoulHunter();
      const githubService = (reposoul as any).githubService; // Access private property
      const forkAnalyzer = new ForkAnalyzer(githubService);
      
      const analysisOptions: ForkAnalysisOptions = {
        maxForks: options.maxForks,
        minStars: options.minStars,
        minActivity: options.minActivity,
        sortBy: options.sort,
        includeOriginal: true
      };
      
      const forkComparison = await forkAnalyzer.analyzeForks(owner, repo, analysisOptions);
      
      if (spinner) spinner.stop();
      
      if (options.output === 'json') {
        console.log(JSON.stringify(forkComparison, null, 2));
      } else if (options.output === 'markdown') {
        printMarkdownForkAnalysis(forkComparison);
      } else {
        printTableForkAnalysis(forkComparison);
      }
      
    } catch (error) {
      if (spinner) spinner.stop();
      console.error(chalk.red('❌ Fork analysis failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ML Training command
program
  .command('train')
  .description('Train ML models for enhanced scoring')
  .option('--repositories <file>', 'File containing repository list (one per line)')
  .option('--sample-size <number>', 'Number of repositories to sample for training', parseInt, 100)
  .option('--popular-repos', 'Include popular repositories in training data', false)
  .option('--improved', 'Use improved training algorithm with better accuracy', false)
  .option('--min-accuracy <threshold>', 'Minimum accuracy to save models (0.1-1.0)', parseFloat, 0.6)
  .action(async (options) => {
    const spinner = ora('🤖 Preparing ML training...').start();
    
    try {
      const reposoul = new ReposoulHunter();
      const githubService = reposoul.githubService;
      const analyzer = new (await import('./services/analyzer')).RepositoryAnalyzer(githubService);
      
      // Use the standard trainer
      const trainer = new MLTrainer(githubService, analyzer);
      
      let repositories: string[] = [];
      
      if (options.repositories) {
        // Load from file
        const fileContent = fs.readFileSync(options.repositories, 'utf-8');
        repositories = fileContent.split('\n').filter(line => line.trim());
      } else {
        // Generate sample repositories
        spinner.text = '🔍 Discovering repositories for training...';
        const sampleSize = parseInt(options.sampleSize) || 100;
        repositories = await generateTrainingRepositories(githubService, sampleSize, options.popularRepos);
      }
      
      spinner.text = `📚 Collecting training data from ${repositories.length} repositories...`;
      await trainer.collectTrainingData(repositories);
      
      spinner.text = '🧠 Training ML models...';
      
      // Train the models
      await trainer.trainModels();
      spinner.stop();
      console.log(chalk.green('✅ ML models trained successfully!'));
      
      console.log(chalk.blue('🎯 Enhanced scoring is now available for analysis'));
      console.log(chalk.yellow('\n💡 Usage:'));
      console.log('  reposoul hunt --ml-enhanced --language typescript');
      console.log('  reposoul analyze owner/repo --ml-enhanced');
      console.log(chalk.gray('\n🔬 For better models, try: reposoul train --improved --min-accuracy 0.7'));
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ ML training failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Organization scan command
program
  .command('scan <organization>')
  .description('Scan all repositories for an organization or user')
  .option('--max-repos <number>', 'Maximum repositories to analyze', (value) => parseInt(value, 10), 50)
  .option('--min-stars <number>', 'Minimum stars to consider', (value) => parseInt(value, 10), 0)
  .option('--max-stars <number>', 'Maximum stars to consider', (value) => parseInt(value, 10))
  .option('--languages <languages>', 'Comma-separated list of languages to include')
  .option('--exclude-forks', 'Exclude forked repositories', false)
  .option('--exclude-archived', 'Exclude archived repositories', false)
  .option('--pushed-before <date>', 'Only repos last updated before date (YYYY-MM-DD)')
  .option('--pushed-after <date>', 'Only repos last updated after date (YYYY-MM-DD)')
  .option('--include-private', 'Include private repositories (requires repo scope token)', false)
  .option('--ml-enhanced', 'Use machine learning enhanced analysis', false)
  .option('--ml-confidence <threshold>', 'ML confidence threshold (0.1-1.0)', parseFloat, 0.7)
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .action(async (organization, options, command) => {
    const spinner = ora(`🏢 Scanning ${organization} repositories...`).start();
    
    try {
      // Create GitHub auth configuration from global options
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);
      const githubService = reposoul.githubService;
      const analyzer = new (await import('./services/analyzer')).RepositoryAnalyzer(githubService);
      const orgScanner = new OrganizationScanner(githubService, analyzer);
      
      // Parse languages filter
      const languages = options.languages ? 
        options.languages.split(',').map((lang: string) => lang.trim().toLowerCase()) : 
        undefined;
      
      // Configure scan filters
      const filters = {
        minStars: options.minStars,
        maxStars: options.maxStars,
        languages,
        excludeForks: options.excludeForks,
        excludeArchived: options.excludeArchived,
        pushedBefore: options.pushedBefore,
        pushedAfter: options.pushedAfter,
        includePrivate: options.includePrivate,
        sortBy: 'updated' as const,
        order: 'desc' as const
      };
      
      // Configure ML settings
      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: options.mlConfidence || 0.7,
        fallbackToRuleBase: true
      };
      
      // Perform organization scan
      const results = await orgScanner.scanOrganization(
        organization,
        filters,
        options.mlEnhanced,
        mlConfig,
        options.maxRepos
      );
      
      spinner.stop();
      
      if (options.output === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else if (options.output === 'markdown') {
        printMarkdownOrganizationResults(results);
      } else {
        printTableOrganizationResults(results);
      }
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Organization scan failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Multi-organization scan command
program
  .command('scan-multi <organizations>')
  .description('Scan multiple organizations or users (comma-separated)')
  .option('--max-repos <number>', 'Maximum repositories per organization', (value) => parseInt(value, 10), 30)
  .option('--min-stars <number>', 'Minimum stars to consider', (value) => parseInt(value, 10), 10)
  .option('--exclude-forks', 'Exclude forked repositories', false)
  .option('--exclude-archived', 'Exclude archived repositories', false)
  .option('--include-private', 'Include private repositories (requires repo scope token)', false)
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .action(async (organizations, options) => {
    const orgList = organizations.split(',').map((org: string) => org.trim());
    const spinner = ora(`🏢 Scanning ${orgList.length} organizations...`).start();
    
    try {
      const reposoul = new ReposoulHunter();
      const githubService = reposoul.githubService;
      const analyzer = new (await import('./services/analyzer')).RepositoryAnalyzer(githubService);
      const orgScanner = new OrganizationScanner(githubService, analyzer);
      
      const filters = {
        minStars: options.minStars,
        excludeForks: options.excludeForks,
        excludeArchived: options.excludeArchived,
        includePrivate: options.includePrivate,
        sortBy: 'updated' as const,
        order: 'desc' as const
      };
      
      const results = await orgScanner.scanMultipleOrganizations(orgList, filters);
      const comparativeReport = orgScanner.generateComparativeReport(results);
      
      spinner.stop();
      
      if (options.output === 'json') {
        console.log(JSON.stringify({ results, comparative: comparativeReport }, null, 2));
      } else {
        printComparativeOrganizationResults(results, comparativeReport);
      }
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Multi-organization scan failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Languages command
program
  .command('languages')
  .description('Show supported programming languages for analysis')
  .action(async () => {
    try {
      const reposoul = new ReposoulHunter();
      const githubService = reposoul.githubService;
      const { DependencyAnalyzer } = await import('./services/dependency-analyzer');
      const dependencyAnalyzer = new DependencyAnalyzer(githubService);
      
      const supportedLanguages = dependencyAnalyzer.getSupportedLanguages();
      
      console.log(chalk.blue('🌍 Supported Programming Languages:\n'));
      
      const languageInfo = {
        'javascript': { icon: '🟨', files: ['package.json'], registry: 'npm' },
        'typescript': { icon: '🔷', files: ['package.json'], registry: 'npm' },
        'python': { icon: '🐍', files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'], registry: 'PyPI' },
        'rust': { icon: '🦀', files: ['Cargo.toml', 'Cargo.lock'], registry: 'crates.io' },
        'go': { icon: '🐹', files: ['go.mod', 'go.sum'], registry: 'pkg.go.dev' },
        'java': { icon: '☕', files: ['pom.xml', 'build.gradle'], registry: 'Maven Central' }
      };
      
      supportedLanguages.forEach(language => {
        const info = languageInfo[language as keyof typeof languageInfo];
        if (info) {
          console.log(`${info.icon} ${chalk.bold(language.charAt(0).toUpperCase() + language.slice(1))}`);
          console.log(`   Files: ${info.files.join(', ')}`);
          console.log(`   Registry: ${info.registry}`);
          console.log('');
        }
      });
      
      console.log(chalk.yellow('💡 Usage:'));
      console.log('  reposoul hunt --language python --ml-enhanced');
      console.log('  reposoul analyze owner/rust-repo --ml-enhanced');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to show language info:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ML Info command
program
  .command('ml-info')
  .description('Show ML model information and status')
  .action(async () => {
    try {
      const predictor = new MLPredictor();
      
      if (predictor.isMLAvailable()) {
        console.log(chalk.green('🧠 ML Models Status: Available'));
        console.log(chalk.blue('\n📊 Model Information:'));
        
        const modelInfo = predictor.getModelInfo();
        Object.entries(modelInfo).forEach(([modelName, info]) => {
          console.log(`\n${chalk.bold(modelName.toUpperCase())}:`);
          console.log(`  Algorithm: ${info.algorithm}`);
          console.log(`  Accuracy: ${Math.round(info.accuracy * 100)}%`);
          console.log(`  Training Samples: ${info.training_samples}`);
          console.log(`  Trained: ${new Date(info.trained_at).toLocaleDateString()}`);
        });
        
        console.log(chalk.yellow('\n💡 Usage Examples:'));
        console.log('  reposoul hunt --ml-enhanced --confidence 0.8');
        console.log('  reposoul analyze microsoft/typescript --ml-enhanced');
      } else {
        console.log(chalk.yellow('🤖 ML Models Status: Not Available'));
        console.log(chalk.blue('\n💡 To enable ML-enhanced scoring:'));
        console.log('  1. Run: reposoul train --sample-size 200');
        console.log('  2. Wait for training to complete');
        console.log('  3. Use: reposoul hunt --ml-enhanced');
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to check ML status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Rate limit command
program
  .command('rate-limit')
  .description('Check GitHub API rate limit status')
  .action(async (options, command) => {
    try {
      // Create GitHub auth configuration from global options
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);
      const rateLimit = await reposoul.checkRateLimit();
      
      console.log(chalk.blue('📊 GitHub API Rate Limit Status:'));
      console.log(`Remaining: ${rateLimit.rate.remaining}/${rateLimit.rate.limit}`);
      console.log(`Resets at: ${new Date(rateLimit.rate.reset * 1000).toLocaleString()}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to check rate limit:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function printTableResults(analyses: any[]) {
  if (analyses.length === 0) {
    console.log(chalk.yellow('No repositories found matching criteria.'));
    return;
  }

  // Create properly aligned header
  const headerRow = [
    chalk.bold('Repository'.padEnd(33)),
    chalk.bold('Stars'.padStart(6)),
    chalk.bold('Abandon'.padStart(7)),
    chalk.bold('Revival'.padStart(7)),
    chalk.bold('ML'),
    chalk.bold('Deps'),
    chalk.bold('Last Commit'.padStart(10)),
    chalk.bold('Status')
  ].join('  ')  
  console.log(headerRow);
  console.log('─'.repeat(90));
  
  analyses.forEach(analysis => {
    const repo = analysis.repository;
    const name = repo.full_name.length > 33 ? repo.full_name.substring(0, 30) + '...' : repo.full_name;
    const stars = repo.stargazers_count.toString();
    const abandon = `${analysis.abandonmentScore}%`;
    const revival = `${analysis.revivalPotential}%`;
    const lastCommit = `${analysis.lastCommitAge}d`;
    
    // ML indicator
    let mlIndicator = '❓';
    if (analysis.mlPrediction) {
      const confidence = Math.round(analysis.mlPrediction.confidence_score * 100);
      if (confidence > 80) mlIndicator = chalk.green('🧠');
      else if (confidence > 60) mlIndicator = chalk.yellow('🤖');
      else mlIndicator = chalk.gray('🔮');
    } else {
      mlIndicator = chalk.gray('❓');
    }
    
    // Dependency health indicator
    let depsIndicator = '❓';
    if (analysis.dependencyAnalysis) {
      switch (analysis.dependencyHealth) {
        case 'excellent': depsIndicator = chalk.green('✅'); break;
        case 'good': depsIndicator = chalk.green('👍'); break;
        case 'fair': depsIndicator = chalk.yellow('⚠️'); break;
        case 'poor': depsIndicator = chalk.red('👎'); break;
        case 'critical': depsIndicator = chalk.red('🚨'); break;
        default: depsIndicator = chalk.gray('❓'); break;
      }
    } else {
      depsIndicator = chalk.gray('❓');
    }
    
    let status = '';
    // Use ML predictions if available and confident
    if (analysis.mlPrediction && analysis.mlPrediction.confidence_score > 0.7) {
      const mlRevival = analysis.mlPrediction.revival_success_probability * 100;
      const mlAbandonment = analysis.mlPrediction.abandonment_probability * 100;
      
      if (mlAbandonment > 70 && mlRevival > 60) {
        status = chalk.green('🎯 PRIME');
      } else if (mlAbandonment > 50 && mlRevival > 40) {
        status = chalk.yellow('⚠️ MAYBE');
      } else {
        status = chalk.red('❌ SKIP');
      }
    } else {
      // Fall back to rule-based
      if (analysis.abandonmentScore > 70 && analysis.revivalPotential > 60) {
        status = chalk.green('🎯 PRIME');
      } else if (analysis.abandonmentScore > 50 && analysis.revivalPotential > 40) {
        status = chalk.yellow('⚠️ MAYBE');
      } else {
        status = chalk.red('❌ SKIP');
      }
    }
    
    // Use fixed-width formatting to handle emojis properly
    const formattedRow = [
      name.padEnd(33).substring(0, 33),
      stars.padStart(6),
      abandon.padStart(7),
      revival.padStart(7),
      mlIndicator,
      depsIndicator,
      lastCommit.padStart(10),
      status
    ].join('  ');
    
    console.log(formattedRow);
  });
}

function printMarkdownResults(analyses: any[]) {
  console.log('# 🔥 REPOSOUL — Repository Discovery Results\n');
  
  analyses.forEach(analysis => {
    const repo = analysis.repository;
    console.log(`## [${repo.full_name}](${repo.html_url})\n`);
    console.log(`**Description:** ${repo.description || 'No description'}\n`);
    console.log(`**Language:** ${repo.language || 'Unknown'} | **Stars:** ${repo.stargazers_count} | **Forks:** ${repo.forks_count}\n`);
    console.log(`**Abandonment Score:** ${analysis.abandonmentScore}% | **Revival Potential:** ${analysis.revivalPotential}%\n`);
    console.log(`**Last Commit:** ${analysis.lastCommitAge} days ago\n`);
    
    if (analysis.reasons.length > 0) {
      console.log('**Abandonment Indicators:**');
      analysis.reasons.forEach((reason: string) => console.log(`- ${reason}`));
      console.log('');
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('**Revival Recommendations:**');
      analysis.recommendations.forEach((rec: string) => console.log(`- ${rec}`));
      console.log('');
    }
    
    console.log('---\n');
  });
}

function printTableAnalysis(analysis: any) {
  const repo = analysis.repository;
  
  console.log(chalk.blue.bold(`\n📊 Analysis: ${repo.full_name}\n`));
  
  console.log(chalk.bold('Basic Information:'));
  console.log(`URL: ${repo.html_url}`);
  console.log(`Description: ${repo.description || 'No description'}`);
  console.log(`Language: ${repo.language || 'Unknown'}`);
  console.log(`Created: ${new Date(repo.created_at).toLocaleDateString()}`);
  console.log(`Last Push: ${new Date(repo.pushed_at).toLocaleDateString()}`);
  
  console.log(chalk.bold('\nMetrics:'));
  console.log(`Stars: ${repo.stargazers_count}`);
  console.log(`Forks: ${repo.forks_count}`);
  console.log(`Open Issues: ${repo.open_issues_count}`);
  console.log(`Size: ${repo.size} KB`);
  
  console.log(chalk.bold('\nScores:'));
  console.log(`Abandonment Score: ${analysis.abandonmentScore}%`);
  console.log(`Revival Potential: ${analysis.revivalPotential}%`);
  console.log(`Community Engagement: ${analysis.communityEngagement}%`);
  console.log(`Market Relevance: ${analysis.marketRelevance}%`);
  console.log(`Dependency Health: ${analysis.dependencyHealth}`);
  
  // Show ML predictions if available
  if (analysis.mlPrediction) {
    console.log(chalk.bold('\n🤖 ML Predictions:'));
    console.log(`Abandonment Probability: ${Math.round(analysis.mlPrediction.abandonment_probability * 100)}%`);
    console.log(`Revival Success Probability: ${Math.round(analysis.mlPrediction.revival_success_probability * 100)}%`);
    console.log(`Estimated Effort: ${analysis.mlPrediction.estimated_effort_days} days`);
    console.log(`Community Adoption Likelihood: ${Math.round(analysis.mlPrediction.community_adoption_likelihood * 100)}%`);
    console.log(`ML Confidence: ${Math.round(analysis.mlPrediction.confidence_score * 100)}%`);
    console.log(`Scoring Method: ${analysis.scoringMethod}`);
  }
  
  console.log(chalk.bold('\nTiming:'));
  console.log(`Last Commit: ${analysis.lastCommitAge} days ago`);
  console.log(`Avg Issue Response: ${analysis.issueResponseTime > 0 ? `${Math.round(analysis.issueResponseTime)} days` : 'Unknown'}`);
  
  console.log(chalk.bold('\nAssessment:'));
  console.log(`Technical Complexity: ${analysis.technicalComplexity}`);
  console.log(`Dependency Health: ${analysis.dependencyHealth}`);

  // Show detailed dependency information if available
  if (analysis.dependencyAnalysis && analysis.dependencyAnalysis.totalDependencies > 0) {
    console.log(chalk.bold('\nDependency Details:'));
    const deps = analysis.dependencyAnalysis;
    console.log(`Total Dependencies: ${deps.totalDependencies}`);
    console.log(`Outdated: ${deps.outdatedDependencies} (${Math.round((deps.outdatedDependencies / deps.totalDependencies) * 100)}%)`);
    console.log(`With Vulnerabilities: ${deps.vulnerableDependencies}`);
    console.log(`Critical Vulnerabilities: ${deps.criticalVulnerabilities}`);
    console.log(`Health Score: ${deps.healthScore}/100`);
    
    if (deps.recommendations.length > 0) {
      console.log(chalk.bold('\nDependency Recommendations:'));
      deps.recommendations.forEach((rec: string) => console.log(`• ${rec}`));
    }
  }
  
  if (analysis.reasons.length > 0) {
    console.log(chalk.bold('\nAbandonment Indicators:'));
    analysis.reasons.forEach((reason: string) => console.log(`• ${reason}`));
  }
  
  if (analysis.recommendations.length > 0) {
    console.log(chalk.bold('\nRevival Recommendations:'));
    analysis.recommendations.forEach((rec: string) => console.log(`• ${rec}`));
  }
}

function printMarkdownAnalysis(analysis: any) {
  const repo = analysis.repository;
  
  console.log(`# 🔥 REPOSOUL — Repository Analysis: ${repo.full_name}\n`);
  console.log(`[View on GitHub](${repo.html_url})\n`);
  console.log(`**Description:** ${repo.description || 'No description'}\n`);
  
  console.log('## 📊 Metrics\n');
  console.log(`| Metric | Value |`);
  console.log(`|--------|-------|`);
  console.log(`| Stars | ${repo.stargazers_count} |`);
  console.log(`| Forks | ${repo.forks_count} |`);
  console.log(`| Open Issues | ${repo.open_issues_count} |`);
  console.log(`| Language | ${repo.language || 'Unknown'} |`);
  console.log(`| Size | ${repo.size} KB |`);
  console.log(`| Last Commit | ${analysis.lastCommitAge} days ago |\n`);
  
  console.log('## 🎯 Scores\n');
  console.log(`| Score | Value |`);
  console.log(`|-------|-------|`);
  console.log(`| Abandonment Score | ${analysis.abandonmentScore}% |`);
  console.log(`| Revival Potential | ${analysis.revivalPotential}% |`);
  console.log(`| Community Engagement | ${analysis.communityEngagement}% |`);
  console.log(`| Market Relevance | ${analysis.marketRelevance}% |\n`);
  
  if (analysis.reasons.length > 0) {
    console.log('## ⚠️ Abandonment Indicators\n');
    analysis.reasons.forEach((reason: string) => console.log(`- ${reason}`));
    console.log('');
  }
  
  if (analysis.recommendations.length > 0) {
    console.log('## 💡 Revival Recommendations\n');
    analysis.recommendations.forEach((rec: string) => console.log(`- ${rec}`));
    console.log('');
  }
}

function printTableForkAnalysis(forkComparison: any) {
  const { original, totalForks, analyzedForks, activeForks, topRecommendations, insights } = forkComparison;
  
  console.log(chalk.blue.bold(`\n🍴 Fork Analysis: ${original.full_name}\n`));
  
  console.log(chalk.bold('Overview:'));
  console.log(`Total Forks: ${totalForks}`);
  console.log(`Analyzed: ${analyzedForks}`);
  console.log(`Active: ${activeForks.length}`);
  console.log(`Execution Time: ${Math.round(forkComparison.executionTime / 1000)}s\n`);
  
  if (insights.length > 0) {
    console.log(chalk.bold('Insights:'));
    insights.forEach((insight: string) => console.log(`• ${insight}`));
    console.log('');
  }
  
  if (topRecommendations.length === 0) {
    console.log(chalk.yellow('No active forks found matching criteria.'));
    return;
  }
  
  console.log(chalk.bold('Top Fork Recommendations:\n'));
  
  console.log(chalk.bold('Rank'.padEnd(6)) + 
              chalk.bold('Repository'.padEnd(35)) + 
              chalk.bold('Stars'.padEnd(8)) + 
              chalk.bold('Activity'.padEnd(10)) + 
              chalk.bold('Health'.padEnd(10)) + 
              chalk.bold('Last Active'.padEnd(15)) + 
              chalk.bold('Status'));
  
  console.log('─'.repeat(110));
  
  topRecommendations.slice(0, 10).forEach((fork: any, index: number) => {
    const repo = fork.repository;
    const name = repo.full_name.length > 33 ? repo.full_name.substring(0, 30) + '...' : repo.full_name;
    const stars = repo.stargazers_count.toString();
    const activity = `${fork.activityScore}%`;
    const health = fork.analysis.dependencyHealth;
    const lastActive = `${fork.lastActivityDays}d ago`;
    
    // Health indicator
    let healthIndicator = '❓';
    switch (health) {
      case 'excellent': healthIndicator = chalk.green('✅'); break;
      case 'good': healthIndicator = chalk.green('👍'); break;
      case 'fair': healthIndicator = chalk.yellow('⚠️'); break;
      case 'poor': healthIndicator = chalk.red('👎'); break;
      case 'critical': healthIndicator = chalk.red('🚨'); break;
      default: healthIndicator = chalk.gray('❓'); break;
    }
    
    // Status based on overall score
    let status = '';
    const overallScore = (fork.activityScore * 0.4) + (fork.analysis.revivalPotential * 0.3) + (fork.maintainerResponsiveness * 0.3);
    if (overallScore > 80) {
      status = chalk.green('🌟 EXCELLENT');
    } else if (overallScore > 60) {
      status = chalk.green('🎯 GOOD');
    } else if (overallScore > 40) {
      status = chalk.yellow('⚠️ FAIR');
    } else {
      status = chalk.red('❌ POOR');
    }
    
    console.log(
      `#${fork.forkRank}`.padEnd(6) +
      name.padEnd(35) +
      stars.padEnd(8) +
      activity.padEnd(10) +
      (healthIndicator + '     ').substring(0, 10) +
      lastActive.padEnd(15) +
      status
    );
  });
  
  // Show special recommendations
  if (forkComparison.bestForRevival) {
    console.log(chalk.bold('\n🚀 Best for Revival:'));
    const best = forkComparison.bestForRevival;
    console.log(`${best.repository.full_name} - Revival potential: ${best.analysis.revivalPotential}%`);
  }
  
  if (forkComparison.bestForContribution) {
    console.log(chalk.bold('\n🤝 Best for Contribution:'));
    const best = forkComparison.bestForContribution;
    console.log(`${best.repository.full_name} - Maintainer responsiveness: ${best.maintainerResponsiveness}%`);
  }
  
  if (forkComparison.mostDiverged) {
    console.log(chalk.bold('\n🔀 Most Diverged:'));
    const diverged = forkComparison.mostDiverged;
    console.log(`${diverged.repository.full_name} - ${diverged.divergenceFromOriginal} commits ahead`);
  }
}

function printMarkdownForkAnalysis(forkComparison: any) {
  const { original, totalForks, analyzedForks, activeForks, topRecommendations, insights } = forkComparison;
  
  console.log(`# 🍴 Fork Analysis: ${original.full_name}\n`);
  console.log(`[Original Repository](${original.html_url})\n`);
  
  console.log('## 📊 Overview\n');
  console.log(`- **Total Forks**: ${totalForks}`);
  console.log(`- **Analyzed**: ${analyzedForks}`);
  console.log(`- **Active**: ${activeForks.length}`);
  console.log(`- **Execution Time**: ${Math.round(forkComparison.executionTime / 1000)}s\n`);
  
  if (insights.length > 0) {
    console.log('## 💡 Insights\n');
    insights.forEach((insight: string) => console.log(`- ${insight}`));
    console.log('');
  }
  
  if (topRecommendations.length > 0) {
    console.log('## 🏆 Top Fork Recommendations\n');
    console.log('| Rank | Repository | Stars | Activity | Health | Last Active | Revival Potential |');
    console.log('|------|------------|-------|----------|--------|-------------|-------------------|');
    
    topRecommendations.slice(0, 10).forEach((fork: any) => {
      const repo = fork.repository;
      console.log(`| #${fork.forkRank} | [${repo.full_name}](${repo.html_url}) | ${repo.stargazers_count} | ${fork.activityScore}% | ${fork.analysis.dependencyHealth} | ${fork.lastActivityDays}d ago | ${fork.analysis.revivalPotential}% |`);
    });
    console.log('');
  }
  
  // Special recommendations
  if (forkComparison.bestForRevival) {
    console.log('## 🚀 Best for Revival\n');
    const best = forkComparison.bestForRevival;
    console.log(`**[${best.repository.full_name}](${best.repository.html_url})**`);
    console.log(`- Revival Potential: ${best.analysis.revivalPotential}%`);
    console.log(`- Activity Score: ${best.activityScore}%`);
    console.log(`- Dependency Health: ${best.analysis.dependencyHealth}\n`);
  }
  
  if (forkComparison.bestForContribution) {
    console.log('## 🤝 Best for Contribution\n');
    const best = forkComparison.bestForContribution;
    console.log(`**[${best.repository.full_name}](${best.repository.html_url})**`);
    console.log(`- Maintainer Responsiveness: ${best.maintainerResponsiveness}%`);
    console.log(`- Activity Score: ${best.activityScore}%`);
    console.log(`- Last Active: ${best.lastActivityDays} days ago\n`);
  }
}

/**
 * Generate training repositories for ML
 */
async function generateTrainingRepositories(githubService: any, sampleSize: number, includePopular: boolean): Promise<string[]> {
  const repositories: string[] = [];
  
  // Sample from different languages (without categories to avoid search issues)
  const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'];
  const reposPerLanguage = Math.ceil(Number(sampleSize) / languages.length);
  
  console.log(`🔍 Searching for ${reposPerLanguage} repositories per language (${sampleSize} total)...`);
  
  for (const language of languages) {
    try {
      console.log(`  Searching ${language} repositories...`);
      
      const searchResponse = await githubService.searchRepositories({
        language,
        minStars: includePopular ? 50 : 10,
        maxStars: includePopular ? undefined : 5000,
        pushedBefore: '2023-01-01' // Focus on potentially abandoned projects
      }, 1, Math.min(30, reposPerLanguage));
      
      console.log(`  Found ${searchResponse.items.length} ${language} repositories`);
      
      searchResponse.items.forEach((repo: any) => {
        if (repositories.length < sampleSize && !repositories.includes(repo.full_name)) {
          repositories.push(repo.full_name);
        }
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.warn(`Failed to sample ${language} repositories:`, error instanceof Error ? error.message : error);
    }
  }
  
  // If we still don't have enough, try some popular abandoned projects
  if (repositories.length < sampleSize) {
    console.log(`🎯 Adding known abandoned projects to reach sample size...`);
    
    const knownAbandoned = [
      'bower/bower',
      'angular/angular.js',
      'jquery/jquery-ui',
      'atom/atom',
      'meteor/meteor',
      'strongloop/express',
      'jashkenas/backbone',
      'documentcloud/backbone',
      'moment/moment',
      'chalk/chalk',
      'yargs/yargs',
      'gulpjs/gulp',
      'gruntjs/grunt',
      'browserify/browserify',
      'requirejs/requirejs',
      'component/component',
      'yeoman/yeoman',
      'necolas/normalize.css',
      'daneden/animate.css',
      'less/less.js',
      'stylus/stylus'
    ];
    
    knownAbandoned.forEach(repo => {
      if (repositories.length < sampleSize && !repositories.includes(repo)) {
        repositories.push(repo);
      }
    });
  }
  
  console.log(`✅ Generated ${repositories.length} repositories for training`);
  return repositories.slice(0, sampleSize);
}

/**
 * Print organization scan results in table format
 */
function printTableOrganizationResults(results: any) {
  const { organization, totalRepositories, scannedRepositories, abandonedProjects, primeRevivalCandidates, healthSummary, techDebtMetrics, insights } = results;
  
  console.log(chalk.blue.bold(`\n🏢 Organization Scan: ${organization.name || organization.login}\n`));
  
  // Overview stats
  console.log(chalk.bold('Overview:'));
  console.log(`Type: ${organization.type}`);
  console.log(`Total Public Repos: ${totalRepositories}`);
  console.log(`Scanned: ${scannedRepositories}`);
  console.log(`Abandoned: ${abandonedProjects.length} (${Math.round((abandonedProjects.length / scannedRepositories) * 100)}%)`);
  console.log(`Prime Revival Candidates: ${primeRevivalCandidates.length}`);
  console.log(`Execution Time: ${Math.round(results.executionTime / 1000)}s\n`);
  
  // Health summary
  console.log(chalk.bold('Dependency Health Summary:'));
  console.log(`✅ Excellent: ${healthSummary.excellent}`);
  console.log(`👍 Good: ${healthSummary.good}`);
  console.log(`⚠️ Fair: ${healthSummary.fair}`);
  console.log(`👎 Poor: ${healthSummary.poor}`);
  console.log(`🚨 Critical: ${healthSummary.critical}`);
  console.log(`❓ Unknown: ${healthSummary.unknown}\n`);

  // Tech Debt Impact Analysis
  if (techDebtMetrics) {
    console.log(chalk.red.bold('💰 Tech Debt Financial Impact:'));
    console.log(`💵 Estimated Annual Cost: ${chalk.red('$' + techDebtMetrics.totalCostImpact.estimatedAnnualCost.toLocaleString())}`);
    console.log(`📊 Cost per Repository: ${chalk.yellow('$' + techDebtMetrics.totalCostImpact.maintenanceCostPerRepo.toLocaleString())}/month`);
    console.log(`🚨 Security Incident Risk: ${chalk.red('$' + techDebtMetrics.totalCostImpact.securityIncidentCost.toLocaleString())}`);
    console.log(`⏱️ Opportunity Cost: ${chalk.yellow('$' + techDebtMetrics.totalCostImpact.opportunityCost.toLocaleString())}/year\n`);

    console.log(chalk.blue.bold('⏰ Time Investment Required:'));
    console.log(`🔧 Total Maintenance Hours: ${chalk.cyan(techDebtMetrics.timeEstimates.totalMaintenanceHours.toLocaleString())} hours`);
    console.log(`📈 Average per Repository: ${chalk.cyan(techDebtMetrics.timeEstimates.averageHoursPerRepo)} hours`);
    console.log(`🚨 Critical Issues: ${chalk.red(techDebtMetrics.timeEstimates.criticalIssueHours)} hours`);
    console.log(`📦 Dependency Updates: ${chalk.yellow(techDebtMetrics.timeEstimates.dependencyUpdateHours)} hours\n`);

    console.log(chalk.red.bold('🛡️ Security Risk Assessment:'));
    console.log(`🎯 Overall Risk Score: ${getSecurityRiskColor(techDebtMetrics.securityRisk.riskScore)(techDebtMetrics.securityRisk.riskScore + '/100')}`);
    console.log(`🚨 Critical Vulnerabilities: ${chalk.red(techDebtMetrics.securityRisk.criticalVulnerabilities)}`);
    console.log(`⚠️ High Vulnerabilities: ${chalk.yellow(techDebtMetrics.securityRisk.highVulnerabilities)}`);
    console.log(`📦 Outdated Dependencies: ${chalk.magenta(techDebtMetrics.securityRisk.outdatedDependencies)}`);
    console.log(`⚖️ Compliance Risk: ${getComplianceRiskColor(techDebtMetrics.securityRisk.complianceRisk)(techDebtMetrics.securityRisk.complianceRisk.toUpperCase())}\n`);

    console.log(chalk.magenta.bold('📈 Business Impact:'));
    console.log(`📉 Productivity Loss: ${chalk.red(techDebtMetrics.businessImpact.productivityLoss + '%')}`);
    console.log(`🚀 Deployment Risk: ${chalk.yellow(techDebtMetrics.businessImpact.deploymentRisk + '/100')}`);
    console.log(`👥 Talent Retention Impact: ${getTalentRetentionColor(techDebtMetrics.businessImpact.talentRetention)(techDebtMetrics.businessImpact.talentRetention + '/100')}`);
    console.log(`⏳ Innovation Delay: ${chalk.cyan(techDebtMetrics.businessImpact.innovationDelay)} months\n`);
  }
  
  // Language breakdown
  if (Object.keys(results.languageBreakdown).length > 0) {
    console.log(chalk.bold('Language Breakdown:'));
    Object.entries(results.languageBreakdown)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([language, count]) => {
        console.log(`  ${language}: ${count} repositories`);
      });
    console.log('');
  }
  
  // Insights
  if (insights.length > 0) {
    console.log(chalk.bold('Key Insights:'));
    insights.forEach((insight: string) => console.log(`• ${insight}`));
    console.log('');
  }
  
  // Show abandoned projects
  if (abandonedProjects.length > 0) {
    console.log(chalk.bold('🚨 Abandoned Projects:\n'));
    
    const headerRow = [
      chalk.bold('Repository'.padEnd(40)),
      chalk.bold('Stars'.padStart(6)),
      chalk.bold('Abandon'.padStart(7)),
      chalk.bold('Revival'.padStart(7)),
      chalk.bold('Last Commit'.padStart(12))
    ].join('  ');
    
    console.log(headerRow);
    console.log('─'.repeat(85));
    
    abandonedProjects.slice(0, 10).forEach((analysis: any) => {
      const repo = analysis.repository;
      const name = repo.full_name.length > 38 ? repo.full_name.substring(0, 35) + '...' : repo.full_name;
      
      const row = [
        name.padEnd(40),
        repo.stargazers_count.toString().padStart(6),
        `${analysis.abandonmentScore}%`.padStart(7),
        `${analysis.revivalPotential}%`.padStart(7),
        `${analysis.lastCommitAge}d`.padStart(12)
      ].join('  ');
      
      console.log(row);
    });
    
    if (abandonedProjects.length > 10) {
      console.log(chalk.gray(`\n... and ${abandonedProjects.length - 10} more abandoned projects`));
    }
  }
  
  // Show prime revival candidates
  if (primeRevivalCandidates.length > 0) {
    console.log(chalk.bold('\n🎯 Prime Revival Candidates:\n'));
    
    primeRevivalCandidates.slice(0, 5).forEach((analysis: any) => {
      const repo = analysis.repository;
      console.log(`${chalk.green('🎯')} ${chalk.bold(repo.full_name)}`);
      console.log(`   ${repo.description || 'No description'}`);
      console.log(`   ⭐ ${repo.stargazers_count} stars | 🍴 ${repo.forks_count} forks | 📅 ${analysis.lastCommitAge}d ago`);
      console.log(`   📊 Abandonment: ${analysis.abandonmentScore}% | Revival: ${analysis.revivalPotential}%`);
      console.log('');
    });
  }
  
  // Recommendations
  if (results.recommendations.length > 0) {
    console.log(chalk.bold('💡 Recommendations:'));
    results.recommendations.forEach((rec: string) => console.log(`• ${rec}`));
  }
}

/**
 * Print markdown organization results
 */
function printMarkdownOrganizationResults(results: any) {
  const { organization, totalRepositories, scannedRepositories, abandonedProjects, primeRevivalCandidates, techDebtMetrics } = results;
  
  console.log(`# 🏢 Organization Scan: ${organization.name || organization.login}\n`);
  console.log(`[View on GitHub](${organization.html_url})\n`);
  
  console.log('## 📊 Overview\n');
  console.log(`- **Type**: ${organization.type}`);
  console.log(`- **Total Public Repos**: ${totalRepositories}`);
  console.log(`- **Scanned**: ${scannedRepositories}`);
  console.log(`- **Abandoned**: ${abandonedProjects.length} (${Math.round((abandonedProjects.length / scannedRepositories) * 100)}%)`);
  console.log(`- **Prime Revival Candidates**: ${primeRevivalCandidates.length}`);
  console.log(`- **Execution Time**: ${Math.round(results.executionTime / 1000)}s\n`);
  
  // Tech Debt Impact Analysis
  if (techDebtMetrics) {
    console.log('## 💰 Tech Debt Financial Impact\n');
    console.log(`| Metric | Value |`);
    console.log(`|--------|-------|`);
    console.log(`| **Estimated Annual Cost** | $${techDebtMetrics.totalCostImpact.estimatedAnnualCost.toLocaleString()} |`);
    console.log(`| **Cost per Repository** | $${techDebtMetrics.totalCostImpact.maintenanceCostPerRepo.toLocaleString()}/month |`);
    console.log(`| **Security Incident Risk** | $${techDebtMetrics.totalCostImpact.securityIncidentCost.toLocaleString()} |`);
    console.log(`| **Opportunity Cost** | $${techDebtMetrics.totalCostImpact.opportunityCost.toLocaleString()}/year |\n`);

    console.log('## ⏰ Time Investment Required\n');
    console.log(`| Task | Hours |`);
    console.log(`|------|-------|`);
    console.log(`| **Total Maintenance** | ${techDebtMetrics.timeEstimates.totalMaintenanceHours.toLocaleString()} hours |`);
    console.log(`| **Average per Repository** | ${techDebtMetrics.timeEstimates.averageHoursPerRepo} hours |`);
    console.log(`| **Critical Issues** | ${techDebtMetrics.timeEstimates.criticalIssueHours} hours |`);
    console.log(`| **Dependency Updates** | ${techDebtMetrics.timeEstimates.dependencyUpdateHours} hours |\n`);

    console.log('## 🛡️ Security Risk Assessment\n');
    console.log(`| Risk Factor | Value |`);
    console.log(`|-------------|-------|`);
    console.log(`| **Overall Risk Score** | ${techDebtMetrics.securityRisk.riskScore}/100 |`);
    console.log(`| **Critical Vulnerabilities** | ${techDebtMetrics.securityRisk.criticalVulnerabilities} |`);
    console.log(`| **High Vulnerabilities** | ${techDebtMetrics.securityRisk.highVulnerabilities} |`);
    console.log(`| **Outdated Dependencies** | ${techDebtMetrics.securityRisk.outdatedDependencies} |`);
    console.log(`| **Compliance Risk** | ${techDebtMetrics.securityRisk.complianceRisk.toUpperCase()} |\n`);

    console.log('## 📈 Business Impact\n');
    console.log(`| Impact Area | Value |`);
    console.log(`|-------------|-------|`);
    console.log(`| **Productivity Loss** | ${techDebtMetrics.businessImpact.productivityLoss}% |`);
    console.log(`| **Deployment Risk** | ${techDebtMetrics.businessImpact.deploymentRisk}/100 |`);
    console.log(`| **Talent Retention Impact** | ${techDebtMetrics.businessImpact.talentRetention}/100 |`);
    console.log(`| **Innovation Delay** | ${techDebtMetrics.businessImpact.innovationDelay} months |\n`);
  }
  
  if (results.insights.length > 0) {
    console.log('## 💡 Key Insights\n');
    results.insights.forEach((insight: string) => console.log(`- ${insight}`));
    console.log('');
  }
  
  if (abandonedProjects.length > 0) {
    console.log('## 🚨 Abandoned Projects\n');
    console.log('| Repository | Stars | Abandonment | Revival Potential | Last Commit |');
    console.log('|------------|-------|-------------|-------------------|-------------|');
    
    abandonedProjects.slice(0, 10).forEach((analysis: any) => {
      const repo = analysis.repository;
      console.log(`| [${repo.full_name}](${repo.html_url}) | ${repo.stargazers_count} | ${analysis.abandonmentScore}% | ${analysis.revivalPotential}% | ${analysis.lastCommitAge}d ago |`);
    });
    console.log('');
  }
  
  if (primeRevivalCandidates.length > 0) {
    console.log('## 🎯 Prime Revival Candidates\n');
    
    primeRevivalCandidates.slice(0, 5).forEach((analysis: any) => {
      const repo = analysis.repository;
      console.log(`### [${repo.full_name}](${repo.html_url})\n`);
      console.log(`${repo.description || 'No description'}\n`);
      console.log(`- **Stars**: ${repo.stargazers_count}`);
      console.log(`- **Forks**: ${repo.forks_count}`);
      console.log(`- **Last Commit**: ${analysis.lastCommitAge} days ago`);
      console.log(`- **Abandonment Score**: ${analysis.abandonmentScore}%`);
      console.log(`- **Revival Potential**: ${analysis.revivalPotential}%\n`);
    });
  }
}

/**
 * Print comparative organization results
 */
function printComparativeOrganizationResults(results: any[], comparative: any) {
  console.log(chalk.blue.bold(`\n🏢 Multi-Organization Scan Results\n`));
  
  console.log(chalk.bold('Overview:'));
  console.log(`Organizations Scanned: ${comparative.totalOrganizations}`);
  console.log(`Total Repositories: ${comparative.totalRepositories}`);
  console.log(`Average Abandonment Rate: ${Math.round(comparative.averageAbandonmentRate)}%`);
  console.log(`Best Maintained: ${comparative.bestMaintainedOrg}`);
  console.log(`Needs Attention: ${comparative.mostAbandonedOrg}\n`);
  
  // Organization comparison table
  console.log(chalk.bold('Organization Comparison:\n'));
  
  const headerRow = [
    chalk.bold('Organization'.padEnd(20)),
    chalk.bold('Repos'.padStart(6)),
    chalk.bold('Abandoned'.padStart(9)),
    chalk.bold('Prime'.padStart(5)),
    chalk.bold('Critical'.padStart(8)),
    chalk.bold('Health')
  ].join('  ');
  
  console.log(headerRow);
  console.log('─'.repeat(70));
  
  results.forEach((result: any) => {
    const abandonmentRate = Math.round((result.abandonedProjects.length / result.scannedRepositories) * 100);
    const healthScore = Math.round(((result.healthSummary.excellent + result.healthSummary.good) / result.scannedRepositories) * 100);
    
    let healthIndicator = '❓';
    if (healthScore > 80) healthIndicator = chalk.green('✅');
    else if (healthScore > 60) healthIndicator = chalk.yellow('⚠️');
    else healthIndicator = chalk.red('🚨');
    
    const row = [
      result.organization.login.padEnd(20),
      result.scannedRepositories.toString().padStart(6),
      `${abandonmentRate}%`.padStart(9),
      result.primeRevivalCandidates.length.toString().padStart(5),
      result.healthSummary.critical.toString().padStart(8),
      healthIndicator
    ].join('  ');
    
    console.log(row);
  });
  
  // Recommendations
  if (comparative.recommendations.length > 0) {
    console.log(chalk.bold('\n💡 Recommendations:'));
    comparative.recommendations.forEach((rec: string) => console.log(`• ${rec}`));
  }
}

/**
 * Helper functions for tech debt metrics color coding
 */
function getSecurityRiskColor(score: number) {
  if (score >= 80) return chalk.red.bold;
  if (score >= 60) return chalk.red;
  if (score >= 40) return chalk.yellow;
  if (score >= 20) return chalk.blue;
  return chalk.green;
}

function getComplianceRiskColor(risk: string) {
  switch (risk) {
    case 'critical': return chalk.red.bold;
    case 'high': return chalk.red;
    case 'medium': return chalk.yellow;
    case 'low': return chalk.green;
    default: return chalk.gray;
  }
}

function getTalentRetentionColor(score: number) {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  if (score >= 40) return chalk.red;
  return chalk.red.bold;
}

// ─── blueprint command ───────────────────────────────────────────────────────

program
  .command('blueprint')
  .description('Generate a revival blueprint for an abandoned repository (format: owner/repo)')
  .argument('<repository>', 'Repository in owner/repo format')
  .option('--output <format>', 'Output format: markdown | json | text', 'markdown')
  .option('--file <path>', 'Write output to a file instead of stdout')
  .option('--include-deps', 'Run dependency analysis and include in blueprint', false)
  .option('--include-forks', 'Run fork analysis and include in blueprint', false)
  .option('--ml-enhanced', 'Use ML-enhanced scoring if models are available', false)
  .action(async (repository: string, options, command) => {
    const spinner = options.output === 'json' ? null : ora('Analysing repository...').start();

    try {
      const { BlueprintGenerator } = await import('./services/blueprint-generator');
      const { BlueprintFormatter } = await import('./services/blueprint-formatter');
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);

      if (spinner) spinner.text = 'Fetching repository data...';

      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: 0.7,
        fallbackToRuleBase: true,
      };
      const analysis = await reposoul.analyzeRepository(repository, options.mlEnhanced, mlConfig);

      let dependencyAnalysis;
      if (options.includeDeps) {
        if (spinner) spinner.text = 'Analysing dependencies...';
        const { DependencyAnalyzer } = await import('./services/dependency-analyzer');
        const depAnalyzer = new DependencyAnalyzer(reposoul.githubService);
        const [owner, repo] = repository.split('/');
        dependencyAnalysis = await depAnalyzer.analyzeDependencies(owner, repo);
      }

      let forkComparison;
      if (options.includeForks) {
        if (spinner) spinner.text = 'Analysing forks...';
        const forkAnalyzer = new ForkAnalyzer(reposoul.githubService);
        const [owner, repo] = repository.split('/');
        forkComparison = await forkAnalyzer.analyzeForks(owner, repo, { maxForks: 10 });
      }

      if (spinner) spinner.text = 'Generating blueprint...';

      const generator = new BlueprintGenerator();
      const blueprint = generator.generate(analysis, dependencyAnalysis, forkComparison, {
        mlEnhanced: options.mlEnhanced,
      });

      if (spinner) spinner.stop();

      const formatter = new BlueprintFormatter();
      const outputFormat = (options.output as 'json' | 'markdown' | 'text') || 'markdown';
      const output = formatter.format(blueprint, outputFormat);

      if (options.file) {
        const filePath = path.resolve(options.file);
        fs.writeFileSync(filePath, output, 'utf-8');
        console.log(chalk.green(`Blueprint written to: ${filePath}`));
      } else {
        console.log(output);
      }

    } catch (error) {
      if (spinner) spinner.stop();
      console.error(chalk.red('Blueprint generation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ─── report command ───────────────────────────────────────────────────────────

program
  .command('report')
  .description('Generate a comprehensive revival report for a repository (format: owner/repo)')
  .argument('<repository>', 'Repository in owner/repo format')
  .option('--file <path>', 'Write report to a file (default: <repo-name>-report.md)')
  .option('--include-deps', 'Run dependency analysis and include in report', false)
  .option('--include-forks', 'Run fork analysis and include in report', false)
  .option('--ml-enhanced', 'Use ML-enhanced scoring if models are available', false)
  .action(async (repository: string, options, command) => {
    const spinner = ora('Generating report...').start();

    try {
      const { BlueprintGenerator } = await import('./services/blueprint-generator');
      const { BlueprintFormatter } = await import('./services/blueprint-formatter');
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);

      spinner.text = 'Fetching repository data...';
      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: 0.7,
        fallbackToRuleBase: true,
      };
      const analysis = await reposoul.analyzeRepository(repository, options.mlEnhanced, mlConfig);

      let dependencyAnalysis;
      if (options.includeDeps) {
        spinner.text = 'Analysing dependencies...';
        const { DependencyAnalyzer } = await import('./services/dependency-analyzer');
        const depAnalyzer = new DependencyAnalyzer(reposoul.githubService);
        const [owner, repo] = repository.split('/');
        dependencyAnalysis = await depAnalyzer.analyzeDependencies(owner, repo);
      }

      let forkComparison;
      if (options.includeForks) {
        spinner.text = 'Analysing forks...';
        const forkAnalyzer = new ForkAnalyzer(reposoul.githubService);
        const [owner, repo] = repository.split('/');
        forkComparison = await forkAnalyzer.analyzeForks(owner, repo, { maxForks: 10 });
      }

      spinner.text = 'Building report...';
      const generator = new BlueprintGenerator();
      const blueprint = generator.generate(analysis, dependencyAnalysis, forkComparison, {
        mlEnhanced: options.mlEnhanced,
      });

      const formatter = new BlueprintFormatter();
      const report = formatter.report(blueprint);

      const repoSlug = repository.replace('/', '-');
      const filePath = path.resolve(options.file || `${repoSlug}-report.md`);
      fs.writeFileSync(filePath, report, 'utf-8');

      spinner.stop();
      console.log(chalk.green(`Report saved to: ${filePath}`));
      console.log('');
      console.log(chalk.bold('Summary:'));
      console.log(`  Repository:     ${blueprint.repository}`);
      console.log(`  Recommendation: ${chalk.bold(blueprint.recommendation.toUpperCase())}`);
      console.log(`  Overall Score:  ${blueprint.overallScore}/100`);
      console.log(`  Effort:         ${blueprint.effortEstimate.minDays}–${blueprint.effortEstimate.maxDays} days`);
      console.log(`  Risks:          ${blueprint.riskRegister.length}`);
      console.log(`  Action Items:   ${blueprint.actionItems.length}`);

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Report generation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ─── workspace command ───────────────────────────────────────────────────────

program
  .command('workspace')
  .description('Prepare a Kiro IDE workspace: clone the repository and generate a revival blueprint')
  .argument('<repository>', 'Repository in owner/repo format')
  .option('--output-dir <path>', 'Directory to write workspace files (default: ./<repo-name>-workspace)')
  .option('--ml-enhanced', 'Use ML-enhanced scoring when generating the blueprint', false)
  .option('--no-clone', 'Skip cloning the repository (blueprint files only)', true)
  .option('--full-clone', 'Clone full history instead of a shallow clone (slower)', false)
  .option('--max-size-mb <n>', 'Maximum clone size in MB (default: 500)', '500')
  .option('--blueprint-file <path>', 'Reuse an existing blueprint.json instead of generating a new one')
  .action(async (repository: string, options, command) => {
    const spinner = ora('Preparing workspace...').start();

    try {
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});

      // ── Acquire blueprint ──
      let blueprint: import('./types').RevivalBlueprint;
      if (options.blueprintFile) {
        const fsMod = await import('fs');
        const raw = fsMod.readFileSync(path.resolve(options.blueprintFile), 'utf-8');
        blueprint = JSON.parse(raw);
        spinner.text = 'Using provided blueprint...';
      } else {
        const reposoul = new ReposoulHunter(authConfig);
        spinner.text = 'Analysing repository...';
        blueprint = await reposoul.generateBlueprint(repository, {
          mlEnhanced: options.mlEnhanced,
        });
      }

      const repoSlug = repository.replace('/', '-');
      const outputDir = path.resolve(options.outputDir || `./${repoSlug}-workspace`);

      const { WorkspaceManager } = await import('./services/workspace-manager');
      const maxSizeMb = parseInt(options.maxSizeMb, 10);
      const manager = new WorkspaceManager({
        cloneDepth: options.fullClone ? 0 : 1,
        maxSizeBytes: (isNaN(maxSizeMb) ? 500 : maxSizeMb) * 1024 * 1024,
        cloneTimeoutMs: 180_000,
        onProgress: (msg, detail) => {
          spinner.text = `${msg}${detail ? ` (${detail})` : ''}`;
        },
      });

      if (options.clone === false) {
        // No-clone path: write blueprint files only
        spinner.text = 'Writing workspace files (no clone)...';
        const result = await manager.prepareNoClone(repository, blueprint, outputDir);
        spinner.stop();
        printWorkspaceSummary(result, false);
        return;
      }

      const result = await manager.prepare(repository, blueprint, outputDir);

      spinner.stop();
      printWorkspaceSummary(result, true);

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Workspace generation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function printWorkspaceSummary(result: import('./services/workspace-manager').WorkspaceResultLike, withClone: boolean) {
  console.log(chalk.green(`Workspace created: ${result.workspacePath}`));
  console.log('');
  console.log(chalk.bold('Files:'));
  for (const f of result.filesWritten) {
    console.log(`  ${f}`);
  }
  if (withClone && result.cloned?.success) {
    console.log(`  repo/          — cloned repository source (${result.cloned.totalFiles} files)`);
  } else if (withClone && result.cloned && !result.cloned.success) {
    console.log(chalk.yellow(`  Clone failed:  ${result.cloned.error}`));
  }
  console.log('');
  console.log(chalk.bold('Duration:'), `${(result.durationMs / 1000).toFixed(1)}s`);
}

// ─── validate command ─────────────────────────────────────────────────────────

program
  .command('validate')
  .description('Validate that a repository meets minimum revival standards')
  .argument('<repository>', 'Repository in owner/repo format')
  .option('--strict', 'Fail if any high-severity issue is found', false)
  .action(async (repository: string, options, command) => {
    const spinner = ora('Validating repository...').start();

    try {
      const authConfig = createGitHubAuthFromOptions(command.parent?.opts() || {});
      const reposoul = new ReposoulHunter(authConfig);

      const analysis = await reposoul.analyzeRepository(repository);

      spinner.stop();

      // Define validation checks
      const checks = [
        {
          name: 'Has a license',
          pass: !!analysis.repository.license,
          severity: 'high' as const,
          detail: analysis.repository.license?.name ?? 'No license found',
        },
        {
          name: 'Revival potential above 20%',
          pass: analysis.revivalPotential > 20,
          severity: 'high' as const,
          detail: `${analysis.revivalPotential}% revival potential`,
        },
        {
          name: 'Has stars (community interest)',
          pass: analysis.repository.stargazers_count > 0,
          severity: 'medium' as const,
          detail: `${analysis.repository.stargazers_count} stars`,
        },
        {
          name: 'Not disabled',
          pass: !analysis.repository.disabled,
          severity: 'high' as const,
          detail: analysis.repository.disabled ? 'Repository is disabled' : 'Active',
        },
        {
          name: 'Has a description',
          pass: !!analysis.repository.description,
          severity: 'low' as const,
          detail: analysis.repository.description ?? 'No description',
        },
      ];

      const passed = checks.filter(c => c.pass);
      const failed = checks.filter(c => !c.pass);
      const highFails = failed.filter(c => c.severity === 'high');

      console.log(chalk.bold(`\nValidation: ${repository}`));
      console.log('');
      checks.forEach(c => {
        const icon = c.pass ? chalk.green('✓') : chalk.red('✗');
        const severity = c.pass ? '' : chalk.gray(` [${c.severity}]`);
        console.log(`  ${icon} ${c.name}${severity}`);
        if (!c.pass) console.log(`    ${chalk.gray(c.detail)}`);
      });

      console.log('');
      console.log(`${passed.length}/${checks.length} checks passed`);

      if (highFails.length > 0) {
        console.log(chalk.red(`\n${highFails.length} high-severity issue${highFails.length > 1 ? 's' : ''} found`));
        if (options.strict) {
          process.exit(1);
        }
      } else if (failed.length === 0) {
        console.log(chalk.green('\nAll checks passed. Repository meets revival standards.'));
      } else {
        console.log(chalk.yellow('\nSome non-critical checks failed. Review before proceeding.'));
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Validation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
