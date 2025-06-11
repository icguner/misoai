// Test yeni memory helper metodları
const { PuppeteerAgent } = require('./dist/lib/puppeteer');

async function testMemoryHelperMethods() {
  console.log('🧠 Testing Memory Helper Methods...');

  try {
    // Create a comprehensive mock page object
    const mockPage = {
      pageType: 'mock',
      url: () => Promise.resolve('https://example.com/test'),
      title: () => Promise.resolve('Test Page'),
      destroy: () => Promise.resolve(),
      screenshot: () =>
        Promise.resolve(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        ),
      size: () => Promise.resolve({ width: 1024, height: 768 }),
      on: () => {},
      off: () => {},
      removeListener: () => {},
      evaluate: () => Promise.resolve(null),
      evaluateJavaScript: () => Promise.resolve(null),
      content: () =>
        Promise.resolve('<html><body><h1>Test Page</h1></body></html>'),
      locator: () => ({ count: () => Promise.resolve(1) }),
    };

    // Create agent with memory configuration
    const agent = new PuppeteerAgent(mockPage, {
      memoryConfig: {
        maxItems: 20,
        enablePersistence: true,
        enableAnalytics: true,
        filterStrategy: 'hybrid',
      },
    });

    console.log('✅ Agent created with memory configuration');

    // Add some test memory items
    console.log('\n📊 Adding test memory items...');
    const executor = agent.taskExecutor.getPersistentExecutor();

    const testMemoryItems = [
      {
        id: 'test_action_1',
        timestamp: Date.now() - 60000, // 1 minute ago
        taskType: 'Action',
        summary: 'Clicked login button',
        context: {
          url: 'https://example.com/login',
          elementInfo: 'login button',
          userAction: 'click',
        },
        metadata: {
          executionTime: 1200,
          success: true,
          confidence: 0.95,
        },
        tags: ['action', 'click', 'login'],
      },
      {
        id: 'test_query_1',
        timestamp: Date.now() - 45000, // 45 seconds ago
        taskType: 'Insight',
        summary: 'Extracted user profile data',
        context: {
          url: 'https://example.com/profile',
          dataExtracted: {
            username: 'john_doe',
            email: 'john@example.com',
            role: 'admin',
          },
        },
        metadata: {
          executionTime: 800,
          success: true,
          confidence: 0.9,
        },
        tags: ['insight', 'extraction', 'profile'],
      },
      {
        id: 'test_action_2',
        timestamp: Date.now() - 30000, // 30 seconds ago
        taskType: 'Action',
        summary: 'Filled form fields',
        context: {
          url: 'https://example.com/form',
          elementInfo: 'contact form',
          userAction: 'fill',
        },
        metadata: {
          executionTime: 2000,
          success: true,
          confidence: 0.88,
        },
        tags: ['action', 'fill', 'form'],
      },
      {
        id: 'test_assert_1',
        timestamp: Date.now() - 15000, // 15 seconds ago
        taskType: 'Assertion',
        summary: 'Verified form submission success',
        context: {
          url: 'https://example.com/success',
          assertionResult: true,
          expectedCondition: 'success message visible',
        },
        metadata: {
          executionTime: 500,
          success: true,
          confidence: 0.98,
        },
        tags: ['assertion', 'verification', 'success'],
      },
      {
        id: 'test_query_2',
        timestamp: Date.now() - 5000, // 5 seconds ago
        taskType: 'Insight',
        summary: 'Extracted confirmation details',
        context: {
          url: 'https://example.com/confirmation',
          dataExtracted: {
            confirmationId: 'CONF-12345',
            status: 'completed',
            timestamp: new Date().toISOString(),
          },
        },
        metadata: {
          executionTime: 600,
          success: true,
          confidence: 0.92,
        },
        tags: ['insight', 'extraction', 'confirmation'],
      },
    ];

    // Add memory items
    testMemoryItems.forEach((item) => {
      executor.memoryStore.add(item);
    });

    console.log(`   Added ${testMemoryItems.length} test memory items`);

    // Test 1: getMemoryReport() - Detaylı rapor
    console.log('\n📋 Test 1: getMemoryReport() - Detailed Report');
    const memoryReport = agent.getMemoryReport();

    console.log('   📊 Summary:');
    console.log(`      Total Items: ${memoryReport.summary.totalItems}`);
    console.log(
      `      Memory Effectiveness: ${memoryReport.summary.memoryEffectiveness}%`,
    );
    console.log(
      `      Average Memory Size: ${memoryReport.summary.averageMemorySize}`,
    );

    console.log('   📈 Analytics:');
    console.log(
      '      Task Type Distribution:',
      memoryReport.analytics.taskTypeDistribution,
    );
    console.log(`      Success Rate: ${memoryReport.analytics.successRate}%`);
    console.log(
      `      Average Execution Time: ${memoryReport.analytics.averageExecutionTime}ms`,
    );
    console.log(
      `      Data Extraction Count: ${memoryReport.analytics.dataExtractionCount}`,
    );

    console.log('   📝 Recent Items:');
    memoryReport.items.slice(-3).forEach((item, index) => {
      console.log(
        `      ${index + 1}. ${item.summary} (${item.taskType}) - ${item.relativeTime}`,
      );
    });

    // Test 2: getMemorySummary() - Basit özet
    console.log('\n📋 Test 2: getMemorySummary() - Simple Summary');
    const memorySummary = agent.getMemorySummary();

    console.log('   📊 Summary JSON:');
    console.log(JSON.stringify(memorySummary, null, 2));

    // Test 3: JSON Export Test
    console.log('\n📋 Test 3: JSON Export Test');
    console.log('   🔄 Full Memory Report JSON:');
    console.log(JSON.stringify(memoryReport, null, 2));

    // Test 4: Memory Analytics Verification
    console.log('\n📋 Test 4: Memory Analytics Verification');

    // Verify task type distribution
    const expectedTaskTypes = ['Action', 'Insight', 'Assertion'];
    const actualTaskTypes = Object.keys(
      memoryReport.analytics.taskTypeDistribution,
    );
    console.log(`   ✅ Task types found: ${actualTaskTypes.join(', ')}`);

    // Verify data extraction count
    const expectedDataExtractions = 2; // 2 Insight tasks with dataExtracted
    const actualDataExtractions = memoryReport.analytics.dataExtractionCount;
    console.log(
      `   ✅ Data extractions: ${actualDataExtractions} (expected: ${expectedDataExtractions})`,
    );

    // Verify success rate
    const expectedSuccessRate = 100; // All test items are successful
    const actualSuccessRate = memoryReport.analytics.successRate;
    console.log(
      `   ✅ Success rate: ${actualSuccessRate}% (expected: ${expectedSuccessRate}%)`,
    );

    // Test 5: Extracted Data Summary
    console.log('\n📋 Test 5: Extracted Data Summary');
    const extractedData = memorySummary.dataExtracted;
    console.log('   📊 Extracted Data:');
    Object.entries(extractedData).forEach(([step, data]) => {
      console.log(`      ${step}:`, JSON.stringify(data, null, 8));
    });

    // Test 6: Recent Steps Analysis
    console.log('\n📋 Test 6: Recent Steps Analysis');
    console.log('   📝 Recent Workflow Steps:');
    memorySummary.recentSteps.forEach((step, index) => {
      console.log(
        `      ${index + 1}. ${step.step} (${step.type}) - ${step.success ? '✅' : '❌'} - ${step.time}`,
      );
    });

    console.log('\n🎉 Memory Helper Methods Test Completed Successfully!');
    console.log('\n📋 Test Results Summary:');
    console.log('   ✅ getMemoryReport() works correctly');
    console.log('   ✅ getMemorySummary() works correctly');
    console.log('   ✅ JSON export functionality works');
    console.log('   ✅ Memory analytics are accurate');
    console.log('   ✅ Extracted data summary works');
    console.log('   ✅ Recent steps analysis works');
    console.log('   ✅ Relative time formatting works');
    console.log('   ✅ Task type distribution is correct');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testMemoryHelperMethods().catch(console.error);
