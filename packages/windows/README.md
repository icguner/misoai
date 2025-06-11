# misoai-windows

Windows desktop automation library for misoAI with AI-powered testing capabilities.

## Features

- 🤖 **AI-Powered Automation**: Use natural language to interact with Windows applications
- 🧠 **Memory Integration**: Context-aware workflows with step-to-step memory
- 📸 **Screenshot Capture**: Multiple screenshot methods (RobotJS, Nut.js, Win32 API)
- 🎯 **Element Detection**: AI vision and Windows UI Automation support
- ⌨️ **Input Simulation**: Mouse and keyboard automation
- 🪟 **Window Management**: Launch, focus, resize, and manipulate windows
- 🔄 **Cross-Platform Ready**: Extensible architecture for future platform support

## Installation

```bash
npm install misoai-windows
```

### Optional Dependencies

For enhanced functionality, install these optional dependencies:

```bash
# For advanced screenshot and input simulation
npm install @nut-tree/nut-js

# For basic screenshot and input (alternative)
npm install robotjs

# For desktop screenshot capture
npm install screenshot-desktop

# For active window detection
npm install active-win

# For Win32 API access (advanced)
npm install node-ffi-napi ref-napi ref-struct-di
```

## Quick Start

### Basic Usage

```typescript
import { createWindowsAgent, launchWindowsApp } from 'misoai-windows';

// Connect to active window
const agent = createWindowsAgent();
await agent.connectToApplication();

// Take a screenshot
const screenshot = await agent.takeScreenshot();

// Launch an application
const notepadAgent = await launchWindowsApp('notepad.exe');
await notepadAgent.aiInputWindows('Hello, Windows Automation!');
```

### AI-Powered Automation

```typescript
import { createWindowsAgent } from 'misoai-windows';

const agent = createWindowsAgent({
  screenshotMethod: 'nutjs',
  elementDetection: 'ai-vision',
  memoryEnabled: true,
  aiActionContext: 'You are automating a Windows calculator application.',
});

// Connect to Calculator
await agent.connectToApplication('calc.exe');

// Perform calculations using natural language
await agent.aiClickWindows('Click the number 5 button');
await agent.aiClickWindows('Click the plus (+) button');
await agent.aiClickWindows('Click the number 3 button');
await agent.aiClickWindows('Click the equals (=) button');

// Verify result
await agent.aiAssertWindows('The calculator shows the result 8');

// Extract data
const result = await agent.aiQueryWindows('What number is displayed on the calculator?');
console.log('Calculator result:', result.result);
```

### Memory-Aware Workflows

```typescript
// The agent automatically maintains context between steps
await agent.aiClickWindows('Open the File menu');
await agent.aiClickWindows('Click New to create a new document');
await agent.aiInputWindows('This text will be typed in the new document');

// AI understands the context from previous steps
await agent.aiAssertWindows('A new document is open with the typed text');

// Get workflow memory
const memory = agent.getWorkflowMemory();
console.log(`Workflow has ${memory.memory.length} steps`);
```

## Configuration

### WindowsAutomationConfig

```typescript
interface WindowsAutomationConfig {
  screenshotMethod: 'robotjs' | 'nutjs' | 'screenshot-desktop' | 'win32-api';
  elementDetection: 'ai-vision' | 'win32-uia' | 'accessibility-api';
  windowManagement: 'win32-api' | 'nutjs' | 'robotjs';
  performance: {
    screenshotCaching: boolean;
    elementCaching: boolean;
    batchOperations: boolean;
  };
  timeouts: {
    screenshot: number;
    elementSearch: number;
    windowOperation: number;
  };
}
```

### Memory Configuration

```typescript
interface MemoryConfig {
  maxItems: number;           // Maximum memory items to retain
  maxAge: number;            // Maximum age in milliseconds
  enablePersistence: boolean; // Enable memory persistence
  enableAnalytics: boolean;   // Enable memory analytics
  filterStrategy: 'relevance' | 'recency' | 'hybrid';
}
```

## API Reference

### WindowsAgent

#### Connection Methods
- `connectToApplication(identifier?: string | number)` - Connect to existing application
- `launchApplication(path: string, args?: string[])` - Launch new application
- `disconnect()` - Disconnect from current application

#### AI Methods
- `aiClickWindows(locatePrompt: string, options?)` - AI-powered click
- `aiInputWindows(text: string, locatePrompt?: string, options?)` - AI-powered input
- `aiKeyPressWindows(key: string, options?)` - AI-powered key press
- `aiAssertWindows(assertion: string)` - AI-powered assertion
- `aiQueryWindows(query: string)` - AI-powered data extraction

#### Utility Methods
- `takeScreenshot()` - Capture screenshot
- `getCurrentApplication()` - Get current application info
- `getMemoryStats()` - Get memory statistics
- `getWorkflowMemory()` - Get workflow memory data

### Factory Functions

```typescript
// Create agent with default configuration
createWindowsAgent(options?)

// Create agent for specific application
createWindowsAgentForApp(applicationIdentifier, options?)

// Launch application and create agent
launchWindowsApp(applicationPath, args?, options?)
```

## Examples

### Calculator Automation

```typescript
const agent = await launchWindowsApp('calc.exe');

// Perform calculation: 15 + 25
await agent.aiClickWindows('Click number 1');
await agent.aiClickWindows('Click number 5');
await agent.aiClickWindows('Click plus button');
await agent.aiClickWindows('Click number 2');
await agent.aiClickWindows('Click number 5');
await agent.aiClickWindows('Click equals button');

// Verify result
await agent.aiAssertWindows('Calculator shows 40');
```

### Text Editor Workflow

```typescript
const agent = await launchWindowsApp('notepad.exe');

// Create document
await agent.aiInputWindows('Windows Automation Test\n\nThis is automated content.');

// Use keyboard shortcuts
await agent.aiKeyPressWindows('a', { modifiers: ['ctrl'] }); // Select all
await agent.aiKeyPressWindows('c', { modifiers: ['ctrl'] }); // Copy

// Open Find dialog
await agent.aiKeyPressWindows('f', { modifiers: ['ctrl'] });
await agent.aiInputWindows('automation');
```

## Memory System Integration

The Windows package integrates seamlessly with misoAI's memory system:

- **Step Context**: Each action remembers previous steps
- **Data Persistence**: Extracted data is available in subsequent steps
- **Workflow Continuity**: AI understands the full workflow context
- **Error Recovery**: Failed actions are remembered for better retry logic

```typescript
// Memory is automatically managed
await agent.aiClickWindows('Open settings menu');
await agent.aiClickWindows('Navigate to display settings'); // AI knows we're in settings
await agent.aiQueryWindows('What is the current screen resolution?'); // Data is stored
await agent.aiAssertWindows('Display settings are configured correctly'); // Uses previous context
```

## Platform Support

- **Windows 10/11**: Full support
- **Windows Server**: Basic support
- **Architecture**: x64, x86 (depends on native dependencies)

## Dependencies

### Required
- `misoai-core`: Core AI functionality
- `misoai-shared`: Shared utilities
- `misoai-web`: Web integration base classes

### Optional (for enhanced features)
- `@nut-tree/nut-js`: Advanced automation capabilities
- `robotjs`: Basic automation and screenshot
- `screenshot-desktop`: Desktop screenshot capture
- `active-win`: Active window detection
- `node-ffi-napi`: Win32 API access

## Troubleshooting

### Common Issues

1. **Native Dependencies**: Some dependencies require Visual Studio Build Tools
   ```bash
   npm install --global windows-build-tools
   ```

2. **Permission Issues**: Run as administrator for system-level automation

3. **Screenshot Failures**: Try different screenshot methods in configuration

4. **Element Detection**: Use AI vision for complex applications, Win32 UIA for standard controls

## Contributing

See the main misoAI repository for contribution guidelines.

## License

MIT
