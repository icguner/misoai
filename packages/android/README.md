# misoai-android

Android automation library for misoAI. Automate UI actions, extract data, and perform assertions using AI.

This package uses Appium and WebdriverIO to provide a robust and flexible Android automation solution.

*Read this in [Turkish](#misoai-android-türkçe)*

## Installation

```bash
npm install misoai-android webdriverio
```

Note: You need to have Appium server installed and running to use this package. See [Appium Installation Guide](https://appium.io/docs/en/2.0/quickstart/install/) for details.

## What's New in Version 3.0.0

- Enhanced media utilities for screenshots and video recording
- Comprehensive performance monitoring capabilities
- Improved AI-powered automation features
- Support for CAPTCHA handling with deep thinking capability
- Better integration with Sauce Labs and custom Appium servers

## AI Methods

The Android agent provides powerful AI-powered methods for automating interactions with Android apps:

| Method | Description | Example |
|--------|-------------|---------|
| `aiAction(prompt)` | Perform any action described in natural language | `await agent.aiAction('Find and tap on the Settings button')` |
| `aiAssert(assertion)` | Check if a condition is true | `await agent.aiAssert('Is Wi-Fi enabled?')` |
| `aiWaitFor(condition)` | Wait for a condition to be true | `await agent.aiWaitFor('The download is complete')` |
| `aiQuery(prompt)` | Extract structured data | `await agent.aiQuery('{name: string, price: number}[], Find all products')` |
| `aiCaptcha(options)` | Solve CAPTCHA challenges automatically | `await agent.aiCaptcha({ deepThink: true })` |

### Example of AI-Powered Automation

```typescript
import { agentFromLocalAppium, type AppiumBaseCapabilities } from 'misoai-android';
import { overrideAIConfig } from 'misoai-shared/env';

// Configure AI settings
overrideAIConfig({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-vision-preview',
  temperature: 0.2,
  maxTokens: 4096
});

// Define capabilities for the Android device
const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device',
  'appium:autoGrantPermissions': true
};

// Create an agent using the local Appium server
const agent = await agentFromLocalAppium(capabilities);

// Launch the settings app
await agent.launch('com.android.settings');

// Use AI to find and tap on the "Wi-Fi" option
await agent.aiAction('Find and tap on the Wi-Fi option');

// Use AI to check if Wi-Fi is enabled
const wifiStatus = await agent.aiAssert('Is Wi-Fi enabled?');
console.log('Wi-Fi status:', wifiStatus);

// Use AI to go back to the main settings screen
await agent.aiAction('Go back to the main settings screen');

// Use AI to find and tap on the "Display" option
await agent.aiAction('Find and tap on the Display option');

// Use AI to query information about the current brightness
const brightnessInfo = await agent.aiQuery('string, What is the current brightness level?');
console.log('Brightness info:', brightnessInfo);
```

### Using Custom Appium Server (Hub URL)

```typescript
import {
  agentFromAppiumServer,
  type AppiumServerConfig,
  type AppiumBaseCapabilities
} from 'misoai-android';

// Define Appium server configuration (Hub URL)
const serverConfig: AppiumServerConfig = {
  hostname: '192.168.1.100',  // Your Appium server hostname or IP
  port: 4723,                 // Your Appium server port (default: 4723)
  path: '/wd/hub',            // WebDriver path (default: '/wd/hub')
  protocol: 'http'            // Protocol (http or https)
};

// The complete Hub URL will be: http://192.168.1.100:4723/wd/hub

// Define capabilities for the Android device
const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device'
};

// Create an agent using the specified Appium server
const agent = await agentFromAppiumServer(serverConfig, capabilities);

// You can also use environment variables to configure the server
// Example:
// const serverConfig: AppiumServerConfig = {
//   hostname: process.env.APPIUM_HOST || 'localhost',
//   port: parseInt(process.env.APPIUM_PORT || '4723'),
//   path: process.env.APPIUM_PATH || '/wd/hub',
//   protocol: (process.env.APPIUM_PROTOCOL || 'http') as 'http' | 'https'
// };
```

## Using Sauce Labs for Cloud Testing

Sauce Labs provides cloud-based testing infrastructure for mobile apps. This package includes built-in support for Sauce Labs, making it easy to run your tests on a wide range of real Android devices in the cloud.

### Basic Sauce Labs Setup

```typescript
import {
  agentFromSauceLabs,
  type SauceLabsConfig,
  type AppiumBaseCapabilities,
  type SauceLabsCapabilities
} from 'misoai-android';
import 'dotenv/config';

// Define Sauce Labs configuration
const sauceConfig: SauceLabsConfig = {
  user: process.env.SAUCE_USERNAME || 'your-username',
  key: process.env.SAUCE_ACCESS_KEY || 'your-access-key',
  region: 'us-west-1'  // Options: 'us-west-1', 'eu-central-1', 'apac-southeast-1'
};

// Define capabilities for the Android device
const capabilities: AppiumBaseCapabilities & SauceLabsCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:platformVersion': '12.0',
  'appium:deviceName': 'Samsung Galaxy S21',
  'sauce:options': {
    build: 'my-build-name',
    name: 'my-test-name',
    appiumVersion: '2.0.0'
  }
};

// Create an agent using Sauce Labs
const agent = await agentFromSauceLabs(sauceConfig, capabilities);

// Use AI methods for automation
await agent.aiAction('Find and tap on the Settings button');
await agent.aiAssert('Is Wi-Fi enabled?');
```

### Example .env File for Sauce Labs

```
SAUCE_USERNAME=your-sauce-username
SAUCE_ACCESS_KEY=your-sauce-access-key
```

### Taking Screenshots with Sauce Labs

The package includes support for taking screenshots using the Sauce Labs agent:

```typescript
// Take a screenshot using Sauce Labs
await agent.page.takeScreenshot('test-screenshot');

// The screenshot will be available in your Sauce Labs dashboard
```

### Proper Session Termination

When using Sauce Labs, the package automatically handles proper session termination to ensure test results are correctly reported in the Sauce Labs dashboard:

```typescript
// When you're done with your test
await agent.page.disconnect();

// This will automatically:
// 1. Report the test as passed to Sauce Labs
// 2. Properly terminate the WebDriver session
// 3. Ensure resources are released
```

## Required Appium Capabilities

The following capabilities are required for basic Appium functionality:

- `platformName`: Must be 'Android'
- `appium:automationName`: Recommended to use 'UiAutomator2'
- `appium:deviceName`: A name for the device (can be arbitrary for real devices)

Additional useful capabilities:

- `appium:udid`: Device ID for connecting to a specific device
- `appium:app`: Path or URL to the APK file
- `appium:appPackage`: Package name of the app
- `appium:appActivity`: Activity name to launch
- `appium:autoGrantPermissions`: Automatically grant app permissions

## Remote Appium Server Configuration

When working with remote Appium servers, you can use environment variables to simplify configuration:

```typescript
// Load environment variables from .env file
import 'dotenv/config';

// Define Appium server configuration using environment variables
const serverConfig: AppiumServerConfig = {
  hostname: process.env.APPIUM_HOST || 'localhost',
  port: parseInt(process.env.APPIUM_PORT || '4723'),
  path: process.env.APPIUM_PATH || '/wd/hub',
  protocol: (process.env.APPIUM_PROTOCOL || 'http') as 'http' | 'https'
};

// Create an agent using the specified Appium server
const agent = await agentFromAppiumServer(serverConfig, capabilities);

// Use AI methods for automation
await agent.aiAction('Find and tap on the Settings button');
```

Example .env file:
```
APPIUM_HOST=192.168.1.100
APPIUM_PORT=4725
APPIUM_PATH=/wd/hub
APPIUM_PROTOCOL=http
```

## W3C Actions API

Version 2.0.0 uses the W3C Actions API for touch interactions instead of the deprecated TouchAction API. This provides better compatibility with modern Appium versions and follows the WebDriver standard.

### Example of W3C Actions API Usage

```typescript
// Tap at specific coordinates
await agent.page.tap(100, 200);

// Swipe from one point to another
await agent.page.swipe(
  100, 200,  // start coordinates (x, y)
  300, 400,  // end coordinates (x, y)
  800        // duration in milliseconds
);

// Type text using keyboard actions
await agent.page.keyboard.type('Hello World');
```

For a complete example, see the [W3C Actions example](./examples/w3c-actions.ts).

## Media Utilities

The package provides utility functions for capturing screenshots and recording videos during test execution.

### Taking Screenshots

```typescript
import { takeScreenshot } from 'misoai-android';

// Take a screenshot and save it to a file
await takeScreenshot(agent.page, {
  filePath: 'screenshots/home-screen.png',
  createDir: true // automatically create directories if they don't exist
});

// Take a screenshot and get it as base64 data
const base64Screenshot = await takeScreenshot(agent.page, { returnBase64: true });
console.log('Screenshot data:', base64Screenshot.substring(0, 50) + '...');
```

### Recording Video

```typescript
import { startVideoRecording, stopVideoRecording } from 'misoai-android';

// Start recording video with custom options
await startVideoRecording(agent.page, {
  timeLimit: 60, // 1 minute max
  bitRate: 6000000, // 6 Mbps
  size: '1280x720' // resolution
});

// Perform your test actions...
await agent.aiAction('Find and tap on the Settings button');

// Stop recording and save the video
const videoPath = 'videos/test-recording.mp4';
await stopVideoRecording(agent.page, { filePath: videoPath });
console.log(`Video saved to ${videoPath}`);
```

For a complete example, see the [Media Utilities example](./examples/media-utils.ts).

## Device Performance Metrics

You can retrieve various performance metrics from Android devices using the WebdriverIO API. This is useful for monitoring device performance during test execution.

### Example of Retrieving Performance Metrics

```typescript
// Get the WebdriverIO driver instance
const driver = (agent.page as any).driver;

// Get available performance data types
const performanceTypes = await driver.getPerformanceDataTypes();
console.log('Available performance data types:', performanceTypes);

// Get CPU info
const cpuInfo = await driver.getPerformanceData('com.android.settings', 'cpuinfo', 5);

// Get memory info
const memoryInfo = await driver.getPerformanceData('com.android.settings', 'memoryinfo', 5);

// Get battery info
const batteryInfo = await driver.getPerformanceData('com.android.settings', 'batteryinfo', 5);

// Get network info
const networkInfo = await driver.getPerformanceData('com.android.settings', 'networkinfo', 5);

// Execute custom adb shell commands for additional metrics
const deviceModel = await driver.executeScript('mobile: shell', [{
  command: 'getprop ro.product.model'
}]);

const totalRam = await driver.executeScript('mobile: shell', [{
  command: 'cat /proc/meminfo | grep MemTotal'
}]);
```

For a complete example, see the [Performance Metrics example](./examples/performance-metrics.ts).

### Continuous Performance Monitoring

For more advanced performance monitoring during test execution, you can use the `PerformanceMonitor` class. It now features automatic detection of the active application, allowing it to dynamically track performance metrics as you switch between apps:

```typescript
import { PerformanceMonitor } from 'misoai-android';

// Create a performance monitor with automatic active app detection
// No need to specify a package name - it will detect the active app automatically
const monitor = new PerformanceMonitor(agent.page);

// Initialize the monitor and get available metrics
const availableMetrics = await monitor.initialize();
console.log('Available metrics:', availableMetrics);

// Get device information
const deviceInfo = await monitor.getDeviceInfo();
console.log('Device info:', deviceInfo);

// Get current metrics (CPU, memory, battery, network) for the currently active app
const metrics = await monitor.getCurrentMetrics();
console.log('Current metrics:', metrics);
console.log('Current active app:', metrics.packageName);

// Start continuous monitoring (every 5 seconds)
monitor.startMonitoring(5000);

// Perform your test actions, including switching between apps...
await agent.aiAction('Navigate through the app');
await agent.launch('com.android.calculator'); // Switch to calculator app
await agent.aiAction('Perform a calculation');
await agent.launch('com.android.settings'); // Switch back to settings

// Stop monitoring
monitor.stopMonitoring();

// Get all collected metrics
const allMetrics = monitor.getAllMetrics();
console.log('All collected metrics:', allMetrics);

// Get metrics for a specific app
const settingsMetrics = monitor.getMetricsForPackage('com.android.settings');
const calculatorMetrics = monitor.getMetricsForPackage('com.android.calculator');
console.log(`Settings app metrics: ${settingsMetrics.length}`);
console.log(`Calculator app metrics: ${calculatorMetrics.length}`);

// Get metrics within a specific time range
const startTime = Date.now() - 60000; // Last minute
const endTime = Date.now();
const recentMetrics = monitor.getMetricsInTimeRange(startTime, endTime);

// Export metrics to a JSON file
await monitor.exportMetricsToFile('performance-data.json');
```

The `PerformanceMonitor` class provides the following features:
- Collecting CPU, memory, battery, and network metrics
- Getting detailed device information
- Continuous monitoring at specified intervals
- Exporting metrics to JSON for analysis

For a complete example, see the [Performance Monitoring example](./examples/performance-monitoring.ts).

---

# misoai-android (Türkçe)

Android otomasyon kütüphanesi için misoAI. Yapay zeka kullanarak UI eylemlerini otomatikleştirin, veri çıkarın ve doğrulamalar yapın.

Bu paket, sağlam ve esnek bir Android otomasyon çözümü sunmak için Appium ve WebdriverIO kullanır.

## Kurulum

```bash
npm install misoai-android webdriverio
```

Not: Bu paketi kullanmak için Appium sunucusunun kurulu ve çalışıyor olması gerekir. Detaylar için [Appium Kurulum Kılavuzu](https://appium.io/docs/en/2.0/quickstart/install/)'na bakın.

## Versiyon 3.0.0'daki Yenilikler

- Ekran görüntüsü ve video kaydı için geliştirilmiş medya yardımcı fonksiyonları
- Kapsamlı performans izleme özellikleri
- Geliştirilmiş yapay zeka destekli otomasyon özellikleri
- Derin düşünme yeteneği ile CAPTCHA çözme desteği
- Sauce Labs ve özel Appium sunucuları ile daha iyi entegrasyon

## Yapay Zeka Metodları

Android agent, Android uygulamalarıyla etkileşimleri otomatikleştirmek için güçlü yapay zeka destekli metodlar sunar:

| Metod | Açıklama | Örnek |
|--------|-------------|---------|
| `aiAction(prompt)` | Doğal dilde açıklanan herhangi bir eylemi gerçekleştir | `await agent.aiAction('Ayarlar düğmesini bul ve dokun')` |
| `aiAssert(assertion)` | Bir koşulun doğru olup olmadığını kontrol et | `await agent.aiAssert('Wi-Fi etkin mi?')` |
| `aiWaitFor(condition)` | Bir koşulun doğru olmasını bekle | `await agent.aiWaitFor('İndirme tamamlandı')` |
| `aiQuery(prompt)` | Yapılandırılmış veri çıkar | `await agent.aiQuery('{name: string, price: number}[], Tüm ürünleri bul')` |
| `aiCaptcha(options)` | CAPTCHA zorluklarını otomatik olarak çöz | `await agent.aiCaptcha({ deepThink: true })` |

### Yapay Zeka Destekli Otomasyon Örneği

```typescript
import { agentFromLocalAppium, type AppiumBaseCapabilities } from 'misoai-android';
import { overrideAIConfig } from 'misoai-shared/env';

// Yapay zeka ayarlarını yapılandır
overrideAIConfig({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-vision-preview',
  temperature: 0.2,
  maxTokens: 4096
});

// Android cihaz için yetenekleri tanımla
const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device',
  'appium:autoGrantPermissions': true
};

// Yerel Appium sunucusu kullanarak bir agent oluştur
const agent = await agentFromLocalAppium(capabilities);

// Ayarlar uygulamasını başlat
await agent.launch('com.android.settings');

// "Wi-Fi" seçeneğini bulmak ve dokunmak için yapay zeka kullan
await agent.aiAction('Wi-Fi seçeneğini bul ve dokun');

// Wi-Fi'nin etkin olup olmadığını kontrol etmek için yapay zeka kullan
const wifiStatus = await agent.aiAssert('Wi-Fi etkin mi?');
console.log('Wi-Fi durumu:', wifiStatus);

// Ana ayarlar ekranına geri dönmek için yapay zeka kullan
await agent.aiAction('Ana ayarlar ekranına geri dön');

// "Ekran" seçeneğini bulmak ve dokunmak için yapay zeka kullan
await agent.aiAction('Ekran seçeneğini bul ve dokun');

// Mevcut parlaklık seviyesi hakkında bilgi almak için yapay zeka kullan
const brightnessInfo = await agent.aiQuery('string, Mevcut parlaklık seviyesi nedir?');
console.log('Parlaklık bilgisi:', brightnessInfo);
```

## Medya Yardımcı Fonksiyonları

### Ekran Görüntüsü Alma

`takeScreenshot` fonksiyonu, mevcut ekran durumunu yakalamanıza olanak tanır:

```typescript
import { takeScreenshot } from 'misoai-android';

// Ekran görüntüsü al ve bir dosyaya kaydet
await takeScreenshot(agent.page, {
  filePath: 'screenshots/home-screen.png',
  createDir: true  // dizinler mevcut değilse otomatik olarak oluştur
});

// Ekran görüntüsü al ve base64 verisi olarak al
const base64Screenshot = await takeScreenshot(agent.page, { returnBase64: true });
```

### Video Kaydı

Video kayıt yardımcı fonksiyonları ile cihaz etkileşimlerini kaydedin:

```typescript
import { startVideoRecording, stopVideoRecording } from 'misoai-android';

// Özel seçeneklerle video kaydını başlat
await startVideoRecording(agent.page, {
  timeLimit: 60,  // maksimum 1 dakika kayıt süresi
  bitRate: 6000000,  // 6 Mbps
  size: '1280x720'  // 720p çözünürlük
});

// Test eylemlerinizi gerçekleştirin...
await agent.aiAction('Ayarlar düğmesini bul ve dokun');

// Kaydı durdur ve videoyu kaydet
const videoPath = 'videos/test-recording.mp4';
await stopVideoRecording(agent.page, { filePath: videoPath });
console.log(`Video şuraya kaydedildi: ${videoPath}`);
```

## Performans İzleme

`PerformanceMonitor` sınıfı, test yürütme sırasında performans metriklerini toplamanıza ve analiz etmenize olanak tanır. Artık aktif uygulamayı otomatik olarak tespit edebilme özelliğine sahiptir, böylece uygulamalar arasında geçiş yaparken bile performans metriklerini dinamik olarak takip edebilirsiniz:

```typescript
import { PerformanceMonitor } from 'misoai-android';

// Aktif uygulama tespiti ile performans monitörü oluştur
// Paket adı belirtmeye gerek yok - aktif uygulamayı otomatik olarak tespit edecek
const monitor = new PerformanceMonitor(agent.page);

// Monitörü başlat ve kullanılabilir metrikleri al
const availableMetrics = await monitor.initialize();
console.log('Kullanılabilir metrikler:', availableMetrics);

// Cihaz bilgilerini al
const deviceInfo = await monitor.getDeviceInfo();
console.log('Cihaz bilgisi:', deviceInfo);

// Şu anda aktif olan uygulama için mevcut metrikleri al (CPU, bellek, pil, ağ)
const metrics = await monitor.getCurrentMetrics();
console.log('Mevcut metrikler:', metrics);
console.log('Şu anda aktif uygulama:', metrics.packageName);

// Sürekli izlemeyi başlat (her 5 saniyede bir)
monitor.startMonitoring(5000);

// Uygulamalar arası geçiş dahil test eylemlerinizi gerçekleştirin...
await agent.aiAction('Uygulama içinde gezin');
await agent.launch('com.android.calculator'); // Hesap makinesi uygulamasına geç
await agent.aiAction('Bir hesaplama yap');
await agent.launch('com.android.settings'); // Ayarlar uygulamasına geri dön

// İzlemeyi durdur
monitor.stopMonitoring();

// Toplanan tüm metrikleri al
const allMetrics = monitor.getAllMetrics();
console.log('Toplanan tüm metrikler:', allMetrics);

// Belirli bir uygulama için metrikleri al
const settingsMetrics = monitor.getMetricsForPackage('com.android.settings');
const calculatorMetrics = monitor.getMetricsForPackage('com.android.calculator');
console.log(`Ayarlar uygulaması metrikleri: ${settingsMetrics.length}`);
console.log(`Hesap makinesi uygulaması metrikleri: ${calculatorMetrics.length}`);

// Belirli bir zaman aralığındaki metrikleri al
const startTime = Date.now() - 60000; // Son bir dakika
const endTime = Date.now();
const recentMetrics = monitor.getMetricsInTimeRange(startTime, endTime);

// Metrikleri bir JSON dosyasına dışa aktar
await monitor.exportMetricsToFile('performance-data.json');
```

## Agent Oluşturma

### Yerel Appium Sunucusundan

```typescript
import { agentFromLocalAppium, type AppiumBaseCapabilities } from 'misoai-android';

const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device',
  'appium:autoGrantPermissions': true
};

const agent = await agentFromLocalAppium(capabilities);
```

### Özel Appium Sunucusundan

```typescript
import { agentFromAppiumServer, type AppiumServerConfig, type AppiumBaseCapabilities } from 'misoai-android';

const serverConfig: AppiumServerConfig = {
  hostname: 'custom-appium-server.example.com',
  port: 4723,
  path: '/wd/hub',
  protocol: 'http'
};

const capabilities: AppiumBaseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android Device'
};

const agent = await agentFromAppiumServer(serverConfig, capabilities);
```

### Sauce Labs'dan

```typescript
import { agentFromSauceLabs, type SauceLabsConfig, type SauceLabsCapabilities } from 'misoai-android';

const sauceConfig: SauceLabsConfig = {
  user: process.env.SAUCE_USERNAME || 'kullanıcı-adınız',
  key: process.env.SAUCE_ACCESS_KEY || 'erişim-anahtarınız',
  region: 'us-west-1'
};

const capabilities: AppiumBaseCapabilities & SauceLabsCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Google Pixel 6',
  'appium:platformVersion': '12.0',
  'sauce:options': {
    build: 'Android Otomasyon Demo',
    name: 'Ayarlar Uygulaması Testi'
  }
};

const agent = await agentFromSauceLabs(sauceConfig, capabilities);
```

### Oturum Sonlandırma

Sauce Labs kullanırken, paket otomatik olarak test sonuçlarının Sauce Labs panelinde doğru şekilde raporlanmasını sağlamak için oturumu düzgün bir şekilde sonlandırır:

```typescript
// Testiniz bittiğinde
await agent.page.disconnect();

// Bu otomatik olarak:
// 1. Testi Sauce Labs'a başarılı olarak raporlar
// 2. WebDriver oturumunu düzgün şekilde sonlandırır
// 3. Kaynakların serbest bırakılmasını sağlar
```

## Örnekler

Tam örnekler için examples dizinine bakın:

- [Temel Kullanım](./examples/basic-usage.ts)
- [Yapay Zeka Otomasyonu](./examples/ai-automation.ts)
- [Medya Yardımcı Fonksiyonları](./examples/media-utils.ts)
- [Performans İzleme](./examples/performance-monitoring.ts)
- [Sauce Labs Entegrasyonu](./examples/sauce-labs.ts)
- [W3C Actions API](./examples/w3c-actions.ts)