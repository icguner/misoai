import type { ElementTreeNode, Point, Size } from 'misoai-core';
import type { PageType } from 'misoai-core';
import { NodeType } from 'misoai-shared/constants';
import type { ElementInfo } from 'misoai-shared/extractor';
import { getDebug } from 'misoai-shared/logger';
import type {
  WindowManipulationOptions,
  WindowsApplication,
  WindowsAutomationConfig,
  WindowsInputOptions,
  WindowsScreenshotOptions,
  WindowsUIElement,
} from '../types';
import { WindowsElementDetector } from '../utils/element-detector';
import { WindowsInputSimulator } from '../utils/input-simulator';
import { WindowsScreenshotCapture } from '../utils/screenshot';
import { WindowsWindowManager } from '../utils/window-manager';

export const debugWindowsPage = getDebug('windows:page');

/**
 * Windows desktop page implementation for misoAI automation
 */
export class WindowsPage {
  /**
   * Page type identifier
   */
  pageType: PageType = 'windows' as PageType;

  /**
   * Current target application
   */
  private targetApplication: WindowsApplication | null = null;

  /**
   * Windows automation configuration
   */
  private config: WindowsAutomationConfig;

  /**
   * Screenshot capture utility
   */
  private screenshotCapture: WindowsScreenshotCapture;

  /**
   * Element detection utility
   */
  private elementDetector: WindowsElementDetector;

  /**
   * Input simulation utility
   */
  private inputSimulator: WindowsInputSimulator;

  /**
   * Window management utility
   */
  private windowManager: WindowsWindowManager;

  /**
   * Screen size cache
   */
  private screenSize: Size | null = null;

  /**
   * Creates a new WindowsPage instance
   */
  constructor(config: Partial<WindowsAutomationConfig> = {}) {
    this.config = {
      screenshotMethod: 'nutjs',
      elementDetection: 'ai-vision',
      windowManagement: 'win32-api',
      performance: {
        screenshotCaching: true,
        elementCaching: true,
        batchOperations: true,
      },
      timeouts: {
        screenshot: 5000,
        elementSearch: 10000,
        windowOperation: 3000,
      },
      ...config,
    };

    this.screenshotCapture = new WindowsScreenshotCapture(this.config);
    this.elementDetector = new WindowsElementDetector(this.config);
    this.inputSimulator = new WindowsInputSimulator(this.config);
    this.windowManager = new WindowsWindowManager(this.config);
  }

  /**
   * Connects to a Windows application
   */
  public async connect(
    applicationIdentifier?: string | number,
  ): Promise<WindowsPage> {
    debugWindowsPage(
      'Connecting to Windows application: %s',
      applicationIdentifier,
    );

    try {
      if (applicationIdentifier) {
        this.targetApplication = await this.windowManager.findApplication(
          applicationIdentifier,
        );
        if (!this.targetApplication) {
          throw new Error(`Application not found: ${applicationIdentifier}`);
        }
        debugWindowsPage(
          'Connected to application: %s (PID: %d)',
          this.targetApplication.name,
          this.targetApplication.pid,
        );
      } else {
        // Connect to active window
        this.targetApplication = await this.windowManager.getActiveWindow();
        debugWindowsPage(
          'Connected to active window: %s',
          this.targetApplication?.title,
        );
      }

      return this;
    } catch (error: any) {
      debugWindowsPage('Failed to connect to application: %s', error.message);
      throw new Error(
        `Failed to connect to Windows application: ${error.message}`,
        {
          cause: error,
        },
      );
    }
  }

  /**
   * Launches a Windows application
   */
  public async launch(
    applicationPath: string,
    args?: string[],
  ): Promise<WindowsPage> {
    debugWindowsPage('Launching application: %s', applicationPath);

    try {
      this.targetApplication = await this.windowManager.launchApplication(
        applicationPath,
        args,
      );
      debugWindowsPage(
        'Successfully launched application: %s (PID: %d)',
        this.targetApplication.name,
        this.targetApplication.pid,
      );

      return this;
    } catch (error: any) {
      debugWindowsPage('Failed to launch application: %s', error.message);
      throw new Error(
        `Failed to launch application ${applicationPath}: ${error.message}`,
        {
          cause: error,
        },
      );
    }
  }

  /**
   * Takes a screenshot and returns it as a base64-encoded string
   */
  public async screenshotBase64(
    options?: WindowsScreenshotOptions,
  ): Promise<string> {
    debugWindowsPage('Taking screenshot');

    try {
      const screenshotOptions: WindowsScreenshotOptions = {
        format: 'png',
        includeCursor: false,
        window: this.targetApplication || undefined,
        ...options,
      };

      const screenshot =
        await this.screenshotCapture.capture(screenshotOptions);
      return `data:image/png;base64,${screenshot}`;
    } catch (error: any) {
      debugWindowsPage('Error taking screenshot: %s', error.message);
      throw new Error(`Failed to take screenshot: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the element tree for the current window
   */
  public async getElementsNodeTree(): Promise<ElementTreeNode<ElementInfo>> {
    debugWindowsPage('Getting element tree');

    try {
      if (!this.targetApplication) {
        throw new Error('No target application connected');
      }

      const elements = await this.elementDetector.detectElements(
        this.targetApplication,
      );
      return this.convertToElementTree(elements);
    } catch (error: any) {
      debugWindowsPage('Error getting element tree: %s', error.message);
      throw new Error(`Failed to get element tree: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the current window URL/identifier
   */
  public async url(): Promise<string> {
    try {
      if (this.targetApplication) {
        return `${this.targetApplication.name}:${this.targetApplication.pid}`;
      }
      return 'windows:desktop';
    } catch (error: any) {
      debugWindowsPage('Error getting URL: %s', error.message);
      return 'windows:unknown';
    }
  }

  /**
   * Gets the screen size
   */
  public async size(): Promise<Size> {
    if (this.screenSize) {
      return this.screenSize;
    }

    try {
      this.screenSize = await this.windowManager.getScreenSize();
      return this.screenSize;
    } catch (error: any) {
      debugWindowsPage('Error getting screen size: %s', error.message);
      throw new Error(`Failed to get screen size: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Simulates a click at the specified coordinates
   */
  public async click(
    x: number,
    y: number,
    options?: WindowsInputOptions,
  ): Promise<void> {
    debugWindowsPage('Clicking at (%d, %d)', x, y);

    try {
      await this.inputSimulator.click({ left: x, top: y }, options);
      debugWindowsPage('Successfully clicked at (%d, %d)', x, y);
    } catch (error: any) {
      debugWindowsPage('Error clicking at (%d, %d): %s', x, y, error.message);
      throw new Error(`Failed to click at (${x}, ${y}): ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Simulates typing text
   */
  public async type(
    text: string,
    options?: WindowsInputOptions,
  ): Promise<void> {
    debugWindowsPage('Typing text: %s', text);

    try {
      await this.inputSimulator.type(text, options);
      debugWindowsPage('Successfully typed text');
    } catch (error: any) {
      debugWindowsPage('Error typing text: %s', error.message);
      throw new Error(`Failed to type text: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Simulates key press
   */
  public async keyPress(
    key: string,
    options?: WindowsInputOptions,
  ): Promise<void> {
    debugWindowsPage('Pressing key: %s', key);

    try {
      await this.inputSimulator.keyPress(key, options);
      debugWindowsPage('Successfully pressed key: %s', key);
    } catch (error: any) {
      debugWindowsPage('Error pressing key %s: %s', key, error.message);
      throw new Error(`Failed to press key ${key}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Converts Windows UI elements to ElementTreeNode format
   */
  private convertToElementTree(
    elements: WindowsUIElement[],
  ): ElementTreeNode<ElementInfo> {
    // Create root element
    const rootElement: ElementInfo = {
      id: 'windows-root',
      indexId: 0,
      nodeHashId: 'windows-root',
      locator: '/',
      attributes: {
        nodeType: NodeType.CONTAINER,
      },
      nodeType: NodeType.CONTAINER,
      content: this.targetApplication?.title || 'Windows Desktop',
      rect: {
        left: 0,
        top: 0,
        width: this.screenSize?.width || 1920,
        height: this.screenSize?.height || 1080,
      },
      center: [
        (this.screenSize?.width || 1920) / 2,
        (this.screenSize?.height || 1080) / 2,
      ],
    };

    // Convert Windows elements to ElementInfo format
    const children = elements.map((element, index) =>
      this.convertWindowsElementToElementInfo(element, index + 1),
    );

    return {
      node: rootElement,
      children: children.map((child) => ({ node: child, children: [] })),
    };
  }

  /**
   * Converts a single Windows UI element to ElementInfo format
   */
  private convertWindowsElementToElementInfo(
    element: WindowsUIElement,
    indexId: number,
  ): ElementInfo {
    return {
      id: element.id,
      indexId,
      nodeHashId: element.id,
      locator: element.automationId || element.name || element.id,
      attributes: {
        nodeType: this.mapControlTypeToNodeType(element.type),
        className: element.className,
        automationId: element.automationId,
        controlType: element.controlType,
      },
      nodeType: this.mapControlTypeToNodeType(element.type),
      content: element.text || element.name || '',
      rect: {
        left: element.bounds.x,
        top: element.bounds.y,
        width: element.bounds.width,
        height: element.bounds.height,
      },
      center: [element.center.left, element.center.top],
    };
  }

  /**
   * Maps Windows control types to NodeType
   */
  private mapControlTypeToNodeType(controlType: string): NodeType {
    switch (controlType.toLowerCase()) {
      case 'button':
        return NodeType.BUTTON;
      case 'edit':
      case 'textbox':
        return NodeType.INPUT;
      case 'text':
      case 'label':
        return NodeType.TEXT;
      case 'image':
        return NodeType.IMG;
      case 'list':
      case 'listbox':
        return NodeType.LIST;
      case 'combobox':
      case 'dropdown':
        return NodeType.SELECT;
      default:
        return NodeType.CONTAINER;
    }
  }

  /**
   * Disconnects from the current application
   */
  public async disconnect(): Promise<void> {
    debugWindowsPage('Disconnecting from Windows application');
    this.targetApplication = null;
    this.screenSize = null;
  }
}
