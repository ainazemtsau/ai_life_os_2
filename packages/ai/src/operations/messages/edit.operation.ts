import type { SSEEvent } from '@ai-life-os/contracts';
import { branchWorkflow } from '../../workflows/branch.workflow';
import type { EditMessageInput } from './types';

export async function* editMessageOperation(input: EditMessageInput): AsyncGenerator<SSEEvent> {
  const { client, messageId, newContent, abortSignal } = input;

  yield* branchWorkflow({ client, originalMessageId: messageId, newContent, abortSignal });
}
