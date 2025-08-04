import { PromptTemplate } from '@langchain/core/prompts';
import type { vlLocateMode } from 'rfi-ai-shared/env';
import { bboxDescription } from './common';

export function systemPromptToLocateSection(
  vlMode: ReturnType<typeof vlLocateMode>,
) {
  return `
You goal is to find out one section containing the target element in the screenshot, using systematic visual analysis combined with DOM structure information for precise boundary detection.

## Analysis Process:
Use the following chain of thought approach:

1. **Screen Structure Analysis**: Examine the overall layout and identify major sections
2. **DOM Structure Analysis**: Review the provided DOM structure information to understand element hierarchy and section boundaries
3. **Target Element Identification**: Locate the specific element mentioned by the user using both visual and DOM information
4. **Section Boundary Analysis**: Determine the optimal section size containing the target using both visual and DOM coordinate information
5. **Reference Elements Detection**: If mentioned, locate any reference elements using cross-referenced visual and DOM data
6. **Spatial Validation**: Ensure the section boundaries make logical sense and align with DOM structure

If the user describe the target element with some reference elements, you should also find the section containing the reference elements, put it in the \`references_bbox\` field.

Usually, it should be approximately an area not more than 300x300px. Changes of the size are allowed if there are many elements to cover.

return in this JSON format:
\`\`\`json
{
  "chain_of_thought": {
    "screen_structure": "Analysis of the overall layout and major sections",
    "target_identification": "Process of locating the target element",
    "section_analysis": "Reasoning for the chosen section boundaries", 
    "reference_detection": "How reference elements were found (if applicable)",
    "spatial_validation": "Verification that the section boundaries are logical"
  },
  "bbox": [number, number, number, number],
  "references_bbox"?: [
    [number, number, number, number],
    [number, number, number, number],
    ...
  ],
  "confidence": number,  // 0.0-1.0 confidence score
  "error"?: string
}
\`\`\`

In which, all the numbers in the \`bbox\` and \`references_bbox\` represent ${bboxDescription(vlMode)}.

For example, if the user describe the target element as "the delete button on the second row with title 'Peter'", you should put the bounding box of the delete button in the \`bbox\` field, and the bounding box of the second row in the \`references_bbox\` field.

the return value should be like this:
\`\`\`json
{
  "chain_of_thought": {
    "screen_structure": "The screenshot shows a data table with multiple rows and columns",
    "target_identification": "Located the delete button in the second row which contains 'Peter'",
    "section_analysis": "Selected a section that encompasses the entire second row to provide context",
    "reference_detection": "Found the row with title 'Peter' as the reference element",
    "spatial_validation": "The section boundaries include both the delete button and its context row"
  },
  "bbox": [100, 100, 200, 200],
  "references_bbox": [[100, 100, 200, 200]],
  "confidence": 0.9
}
\`\`\`
`;
}

export const sectionLocatorInstruction = new PromptTemplate({
  template: `Here is the target element user interested in:
<targetDescription>
{sectionDescription}
</targetDescription>
  `,
  inputVariables: ['sectionDescription'],
});
