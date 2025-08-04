import { sleep } from 'rfi-ai-core/utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AndroidAgent, agentFromLocalAppium, type AppiumBaseCapabilities } from '../../src';

vi.setConfig({
  testTimeout: 300 * 1000, // 5 minutes timeout for comprehensive testing
});

describe('Gemini 2.5 Pro Chain of Thought Android Tests', () => {
  let agent: AndroidAgent;

  beforeAll(async () => {
    console.log('🚀 Setting up Appium Local Agent with Gemini 2.5 Pro...');
    
    // Define Appium capabilities for local testing
    const capabilities: AppiumBaseCapabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Device', // Will auto-detect connected device
      'appium:newCommandTimeout': 300, // 5 minutes timeout
      'appium:autoGrantPermissions': true, // Automatically grant permissions
      'appium:noReset': true, // Don't reset app state between sessions
      'appium:fullReset': false, // Don't uninstall apps
      'appium:skipServerInstallation': true, // Skip server installation if already exists
      // Add Chrome browser capabilities for web testing
      'appium:chromedriverAutodownload': true,
      'appium:ensureWebviewsHavePages': true,
      'appium:nativeWebScreenshot': true,
      // Performance optimizations
      'appium:skipLogcatCapture': false, // Capture logs for debugging
      'appium:suppressKillServer': true, // Don't kill server after test
    };

    try {
      // Create agent using local Appium server
      agent = await agentFromLocalAppium(capabilities, {
        aiActionContext: 
          'You are testing with Gemini 2.5 Pro enhanced chain of thought reasoning. ' +
          'For any permissions, location access, user agreements, or popups - click Allow/Accept/Agree. ' +
          'If login screens appear, close them or skip. ' +
          'Use detailed visual analysis for precise element detection. ' +
          'Apply systematic reasoning: 1) Analyze screen layout, 2) Identify all matching elements, ' +
          '3) Select the best match using disambiguation rules, 4) Validate coordinates are accurate.',
      });
      
      console.log('✅ Appium Agent created successfully');
      
      // Test basic connectivity
      const currentActivity = await agent.page.getCurrentActivity?.() || 'unknown';
      console.log(`📱 Current device activity: ${currentActivity}`);
      
    } catch (error: any) {
      console.error('❌ Failed to create Appium agent:', error.message);
      console.error('Please ensure:');
      console.error('  1. Appium server is running on localhost:4723');
      console.error('  2. Android device is connected and authorized');
      console.error('  3. USB debugging is enabled on the device');
      console.error('  4. Run: npx appium server --port 4723');
      throw error;
    }
  });

  it('Basic scroll interactions - Social Media Feed', async () => {
    console.log('🧪 Testing scroll interactions with chain of thought...');
    
    // Open a social media app or browser with scrollable content
    await agent.aiScroll('aşağıya hafif kaydır');
    await sleep(2000);
    
    // Navigate to a page with scrollable content
    await agent.aiAction('Go to Reddit homepage by typing "reddit.com" in address bar and pressing Enter');
    await sleep(5000);
    
    // Test scrolling with detailed reasoning
    await agent.aiAction('Scroll down slowly to see more posts, analyzing the content as you scroll');
    await sleep(2000);
    
    await agent.aiAction('Scroll down again to see additional posts, use chain of thought to identify interesting content');
    await sleep(2000);
    
    // Test scroll up
    await agent.aiAction('Scroll back up to the top of the page, ensuring smooth navigation');
    await sleep(2000);
    
    // Verify scroll functionality worked
    await agent.aiAssert('The page content has changed after scrolling operations and I can see the top of the page');
    
    console.log('✅ Basic scroll test completed');
  }, 120 * 1000);

  it('Precise element detection and interaction', async () => {
    console.log('🧪 Testing enhanced element detection with disambiguation...');
    
    // Go to a page with multiple similar elements
    await agent.aiAction('Navigate to "news.ycombinator.com" (Hacker News) for testing element detection');
    await sleep(4000);
    
    // Test precise element selection with chain of thought
    await agent.aiAction('Identify and click on the FIRST news story title (not comments, not votes, but the actual article title)');
    await sleep(3000);
    
    // Go back and test another interaction
    await agent.aiAction('Press the back button to return to the main page');
    await sleep(2000);
    
    // Test disambiguation between similar elements
    await agent.aiAction('Find the comments link for the SECOND story and click it (not the first story, specifically the second one)');
    await sleep(3000);
    
    // Verify we're on a comments page
    await agent.aiAssert('I can see comments or discussion related to a news story');
    
    console.log('✅ Element detection test completed');
  }, 120 * 1000);

  it('Advanced scroll with content analysis', async () => {
    console.log('🧪 Testing advanced scroll with content understanding...');
    
    // Go to settings to test different scroll patterns
    await agent.aiAction('Open Android Settings app');
    await sleep(2000);
    
    // Test scroll in settings with specific target finding
    await agent.aiAction('Scroll down through settings looking for "Display" or "Screen" settings');
    await sleep(2000);
    
    await agent.aiAction('Continue scrolling until you find display-related settings, then tap on it');
    await sleep(3000);
    
    // Test horizontal scroll if available (brightness slider, etc.)
    await agent.aiAction('If there is a brightness slider or any horizontal control, interact with it carefully');
    await sleep(2000);
    
    // Navigate back
    await agent.aiAction('Press back button to return to main settings');
    await sleep(2000);
    
    // Test finding specific setting through scroll
    await agent.aiAction('Scroll down to find "Apps" or "Application Manager" setting and tap it');
    await sleep(3000);
    
    await agent.aiAssert('I can see a list of installed applications');
    
    console.log('✅ Advanced scroll test completed');
  }, 150 * 1000);

  it('Complex interactions with multiple elements', async () => {
    console.log('🧪 Testing complex multi-element interactions...');
    
    // Go back to home screen
    await agent.aiAction('Press home button to go to main screen');
    await sleep(2000);
    
    // Open a complex app like Play Store
    await agent.aiAction('Open Google Play Store app');
    await sleep(4000);
    
    // Handle any popups
    await agent.aiAction('If there are any welcome screens, terms, or popups, accept or skip them');
    await sleep(2000);
    
    // Test search functionality
    await agent.aiAction('Tap on the search box at the top and search for "calculator"');
    await sleep(3000);
    
    // Test scroll in search results
    await agent.aiAction('Scroll down through the calculator app search results');
    await sleep(2000);
    
    // Test selecting specific app from results
    await agent.aiAction('Find and tap on a highly-rated calculator app (not an ad, look for good ratings)');
    await sleep(4000);
    
    // Test app details page scrolling
    await agent.aiAction('Scroll down to read app description and reviews');
    await sleep(2000);
    
    await agent.aiAction('Scroll back up to see app rating and install button');
    await sleep(2000);
    
    // Don't actually install, just verify we can see the interface
    await agent.aiAssert('I can see app details including rating, description, and install button');
    
    console.log('✅ Complex interactions test completed');
  }, 180 * 1000);

  it('Chain of thought reasoning validation', async () => {
    console.log('🧪 Validating chain of thought improvements...');
    
    // Go to a visually complex page to test reasoning
    await agent.aiAction('Press back button multiple times to exit Play Store');
    await sleep(2000);
    
    await agent.aiAction('Open Chrome browser again');
    await sleep(2000);
    
    // Navigate to a complex page
    await agent.aiAction('Go to "github.com" to test element detection in a complex interface');
    await sleep(5000);
    
    // Test disambiguation in complex interface
    await agent.aiAction('Look for the main search box (not any other input fields) and type "javascript"');
    await sleep(3000);
    
    await agent.aiAction('Press Enter or click the search button to search');
    await sleep(4000);
    
    // Test scrolling with content analysis
    await agent.aiAction('Scroll down through search results, analyzing the different types of repositories');
    await sleep(3000);
    
    // Test precise element selection in search results
    await agent.aiAction('Find a JavaScript repository with high star count and click on it (not the user profile, but the repository itself)');
    await sleep(4000);
    
    // Test navigation within repository
    await agent.aiAction('Scroll down to read the README file content');
    await sleep(3000);
    
    // Verify chain of thought worked
    await agent.aiAssert('I can see repository details including code, README, and project information');
    
    console.log('✅ Chain of thought validation completed');
  }, 180 * 1000);

  it('Performance and accuracy metrics', async () => {
    console.log('🧪 Measuring performance and accuracy...');
    
    const startTime = Date.now();
    
    // Quick interaction test for performance
    await agent.aiAction('Press home button to return to home screen');
    await sleep(1000);
    
    await agent.aiAction('Open Calculator app quickly');
    await sleep(2000);
    
    // Test rapid precise interactions
    await agent.aiAction('Tap on number 1, then +, then number 2, then equals button');
    await sleep(1000);
    
    // Verify calculation
    const result = await agent.aiQuery('string, what is the result shown on the calculator display?');
    expect(result).toContain('3');
    
    await agent.aiAction('Clear the calculator display');
    await sleep(1000);
    
    // Test more complex calculation
    await agent.aiAction('Calculate 25 × 4 using the calculator buttons');
    await sleep(2000);
    
    const complexResult = await agent.aiQuery('number, what is the calculation result on display?');
    expect(complexResult).toBe(100);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️ Performance test completed in ${duration}ms`);
    
    // Assert performance was reasonable (should complete within test timeout)
    expect(duration).toBeLessThan(60000); // Less than 1 minute
    
    console.log('✅ Performance test completed');
  }, 90 * 1000);

  afterAll(async () => {
    if (agent) {
      console.log('🧹 Cleaning up Appium session...');
      // Return to home screen
      try {
        await agent.aiAction('Press home button to return to main screen');
        await sleep(1000);
      } catch (error) {
        console.log('Note: Could not return to home screen during cleanup');
      }
      
      try {
        // Disconnect the Appium session
        await agent.page.disconnect();
        console.log('✅ Appium session disconnected successfully');
      } catch (error: any) {
        console.log(`Note: Error during cleanup: ${error.message}`);
      }
    }
  });
});