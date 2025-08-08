// config keys
export const RAFI_OPENAI_INIT_CONFIG_JSON =
  'RAFI_OPENAI_INIT_CONFIG_JSON';
export const RAFI_MODEL_NAME = 'RAFI_MODEL_NAME';
export const AI_TEMPERATURE = 'AI_TEMPERATURE';
export const AI_SEED = 'AI_SEED';
export const RAFI_LANGSMITH_DEBUG = 'RAFI_LANGSMITH_DEBUG';
export const RAFI_DEBUG_AI_PROFILE = 'RAFI_DEBUG_AI_PROFILE';
export const RAFI_DEBUG_AI_RESPONSE = 'RAFI_DEBUG_AI_RESPONSE';
export const RAFI_DANGEROUSLY_PRINT_ALL_CONFIG =
  'RAFI_DANGEROUSLY_PRINT_ALL_CONFIG';
export const RAFI_DEBUG_MODE = 'RAFI_DEBUG_MODE';
export const RAFI_MCP_USE_PUPPETEER_MODE =
  'RAFI_MCP_USE_PUPPETEER_MODE';

export const RAFI_FORCE_DEEP_THINK = 'RAFI_FORCE_DEEP_THINK';

export const RAFI_OPENAI_SOCKS_PROXY = 'RAFI_OPENAI_SOCKS_PROXY';
export const RAFI_OPENAI_HTTP_PROXY = 'RAFI_OPENAI_HTTP_PROXY';
export const OPENAI_API_KEY = 'OPENAI_API_KEY';
export const OPENAI_BASE_URL = 'OPENAI_BASE_URL';
export const OPENAI_MAX_TOKENS = 'OPENAI_MAX_TOKENS';

export const RAFI_ADB_PATH = 'RAFI_ADB_PATH';
export const RAFI_ADB_REMOTE_HOST = 'RAFI_ADB_REMOTE_HOST';
export const RAFI_ADB_REMOTE_PORT = 'RAFI_ADB_REMOTE_PORT';
export const RAFI_ANDROID_IME_STRATEGY = 'RAFI_ANDROID_IME_STRATEGY';

export const RAFI_CACHE = 'RAFI_CACHE';
export const RAFI_USE_VLM_UI_TARS = 'RAFI_USE_VLM_UI_TARS';
export const RAFI_USE_QWEN_VL = 'RAFI_USE_QWEN_VL';
export const RAFI_USE_DOUBAO_VISION = 'RAFI_USE_DOUBAO_VISION';
export const RAFI_USE_GEMINI = 'RAFI_USE_GEMINI';
export const RAFI_USE_KIMI_VL = 'RAFI_USE_KIMI_VL';
export const RAFI_USE_VL_MODEL = 'RAFI_USE_VL_MODEL';
export const MATCH_BY_POSITION = 'MATCH_BY_POSITION';
export const RAFI_API_TYPE = 'RAFI-API-TYPE';
export const RAFI_REPORT_TAG_NAME = 'RAFI_REPORT_TAG_NAME';

export const RAFI_PREFERRED_LANGUAGE = 'RAFI_PREFERRED_LANGUAGE';

export const RAFI_USE_AZURE_OPENAI = 'RAFI_USE_AZURE_OPENAI';
export const RAFI_AZURE_OPENAI_SCOPE = 'RAFI_AZURE_OPENAI_SCOPE';
export const RAFI_AZURE_OPENAI_INIT_CONFIG_JSON =
  'RAFI_AZURE_OPENAI_INIT_CONFIG_JSON';

export const AZURE_OPENAI_ENDPOINT = 'AZURE_OPENAI_ENDPOINT';
export const AZURE_OPENAI_KEY = 'AZURE_OPENAI_KEY';
export const AZURE_OPENAI_API_VERSION = 'AZURE_OPENAI_API_VERSION';
export const AZURE_OPENAI_DEPLOYMENT = 'AZURE_OPENAI_DEPLOYMENT';

export const RAFI_USE_ANTHROPIC_SDK = 'RAFI_USE_ANTHROPIC_SDK';
export const ANTHROPIC_API_KEY = 'ANTHROPIC_API_KEY';

export const RAFI_RUN_DIR = 'RAFI_RUN_DIR';

// @deprecated
export const OPENAI_USE_AZURE = 'OPENAI_USE_AZURE';

export const allConfigFromEnv = () => {
  return {
    [RAFI_OPENAI_INIT_CONFIG_JSON]:
      process.env[RAFI_OPENAI_INIT_CONFIG_JSON] || undefined,
    [RAFI_MODEL_NAME]: process.env[RAFI_MODEL_NAME] || undefined,
    [AI_TEMPERATURE]: process.env[AI_TEMPERATURE] || undefined,
    [AI_SEED]: process.env[AI_SEED] || undefined,
    [RAFI_DEBUG_MODE]: process.env[RAFI_DEBUG_MODE] || undefined,
    [RAFI_FORCE_DEEP_THINK]:
      process.env[RAFI_FORCE_DEEP_THINK] || undefined,
    [RAFI_LANGSMITH_DEBUG]:
      process.env[RAFI_LANGSMITH_DEBUG] || undefined,
    [RAFI_DEBUG_AI_PROFILE]:
      process.env[RAFI_DEBUG_AI_PROFILE] || undefined,
    [RAFI_DEBUG_AI_RESPONSE]:
      process.env[RAFI_DEBUG_AI_RESPONSE] || undefined,
    [RAFI_DANGEROUSLY_PRINT_ALL_CONFIG]:
      process.env[RAFI_DANGEROUSLY_PRINT_ALL_CONFIG] || undefined,
    [OPENAI_API_KEY]: process.env[OPENAI_API_KEY] || undefined,
    [OPENAI_BASE_URL]: process.env[OPENAI_BASE_URL] || undefined,
    [OPENAI_MAX_TOKENS]: process.env[OPENAI_MAX_TOKENS] || undefined,
    [OPENAI_USE_AZURE]: process.env[OPENAI_USE_AZURE] || undefined,
    [RAFI_ADB_PATH]: process.env[RAFI_ADB_PATH] || undefined,
    [RAFI_ADB_REMOTE_HOST]:
      process.env[RAFI_ADB_REMOTE_HOST] || undefined,
    [RAFI_ADB_REMOTE_PORT]:
      process.env[RAFI_ADB_REMOTE_PORT] || undefined,
    [RAFI_ANDROID_IME_STRATEGY]:
      process.env[RAFI_ANDROID_IME_STRATEGY] || undefined,
    [RAFI_CACHE]: process.env[RAFI_CACHE] || undefined,
    [MATCH_BY_POSITION]: process.env[MATCH_BY_POSITION] || undefined,
    [RAFI_REPORT_TAG_NAME]:
      process.env[RAFI_REPORT_TAG_NAME] || undefined,
    [RAFI_OPENAI_SOCKS_PROXY]:
      process.env[RAFI_OPENAI_SOCKS_PROXY] || undefined,
    [RAFI_OPENAI_HTTP_PROXY]:
      process.env[RAFI_OPENAI_HTTP_PROXY] || undefined,
    [RAFI_USE_AZURE_OPENAI]:
      process.env[RAFI_USE_AZURE_OPENAI] || undefined,
    [RAFI_AZURE_OPENAI_SCOPE]:
      process.env[RAFI_AZURE_OPENAI_SCOPE] || undefined,
    [RAFI_AZURE_OPENAI_INIT_CONFIG_JSON]:
      process.env[RAFI_AZURE_OPENAI_INIT_CONFIG_JSON] || undefined,
    [RAFI_USE_ANTHROPIC_SDK]:
      process.env[RAFI_USE_ANTHROPIC_SDK] || undefined,
    [RAFI_USE_VLM_UI_TARS]:
      process.env[RAFI_USE_VLM_UI_TARS] || undefined,
    [RAFI_USE_QWEN_VL]: process.env[RAFI_USE_QWEN_VL] || undefined,
    [RAFI_USE_DOUBAO_VISION]:
      process.env[RAFI_USE_DOUBAO_VISION] || undefined,
    [RAFI_USE_GEMINI]: process.env[RAFI_USE_GEMINI] || undefined,
    [RAFI_USE_KIMI_VL]: process.env[RAFI_USE_KIMI_VL] || undefined,
    [RAFI_USE_VL_MODEL]: process.env[RAFI_USE_VL_MODEL] || undefined,
    [ANTHROPIC_API_KEY]: process.env[ANTHROPIC_API_KEY] || undefined,
    [AZURE_OPENAI_ENDPOINT]: process.env[AZURE_OPENAI_ENDPOINT] || undefined,
    [AZURE_OPENAI_KEY]: process.env[AZURE_OPENAI_KEY] || undefined,
    [AZURE_OPENAI_API_VERSION]:
      process.env[AZURE_OPENAI_API_VERSION] || undefined,
    [AZURE_OPENAI_DEPLOYMENT]:
      process.env[AZURE_OPENAI_DEPLOYMENT] || undefined,
    [RAFI_MCP_USE_PUPPETEER_MODE]:
      process.env[RAFI_MCP_USE_PUPPETEER_MODE] || undefined,
    [RAFI_RUN_DIR]: process.env[RAFI_RUN_DIR] || undefined,
    [RAFI_PREFERRED_LANGUAGE]:
      process.env[RAFI_PREFERRED_LANGUAGE] || undefined,
  };
};

let globalConfig: Partial<ReturnType<typeof allConfigFromEnv>> | null = null;

const getGlobalConfig = () => {
  if (globalConfig === null) {
    globalConfig = allConfigFromEnv();
  }
  return globalConfig;
};

// import { UITarsModelVersion } from '@ui-tars/shared/constants';
export enum UITarsModelVersion {
  V1_0 = '1.0',
  V1_5 = '1.5',
  DOUBAO_1_5_15B = 'doubao-1.5-15B',
  DOUBAO_1_5_20B = 'doubao-1.5-20B',
}

export const uiTarsModelVersion = (): UITarsModelVersion | false => {
  if (vlLocateMode() !== 'vlm-ui-tars') {
    return false;
  }

  const versionConfig: any = getAIConfig(RAFI_USE_VLM_UI_TARS);
  if (versionConfig === '1' || versionConfig === 1) {
    return UITarsModelVersion.V1_0;
  }
  if (versionConfig === 'DOUBAO' || versionConfig === 'DOUBAO-1.5') {
    return UITarsModelVersion.DOUBAO_1_5_20B;
  }
  return `${versionConfig}` as UITarsModelVersion;
};

export const vlLocateMode = ():
  | 'qwen-vl'
  | 'doubao-vision'
  | 'gemini'
  | 'kimi-vl'
  | 'vl-model' // not actually in use
  | 'vlm-ui-tars'
  | false => {
  const enabledModes = [
    getAIConfigInBoolean(RAFI_USE_DOUBAO_VISION) &&
      'RAFI_USE_DOUBAO_VISION',
    getAIConfigInBoolean(RAFI_USE_QWEN_VL) && 'RAFI_USE_QWEN_VL',
    getAIConfigInBoolean(RAFI_USE_VLM_UI_TARS) &&
      'RAFI_USE_VLM_UI_TARS',
    getAIConfigInBoolean(RAFI_USE_GEMINI) && 'RAFI_USE_GEMINI',
    getAIConfigInBoolean(RAFI_USE_KIMI_VL) && 'RAFI_USE_KIMI_VL',
  ].filter(Boolean);

  if (enabledModes.length > 1) {
    throw new Error(
      `Only one vision mode can be enabled at a time. Currently enabled modes: ${enabledModes.join(', ')}. Please disable all but one mode.`,
    );
  }

  if (getAIConfigInBoolean(RAFI_USE_QWEN_VL)) {
    return 'qwen-vl';
  }

  if (getAIConfigInBoolean(RAFI_USE_DOUBAO_VISION)) {
    return 'doubao-vision';
  }

  if (getAIConfigInBoolean(RAFI_USE_GEMINI)) {
    return 'gemini';
  }

  if (getAIConfigInBoolean(RAFI_USE_KIMI_VL)) {
    return 'kimi-vl';
  }

  if (getAIConfigInBoolean(RAFI_USE_VL_MODEL)) {
    return 'vl-model';
  }

  if (getAIConfigInBoolean(RAFI_USE_VLM_UI_TARS)) {
    return 'vlm-ui-tars';
  }

  return false;
};

export const getAIConfig = (
  configKey: keyof ReturnType<typeof allConfigFromEnv>,
): string | undefined => {
  if (configKey === MATCH_BY_POSITION) {
    throw new Error(
      'MATCH_BY_POSITION is deprecated, use RAFI_USE_VL_MODEL instead',
    );
  }

  return getGlobalConfig()[configKey]?.trim?.();
};

export const getAIConfigInBoolean = (
  configKey: keyof ReturnType<typeof allConfigFromEnv>,
) => {
  const config = getAIConfig(configKey) || '';
  if (/^(true|1)$/i.test(config)) {
    return true;
  }
  if (/^(false|0)$/i.test(config)) {
    return false;
  }
  return !!config.trim();
};

export const getAIConfigInJson = (
  configKey: keyof ReturnType<typeof allConfigFromEnv>,
) => {
  const config = getAIConfig(configKey);
  try {
    return config ? JSON.parse(config) : undefined;
  } catch (error: any) {
    throw new Error(
      `Failed to parse json config: ${configKey}. ${error.message}`,
      {
        cause: error,
      },
    );
  }
};

export const overrideAIConfig = (
  newConfig: Partial<ReturnType<typeof allConfigFromEnv>>,
  extendMode = false, // true: merge with global config, false: override global config
) => {
  for (const key in newConfig) {
    if (typeof key !== 'string') {
      throw new Error(`Failed to override AI config, invalid key: ${key}`);
    }
    if (typeof newConfig[key as keyof typeof newConfig] === 'object') {
      throw new Error(
        `Failed to override AI config, invalid value for key: ${key}, value: ${newConfig[key as keyof typeof newConfig]}`,
      );
    }
  }

  const currentConfig = getGlobalConfig();
  globalConfig = extendMode
    ? { ...currentConfig, ...newConfig }
    : { ...newConfig };
};

export const getPreferredLanguage = () => {
  if (getAIConfig(RAFI_PREFERRED_LANGUAGE)) {
    return getAIConfig(RAFI_PREFERRED_LANGUAGE);
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isChina = timeZone === 'Asia/Shanghai';
  return isChina ? 'Chinese' : 'English';
};
