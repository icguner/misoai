import type { ElementTreeNode, Point, Size } from 'rfi-ai-core';
import { sleep } from 'rfi-ai-core/utils';
import { DEFAULT_WAIT_FOR_NAVIGATION_TIMEOUT } from 'rfi-ai-shared/constants';
import type { ElementInfo } from 'rfi-ai-shared/extractor';
import { treeToList } from 'rfi-ai-shared/extractor';
import {
  getElementInfosScriptContent,
  getExtraReturnLogic,
} from 'rfi-ai-shared/fs';
import { getDebug } from 'rfi-ai-shared/logger';
import { assert } from 'rfi-ai-shared/utils';
// Playwright support removed
import type { Page as PuppeteerPage } from 'puppeteer';
import type { WebKeyInput } from '../common/page';
import type { AbstractPage } from '../page';
import type { MouseButton } from '../page';

const debugPage = getDebug('web:page');

export class Page<
  AgentType extends 'puppeteer',
  PageType extends PuppeteerPage,
> implements AbstractPage
{
  underlyingPage: PageType;
  protected waitForNavigationTimeout: number;
  private viewportSize?: Size;

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
      // Playwright support removed
      throw new Error('Playwright support removed');
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
  }

  async evaluateJavaScript<T = any>(script: string): Promise<T> {
    return this.evaluate(script);
  }

  async waitForNavigation() {
    // issue: https://github.com/puppeteer/puppeteer/issues/3323
    if (this.pageType === 'puppeteer') {
      debugPage('waitForNavigation begin');
      debugPage(`waitForNavigation timeout: ${this.waitForNavigationTimeout}`);
      try {
        await (this.underlyingPage as PuppeteerPage).waitForSelector('html', {
          timeout: this.waitForNavigationTimeout,
        });
      } catch (error) {
        // Ignore timeout error, continue execution
        console.warn(
          '[midscene:warning] Waiting for the navigation has timed out, but Midscene will continue execution. Please check https://midscenejs.com/faq.html#customize-the-network-timeout for more information on customizing the network timeout',
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

  // UNIFIED PUPPETEER NATIVE METHODS for selector-based operations
  async getElementInfoBySelector(selector: string) {
    const elementInfosScriptContent = getElementInfosScriptContent();
    return this.evaluateJavaScript(
      `${elementInfosScriptContent}midscene_element_inspector.getElementInfoBySelector('${selector}')`,
    );
  }

  async clickBySelector(selector: string): Promise<void> {
    console.error(`[PUPPETEER-CLICK] Attempting to click selector: ${selector}`);
    if (this.pageType === 'puppeteer') {
      try {
        // First, find ALL elements matching the selector
        const elements = await (this.underlyingPage as PuppeteerPage).$$(selector);
        console.error(`[PUPPETEER-CLICK] Found ${elements.length} element(s) matching: ${selector}`);
        
        if (elements.length === 0) {
          throw new Error(`No elements found for selector: ${selector}`);
        }
        
        // Try to find a visible element
        let clickableElement = null;
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          try {
            // Check if element is visible and clickable
            const isVisible = await element.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0 &&
                rect.top >= 0 &&
                rect.left >= 0
              );
            });
            
            if (isVisible) {
              console.error(`[PUPPETEER-CLICK] Element ${i + 1}/${elements.length} is visible`);
              clickableElement = element;
              break;
            } else {
              console.error(`[PUPPETEER-CLICK] Element ${i + 1}/${elements.length} is hidden/invisible`);
            }
          } catch (err) {
            console.error(`[PUPPETEER-CLICK] Error checking element ${i + 1}: ${(err as Error).message}`);
          }
        }
        
        // If no visible element found, try the first one anyway
        if (!clickableElement) {
          console.error(`[PUPPETEER-CLICK] No visible elements found, attempting first element`);
          clickableElement = elements[0];
        }
        
        // Try to click the element
        await clickableElement.click();
        console.error(`[PUPPETEER-CLICK] Successfully clicked: ${selector}`);
        return;
        
      } catch (error) {
        console.error(`[PUPPETEER-CLICK] Failed to click ${selector}: ${(error as Error).message}`);
        throw error;
      }
    } else if (false /* playwright removed */) {
      // Playwright support removed
      return;
    }
    throw new Error(`Element not found for selector: ${selector}`);
  }

  async typeBySelector(selector: string, text: string): Promise<void> {
    if (this.pageType === 'puppeteer') {
      try {
        // Find ALL elements matching the selector
        const elements = await (this.underlyingPage as PuppeteerPage).$$(selector);
        console.error(`[PUPPETEER-TYPE] Found ${elements.length} element(s) matching: ${selector}`);
        
        if (elements.length === 0) {
          throw new Error(`No elements found for selector: ${selector}`);
        }
        
        // Find the first visible element
        let typableElement = null;
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          try {
            const isVisible = await element.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0
              );
            });
            
            if (isVisible) {
              console.error(`[PUPPETEER-TYPE] Element ${i + 1}/${elements.length} is visible`);
              typableElement = element;
              break;
            }
          } catch (err) {
            console.error(`[PUPPETEER-TYPE] Error checking element ${i + 1}: ${(err as Error).message}`);
          }
        }
        
        if (!typableElement) {
          console.error(`[PUPPETEER-TYPE] No visible elements found, using first element`);
          typableElement = elements[0];
        }
        
        await typableElement.type(text);
        console.error(`[PUPPETEER-TYPE] Successfully typed text`);
        return;
        
      } catch (error) {
        console.error(`[PUPPETEER-TYPE] Failed: ${(error as Error).message}`);
        throw error;
      }
    } else if (false /* playwright removed */) {
      // Playwright support removed
      return;
    }
    throw new Error(`Element not found for selector: ${selector}`);
  }

  async clearBySelector(selector: string): Promise<void> {
    if (this.pageType === 'puppeteer') {
      try {
        // Find ALL elements matching the selector
        const elements = await (this.underlyingPage as PuppeteerPage).$$(selector);
        console.error(`[PUPPETEER-CLEAR] Found ${elements.length} element(s) matching: ${selector}`);
        
        if (elements.length === 0) {
          throw new Error(`No elements found for selector: ${selector}`);
        }
        
        // Find the first visible element
        let clearableElement = null;
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          try {
            const isVisible = await element.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0
              );
            });
            
            if (isVisible) {
              console.error(`[PUPPETEER-CLEAR] Element ${i + 1}/${elements.length} is visible`);
              clearableElement = element;
              break;
            }
          } catch (err) {
            console.error(`[PUPPETEER-CLEAR] Error checking element ${i + 1}: ${(err as Error).message}`);
          }
        }
        
        if (!clearableElement) {
          console.error(`[PUPPETEER-CLEAR] No visible elements found, using first element`);
          clearableElement = elements[0];
        }
        
        await clearableElement.click({ clickCount: 3 }); // Select all
        await clearableElement.press('Backspace');
        console.error(`[PUPPETEER-CLEAR] Successfully cleared element`);
        return;
        
      } catch (error) {
        console.error(`[PUPPETEER-CLEAR] Failed: ${(error as Error).message}`);
        throw error;
      }
    } else if (false /* playwright removed */) {
      // Playwright support removed
      return;
    }
    throw new Error(`Element not found for selector: ${selector}`);
  }

  async hoverBySelector(selector: string): Promise<void> {
    if (this.pageType === 'puppeteer') {
      try {
        // Find ALL elements matching the selector
        const elements = await (this.underlyingPage as PuppeteerPage).$$(selector);
        console.error(`[PUPPETEER-HOVER] Found ${elements.length} element(s) matching: ${selector}`);
        
        if (elements.length === 0) {
          throw new Error(`No elements found for selector: ${selector}`);
        }
        
        // Find the first visible element
        let hoverableElement = null;
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          try {
            const isVisible = await element.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0
              );
            });
            
            if (isVisible) {
              console.error(`[PUPPETEER-HOVER] Element ${i + 1}/${elements.length} is visible`);
              hoverableElement = element;
              break;
            }
          } catch (err) {
            console.error(`[PUPPETEER-HOVER] Error checking element ${i + 1}: ${(err as Error).message}`);
          }
        }
        
        if (!hoverableElement) {
          console.error(`[PUPPETEER-HOVER] No visible elements found, using first element`);
          hoverableElement = elements[0];
        }
        
        await hoverableElement.hover();
        console.error(`[PUPPETEER-HOVER] Successfully hovered over element`);
        return;
        
      } catch (error) {
        console.error(`[PUPPETEER-HOVER] Failed: ${(error as Error).message}`);
        throw error;
      }
    } else if (false /* playwright removed */) {
      // Playwright support removed
      return;
    }
    throw new Error(`Element not found for selector: ${selector}`);
  }

  async scrollToSelector(selector: string): Promise<void> {
    console.error(`[PUPPETEER-SCROLL] Attempting to scroll to selector: ${selector}`);
    
    if (this.pageType === 'puppeteer') {
      try {
        // Wait for element to exist
        await (this.underlyingPage as PuppeteerPage).waitForSelector(selector, { timeout: 5000 });
        
        // Scroll element into view
        const scrolled = await (this.underlyingPage as PuppeteerPage).evaluate((sel: string) => {
          const elem = document.querySelector(sel);
          if (elem) {
            elem.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'center'
            });
            return true;
          }
          return false;
        }, selector);
        
        if (scrolled) {
          console.error(`[PUPPETEER-SCROLL] Successfully scrolled to element: ${selector}`);
          return;
        }
        
        throw new Error(`Could not scroll to element: ${selector}`);
      } catch (error) {
        console.error(`[PUPPETEER-SCROLL] Failed: ${(error as Error).message}`);
        throw error;
      }
    } else if (false /* playwright removed */) {
      // Playwright support removed
      return;
    }
    
    throw new Error(`Cannot scroll to element: ${selector}`);
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
    } else if (false /* playwright removed */) {
      // Playwright support removed
      throw new Error('Playwright support removed');
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
        await this.mouse.move(x, y);
        this.underlyingPage.mouse.click(x, y, {
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
        } else if (false /* playwright removed */) {
          // Playwright support removed
        }
      },
      move: async (x: number, y: number) => {
        this.everMoved = true;
        return this.underlyingPage.mouse.move(x, y);
      },
      drag: async (
        from: { x: number; y: number },
        to: { x: number; y: number },
      ) => {
        if (this.pageType === 'puppeteer') {
          await (this.underlyingPage as PuppeteerPage).mouse.drag(
            {
              x: from.x,
              y: from.y,
            },
            {
              x: to.x,
              y: to.y,
            },
          );
        } else if (false /* playwright removed */) {
          // Playwright support removed
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
    } else if (false /* playwright removed */) {
      // Playwright support removed
    } else {
      throw new Error('Unsupported page type for navigate');
    }
  }

  async destroy(): Promise<void> {}
}
