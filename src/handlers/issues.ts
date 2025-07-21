import { IssueEventPayload } from '../types';
import { createAuthenticatedOctokit } from '../utils/auth';
import { generateBranchName } from '../utils/branch';
import { dispatchClaudeWorkflow } from '../utils/workflow';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function handleIssuesEvent(body: IssueEventPayload, c: any) {
  const { action, label, repository, issue, sender } = body;

  if (action !== 'labeled' || label?.name !== config.targetLabel) {
    logger.info(`⏭️ Issue ignored: action=${action}, label=${label?.name}`);
    return c.text('Ignored');
  }

  logger.info(`🔧 Processing labeled issue: #${issue.number} in ${repository.owner.login}/${repository.name}`);

  const { octokit, token } = await createAuthenticatedOctokit(body.installation.id);

  const owner = repository.owner.login;
  const repo = repository.name;
  const issueNumber = issue.number;
  const baseBranch = config.defaultBranch;
  const newBranch = await generateBranchName(octokit, owner, repo, issueNumber, issue.title);

  logger.info(`🌱 Branch creating: ${newBranch}`);

  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/reactions', {
    owner,
    repo,
    issue_number: issueNumber,
    content: config.reactionEyes,
  });

  const { data: refData } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = refData.object.sha;

  await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseSha,
  });
  logger.info(`✅ Branch created: ${newBranch}`);

  const { data: baseCommit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner,
    repo,
    commit_sha: baseSha,
  });

  const { data: newCommit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message: `chore: initial commit for issue #${issueNumber}`,
    tree: baseCommit.tree.sha,
    parents: [baseSha],
  });

  await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
    owner,
    repo,
    ref: `heads/${newBranch}`,
    sha: newCommit.sha,
    force: true,
  });

  const prResponse = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    title: `${config.pullRequestTitlePrefix}${issue.title}`,
    head: newBranch,
    base: baseBranch,
    body: `This PR is being automatically worked on by Claude to address issue #${issueNumber}.\n\n**Original Issue Description:**\n\n> ${issue.body || 'No description provided.'}`,
    draft: true,
  });
  logger.info(`✅ PR created: draft #${prResponse.data.number}`);

  // Add the trigger label to the PR so subsequent comments work correctly
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: prResponse.data.number,
      labels: [config.targetLabel]
  });
  logger.info(`✅ PR labeled: #${prResponse.data.number} with ${config.targetLabel}`);

  // Trigger Claude workflow with full context
  const prData = prResponse.data;

  await dispatchClaudeWorkflow({
    octokit,
    owner,
    repo,
    eventName: 'pull_request',
    eventPayload: {
      action: 'opened',
      number: prData.number,
      pull_request: prData,
      repository: repository,
      sender: sender,
      installation: body.installation
    },
    token,
    branch: newBranch,
    prNumber: prData.number,
    assigneeUser: sender.login, // The user who labeled the issue should get the PR
  });

  logger.info(`✅ Workflow triggered: issue-to-PR flow for #${prData.number}`);
  return c.text('PR created and workflow triggered!');
}