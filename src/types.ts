import { Octokit } from '@octokit/core';

export interface WebhookContext {
  octokit: Octokit;
  token: string;
}

export interface IssueEventPayload {
  action: string;
  label?: {
    name: string;
  };
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  issue: {
    number: number;
    title: string;
    body?: string;
    pull_request?: any;
  };
  sender: {
    login: string;
    type?: string; // 'User' or 'Bot'
  };
  installation: {
    id: number;
  };
}

export interface IssueCommentEventPayload {
  action: string;
  comment: {
    id: number;
    body: string;
  };
  issue: {
    number: number;
    pull_request?: any;
  };
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  sender: {
    login: string;
    type?: string; // 'User' or 'Bot'
  };
  installation: {
    id: number;
  };
}

export interface PullRequestReviewEventPayload {
  action: string;
  review: {
    id: number;
    body?: string;
    state: string;
  };
  pull_request: {
    number: number;
    head: {
      ref: string;
    };
    user: {
      login: string;
      type: string;
    };
  };
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  sender: {
    login: string;
    type?: string;
  };
  installation: {
    id: number;
  };
}

export interface WorkflowRunEventPayload {
  action: string;
  workflow_run: {
    id: number;
    name: string;
    status: string;
    conclusion?: string;
    workflow_id: number;
    check_suite_id: number;
    check_suite_node_id: string;
    url: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    run_attempt: number;
    run_started_at: string;
    event: string;
    head_branch: string;
    head_sha: string;
    path: string;
    display_title: string;
    run_number: number;
    triggering_actor: {
      login: string;
      type: string;
    };
  };
  workflow: {
    id: number;
    name: string;
    path: string;
    state: string;
    created_at: string;
    updated_at: string;
    url: string;
    html_url: string;
    badge_url: string;
  };
  repository: {
    owner: {
      login: string;
    };
    name: string;
    full_name: string;
  };
  sender: {
    login: string;
    type?: string;
  };
  installation: {
    id: number;
  };
}

