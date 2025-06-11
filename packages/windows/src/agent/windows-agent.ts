import { getDebug } from 'misoai-shared/logger';
import type { 
  MemoryItem, 
  MemoryConfig, 
  AITaskResult,
  LocateOption 
} from 'misoai-core';
import { PageAgent, type PageAgentOpt } from 'misoai-web/common/agent';
import type { 
  WindowsApplication, 
  WindowsAutomationConfig, 
  WindowsInputOptions,
  WindowManipulationOptions 
} from '../types';
import { WindowsPage } from '../page/windows-page';

const debugWindowsAgent = getDebug('windows:agent');

/**
 * Configuration options for WindowsAgent
 */
export interface WindowsAgentOptions extends Partial<PageAgentOpt> {
  /** Windows-specific automation configuration */
  windowsConfig?: Partial<WindowsAutomationConfig>;
  /** Memory configuration for AI workflow */
  memoryConfig?: Partial<MemoryConfig>;
  /** AI action context for Windows applications */
  aiActionContext?: string;
}

/**
 * Windows desktop automation agent with AI capabilities
 */
export class WindowsAgent extends PageAgent {
  private windowsPage: WindowsPage;
  private windowsConfig: WindowsAutomationConfig;

  /**
   * Creates a new WindowsAgent instance
   */
  constructor(options: WindowsAgentOptions = {}) {
    // Create Windows page instance
    const windowsPage = new WindowsPage(options.windowsConfig);
    
    // Initialize parent PageAgent with Windows page
    super(windowsPage, {
      aiActionContext: options.aiActionContext || 
        'You are automating a Windows desktop application. Pay attention to window controls, menus, and desktop elements.',
      memoryConfig: {
        maxItems: 50,
        maxAge: 30 * 60 * 1000, // 30 minutes
        enablePersistence: true,
        enableAnalytics: true,
        filterStrategy: 'hybrid',
        ...options.memoryConfig,
      },
      ...options,
    });

    this.windowsPage = windowsPage;
    this.windowsConfig = {
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
      ...options.windowsConfig,
    };

    debugWindowsAgent('WindowsAgent initialized with config: %o', this.windowsConfig);
  }

  /**
   * Connects to a Windows application
   */
  public async connectToApplication(applicationIdentifier?: string | number): Promise<WindowsAgent> {
    debugWindowsAgent('Connecting to Windows application: %s', applicationIdentifier);

    try {
      await this.windowsPage.connect(applicationIdentifier);
      
      // Add connection to memory
      await this.addToMemory({
        id: `connect_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: `Connected to Windows application: ${applicationIdentifier || 'active window'}`,
        context: {
          userAction: 'connect',
          elementInfo: applicationIdentifier?.toString(),
        },
        metadata: {
          executionTime: 0,
          success: true,
          confidence: 1.0,
        },
        tags: ['connection', 'windows', 'application'],
      });

      debugWindowsAgent('Successfully connected to Windows application');
      return this;
    } catch (error: any) {
      debugWindowsAgent('Failed to connect to Windows application: %s', error.message);
      throw new Error(`Failed to connect to Windows application: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Launches a Windows application
   */
  public async launchApplication(applicationPath: string, args?: string[]): Promise<WindowsAgent> {
    debugWindowsAgent('Launching Windows application: %s', applicationPath);

    try {
      await this.windowsPage.launch(applicationPath, args);
      
      // Add launch to memory
      await this.addToMemory({
        id: `launch_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: `Launched Windows application: ${applicationPath}`,
        context: {
          userAction: 'launch',
          elementInfo: applicationPath,
        },
        metadata: {
          executionTime: 0,
          success: true,
          confidence: 1.0,
        },
        tags: ['launch', 'windows', 'application'],
      });

      debugWindowsAgent('Successfully launched Windows application');
      return this;
    } catch (error: any) {
      debugWindowsAgent('Failed to launch Windows application: %s', error.message);
      throw new Error(`Failed to launch Windows application: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * AI-powered click action for Windows applications
   */
  public async aiClickWindows(
    locatePrompt: string, 
    options?: LocateOption & WindowsInputOptions
  ): Promise<AITaskResult> {
    debugWindowsAgent('AI click on Windows element: %s', locatePrompt);

    try {
      // Get memory context for better AI understanding
      const memoryContext = this.getMemoryAsContext();
      const enhancedPrompt = memoryContext 
        ? `${locatePrompt}\n\nPrevious workflow steps:\n${memoryContext}`
        : locatePrompt;

      // Use the existing aiTap functionality with enhanced context
      const result = await this.aiTap(enhancedPrompt, options);

      // Add Windows-specific context to memory
      await this.addToMemory({
        id: `windows_click_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: `Clicked Windows element: ${locatePrompt}`,
        context: {
          userAction: 'click',
          elementInfo: locatePrompt,
          url: await this.windowsPage.url(),
        },
        metadata: {
          executionTime: result.metadata?.executionTime || 0,
          success: true,
          confidence: 0.9,
        },
        tags: ['click', 'windows', 'ai-action'],
      });

      return result;
    } catch (error: any) {
      debugWindowsAgent('AI click failed: %s', error.message);
      
      // Add failure to memory
      await this.addToMemory({
        id: `windows_click_error_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: `Failed to click Windows element: ${locatePrompt}`,
        context: {
          userAction: 'click',
          elementInfo: locatePrompt,
          errorInfo: error.message,
        },
        metadata: {
          executionTime: 0,
          success: false,
          confidence: 0.0,
        },
        tags: ['click', 'windows', 'error'],
      });

      throw error;
    }
  }

  /**
   * AI-powered input action for Windows applications
   */
  public async aiInputWindows(
    text: string, 
    locatePrompt?: string, 
    options?: LocateOption & WindowsInputOptions
  ): Promise<AITaskResult> {
    debugWindowsAgent('AI input on Windows element: %s', locatePrompt || 'focused element');

    try {
      // Get memory context
      const memoryContext = this.getMemoryAsContext();
      
      let result: AITaskResult;
      
      if (locatePrompt) {
        // Use aiInput with element location
        const enhancedPrompt = memoryContext 
          ? `${locatePrompt}\n\nPrevious workflow steps:\n${memoryContext}`
          : locatePrompt;
        result = await this.aiInput(text, enhancedPrompt, options);
      } else {
        // Direct input to focused element
        await this.windowsPage.type(text, options);
        result = {
          result: { success: true },
          metadata: { executionTime: 0 },
        };
      }

      // Add to memory
      await this.addToMemory({
        id: `windows_input_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: `Input text in Windows application: "${text}"`,
        context: {
          userAction: 'input',
          elementInfo: locatePrompt || 'focused element',
          url: await this.windowsPage.url(),
        },
        metadata: {
          executionTime: result.metadata?.executionTime || 0,
          success: true,
          confidence: 0.9,
        },
        tags: ['input', 'windows', 'ai-action'],
      });

      return result;
    } catch (error: any) {
      debugWindowsAgent('AI input failed: %s', error.message);
      throw error;
    }
  }

  /**
   * AI-powered key press action for Windows applications
   */
  public async aiKeyPressWindows(
    key: string, 
    options?: WindowsInputOptions
  ): Promise<AITaskResult> {
    debugWindowsAgent('AI key press: %s', key);

    try {
      await this.windowsPage.keyPress(key, options);

      // Add to memory
      await this.addToMemory({
        id: `windows_keypress_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: `Pressed key in Windows application: ${key}`,
        context: {
          userAction: 'keypress',
          elementInfo: key,
          url: await this.windowsPage.url(),
        },
        metadata: {
          executionTime: 0,
          success: true,
          confidence: 1.0,
        },
        tags: ['keypress', 'windows', 'ai-action'],
      });

      return {
        result: { success: true },
        metadata: { executionTime: 0 },
      };
    } catch (error: any) {
      debugWindowsAgent('AI key press failed: %s', error.message);
      throw error;
    }
  }

  /**
   * AI-powered assertion for Windows applications
   */
  public async aiAssertWindows(assertion: string): Promise<AITaskResult> {
    debugWindowsAgent('AI assertion for Windows: %s', assertion);

    try {
      // Get memory context for better assertion understanding
      const memoryContext = this.getMemoryAsContext();
      const enhancedAssertion = memoryContext 
        ? `${assertion}\n\nPrevious workflow steps:\n${memoryContext}`
        : assertion;

      const result = await this.aiAssert(enhancedAssertion);

      // Add to memory
      await this.addToMemory({
        id: `windows_assert_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Assertion',
        summary: `Windows assertion: ${assertion}`,
        context: {
          assertionResult: result.result?.success || false,
          assertionDetails: assertion,
          url: await this.windowsPage.url(),
        },
        metadata: {
          executionTime: result.metadata?.executionTime || 0,
          success: result.result?.success || false,
          confidence: 0.9,
        },
        tags: ['assertion', 'windows', 'ai-action'],
      });

      return result;
    } catch (error: any) {
      debugWindowsAgent('AI assertion failed: %s', error.message);
      throw error;
    }
  }

  /**
   * AI-powered data extraction for Windows applications
   */
  public async aiQueryWindows(query: string): Promise<AITaskResult> {
    debugWindowsAgent('AI query for Windows: %s', query);

    try {
      // Get memory context
      const memoryContext = this.getMemoryAsContext();
      const enhancedQuery = memoryContext 
        ? `${query}\n\nPrevious workflow steps:\n${memoryContext}`
        : query;

      const result = await this.aiQuery(enhancedQuery);

      // Add to memory with extracted data
      await this.addToMemory({
        id: `windows_query_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Extraction',
        summary: `Windows data extraction: ${query}`,
        context: {
          dataExtracted: result.result,
          url: await this.windowsPage.url(),
        },
        metadata: {
          executionTime: result.metadata?.executionTime || 0,
          success: true,
          confidence: 0.9,
        },
        tags: ['query', 'extraction', 'windows', 'ai-action'],
      });

      return result;
    } catch (error: any) {
      debugWindowsAgent('AI query failed: %s', error.message);
      throw error;
    }
  }

  /**
   * Gets the current Windows application information
   */
  public async getCurrentApplication(): Promise<WindowsApplication | null> {
    try {
      const url = await this.windowsPage.url();
      // Parse the URL to get application info
      // This is a simplified implementation
      return null;
    } catch (error: any) {
      debugWindowsAgent('Failed to get current application: %s', error.message);
      return null;
    }
  }

  /**
   * Takes a screenshot of the current Windows application
   */
  public async takeScreenshot(): Promise<string> {
    debugWindowsAgent('Taking Windows screenshot');
    
    try {
      return await this.windowsPage.screenshotBase64();
    } catch (error: any) {
      debugWindowsAgent('Screenshot failed: %s', error.message);
      throw error;
    }
  }

  /**
   * Disconnects from the current Windows application
   */
  public async disconnect(): Promise<void> {
    debugWindowsAgent('Disconnecting from Windows application');
    
    try {
      await this.windowsPage.disconnect();
      
      // Add disconnection to memory
      await this.addToMemory({
        id: `disconnect_${Date.now()}`,
        timestamp: Date.now(),
        taskType: 'Action',
        summary: 'Disconnected from Windows application',
        context: {
          userAction: 'disconnect',
        },
        metadata: {
          executionTime: 0,
          success: true,
          confidence: 1.0,
        },
        tags: ['disconnect', 'windows'],
      });
    } catch (error: any) {
      debugWindowsAgent('Disconnect failed: %s', error.message);
      throw error;
    }
  }
}
