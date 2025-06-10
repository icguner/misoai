import { describeUserPage } from '@/ai-model/prompt/util';
import { vlLocateMode } from 'misoai-shared/env';
import { getContextFromFixture } from 'tests/evaluation';
import { describe, expect, it, vi } from 'vitest';

// Mock vlLocateMode to return false during tests
vi.mock('misoai-shared/env', async () => {
  const actual = await vi.importActual('misoai-shared/env');
  return {
    ...actual,
    vlLocateMode: () => false,
  };
});

describe.skipIf(vlLocateMode())('prompt utils', () => {
  let lengthOfDescription: number;
  it('describe context ', async () => {
    const context = await getContextFromFixture('taobao');
    const { description } = await describeUserPage(context.context, {
      domIncluded: true,
      visibleOnly: false,
    });

    lengthOfDescription = description.length;
    const stringLengthOfEachItem =
      lengthOfDescription / context.context.content.length;
    expect(description).toBeTruthy();
    expect(stringLengthOfEachItem).toBeLessThan(250);
  });

  it('describe context, truncateTextLength = 100, filterNonTextContent = true', async () => {
    const context = await getContextFromFixture('taobao');

    const { description } = await describeUserPage(context.context, {
      truncateTextLength: 100,
      filterNonTextContent: true,
      domIncluded: true,
      visibleOnly: false,
    });

    const stringLengthOfEachItem =
      description.length / context.context.content.length;
    expect(description).toBeTruthy();
    expect(stringLengthOfEachItem).toBeLessThan(160);
    expect(description.length).toBeLessThan(lengthOfDescription * 0.8);
  });
});
