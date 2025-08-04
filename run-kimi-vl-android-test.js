const { spawn } = require('child_process');

// Kimi VL A3B test environment configuration
const env = {
  ...process.env,
  // Enable Kimi VL mode
  MIDSCENE_USE_KIMI_VL: 'true',
  
  // Kimi VL model configuration
  MIDSCENE_MODEL_NAME: 'moonshot-v1-128k',  // Or the specific Kimi VL model name
  
  // API configuration (adjust based on Kimi VL API endpoint)
  OPENAI_BASE_URL: 'https://api.moonshot.cn/v1',  // Kimi VL API endpoint
  OPENAI_API_KEY: process.env.KIMI_API_KEY || process.env.OPENAI_API_KEY,
  
  // Optimized parameters for Kimi VL
  AI_TEMPERATURE: '0.2',  // Lower temperature for more consistent OS agent tasks
  AI_SEED: '42',  // Consistent seed for reproducible results
  OPENAI_MAX_TOKENS: '32768',  // Kimi VL supports up to 32K tokens
  
  // Enable caching and reports
  MIDSCENE_CACHE: 'true',
  MIDSCENE_REPORT: 'true',
  AITEST: 'true'
};

console.log('🚀 Starting Kimi VL Android Test');
console.log('📱 Model: Kimi VL A3B-Thinking-2506');
console.log('🔧 Configuration:');
console.log(`   - Model: ${env.MIDSCENE_MODEL_NAME}`);
console.log(`   - Base URL: ${env.OPENAI_BASE_URL}`);
console.log(`   - Temperature: ${env.AI_TEMPERATURE}`);
console.log(`   - Max Tokens: ${env.OPENAI_MAX_TOKENS}`);
console.log(`   - VL Mode: ${env.MIDSCENE_USE_KIMI_VL}`);

const testProcess = spawn(
  'pnpm',
  ['-F', 'android', 'test', 'tests/ai/kimi-vl-test.test.ts'],
  {
    env,
    stdio: 'inherit',
    shell: true
  }
);

testProcess.on('close', (code) => {
  console.log(`\n🏁 Kimi VL test process exited with code ${code}`);
  if (code === 0) {
    console.log('✅ Kimi VL Android test completed successfully!');
  } else {
    console.log('❌ Kimi VL Android test failed!');
  }
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('💥 Failed to start Kimi VL test process:', error);
  process.exit(1);
});