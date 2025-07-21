import { PullRequestReviewEventPayload } from '../types';
import { createAuthenticatedOctokit } from '../utils/auth';
import { dispatchClaudeWorkflow, hasClaudeTriggerLabel, isBotSender, isStandaloneCodeComment } from '../utils/workflow';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function handlePullRequestReviewEvent(body: PullRequestReviewEventPayload, c: any) {
  const { action, review, pull_request, repository, sender } = body;

  if (action !== 'submitted') {
    logger.info(`⏭️ Review ignored: action ${action}`);
    return c.text('Ignored action');
  }

  if (isBotSender(sender)) {
    logger.info(`⏭️ Review ignored: from bot ${sender.login}`);
    return c.text('Ignored bot');
  }

  const { octokit, token } = await createAuthenticatedOctokit(body.installation.id);
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;
  const branchName = pull_request.head.ref;

  const hasTriggerLabel = await hasClaudeTriggerLabel(octokit, owner, repo, prNumber);
  if (!hasTriggerLabel) {
    logger.info(`⏭️ Review ignored: PR #${prNumber} missing trigger label`);
    return c.text('Ignored: no trigger label');
  }

  // Get all review comments to determine how to handle this review
  let reviewComments: any[] = [];
  try {
    const commentsResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments', {
      owner,
      repo,
      pull_number: prNumber,
      review_id: review.id,
    });
    reviewComments = commentsResponse.data;
  } catch (error) {
    logger.error(`❌ Review comment fetch failed: ${error}`);
    return c.text('Error fetching review comments');
  }

  const nComments = reviewComments.length;
  const isStandaloneComment = isStandaloneCodeComment(nComments, review.state);

  logger.info(`📊 Review analyzed: ${nComments} comments, state=${review.state}, standalone=${isStandaloneComment}`);

  // React to all review comments to acknowledge processing
  for (const comment of reviewComments) {
    try {
      await octokit.request('POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions', {
        owner,
        repo,
        comment_id: comment.id,
        content: config.reactionEyes,
      });
    } catch (error) {
      logger.error(`❌ Comment reaction failed: comment ${comment.id}, error: ${error}`);
    }
  }

  if (isStandaloneComment) {
    logger.info(`🔧 Processing single code comment: review ${review.id}`);
    
    const singleComment = reviewComments[0];
    const singleCommentPayload = {
      action: 'created',
      comment: singleComment,
      pull_request: pull_request,
      repository: repository,
      sender: sender,
      installation: body.installation
    };

    await dispatchClaudeWorkflow({
      octokit,
      owner,
      repo,
      eventName: 'pull_request_review_comment',
      eventPayload: singleCommentPayload,
      token,
      branch: branchName,
      prNumber: prNumber,
      assigneeUser: sender.login, // The user who made the review comment should get the PR
    });

    logger.info(`✅ Workflow triggered: single code comment ${singleComment.id}`);
    return c.json({ 
      success: true, 
      type: 'SingleCodeComment',
      message: `Single code comment processing triggered`
    });
    
  } else {
    logger.info(`🔧 Processing full review: review ${review.id} with ${nComments} comments`);

    let effectiveCommentBody = review.body?.trim() || '';
    
    // Generate review body from comments if none provided
    if (!effectiveCommentBody && reviewComments.length > 0) {
      const commentSummaries = reviewComments.map(comment => 
        `- ${comment.path}${comment.line ? `:${comment.line}` : ''}: ${comment.body.trim()}`
      ).join('\n');
      
      effectiveCommentBody = `Please address the following review feedback:\n\n${commentSummaries}`;
    }
    
    if (!effectiveCommentBody) {
      effectiveCommentBody = 'Please review and improve this pull request.';
    }

    const consolidatedPayload = {
      ...body,
      review: {
        ...review,
        body: effectiveCommentBody
      },
      review_comments: reviewComments
    };

    await dispatchClaudeWorkflow({
      octokit,
      owner,
      repo,
      eventName: 'pull_request_review',
      eventPayload: consolidatedPayload,
      token,
      branch: branchName,
      prNumber: prNumber,
      assigneeUser: sender.login, // The user who made the review should get the PR
    });

    logger.info(`✅ Workflow triggered: full review ${review.id} with ${nComments} comments`);
    logger.info(`📝 Review body generated: ${effectiveCommentBody.substring(0, 100)}...`);
    return c.json({ 
      success: true, 
      type: 'PullRequestReviewCompleted',
      message: `Review processing triggered with ${nComments} comments`
    });
  }
}