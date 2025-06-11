import type { ElementTreeNode, Point, Size } from 'misoai-core';
import { sleep } from 'misoai-core/utils';
import { DEFAULT_WAIT_FOR_NAVIGATION_TIMEOUT } from 'misoai-shared/constants';
import type { ElementInfo } from 'misoai-shared/extractor';
import { treeToList } from 'misoai-shared/extractor';
import {
  getElementInfosScriptContent,
  getExtraReturnLogic,
} from 'misoai-shared/fs';
import { getDebug } from 'misoai-shared/logger';
import { assert } from 'misoai-shared/utils';
import type { Page as PlaywrightPage } from 'playwright';
import type { Page as PuppeteerPage } from 'puppeteer';
import type { WebKeyInput } from '../common/page';
import type { AbstractPage } from '../page';
import type { MouseButton } from '../page';
import {
  generateHumanMousePath,
  calculateStepDelay,
  type MouseMovementOptions,
  type Point as MousePoint
} from '../common/mouse-utils';
import {
  getMousePointerScript,
  getClickAnimationScript,
  type VisualFeedbackOptions
} from '../common/visual-feedback';

const debugPage = getDebug('web:page');

export class Page<
  AgentType extends 'puppeteer' | 'playwright',
  PageType extends PuppeteerPage | PlaywrightPage,
> implements AbstractPage
{
  underlyingPage: PageType;
  protected waitForNavigationTimeout: number;
  private viewportSize?: Size;
  private currentMousePosition: MousePoint = { x: 0, y: 0 };
  private mouseMovementOptions: MouseMovementOptions = {
    steps: 15,
    duration: 300,
    easing: 'easeInOut',
    showVisualFeedback: true
  };
  private visualFeedbackOptions: VisualFeedbackOptions = {
    pointerSize: 16,
    pointerColor: '#ff4444',
    trailLength: 4,
    showTrail: true,
    animationDuration: 150
  };

  pageType: AgentType;

  private async evaluate<R>(
    pageFunction: string | ((...args: any[]) => R | Promise<R>),
    arg?: any,
  ): Promise<R> {
    let result: R;
    debugPage('evaluate function begin');
    if (this.pageType === 'puppeteer') {
      result = await (this.underlyingPage as PuppeteerPage).evaluate(
        pageFunction,
        arg,
      );
    } else {
      result = await (this.underlyingPage as PlaywrightPage).evaluate(
        pageFunction,
        arg,
      );
    }
    debugPage('evaluate function end');
    return result;
  }

  constructor(
    underlyingPage: PageType,
    pageType: AgentType,
    opts?: {
      waitForNavigationTimeout?: number;
    },
  ) {
    this.underlyingPage = underlyingPage;
    this.pageType = pageType;
    this.waitForNavigationTimeout =
      opts?.waitForNavigationTimeout ?? DEFAULT_WAIT_FOR_NAVIGATION_TIMEOUT;

    // Initialize mouse position to center of viewport
    this.initializeMousePosition();
  }

  /**
   * Initialize mouse position to center of viewport
   */
  private async initializeMousePosition(): Promise<void> {
    try {
      const size = await this.size();
      this.currentMousePosition = {
        x: Math.floor(size.width / 2),
        y: Math.floor(size.height / 2)
      };
    } catch (error) {
      // Fallback to default position
      this.currentMousePosition = { x: 400, y: 300 };
    }
  }

  async evaluateJavaScript<T = any>(script: string): Promise<T> {
    return this.evaluate(script);
  }

  /**
   * Show visual feedback for mouse pointer
   */
  private async showMousePointer(x: number, y: number): Promise<void> {
    if (!this.mouseMovementOptions.showVisualFeedback) return;

    const script = getMousePointerScript(x, y, this.visualFeedbackOptions);
    try {
      await this.evaluate(script);
    } catch (error) {
      // Ignore visual feedback errors to not break functionality
      debugPage('Visual feedback error:', error);
    }
  }

  /**
   * Show click animation
   */
  private async showClickAnimation(x: number, y: number): Promise<void> {
    if (!this.mouseMovementOptions.showVisualFeedback) return;

    const script = getClickAnimationScript(x, y);
    try {
      await this.evaluate(script);
    } catch (error) {
      // Ignore visual feedback errors
      debugPage('Click animation error:', error);
    }
  }

  /**
   * Move mouse with human-like movement and visual feedback
   */
  private async moveMouseHumanLike(
    toX: number,
    toY: number,
    options?: Partial<MouseMovementOptions>
  ): Promise<void> {
    const moveOptions = { ...this.mouseMovementOptions, ...options };

    // Generate human-like path
    const path = generateHumanMousePath(
      this.currentMousePosition,
      { x: toX, y: toY },
      moveOptions
    );

    // Move along the path
    for (let i = 0; i < path.length; i++) {
      const point = path[i];

      // Show visual feedback
      if (moveOptions.showVisualFeedback) {
        await this.showMousePointer(point.x, point.y);
      }

      // Move mouse to point
      await this.underlyingPage.mouse.move(point.x, point.y);

      // Update current position
      this.currentMousePosition = point;

      // Add delay between steps (except for last step)
      if (i < path.length - 1) {
        const delay = calculateStepDelay(
          moveOptions.duration || 300,
          i,
          path.length
        );
        await sleep(delay);
      }
    }
  }

  async waitForNavigation() {
    // issue: https://github.com/puppeteer/puppeteer/issues/3323
    if (this.pageType === 'puppeteer' || this.pageType === 'playwright') {
      debugPage('waitForNavigation begin');
      debugPage(`waitForNavigation timeout: ${this.waitForNavigationTimeout}`);
      try {
        await (this.underlyingPage as PuppeteerPage).waitForSelector('html', {
          timeout: this.waitForNavigationTimeout,
        });
      } catch (error) {
        // Ignore timeout error, continue execution
        console.warn(
          '[hirafi:warning] Waiting for the navigation has timed out',
        );
      }
      debugPage('waitForNavigation end');
    }
  }

  // @deprecated
  async getElementsInfo() {
    // const scripts = await getExtraReturnLogic();
    // const captureElementSnapshot = await this.evaluate(scripts);
    // return captureElementSnapshot as ElementInfo[];
    await this.waitForNavigation();
    debugPage('getElementsInfo begin');
    const tree = await this.getElementsNodeTree();
    debugPage('getElementsInfo end');
    return treeToList(tree);
  }

  async getXpathsById(id: string) {
    const elementInfosScriptContent = getElementInfosScriptContent();

    return this.evaluateJavaScript(
      `${elementInfosScriptContent}midscene_element_inspector.getXpathsById('${id}')`,
    );
  }

  async getElementInfoByXpath(xpath: string) {
    const elementInfosScriptContent = getElementInfosScriptContent();

    return this.evaluateJavaScript(
      `${elementInfosScriptContent}midscene_element_inspector.getElementInfoByXpath('${xpath}')`,
    );
  }

  async getElementsNodeTree() {
    // ref: packages/web-integration/src/playwright/ai-fixture.ts popup logic
    // During test execution, a new page might be opened through a connection, and the page remains confined to the same page instance.
    // The page may go through opening, closing, and reopening; if the page is closed, evaluate may return undefined, which can lead to errors.
    await this.waitForNavigation();
    const scripts = await getExtraReturnLogic(true);
    assert(scripts, 'scripts should be set before writing report in browser');
    const captureElementSnapshot = await this.evaluate(scripts);
    return captureElementSnapshot as ElementTreeNode<ElementInfo>;
  }

  async size(): Promise<Size> {
    if (this.viewportSize) return this.viewportSize;
    const sizeInfo: Size = await this.evaluate(() => {
      return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        dpr: window.devicePixelRatio,
      };
    });
    this.viewportSize = sizeInfo;
    return sizeInfo;
  }

  async screenshotBase64(): Promise<string> {
    const imgType = 'jpeg';
    const quality = 90;
    await this.waitForNavigation();
    debugPage('screenshotBase64 begin');

    let base64: string;
    if (this.pageType === 'puppeteer') {
      const result = await (this.underlyingPage as PuppeteerPage).screenshot({
        type: imgType,
        quality,
        encoding: 'base64',
      });
      base64 = `data:image/jpeg;base64,${result}`;
    } else if (this.pageType === 'playwright') {
      const buffer = await (this.underlyingPage as PlaywrightPage).screenshot({
        type: imgType,
        quality,
        timeout: 10 * 1000,
      });
      base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } else {
      throw new Error('Unsupported page type for screenshot');
    }
    debugPage('screenshotBase64 end');
    return base64;
  }

  async url(): Promise<string> {
    return this.underlyingPage.url();
  }

  get mouse() {
    return {
      click: async (
        x: number,
        y: number,
        options?: { button?: MouseButton; count?: number },
      ) => {
        // Move with human-like movement and visual feedback
        await this.mouse.move(x, y);

        // Show click animation
        await this.showClickAnimation(x, y);

        // Perform the actual click
        await this.underlyingPage.mouse.click(x, y, {
          button: options?.button || 'left',
          count: options?.count || 1,
        });
      },
      wheel: async (deltaX: number, deltaY: number) => {
        if (this.pageType === 'puppeteer') {
          await (this.underlyingPage as PuppeteerPage).mouse.wheel({
            deltaX,
            deltaY,
          });
        } else if (this.pageType === 'playwright') {
          await (this.underlyingPage as PlaywrightPage).mouse.wheel(
            deltaX,
            deltaY,
          );
        }
      },
      move: async (x: number, y: number) => {
        this.everMoved = true;
        // Use human-like movement instead of direct movement
        await this.moveMouseHumanLike(x, y);
        return Promise.resolve();
      },
      drag: async (
        from: { x: number; y: number },
        to: { x: number; y: number },
      ) => {
        if (this.pageType === 'puppeteer') {
          // For Puppeteer, we'll use human-like movement for drag as well
          await this.mouse.move(from.x, from.y);
          await this.underlyingPage.mouse.down();
          await this.moveMouseHumanLike(to.x, to.y, {
            duration: 500, // Slower for drag operations
            steps: 25
          });
          await this.underlyingPage.mouse.up();
        } else if (this.pageType === 'playwright') {
          // Playwright doesn't have a drag method, so we need to simulate it
          await this.mouse.move(from.x, from.y);
          await (this.underlyingPage as PlaywrightPage).mouse.down();
          await this.mouse.move(to.x, to.y);
          await (this.underlyingPage as PlaywrightPage).mouse.up();
        }
      },
    };
  }

  get keyboard() {
    return {
      type: async (text: string) =>
        this.underlyingPage.keyboard.type(text, { delay: 80 }),

      press: async (
        action:
          | { key: WebKeyInput; command?: string }
          | { key: WebKeyInput; command?: string }[],
      ) => {
        const keys = Array.isArray(action) ? action : [action];
        for (const k of keys) {
          const commands = k.command ? [k.command] : [];
          await this.underlyingPage.keyboard.down(k.key, { commands });
        }
        for (const k of [...keys].reverse()) {
          await this.underlyingPage.keyboard.up(k.key);
        }
      },
      down: async (key: WebKeyInput) => {
        this.underlyingPage.keyboard.down(key);
      },
      up: async (key: WebKeyInput) => {
        this.underlyingPage.keyboard.up(key);
      },
    };
  }

  async clearInput(element: ElementInfo): Promise<void> {
    if (!element) {
      console.warn('No element to clear input');
      return;
    }

    const isMac = process.platform === 'darwin';
    if (isMac) {
      if (this.pageType === 'puppeteer') {
        // https://github.com/segment-boneyard/nightmare/issues/810#issuecomment-452669866
        await this.mouse.click(element.center[0], element.center[1], {
          count: 3,
        });
      } else {
        await this.mouse.click(element.center[0], element.center[1]);
        await this.underlyingPage.keyboard.down('Meta');
        await this.underlyingPage.keyboard.press('a');
        await this.underlyingPage.keyboard.up('Meta');
      }
    } else {
      await this.mouse.click(element.center[0], element.center[1]);
      await this.underlyingPage.keyboard.down('Control');
      await this.underlyingPage.keyboard.press('a');
      await this.underlyingPage.keyboard.up('Control');
    }
    await sleep(100);
    await this.keyboard.press([{ key: 'Backspace' }]);
  }

  private everMoved = false;
  private async moveToPointBeforeScroll(point?: Point): Promise<void> {
    if (point) {
      await this.mouse.move(point.left, point.top);
    } else if (!this.everMoved) {
      // If the mouse has never moved, move it to the center of the page
      const size = await this.size();
      const targetX = Math.floor(size.width / 2);
      const targetY = Math.floor(size.height / 2);
      await this.mouse.move(targetX, targetY);
    }
  }

  /**
   * Configure mouse movement behavior
   */
  public configureMouseMovement(options: Partial<MouseMovementOptions>): void {
    this.mouseMovementOptions = { ...this.mouseMovementOptions, ...options };
  }

  /**
   * Configure visual feedback
   */
  public configureVisualFeedback(options: Partial<VisualFeedbackOptions>): void {
    this.visualFeedbackOptions = { ...this.visualFeedbackOptions, ...options };
  }

  async scrollUntilTop(startingPoint?: Point): Promise<void> {
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(0, -9999999);
  }

  async scrollUntilBottom(startingPoint?: Point): Promise<void> {
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(0, 9999999);
  }

  async scrollUntilLeft(startingPoint?: Point): Promise<void> {
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(-9999999, 0);
  }

  async scrollUntilRight(startingPoint?: Point): Promise<void> {
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(9999999, 0);
  }

  async scrollUp(distance?: number, startingPoint?: Point): Promise<void> {
    const innerHeight = await this.evaluate(() => window.innerHeight);
    const scrollDistance = distance || innerHeight * 0.7;
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(0, -scrollDistance);
  }

  async scrollDown(distance?: number, startingPoint?: Point): Promise<void> {
    const innerHeight = await this.evaluate(() => window.innerHeight);
    const scrollDistance = distance || innerHeight * 0.7;
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(0, scrollDistance);
  }

  async scrollLeft(distance?: number, startingPoint?: Point): Promise<void> {
    const innerWidth = await this.evaluate(() => window.innerWidth);
    const scrollDistance = distance || innerWidth * 0.7;
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(-scrollDistance, 0);
  }

  async scrollRight(distance?: number, startingPoint?: Point): Promise<void> {
    const innerWidth = await this.evaluate(() => window.innerWidth);
    const scrollDistance = distance || innerWidth * 0.7;
    await this.moveToPointBeforeScroll(startingPoint);
    return this.mouse.wheel(scrollDistance, 0);
  }

  async navigate(url: string): Promise<void> {
    if (this.pageType === 'puppeteer') {
      await (this.underlyingPage as PuppeteerPage).goto(url);
    } else if (this.pageType === 'playwright') {
      await (this.underlyingPage as PlaywrightPage).goto(url);
    } else {
      throw new Error('Unsupported page type for navigate');
    }
  }

  async destroy(): Promise<void> {}
}
