import { AiAssert } from '@/ai-model';
import { getContextFromFixture } from 'tests/evaluation';
/* eslint-disable max-lines-per-function */
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({
  testTimeout: 180 * 1000,
  hookTimeout: 30 * 1000,
});

describe('assert', () => {
  it('todo pass', async () => {
    const { context } = await getContextFromFixture('todo');

    const {
      content: { pass },
    } = await AiAssert({
      assertion: 'Three tasks have been added',
      context,
    });
    expect(pass).toBe(true);
  });

  it('todo error', async () => {
    const { context } = await getContextFromFixture('todo');

    const {
      content: { pass, thought },
    } = await AiAssert({
      assertion: 'There are four tasks in the task list',
      context,
    });
    expect(pass).toBe(false);
  });

  it('includes URL in prompt for URL-related assertions', async () => {
    const { context } = await getContextFromFixture('todo');

    // Add a URL to the context for testing
    (context as any).url = 'https://example.com/test-page';

    // Mock the callAiFn function to capture the messages
    let capturedMessages: any;
    const originalCallAiFn = require('@/ai-model/common').callAiFn;
    require('@/ai-model/common').callAiFn = vi.fn(async (msgs, type) => {
      capturedMessages = msgs;
      return {
        content: { pass: true, thought: null },
        usage: {},
      };
    });

    await AiAssert({
      assertion: 'Is the page on example.com?',
      context,
    });

    // Verify that the URL is included in the prompt
    const userMessage = capturedMessages[1].content[1].text;
    expect(userMessage).toContain(
      'Current page URL: https://example.com/test-page',
    );

    // Restore the original function
    require('@/ai-model/common').callAiFn = originalCallAiFn;
  });
});
