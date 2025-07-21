import { WorkflowRunEventPayload } from '../types';
import { createAuthenticatedOctokit } from '../utils/auth';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function handleWorkflowRunEvent(body: WorkflowRunEventPayload, c: any) {
  const { action, workflow_run, workflow, repository } = body;

  logger.info(`🏃 Workflow ${action}: ${workflow.name} (${workflow_run.conclusion || workflow_run.status})`);

  // Handle workflow completion with PR assignment
  if (action === 'completed' && workflow_run.conclusion === 'success') {
    await handleWorkflowCompletion(body);
  }
  
  return c.text(`Workflow run event logged: ${workflow_run.name} (${action})`);
}

async function handleWorkflowCompletion(body: WorkflowRunEventPayload) {
  const { workflow_run } = body;
  
  // Parse PR and user info from workflow display title
  const titleRegex = /PR#(\d+) - User:(\w+)/;
  const match = workflow_run.display_title.match(titleRegex);
  
  if (!match) {
    logger.warn(`⚠️ Could not parse PR info from workflow title: ${workflow_run.display_title}`);
    return;
  }
  
  const prNumber = parseInt(match[1], 10);
  const assigneeUser = match[2];
  const { repository } = body;
  const owner = repository.owner.login;
  const repo = repository.name;
  
  try {
    const { octokit } = await createAuthenticatedOctokit(body.installation.id);
    
    // Fetch the PR details
    const { data: pr } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: prNumber,
    });
    
    // Check if PR has the target label
    const { data: labels } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: prNumber,
    });
    
    const hasTargetLabel = labels.some((label: any) => label.name === config.targetLabel);
    if (!hasTargetLabel) {
      logger.warn(`⚠️ PR #${prNumber} missing target label "${config.targetLabel}", skipping`);
      return;
    }
    
    // Check if PR is already assigned to the user
    const isAlreadyAssigned = pr.assignees?.some((assignee: any) => assignee.login === assigneeUser) || false;
    
    if (!isAlreadyAssigned) {
      // Assign the PR to the user
      await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/assignees', {
        owner,
        repo,
        issue_number: prNumber,
        assignees: [assigneeUser],
      });
      logger.info(`✅ PR #${prNumber} assigned to ${assigneeUser}`);
    }
    
    // Update PR title by removing the prefix
    let titleUpdated = false;
    if (pr.title.startsWith(config.pullRequestTitlePrefix)) {
      const newTitle = pr.title.substring(config.pullRequestTitlePrefix.length);
      await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner,
        repo,
        pull_number: prNumber,
        title: newTitle,
      });
      logger.info(`📝 PR #${prNumber} title updated: "${newTitle}"`);
      titleUpdated = true;
    }
    
    // Mark PR as ready for review if it's a draft
    if (pr.draft) {
      await octokit.graphql(`
        mutation markPullRequestReadyForReview($pullRequestId: ID!) {
          markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
            pullRequest {
              isDraft
            }
          }
        }
      `, {
        pullRequestId: pr.node_id,
      });
      logger.info(`🚀 PR #${prNumber} marked as ready for review`);
    }
    
    if (!isAlreadyAssigned || pr.draft || titleUpdated) {
      logger.info(`🎉 PR #${prNumber} processed for ${assigneeUser}`);
    }
    
  } catch (error) {
    logger.error(`❌ Failed to process PR #${prNumber}: ${error}`);
  }
} 