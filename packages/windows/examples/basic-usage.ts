/**
 * Basic Windows automation example
 * Demonstrates connecting to an application and performing simple actions
 */

import { createWindowsAgent, launchWindowsApp } from '../src';

async function basicWindowsAutomation() {
  console.log('🚀 Starting basic Windows automation example...');

  try {
    // Example 1: Connect to the active window
    console.log('\n📱 Connecting to active window...');
    const agent = createWindowsAgent({
      screenshotMethod: 'nutjs',
      elementDetection: 'ai-vision',
      memoryEnabled: true,
    });

    await agent.connectToApplication();
    console.log('✅ Connected to active window');

    // Take a screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshot = await agent.takeScreenshot();
    console.log(`✅ Screenshot captured (${screenshot.length} characters)`);

    // Example 2: Launch Notepad
    console.log('\n📝 Launching Notepad...');
    const notepadAgent = await launchWindowsApp('notepad.exe', [], {
      aiActionContext:
        'You are automating Notepad. Focus on text editing operations.',
    });

    // Wait a moment for Notepad to fully load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Type some text
    console.log('\n⌨️  Typing text in Notepad...');
    await notepadAgent.aiInputWindows('Hello, Windows Automation!');
    console.log('✅ Text typed successfully');

    // Take another screenshot
    console.log('\n📸 Taking Notepad screenshot...');
    const notepadScreenshot = await notepadAgent.takeScreenshot();
    console.log(
      `✅ Notepad screenshot captured (${notepadScreenshot.length} characters)`,
    );

    // Disconnect
    console.log('\n🔌 Disconnecting...');
    await agent.disconnect();
    await notepadAgent.disconnect();
    console.log('✅ Disconnected from applications');

    console.log(
      '\n🎉 Basic Windows automation example completed successfully!',
    );
  } catch (error) {
    console.error('❌ Error in basic Windows automation:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  basicWindowsAutomation().catch(console.error);
}

export { basicWindowsAutomation };
