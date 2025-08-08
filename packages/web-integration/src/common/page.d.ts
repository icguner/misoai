import type { ElementTreeNode } from 'rfi-ai-core';
import type { PageType, Point, Size } from 'rfi-ai-core';
import type { ElementInfo } from 'rfi-ai-shared/extractor';
import type { KeyInput } from 'puppeteer';
import type { AbstractPage } from '../page';
import type { PuppeteerWebPage } from '../puppeteer';

export interface AndroidDevicePage extends AbstractPage {
  pageType: PageType;
  connect(): Promise<any>;
  launch(uri: string): Promise<any>;

  screenshotBase64(): Promise<string>;
  getElementsNodeTree(): Promise<ElementTreeNode<ElementInfo>>;
  url(): string | Promise<string>;
  size(): Promise<Size>;

  scrollUntilTop(startingPoint?: Point): Promise<void>;
  scrollUntilBottom(startingPoint?: Point): Promise<void>;
  scrollUntilLeft(startingPoint?: Point): Promise<void>;
  scrollUntilRight(startingPoint?: Point): Promise<void>;
  scrollUp(distance?: number, startingPoint?: Point): Promise<void>;
  scrollDown(distance?: number, startingPoint?: Point): Promise<void>;
  scrollLeft(distance?: number, startingPoint?: Point): Promise<void>;
  scrollRight(distance?: number): Promise<void>;

  getXpathsById(id: string): Promise<string[]>;
  getElementInfoByXpath(xpath: string): Promise<ElementInfo>;

  back(): Promise<void>;
  home(): Promise<void>;
  recentApps(): Promise<void>;
}

export type AndroidDeviceInputOpt = {
  autoDismissKeyboard?: boolean;
};

export type WebPage =
  | PuppeteerWebPage
  | AndroidDevicePage;

export type WebKeyInput = KeyInput;
