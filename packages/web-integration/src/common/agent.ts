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

import yaml from 'js-yaml';

import { ScriptPlayer, parseYamlScript } from '@/yaml/index';
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
import { buildPlans } from './plan-builder';
import { TaskCache } from './task-cache';
import {
  locateParamStr,
  paramStr,
  scrollParamStr,
  taskTitleStr,
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
        getAIConfigInBoolean('MIDSCENE_CACHE'), // if we should use cache to match the element
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
    // Always collect execution data for metadata
    this.appendExecutionDump(executor.dump());

    // Only write out dumps if not using Puppeteer
    this.writeOutActionDumps();

    if (executor.isInErrorState() && !doNotThrowError) {
      const errorTask = executor.latestErrorTask();
      throw new Error(`${errorTask?.error}`);
    }

    // Extract metadata from the executor
    const lastTask = executor.tasks[executor.tasks.length - 1];

    // Collect all tasks' thoughts and plans
    const allThoughts = executor.tasks
      .filter(task => task.thought)
      .map(task => task.thought);

    // Collect all locate information
    const allLocates = executor.tasks
      .filter(task => task.locate)
      .map(task => task.locate);

    // Collect all plans
    const allPlans = executor.tasks
      .filter(task => task.param?.plans)
      .map(task => task.param?.plans);

    // Collect tasks by type
    const planningTasks = executor.tasks.filter(task => task.type === 'Planning');
    const insightTasks = executor.tasks.filter(task => task.type === 'Insight');
    const actionTasks = executor.tasks.filter(task => task.type === 'Action');

    // Create planning, insight, and action information
    const planning = planningTasks.length > 0 ? {
      type: "Planning",
      description: `Planning for task execution`,
      steps: planningTasks.map(task => task.thought || 'Planning step')
    } : undefined;

    const insight = insightTasks.length > 0 ? {
      type: "Insight",
      description: `Insight for task execution`,
      elements: insightTasks.map(task => task.thought || 'Insight element')
    } : undefined;

    const action = actionTasks.length > 0 ? {
      type: "Action",
      description: `Action for task execution`,
      result: lastTask?.output
    } : undefined;

    // Create action details
    const actionDetails = executor.tasks.map(task => ({
      type: task.type,
      subType: task.subType,
      status: task.status,
      thought: task.thought
    }));

    // Extract detailed information from all tasks
    const metadata: AITaskMetadata = {
      status: lastTask?.status,
      start: lastTask?.timing?.start,
      end: lastTask?.timing?.end,
      totalTime: lastTask?.timing?.cost,
      cache: (lastTask as any)?.cache,
      usage: lastTask?.usage as any,
      thought: allThoughts.length > 0 ? allThoughts.join('\n') : lastTask?.thought,
      locate: allLocates.length > 0 ? allLocates : lastTask?.locate,
      plan: allPlans.length > 0 ? allPlans : lastTask?.param?.plans,
      // Add planning, insight, and action information
      planning,
      insight,
      action,
      actionDetails,
      // Include raw tasks for debugging
      tasks: executor.tasks.map(task => ({
        type: task.type,
        subType: task.subType,
        status: task.status,
        thought: task.thought,
        locate: task.locate,
        timing: task.timing,
        usage: task.usage as any,
        cache: (task as any)?.cache,
        error: task.error
      }))
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

  async aiTap(locatePrompt: string, opt?: LocateOption): Promise<AITaskResult> {
    const detailedLocateParam = this.buildDetailedLocateParam(
      locatePrompt,
      opt,
    );
    const plans = buildPlans('Tap', detailedLocateParam);
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('Tap', locateParamStr(detailedLocateParam)),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    return {
      result: output,
      metadata,
    };
  }

  async aiRightClick(locatePrompt: string, opt?: LocateOption): Promise<AITaskResult> {
    const detailedLocateParam = this.buildDetailedLocateParam(
      locatePrompt,
      opt,
    );
    const plans = buildPlans('RightClick', detailedLocateParam);
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('RightClick', locateParamStr(detailedLocateParam)),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    return {
      result: output,
      metadata,
    };
  }

  async aiHover(locatePrompt: string, opt?: LocateOption): Promise<AITaskResult> {
    const detailedLocateParam = this.buildDetailedLocateParam(
      locatePrompt,
      opt,
    );
    const plans = buildPlans('Hover', detailedLocateParam);
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('Hover', locateParamStr(detailedLocateParam)),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    return {
      result: output,
      metadata,
    };
  }

  async aiInput(value: string, locatePrompt: string, opt?: LocateOption): Promise<AITaskResult> {
    assert(
      typeof value === 'string',
      'input value must be a string, use empty string if you want to clear the input',
    );
    assert(locatePrompt, 'missing locate prompt for input');
    const detailedLocateParam = this.buildDetailedLocateParam(
      locatePrompt,
      opt,
    );
    const plans = buildPlans('Input', detailedLocateParam, {
      value,
    });
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('Input', locateParamStr(detailedLocateParam)),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    return {
      result: output,
      metadata,
    };
  }

  async aiKeyboardPress(
    keyName: string,
    locatePrompt?: string,
    opt?: LocateOption,
  ): Promise<AITaskResult> {
    assert(keyName, 'missing keyName for keyboard press');
    const detailedLocateParam = locatePrompt
      ? this.buildDetailedLocateParam(locatePrompt, opt)
      : undefined;
    const plans = buildPlans('KeyboardPress', detailedLocateParam, {
      value: keyName,
    });
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('KeyboardPress', locateParamStr(detailedLocateParam)),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    return {
      result: output,
      metadata,
    };
  }

  /**
   * AI-powered scroll with natural language input
   * @param prompt Natural language description of scroll action (e.g., "scroll down in the list until bottom")
   * @param opt Optional configuration
   */
  async aiScroll(prompt: string, opt?: LocateOption): Promise<AITaskResult>;
  /**
   * @deprecated Use string prompt instead. This method will be removed in future versions.
   * Legacy scroll with explicit parameters
   */
  async aiScroll(
    scrollParam: PlanningActionParamScroll,
    locatePrompt?: string,
    opt?: LocateOption,
  ): Promise<AITaskResult>;
  async aiScroll(
    promptOrParam: string | PlanningActionParamScroll,
    locatePromptOrOpt?: string | LocateOption,
    opt?: LocateOption,
  ): Promise<AITaskResult> {
    // New AI-powered approach with string prompt
    if (typeof promptOrParam === 'string') {
      const options = locatePromptOrOpt as LocateOption | undefined;
      return this.aiScrollWithPrompt(promptOrParam, options);
    }

    // Legacy approach - show deprecation warning
    console.warn(
      '⚠️  aiScroll with object parameters is deprecated. Use string prompt instead:\n' +
      '   Old: await agent.aiScroll({direction: "down", scrollType: "once"}, "list")\n' +
      '   New: await agent.aiScroll("scroll down in the list")'
    );

    // Legacy implementation
    const scrollParam = promptOrParam;
    const locatePrompt = locatePromptOrOpt as string | undefined;
    
    const detailedLocateParam = locatePrompt
      ? this.buildDetailedLocateParam(locatePrompt, opt)
      : undefined;
    const plans = buildPlans('Scroll', detailedLocateParam, scrollParam);
    const paramInTitle = locatePrompt
      ? `${locateParamStr(detailedLocateParam)} - ${scrollParamStr(scrollParam)}`
      : scrollParamStr(scrollParam);
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('Scroll', paramInTitle),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    return {
      result: output,
      metadata,
    };
  }

  /**
   * Parse natural language scroll prompt and execute scroll action
   */
  private async aiScrollWithPrompt(
    prompt: string,
    opt?: LocateOption,
  ): Promise<AITaskResult> {
    try {
      // Parse the natural language prompt to extract scroll parameters
      const parsedParams = await this.parseScrollPrompt(prompt);
      
      // Build detailed locate param if target is specified
      const detailedLocateParam = parsedParams.target
        ? this.buildDetailedLocateParam(parsedParams.target, opt)
        : undefined;

      // Build scroll plans with parsed parameters
      const scrollParam: PlanningActionParamScroll = {
        direction: parsedParams.direction,
        scrollType: parsedParams.scrollType,
        distance: parsedParams.distance,
      };

      const plans = buildPlans('Scroll', detailedLocateParam, scrollParam);
      const paramInTitle = parsedParams.target
        ? `${locateParamStr(detailedLocateParam)} - ${scrollParamStr(scrollParam)}`
        : scrollParamStr(scrollParam);
        
      const { executor, output } = await this.taskExecutor.runPlans(
        taskTitleStr('Scroll', paramInTitle),
        plans,
        { cacheable: opt?.cacheable },
      );
      const metadata = this.afterTaskRunning(executor);

      return {
        result: output,
        metadata,
      };
    } catch (error) {
      // Fallback to aiAction for complex cases
      console.log('🤖 aiScroll parsing failed, falling back to aiAction for:', prompt);
      return this.aiAction(prompt, { cacheable: opt?.cacheable });
    }
  }

  /**
   * Parse natural language scroll prompt using AI
   */
  private async parseScrollPrompt(prompt: string): Promise<{
    direction: 'up' | 'down' | 'left' | 'right';
    scrollType: 'once' | 'untilBottom' | 'untilTop' | 'untilRight' | 'untilLeft';
    distance?: number;
    target?: string;
  }> {
    // Simple pattern matching for common scroll commands
    const normalizedPrompt = prompt.toLowerCase().trim();

    // Extract target element (text after "in", "on", "of", etc.)
    let target: string | undefined;
    
    // Enhanced target extraction with dropdown/list specific patterns
    const targetPatterns = [
      // Dropdown specific patterns
      /(?:in|within|inside)\s+(?:the\s+)?(.+?(?:dropdown|select|menu|options|list))(?:\s+(?:until|by|to|for)|$)/,
      // General target patterns
      /(?:in|on|of|within|inside)\s+(?:the\s+)?(.+?)(?:\s+(?:until|by|to|for)|$)/,
      // "scroll the dropdown" pattern
      /scroll\s+(?:the\s+)?(.+?(?:dropdown|select|menu|options|list))(?:\s+(?:until|by|to|for|up|down|left|right)|$)/,
    ];

    for (const pattern of targetPatterns) {
      const match = normalizedPrompt.match(pattern);
      if (match) {
        target = match[1].trim();
        break;
      }
    }

    // Extract direction
    let direction: 'up' | 'down' | 'left' | 'right' = 'down'; // default
    if (normalizedPrompt.includes('up') || normalizedPrompt.includes('top')) {
      direction = 'up';
    } else if (normalizedPrompt.includes('down') || normalizedPrompt.includes('bottom')) {
      direction = 'down';
    } else if (normalizedPrompt.includes('left')) {
      direction = 'left';
    } else if (normalizedPrompt.includes('right')) {
      direction = 'right';
    }

    // Extract scroll type and distance
    let scrollType: 'once' | 'untilBottom' | 'untilTop' | 'untilRight' | 'untilLeft' = 'once';
    let distance: number | undefined;

    // Check for dropdown/list specific behavior first
    const isDropdownTarget = target && /(?:dropdown|select|menu|options|list)/i.test(target);
    
    // Check for "until" patterns
    if (normalizedPrompt.includes('until bottom') || normalizedPrompt.includes('to bottom')) {
      scrollType = 'untilBottom';
    } else if (normalizedPrompt.includes('until top') || normalizedPrompt.includes('to top')) {
      scrollType = 'untilTop';
    } else if (normalizedPrompt.includes('until left') || normalizedPrompt.includes('to left')) {
      scrollType = 'untilLeft';
    } else if (normalizedPrompt.includes('until right') || normalizedPrompt.includes('to right')) {
      scrollType = 'untilRight';
    } else if (normalizedPrompt.includes('to find') || normalizedPrompt.includes('until visible') || normalizedPrompt.includes('until see')) {
      // For dropdown searches, scroll until bottom is usually desired
      scrollType = isDropdownTarget ? 'untilBottom' : 'once';
      distance = isDropdownTarget ? undefined : 200;
    } else {
      // Check for specific distances
      const distanceMatch = normalizedPrompt.match(/(\d+)\s*(?:px|pixel|pixels)?/);
      if (distanceMatch) {
        distance = parseInt(distanceMatch[1], 10);
        scrollType = 'once';
      } else if (normalizedPrompt.includes('little') || normalizedPrompt.includes('small')) {
        distance = isDropdownTarget ? 50 : 100; // Smaller scroll for dropdowns
        scrollType = 'once';
      } else if (normalizedPrompt.includes('page') || normalizedPrompt.includes('screen')) {
        // Default page scroll distance
        scrollType = 'once';
        distance = isDropdownTarget ? 150 : undefined; // Smaller for dropdowns
      } else if (isDropdownTarget && !distance) {
        // Default dropdown scroll behavior
        distance = 100;
        scrollType = 'once';
      }
    }

    return {
      direction,
      scrollType,
      distance,
      target,
    };
  }

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
      // log into report file
      const { executor } = await this.taskExecutor.loadYamlFlowAsPlanning(
        taskPrompt,
        matchedCache.cacheContent?.yamlWorkflow,
      );

      const metadata = this.afterTaskRunning(executor);

      debug('matched cache, will call .runYaml to run the action');
      const yaml = matchedCache.cacheContent?.yamlWorkflow;
      const result = await this.runYaml(yaml);
      return {
        result: result.result,
        metadata
      };
    }

    const { output, executor } = await (isVlmUiTars
      ? this.taskExecutor.actionToGoal(taskPrompt, { cacheable })
      : this.taskExecutor.action(taskPrompt, this.opts.aiActionContext, {
          cacheable,
        }));

    // update cache
    if (this.taskCache && output?.yamlFlow && cacheable !== false) {
      const yamlContent = {
        tasks: [
          {
            name: taskPrompt,
            flow: output.yamlFlow,
          },
        ],
      };
      const yamlFlowStr = yaml.dump(yamlContent);
      this.taskCache.updateOrAppendCacheRecord(
        {
          type: 'plan',
          prompt: taskPrompt,
          yamlWorkflow: yamlFlowStr,
        },
        matchedCache,
      );
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
    opt: InsightExtractOption = defaultInsightExtractOption,
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
    const detailedLocateParam = this.buildDetailedLocateParam(prompt, opt);
    const plans = buildPlans('Locate', detailedLocateParam);
    const { executor, output } = await this.taskExecutor.runPlans(
      taskTitleStr('Locate', locateParamStr(detailedLocateParam)),
      plans,
      { cacheable: opt?.cacheable },
    );
    const metadata = this.afterTaskRunning(executor);

    const { element } = output;
    const result = {
      rect: element?.rect,
      center: element?.center,
    } as Pick<LocateResultElement, 'rect' | 'center'>;

    return {
      result,
      metadata
    };
  }

  async aiAssert(assertion: string, msg?: string, opt?: AgentAssertOpt): Promise<AITaskResult<any>> {
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

    if (output && opt?.keepRawResponse) {
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
      actionDetails: executor.tasks.map(task => ({
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

  async runYaml(yamlScriptContent: string): Promise<AITaskResult<Record<string, any>>> {
    const startTime = Date.now();
    const script = parseYamlScript(yamlScriptContent, 'yaml', true);
    const player = new ScriptPlayer(script, async () => {
      return { agent: this, freeFn: [] };
    });
    await player.run();

    const endTime = Date.now();
    const metadata: AITaskMetadata = {
      status: player.status,
      start: startTime,
      end: endTime,
      totalTime: endTime - startTime,
      tasks: player.taskStatusList.map(task => ({
        type: 'yaml-task',
        subType: task.name,
        status: task.status,
        error: task.error?.message,
      })),
    };

    if (player.status === 'error') {
      const errors = player.taskStatusList
        .filter((task) => task.status === 'error')
        .map((task) => {
          return `task - ${task.name}: ${task.error?.message}`;
        })
        .join('\n');
      throw new Error(`Error(s) occurred in running yaml script:\n${errors}`);
    }

    return {
      result: player.result,
      metadata
    };
  }

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
