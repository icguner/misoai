import type {
  AIAssertionResponse,
  AICaptchaResponse,
  AIDataExtractionResponse,
  AIElementLocatorResponse,
  AIElementResponse,
  AISectionLocatorResponse,
  AIUsageInfo,
  BaseElement,
  ElementById,
  InsightExtractOption,
  Rect,
  ReferenceImage,
  UIContext,
} from '@/types';
import {
  MIDSCENE_FORCE_DEEP_THINK,
  MIDSCENE_USE_QWEN_VL,
  MIDSCENE_USE_VLM_UI_TARS,
  getAIConfigInBoolean,
  vlLocateMode,
} from 'misoai-shared/env';
import { cropByRect, paddingToMatchBlockByBase64 } from 'misoai-shared/img';
import { getDebug } from 'misoai-shared/logger';
import { assert } from 'misoai-shared/utils';
import type {
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources';
import {
  AIActionType,
  adaptBboxToRect,
  callAiFn,
  expandSearchArea,
  markupImageForLLM,
  mergeRects,
} from './common';
import { systemPromptToAssert } from './prompt/assertion';
import {
  extractDataQueryPrompt,
  systemPromptToExtract,
} from './prompt/extraction';
import {
  findElementPrompt,
  systemPromptToLocateElement,
} from './prompt/llm-locator';
import {
  sectionLocatorInstruction,
  systemPromptToLocateSection,
} from './prompt/llm-section-locator';
import {
  describeUserPage,
  distance,
  distanceThreshold,
  elementByPositionWithElementInfo,
} from './prompt/util';
import { callToGetJSONObject } from './service-caller/index';

export type AIArgs = [
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
];

const debugInspect = getDebug('ai:inspect');
const debugSection = getDebug('ai:section');

export async function AiLocateElement<
  ElementType extends BaseElement = BaseElement,
>(options: {
  context: UIContext<ElementType>;
  targetElementDescription: string;
  referenceImage?: ReferenceImage;
  callAI?: typeof callAiFn<AIElementResponse | [number, number]>;
  searchConfig?: Awaited<ReturnType<typeof AiLocateSection>>;
}): Promise<{
  parseResult: AIElementLocatorResponse;
  rect?: Rect;
  rawResponse: string;
  elementById: ElementById;
  usage?: AIUsageInfo;
}> {
  const { context, targetElementDescription, callAI } = options;
  const { screenshotBase64 } = context;
  const { description, elementById, insertElementByPosition } =
    await describeUserPage(context);

  assert(
    targetElementDescription,
    'cannot find the target element description',
  );

  const userInstructionPrompt = await findElementPrompt.format({
    pageDescription: description,
    targetElementDescription,
  });
  const systemPrompt = systemPromptToLocateElement(vlLocateMode());

  let imagePayload = screenshotBase64;

  if (options.searchConfig) {
    assert(
      options.searchConfig.rect,
      'searchArea is provided but its rect cannot be found. Failed to locate element',
    );
    assert(
      options.searchConfig.imageBase64,
      'searchArea is provided but its imageBase64 cannot be found. Failed to locate element',
    );

    imagePayload = options.searchConfig.imageBase64;
  } else if (vlLocateMode() === 'qwen-vl') {
    imagePayload = await paddingToMatchBlockByBase64(imagePayload);
  } else if (!vlLocateMode()) {
    imagePayload = await markupImageForLLM(
      screenshotBase64,
      context.tree,
      context.size,
    );
  }

  let referenceImagePayload: string | undefined;
  if (options.referenceImage?.rect && options.referenceImage.base64) {
    referenceImagePayload = await cropByRect(
      options.referenceImage.base64,
      options.referenceImage.rect,
      getAIConfigInBoolean(MIDSCENE_USE_QWEN_VL),
    );
  }

  const msgs: AIArgs = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: imagePayload,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: userInstructionPrompt,
        },
      ],
    },
  ];

  const callAIFn =
    callAI || callToGetJSONObject<AIElementResponse | [number, number]>;

  const res = await callAIFn(msgs, AIActionType.INSPECT_ELEMENT);

  const rawResponse = JSON.stringify(res.content);

  let resRect: Rect | undefined;
  let matchedElements: AIElementLocatorResponse['elements'] =
    'elements' in res.content ? res.content.elements : [];
  let errors: AIElementLocatorResponse['errors'] | undefined =
    'errors' in res.content ? res.content.errors : [];
  try {
    if ('bbox' in res.content && Array.isArray(res.content.bbox)) {
      resRect = adaptBboxToRect(
        res.content.bbox,
        options.searchConfig?.rect?.width || context.size.width,
        options.searchConfig?.rect?.height || context.size.height,
        options.searchConfig?.rect?.left,
        options.searchConfig?.rect?.top,
      );
      debugInspect('resRect', resRect);

      const rectCenter = {
        x: resRect.left + resRect.width / 2,
        y: resRect.top + resRect.height / 2,
      };
      let element = elementByPositionWithElementInfo(context.tree, rectCenter);

      const distanceToCenter = element
        ? distance({ x: element.center[0], y: element.center[1] }, rectCenter)
        : 0;

      if (!element || distanceToCenter > distanceThreshold) {
        element = insertElementByPosition(rectCenter);
      }

      if (element) {
        matchedElements = [element];
        errors = [];
      }
    }
  } catch (e) {
    const msg =
      e instanceof Error
        ? `Failed to parse bbox: ${e.message}`
        : 'unknown error in locate';
    if (!errors || errors?.length === 0) {
      errors = [msg];
    } else {
      errors.push(`(${msg})`);
    }
  }

  return {
    rect: resRect,
    parseResult: {
      elements: matchedElements,
      errors,
    },
    rawResponse,
    elementById,
    usage: res.usage,
  };
}

export async function AiLocateSection(options: {
  context: UIContext<BaseElement>;
  sectionDescription: string;
  callAI?: typeof callAiFn<AISectionLocatorResponse>;
}): Promise<{
  rect?: Rect;
  imageBase64?: string;
  error?: string;
  rawResponse: string;
  usage?: AIUsageInfo;
}> {
  const { context, sectionDescription } = options;
  const { screenshotBase64 } = context;

  const systemPrompt = systemPromptToLocateSection(vlLocateMode());
  const sectionLocatorInstructionText = await sectionLocatorInstruction.format({
    sectionDescription,
  });
  const msgs: AIArgs = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: screenshotBase64,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: sectionLocatorInstructionText,
        },
      ],
    },
  ];

  const result = await callAiFn<AISectionLocatorResponse>(
    msgs,
    AIActionType.EXTRACT_DATA,
  );

  let sectionRect: Rect | undefined;
  const sectionBbox = result.content.bbox;
  if (sectionBbox) {
    const targetRect = adaptBboxToRect(
      sectionBbox,
      context.size.width,
      context.size.height,
    );
    debugSection('original targetRect %j', targetRect);

    const referenceBboxList = result.content.references_bbox || [];
    debugSection('referenceBboxList %j', referenceBboxList);

    const referenceRects = referenceBboxList
      .filter((bbox) => Array.isArray(bbox))
      .map((bbox) => {
        return adaptBboxToRect(bbox, context.size.width, context.size.height);
      });
    debugSection('referenceRects %j', referenceRects);

    // merge the sectionRect and referenceRects
    const mergedRect = mergeRects([targetRect, ...referenceRects]);
    debugSection('mergedRect %j', mergedRect);

    // expand search area to at least 200 x 200
    sectionRect = expandSearchArea(mergedRect, context.size);
    debugSection('expanded sectionRect %j', sectionRect);
  }

  let imageBase64 = screenshotBase64;
  if (sectionRect) {
    imageBase64 = await cropByRect(
      screenshotBase64,
      sectionRect,
      getAIConfigInBoolean(MIDSCENE_USE_QWEN_VL),
    );
  }

  return {
    rect: sectionRect,
    imageBase64,
    error: result.content.error,
    rawResponse: JSON.stringify(result.content),
    usage: result.usage,
  };
}

export async function AiExtractElementInfo<
  T,
  ElementType extends BaseElement = BaseElement,
>(options: {
  dataQuery: string | Record<string, string>;
  context: UIContext<ElementType>;
  extractOption?: InsightExtractOption;
  memoryContext?: string; // YENİ: Hafıza bağlamı
}) {
  const { dataQuery, context, extractOption, memoryContext } = options;
  const systemPrompt = systemPromptToExtract();

  const { screenshotBase64 } = context;
  const { description, elementById } = await describeUserPage(context, {
    truncateTextLength: 200,
    filterNonTextContent: false,
    visibleOnly: false,
    domIncluded: extractOption?.domIncluded,
  });

  const extractDataPromptText = await extractDataQueryPrompt(
    description,
    dataQuery,
    memoryContext,
  );

  const userContent: ChatCompletionUserMessageParam['content'] = [];

  if (extractOption?.screenshotIncluded !== false) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: screenshotBase64,
        detail: 'high',
      },
    });
  }

  userContent.push({
    type: 'text',
    text: extractDataPromptText,
  });

  const msgs: AIArgs = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: userContent,
    },
  ];

  const result = await callAiFn<AIDataExtractionResponse<T>>(
    msgs,
    AIActionType.EXTRACT_DATA,
  );
  return {
    parseResult: result.content,
    elementById,
    usage: result.usage,
  };
}

export async function AiAssert<
  ElementType extends BaseElement = BaseElement,
>(options: {
  assertion: string;
  context: UIContext<ElementType>;
  memoryContext?: string; // YENİ: Hafıza bağlamı
}) {
  const { assertion, context, memoryContext } = options;

  assert(assertion, 'assertion should be a string');

  const { screenshotBase64 } = context;

  // Get the URL from the context if available (WebUIContext has a url property)
  const url = (context as any).url || '';

  const systemPrompt = systemPromptToAssert({
    isUITars: getAIConfigInBoolean(MIDSCENE_USE_VLM_UI_TARS),
  });

  const msgs: AIArgs = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: screenshotBase64,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: `
Here is the assertion. Please tell whether it is truthy according to the screenshot.
${url ? `Current page URL: ${url}` : ''}

${
  memoryContext
    ? `
IMPORTANT: Previous workflow steps have been completed:
${memoryContext}

Please consider these previous actions when evaluating the assertion. The assertion should be evaluated in the context of the entire workflow, not just the current screenshot. If the assertion refers to actions that were completed in previous steps, take that into account.
`
    : ''
}

=====================================
ASSERTION TO EVALUATE:
${assertion}
=====================================
  `,
        },
      ],
    },
  ];

  const { content: assertResult, usage } = await callAiFn<AIAssertionResponse>(
    msgs,
    AIActionType.ASSERT,
  );
  return {
    content: assertResult,
    usage,
  };
}

export async function AiCaptcha<
  ElementType extends BaseElement = BaseElement,
>(options: { context: UIContext<ElementType>; deepThink?: boolean }) {
  const { context, deepThink = false } = options;
  const { screenshotBase64, size } = context;

  // Get the URL from the context if available (WebUIContext has a url property)
  const url = (context as any).url || '';

  // Check for global deep think setting
  const globalDeepThinkSwitch = getAIConfigInBoolean(MIDSCENE_FORCE_DEEP_THINK);
  const shouldUseDeepThink = deepThink || globalDeepThinkSwitch;

  const systemPrompt = `
You are an AI assistant specialized in solving CAPTCHAs. Your task is to:
1. Analyze the screenshot to identify the type of CAPTCHA present
2. Determine the solution or required actions to complete the CAPTCHA
3. Provide a detailed plan for solving the CAPTCHA

For text-based CAPTCHAs:
- Identify the text in the CAPTCHA image
- Determine where to input the text
- Provide the text solution

For image-based CAPTCHAs:
- Identify what elements need to be clicked
- Provide coordinates or descriptions of where to click
- Determine the sequence of clicks if needed

Return your response in the following JSON format:
{
  "captchaType": "text" | "image" | "unknown",
  "solution": "The solution text or description of required actions",
  "thought": "Your reasoning process for identifying and solving the CAPTCHA",
  "actions": [
    {
      "type": "click" | "input" | "verify",
      "target": "Description of the target element",
      "value": "Text to input (for input actions)",
      "coordinates": [x, y] // Coordinates for click actions
    }
  ]
}

Be precise and thorough in your analysis. The goal is to successfully complete the CAPTCHA challenge.
${shouldUseDeepThink ? 'Take your time to carefully analyze the CAPTCHA. Pay close attention to details and ensure your solution is accurate.' : ''}
`;

  // Process the image based on deepThink setting
  let imagePayload = screenshotBase64;

  if (shouldUseDeepThink && vlLocateMode()) {
    // For deep thinking, we want to focus on the CAPTCHA area
    // First, try to identify the CAPTCHA area using a preliminary analysis
    const preliminarySystemPrompt = `
You are an AI assistant that helps identify CAPTCHA elements in screenshots.
Your task is to locate the CAPTCHA area in the screenshot.
Provide the coordinates of the CAPTCHA area as [x1, y1, x2, y2] where:
- x1, y1 are the top-left coordinates
- x2, y2 are the bottom-right coordinates
`;

    const preliminaryMsgs: AIArgs = [
      { role: 'system', content: preliminarySystemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: screenshotBase64,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: 'Locate the CAPTCHA area in this screenshot. Return only the coordinates as [x1, y1, x2, y2].',
          },
        ],
      },
    ];

    try {
      // Try to get CAPTCHA area coordinates
      const preliminaryResult = await callAiFn<{
        coordinates: [number, number, number, number];
      }>(preliminaryMsgs, AIActionType.INSPECT_ELEMENT);

      if (preliminaryResult.content?.coordinates) {
        const [x1, y1, x2, y2] = preliminaryResult.content.coordinates;
        const captchaRect: Rect = {
          left: x1,
          top: y1,
          width: x2 - x1,
          height: y2 - y1,
        };

        // Expand the area slightly to ensure we capture the full CAPTCHA
        const searchArea = expandSearchArea(captchaRect, size);
        imagePayload = await cropByRect(
          screenshotBase64,
          searchArea,
          getAIConfigInBoolean(MIDSCENE_USE_QWEN_VL),
        );
      }
    } catch (error) {
      // If preliminary analysis fails, use the full screenshot
      console.warn(
        'Failed to identify CAPTCHA area for deep thinking, using full screenshot',
        error,
      );
    }
  }

  const msgs: AIArgs = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: imagePayload,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: `
Please analyze this CAPTCHA and provide a solution.
${url ? `Current page URL: ${url}` : ''}
${shouldUseDeepThink ? 'Use deep thinking to carefully analyze this CAPTCHA.' : ''}
`,
        },
      ],
    },
  ];

  const { content: captchaResult, usage } = await callAiFn<AICaptchaResponse>(
    msgs,
    AIActionType.CAPTCHA,
  );

  // Add deepThink information to the result
  return {
    content: captchaResult,
    usage,
    deepThink: shouldUseDeepThink,
  };
}
