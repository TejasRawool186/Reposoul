import { ReposoulHunter } from './reposoul';

export { ReposoulHunter } from './reposoul';
export { GitHubService } from './services/github';
export { RepositoryAnalyzer } from './services/analyzer';
export { DependencyAnalyzer } from './services/dependency-analyzer';
export { ForkAnalyzer } from './services/fork-analyzer';
export { MLTrainer } from './services/ml-trainer';
export { MLPredictor } from './services/ml-predictor';
export { BlueprintGenerator } from './services/blueprint-generator';
export { BlueprintFormatter } from './services/blueprint-formatter';
export * from './types';

// Re-export for convenience
export default ReposoulHunter;
