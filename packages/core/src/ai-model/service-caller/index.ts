import { AIResponseFormat, type AIUsageInfo } from '@/types';
import { Anthropic } from '@anthropic-ai/sdk';
import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from '@azure/identity';
import {
  ANTHROPIC_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_KEY,
  RAFI_API_TYPE,
  RAFI_AZURE_OPENAI_INIT_CONFIG_JSON,
  RAFI_AZURE_OPENAI_SCOPE,
  RAFI_DEBUG_AI_PROFILE,
  RAFI_DEBUG_AI_RESPONSE,
  RAFI_LANGSMITH_DEBUG,
  RAFI_MODEL_NAME,
  RAFI_OPENAI_HTTP_PROXY,
  RAFI_OPENAI_INIT_CONFIG_JSON,
  RAFI_OPENAI_SOCKS_PROXY,
  RAFI_USE_ANTHROPIC_SDK,
  RAFI_USE_AZURE_OPENAI,
  RAFI_USE_QWEN_VL,
  RAFI_USE_KIMI_VL,
  RAFI_USE_VLM_UI_TARS,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_MAX_TOKENS,
  OPENAI_USE_AZURE,
  getAIConfig,
  getAIConfigInBoolean,
  getAIConfigInJson,
  uiTarsModelVersion,
  vlLocateMode,
} from 'rfi-ai-shared/env';
import { enableDebug, getDebug } from 'rfi-ai-shared/logger';
import { assert } from 'rfi-ai-shared/utils';
import { ifInBrowser } from 'rfi-ai-shared/utils';
import dJSON from 'dirty-json';
import { HttpsProxyAgent } from 'https-proxy-agent';
import OpenAI, { AzureOpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { AIActionType } from '../common';
import { assertSchema } from '../prompt/assertion';
import { locatorSchema, vlLocatorSchema } from '../prompt/llm-locator';
import { planSchema } from '../prompt/llm-planning';
import { 
  AIServiceError, 
  AIErrorType,
  handleAIServiceError, 
  formatErrorForLogging 
} from './error-handler';

// Constants for temperature and seed configuration
const AI_TEMPERATURE = 'AI_TEMPERATURE';
const AI_SEED = 'AI_SEED';

export function checkAIConfig() {
  if (getAIConfig(OPENAI_API_KEY)) return true;
  if (getAIConfig(RAFI_USE_AZURE_OPENAI)) return true;
  if (getAIConfig(ANTHROPIC_API_KEY)) return true;

  return Boolean(getAIConfig(RAFI_OPENAI_INIT_CONFIG_JSON));
}

// if debug config is initialized
let debugConfigInitialized = false;

function initDebugConfig() {
  // if debug config is initialized, return
  if (debugConfigInitialized) return;

  const shouldPrintTiming = getAIConfigInBoolean(RAFI_DEBUG_AI_PROFILE);
  let debugConfig = '';
  if (shouldPrintTiming) {
    console.warn(
      'RAFI_DEBUG_AI_PROFILE is deprecated, use DEBUG=rafi:ai:profile instead',
    );
    debugConfig = 'ai:profile';
  }
  const shouldPrintAIResponse = getAIConfigInBoolean(
    RAFI_DEBUG_AI_RESPONSE,
  );
  if (shouldPrintAIResponse) {
    console.warn(
      'RAFI_DEBUG_AI_RESPONSE is deprecated, use DEBUG=rafi:ai:response instead',
    );
    if (debugConfig) {
      debugConfig = 'ai:*';
    } else {
      debugConfig = 'ai:call';
    }
  }
  if (debugConfig) {
    enableDebug(debugConfig);
  }

  // mark as initialized
  debugConfigInitialized = true;
}

// default model
const defaultModel = 'gpt-4o';
export function getModelName() {
  let modelName = defaultModel;
  const nameInConfig = getAIConfig(RAFI_MODEL_NAME);
  if (nameInConfig) {
    modelName = nameInConfig;
  }
  return modelName;
}

async function createChatClient({
  AIActionTypeValue,
}: {
  AIActionTypeValue: AIActionType;
}): Promise<{
  completion: OpenAI.Chat.Completions;
  style: 'openai' | 'anthropic';
}> {
  initDebugConfig();
  let openai: OpenAI | AzureOpenAI | undefined;
  const extraConfig = getAIConfigInJson(RAFI_OPENAI_INIT_CONFIG_JSON);

  const socksProxy = getAIConfig(RAFI_OPENAI_SOCKS_PROXY);
  const httpProxy = getAIConfig(RAFI_OPENAI_HTTP_PROXY);

  let proxyAgent = undefined;
  if (httpProxy) {
    proxyAgent = new HttpsProxyAgent(httpProxy);
  } else if (socksProxy) {
    proxyAgent = new SocksProxyAgent(socksProxy);
  }

  if (getAIConfig(OPENAI_USE_AZURE)) {
    // this is deprecated
    openai = new AzureOpenAI({
      baseURL: getAIConfig(OPENAI_BASE_URL),
      apiKey: getAIConfig(OPENAI_API_KEY),
      httpAgent: proxyAgent,
      ...extraConfig,
      dangerouslyAllowBrowser: true,
    }) as OpenAI;
  } else if (getAIConfig(RAFI_USE_AZURE_OPENAI)) {
    const extraAzureConfig = getAIConfigInJson(
      RAFI_AZURE_OPENAI_INIT_CONFIG_JSON,
    );

    // https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart?tabs=bash%2Cjavascript-key%2Ctypescript-keyless%2Cpython&pivots=programming-language-javascript#rest-api
    // keyless authentication
    const scope = getAIConfig(RAFI_AZURE_OPENAI_SCOPE);
    let tokenProvider: any = undefined;
    if (scope) {
      if (ifInBrowser) {
        throw new AIServiceError(
          AIErrorType.INVALID_CONFIG,
          'Azure OpenAI is not supported in browser',
          undefined,
          'Use Azure OpenAI in server-side environment only',
        );
      }
      const credential = new DefaultAzureCredential();

      assert(scope, 'RAFI_AZURE_OPENAI_SCOPE is required');
      tokenProvider = getBearerTokenProvider(credential, scope);

      openai = new AzureOpenAI({
        azureADTokenProvider: tokenProvider,
        endpoint: getAIConfig(AZURE_OPENAI_ENDPOINT),
        apiVersion: getAIConfig(AZURE_OPENAI_API_VERSION),
        deployment: getAIConfig(AZURE_OPENAI_DEPLOYMENT),
        ...extraConfig,
        ...extraAzureConfig,
      });
    } else {
      // endpoint, apiKey, apiVersion, deployment
      openai = new AzureOpenAI({
        apiKey: getAIConfig(AZURE_OPENAI_KEY),
        endpoint: getAIConfig(AZURE_OPENAI_ENDPOINT),
        apiVersion: getAIConfig(AZURE_OPENAI_API_VERSION),
        deployment: getAIConfig(AZURE_OPENAI_DEPLOYMENT),
        dangerouslyAllowBrowser: true,
        ...extraConfig,
        ...extraAzureConfig,
      });
    }
  } else if (!getAIConfig(RAFI_USE_ANTHROPIC_SDK)) {
    const baseURL = getAIConfig(OPENAI_BASE_URL);
    if (typeof baseURL === 'string') {
      if (!/^https?:\/\//.test(baseURL)) {
        throw new AIServiceError(
          AIErrorType.INVALID_CONFIG,
          'Invalid base URL configuration',
          undefined,
          `OPENAI_BASE_URL must start with http:// or https://, got: ${baseURL}`,
        );
      }
    }

    openai = new OpenAI({
      baseURL: getAIConfig(OPENAI_BASE_URL),
      apiKey: getAIConfig(OPENAI_API_KEY),
      httpAgent: proxyAgent,
      ...extraConfig,
      defaultHeaders: {
        ...(extraConfig?.defaultHeaders || {}),
        [RAFI_API_TYPE]: AIActionTypeValue.toString(),
      },
      dangerouslyAllowBrowser: true,
    });
  }

  if (openai && getAIConfigInBoolean(RAFI_LANGSMITH_DEBUG)) {
    if (ifInBrowser) {
      throw new Error('langsmith is not supported in browser');
    }
    console.log('DEBUGGING MODE: langsmith wrapper enabled');
    const { wrapOpenAI } = await import('langsmith/wrappers');
    openai = wrapOpenAI(openai as any) as any;
  }

  if (typeof openai !== 'undefined') {
    return {
      completion: openai.chat.completions,
      style: 'openai',
    };
  }

  // Anthropic
  if (getAIConfig(RAFI_USE_ANTHROPIC_SDK)) {
    const apiKey = getAIConfig(ANTHROPIC_API_KEY);
    assert(apiKey, 'ANTHROPIC_API_KEY is required');
    openai = new Anthropic({
      apiKey,
      httpAgent: proxyAgent,
      dangerouslyAllowBrowser: true,
    }) as any;
  }

  if (typeof openai !== 'undefined' && (openai as any).messages) {
    return {
      completion: (openai as any).messages,
      style: 'anthropic',
    };
  }

  throw new AIServiceError(
    AIErrorType.API_KEY_MISSING,
    'AI service not initialized',
    undefined,
    'Please configure OpenAI or Anthropic API credentials',
  );
}

export async function call(
  messages: ChatCompletionMessageParam[],
  AIActionTypeValue: AIActionType,
  responseFormat?:
    | OpenAI.ChatCompletionCreateParams['response_format']
    | OpenAI.ResponseFormatJSONObject,
): Promise<{ content: string; usage?: AIUsageInfo }> {
  const { completion, style } = await createChatClient({
    AIActionTypeValue,
  });

  const maxTokens = getAIConfig(OPENAI_MAX_TOKENS);
  const debugCall = getDebug('ai:call');
  const debugProfileStats = getDebug('ai:profile:stats');
  const debugProfileDetail = getDebug('ai:profile:detail');

  const startTime = Date.now();
  const model = getModelName();
  let content: string | undefined;
  let usage: OpenAI.CompletionUsage | undefined;
  let timeCost: number | undefined;
  
  // Get configurable temperature and seed for consistent LLM responses
  const configuredTemperature = process.env[AI_TEMPERATURE];
  const configuredSeed = process.env[AI_SEED];
  
  // Default temperature based on VL mode, but allow override - preserve UI Tars settings
  const defaultTemperature = vlLocateMode() === 'vlm-ui-tars' ? 0.0 : 0.1;
  const temperature = configuredTemperature ? 
    Number.parseFloat(configuredTemperature) : defaultTemperature;
  
  // Default seed for consistency (42 is a common choice)
  const seed = configuredSeed ? Number.parseInt(configuredSeed, 10) : 42;
  
  const isGemini = model.includes('gemini');
  const isKimiVL = model.toLowerCase().includes('kimi');

  const commonConfig: any = {
    temperature,
    stream: false,
    ...(vlLocateMode() === 'qwen-vl' // qwen specific config
      ? {
          vl_high_resolution_images: true,
        }
      : {}),
  };

  if (!isGemini) {
    commonConfig.seed = seed;
    
    // Set max_tokens based on model capabilities
    let defaultMaxTokens = '2048';
    if (isKimiVL) {
      // Kimi VL supports up to 32K tokens
      defaultMaxTokens = '32768';
    }
    
    commonConfig.max_tokens = 
      typeof maxTokens === 'number'
        ? maxTokens
        : Number.parseInt(maxTokens || defaultMaxTokens, 10);
  }

  if (style === 'openai') {
    debugCall(`sending request to ${model}`);
    let result: Awaited<ReturnType<typeof completion.create>>;
    try {
      const startTime = Date.now();
      const requestPayload = {
        model,
        messages,
        response_format: responseFormat,
        ...commonConfig,
      };

      // Log the messages content for debugging VL models with DOM
      if (vlLocateMode()) {
        const userMessage = messages.find((m: any) => m.role === 'user');
        if (userMessage && Array.isArray(userMessage.content)) {
          const textContents = userMessage.content.filter((c: any) => c.type === 'text');
          debugCall(`[VL-DOM-DEBUG] Text content count: ${textContents.length}`);
          textContents.forEach((tc: any, index: number) => {
            const preview = tc.text?.substring(0, 200) || '';
            debugCall(`[VL-DOM-DEBUG] Text content ${index + 1} preview: ${preview}...`);
            if (tc.text?.includes('DOM Structure Information')) {
              debugCall(`[VL-DOM-DEBUG] ✅ DOM structure is included in the request!`);
            }
          });
        }
      }

      console.error(`[AI-REQUEST] Calling model: ${model}`);
      console.error(`[AI-REQUEST] Payload size: ${JSON.stringify(requestPayload).length} chars`);
      
      result = await completion.create(requestPayload as any);
      timeCost = Date.now() - startTime;
      console.error(`[AI-RESPONSE] Success in ${timeCost}ms`);
    } catch (e: any) {
      const aiError = handleAIServiceError(e, {
        model,
        hasImages: messages.some((m: any) => 
          Array.isArray(m.content) && 
          m.content.some((c: any) => c.type === 'image_url')
        ),
        action: AIActionTypeValue.toString(),
      });
      
      console.error(formatErrorForLogging(aiError));
      
      // Check if error is related to image/vision capabilities
      const isImageError = e.status === 422 || 
                          e.message?.includes('image') || 
                          e.message?.includes('vision') ||
                          e.message?.includes('unsupported') ||
                          e.message?.includes('not supported');
      
      if (isImageError && messages.some((m: any) => 
          Array.isArray(m.content) && 
          m.content.some((c: any) => c.type === 'image_url'))) {
        console.error(`[UNIFIED-VISION-ERROR] Model ${model} doesn't support vision/images`);
        console.error(`[UNIFIED-FALLBACK] Retrying with text-only mode...`);
        
        // Retry without images - convert to text-only
        const textOnlyMessages = messages.map((msg: any) => {
          if (Array.isArray(msg.content)) {
            const textParts = msg.content.filter((c: any) => c.type === 'text');
            return {
              ...msg,
              content: textParts.length > 1 ? textParts : textParts[0]?.text || msg.content
            };
          }
          return msg;
        });
        
        console.error(`[UNIFIED-TEXT-RETRY] Attempting text-only request for non-vision model`);
        
        try {
          result = await completion.create({
            model,
            messages: textOnlyMessages,
            response_format: responseFormat,
            ...commonConfig,
          } as any);
          timeCost = Date.now() - startTime;
          console.error(`[UNIFIED-SUCCESS] Text-only fallback successful for model ${model}`);
        } catch (retryError: any) {
          const retryAIError = handleAIServiceError(retryError, {
            model,
            hasImages: false,
            action: AIActionTypeValue.toString(),
          });
          throw new AIServiceError(
            AIErrorType.VISION_NOT_SUPPORTED,
            `Model ${model} doesn't support vision and text-only fallback also failed`,
            retryError,
            'Try using a vision-capable model like gpt-4o or gemini-2.5-pro',
          );
        }
      } else {
        throw aiError;
      }
    }

    debugProfileStats(
      `model, ${model}, mode, ${vlLocateMode() || 'default'}, ui-tars-version, ${uiTarsModelVersion()}, prompt-tokens, ${result.usage?.prompt_tokens || ''}, completion-tokens, ${result.usage?.completion_tokens || ''}, total-tokens, ${result.usage?.total_tokens || ''}, cost-ms, ${Date.now() - startTime}, requestId, ${result._request_id || ''}`,
    );

    debugProfileDetail(`model usage detail: ${JSON.stringify(result.usage)}`);

    assert(
      result.choices,
      `invalid response from LLM service: ${JSON.stringify(result)}`,
    );
    content = result.choices[0].message.content!;

    debugCall(`response: ${content}`);
    assert(content, 'empty content');
    usage = result.usage;
    // console.log('headers', result.headers);
  } else if (style === 'anthropic') {
    const convertImageContent = (content: any) => {
      if (content.type === 'image_url') {
        const imgBase64 = content.image_url.url;
        assert(imgBase64, 'image_url is required');
        return {
          source: {
            type: 'base64',
            media_type: imgBase64.includes('data:image/png;base64,')
              ? 'image/png'
              : 'image/jpeg',
            data: imgBase64.split(',')[1],
          },
          type: 'image',
        };
      }
      return content;
    };

    const startTime = Date.now();
    const result = await completion.create({
      model,
      system: 'You are a versatile professional in software UI automation',
      messages: messages.map((m) => ({
        role: 'user',
        content: Array.isArray(m.content)
          ? (m.content as any).map(convertImageContent)
          : m.content,
      })),
      response_format: responseFormat,
      ...commonConfig,
    } as any);
    timeCost = Date.now() - startTime;
    content = (result as any).content[0].text as string;
    assert(content, 'empty content');
    usage = result.usage;
  }

  return {
    content: content || '',
    usage: {
      prompt_tokens: usage?.prompt_tokens ?? 0,
      completion_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      time_cost: timeCost ?? 0,
    },
  };
}

export async function callToGetJSONObject<T>(
  messages: ChatCompletionMessageParam[],
  AIActionTypeValue: AIActionType,
): Promise<{ content: T; usage?: AIUsageInfo }> {
  let responseFormat:
    | OpenAI.ChatCompletionCreateParams['response_format']
    | OpenAI.ResponseFormatJSONObject
    | undefined;

  const model = getModelName();

  if (model.includes('gpt-4')) {
    switch (AIActionTypeValue) {
      case AIActionType.ASSERT:
        responseFormat = assertSchema;
        break;
      case AIActionType.INSPECT_ELEMENT:
        // Use VL schema if in VL mode, otherwise use standard locator schema
        // For VL models, use flexible JSON to allow hybrid mode format
        responseFormat = vlLocateMode() ? { type: AIResponseFormat.JSON } : locatorSchema;
        break;
      case AIActionType.PLAN:
        responseFormat = planSchema;
        break;
      case AIActionType.EXTRACT_DATA:
      case AIActionType.DESCRIBE_ELEMENT:
      case AIActionType.CAPTCHA:
        responseFormat = { type: AIResponseFormat.JSON };
        break;
    }
  }

  // gpt-4o-2024-05-13 only supports json_object response format
  if (model === 'gpt-4o-2024-05-13') {
    responseFormat = { type: AIResponseFormat.JSON };
  }

  const response = await call(messages, AIActionTypeValue, responseFormat);
  assert(response, 'empty response');
  const jsonContent = safeParseJson(response.content);
  return { content: jsonContent, usage: response.usage };
}

export function extractJSONFromCodeBlock(response: string) {
  try {
    // First, try to match a JSON object directly in the response
    const jsonMatch = response.match(/^\s*(\{[\s\S]*\})\s*$/);
    if (jsonMatch) {
      return jsonMatch[1];
    }

    // If no direct JSON object is found, try to extract JSON from a code block
    const codeBlockMatch = response.match(
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    );
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }

    // If no code block is found, try to find a JSON-like structure in the text
    const jsonLikeMatch = response.match(/\{[\s\S]*\}/);
    if (jsonLikeMatch) {
      return jsonLikeMatch[0];
    }
  } catch {}
  // If no JSON-like structure is found, return the original response
  return response;
}

export function preprocessDoubaoBboxJson(input: string) {
  if (input.includes('bbox')) {
    // when its values like 940 445 969 490, replace all /\d+\s+\d+/g with /$1,$2/g
    while (/\d+\s+\d+/.test(input)) {
      input = input.replace(/(\d+)\s+(\d+)/g, '$1,$2');
    }
  }
  return input;
}

export function safeParseJson(input: string) {
  const cleanJsonString = extractJSONFromCodeBlock(input);
  // match the point
  if (cleanJsonString?.match(/\((\d+),(\d+)\)/)) {
    return cleanJsonString
      .match(/\((\d+),(\d+)\)/)
      ?.slice(1)
      .map(Number);
  }
  try {
    return JSON.parse(cleanJsonString);
  } catch {}
  try {
    return dJSON.parse(cleanJsonString);
  } catch (e) {}

  if (vlLocateMode() === 'doubao-vision' || vlLocateMode() === 'vlm-ui-tars') {
    const jsonString = preprocessDoubaoBboxJson(cleanJsonString);
    return dJSON.parse(jsonString);
  }
  throw Error(`failed to parse json response: ${input}`);
}
