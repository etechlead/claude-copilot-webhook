import { logger } from './logger';
import { config } from '../config';

export interface WorkflowDispatchParams {
  octokit: any;
  owner: string;
  repo: string;
  eventName: string;
  eventPayload: any;
  token: string;
  branch: string;
  prNumber: number;
  assigneeUser: string; // User who should be assigned the PR when workflow completes
}

/**
 * Determines if a review should be treated as a single code comment
 * Based on the new architecture rules:
 * - 1 comment + state="commented" = SingleCodeComment
 * - Any other case = PullRequestReviewCompleted
 */
export function isStandaloneCodeComment(commentsCount: number, reviewState: string): boolean {
  return commentsCount === 1 && reviewState.toLowerCase() === 'commented';
}

/**
 * Dispatches Claude workflow with standardized payload structure
 */
export async function dispatchClaudeWorkflow(params: WorkflowDispatchParams): Promise<void> {
  const { octokit, owner, repo, eventName, eventPayload, token, branch, prNumber, assigneeUser } = params;

  await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
    owner,
    repo,
    event_type: config.repositoryDispatchEvent,
    client_payload: {
      original_event_name: eventName,
      original_event_payload: eventPayload,
      github_app_token: token,
      branch: branch,
      pr_number: prNumber,
      assignee_user: assigneeUser,
    }
  });

  logger.info(`🚀 Workflow dispatched: ${eventName} for PR #${prNumber}, assignee: ${assigneeUser}`);
}

/**
 * Checks if a PR/issue has the trigger label
 */
export async function hasClaudeTriggerLabel(
  octokit: any, 
  owner: string, 
  repo: string, 
  issueNumber: number
): Promise<boolean> {
  try {
    const { data: labels } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: issueNumber,
    });

    return labels.some((label: { name: string }) => label.name === config.targetLabel);
  } catch (error) {
    logger.error(`❌ Label fetch failed: issue #${issueNumber}, error: ${error}`);
    throw error;
  }
}

/**
 * Checks if sender is a bot that should be ignored
 */
export function isBotSender(sender: { type?: string; login: string }): boolean {
  const botType = 'Bot';
  const botSuffix = '[bot]';

  return sender.type === botType || sender.login.endsWith(botSuffix);
} 