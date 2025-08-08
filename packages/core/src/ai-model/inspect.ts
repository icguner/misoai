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
  RAFI_USE_QWEN_VL,
  RAFI_USE_VLM_UI_TARS,
  RAFI_FORCE_DEEP_THINK,
  getAIConfigInBoolean,
  vlLocateMode,
} from 'rfi-ai-shared/env';
import { cropByRect, paddingToMatchBlockByBase64 } from 'rfi-ai-shared/img';
import { getDebug } from 'rfi-ai-shared/logger';
import { assert } from 'rfi-ai-shared/utils';
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
  unifiedLocatorSchema,
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

  // Enhanced context for better dropdown handling
  const enhancedDescription = targetElementDescription.toLowerCase().includes('option') || 
    targetElementDescription.toLowerCase().includes('dropdown') || 
    targetElementDescription.toLowerCase().includes('select') ?
    `IMPORTANT: This is likely a dropdown/autocomplete selection. Look for dropdown items, NOT input fields. ${targetElementDescription}` :
    targetElementDescription;

  const userInstructionPrompt = await findElementPrompt.format({
    pageDescription: description,
    targetElementDescription: enhancedDescription,
  });
  // UNIFIED SYSTEM: All models use the same hybrid approach with enhanced CoT
  const systemPrompt = systemPromptToLocateElement();

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
  } else {
    // UNIFIED IMAGE PROCESSING: Apply appropriate preprocessing based on model capabilities
    const currentModel = vlLocateMode();
    if (currentModel === 'qwen-vl') {
      // Qwen-VL specific preprocessing
      imagePayload = await paddingToMatchBlockByBase64(imagePayload);
    } else if (!currentModel) {
      // Non-VL models: Add element markers to screenshot
      imagePayload = await markupImageForLLM(
        screenshotBase64,
        context.tree,
        context.size,
      );
    }
    // VL models (except qwen-vl) use raw screenshot
  }

  let referenceImagePayload: string | undefined;
  if (options.referenceImage?.rect && options.referenceImage.base64) {
    referenceImagePayload = await cropByRect(
      options.referenceImage.base64,
      options.referenceImage.rect,
      getAIConfigInBoolean(RAFI_USE_QWEN_VL),
    );
  }

  // Prepare user content array - send image to ALL models, handle errors gracefully
  const userContent: ChatCompletionUserMessageParam['content'] = [
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
  ];

  // UNIFIED HYBRID MODE: ALL models now receive DOM structure for hybrid analysis
  // This ensures consistent behavior regardless of model type (VL or non-VL)
  
  // Ensure DOM structure is available for all models
  if (!description || description.length === 0) {
    console.warn(`[UNIFIED-DOM] WARNING: DOM structure is empty - hybrid mode may not work correctly`);
    console.warn(`[UNIFIED-DOM] All models require DOM structure for optimal element location`);
  }
  
  // Check if description is in Emmetify format
  const isEmmetFormat = description.includes('Page:') && description.includes('DOM:');
  
  let domInfo: string;
  if (isEmmetFormat) {
    // Emmetify format - optimized for all models
    domInfo = `\n\n## Compact DOM Structure (Emmetify Format):\n${description}\n\nElements use format: tag#id.class[attributes]{text}\nKey attributes: rect=left,top,width,height for coordinates, mid=X for markerId, data-testid for test automation\nGenerate reliable Puppeteer selectors from this DOM structure.`;
  } else {
    // Traditional format - enhanced for unified approach
    domInfo = `\n\n## DOM Structure Information for Hybrid Analysis:\n${description}\n\nIMPORTANT: Combine visual screenshot analysis with DOM structure data for accurate element location. Generate Puppeteer-compatible selectors as primary output.`;
  }
  
  userContent.push({
    type: 'text',
    text: domInfo,
  });
  
  // Log unified hybrid mode information
  const modelType = vlLocateMode() ? `${vlLocateMode()} (VL)` : 'Non-VL';
  console.error(`[UNIFIED-HYBRID] Active for ${modelType} model - DOM + Screenshot analysis`);
  console.error(`[UNIFIED-HYBRID] DOM format: ${isEmmetFormat ? 'Emmetify (compact)' : 'Traditional'}`);
  console.error(`[UNIFIED-HYBRID] DOM content length: ${description.length} characters`);
  console.error(`[UNIFIED-HYBRID] Expected output: Chain of thought + Puppeteer selectors`);
  
  // Log DOM content
  if (description.length > 0) {
    console.error(`[UNIFIED-HYBRID] DOM preview: ${description.substring(0, 200)}...`);
    
    // Full DOM logging controlled by environment variable
    const debugDom = process.env.RAFI_DEBUG_DOM === 'true' || process.env.DEBUG_EMMETIFY === 'true';
    
    if (debugDom) {
      console.error(`\n[EMMETIFY-DOM-START] ========== FULL DOM SENT TO LLM ==========`);
      
      // Log page info if available
      const pageMatch = description.match(/Page: (\d+) x (\d+)/);
      if (pageMatch) {
        console.error(`[EMMETIFY-DOM-INFO] Page dimensions: ${pageMatch[1]} x ${pageMatch[2]}`);
      }
      
      // Split into chunks of 500 chars for readability
      const chunkSize = 500;
      const domContent = description.replace(/Page: \d+ x \d+\s*DOM: /, ''); // Remove page info from DOM
      
      for (let i = 0; i < domContent.length; i += chunkSize) {
        const chunk = domContent.substring(i, Math.min(i + chunkSize, domContent.length));
        console.error(`[EMMETIFY-DOM-CHUNK-${Math.floor(i/chunkSize) + 1}] ${chunk}`);
      }
      
      // Log stats
      const elementCount = (domContent.match(/[>+]/g) || []).length;
      console.error(`[EMMETIFY-DOM-STATS] Approximate elements: ${elementCount}`);
      console.error(`[EMMETIFY-DOM-END] ========== END OF DOM (${description.length} chars) ==========\n`);
    } else {
      console.error(`[UNIFIED-HYBRID] Use RAFI_DEBUG_DOM=true to see full DOM content`);
    }
  } else {
    console.error(`[UNIFIED-HYBRID-ERROR] ERROR: No DOM structure available for analysis!`);
  }

  const msgs: AIArgs = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: userContent,
    },
  ];

  const callAIFn =
    callAI || callToGetJSONObject<AIElementResponse | [number, number]>;

  // Use unified schema for consistent response format across all models
  const res = await callAIFn(msgs, AIActionType.INSPECT_ELEMENT);

  const rawResponse = JSON.stringify(res.content);

  let resRect: Rect | undefined;
  let matchedElements: AIElementLocatorResponse['elements'] =
    'elements' in res.content ? res.content.elements : [];
  let errors: AIElementLocatorResponse['errors'] | undefined =
    'errors' in res.content ? res.content.errors : [];
    
  // UNIFIED RESPONSE HANDLING: Same processing for all models
  if ('chain_of_thought' in res.content) {
    const modelType = vlLocateMode() ? `VL-${vlLocateMode()}` : 'Non-VL';
    debugInspect(`[UNIFIED] ${modelType} Chain of Thought Analysis:`, res.content.chain_of_thought);
    
    // All models now provide detailed reasoning
    console.error(`[UNIFIED-REASONING] Model: ${modelType}`);
    const chainOfThought = res.content.chain_of_thought as any;
    console.error(`[UNIFIED-REASONING] Screenshot analysis completed: ${chainOfThought?.screenshot_analysis ? 'YES' : 'NO'}`);
    console.error(`[UNIFIED-REASONING] DOM analysis completed: ${chainOfThought?.dom_analysis ? 'YES' : 'NO'}`);
    console.error(`[UNIFIED-REASONING] Selector generated: ${chainOfThought?.selector_generation ? 'YES' : 'NO'}`);
  }

  // SIMPLE XPATH PROCESSING: All models return elements with xpath field  
  if (matchedElements && matchedElements.length > 0) {
    matchedElements = matchedElements.map(element => {
      // AI model returns xpath field - use it directly
      const puppeteerXpath = (element as any).xpath;
      
      if (!puppeteerXpath) {
        console.warn(`[XPATH] Element missing XPath - will need fallback`);
      } else {
        console.error(`[XPATH] Element has xpath: ${puppeteerXpath}`);
      }
      
      return {
        ...element,
        // Store xpath in xpaths array for compatibility
        xpaths: puppeteerXpath ? [puppeteerXpath] : element.xpaths || [],
        reason: (element as any).reason || 'Element located via AI xpath'
      };
    });
    
    console.error(`[XPATH] Processed ${matchedElements.length} element(s) with xpaths`);
  }
    
  try {
    // Handle legacy bbox format for VL models (backward compatibility)
    if ('bbox' in res.content && Array.isArray(res.content.bbox) && res.content.bbox.length > 0) {
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
        // Convert bbox-based element to unified format
        const unifiedElement = {
          ...element,
          reason: 'Element located via bbox coordinates (legacy VL mode)',
          xpaths: element.xpaths || [],
          puppeteerSelector: element.xpaths?.[0] || ''
        };
        matchedElements = [unifiedElement];
        errors = [];
        console.error(`[UNIFIED-BBOX] Converted bbox-based detection to unified format`);
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

  // UNIFIED SYSTEM: Section locator also uses unified approach
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
      getAIConfigInBoolean(RAFI_USE_QWEN_VL),
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
}) {
  const { dataQuery, context, extractOption } = options;
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
>(options: { assertion: string; context: UIContext<ElementType> }) {
  const { assertion, context } = options;

  assert(assertion, 'assertion should be a string');

  const { screenshotBase64 } = context;

  // Get the URL from the context if available (WebUIContext has a url property)
  const url = (context as any).url || '';

  const systemPrompt = systemPromptToAssert({
    isUITars: getAIConfigInBoolean(RAFI_USE_VLM_UI_TARS),
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
=====================================
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
  const globalDeepThinkSwitch = getAIConfigInBoolean(RAFI_FORCE_DEEP_THINK);
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
      const preliminaryResult = await callAiFn<{ coordinates: [number, number, number, number] }>(
        preliminaryMsgs,
        AIActionType.INSPECT_ELEMENT,
      );

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
          getAIConfigInBoolean(RAFI_USE_QWEN_VL),
        );
      }
    } catch (error) {
      // If preliminary analysis fails, use the full screenshot
      console.warn('Failed to identify CAPTCHA area for deep thinking, using full screenshot', error);
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
