/**
 * AI Service Error Handler
 * Provides user-friendly error messages and handling for AI service calls
 */

export enum AIErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  INVALID_CONFIG = 'INVALID_CONFIG',
  MODEL_NOT_SUPPORTED = 'MODEL_NOT_SUPPORTED',
  VISION_NOT_SUPPORTED = 'VISION_NOT_SUPPORTED',
  RATE_LIMIT = 'RATE_LIMIT',
  TOKEN_LIMIT = 'TOKEN_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export class AIServiceError extends Error {
  public readonly type: AIErrorType;
  public readonly originalError?: Error;
  public readonly suggestion?: string;
  public readonly details?: Record<string, any>;

  constructor(
    type: AIErrorType,
    message: string,
    originalError?: Error,
    suggestion?: string,
    details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.type = type;
    this.originalError = originalError;
    this.suggestion = suggestion;
    this.details = details;
  }

  toUserFriendlyMessage(): string {
    const messages = [this.message];
    if (this.suggestion) {
      messages.push(`💡 Suggestion: ${this.suggestion}`);
    }
    return messages.join('\n');
  }
}

/**
 * Analyzes the error and returns a user-friendly error with suggestions
 */
export function handleAIServiceError(error: any, context?: {
  model?: string;
  hasImages?: boolean;
  action?: string;
}): AIServiceError {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const status = error?.status;
  const errorType = error?.error?.type;

  // API Key errors
  if (errorMessage.includes('API key') || 
      errorMessage.includes('api_key') || 
      errorMessage.includes('Unauthorized') ||
      status === 401) {
    return new AIServiceError(
      AIErrorType.API_KEY_MISSING,
      'Authentication failed: API key is invalid or missing',
      error,
      'Please check that your API key is correctly set in environment variables',
      { requiredEnvVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'] }
    );
  }

  // Rate limit errors
  if (errorMessage.includes('rate_limit') || 
      errorMessage.includes('rate limit') ||
      errorMessage.includes('Too Many Requests') ||
      status === 429) {
    return new AIServiceError(
      AIErrorType.RATE_LIMIT,
      'Rate limit exceeded: Too many requests to the AI service',
      error,
      'Please wait a moment before trying again or consider upgrading your API plan',
    );
  }

  // Token limit errors
  if (errorMessage.includes('maximum context') || 
      errorMessage.includes('token') && errorMessage.includes('limit') ||
      errorMessage.includes('too long') ||
      errorType === 'tokens_exceeded') {
    return new AIServiceError(
      AIErrorType.TOKEN_LIMIT,
      'Request too large: The input exceeds the model\'s token limit',
      error,
      'Try reducing the page content or using a model with higher token capacity',
      { model: context?.model }
    );
  }

  // Vision/Image errors
  if ((status === 422 || errorMessage.includes('image') || 
       errorMessage.includes('vision') || 
       errorMessage.includes('unsupported')) && 
      context?.hasImages) {
    return new AIServiceError(
      AIErrorType.VISION_NOT_SUPPORTED,
      `Model "${context.model}" does not support image/vision inputs`,
      error,
      'Use a vision-capable model like gpt-4o, gemini-2.5-pro, or claude-3-5-sonnet',
      { currentModel: context.model, suggestedModels: ['gpt-4o', 'gemini-2.5-pro', 'claude-3-5-sonnet'] }
    );
  }

  // JSON parsing errors
  if (errorMessage.includes('JSON') || 
      errorMessage.includes('json') ||
      errorMessage.includes('parse')) {
    return new AIServiceError(
      AIErrorType.JSON_PARSE_ERROR,
      'Failed to parse AI response: Invalid JSON format',
      error,
      'The AI response was incomplete or malformed. Try reducing input size or using a different model',
    );
  }

  // Network errors
  if (errorMessage.includes('ECONNREFUSED') || 
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch failed')) {
    return new AIServiceError(
      AIErrorType.NETWORK_ERROR,
      'Network error: Unable to connect to AI service',
      error,
      'Check your internet connection and proxy settings if applicable',
    );
  }

  // Invalid URL/Configuration
  if (errorMessage.includes('must be a valid URL') || 
      errorMessage.includes('Invalid URL')) {
    return new AIServiceError(
      AIErrorType.INVALID_CONFIG,
      'Invalid configuration: Base URL is not properly formatted',
      error,
      'Ensure OPENAI_BASE_URL starts with http:// or https://',
    );
  }

  // Permission denied
  if (status === 403 || errorMessage.includes('permission')) {
    return new AIServiceError(
      AIErrorType.PERMISSION_DENIED,
      'Permission denied: You don\'t have access to this resource',
      error,
      'Check your API key permissions or contact your API provider',
    );
  }

  // Service unavailable
  if (status === 503 || errorMessage.includes('unavailable')) {
    return new AIServiceError(
      AIErrorType.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable',
      error,
      'The AI service is experiencing issues. Please try again later',
    );
  }

  // Model not found
  if (errorMessage.includes('model') && 
      (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
    return new AIServiceError(
      AIErrorType.MODEL_NOT_SUPPORTED,
      `Model "${context?.model}" is not available`,
      error,
      'Check the model name or use a different model',
      { attemptedModel: context?.model }
    );
  }

  // Default unknown error
  return new AIServiceError(
    AIErrorType.UNKNOWN,
    `AI service error: ${errorMessage}`,
    error,
    'Please check your configuration and try again',
  );
}

/**
 * Formats error for logging with details
 */
export function formatErrorForLogging(error: AIServiceError): string {
  const lines = [
    `[AI-ERROR] ${error.type}: ${error.message}`,
  ];

  if (error.suggestion) {
    lines.push(`[AI-ERROR] Suggestion: ${error.suggestion}`);
  }

  if (error.details) {
    lines.push(`[AI-ERROR] Details: ${JSON.stringify(error.details, null, 2)}`);
  }

  if (error.originalError) {
    lines.push(`[AI-ERROR] Original: ${error.originalError.message}`);
  }

  return lines.join('\n');
}