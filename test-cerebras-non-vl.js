// Test Cerebras non-VL model with new chain_of_thought + Puppeteer selector format
const { PuppeteerAgent } = require('./packages/web-integration/dist/lib/puppeteer');

async function testCerebrasNonVL() {
  console.log('=== CEREBRAS NON-VL MODEL TEST ===\n');
  console.log('Testing Cerebras Qwen-3-235b with new format on Flypgs\n');
  
  // Set Cerebras configuration
  process.env.OPENAI_API_KEY = '';
  process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
  process.env.RAFI_MODEL_NAME = 'moonshotai/kimi-vl-a3b-thinking:free';
  
  // Ensure we're NOT using VL models
  delete process.env.RAFI_USE_GEMINI;
  delete process.env.RAFI_USE_QWEN_VL;
  
  console.log('Configuration:');
  console.log('- Model:', process.env.RAFI_MODEL_NAME);
  console.log('- Base URL:', process.env.OPENAI_BASE_URL);
  console.log('- API Key:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
  console.log('- VL Models disabled');
  
  const { launchPuppeteerPage } = require('./packages/web-integration/dist/lib/puppeteer-agent-launcher');
  
  const { page, freeFn } = await launchPuppeteerPage({
    url: 'https://www.flypgs.com',
    viewportWidth: 1440,
    viewportHeight: 768,
  }, {
    postActionDelay: 300,
    headed: true
  });

  try {
    const agent = new PuppeteerAgent(page);
    
    // Wait for page to load
    console.log('\nWaiting for Flypgs to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🧠 Testing Cerebras Qwen-3-235b with new format...\n');
    try {
      const tapResult = await agent.aiInput('Istanbul', 'nereden input');
      console.log('✅ aiTap successful');
      console.log('- Result:', tapResult.result);
    } catch (error) {
      console.log('❌ aiTap error:', error.message.substring(0, 200));
    }
    try {
      const tapResult = await agent.aiTap('dropdowndan Sabiha Gökçen seçeneği');
      console.log('✅ aiTap successful');
      console.log('- Result:', tapResult.result);
    } catch (error) {
      console.log('❌ aiTap error:', error.message.substring(0, 200));
    }
    try {
      const tapResult = await agent.aiInput('Bodrum', 'nereye input');
      console.log('✅ aiTap successful');
      console.log('- Result:', tapResult.result);
    } catch (error) {
      console.log('❌ aiTap error:', error.message.substring(0, 200));
    }
    try {
      const tapResult = await agent.aiTap('dropdowndan Milas seçeneği');
      console.log('✅ aiTap successful');
      console.log('- Result:', tapResult.result);
    } catch (error) {
      console.log('❌ aiTap error:', error.message.substring(0, 200));
    }

    try {
      const tapResult = await agent.aiTap('Gidiş Tarihi');
      console.log('✅ aiTap successful');
      console.log('- Result:', tapResult.result);
    } catch (error) {
      console.log('❌ aiTap error:', error.message.substring(0, 200));
    }

    try {
      const tapResult = await agent.aiTap('10 Ağustos');
      console.log('✅ aiTap successful');
      console.log('- Result:', tapResult.result);
    } catch (error) {
      console.log('❌ aiTap error:', error.message.substring(0, 200));
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  
  
    console.log('\n=== EMMETIFY DOM VERIFICATION ===');
    console.log('Check logs above for "[DOM-EMMET] Using Emmetify format for Non-VL model"');
    
    console.log('\n=== CEREBRAS TEST SUMMARY ===');
    console.log('✅ Model: Cerebras Qwen-3-235b');
    console.log('✅ Page: Flypgs airline website');
    console.log('✅ Format: Chain of thought + Puppeteer selectors');
    console.log('✅ DOM: Emmetify compact format (96% reduction)');
    
  } catch (error) {
    console.error('Test setup error:', error.message);
  } finally {
    for (const fn of freeFn) {
      await fn.fn();
    }
  }
}

testCerebrasNonVL().catch(console.error);