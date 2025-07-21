export class Config {
  // GitHub App Configuration
  public readonly appId: string;
  public readonly privateKey: string;
  public readonly webhookSecret: string;

  // Workflow Configuration
  public readonly targetLabel: string;
  public readonly defaultBranch: string;
  public readonly branchPrefix: string;
  public readonly repositoryDispatchEvent: string;
  public readonly pullRequestTitlePrefix: string;

  // UI Configuration
  public readonly reactionEyes = 'eyes' as const;

  constructor() {
    // Validate and assign required environment variables
    this.appId = this.getRequiredEnv('APP_ID');
    this.privateKey = this.getRequiredEnv('PRIVATE_KEY').replace(/\\n/g, '\n');
    this.webhookSecret = this.getRequiredEnv('WEBHOOK_SECRET');
    this.targetLabel = this.getRequiredEnv('TARGET_LABEL');
    this.defaultBranch = this.getRequiredEnv('DEFAULT_BRANCH');

    // Assign optional environment variables with defaults
    this.branchPrefix = process.env.BRANCH_PREFIX || 'claude/issue-';
    this.repositoryDispatchEvent = process.env.REPOSITORY_DISPATCH_EVENT || 'claude_copilot';
    this.pullRequestTitlePrefix = process.env.PULL_REQUEST_PREFIX || '[WIP] ';

    // Validate configuration
    this.validate();
  }

  private getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private validate(): void {
    // Validate APP_ID is numeric
    if (!/^\d+$/.test(this.appId)) {
      throw new Error('APP_ID must be a valid number');
    }

    // Validate private key format
    if (!this.privateKey.includes('BEGIN') || !this.privateKey.includes('END')) {
      throw new Error('PRIVATE_KEY must be a valid PEM format private key');
    }

    // Validate webhook secret is not empty
    if (this.webhookSecret.length < 8) {
      throw new Error('WEBHOOK_SECRET must be at least 8 characters long');
    }

    // Validate target label is not empty
    if (this.targetLabel.trim().length === 0) {
      throw new Error('TARGET_LABEL cannot be empty');
    }

    // Validate default branch is not empty
    if (this.defaultBranch.trim().length === 0) {
      throw new Error('DEFAULT_BRANCH cannot be empty');
    }

    // Validate branch prefix format
    if (this.branchPrefix.includes(' ') || this.branchPrefix.includes('..')) {
      throw new Error('BRANCH_PREFIX must be a valid git branch prefix');
    }

    // Validate pull request title prefix is not empty
    if (this.pullRequestTitlePrefix.trim().length === 0) {
      throw new Error('PULL_REQUEST_PREFIX cannot be empty');
    }
  }

  // Utility methods for common operations
  public getAppIdAsNumber(): number {
    return parseInt(this.appId, 10);
  }

  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public getLogLevel(): string {
    return process.env.LOG_LEVEL || (this.isProduction() ? 'info' : 'debug');
  }

  // Method to get a summary of configuration (without sensitive data)
  public getSummary(): Record<string, any> {
    return {
      appId: this.appId,
      targetLabel: this.targetLabel,
      defaultBranch: this.defaultBranch,
      claudeBranchPrefix: this.branchPrefix,
      repositoryDispatchEvent: this.repositoryDispatchEvent,
      pullRequestTitlePrefix: this.pullRequestTitlePrefix,
      reactionEyes: this.reactionEyes,
      environment: process.env.NODE_ENV || 'development',
      logLevel: this.getLogLevel(),
    };
  }
}

// Export singleton instance
export const config = new Config(); 