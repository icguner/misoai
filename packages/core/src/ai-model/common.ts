import type {
  AIUsageInfo,
  BaseElement,
  ElementTreeNode,
  MidsceneYamlFlowItem,
  PlanningAction,
  PlanningActionParamInputOrKeyPress,
  PlanningActionParamScroll,
  PlanningActionParamSleep,
  Rect,
  Size,
} from '@/types';
import { assert } from 'rfi-ai-shared/utils';

import type {
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources';
import {
  callToGetJSONObject,
  checkAIConfig,
  getModelName,
} from './service-caller/index';

import type { PlanningLocateParam } from '@/types';
import { NodeType } from 'rfi-ai-shared/constants';
import { vlLocateMode } from 'rfi-ai-shared/env';
import { treeToList } from 'rfi-ai-shared/extractor';
import { compositeElementInfoImgSharp } from 'rfi-ai-shared/img';
import { getDebug } from 'rfi-ai-shared/logger';

export type AIArgs = [
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
];

export enum AIActionType {
  ASSERT = 0,
  INSPECT_ELEMENT = 1,
  EXTRACT_DATA = 2,
  PLAN = 3,
  DESCRIBE_ELEMENT = 4,
  CAPTCHA = 5,
}

export async function callAiFn<T>(
  msgs: AIArgs,
  AIActionTypeValue: AIActionType,
): Promise<{ content: T; usage?: AIUsageInfo }> {
  assert(
    checkAIConfig(),
    'Cannot find config for AI model service. If you are using a self-hosted model without validating the API key, please set `OPENAI_API_KEY` to any non-null value.',
  );

  const { content, usage } = await callToGetJSONObject<T>(
    msgs,
    AIActionTypeValue,
  );
  return { content, usage };
}

const defaultBboxSize = 20; // must be even number
const debugInspectUtils = getDebug('ai:common');

// transform the param of locate from qwen mode
export function fillBboxParam(
  locate: PlanningLocateParam,
  width: number,
  height: number,
) {
  // The Qwen model might have hallucinations of naming bbox as bbox_2d.
  if ((locate as any).bbox_2d && !locate?.bbox) {
    locate.bbox = (locate as any).bbox_2d;
    // biome-ignore lint/performance/noDelete: <explanation>
    delete (locate as any).bbox_2d;
  }

  if (locate?.bbox) {
    locate.bbox = adaptBbox(locate.bbox, width, height);
  }

  return locate;
}

export function adaptQwenBbox(
  bbox: number[],
): [number, number, number, number] {
  // Handle the case when AI model cannot find the element (returns empty bbox)
  if (bbox.length === 0) {
    // Return a zero-sized bbox to indicate element not found
    // This will be caught and handled properly by the calling function
    return [0, 0, 0, 0];
  }
  
  if (bbox.length < 2) {
    const msg = `invalid bbox data for qwen-vl mode: ${JSON.stringify(bbox)} `;
    throw new Error(msg);
  }

  const result: [number, number, number, number] = [
    Math.round(bbox[0]),
    Math.round(bbox[1]),
    typeof bbox[2] === 'number'
      ? Math.round(bbox[2])
      : Math.round(bbox[0] + defaultBboxSize),
    typeof bbox[3] === 'number'
      ? Math.round(bbox[3])
      : Math.round(bbox[1] + defaultBboxSize),
  ];
  return result;
}

export function adaptDoubaoBbox(
  bbox: string[] | number[] | string,
  width: number,
  height: number,
): [number, number, number, number] {
  assert(
    width > 0 && height > 0,
    'width and height must be greater than 0 in doubao mode',
  );

  if (typeof bbox === 'string') {
    assert(
      /^(\d+)\s(\d+)\s(\d+)\s(\d+)$/.test(bbox.trim()),
      `invalid bbox data string for doubao-vision mode: ${bbox}`,
    );
    const splitted = bbox.split(' ');
    if (splitted.length === 4) {
      return [
        Math.round((Number(splitted[0]) * width) / 1000),
        Math.round((Number(splitted[1]) * height) / 1000),
        Math.round((Number(splitted[2]) * width) / 1000),
        Math.round((Number(splitted[3]) * height) / 1000),
      ];
    }
    throw new Error(`invalid bbox data string for doubao-vision mode: ${bbox}`);
  }

  if (Array.isArray(bbox) && Array.isArray(bbox[0])) {
    bbox = bbox[0];
  }

  let bboxList: number[] = [];
  if (Array.isArray(bbox) && typeof bbox[0] === 'string') {
    bbox.forEach((item) => {
      if (typeof item === 'string' && item.includes(',')) {
        const [x, y] = item.split(',');
        bboxList.push(Number(x.trim()), Number(y.trim()));
      } else if (typeof item === 'string' && item.includes(' ')) {
        const [x, y] = item.split(' ');
        bboxList.push(Number(x.trim()), Number(y.trim()));
      } else {
        bboxList.push(Number(item));
      }
    });
  } else {
    bboxList = bbox as any;
  }

  if (bboxList.length === 4 || bboxList.length === 5) {
    return [
      Math.round((bboxList[0] * width) / 1000),
      Math.round((bboxList[1] * height) / 1000),
      Math.round((bboxList[2] * width) / 1000),
      Math.round((bboxList[3] * height) / 1000),
    ];
  }

  // treat the bbox as a center point
  if (
    bboxList.length === 6 ||
    bboxList.length === 2 ||
    bboxList.length === 3 ||
    bboxList.length === 7
  ) {
    return [
      Math.max(
        0,
        Math.round((bboxList[0] * width) / 1000) - defaultBboxSize / 2,
      ),
      Math.max(
        0,
        Math.round((bboxList[1] * height) / 1000) - defaultBboxSize / 2,
      ),
      Math.min(
        width,
        Math.round((bboxList[0] * width) / 1000) + defaultBboxSize / 2,
      ),
      Math.min(
        height,
        Math.round((bboxList[1] * height) / 1000) + defaultBboxSize / 2,
      ),
    ];
  }

  if (bbox.length === 8) {
    return [
      Math.round((bboxList[0] * width) / 1000),
      Math.round((bboxList[1] * height) / 1000),
      Math.round((bboxList[4] * width) / 1000),
      Math.round((bboxList[5] * height) / 1000),
    ];
  }

  const msg = `invalid bbox data for doubao-vision mode: ${JSON.stringify(bbox)} `;
  throw new Error(msg);
}

export function adaptBbox(
  bbox: number[],
  width: number,
  height: number,
): [number, number, number, number] {
  if (vlLocateMode() === 'doubao-vision' || vlLocateMode() === 'vlm-ui-tars') {
    return adaptDoubaoBbox(bbox, width, height);
  }

  if (vlLocateMode() === 'gemini') {
    return adaptGeminiBbox(bbox, width, height);
  }

  if (vlLocateMode() === 'kimi-vl') {
    return adaptKimiVLBbox(bbox, width, height);
  }

  return adaptQwenBbox(bbox);
}

export function adaptGeminiBbox(
  bbox: number[],
  width: number,
  height: number,
): [number, number, number, number] {
  // With hybrid mode and DOM data, Gemini returns actual pixel coordinates
  // Format: [ymin, xmin, ymax, xmax] in actual pixels (not normalized)
  // We need to check if the values are normalized (0-1000) or actual pixels
  
  // Better heuristic: Check if values make sense as pixels vs normalized
  // If ymax > height or xmax > width, they can't be actual pixels, must be wrong
  // If all values <= 1000 AND at least one > height or width, likely normalized
  // If values are reasonable for actual screen dimensions, they're likely pixels
  
  const [ymin, xmin, ymax, xmax] = bbox;
  const maxValue = Math.max(...bbox);
  
  // Check if these could be actual pixel coordinates
  // They should be within screen bounds if they're pixels
  const couldBePixels = ymax <= height && xmax <= width;
  
  // Check if these are likely normalized (0-1000 range)
  // Normalized coords typically have max value close to 1000
  const likelyNormalized = maxValue <= 1000 && maxValue > Math.max(width, height) * 0.8;
  
  // Decision logic:
  // 1. If values exceed screen dimensions, must be an error or normalized
  // 2. If all values fit within screen AND aren't suspiciously round (like 1000), treat as pixels
  // 3. Otherwise treat as normalized
  
  if (couldBePixels && !likelyNormalized) {
    // These are actual pixel coordinates (hybrid DOM mode)
    // Gemini format: [ymin, xmin, ymax, xmax]
    // We need: [left, top, right, bottom]
    const left = Math.round(xmin);   // xmin
    const top = Math.round(ymin);    // ymin
    const right = Math.round(xmax);  // xmax
    const bottom = Math.round(ymax); // ymax
    return [left, top, right, bottom];
  } else {
    // These are normalized coordinates (visual-only mode)
    const left = Math.round((xmin * width) / 1000);
    const top = Math.round((ymin * height) / 1000);
    const right = Math.round((xmax * width) / 1000);
    const bottom = Math.round((ymax * height) / 1000);
    return [left, top, right, bottom];
  }
}

export function adaptKimiVLBbox(
  bbox: number[],
  width: number,
  height: number,
): [number, number, number, number] {
  // Handle the case when AI model cannot find the element (returns empty bbox)
  if (bbox.length === 0) {
    // Return a zero-sized bbox to indicate element not found
    return [0, 0, 0, 0];
  }
  
  if (bbox.length < 4) {
    const msg = `invalid bbox data for kimi-vl mode: ${JSON.stringify(bbox)} `;
    throw new Error(msg);
  }

  // Kimi VL uses normalized coordinates (0-1000) similar to other VL models
  // Format: [left, top, right, bottom] in normalized coordinates
  const left = Math.round((bbox[0] * width) / 1000);
  const top = Math.round((bbox[1] * height) / 1000);
  const right = Math.round((bbox[2] * width) / 1000);
  const bottom = Math.round((bbox[3] * height) / 1000);
  
  return [left, top, right, bottom];
}

export function adaptBboxToRect(
  bbox: number[],
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
): Rect {
  debugInspectUtils('adaptBboxToRect', bbox, width, height, offsetX, offsetY);
  
  // Handle empty bbox (element not found case)
  if (bbox.length === 0) {
    throw new Error('Element not found - AI model returned empty bbox');
  }
  
  const [left, top, right, bottom] = adaptBbox(bbox, width, height);
  
  // Check if bbox represents "not found" (all zeros from adaptQwenBbox)
  if (left === 0 && top === 0 && right === 0 && bottom === 0) {
    throw new Error('Element not found - AI model could not locate the element');
  }
  
  const rect = {
    left: left + offsetX,
    top: top + offsetY,
    width: right - left,
    height: bottom - top,
  };
  debugInspectUtils('adaptBboxToRect, result=', rect);
  return rect;
}

let warned = false;
export function warnGPT4oSizeLimit(size: Size) {
  if (warned) return;
  if (getModelName()?.toLowerCase().includes('gpt-4o')) {
    const warningMsg = `GPT-4o has a maximum image input size of 2000x768 or 768x2000, but got ${size.width}x${size.height}. Please set your page to a smaller resolution. Otherwise, the result may be inaccurate.`;

    if (
      Math.max(size.width, size.height) > 2000 ||
      Math.min(size.width, size.height) > 768
    ) {
      console.warn(warningMsg);
      warned = true;
    }
  } else if (size.width > 1800 || size.height > 1800) {
    console.warn(
      `The image size seems too large (${size.width}x${size.height}). It may lead to more token usage, slower response, and inaccurate result.`,
    );
    warned = true;
  }
}

export function mergeRects(rects: Rect[]) {
  const minLeft = Math.min(...rects.map((r) => r.left));
  const minTop = Math.min(...rects.map((r) => r.top));
  const maxRight = Math.max(...rects.map((r) => r.left + r.width));
  const maxBottom = Math.max(...rects.map((r) => r.top + r.height));
  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
}

// expand the search area to at least 300 x 300, or add a default padding
export function expandSearchArea(rect: Rect, screenSize: Size) {
  const minEdgeSize = 300;
  const defaultPadding = 160;

  const paddingSizeHorizontal =
    rect.width < minEdgeSize
      ? Math.ceil((minEdgeSize - rect.width) / 2)
      : defaultPadding;
  const paddingSizeVertical =
    rect.height < minEdgeSize
      ? Math.ceil((minEdgeSize - rect.height) / 2)
      : defaultPadding;
  rect.left = Math.max(0, rect.left - paddingSizeHorizontal);
  rect.width = Math.min(
    rect.width + paddingSizeHorizontal * 2,
    screenSize.width - rect.left,
  );
  rect.top = Math.max(0, rect.top - paddingSizeVertical);
  rect.height = Math.min(
    rect.height + paddingSizeVertical * 2,
    screenSize.height - rect.top,
  );
  return rect;
}

export async function markupImageForLLM(
  screenshotBase64: string,
  tree: ElementTreeNode<BaseElement>,
  size: Size,
) {
  const elementsInfo = treeToList(tree);
  const elementsPositionInfoWithoutText = elementsInfo!.filter(
    (elementInfo) => {
      if (elementInfo.attributes.nodeType === NodeType.TEXT) {
        return false;
      }
      return true;
    },
  );

  const imagePayload = await compositeElementInfoImgSharp({
    inputImgBase64: screenshotBase64,
    elementsPositionInfo: elementsPositionInfoWithoutText,
    size,
  });
  return imagePayload;
}

export function buildYamlFlowFromPlans(
  plans: PlanningAction[],
  sleep?: number,
): MidsceneYamlFlowItem[] {
  const flow: MidsceneYamlFlowItem[] = [];

  for (const plan of plans) {
    const type = plan.type;
    const locate = plan.locate?.prompt!; // TODO: check if locate is null

    if (type === 'Tap') {
      flow.push({
        aiTap: locate!,
      });
    } else if (type === 'Hover') {
      flow.push({
        aiHover: locate!,
      });
    } else if (type === 'Input') {
      const param = plan.param as PlanningActionParamInputOrKeyPress;
      flow.push({
        aiInput: param.value,
        locate,
      });
    } else if (type === 'KeyboardPress') {
      const param = plan.param as PlanningActionParamInputOrKeyPress;
      flow.push({
        aiKeyboardPress: param.value,
        locate,
      });
    } else if (type === 'Scroll') {
      const param = plan.param as PlanningActionParamScroll;
      
      // Generate intelligent scroll prompt from planning parameters
      let scrollPrompt = 'scroll';
      
      if (param.direction) {
        scrollPrompt += ` ${param.direction}`;
      }
      
      if (locate) {
        scrollPrompt += ` in ${locate}`;
      }
      
      if (param.scrollType) {
        switch (param.scrollType) {
          case 'untilBottom':
            scrollPrompt += ' until bottom';
            break;
          case 'untilTop':
            scrollPrompt += ' until top';
            break;
          case 'untilLeft':
            scrollPrompt += ' until left edge';
            break;
          case 'untilRight':
            scrollPrompt += ' until right edge';
            break;
          case 'once':
          default:
            if (param.distance) {
              scrollPrompt += ` ${param.distance} pixels`;
            }
            break;
        }
      } else if (param.distance) {
        scrollPrompt += ` ${param.distance} pixels`;
      }
      
      flow.push({
        aiScroll: scrollPrompt,
        locate,
      });
    } else if (type === 'Sleep') {
      const param = plan.param as PlanningActionParamSleep;
      flow.push({
        sleep: param.timeMs,
      });
    } else if (
      type === 'AndroidBackButton' ||
      type === 'AndroidHomeButton' ||
      type === 'AndroidRecentAppsButton'
    ) {
      // not implemented in yaml yet
    } else if (
      type === 'Error' ||
      type === 'ExpectedFalsyCondition' ||
      type === 'Assert' ||
      type === 'AssertWithoutThrow' ||
      type === 'Finished'
    ) {
      // do nothing
    } else {
      console.warn(
        `Cannot convert action ${type} to yaml flow. This should be a bug of Midscene.`,
      );
    }
  }

  if (sleep) {
    flow.push({
      sleep: sleep,
    });
  }

  return flow;
}
