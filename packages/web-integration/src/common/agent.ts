import type { WebPage } from '@/common/page';
import type {
  AgentAssertOpt,
  AgentDescribeElementAtPointResult,
  AgentWaitForOpt,
  AICaptchaResponse,
  AIUsageInfo,
  DetailedLocateParam,
  ExecutionDump,
  ExecutionRecorderItem,
  ExecutionTask,
  ExecutionTaskLog,
  Executor,
  GroupedActionDump,
  InsightAction,
  InsightExtractOption,
  InsightExtractParam,
  LocateOption,
  LocateResultElement,
  LocateValidatorResult,
  LocatorValidatorOption,
  MidsceneYamlScript,
  OnTaskStartTip,
  PlanningActionParamScroll,
  Rect,
} from 'rfi-ai-core';
import { Insight } from 'rfi-ai-core';
import { sleep } from 'rfi-ai-core/utils';

/**
 * Metadata for AI task execution
 */
export interface AITaskMetadata {
  /** Status of the task (pending, running, finished, failed, cancelled) */
  status?: string;
  /** Timestamp when the task started */
  start?: number;
  /** Timestamp when the task ended */
  end?: number;
  /** Total time taken to execute the task in milliseconds */
  totalTime?: number;
  /** Cache information */
  cache?: { hit: boolean };
  /** Token usage information */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    [key: string]: any;
  };
  /** DeepThink information */
  deepthink?: {
    used: boolean;
    mode: string;
    [key: string]: any;
  };
  /** AI's thought process */
  thought?: string;
  /** Element location information */
  locate?: any;
  /** Action plans */
  plan?: any;
  /** Planning information */
  planning?: {
    type: string;
    description: string;
    steps: string[];
  };
  /** Insight information */
  insight?: {
    type: string;
    description: string;
    elements: string[];
  };
  /** Action information */
  action?: {
    type: string;
    description: string;
    result: any;
  };
  /** Action details */
  actionDetails?: Array<{
    type: string;
    subType?: string;
    status: string;
    thought?: string;
  }>;
  /** Task details */
  tasks?: Array<{
    type: string;
    subType?: string;
    status: string;
    thought?: string;
    locate?: any;
    timing?: any;
    usage?: any;
    cache?: any;
    error?: string;
  }>;
}

/**
 * Result of an AI task with metadata
 */
export interface AITaskResult<T = any> {
  /** The actual result of the operation */
  result: T;
  /** Metadata about the task execution */
  metadata: AITaskMetadata;
}

// YAML support removed - use direct AI automation instead
import {
  groupedActionDumpFileExt,
  reportHTMLContent,
  stringifyDumpData,
  writeLogFile,
} from 'rfi-ai-core/utils';
import {
  DEFAULT_WAIT_FOR_NAVIGATION_TIMEOUT,
  DEFAULT_WAIT_FOR_NETWORK_IDLE_TIMEOUT,
} from 'rfi-ai-shared/constants';
import { getAIConfigInBoolean, overrideAIConfig, vlLocateMode } from 'rfi-ai-shared/env';
import { getDebug } from 'rfi-ai-shared/logger';
import { assert } from 'rfi-ai-shared/utils';
import { PageTaskExecutor } from '../common/tasks';
import type { PuppeteerWebPage } from '../puppeteer';
import type { WebElementInfo } from '../web-element';
import { TaskCache } from './task-cache';
import {
  paramStr,
  typeStr,
} from './ui-utils';
import { printReportMsg, reportFileName } from './utils';
import { type WebUIContext, parseContextFromWebPage } from './utils';
import { trimContextByViewport } from './utils';

const debug = getDebug('web-integration');

const defaultInsightExtractOption: InsightExtractOption = {
  domIncluded: false,
  screenshotIncluded: true,
};

// Helper functions for legacy methods
const distanceOfTwoPoints = (p1: [number, number], p2: [number, number]) => {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  return Math.round(Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2));
};

const includedInRect = (point: [number, number], rect: Rect) => {
  const [x, y] = point;
  const { left, top, width, height } = rect;
  return x >= left && x <= left + width && y >= top && y <= top + height;
};


export interface PageAgentOpt {
  forceSameTabNavigation?: boolean /* if limit the new tab to the current page, default true */;
  testId?: string;
  cacheId?: string;
  groupName?: string;
  groupDescription?: string;
  /* if auto generate report, default true */
  generateReport?: boolean;
  /* if auto print report msg, default true */
  autoPrintReportMsg?: boolean;
  onTaskStartTip?: OnTaskStartTip;
  aiActionContext?: string;
  waitForNavigationTimeout?: number;
  waitForNetworkIdleTimeout?: number;
  /* AI model temperature (0.0 - 1.0) */
  aiTemperature?: number;
  /* AI model seed for consistency */
  aiSeed?: number;
  /* Delay after AI actions in milliseconds (default: 250ms, 0 to disable) */
  postActionDelay?: number;
}

/**
 * Action history entry for context tracking
 */
interface ActionHistoryEntry {
  timestamp: number;
  action: string;
  target: string;
  selector?: string;
  value?: string;
  result?: 'success' | 'failed';
  description?: string;
  aiThought?: string; // AI's understanding from chain_of_thought
}

export class PageAgent<PageType extends WebPage = WebPage> {
  page: PageType;

  insight: Insight<WebElementInfo, WebUIContext>;

  dump: GroupedActionDump;

  reportFile?: string | null;

  reportFileName?: string;

  taskExecutor: PageTaskExecutor;

  opts: PageAgentOpt;

  /**
   * If true, the agent will not perform any actions
   */
  dryMode = false;

  onTaskStartTip?: OnTaskStartTip;

  taskCache?: TaskCache;
  
  private postActionDelay: number;
  
  /**
   * Action history for cumulative context tracking
   */
  private actionHistory: ActionHistoryEntry[] = [];
  
  /**
   * Maximum number of recent actions to keep in context
   */
  private readonly MAX_CONTEXT_ACTIONS = 5;

  constructor(page: PageType, opts?: PageAgentOpt) {
    this.page = page;
    this.opts = Object.assign(
      {
        generateReport: true,
        autoPrintReportMsg: true,
        groupName: 'Midscene Report',
        groupDescription: '',
      },
      opts || {},
    );
    
    // Set post-action delay from options (default 250ms)
    this.postActionDelay = opts?.postActionDelay ?? 250;

    // Override global AI config if agent-specific values are provided
    if (opts?.aiTemperature !== undefined || opts?.aiSeed !== undefined) {
      const aiConfigOverride: Record<string, string> = {};
      if (opts.aiTemperature !== undefined) {
        aiConfigOverride['AI_TEMPERATURE'] = opts.aiTemperature.toString();
      }
      if (opts.aiSeed !== undefined) {
        aiConfigOverride['AI_SEED'] = opts.aiSeed.toString();
      }
      overrideAIConfig(aiConfigOverride, true); // extend mode
    }

    if (
      this.page.pageType === 'puppeteer' ||
      this.page.pageType === 'playwright'
    ) {
      (this.page as PuppeteerWebPage).waitForNavigationTimeout =
        this.opts.waitForNavigationTimeout ||
        DEFAULT_WAIT_FOR_NAVIGATION_TIMEOUT;
      (this.page as PuppeteerWebPage).waitForNetworkIdleTimeout =
        this.opts.waitForNetworkIdleTimeout ||
        DEFAULT_WAIT_FOR_NETWORK_IDLE_TIMEOUT;
    }

    this.onTaskStartTip = this.opts.onTaskStartTip;
    // get the parent browser of the puppeteer page
    // const browser = (this.page as PuppeteerWebPage).browser();

    this.insight = new Insight<WebElementInfo, WebUIContext>(
      async (action: InsightAction) => {
        return this.getUIContext(action);
      },
    );

    if (opts?.cacheId && this.page.pageType !== 'android') {
      this.taskCache = new TaskCache(
        opts.cacheId,
        getAIConfigInBoolean('RAFI_CACHE'), // if we should use cache to match the element
      );
    }

    this.taskExecutor = new PageTaskExecutor(this.page, this.insight, {
      taskCache: this.taskCache,
      onTaskStart: this.callbackOnTaskStartTip.bind(this),
    });
    this.dump = this.resetDump();
    this.reportFileName = reportFileName(
      opts?.testId || this.page.pageType || 'web',
    );
  }

  async getUIContext(action?: InsightAction): Promise<WebUIContext> {
    if (action && (action === 'extract' || action === 'assert')) {
      return await parseContextFromWebPage(this.page, {
        ignoreMarker: true,
      });
    }
    return await parseContextFromWebPage(this.page, {
      ignoreMarker: !!vlLocateMode(),
    });
  }

  /**
   * Add an action to the history for context tracking
   */
  private addToActionHistory(entry: Omit<ActionHistoryEntry, 'timestamp'>): void {
    this.actionHistory.push({
      ...entry,
      timestamp: Date.now()
    });
    
    // Keep only recent actions to avoid context bloat
    if (this.actionHistory.length > this.MAX_CONTEXT_ACTIONS) {
      this.actionHistory = this.actionHistory.slice(-this.MAX_CONTEXT_ACTIONS);
    }
  }

  /**
   * Get formatted action history for AI context
   */
  private getActionContext(): string {
    if (this.actionHistory.length === 0) {
      return '';
    }
    
    // Keep only last 3 actions to avoid token bloat
    const recentActions = this.actionHistory.slice(-3).map(entry => {
      let action = entry.action.toLowerCase();
      if (action === 'tap') action = 'clicked';
      if (action === 'input') action = 'filled';
      
      // Keep it very short
      return `${action} "${entry.target.substring(0, 30)}"`;
    });
    
    // Check last action for workflow hints
    const lastAction = this.actionHistory[this.actionHistory.length - 1];
    let workflowHint = '';
    
    if (lastAction && lastAction.action === 'Input') {
      workflowHint = '\nIMPORTANT: Input was just filled. If dropdown/suggestions are visible, select from them (NOT the input again).';
    }
    
    // Very concise context
    return `\n\nRecent actions: ${recentActions.join(', ')}${workflowHint}`;
  }
  
  /**
   * Get detailed workflow log for debugging
   */
  public getWorkflowLog(): string {
    if (this.actionHistory.length === 0) {
      return '[WORKFLOW] No actions performed yet';
    }
    
    const entries = this.actionHistory.map((entry, idx) => {
      const timestamp = new Date(entry.timestamp).toISOString();
      let log = `\n[${idx + 1}] ${timestamp} - ${entry.action} on "${entry.target}"`;
      if (entry.selector) log += `\n    Selector: ${entry.selector}`;
      if (entry.value) log += `\n    Value: [hidden]`;
      if (entry.aiThought) log += `\n    AI Understanding: ${entry.aiThought.substring(0, 200)}`;
      if (entry.result) log += `\n    Result: ${entry.result}`;
      return log;
    });
    
    return `[WORKFLOW LOG]\n==============${entries.join('')}\n==============`;
  }

  async setAIActionContext(prompt: string) {
    this.opts.aiActionContext = prompt;
  }

  resetDump() {
    this.dump = {
      groupName: this.opts.groupName!,
      groupDescription: this.opts.groupDescription,
      executions: [],
    };

    return this.dump;
  }

  appendExecutionDump(execution: ExecutionDump) {
    // use trimContextByViewport to process execution
    const trimmedExecution = trimContextByViewport(execution);
    const currentDump = this.dump;
    currentDump.executions.push(trimmedExecution);
  }

  dumpDataString() {
    // update dump info
    this.dump.groupName = this.opts.groupName!;
    this.dump.groupDescription = this.opts.groupDescription;
    return stringifyDumpData(this.dump);
  }

  reportHTMLString() {
    return reportHTMLContent(this.dumpDataString());
  }

  writeOutActionDumps() {
    const { generateReport, autoPrintReportMsg } = this.opts;
    this.reportFile = writeLogFile({
      fileName: this.reportFileName!,
      fileExt: groupedActionDumpFileExt,
      fileContent: this.dumpDataString(),
      type: 'dump',
      generateReport,
    });
    debug('writeOutActionDumps', this.reportFile);
    if (generateReport && autoPrintReportMsg && this.reportFile) {
      printReportMsg(this.reportFile);
    }
  }

  private async callbackOnTaskStartTip(task: ExecutionTask) {
    const param = paramStr(task);
    const tip = param ? `${typeStr(task)} - ${param}` : typeStr(task);

    if (this.onTaskStartTip) {
      await this.onTaskStartTip(tip);
    }
  }

  private afterTaskRunning(executor: Executor, doNotThrowError = false) {
    // Legacy method - only used for fallback flow
    this.appendExecutionDump(executor.dump());
    this.writeOutActionDumps();

    if (executor.isInErrorState() && !doNotThrowError) {
      const errorTask = executor.latestErrorTask();
      throw new Error(`${errorTask?.error}`);
    }

    const lastTask = executor.tasks[executor.tasks.length - 1];
    
    // Simple metadata for legacy flow
    const metadata: AITaskMetadata = {
      status: lastTask?.status,
      start: lastTask?.timing?.start,
      end: lastTask?.timing?.end,
      totalTime: lastTask?.timing?.cost,
      usage: lastTask?.usage as any,
      thought: lastTask?.thought,
    };

    return metadata;
  }

  private buildDetailedLocateParam(
    locatePrompt: string,
    opt?: LocateOption,
  ): DetailedLocateParam {
    assert(locatePrompt, 'missing locate prompt');
    if (typeof opt === 'object') {
      const prompt = opt.prompt ?? locatePrompt;
      const deepThink = opt.deepThink ?? false;
      const cacheable = opt.cacheable ?? true;
      const xpath = opt.xpath;

      return {
        prompt,
        deepThink,
        cacheable,
        xpath,
      };
    }
    return {
      prompt: locatePrompt,
    };
  }

  /**
   * Create success response for AI methods and add post-action delay
   */
  private async createSuccessResponse(
    type: string,
    selector: string,
    additionalData?: any
  ): Promise<AITaskResult<any>> {
    // Add to action history for context tracking
    const target = additionalData?.target || additionalData?.prompt || selector;
    
    this.addToActionHistory({
      action: type,
      target,
      selector,
      value: additionalData?.value,
      result: 'success',
      description: `${type} on ${target}`,
      aiThought: additionalData?.aiThought
    });
    
    if (additionalData?.aiThought) {
      console.error(`[ACTION-CONTEXT] ${type} on "${target}" | AI: ${additionalData.aiThought.substring(0, 100)}... | History: ${this.actionHistory.length}`);
    } else {
      console.error(`[ACTION-CONTEXT] ${type} on "${target}" | History: ${this.actionHistory.length} actions`);
    }
    
    // Log action history summary for hirafi_run
    if (this.actionHistory.length > 0) {
      const summary = this.actionHistory.slice(-3).map(h => 
        `${h.action}:${h.target}${h.aiThought ? ' [' + h.aiThought.substring(0, 50) + '...]' : ''}`
      ).join(' -> ');
      console.error(`[WORKFLOW-SUMMARY] Recent flow: ${summary}`);
      
      // Also log formatted history every 3 actions for better debugging
      if (this.actionHistory.length % 3 === 0) {
        console.error(`\n[WORKFLOW-CHECKPOINT at ${this.actionHistory.length} actions]`);
        this.actionHistory.slice(-5).forEach((h, i) => {
          const relIdx = Math.max(0, this.actionHistory.length - 5) + i + 1;
          console.error(`  Step ${relIdx}: ${h.action} "${h.target}"`);
          if (h.aiThought) {
            console.error(`         AI: ${h.aiThought.substring(0, 100)}...`);
          }
        });
      }
    }
    
    // Add delay after action to let page stabilize
    // Skip delay for non-interactive actions like locate, assert
    const interactiveActions = ['Tap', 'Click', 'Input', 'RightClick', 'Hover', 'KeyboardPress', 'Scroll'];
    const delay = this.postActionDelay;
    
    if (interactiveActions.includes(type) && delay > 0) {
      console.error(`[POST-ACTION] Waiting ${delay}ms for page to stabilize after ${type}...`);
      await sleep(delay);
    }
    
    return {
      result: {
        success: true,
        selector,
        method: 'direct-puppeteer',
        ...additionalData
      },
      metadata: {
        status: 'finished',
        thought: `Direct AI locate returned selector: ${selector}`,
        action: {
          type,
          description: `Native Puppeteer ${type.toLowerCase()} on ${selector}`,
          result: { selector, method: 'direct', ...additionalData }
        }
      }
    };
  }

  /**
   * Common helper for direct AI element location
   * Used by all AI methods to reduce code duplication
   */
  private async directAILocate(
    locatePrompt: string,
    opt?: LocateOption,
    action: string = 'locate'
  ): Promise<{ selector?: string; error?: Error; aiThought?: string }> {
    try {
      console.error(`\n[DIRECT-${action.toUpperCase()}] Starting for: "${locatePrompt}"`);
      
      // 1. Get page context
      const pageContext = await parseContextFromWebPage(this.page, {
        ignoreMarker: true,
      });
      console.error(`[DIRECT-${action.toUpperCase()}] Got page context with DOM elements`);
      
      // 2. Add action history context to help AI understand the workflow
      const actionContext = this.getActionContext();
      if (actionContext) {
        console.error(`[DIRECT-${action.toUpperCase()}] Adding context from ${this.actionHistory.length} previous actions`);
        // Log the context for debugging in hirafi_run logs
        console.error(`[AI-CONTEXT]${actionContext}`);
      }
      const enhancedPrompt = locatePrompt + actionContext;
      
      // 3. Call AI's raw locate method with enhanced prompt
      const locateParam = this.buildDetailedLocateParam(enhancedPrompt, opt);
      const rawAIResponse = await (this.insight as any)._unstableRawLocate(
        locateParam,
        { context: pageContext }
      );
      console.error(`[DIRECT-${action.toUpperCase()}] Raw AI response received`);
      
      // Log full workflow for debugging
      if (this.actionHistory.length > 0) {
        console.error(this.getWorkflowLog());
      }
      
      // 3. Extract selector and AI's understanding
      if (rawAIResponse?.elements?.length > 0) {
        const element = rawAIResponse.elements[0];
        const selector = element.xpath;
        
        // Extract AI's understanding from chain_of_thought
        let aiThought: string | undefined;
        if (rawAIResponse.chain_of_thought) {
          const thought = rawAIResponse.chain_of_thought;
          // Combine relevant thoughts
          aiThought = [
            thought.screenshot_analysis,
            thought.element_selection,
            element.reason
          ].filter(Boolean).join(' | ');
        }
        
        console.error(`[DIRECT-${action.toUpperCase()}] ✅ Found xpath selector: ${selector}`);
        if (aiThought) {
          console.error(`[DIRECT-${action.toUpperCase()}] 🧠 AI Understanding: ${aiThought.substring(0, 150)}...`);
          // Log AI understanding for hirafi_run
          console.error(`[AI-THOUGHT] ${action}: ${aiThought}`);
        }
        
        return { selector, aiThought };
      } 
      
      // Handle different error cases with specific messages
      let errorMessage: string;
      if (rawAIResponse?.errors?.length > 0) {
        console.error(`[DIRECT-${action.toUpperCase()}] ❌ AI errors: ${rawAIResponse.errors.join(', ')}`);
        errorMessage = rawAIResponse.errors[0] || `Element not found: "${locatePrompt}"`;
      } else {
        console.error(`[DIRECT-${action.toUpperCase()}] ⚠️ No elements found in AI response`);
        errorMessage = `No element matching "${locatePrompt}" was found on the page`;
      }
      
      return { error: new Error(errorMessage) };
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error(`[DIRECT-${action.toUpperCase()}] ❌ Error: ${errorMsg}`);
      
      // Provide more context in error messages
      if (errorMsg.includes('timeout')) {
        return { error: new Error(`Timeout while locating "${locatePrompt}": ${errorMsg}`) };
      } else if (errorMsg.includes('network')) {
        return { error: new Error(`Network error while locating "${locatePrompt}": ${errorMsg}`) };
      }
      
      return { error: new Error(`Failed to locate "${locatePrompt}": ${errorMsg}`) };
    }
  }

  async aiTap(locatePrompt: string, opt?: LocateOption): Promise<AITaskResult<any>> {
    // DIRECT AI TO PUPPETEER FLOW - Clean and simple
    if (this.page.pageType === 'puppeteer') {
      const { selector, error, aiThought } = await this.directAILocate(locatePrompt, opt, 'TAP');
      
      if (selector) {
        try {
          console.error(`[DIRECT-TAP] 🎯 Attempting native Puppeteer click on: ${selector}`);
          await (this.page as any).clickBySelector(selector);
          console.error(`[DIRECT-TAP] ✅ Successfully clicked element`);
          return await this.createSuccessResponse('Tap', selector, { target: locatePrompt, aiThought });
        } catch (clickError) {
          const errorMsg = (clickError as Error).message;
          console.error(`[DIRECT-TAP] ❌ Click failed: ${errorMsg}`);
          
          // Provide specific error messages
          if (errorMsg.includes('not found')) {
            throw new Error(`Element no longer exists on page: ${selector}`);
          } else if (errorMsg.includes('not visible')) {
            throw new Error(`Element is not visible or clickable: ${selector}`);
          }
          
          throw new Error(`Failed to click element "${locatePrompt}": ${errorMsg}`);
        }
      }
      
      // Use the error from directAILocate if available
      if (error) {
        throw error;
      }
    }
    
    throw new Error(`Cannot tap element "${locatePrompt}": Puppeteer page required`);
  }

  async aiRightClick(locatePrompt: string, opt?: LocateOption): Promise<AITaskResult<any>> {
    if (this.page.pageType === 'puppeteer') {
      const { selector, error, aiThought } = await this.directAILocate(locatePrompt, opt, 'RIGHTCLICK');
      
      if (selector) {
        try {
          console.error(`[DIRECT-RIGHTCLICK] 🎯 Attempting native Puppeteer right-click on: ${selector}`);
          await ((this.page as any).underlyingPage).waitForSelector(selector, { visible: true, timeout: 5000 });
          const element = await ((this.page as any).underlyingPage).$(selector);
          if (element) {
            await element.click({ button: 'right' });
            console.error(`[DIRECT-RIGHTCLICK] ✅ Successfully right-clicked`);
            return await this.createSuccessResponse('RightClick', selector, { target: locatePrompt, aiThought });
          }
          throw new Error(`Element found but could not be accessed: ${selector}`);
        } catch (err) {
          const errorMsg = (err as Error).message;
          console.error(`[DIRECT-RIGHTCLICK] ❌ Error: ${errorMsg}`);
          
          if (errorMsg.includes('timeout')) {
            throw new Error(`Element not visible within timeout: "${locatePrompt}"`);
          }
          
          throw new Error(`Failed to right-click "${locatePrompt}": ${errorMsg}`);
        }
      }
      
      if (error) {
        throw error;
      }
    }
    
    throw new Error(`Cannot right-click element "${locatePrompt}": Puppeteer page required`);
  }

  async aiHover(locatePrompt: string, opt?: LocateOption): Promise<AITaskResult<any>> {
    if (this.page.pageType === 'puppeteer') {
      const { selector, error, aiThought } = await this.directAILocate(locatePrompt, opt, 'HOVER');
      
      if (selector) {
        try {
          console.error(`[DIRECT-HOVER] 🎯 Attempting native Puppeteer hover on: ${selector}`);
          await (this.page as any).hoverBySelector(selector);
          console.error(`[DIRECT-HOVER] ✅ Successfully hovered`);
          return await this.createSuccessResponse('Hover', selector, { target: locatePrompt, aiThought });
        } catch (err) {
          const errorMsg = (err as Error).message;
          console.error(`[DIRECT-HOVER] ❌ Error: ${errorMsg}`);
          
          if (errorMsg.includes('not found')) {
            throw new Error(`Element no longer exists on page: "${locatePrompt}"`);
          }
          
          throw new Error(`Failed to hover over "${locatePrompt}": ${errorMsg}`);
        }
      }
      
      if (error) {
        throw error;
      }
    }
    
    throw new Error(`Cannot hover over element "${locatePrompt}": Puppeteer page required`);
  }

  async aiInput(value: string, locatePrompt: string, opt?: LocateOption): Promise<AITaskResult<any>> {
    assert(
      typeof value === 'string',
      'input value must be a string, use empty string if you want to clear the input',
    );
    assert(locatePrompt, 'missing locate prompt for input');
    
    if (this.page.pageType === 'puppeteer') {
      const { selector, error, aiThought } = await this.directAILocate(locatePrompt, opt, 'INPUT');
      
      if (selector) {
        try {
          console.error(`[DIRECT-INPUT] 🎯 Attempting native Puppeteer input on: ${selector}`);
          
          // Clear existing text first
          await (this.page as any).clearBySelector(selector);
          console.error(`[DIRECT-INPUT] Cleared existing text`);
          
          // Type new value
          await (this.page as any).typeBySelector(selector, value);
          console.error(`[DIRECT-INPUT] ✅ Successfully typed: "${value}"`);
          return await this.createSuccessResponse('Input', selector, { value, target: locatePrompt, aiThought });
        } catch (err) {
          const errorMsg = (err as Error).message;
          console.error(`[DIRECT-INPUT] ❌ Error: ${errorMsg}`);
          
          if (errorMsg.includes('not found')) {
            throw new Error(`Input field no longer exists: "${locatePrompt}"`);
          } else if (errorMsg.includes('disabled')) {
            throw new Error(`Input field is disabled: "${locatePrompt}"`);
          }
          
          throw new Error(`Failed to input text into "${locatePrompt}": ${errorMsg}`);
        }
      }
      
      if (error) {
        throw error;
      }
    }
    
    throw new Error(`Cannot input text into "${locatePrompt}": Puppeteer page required`);
  }

  async aiKeyboardPress(
    keyName: string,
    locatePrompt?: string,
    opt?: LocateOption,
  ): Promise<AITaskResult<any>> {
    assert(keyName, 'missing keyName for keyboard press');
    
    if (this.page.pageType === 'puppeteer') {
      // If we have a locate prompt, find and focus the element first
      if (locatePrompt) {
        const { selector, error } = await this.directAILocate(locatePrompt, opt, 'KEYPRESS');
        
        if (error) {
          throw new Error(`Cannot focus element for key press: ${error.message}`);
        }
        
        if (selector) {
          try {
            console.error(`[DIRECT-KEYPRESS] 🎯 Focusing element: ${selector}`);
            await ((this.page as any).underlyingPage).waitForSelector(selector, { visible: true, timeout: 5000 });
            const element = await ((this.page as any).underlyingPage).$(selector);
            if (element) {
              await element.focus();
              console.error(`[DIRECT-KEYPRESS] Element focused`);
            }
          } catch (err) {
            console.error(`[DIRECT-KEYPRESS] ⚠️ Could not focus element: ${(err as Error).message}`);
            // Continue with key press anyway
          }
        }
      }
      
      // Press the key
      try {
        console.error(`[DIRECT-KEYPRESS] 🎹 Pressing key: ${keyName}`);
        await this.page.keyboard.press([{ key: keyName as any }]);
        console.error(`[DIRECT-KEYPRESS] ✅ Successfully pressed key: ${keyName}`);
        return await this.createSuccessResponse('KeyboardPress', keyName, { key: keyName });
      } catch (err) {
        const errorMsg = (err as Error).message;
        console.error(`[DIRECT-KEYPRESS] ❌ Error: ${errorMsg}`);
        
        if (errorMsg.includes('Unknown key')) {
          throw new Error(`Invalid key name "${keyName}": ${errorMsg}`);
        }
        
        throw new Error(`Failed to press key "${keyName}": ${errorMsg}`);
      }
    }
    
    throw new Error(`Cannot press key "${keyName}": Puppeteer page required`);
  }

  /**
   * AI-powered scroll to element or direction
   * @param prompt Natural language description (e.g., "scroll to submit button", "scroll down to comments section")
   * @param opt Optional configuration
   */
  async aiScroll(prompt: string, opt?: LocateOption): Promise<AITaskResult<any>> {
    // DIRECT AI TO NATIVE SCROLL FLOW
    if (this.page.pageType === 'puppeteer' || this.page.pageType === 'android') {
      console.error(`\n[DIRECT-SCROLL] Starting for: "${prompt}"`);
      
      // Parse the scroll intent - is it to an element or just a direction?
      const directionMatch = prompt.match(/^scroll\s+(up|down|left|right|top|bottom)\s*$/i);
      const isElementScroll = !directionMatch;
      
      if (isElementScroll) {
        // AI finds the target element to scroll to
        const { selector, error, aiThought } = await this.directAILocate(prompt, opt, 'SCROLL');
        
        if (selector) {
          try {
            console.error(`[DIRECT-SCROLL] 🎯 Scrolling to element: ${selector}`);
            
            // Use native scrollToSelector method
            await (this.page as any).scrollToSelector(selector);
            console.error(`[DIRECT-SCROLL] ✅ Successfully scrolled to element`);
            
            return await this.createSuccessResponse('Scroll', selector, { scrollTo: selector, target: prompt, aiThought });
          } catch (scrollError) {
            const errorMsg = (scrollError as Error).message;
            console.error(`[DIRECT-SCROLL] ❌ Scroll failed: ${errorMsg}`);
            throw new Error(`Failed to scroll to element "${prompt}": ${errorMsg}`);
          }
        }
        
        if (error) {
          throw error;
        }
      } else {
        // Simple directional scroll
        const direction = directionMatch[1].toLowerCase();
        
        try {
          console.error(`[DIRECT-SCROLL] 📜 Scrolling ${direction}`);
          
          if (direction === 'top') {
            await this.page.scrollUntilTop();
          } else if (direction === 'bottom') {
            await this.page.scrollUntilBottom();
          } else if (direction === 'up') {
            await this.page.scrollUp();
          } else if (direction === 'down') {
            await this.page.scrollDown();
          } else if (direction === 'left') {
            await this.page.scrollLeft();
          } else if (direction === 'right') {
            await this.page.scrollRight();
          }
          
          console.error(`[DIRECT-SCROLL] ✅ Scrolled ${direction}`);
          return await this.createSuccessResponse('Scroll', direction, { direction, target: `scroll ${direction}` });
        } catch (scrollError) {
          const errorMsg = (scrollError as Error).message;
          console.error(`[DIRECT-SCROLL] ❌ Scroll failed: ${errorMsg}`);
          throw new Error(`Failed to scroll ${direction}: ${errorMsg}`);
        }
      }
    }
    
    throw new Error(`Cannot scroll: "${prompt}" - Puppeteer or Android page required`);
  }

  // Removed unused helper methods - if needed, they can be restored from git history
  // detectAndroidDeviceType, buildScrollIntelligentPrompt, buildLegacyScrollPrompt, getPageScrollContext
  
  /* Placeholder for future extensions
  private detectAndroidDeviceType(width: number, height: number): 'phone' | 'tablet' | 'tv' {
    const maxDimension = Math.max(width, height);
    const minDimension = Math.min(width, height);
    
    // TV/Large displays
    if (maxDimension >= 1920 || minDimension >= 1080) {
      return 'tv';
    }
    
    // Tablets (typically 7+ inches, around 1024+ pixels in landscape)
    if (maxDimension >= 1024 && minDimension >= 600) {
      return 'tablet';
    }
    
    // Phones
    return 'phone';
  }

  /**
   * Build intelligent scroll prompt with contextual awareness
   */
//   private async buildScrollIntelligentPrompt(
//     userPrompt: string, 
//     context: Awaited<ReturnType<typeof this.getPageScrollContext>>
//   ): Promise<string> {
//     if (context.platform === 'android') {
//       return this.buildAndroidScrollPrompt(userPrompt, context);
//     } else {
//       return this.buildWebScrollPrompt(userPrompt, context);
//     }
//   }
// 
//   /**
//    * Build Android-specific intelligent scroll prompt
//    */
//   private buildAndroidScrollPrompt(
//     userPrompt: string,
//     context: Extract<Awaited<ReturnType<typeof this.getPageScrollContext>>, { platform: 'android' }>
//   ): string {
//     return `ANDROID SCROLL ACTION REQUEST: ${userPrompt}
// 
// ANDROID DEVICE CONTEXT:
// - Screen Size: ${context.screen.width}x${context.screen.height} pixels
// - Device Type: ${context.device.type} (${context.device.orientation})
// - Platform: Android Native App
// 
// You are an intelligent Android UI automation system with native app understanding. Analyze the user's scroll request with Android-specific intelligence:
// 
// 🤖 ANDROID SCROLL INTELLIGENCE:
// - Understand touch gestures and swipe mechanics for Android devices
// - Adapt scroll behavior for different Android device types (phone/tablet/tv)
// - Consider Android-specific UI patterns (lists, recycler views, scrolling containers)
// - Calculate optimal swipe distances for Android touch interactions
// 
// 📱 DEVICE-AWARE SCROLL DECISIONS:
// Make intelligent Android scroll choices:
// - PHONE (${context.device.type === 'phone' ? 'CURRENT' : 'OTHER'}): Smaller, precise finger swipes (~200-400px)
// - TABLET (${context.device.type === 'tablet' ? 'CURRENT' : 'OTHER'}): Medium swipe distances (~400-600px)  
// - TV (${context.device.type === 'tv' ? 'CURRENT' : 'OTHER'}): Larger navigation movements (~600-800px)
// 
// 🔄 ANDROID GESTURE INTELLIGENCE:
// - SHORT SWIPE: "a bit", "little" → ~20-30% of screen dimension
// - MEDIUM SWIPE: default scroll → ~70% of screen dimension (Android standard)
// - LONG SWIPE: "a lot", "far" → ~90% of screen dimension
// - UNTIL CONDITIONS: "until end/bottom" → Multiple repeated swipes with momentum
// 
// 🎯 ANDROID UI CONTEXT AWARENESS:
// Understand Android app patterns:
// - RecyclerView/ListView scrolling: Smooth, content-aligned swipes
// - ViewPager/Fragment scrolling: Full-screen horizontal swipes
// - NestedScrollView: Nested scroll behavior awareness
// - Pull-to-refresh: Consider gesture direction conflicts
// 
// Execute the most natural Android touch gesture that accomplishes the user's scroll intent effectively.`;
//   }
// 
//   /**
//    * Build Web-specific intelligent scroll prompt
//    */
//   private buildWebScrollPrompt(
//     userPrompt: string,
//     context: Extract<Awaited<ReturnType<typeof this.getPageScrollContext>>, { platform: 'web' }>
//   ): string {
//     return `WEB SCROLL ACTION REQUEST: ${userPrompt}
// 
// CURRENT WEB CONTEXT:
// - Viewport Size: ${context.viewport.width}x${context.viewport.height} pixels
// - Device Pixel Ratio: ${context.viewport.dpr}x
// - Page Domain: ${context.page.domain}
// - Current URL: ${context.page.url}
// 
// You are an intelligent web UI automation system with full contextual awareness. Analyze the user's scroll request and make intelligent decisions based on:
// 
// 🧠 INTELLIGENT ANALYSIS:
// You must understand and infer from context:
// - User's intent and goal from their natural language (any language)
// - Appropriate scroll behavior for the current viewport size and page type
// - Whether this is a mobile-sized view, tablet, desktop, or large screen
// - Page content type (e-commerce, social media, documentation, etc.) based on domain/URL
// - Optimal scroll distances relative to viewport dimensions
// 
// 🎯 CONTEXTUAL SCROLL INTELLIGENCE:
// Make smart decisions about:
// - SMALL SCROLL: When user says "a bit", "little", "slightly" → Calculate ~10-20% of viewport height
// - MEDIUM SCROLL: When user says "scroll down" without qualifier → Calculate ~60-80% of viewport height  
// - LARGE SCROLL: When user says "a lot", "much", "far" → Calculate ~100-120% of viewport height
// - UNTIL CONDITIONS: When user says "until end/bottom/top" → Use appropriate 'until*' scrollType
// - ELEMENT-SPECIFIC: When mentioning dropdowns, lists, carousels → Adapt distance to element type
// 
// 🌐 VIEWPORT-AWARE DECISIONS:
// - On small screens (width < 768px): Use smaller, more precise scroll distances
// - On medium screens (768px-1024px): Use moderate scroll distances
// - On large screens (width > 1024px): Use larger scroll distances appropriately
// - Consider pixel density (DPR) in distance calculations
// 
// 📱 CONTENT-TYPE AWARENESS:
// Infer from domain and adapt behavior:
// - Social media sites: Smooth, content-preserving scrolls
// - E-commerce sites: Product-focused, methodical scrolling
// - Documentation sites: Section-based, reading-friendly scrolls
// - Search results: Result-group aware scrolling
// 
// 🎨 EXECUTION INTELLIGENCE:
// - Analyze user's language for scroll intensity cues
// - Calculate optimal distances based on viewport size
// - Choose appropriate scroll types based on user goals
// - Determine target elements intelligently from context
// - Use your reasoning to provide the most effective scroll action
// 
// Make intelligent inferences rather than following rigid patterns. Use contextual reasoning to determine the best scroll behavior that accomplishes the user's intent effectively.`;
//   }
// 
//   /**
//    * Convert legacy scroll parameters to intelligent context-aware prompt
//    */
//   private buildLegacyScrollPrompt(
//     scrollParam: PlanningActionParamScroll,
//     locatePrompt?: string,
//     context?: Awaited<ReturnType<typeof this.getPageScrollContext>>,
//   ): string {
//     let prompt = 'scroll';
//     
//     // Add direction
//     if (scrollParam.direction) {
//       prompt += ` ${scrollParam.direction}`;
//     }
//     
//     // Add target location
//     if (locatePrompt) {
//       prompt += ` in ${locatePrompt}`;
//     }
//     
//     // Add scroll behavior
//     if (scrollParam.scrollType) {
//       switch (scrollParam.scrollType) {
//         case 'untilBottom':
//           prompt += ' until bottom';
//           break;
//         case 'untilTop':
//           prompt += ' until top';
//           break;
//         case 'untilLeft':
//           prompt += ' until left edge';
//           break;
//         case 'untilRight':
//           prompt += ' until right edge';
//           break;
//         case 'once':
//         default:
//           // Add distance if specified
//           if (scrollParam.distance) {
//             prompt += ` ${scrollParam.distance} pixels`;
//           }
//           break;
//       }
//     } else if (scrollParam.distance) {
//       prompt += ` ${scrollParam.distance} pixels`;
//     }
// 
//     // Add context awareness for legacy calls
//     if (context) {
//       prompt += `
// 
// SCROLL CONTEXT (Legacy API Call):`;
//       
//       if (context.viewport) {
//         prompt += `
// - Current viewport: ${context.viewport.width}x${context.viewport.height}px`;
//       }
//       
//       if (context.page?.domain) {
//         prompt += `
// - Page: ${context.page.domain}`;
//       }
//       
//       prompt += `
// - Use intelligent scroll behavior based on viewport size and page context
// - Apply contextual reasoning for optimal scroll execution`;
//     }
//     
//     return prompt;
//   }

  async aiAction(
    taskPrompt: string,
    opt?: {
      cacheable?: boolean;
    },
  ): Promise<AITaskResult> {
    const cacheable = opt?.cacheable;
    // if vlm-ui-tars, plan cache is not used
    const isVlmUiTars = vlLocateMode() === 'vlm-ui-tars';
    const matchedCache =
      isVlmUiTars || cacheable === false
        ? undefined
        : this.taskCache?.matchPlanCache(taskPrompt);
    if (matchedCache && this.taskCache?.isCacheResultUsed) {
      // YAML workflow execution removed - cache hit but no YAML support
      debug('matched cache, but YAML workflow not supported');
      // Fall through to regular execution
    }

    const { output, executor } = await (isVlmUiTars
      ? this.taskExecutor.actionToGoal(taskPrompt, { cacheable })
      : this.taskExecutor.action(taskPrompt, this.opts.aiActionContext, {
          cacheable,
        }));

    // update cache - YAML workflow caching disabled
    if (this.taskCache && output?.yamlFlow && cacheable !== false) {
      // YAML workflow caching disabled - skipping cache update
      debug('YAML workflow caching disabled, skipping cache update');
    }

    const metadata = this.afterTaskRunning(executor);
    return {
      result: output,
      metadata
    };
  }

  async aiQuery(demand: any): Promise<AITaskResult> {
    const { output, executor } = await this.taskExecutor.query(demand);
    const metadata = this.afterTaskRunning(executor);
    return {
      result: output,
      metadata
    };
  }

  async aiBoolean(prompt: string): Promise<AITaskResult<boolean>> {
    const { output, executor } = await this.taskExecutor.boolean(prompt);
    const metadata = this.afterTaskRunning(executor);
    return {
      result: output,
      metadata
    };
  }

  async aiNumber(prompt: string): Promise<AITaskResult<number>> {
    const { output, executor } = await this.taskExecutor.number(prompt);
    const metadata = this.afterTaskRunning(executor);
    return {
      result: output,
      metadata
    };
  }

  async aiString(prompt: string): Promise<AITaskResult<string>> {
    const { output, executor } = await this.taskExecutor.string(prompt);
    const metadata = this.afterTaskRunning(executor);
    return {
      result: output,
      metadata
    };
  }

  async aiAsk(
    prompt: string,
    _opt: InsightExtractOption = defaultInsightExtractOption,
  ) {
    return this.aiString(prompt);
  }

  async describeElementAtPoint(
    center: [number, number],
    opt?: {
      verifyPrompt?: boolean;
      retryLimit?: number;
      deepThink?: boolean;
    } & LocatorValidatorOption,
  ): Promise<AgentDescribeElementAtPointResult> {
    const { verifyPrompt = true, retryLimit = 3 } = opt || {};

    let success = false;
    let retryCount = 0;
    let resultPrompt = '';
    let deepThink = opt?.deepThink || false;
    let verifyResult: LocateValidatorResult | undefined;

    while (!success && retryCount < retryLimit) {
      if (retryCount >= 2) {
        deepThink = true;
      }
      debug(
        'aiDescribe',
        center,
        'verifyPrompt',
        verifyPrompt,
        'retryCount',
        retryCount,
        'deepThink',
        deepThink,
      );
      const text = await this.insight.describe(center, { deepThink });
      debug('aiDescribe text', text);
      assert(text.description, `failed to describe element at [${center}]`);
      resultPrompt = text.description;

      verifyResult = await this.verifyLocator(
        resultPrompt,
        deepThink ? { deepThink: true } : undefined,
        center,
        opt,
      );
      if (verifyResult.pass) {
        success = true;
      } else {
        retryCount++;
      }
    }

    return {
      prompt: resultPrompt,
      deepThink,
      verifyResult,
    };
  }

  async verifyLocator(
    prompt: string,
    locateOpt: LocateOption | undefined,
    expectCenter: [number, number],
    verifyLocateOption?: LocatorValidatorOption,
  ): Promise<LocateValidatorResult> {
    debug('verifyLocator', prompt, locateOpt, expectCenter, verifyLocateOption);

    const locateResult = await this.aiLocate(prompt, locateOpt);
    const { center: verifyCenter, rect: verifyRect } = locateResult.result;

    const distance = distanceOfTwoPoints(expectCenter, verifyCenter);
    const included = includedInRect(expectCenter, verifyRect);
    const pass =
      distance <= (verifyLocateOption?.centerDistanceThreshold || 20) ||
      included;
    const verifyResult = {
      pass,
      rect: verifyRect,
      center: verifyCenter,
      centerDistance: distance,
    };
    debug('aiDescribe verifyResult', verifyResult);
    return verifyResult;
  }

  async aiLocate(prompt: string, opt?: LocateOption): Promise<AITaskResult<Pick<LocateResultElement, 'rect' | 'center'>>> {
    if (this.page.pageType === 'puppeteer') {
      const { selector, error } = await this.directAILocate(prompt, opt, 'LOCATE');
      
      if (selector) {
        try {
          // Get element rect using Puppeteer
          const rect = await ((this.page as any).underlyingPage).evaluate((sel: string) => {
            const elem = document.querySelector(sel);
            if (elem) {
              const box = elem.getBoundingClientRect();
              return {
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height
              };
            }
            return null;
          }, selector);
          
          if (rect) {
            const center = [rect.left + rect.width / 2, rect.top + rect.height / 2] as [number, number];
            console.error(`[DIRECT-LOCATE] ✅ Got element rect and center`);
            
            return {
              result: { rect, center },
              metadata: {
                status: 'finished',
                thought: `Direct AI locate found element: ${selector}`,
                action: { 
                  type: 'Locate', 
                  description: `Located element ${selector}`,
                  result: { selector, rect, center }
                }
              }
            };
          }
        } catch (err) {
          console.error(`[DIRECT-LOCATE] Could not get rect for selector: ${err}`);
        }
      }
      
      if (error) {
        throw error;
      }
    }
    
    throw new Error(`Element not found: "${prompt}"`);
  }

  async aiAssert(assertion: string, msg?: string, _opt?: AgentAssertOpt): Promise<AITaskResult<any>> {
    // Get the current page URL to include in the assertion context
    let currentUrl = "";
    if (this.page.url) {
      try {
        currentUrl = await this.page.url();
      } catch (e) {
        // Ignore errors getting URL
      }
    }

    // Add URL context to the assertion if available
    const assertionWithContext = currentUrl
      ? `For the page at URL "${currentUrl}", ${assertion}`
      : assertion;

    const { output, executor } = await this.taskExecutor.assert(assertionWithContext);
    const metadata = this.afterTaskRunning(executor, true);

    if (output && _opt?.keepRawResponse) {
      return {
        result: output,
        metadata,
      };
    }

    if (!output?.pass) {
      const errMsg = msg || `Assertion failed: ${assertion}`;
      const reasonMsg = `Reason: ${
        output?.thought || executor.latestErrorTask()?.error || '(no_reason)'
      }`;
      throw new Error(`${errMsg}\n${reasonMsg}`);
    }

    return {
      result: true,
      metadata
    };
  }

  async aiWaitFor(assertion: string, opt?: AgentWaitForOpt): Promise<AITaskResult> {
    const startTime = Date.now();
    const { executor } = await this.taskExecutor.waitFor(assertion, {
      timeoutMs: opt?.timeoutMs || 15 * 1000,
      checkIntervalMs: opt?.checkIntervalMs || 3 * 1000,
      assertion,
    });
    const metadata: AITaskMetadata = {
      status: executor.isInErrorState() ? 'failed' : 'finished',
      start: startTime,
      end: Date.now(),
      totalTime: Date.now() - startTime,
      thought: executor.latestErrorTask()?.thought,
      actionDetails: executor.tasks.map((task: any) => ({
        type: task.type,
        subType: task.subType,
        status: task.status,
        thought: task.thought,
      })),
    };

    this.appendExecutionDump(executor.dump());
    this.writeOutActionDumps();

    if (executor.isInErrorState()) {
      const errorTask = executor.latestErrorTask();
      throw new Error(`${errorTask?.error}\n${errorTask?.errorStack}`);
    }

    return {
      result: true, // Successfully waited
      metadata,
    };
  }

  async ai(
    taskPrompt: string,
    type = 'action',
    options?: { deepThink?: boolean; autoDetectComplexity?: boolean }
  ): Promise<AITaskResult> {
    if (type === 'action') {
      return this.aiAction(taskPrompt);
    }
    if (type === 'query') {
      return this.aiQuery(taskPrompt);
    }

    if (type === 'assert') {
      return this.aiAssert(taskPrompt);
    }

    if (type === 'tap') {
      return this.aiTap(taskPrompt, options);
    }

    if (type === 'rightClick') {
      return this.aiRightClick(taskPrompt, options);
    }

    throw new Error(
      `Unknown type: ${type}, only support 'action', 'query', 'assert', 'tap', 'rightClick'`,
    );
  }

  // YAML support has been removed - use direct AI automation instead
  // async runYaml(yamlScriptContent: string): Promise<AITaskResult<Record<string, any>>> {
  //   throw new Error('YAML support has been removed. Please use direct AI automation methods instead.');
  // }

  async evaluateJavaScript(script: string): Promise<any> {
    assert(
      this.page.evaluateJavaScript,
      'evaluateJavaScript is not supported in current agent',
    );
    if (this.page.evaluateJavaScript) {
      return this.page.evaluateJavaScript(script);
    }
    throw new Error('evaluateJavaScript is not supported in current agent');
  }

  async destroy() {
    await this.page.destroy();
  }

  async logScreenshot(
    title?: string,
    opt?: {
      content: string;
    },
  ) {
    // 1. screenshot
    const base64 = await this.page.screenshotBase64();
    const now = Date.now();
    // 2. build recorder
    const recorder: ExecutionRecorderItem[] = [
      {
        type: 'screenshot',
        ts: now,
        screenshot: base64,
      },
    ];
    // 3. build ExecutionTaskLog
    const task: ExecutionTaskLog = {
      type: 'Log',
      subType: 'Screenshot',
      status: 'finished',
      recorder,
      timing: {
        start: now,
        end: now,
        cost: 0,
      },
      param: {
        content: opt?.content || '',
      },
      executor: async () => {},
    };
    // 4. build ExecutionDump
    const executionDump: ExecutionDump = {
      sdkVersion: '',
      logTime: now,
      model_name: '',
      model_description: '',
      name: `Log - ${title || 'untitled'}`,
      description: opt?.content || '',
      tasks: [task],
    };
    // 5. append to execution dump
    this.appendExecutionDump(executionDump);
    this.writeOutActionDumps();
  }

  _unstableLogContent() {
    const { groupName, groupDescription, executions } = this.dump;
    const newExecutions = Array.isArray(executions)
      ? executions.map((execution: any) => {
          const { tasks, ...restExecution } = execution;
          let newTasks = tasks;
          if (Array.isArray(tasks)) {
            newTasks = tasks.map((task: any) => {
              // only remove pageContext and log from task
              const { pageContext, log, ...restTask } = task;
              return restTask;
            });
          }
          return { ...restExecution, ...(newTasks ? { tasks: newTasks } : {}) };
        })
      : [];
    return {
      groupName,
      groupDescription,
      executions: newExecutions,
    };
  }
}
