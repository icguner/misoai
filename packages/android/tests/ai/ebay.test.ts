import { sleep } from 'misoai-core/utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AndroidAgent, AndroidDevice, getConnectedDevices } from '../../src';

vi.setConfig({
  testTimeout: 240 * 1000,
});

const pageUrl = 'https://www.ebay.com';

describe('Test todo list', () => {
  let agent: AndroidAgent;

  beforeAll(async () => {
    const devices = await getConnectedDevices();
    const page = new AndroidDevice(devices[0].udid);
    agent = new AndroidAgent(page, {
      aiActionContext:
        'If any location, permission, user agreement, etc. popup, click agree. If login page pops up, close it.',
    });
    await page.connect();
    await page.launch(pageUrl);
    await sleep(3000);
  });

  it(
    'search headphones',
    async () => {
      // 👀 type keywords, perform a search
      await agent.aiAction('type "Headphones" in search box, hit Enter');

      // 👀 wait for the loading
      await agent.aiWaitFor('there is at least one headphone item on page');
      // or you may use a plain sleep:
      // await sleep(5000);

      // 👀 understand the page content, find the items
      const items = await agent.aiQuery(
        '{itemTitle: string, price: Number}[], find item in list and corresponding price',
      );
      console.log('headphones in stock', items);

      // 👀 assert by AI
      await agent.aiAssert('There is a category filter on the left');
    },
    720 * 1000,
  );
});
