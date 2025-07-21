import { IssueCommentEventPayload } from '../types';
import { createAuthenticatedOctokit } from '../utils/auth';
import { dispatchClaudeWorkflow, hasClaudeTriggerLabel, isBotSender } from '../utils/workflow';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function handleIssueCommentEvent(body: IssueCommentEventPayload, c: any) {
  const { action, comment, issue, repository, sender } = body;

  if (action !== 'created' || !issue.pull_request) {
    logger.info(`⏭️ Comment ignored: not a new comment on PR`);
    return c.text('Ignored: not a new comment on a PR.');
  }

  if (isBotSender(sender)) {
    logger.info(`⏭️ Comment ignored: from bot ${sender.login}`);
    return c.text('Ignored bot comment');
  }

  const { octokit, token } = await createAuthenticatedOctokit(body.installation.id);
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = issue.number;

  // Check if the PR has our trigger label
  const hasTriggerLabel = await hasClaudeTriggerLabel(octokit, owner, repo, prNumber);

  if (!hasTriggerLabel) {
      logger.info(`⏭️ Comment ignored: PR #${prNumber} missing trigger label`);
      return c.text('Not a Claude-managed PR');
  }

  logger.info(`🔧 Processing comment: PR #${prNumber} in ${owner}/${repo}`);

  const { data: pr } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: prNumber,
  });
  const branchName = pr.head.ref;

  await octokit.request('POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
    owner,
    repo,
    comment_id: comment.id,
    content: config.reactionEyes,
  });

  // Trigger Claude workflow with full context
  await dispatchClaudeWorkflow({
    octokit,
    owner,
    repo,
    eventName: 'issue_comment',
    eventPayload: body,
    token,
    branch: branchName,
    prNumber: prNumber,
    assigneeUser: sender.login, // The user who made the comment should get the PR
  });
  
  logger.info(`✅ Workflow triggered: comment processing for PR #${prNumber}`);
  return c.text('Comment processing triggered');
}