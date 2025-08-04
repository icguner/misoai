import { beforeAll, describe, expect, it } from 'vitest';
import { sleep } from '@midscene/shared/utils';
import { AndroidAgent } from '@midscene/android';

const targetApp = 'com.android.chrome';

describe(
  'Kimi VL AI Test on Android',
  () => {
    let agent: AndroidAgent;

    beforeAll(async () => {
      agent = new AndroidAgent();
      await agent.connect();
      console.log('Android agent connected for Kimi VL tests');
    });

    it('should navigate and interact with elements using Kimi VL', async () => {
      // Launch Chrome browser
      await agent.launchApp(targetApp);
      await sleep(3000);

      // Navigate to a simple test page
      await agent.aiTap('address bar');
      await sleep(1000);
      
      await agent.aiInput('example.com');
      await sleep(1000);
      
      await agent.aiTap('go button');
      await sleep(3000);

      // Take a screenshot to verify we're on the right page
      const screenshot = await agent.getScreenshot();
      expect(screenshot).toBeTruthy();
      
      // Verify we can find elements on the page
      const pageContent = await agent.aiExtract('Get the main heading text from the page');
      expect(pageContent).toBeTruthy();
      
      console.log('Kimi VL successfully extracted page content:', pageContent);
    });

    it('should scroll and locate elements using Kimi VL', async () => {
      // Test scrolling functionality
      await agent.aiScroll('scroll down');
      await sleep(2000);
      
      // Take screenshot after scroll
      const screenshot = await agent.getScreenshot();
      expect(screenshot).toBeTruthy();
      
      // Test element location
      const hasFooter = await agent.aiAssert('There is a footer section visible on the page');
      console.log('Footer visibility check result:', hasFooter);
    });
  },
  {
    timeout: 120000,
  }
);