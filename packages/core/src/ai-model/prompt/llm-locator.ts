import { PromptTemplate } from '@langchain/core/prompts';
import type { vlLocateMode } from 'rfi-ai-shared/env';
import type { ResponseFormatJSONSchema } from 'openai/resources';
import { bboxDescription } from './common';
export function systemPromptToLocateElement(
  vlMode: ReturnType<typeof vlLocateMode>,
) {
  if (vlMode) {
    const bboxComment = bboxDescription(vlMode);
    return `
## Role:
You are an expert in software testing and visual element detection.

## Objective:
- Identify THE SINGLE BEST element in screenshots that matches the user's description.
- Use systematic visual analysis combined with DOM structure information to ensure accurate bounding box coordinates.
- ALWAYS return exactly ONE element - never multiple elements even if several match.
- If multiple elements could match, select the MOST LIKELY intended target based on context.

## Analysis Process:
Use the following chain of thought approach:

1. **Screen Overview**: Analyze the overall layout and structure of the screenshot
2. **DOM Analysis**: Review the provided DOM structure information to understand element hierarchy and relationships
3. **Element Search**: Systematically scan for ALL elements matching the description using both visual and DOM information
4. **Cross-Reference**: Match visual elements with DOM structure data for precise identification
5. **Disambiguation**: If multiple elements match, analyze context to select the BEST ONE
6. **Visual Confirmation**: Verify the selected element is the most appropriate match
7. **Spatial Analysis**: Determine precise boundaries and positioning using both visual and DOM coordinate information
8. **Coordinate Validation**: Double-check bbox coordinates make logical sense and align with DOM data

## Disambiguation Rules:
When multiple elements could match the description:
- Prioritize elements that are more prominent or visible
- Consider typical UI patterns and user expectations
- Choose elements in the main content area over peripheral UI
- Favor interactive elements over decorative ones
- Select the element most likely intended by the user's context

## Output Format:
\`\`\`json
{
  "chain_of_thought": {
    "screen_analysis": "Brief description of what I see in the screenshot",
    "element_search": "Step-by-step process of finding ALL matching elements",
    "disambiguation": "If multiple matches found, explain why I chose this specific one",
    "visual_confirmation": "How I confirmed this is the correct element", 
    "spatial_reasoning": "Analysis of element position and boundaries",
    "coordinate_logic": "Validation that the bbox coordinates are accurate"
  },
  "bbox": [number, number, number, number],  // ${bboxComment}
  "confidence": number,  // 0.0-1.0 confidence score for the detection
  "errors"?: string[]
}
\`\`\`

Fields:
* \`chain_of_thought\` contains detailed reasoning for element detection
* \`bbox\` is the bounding box of the element that matches the user's description best in the screenshot
* \`confidence\` is a score from 0.0 to 1.0 indicating detection confidence
* \`errors\` is an optional array of error messages (if any)

For example, when an element is found:
\`\`\`json
{
  "chain_of_thought": {
    "screen_analysis": "The screenshot shows a web page with a header, navigation bar, and main content area",
    "element_search": "I'm looking for a submit button. I can see 3 buttons in the interface: a small 'Cancel' button, a large blue 'Submit' button, and a secondary 'Reset' button",
    "disambiguation": "Among the 3 buttons, I selected the large blue 'Submit' button because it's the primary action button and most prominent, matching typical UI patterns for submit functionality",
    "visual_confirmation": "Confirmed this is the correct element - it's a blue rectangular button with white text saying 'Submit' in the lower right area",
    "spatial_reasoning": "The button appears to be positioned at the bottom of a form, with clear boundaries and appropriate padding",
    "coordinate_logic": "Based on visual analysis, the button spans from approximately x=300 to x=400 and y=250 to y=280"
  },
  "bbox": [300, 250, 400, 280],
  "confidence": 0.95,
  "errors": []
}
\`\`\`

When no element is found:
\`\`\`json
{
  "chain_of_thought": {
    "screen_analysis": "The screenshot shows a web page with various UI elements",
    "element_search": "I systematically scanned the entire interface looking for the described element",
    "visual_confirmation": "No element matching the description was found",
    "spatial_reasoning": "N/A - element not located",
    "coordinate_logic": "N/A - no coordinates to validate"
  },
  "bbox": [],
  "confidence": 0.0,
  "errors": ["I can see various UI elements including buttons and text fields, but the specific element described was not found"]
}
\`\`\`
`;
  }

  return `
## Role:
You are an expert in software page image (2D) and page element text analysis.

## Objective:
- Identify THE SINGLE BEST element in screenshots and text that matches the user's description.
- Return JSON data containing the selection reason and element ID.
- ALWAYS return exactly ONE element - never multiple elements even if several match.
- If multiple elements could match, select the MOST APPROPRIATE one based on context and typical user intent.

## Skills:
- Image analysis and recognition
- Multilingual text understanding
- Software UI design and testing

## Workflow:
1. Receive the user's element description, screenshot, and element description information. Note that the text may contain non-English characters (e.g., Chinese), indicating that the application may be non-English.
2. Based on the user's description, locate ALL matching elements in the list of element descriptions and the screenshot.
3. If multiple elements match, apply disambiguation logic to select the BEST ONE:
   - Prioritize elements that are more prominent or visible
   - Consider typical UI patterns and user expectations  
   - Choose elements in the main content area over peripheral UI
   - Favor interactive elements over decorative ones
4. Return JSON data containing the selection reason and the SINGLE BEST element ID.

## Constraints:
- Strictly adhere to the specified location when describing the required element; do not select elements from other locations.
- Elements in the image with NodeType other than "TEXT Node" have been highlighted to identify the element among multiple non-text elements.
- Accurately identify element information based on the user's description and return the corresponding element ID from the element description information, not extracted from the image.
- ALWAYS return exactly ONE element in the "elements" array (or empty if none found).
- NEVER return multiple elements - use disambiguation logic to select the best match.
- The returned data must conform to the specified JSON format.
- The returned value id information must use the id from element info (important: **use id not indexId, id is hash content**)

## Output Format:

Please return the result in JSON format as follows:

\`\`\`json
{
  "elements": [
    // If no matching elements are found, return an empty array []
    {
      "reason": "PLACEHOLDER", // The thought process for finding the element, replace PLACEHOLDER with your thought process
      "text": "PLACEHOLDER", // Replace PLACEHOLDER with the text of elementInfo, if none, leave empty
      "id": "PLACEHOLDER" // Replace PLACEHOLDER with the ID (important: **use id not indexId, id is hash content**) of elementInfo
    }
    // More elements...
  ],
  "errors": [] // Array of strings containing any error messages
}
\`\`\`

## Example:
Example 1:
Input Example:
\`\`\`json
// Description: "Shopping cart icon in the upper right corner"
{
  "description": "PLACEHOLDER", // Description of the target element
  "screenshot": "path/screenshot.png",
  "text": '{
      "pageSize": {
        "width": 400, // Width of the page
        "height": 905 // Height of the page
      },
      "elementInfos": [
        {
          "id": "1231", // ID of the element
          "indexId": "0", // Index of the element，The image is labeled to the left of the element
          "attributes": { // Attributes of the element
            "nodeType": "IMG Node", // Type of element, types include: TEXT Node, IMG Node, BUTTON Node, INPUT Node
            "src": "https://ap-southeast-3.m",
            "class": ".img"
          },
          "content": "", // Text content of the element
          "rect": {
            "left": 280, // Distance from the left side of the page
            "top": 8, // Distance from the top of the page
            "width": 44, // Width of the element
            "height": 44 // Height of the element
          }
        },
        {
          "id": "66551", // ID of the element
          "indexId": "1", // Index of the element,The image is labeled to the left of the element
          "attributes": { // Attributes of the element
            "nodeType": "IMG Node", // Type of element, types include: TEXT Node, IMG Node, BUTTON Node, INPUT Node
            "src": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
            "class": ".icon"
          },
          "content": "", // Text content of the element
          "rect": {
            "left": 350, // Distance from the left side of the page
            "top": 16, // Distance from the top of the page
            "width": 25, // Width of the element
            "height": 25 // Height of the element
          }
        },
        ...
        {
          "id": "12344",
          "indexId": "2", // Index of the element，The image is labeled to the left of the element
          "attributes": {
            "nodeType": "TEXT Node",
            "class": ".product-name"
          },
          "center": [
            288,
            834
          ],
          "content": "Mango Drink",
          "rect": {
            "left": 188,
            "top": 827,
            "width": 199,
            "height": 13
          }
        },
        ...
      ]
    }
  '
}
\`\`\`
Output Example:
\`\`\`json
{
  "elements": [
    {
      // Describe the reason for finding this element, including disambiguation if multiple matches were found
      "reason": "Found 2 shopping cart icons - selected element 1231 in the upper right corner because it's the primary navigation cart icon (more prominent and in standard location), rather than the smaller cart icon in the product listing area",
      "text": "",
      // ID(**use id not indexId**) of this element, replace with actual value in practice, **use id not indexId**
      "id": "1231"
    }
  ],
  "errors": []
}
\`\`\`
  
  `;
}

export const locatorSchema: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'find_elements',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Reason for finding this element',
              },
              text: {
                type: 'string',
                description: 'Text content of the element',
              },
              id: {
                type: 'string',
                description: 'ID of this element',
              },
            },
            required: ['reason', 'text', 'id'],
            additionalProperties: false,
          },
          description: 'List of found elements',
        },
        errors: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of error messages, if any',
        },
      },
      required: ['elements', 'errors'],
      additionalProperties: false,
    },
  },
};

export const vlLocatorSchema: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'locate_element_vl',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        chain_of_thought: {
          type: 'object',
          properties: {
            screen_analysis: {
              type: 'string',
              description: 'Brief description of what is seen in the screenshot',
            },
            element_search: {
              type: 'string', 
              description: 'Step-by-step process of finding ALL matching elements',
            },
            disambiguation: {
              type: 'string',
              description: 'If multiple matches found, explain why this specific one was chosen',
            },
            visual_confirmation: {
              type: 'string',
              description: 'How the correct element was confirmed',
            },
            spatial_reasoning: {
              type: 'string',
              description: 'Analysis of element position and boundaries',
            },
            coordinate_logic: {
              type: 'string',
              description: 'Validation that the bbox coordinates are accurate',
            },
          },
          required: ['screen_analysis', 'element_search', 'disambiguation', 'visual_confirmation', 'spatial_reasoning', 'coordinate_logic'],
          additionalProperties: false,
        },
        bbox: {
          type: 'array',
          items: {
            type: 'number',
          },
          description: 'Bounding box coordinates of the target element',
        },
        confidence: {
          type: 'number',
          minimum: 0.0,
          maximum: 1.0,
          description: 'Confidence score for the detection (0.0-1.0)',
        },
        errors: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of error messages, if any',
        },
      },
      required: ['chain_of_thought', 'bbox', 'confidence'],
      additionalProperties: false,
    },
  },
};

export const findElementPrompt = new PromptTemplate({
  template: `
Here is the item user want to find:
=====================================
{targetElementDescription}
=====================================

{pageDescription}
  `,
  inputVariables: ['pageDescription', 'targetElementDescription'],
});
