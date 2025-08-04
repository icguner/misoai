#!/usr/bin/env node

/**
 * Run Gemini 2.5 Pro Android Tests
 * 
 * This script sets up the environment and runs the comprehensive Android tests
 * with Gemini 2.5 Pro's enhanced chain of thought reasoning.
 * 
 * Prerequisites:
 * 1. Android device connected via USB with USB debugging enabled
 * 2. adb in PATH and device authorized
 * 3. Appium server running on localhost:4723
 * 4. Environment variables set in .env file
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', colors.cyan);
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found. Please create one with your Gemini API key.', colors.red);
    log('Required variables:', colors.yellow);
    log('  GEMINI_API_KEY="your-api-key"', colors.yellow);
    log('  MIDSCENE_USE_GEMINI=true', colors.yellow);
    log('  MIDSCENE_MODEL_NAME="gemini-2.5-pro"', colors.yellow);
    process.exit(1);
  }
  
  // Check if Android package exists
  const androidPackagePath = path.join(__dirname, 'packages', 'android');
  if (!fs.existsSync(androidPackagePath)) {
    log('❌ Android package not found at packages/android', colors.red);
    process.exit(1);
  }
  
  log('✅ Prerequisites check passed', colors.green);
}


async function checkAppiumServer() {
  log('🚀 Checking Appium server...', colors.cyan);
  
  return new Promise((resolve) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 4723,
      path: '/status',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const status = JSON.parse(data);
            log('✅ Appium server is running on localhost:4723', colors.green);
            log(`   Server build: ${status.value?.build?.version || 'unknown'}`, colors.green);
            resolve(true);
          } catch (e) {
            log('✅ Appium server is running on localhost:4723', colors.green);
            resolve(true);
          }
        } else {
          log('⚠️  Appium server responded but may not be ready', colors.yellow);
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      log('❌ Appium server not running on localhost:4723', colors.red);
      log('Please start Appium server with the following commands:', colors.yellow);
      log('  npm install -g appium', colors.yellow);
      log('  npm install -g @appium/uiautomator2-driver', colors.yellow);
      log('  appium driver install uiautomator2', colors.yellow);
      log('  appium server --port 4723', colors.yellow);
      log('', colors.reset);
      log('Alternative: Install Appium Desktop and start it', colors.yellow);
      resolve(false);
    });
    
    req.on('timeout', () => {
      log('❌ Appium server connection timeout', colors.red);
      resolve(false);
    });
    
    req.end();
  });
}

async function runTests() {
  log('🧪 Starting Gemini 2.5 Pro Android Tests...', colors.cyan);
  log('', colors.reset);
  
  const testCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = [
    'test', 
    'packages/android/tests/ai/gemini-scroll-test.test.ts',
    '--reporter=verbose'
  ];
  
  log(`Running: ${testCommand} ${args.join(' ')}`, colors.blue);
  log('', colors.reset);
  
  const testProcess = spawn(testCommand, args, {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      // Ensure we're using Gemini
      MIDSCENE_USE_GEMINI: 'true',
      MIDSCENE_MODEL_NAME: 'gemini-2.5-pro',
      // Enable debug logging
      DEBUG: 'ai:*',
      // Set test timeout
      VITEST_TIMEOUT: '300000'
    }
  });
  
  return new Promise((resolve, reject) => {
    testProcess.on('close', (code) => {
      log('', colors.reset);
      if (code === 0) {
        log('🎉 All tests passed successfully!', colors.green);
        log('Chain of thought improvements are working correctly.', colors.green);
        resolve(code);
      } else {
        log(`❌ Tests failed with exit code ${code}`, colors.red);
        reject(new Error(`Test process exited with code ${code}`));
      }
    });
    
    testProcess.on('error', (err) => {
      log('❌ Error running tests:', colors.red);
      log(err.message, colors.red);
      reject(err);
    });
  });
}

async function main() {
  try {
    log('🤖 Gemini 2.5 Pro Android Test Runner', colors.cyan);
    log('=====================================', colors.cyan);
    log('', colors.reset);
    
    checkPrerequisites();
    
    const appiumRunning = await checkAppiumServer();
    if (!appiumRunning) {
      log('', colors.reset);
      log('Please start Appium server and run this script again.', colors.yellow);
      process.exit(1);
    }
    
    log('', colors.reset);
    log('🚀 All prerequisites met. Starting tests...', colors.green);
    log('', colors.reset);
    
    await runTests();
    
  } catch (error) {
    log('', colors.reset);
    log('❌ Test run failed:', colors.red);
    log(error.message, colors.red);
    log('', colors.reset);
    log('Troubleshooting tips:', colors.yellow);
    log('1. Ensure Android device is connected and authorized', colors.yellow);
    log('2. Verify Appium server is running on localhost:4723', colors.yellow);
    log('3. Check that your .env file has the correct Gemini API key', colors.yellow);
    log('4. Make sure the device has internet connectivity', colors.yellow);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, checkPrerequisites, checkAppiumServer, runTests };