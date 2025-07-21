import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/core';
import { WebhookContext } from '../types';
import { config } from '../config';

export async function createAuthenticatedOctokit(installationId: number): Promise<WebhookContext> {
  const installationAuth = createAppAuth({
    appId: config.getAppIdAsNumber(),
    privateKey: config.privateKey,
    installationId,
  });
  
  const installationToken = await installationAuth({ type: 'installation' });
  
  return {
    octokit: new Octokit({ auth: installationToken.token }),
    token: installationToken.token
  };
}
