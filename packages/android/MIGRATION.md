# Migration Guide: @acabai/android v1.x to v2.0

This guide will help you migrate your code from `@acabai/android` v1.x to v2.0, which introduces a complete rewrite using Appium and WebdriverIO.

## Major Changes

- Replaced direct ADB interactions with Appium WebDriver protocol
- Replaced `AndroidDevice` class with `AppiumDevice` class
- Replaced `agentFromAdbDevice` function with new factory functions
- Added support for Sauce Labs cloud testing platform
- Added comprehensive TypeScript interfaces for Appium configuration

## Prerequisites

Before migrating to v2.0, make sure you have:

1. Appium server installed and running (`npm install -g appium` and then `appium`)
2. WebdriverIO installed (`npm install webdriverio`)

## Migration Steps

### 1. Update Dependencies

Update your package.json to include the new dependencies:

```json
{
  "dependencies": {
    "@acabai/android": "^2.0.0",
    "webdriverio": "^8.0.0"
  }
}
```

### 2. Replace Device Creation

#### Before (v1.x):

```typescript
import { AndroidDevice, AndroidAgent, agentFromAdbDevice } from '@acabai/android';

// Option 1: Direct device creation
const device = new AndroidDevice('device_serial_id');
const agent = new AndroidAgent(device);

// Option 2: Using agentFromAdbDevice
const agent = await agentFromAdbDevice('device_serial_id');
```

#### After (v2.0):

```typescript
import { 
  AppiumDevice, 
  AndroidAgent, 
  agentFromLocalAppium, 
  agentFromAppiumServer,
  type AppiumBaseCapabilities 
} from '@acabai/android';

// Option 1: Using local Appium server
const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device',
  'appium:udid': 'device_serial_id' // Optional: Specific device ID
};

const agent = await agentFromLocalAppium(capabilities);

// Option 2: Using custom Appium server
const serverConfig = {
  hostname: '127.0.0.1',
  port: 4723,
  path: '/wd/hub'
};

const agent = await agentFromAppiumServer(serverConfig, capabilities);
```

### 3. Replace Remote ADB Connection

#### Before (v1.x):

```typescript
import { agentFromAdbDevice } from '@acabai/android';

// Connect to a remote ADB server
const agent = await agentFromAdbDevice(undefined, {
  adbConnectionOptions: {
    host: '192.168.1.100',
    port: 5037
  }
});
```

#### After (v2.0):

```typescript
import { agentFromAppiumServer, type AppiumBaseCapabilities } from '@acabai/android';

// Connect to a remote Appium server
const serverConfig = {
  hostname: '192.168.1.100',
  port: 4723,
  path: '/wd/hub'
};

const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device'
};

const agent = await agentFromAppiumServer(serverConfig, capabilities);
```

### 4. Update Environment Variables

#### Before (v1.x):

```
MIDSCENE_ADB_PATH=/path/to/adb
```

#### After (v2.0):

No specific environment variables are required for basic functionality. Appium server configuration is handled through the API.

## Additional Features in v2.0

### Sauce Labs Integration

```typescript
import { 
  agentFromSauceLabs, 
  type SauceLabsConfig, 
  type AppiumBaseCapabilities, 
  type SauceLabsCapabilities 
} from '@acabai/android';

// Define Sauce Labs configuration
const sauceConfig: SauceLabsConfig = {
  user: process.env.SAUCE_USERNAME || 'your-username',
  key: process.env.SAUCE_ACCESS_KEY || 'your-access-key',
  region: 'us-west-1'
};

// Define capabilities for the Android device
const capabilities: AppiumBaseCapabilities & SauceLabsCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:platformVersion': '12.0',
  'appium:deviceName': 'Samsung Galaxy S21',
  'sauce:options': {
    build: 'my-build-name',
    name: 'my-test-name'
  }
};

// Create an agent using Sauce Labs
const agent = await agentFromSauceLabs(sauceConfig, capabilities);
```

## Common Issues and Solutions

### Issue: Cannot connect to Appium server

**Solution:** Make sure Appium server is installed and running. You can install it using `npm install -g appium` and start it using `appium`.

### Issue: Cannot find device

**Solution:** Make sure your device is properly connected and USB debugging is enabled. You can specify the device ID using the `'appium:udid'` capability.

### Issue: Missing methods from v1.x

**Solution:** Most methods from v1.x have equivalent methods in v2.0, but they may have different names or parameters. Check the [README.md](./README.md) file for the complete API reference.

## Need Help?

If you encounter any issues during migration, please refer to the [README.md](./README.md) file for more detailed information or open an issue on the GitHub repository.
