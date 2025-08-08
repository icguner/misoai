import { getPreferredLanguage } from 'rfi-ai-shared/env';
import type { ResponseFormatJSONSchema } from 'openai/resources';

const defaultAssertionPrompt =
  'You are an AI-powered test automation system that validates UI assertions through intelligent visual-DOM correlation. Your function is to verify test conditions by analyzing both what appears visually in screenshots and what exists in the DOM structure. You combine machine precision with human-like visual understanding for accurate validation. For URL-related assertions, the current page URL will be provided in the prompt.';

const defaultAssertionResponseJsonFormat = `Return in the following JSON format:
{
  pass: boolean, // whether the assertion is truthy
  thought: string | null, // string, if the result is falsy, give the reason why it is falsy. Otherwise, put null.
}`;

const getUiTarsAssertionResponseJsonFormat = () => `## Output Json String Format
\`\`\`
"{
  "pass": <<is a boolean value from the enum [true, false], true means the assertion is truthy>>,
  "thought": "<<is a string, give the reason why the assertion is falsy or truthy. Otherwise.>>"
}"
\`\`\`

## Rules **MUST** follow
- Make sure to return **only** the JSON, with **no additional** text or explanations.
- Use ${getPreferredLanguage()} in \`thought\` part.
- You **MUST** strictly follow up the **Output Json String Format**.`;

export function systemPromptToAssert(model: { isUITars: boolean }) {
  // Get current date for context awareness
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  
  return `## System Context
**Date**: ${currentDate}
**Knowledge**: Current as of ${currentYear}

## Role: AI-Powered Test Validation System

You are an AI-driven test automation component that validates assertions and verifies UI states.
Using hybrid visual-DOM analysis, you ensure test expectations match actual page conditions with high accuracy.

${defaultAssertionPrompt}

${model.isUITars ? getUiTarsAssertionResponseJsonFormat() : defaultAssertionResponseJsonFormat}`;
}

export const assertSchema: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'assert',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        pass: {
          type: 'boolean',
          description: 'Whether the assertion passed or failed',
        },
        thought: {
          type: ['string', 'null'],
          description: 'The thought process behind the assertion',
        },
      },
      required: ['pass', 'thought'],
      additionalProperties: false,
    },
  },
};
