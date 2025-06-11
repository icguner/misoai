import { PromptTemplate } from '@langchain/core/prompts';
import type { ResponseFormatJSONSchema } from 'openai/resources';

export function systemPromptToExtract() {
  return `
You are a versatile professional in software UI design and testing. Your outstanding contributions will impact the user experience of billions of users.

The user will give you a screenshot, the contents of it (optional), and some data requirements in <DATA_DEMAND>. You need to extract the data according to the <DATA_DEMAND>.

If a key specifies a JSON data type (such as Number, String, Boolean, Object, Array), ensure the returned value strictly matches that data type.

Return in the following JSON format:
{
  data: any, // the extracted data. Make sure both the value and scheme meet the DATA_DEMAND. If you want to write some description in this field, use the same language as the DATA_DEMAND.
  errors: [], // string[], error message if any
  summary: string // Summarize what data was extracted in one sentence (e.g., "Extracted user profile information", "Found 5 todo items from the list", "Retrieved product details from the page")
}

# Example 1
For example, if the DATA_DEMAND is:

<DATA_DEMAND>
{
  "name": "name shows on the left panel, string",
  "age": "age shows on the right panel, number",
  "isAdmin": "if the user is admin, boolean"
}
</DATA_DEMAND>

By viewing the screenshot and page contents, you can extract the following data:

{
  data: {
    name: "John",
    age: 30,
    isAdmin: true
  },
  errors: [],
  summary: "Extracted user profile information including name, age, and admin status"
}

# Example 2
If the DATA_DEMAND is:

<DATA_DEMAND>
the todo items list, string[]
</DATA_DEMAND>

By viewing the screenshot and page contents, you can extract the following data:

{
  data: ["todo 1", "todo 2", "todo 3"],
  errors: [],
  summary: "Found 3 todo items from the list"
}

# Example 3
If the DATA_DEMAND is:

<DATA_DEMAND>
the page title, string
</DATA_DEMAND>

By viewing the screenshot and page contents, you can extract the following data:

{
  data: "todo list",
  errors: [],
  summary: "Retrieved page title from the header"
}

# Example 4
If the DATA_DEMAND is:

<DATA_DEMAND>
{
  "result": "Boolean, is it currently the SMS page?"
}
</DATA_DEMAND>

By viewing the screenshot and page contents, you can extract the following data:

{
  data: { result: true },
  errors: [],
  summary: "Verified that current page is the SMS page"
}
`;
}

export const extractDataQueryPrompt = async (
  pageDescription: string,
  dataQuery: string | Record<string, string>,
  memoryContext?: string, // YENİ: Hafıza bağlamı
) => {
  let dataQueryText = '';
  if (typeof dataQuery === 'string') {
    dataQueryText = dataQuery;
  } else {
    dataQueryText = JSON.stringify(dataQuery, null, 2);
  }
  const extractDataPrompt = new PromptTemplate({
    template: `
<PageDescription>
{pageDescription}
</PageDescription>

${
  memoryContext
    ? `
<PreviousWorkflowSteps>
${memoryContext}
</PreviousWorkflowSteps>

IMPORTANT INSTRUCTIONS:
- Consider the previous workflow steps when extracting data
- If the data request relates to actions completed in previous steps, factor that context into your response
- If previous steps involved form submissions, navigation, or data entry, use that context to better understand the current page state
- Extract data that builds upon or relates to the previous workflow actions
`
    : ''
}

<DATA_DEMAND>
{dataQuery}
</DATA_DEMAND>
  `,
    inputVariables: ['pageDescription', 'dataQuery'],
  });

  return await extractDataPrompt.format({
    pageDescription,
    dataQuery: dataQueryText,
  });
};

export const extractDataSchema: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'extract_data',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'The extracted data',
        },
        errors: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Error messages, if any',
        },
        summary: {
          type: 'string',
          description: 'A one-sentence summary of what data was extracted (e.g., "Extracted user profile information", "Found 5 todo items from the list", "Retrieved product details from the page")',
        },
      },
      required: ['data', 'errors', 'summary'],
      additionalProperties: false,
    },
  },
};
