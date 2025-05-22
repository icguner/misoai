/**
 * Example for retrieving performance metrics from Android devices using misoai-android
 */
import { agentFromLocalAppium, type AppiumBaseCapabilities } from 'misoai-android';

async function main() {
  try {
    console.log('Starting Android performance metrics example...');

    // Define capabilities for the Android device
    const capabilities: AppiumBaseCapabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Device',
      // Uncomment and set your device ID if you have multiple devices connected
      // 'appium:udid': 'your_device_id_here',
      'appium:autoGrantPermissions': true
    };

    // Create an agent using the local Appium server
    console.log('Connecting to local Appium server...');
    const agent = await agentFromLocalAppium(capabilities);

    // Launch an app (e.g., settings app)
    console.log('Launching Android Settings app...');
    await agent.launch('com.android.settings');

    // Get the WebdriverIO driver instance
    const driver = (agent.page as any).driver;

    // 1. Get available performance data types
    console.log('Getting available performance data types...');
    const performanceTypes = await driver.getPerformanceDataTypes();
    console.log('Available performance data types:', performanceTypes);

    // 2. Get CPU info
    if (performanceTypes.includes('cpuinfo')) {
      console.log('Getting CPU info...');
      const cpuInfo = await driver.getPerformanceData('com.android.settings', 'cpuinfo', 5);
      console.log('CPU info:', cpuInfo);
    }

    // 3. Get memory info
    if (performanceTypes.includes('memoryinfo')) {
      console.log('Getting memory info...');
      const memoryInfo = await driver.getPerformanceData('com.android.settings', 'memoryinfo', 5);
      console.log('Memory info:', memoryInfo);
    }

    // 4. Get battery info
    if (performanceTypes.includes('batteryinfo')) {
      console.log('Getting battery info...');
      const batteryInfo = await driver.getPerformanceData('com.android.settings', 'batteryinfo', 5);
      console.log('Battery info:', batteryInfo);
    }

    // 5. Get network info
    if (performanceTypes.includes('networkinfo')) {
      console.log('Getting network info...');
      const networkInfo = await driver.getPerformanceData('com.android.settings', 'networkinfo', 5);
      console.log('Network info:', networkInfo);
    }

    // 6. Get device time
    console.log('Getting device time...');
    const deviceTime = await agent.page.getDeviceTime();
    console.log('Device time:', deviceTime);

    // 7. Get screen size
    console.log('Getting screen size...');
    const screenSize = await agent.page.size();
    console.log('Screen size:', screenSize);

    // 8. Get screen orientation
    console.log('Getting screen orientation...');
    const orientation = await agent.page.getScreenOrientation();
    console.log('Screen orientation:', orientation);

    // 9. Get current package and activity
    console.log('Getting current package...');
    const currentPackage = await agent.page.getCurrentPackage();
    console.log('Current package:', currentPackage);

    console.log('Getting current activity...');
    const currentActivity = await agent.page.getCurrentActivity();
    console.log('Current activity:', currentActivity);

    // 10. Custom adb shell commands for additional metrics
    console.log('Executing custom adb shell commands for additional metrics...');

    // Get device model and manufacturer
    const deviceModel = await driver.executeScript('mobile: shell', [{
      command: 'getprop ro.product.model'
    }]);
    console.log('Device model:', deviceModel);

    const deviceManufacturer = await driver.executeScript('mobile: shell', [{
      command: 'getprop ro.product.manufacturer'
    }]);
    console.log('Device manufacturer:', deviceManufacturer);

    // Get Android version
    const androidVersion = await driver.executeScript('mobile: shell', [{
      command: 'getprop ro.build.version.release'
    }]);
    console.log('Android version:', androidVersion);

    // Get total RAM
    const totalRam = await driver.executeScript('mobile: shell', [{
      command: 'cat /proc/meminfo | grep MemTotal'
    }]);
    console.log('Total RAM:', totalRam);

    // Get CPU architecture
    const cpuArch = await driver.executeScript('mobile: shell', [{
      command: 'uname -m'
    }]);
    console.log('CPU architecture:', cpuArch);

    // Get CPU cores
    const cpuCores = await driver.executeScript('mobile: shell', [{
      command: 'cat /proc/cpuinfo | grep processor | wc -l'
    }]);
    console.log('CPU cores:', cpuCores);

    // Get screen density
    const screenDensity = await driver.executeScript('mobile: shell', [{
      command: 'wm density'
    }]);
    console.log('Screen density:', screenDensity);

    // Disconnect from the Appium server
    console.log('Disconnecting from Appium server...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in Android performance metrics example:', error);
  }
}

// Run the example
main().catch(console.error);
