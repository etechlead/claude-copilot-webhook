import { Octokit } from '@octokit/core';
import { logger } from './logger';
import { config } from '../config';

// Sanitize issue title for use in branch name
export function sanitizeIssueTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove everything except letters, numbers, spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Remove hyphens at start and end
}

// Get existing branches for a specific issue
export async function getExistingBranchesForIssue(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number
): Promise<string[]> {
  const prefix = `${config.branchPrefix}${issueNumber}-`;
  
  try {
    const { data: branches } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
      owner,
      repo,
      per_page: 100,
    });
    
    return branches
      .map(branch => branch.name)
      .filter(name => name.startsWith(prefix));
  } catch (error) {
    logger.warn(`⚠️ Branch fetch failed: ${error}`);
    return [];
  }
}

// Generate branch name with length limits and sequence numbering
export async function generateBranchName(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string
): Promise<string> {
  const sanitizedTitle = sanitizeIssueTitle(issueTitle);
  const existingBranches = await getExistingBranchesForIssue(octokit, owner, repo, issueNumber);
  
  // Determine the next sequence number
  const sequenceNumber = existingBranches.length + 1;
  
  const basePrefix = `${config.branchPrefix}${issueNumber}-`;
  const suffix = `-${sequenceNumber}`;
  
  // Calculate maximum length for sanitized title
  const maxTitleLength = 32 - basePrefix.length - suffix.length;
  
  // Truncate title if necessary
  const truncatedTitle = sanitizedTitle.length > maxTitleLength 
    ? sanitizedTitle.substring(0, maxTitleLength).replace(/-$/, '') // Remove trailing hyphen if present
    : sanitizedTitle;
  
  return `${basePrefix}${truncatedTitle}${suffix}`;
}
