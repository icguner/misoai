/**
 * AI-powered Windows automation example
 * Demonstrates using AI functions with memory integration for complex workflows
 */

import { createWindowsAgent, launchWindowsApp } from '../src';

async function aiWindowsAutomation() {
  console.log('🤖 Starting AI-powered Windows automation example...');

  try {
    // Launch Calculator app
    console.log('\n🧮 Launching Calculator...');
    const agent = await launchWindowsApp('calc.exe', [], {
      screenshotMethod: 'nutjs',
      elementDetection: 'ai-vision',
      memoryEnabled: true,
      aiActionContext: `
        You are automating the Windows Calculator application.
        The calculator has number buttons (0-9), operation buttons (+, -, *, /), 
        equals button (=), and clear button (C).
        Pay attention to the display area showing the current calculation.
      `,
    });

    // Wait for Calculator to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n🔢 Performing calculation: 15 + 25 = ?');

    // Step 1: Click number 1
    console.log('Step 1: Clicking number 1...');
    await agent.aiClickWindows('Click the number 1 button');

    // Step 2: Click number 5
    console.log('Step 2: Clicking number 5...');
    await agent.aiClickWindows('Click the number 5 button');

    // Step 3: Click plus button
    console.log('Step 3: Clicking plus (+) button...');
    await agent.aiClickWindows('Click the plus (+) operation button');

    // Step 4: Click number 2
    console.log('Step 4: Clicking number 2...');
    await agent.aiClickWindows('Click the number 2 button');

    // Step 5: Click number 5
    console.log('Step 5: Clicking number 5...');
    await agent.aiClickWindows('Click the number 5 button');

    // Step 6: Click equals button
    console.log('Step 6: Clicking equals (=) button...');
    await agent.aiClickWindows(
      'Click the equals (=) button to calculate the result',
    );

    // Step 7: Verify the result
    console.log('\n✅ Verifying calculation result...');
    await agent.aiAssertWindows('The calculator display shows the result 40');

    // Step 8: Extract the result using AI query
    console.log('\n📊 Extracting calculation result...');
    const result = await agent.aiQueryWindows(
      'What is the current number displayed on the calculator screen?',
    );
    console.log('Extracted result:', result.result);

    // Step 9: Clear the calculator
    console.log('\n🧹 Clearing calculator...');
    await agent.aiClickWindows(
      'Click the clear (C) button to reset the calculator',
    );

    // Step 10: Verify calculator is cleared
    console.log('\n✅ Verifying calculator is cleared...');
    await agent.aiAssertWindows('The calculator display shows 0 or is empty');

    // Get memory summary
    console.log('\n🧠 Memory Summary:');
    const memoryStats = agent.getMemoryStats();
    console.log(`Total memory items: ${memoryStats.totalItems}`);
    console.log(
      `Memory effectiveness: ${memoryStats.analytics.memoryEffectiveness}%`,
    );

    // Take final screenshot
    console.log('\n📸 Taking final screenshot...');
    const finalScreenshot = await agent.takeScreenshot();
    console.log(
      `✅ Final screenshot captured (${finalScreenshot.length} characters)`,
    );

    // Disconnect
    console.log('\n🔌 Disconnecting...');
    await agent.disconnect();

    console.log('\n🎉 AI Windows automation example completed successfully!');
    console.log('This example demonstrated:');
    console.log('- AI-powered element detection and interaction');
    console.log('- Memory integration across workflow steps');
    console.log('- Context-aware AI actions');
    console.log('- Data extraction and verification');
  } catch (error) {
    console.error('❌ Error in AI Windows automation:', error);
    process.exit(1);
  }
}

async function textEditorWorkflow() {
  console.log('\n📝 Starting text editor workflow example...');

  try {
    // Launch Notepad
    const agent = await launchWindowsApp('notepad.exe', [], {
      aiActionContext: `
        You are automating Notepad text editor.
        Focus on text editing operations, menu interactions, and file operations.
        The main text area is where content is typed and edited.
      `,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 1: Type initial content
    console.log('Step 1: Creating document content...');
    await agent.aiInputWindows(
      `
Windows Automation Test Document
================================

This document was created using AI-powered automation.

Key features tested:
- Text input and editing
- Menu navigation
- File operations
- AI-driven interactions

Date: ${new Date().toLocaleDateString()}
    `.trim(),
    );

    // Step 2: Select all text
    console.log('Step 2: Selecting all text...');
    await agent.aiKeyPressWindows('a', { modifiers: ['ctrl'] });

    // Step 3: Verify text is selected
    console.log('Step 3: Verifying text selection...');
    await agent.aiAssertWindows(
      'All text in the document is selected/highlighted',
    );

    // Step 4: Copy text
    console.log('Step 4: Copying text...');
    await agent.aiKeyPressWindows('c', { modifiers: ['ctrl'] });

    // Step 5: Open Find dialog
    console.log('Step 5: Opening Find dialog...');
    await agent.aiKeyPressWindows('f', { modifiers: ['ctrl'] });

    // Step 6: Search for specific text
    console.log('Step 6: Searching for "automation"...');
    await agent.aiInputWindows('automation');

    // Step 7: Close Find dialog
    console.log('Step 7: Closing Find dialog...');
    await agent.aiKeyPressWindows('escape');

    // Step 8: Extract document statistics
    console.log('Step 8: Analyzing document...');
    const analysis = await agent.aiQueryWindows(`
      Analyze the text document and provide:
      - Approximate word count
      - Number of lines
      - Main topics mentioned
    `);
    console.log('Document analysis:', analysis.result);

    // Get workflow memory
    const workflowMemory = agent.getWorkflowMemory();
    console.log(
      `\n🧠 Workflow completed with ${workflowMemory.memory.length} steps in memory`,
    );

    await agent.disconnect();
    console.log('✅ Text editor workflow completed!');
  } catch (error) {
    console.error('❌ Error in text editor workflow:', error);
  }
}

// Run the examples
if (require.main === module) {
  (async () => {
    await aiWindowsAutomation();
    await textEditorWorkflow();
  })().catch(console.error);
}

export { aiWindowsAutomation, textEditorWorkflow };
