import type { WebPage } from '@/common/page';
import type {
  AgentAssertOpt,
  AgentDescribeElementAtPointResult,
  AgentWaitForOpt,
  AICaptchaResponse,
  AIUsageInfo,
  DetailedLocateParam,
  ExecutionDump,
  ExecutionTask,
  Executor,
  GroupedActionDump,
  InsightAction,
  LocateOption,
  LocateResultElement,
  LocateValidatorResult,
  LocatorValidatorOption,
  MemoryConfig,
  MemoryItem,
  MemoryReport,
  MemoryStats,
  MemorySummary,
  OnTaskStartTip,
  PlanningActionParamScroll,
  Rect,
} from 'misoai-core';
import { Insight } from 'misoai-core';

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
} from 'misoai-core/utils';
import {
  DEFAULT_WAIT_FOR_NAVIGATION_TIMEOUT,
  DEFAULT_WAIT_FOR_NETWORK_IDLE_TIMEOUT,
} from 'misoai-shared/constants';
import { getAIConfigInBoolean, vlLocateMode } from 'misoai-shared/env';
import { getDebug } from 'misoai-shared/logger';
import { assert } from 'misoai-shared/utils';
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

const debug = getDebug('web-integration');

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
  /* memory configuration for workflow context */
  memoryConfig?: Partial<MemoryConfig>;
  /* session ID for memory tracking */
  sessionId?: string;
  /* workflow ID for memory tracking */
  workflowId?: string;
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
      memoryConfig: opts?.memoryConfig,
      sessionId: opts?.sessionId,
      workflowId: opts?.workflowId,
    });
    this.dump = this.resetDump();
    this.reportFileName = reportFileName(
      opts?.testId || this.page.pageType || 'web',
    );
  }

  async getUIContext(action?: InsightAction): Promise<WebUIContext> {
    if (action && (action === 'extract' || action === 'assert' || action === 'captcha')) {
      return await parseContextFromWebPage(this.page, {
        ignoreMarker: true,
      });
    }
    return await parseContextFromWebPage(this.page, {
      ignoreMarker: !!vlLocateMode(),
    });
  }

  // Helper method to call the insight.captcha method
  private async _callInsightCaptcha(options?: { deepThink?: boolean }): Promise<{ content: AICaptchaResponse; usage?: AIUsageInfo; deepThink?: boolean }> {
    // This is a workaround for TypeScript type checking
    // We know that insight.captcha exists because we added it
    const context = await this.getUIContext();

    // Include the current page URL in the context for better CAPTCHA analysis
    if (this.page.url) {
      const url = await this.page.url();
      context.url = url;
    }

    return (this.insight as any).captcha(context, options);
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
    const currentDump = this.dump;
    currentDump.executions.push(execution);
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
      cache: lastTask?.cache,
      usage: lastTask?.usage,
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
        usage: task.usage,
        cache: task.cache,
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
      return {
        prompt,
        deepThink,
        cacheable,
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

  async aiScroll(
    scrollParam: PlanningActionParamScroll,
    locatePrompt?: string,
    opt?: LocateOption,
  ): Promise<AITaskResult> {
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

    // YENİ: Hafıza bağlamını al ve action context'e ekle
    const memoryContext = this.getMemoryAsContext();
    const enhancedActionContext = this.opts.aiActionContext
      ? `${this.opts.aiActionContext}\n\nPrevious workflow steps:\n${memoryContext}`
      : memoryContext ? `Previous workflow steps:\n${memoryContext}` : undefined;

    const { output, executor } = await (isVlmUiTars
      ? this.taskExecutor.actionToGoal(taskPrompt, { cacheable })
      : this.taskExecutor.action(taskPrompt, enhancedActionContext, {
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

    // YENİ: Hafıza bağlamını al
    const memoryContext = this.getMemoryAsContext();

    // Add URL context to the assertion if available
    const assertionWithContext = currentUrl
      ? `For the page at URL "${currentUrl}", ${assertion}`
      : assertion;

    const { output, executor } = await this.taskExecutor.assert(assertionWithContext, memoryContext);
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

  async aiCaptcha(options?: { deepThink?: boolean; autoDetectComplexity?: boolean }): Promise<AITaskResult<any>> {
    const { deepThink = false, autoDetectComplexity = true } = options || {};

    // YENİ: Hafıza bağlamını al
    const memoryContext = this.getMemoryAsContext();

    // First, do a preliminary analysis to determine if this is a complex CAPTCHA
    // that would benefit from deep thinking
    let shouldUseDeepThink = deepThink;

    if (autoDetectComplexity && !deepThink) {
      // Get a screenshot to analyze
      const context = await this.getUIContext();
      const { screenshotBase64 } = context;

      // Simple analysis to determine if this is likely a complex CAPTCHA
      try {
        const complexityAnalysisPrompt = `
Analyze this screenshot and determine if it contains a complex CAPTCHA that would benefit from deep thinking.
A complex CAPTCHA typically has one or more of these characteristics:
- Distorted or overlapping text that is hard to read
- Multiple images that need to be selected based on a specific criteria
- Puzzles that require spatial reasoning
- Multiple steps or verification methods
- Small or hard-to-distinguish elements

Return only "complex" or "simple" based on your analysis.
`;

        const complexityMsgs = [
          { role: 'system', content: 'You are an AI assistant that analyzes screenshots to determine CAPTCHA complexity.' },
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
                text: complexityAnalysisPrompt,
              },
            ],
          },
        ];

        // Use a simple call to determine complexity
        // Using any here to avoid type issues since we're just checking the response text
        const complexityResult = await (this.insight as any).aiVendorFn(
          complexityMsgs,
          { type: 'extract_data' }
        );

        // Check if the response indicates a complex CAPTCHA
        const responseText = typeof complexityResult.content === 'string'
          ? complexityResult.content.toLowerCase()
          : JSON.stringify(complexityResult.content).toLowerCase();

        shouldUseDeepThink = responseText.includes('complex');

        debug('CAPTCHA complexity analysis:', responseText, 'Using deep think:', shouldUseDeepThink);
      } catch (error) {
        // If analysis fails, default to not using deep think
        debug('Failed to analyze CAPTCHA complexity:', error);
      }
    }

    // Call the AiCaptcha function to analyze the CAPTCHA with the determined deepThink setting
    const captchaResponse = await this._callInsightCaptcha({
      deepThink: shouldUseDeepThink
    });

    const captchaResult = captchaResponse.content;
    const usage = captchaResponse.usage;
    // Get the actual deepThink value that was used (may be different due to global settings)
    const actualDeepThink = captchaResponse.deepThink || false;

    // Process the CAPTCHA solution based on its type
    if (captchaResult.captchaType === 'text') {
      // For text-based CAPTCHAs, find the input field and enter the solution
      for (const action of captchaResult.actions) {
        if (action.type === 'click' && action.target) {
          // Click on the input field
          await this.aiTap(action.target, { deepThink: shouldUseDeepThink });
        } else if (action.type === 'input' && action.value) {
          // Enter the text solution
          if (action.target) {
            await this.aiInput(action.value, action.target, { deepThink: shouldUseDeepThink });
          }
        } else if (action.type === 'verify' && action.target) {
          // Click on the verify/submit button
          await this.aiTap(action.target, { deepThink: shouldUseDeepThink });
        }
      }
    } else if (captchaResult.captchaType === 'image') {
      // For image-based CAPTCHAs, click on the required elements
      for (const action of captchaResult.actions) {
        if (action.type === 'click') {
          if (action.coordinates) {
            // Click at specific coordinates using aiTap with coordinates
            const x = action.coordinates[0];
            const y = action.coordinates[1];
            await this.aiTap(`element at coordinates (${x}, ${y})`, { deepThink: shouldUseDeepThink });
          } else if (action.target) {
            // Click on described element
            await this.aiTap(action.target, { deepThink: shouldUseDeepThink });
          }
        } else if (action.type === 'verify' && action.target) {
          // Click on the verify/submit button
          await this.aiTap(action.target, { deepThink: shouldUseDeepThink });
        }
      }
    }

    // Wait a few seconds after completing the CAPTCHA
    await new Promise(resolve => setTimeout(resolve, 3000));

    // YENİ: Memory'ye kayıt için CAPTCHA çözümünü kaydet
    const captchaMemoryItem = {
      id: `captcha_${Date.now()}`,
      timestamp: Date.now(),
      taskType: 'Action' as const,
      summary: `Solved ${captchaResult.captchaType} CAPTCHA: ${captchaResult.thought}`,
      context: {
        url: await this.page.url?.() || '',
        captchaType: captchaResult.captchaType,
        actions: captchaResult.actions,
        deepThink: actualDeepThink
      },
      metadata: {
        executionTime: Date.now() - Date.now(), // Will be updated
        success: true,
        confidence: 0.9
      },
      tags: ['captcha', 'action', captchaResult.captchaType]
    };

    // Memory'ye kaydet
    this.taskExecutor.addToMemory(captchaMemoryItem);

    // Return the result with metadata
    const metadata: AITaskMetadata = {
      status: 'finished',
      usage,
      thought: captchaResult.thought,
    };

    // Add additional metadata properties using type assertion
    (metadata as any).deepThink = actualDeepThink;
    if (autoDetectComplexity && !deepThink) {
      (metadata as any).autoDetectedComplexity = shouldUseDeepThink;
    }

    return {
      result: captchaResult,
      metadata
    };
  }

  async aiWaitFor(assertion: string, opt?: AgentWaitForOpt): Promise<AITaskResult> {
    const startTime = Date.now();

    // YENİ: Hafıza bağlamını al
    const memoryContext = this.getMemoryAsContext();

    // Add memory context to assertion if available
    const assertionWithContext = memoryContext
      ? `${assertion}\n\nPrevious workflow steps:\n${memoryContext}`
      : assertion;

    const { executor } = await this.taskExecutor.waitFor(assertionWithContext, {
      timeoutMs: opt?.timeoutMs || 15 * 1000,
      checkIntervalMs: opt?.checkIntervalMs || 3 * 1000,
      assertion: assertionWithContext,
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

    if (type === 'captcha') {
      return this.aiCaptcha(options);
    }

    throw new Error(
      `Unknown type: ${type}, only support 'action', 'query', 'assert', 'tap', 'captcha'`,
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

  async logScreenshot(title?: string, options?: { content?: string }): Promise<void> {
    const screenshotTitle = title || 'untitled';
    const content = options?.content || '';

    // Take a screenshot and add it to the report
    const screenshot = await this.page.screenshotBase64?.();
    if (screenshot) {
      // Create a simple execution dump for the screenshot
      const executionDump: ExecutionDump = {
        name: screenshotTitle,
        description: content,
        tasks: [{
          type: 'Screenshot',
          subType: 'log',
          status: 'finished',
          executor: null,
          param: {
            title: screenshotTitle,
            content,
          },
          output: {
            screenshot,
          },
          thought: `Logged screenshot: ${screenshotTitle}`,
          timing: {
            start: Date.now(),
            end: Date.now(),
            cost: 0,
          },
        } as any],
        sdkVersion: '1.0.0',
        logTime: Date.now(),
        model_name: 'screenshot',
      };

      this.appendExecutionDump(executionDump);
    }
  }

  async destroy() {
    await this.page.destroy();
  }

  /**
   * Hafızayı bağlam olarak formatlar
   */
  private getMemoryAsContext(): string {
    const memory = this.taskExecutor.getMemory();
    if (memory.length === 0) {
      return '';
    }

    // Son 5 hafıza öğesini al ve özetlerini birleştir
    const recentMemory = memory.slice(-5);
    return recentMemory.map(item => `- ${item.summary}`).join('\n');
  }

  /**
   * Mevcut hafızayı döndürür
   */
  public getMemory(): readonly MemoryItem[] {
    return this.taskExecutor.getMemory();
  }

  /**
   * Hafıza istatistiklerini döndürür
   */
  public getMemoryStats(): MemoryStats {
    return this.taskExecutor.getMemoryStats();
  }

  /**
   * Hafızayı temizler
   */
  public clearMemory(): void {
    this.taskExecutor.clearMemory();
  }

  /**
   * Test sonunda kullanım için detaylı hafıza raporu döndürür (JSON formatında)
   */
  public getMemoryReport(): MemoryReport {
    const memory = this.getMemory();
    const stats = this.getMemoryStats();

    return {
      summary: {
        totalItems: memory.length,
        totalTasks: stats.analytics.totalTasks,
        memoryHits: stats.analytics.memoryHits,
        memoryMisses: stats.analytics.memoryMisses,
        memoryEffectiveness: Math.round(stats.analytics.memoryEffectiveness * 100),
        averageMemorySize: Math.round(stats.analytics.averageMemorySize * 100) / 100
      },
      config: stats.config,
      items: memory.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        taskType: item.taskType,
        summary: item.summary,
        context: item.context,
        metadata: item.metadata,
        tags: item.tags,
        relativeTime: this.formatRelativeTime(item.timestamp)
      })),
      analytics: {
        taskTypeDistribution: this.getTaskTypeDistribution(memory),
        successRate: this.calculateSuccessRate(memory),
        averageExecutionTime: this.calculateAverageExecutionTime(memory),
        dataExtractionCount: this.countDataExtractions(memory),
        workflowSteps: this.extractWorkflowSteps(memory)
      }
    };
  }

  /**
   * Test sonunda kullanım için basit hafıza özeti döndürür (JSON formatında)
   */
  public getMemorySummary(): MemorySummary {
    const memory = this.getMemory();
    const stats = this.getMemoryStats();

    return {
      totalItems: memory.length,
      memoryEffectiveness: `${Math.round(stats.analytics.memoryEffectiveness * 100)}%`,
      taskTypes: this.getTaskTypeDistribution(memory),
      recentSteps: memory.slice(-5).map(item => ({
        step: item.summary,
        type: item.taskType,
        success: item.metadata?.success || false,
        time: this.formatRelativeTime(item.timestamp)
      })),
      dataExtracted: this.getExtractedDataSummary(memory)
    };
  }

  private formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    return `${seconds}s ago`;
  }

  private getTaskTypeDistribution(memory: readonly MemoryItem[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    memory.forEach(item => {
      distribution[item.taskType] = (distribution[item.taskType] || 0) + 1;
    });
    return distribution;
  }

  private calculateSuccessRate(memory: readonly MemoryItem[]): number {
    if (memory.length === 0) return 0;
    const successCount = memory.filter(item => item.metadata?.success !== false).length;
    return Math.round((successCount / memory.length) * 100);
  }

  private calculateAverageExecutionTime(memory: readonly MemoryItem[]): number {
    const executionTimes = memory
      .map(item => item.metadata?.executionTime)
      .filter(time => typeof time === 'number') as number[];

    if (executionTimes.length === 0) return 0;
    const average = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    return Math.round(average);
  }

  private countDataExtractions(memory: readonly MemoryItem[]): number {
    return memory.filter(item =>
      item.context?.dataExtracted ||
      item.taskType === 'Insight' && item.summary.includes('Extracted')
    ).length;
  }

  private extractWorkflowSteps(memory: readonly MemoryItem[]): string[] {
    return memory.map(item => item.summary);
  }

  private getExtractedDataSummary(memory: readonly MemoryItem[]): Record<string, any> {
    const extractedData: Record<string, any> = {};
    memory.forEach((item, index) => {
      if (item.context?.dataExtracted) {
        extractedData[`step_${index + 1}`] = item.context.dataExtracted;
      }
    });
    return extractedData;
  }
}
