import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WindowsAgent } from '../src/agent/windows-agent';
import type { WindowsAutomationConfig } from '../src/types';

// Mock the dependencies
vi.mock('@nut-tree/nut-js', () => ({
  screen: {
    capture: vi.fn().mockResolvedValue({
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
    }),
  },
  mouse: {
    move: vi.fn(),
    leftClick: vi.fn(),
    rightClick: vi.fn(),
  },
  keyboard: {
    type: vi.fn(),
    pressKey: vi.fn(),
    releaseKey: vi.fn(),
  },
  Key: {
    Enter: 'Enter',
    Tab: 'Tab',
    Space: 'Space',
    LeftControl: 'LeftControl',
    LeftAlt: 'LeftAlt',
  },
}));

vi.mock('robotjs', () => ({
  screen: {
    capture: vi.fn().mockReturnValue({
      image: Buffer.from('mock-robotjs-screenshot'),
    }),
  },
  moveMouse: vi.fn(),
  mouseClick: vi.fn(),
  typeString: vi.fn(),
  keyTap: vi.fn(),
}));

vi.mock('active-win', () => ({
  default: vi.fn().mockResolvedValue({
    owner: {
      processId: 1234,
      name: 'TestApp',
      path: 'C:\\TestApp\\app.exe',
    },
    title: 'Test Application',
    id: 'window123',
    bounds: {
      x: 100,
      y: 100,
      width: 800,
      height: 600,
    },
  }),
}));

describe('WindowsAgent', () => {
  let agent: WindowsAgent;
  let mockConfig: Partial<WindowsAutomationConfig>;

  beforeEach(() => {
    mockConfig = {
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
    };

    agent = new WindowsAgent({
      windowsConfig: mockConfig,
      memoryConfig: {
        maxItems: 10,
        maxAge: 60000,
        enablePersistence: false,
        enableAnalytics: true,
        filterStrategy: 'hybrid',
      },
    });
  });

  afterEach(async () => {
    await agent.disconnect();
  });

  describe('Connection and Setup', () => {
    it('should create WindowsAgent with default configuration', () => {
      const defaultAgent = new WindowsAgent();
      expect(defaultAgent).toBeInstanceOf(WindowsAgent);
    });

    it('should connect to active application', async () => {
      await expect(agent.connectToApplication()).resolves.toBe(agent);
    });

    it('should launch application', async () => {
      // Mock child_process.spawn
      const mockSpawn = vi.fn().mockReturnValue({
        pid: 5678,
      });
      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      await expect(agent.launchApplication('notepad.exe')).resolves.toBe(agent);
      expect(mockSpawn).toHaveBeenCalledWith('notepad.exe', [], {
        detached: true,
        stdio: 'ignore',
      });
    });
  });

  describe('Screenshot Functionality', () => {
    it('should capture screenshot', async () => {
      const screenshot = await agent.takeScreenshot();
      expect(screenshot).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle screenshot errors gracefully', async () => {
      // Mock screenshot failure
      const nutjs = await import('@nut-tree/nut-js');
      vi.mocked(nutjs.screen.capture).mockRejectedValueOnce(new Error('Screenshot failed'));

      await expect(agent.takeScreenshot()).rejects.toThrow('Screenshot failed');
    });
  });

  describe('AI-Powered Actions', () => {
    beforeEach(async () => {
      // Connect to mock application
      await agent.connectToApplication();
    });

    it('should perform AI click action', async () => {
      // Mock the underlying aiTap method
      const mockAiTap = vi.spyOn(agent, 'aiTap').mockResolvedValue({
        result: { success: true },
        metadata: { executionTime: 1000 },
      });

      const result = await agent.aiClickWindows('Click the OK button');
      
      expect(mockAiTap).toHaveBeenCalledWith(
        expect.stringContaining('Click the OK button'),
        undefined
      );
      expect(result.result.success).toBe(true);
    });

    it('should perform AI input action', async () => {
      // Mock the underlying aiInput method
      const mockAiInput = vi.spyOn(agent, 'aiInput').mockResolvedValue({
        result: { success: true },
        metadata: { executionTime: 800 },
      });

      const result = await agent.aiInputWindows('Hello World', 'text input field');
      
      expect(mockAiInput).toHaveBeenCalledWith(
        'Hello World',
        expect.stringContaining('text input field'),
        undefined
      );
      expect(result.result.success).toBe(true);
    });

    it('should perform AI assertion', async () => {
      // Mock the underlying aiAssert method
      const mockAiAssert = vi.spyOn(agent, 'aiAssert').mockResolvedValue({
        result: { success: true },
        metadata: { executionTime: 600 },
      });

      const result = await agent.aiAssertWindows('Window title contains "Test"');
      
      expect(mockAiAssert).toHaveBeenCalledWith(
        expect.stringContaining('Window title contains "Test"')
      );
      expect(result.result.success).toBe(true);
    });

    it('should perform AI query', async () => {
      // Mock the underlying aiQuery method
      const mockAiQuery = vi.spyOn(agent, 'aiQuery').mockResolvedValue({
        result: { username: 'testuser', email: 'test@example.com' },
        metadata: { executionTime: 1200 },
      });

      const result = await agent.aiQueryWindows('Extract user information from the profile page');
      
      expect(mockAiQuery).toHaveBeenCalledWith(
        expect.stringContaining('Extract user information')
      );
      expect(result.result).toEqual({
        username: 'testuser',
        email: 'test@example.com',
      });
    });
  });

  describe('Memory Integration', () => {
    beforeEach(async () => {
      await agent.connectToApplication();
    });

    it('should add actions to memory', async () => {
      // Mock aiTap to avoid actual AI calls
      vi.spyOn(agent, 'aiTap').mockResolvedValue({
        result: { success: true },
        metadata: { executionTime: 1000 },
      });

      await agent.aiClickWindows('Click button 1');
      await agent.aiClickWindows('Click button 2');

      const memoryStats = agent.getMemoryStats();
      expect(memoryStats.totalItems).toBeGreaterThan(0);
    });

    it('should maintain workflow context', async () => {
      // Mock AI methods
      vi.spyOn(agent, 'aiTap').mockResolvedValue({
        result: { success: true },
        metadata: { executionTime: 1000 },
      });
      vi.spyOn(agent, 'aiAssert').mockResolvedValue({
        result: { success: true },
        metadata: { executionTime: 600 },
      });

      // Perform a sequence of actions
      await agent.aiClickWindows('Open File menu');
      await agent.aiClickWindows('Click New Document');
      await agent.aiAssertWindows('New document is created');

      const workflowMemory = agent.getWorkflowMemory();
      expect(workflowMemory.memory.length).toBeGreaterThanOrEqual(3);
      
      // Check that memory contains our actions
      const summaries = workflowMemory.memory.map(item => item.summary);
      expect(summaries.some(s => s.includes('File menu'))).toBe(true);
      expect(summaries.some(s => s.includes('New Document'))).toBe(true);
    });

    it('should handle memory context in AI calls', async () => {
      // Add some initial memory
      await agent.addToMemory({
        id: 'test-memory-1',
        timestamp: Date.now(),
        taskType: 'Action',
        summary: 'Opened application settings',
        context: {
          userAction: 'click',
          elementInfo: 'settings button',
        },
        metadata: {
          executionTime: 500,
          success: true,
          confidence: 0.9,
        },
        tags: ['settings', 'navigation'],
      });

      // Mock aiTap to capture the enhanced prompt
      let capturedPrompt = '';
      vi.spyOn(agent, 'aiTap').mockImplementation(async (prompt) => {
        capturedPrompt = prompt;
        return {
          result: { success: true },
          metadata: { executionTime: 1000 },
        };
      });

      await agent.aiClickWindows('Click display settings');

      // Verify that memory context was included
      expect(capturedPrompt).toContain('Click display settings');
      expect(capturedPrompt).toContain('Previous workflow steps');
      expect(capturedPrompt).toContain('Opened application settings');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      // Mock connection failure
      const mockActiveWin = await import('active-win');
      vi.mocked(mockActiveWin.default).mockRejectedValueOnce(new Error('No active window'));

      await expect(agent.connectToApplication()).rejects.toThrow('No active window');
    });

    it('should add failed actions to memory', async () => {
      await agent.connectToApplication();

      // Mock aiTap to fail
      vi.spyOn(agent, 'aiTap').mockRejectedValueOnce(new Error('Element not found'));

      await expect(agent.aiClickWindows('Click non-existent button')).rejects.toThrow('Element not found');

      // Check that failure was recorded in memory
      const memoryStats = agent.getMemoryStats();
      expect(memoryStats.totalItems).toBeGreaterThan(0);
    });
  });

  describe('Key Press Operations', () => {
    beforeEach(async () => {
      await agent.connectToApplication();
    });

    it('should perform key press operations', async () => {
      const result = await agent.aiKeyPressWindows('enter');
      expect(result.result.success).toBe(true);
    });

    it('should handle key combinations', async () => {
      const result = await agent.aiKeyPressWindows('c', { modifiers: ['ctrl'] });
      expect(result.result.success).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should disconnect cleanly', async () => {
      await agent.connectToApplication();
      await expect(agent.disconnect()).resolves.toBeUndefined();
    });

    it('should add disconnection to memory', async () => {
      await agent.connectToApplication();
      
      const initialMemorySize = agent.getMemoryStats().totalItems;
      await agent.disconnect();
      
      const finalMemorySize = agent.getMemoryStats().totalItems;
      expect(finalMemorySize).toBeGreaterThan(initialMemorySize);
    });
  });
});
