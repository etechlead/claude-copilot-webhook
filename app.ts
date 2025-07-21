import { Hono } from 'hono';
import { config as dotenvConfig } from 'dotenv';
import { verifySignature } from './src/utils/validation';
import { handleIssuesEvent } from './src/handlers/issues';
import { handleIssueCommentEvent } from './src/handlers/issue-comment';
import { handlePullRequestReviewEvent } from './src/handlers/pull-request-review';
import { handleWorkflowRunEvent } from './src/handlers/workflow-run';
import { logger } from './src/utils/logger';
import { config } from './src/config';

dotenvConfig();

// Validate configuration on startup
try {
  logger.info('🔧 Configuration loaded successfully');
  logger.info(`📋 Configuration: ${JSON.stringify(config.getSummary(), null, 2)}`);
} catch (error) {
  logger.error(`❌ Configuration validation failed: ${error}`);
  process.exit(1);
}

const app = new Hono();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main webhook handler
app.post('/', async (c) => {
  const payload = await c.req.text();
  const sig = c.req.header('x-hub-signature-256')!;
  
  logger.info('📥 Webhook received');
  
  if (!verifySignature(payload, sig)) {
    logger.error('❌ Signature verification failed');
    return c.text('Invalid signature', 401);
  }

  const body = JSON.parse(payload);
  const eventType = c.req.header('x-github-event');
  
  logger.info(`🎯 Event received: ${eventType}`);

  // Route to appropriate handler based on event type
  switch (eventType) {
    case 'issues':
      return handleIssuesEvent(body, c);
    case 'issue_comment':
      return handleIssueCommentEvent(body, c);
    case 'pull_request_review':
      return handlePullRequestReviewEvent(body, c);
    case 'workflow_run':
      return handleWorkflowRunEvent(body, c);
    default:
      logger.info(`⏭️ Event ignored: unsupported type ${eventType}`);
      return c.text('Ignored event type');
  }
});

export default app;
