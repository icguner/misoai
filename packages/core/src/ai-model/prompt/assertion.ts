import { getPreferredLanguage } from 'misoai-shared/env';
import type { ResponseFormatJSONSchema } from 'openai/resources';

const defaultAssertionPrompt =
  'You are a senior testing engineer. User will give an assertion and a screenshot of a page. By carefully viewing the screenshot, please tell whether the assertion is truthy. For URL-related assertions, the current page URL will be provided in the prompt.';

const defaultAssertionResponseJsonFormat = `Return in the following JSON format:
{
  pass: boolean, // whether the assertion is truthy
  thought: string | null, // string, if the result is falsy, give the reason why it is falsy. Otherwise, put null.
  summary: string // Summarize what this assertion checked in one sentence (e.g., "Verified login button is visible", "Checked that form was submitted successfully")
}`;

const getUiTarsAssertionResponseJsonFormat = () => `## Output Json String Format
\`\`\`
"{
  "pass": <<is a boolean value from the enum [true, false], true means the assertion is truthy>>,
  "thought": "<<is a string, give the reason why the assertion is falsy or truthy. Otherwise.>>",
  "summary": "<<is a string, summarize what this assertion checked in one sentence (e.g., 'Verified login button is visible', 'Checked that form was submitted successfully')>>"
}"
\`\`\`

## Rules **MUST** follow
- Make sure to return **only** the JSON, with **no additional** text or explanations.
- Use ${getPreferredLanguage()} in \`thought\` part.
- You **MUST** strictly follow up the **Output Json String Format**.`;

export function systemPromptToAssert(model: { isUITars: boolean }) {
  return `${defaultAssertionPrompt}

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
        summary: {
          type: 'string',
          description: 'A one-sentence summary of what this assertion checked (e.g., "Verified login button is visible", "Checked that form was submitted successfully")',
        },
      },
      required: ['pass', 'thought', 'summary'],
      additionalProperties: false,
    },
  },
};
