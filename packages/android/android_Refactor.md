# Project: Refactor `@acabai/android` to Appium-centric Architecture

**Goal:** Enable robust and flexible Android automation by leveraging Appium, allowing connections to local Appium servers, remote Appium grids, and cloud testing platforms like Sauce Labs. Replace direct ADB interactions with Appium's WebDriver-based protocol.

---

## Phase 1: Setup and Core Device Class Implementation

### Task 1.1: Dependency Management
*   **File:** `packages/android/package.json`
*   **Sub-Tasks:**
    *   [ ] Add `webdriverio` to `dependencies`.
    *   [ ] Add `@types/webdriverio` to `devDependencies` (if needed).
    *   [ ] Review `appium-adb` usage: Determine if it can be fully removed from `dependencies` or if it's a sub-dependency of Appium server/`webdriverio` that doesn't need explicit listing for client-side code. Aim to remove direct client-side import and usage.
    *   [ ] Run `npm install` or `pnpm install` to update dependencies.

### Task 1.2: Configuration Type Definitions
*   **File:** `packages/android/src/types.ts` (Create this file)
*   **Sub-Tasks:**
    *   [ ] Define interface `AppiumServerConfig`:
        *   `hostname: string;`
        *   `port: number;`
        *   `path?: string; // Default: '/wd/hub'`
        *   `protocol?: 'http' | 'https'; // Default: 'http'`
    *   [ ] Define interface `AppiumBaseCapabilities`:
        *   `platformName: 'Android';`
        *   `'appium:automationName'?: string; // e.g., 'UiAutomator2', 'Espresso'`
        *   `'appium:platformVersion'?: string;`
        *   `'appium:deviceName'?: string;`
        *   `'appium:udid'?: string;`
        *   `'appium:app'?: string; // Path or URL to APK`
        *   `'appium:appPackage'?: string;`
        *   `'appium:appActivity'?: string;`
        *   `'appium:newCommandTimeout'?: number;`
        *   `'appium:autoGrantPermissions'?: boolean;`
        *   `[key: string]: any; // For other vendor-specific capabilities`
    *   [ ] Define interface `SauceLabsSpecificOptions`:
        *   `build?: string;`
        *   `name?: string; // Test name`
        *   `tags?: string[];`
        *   `tunnelIdentifier?: string;`
        *   `appiumVersion?: string; // e.g., '2.0.0'`
        *   `// Add other Sauce Labs specific options as needed`
    *   [ ] Define interface `SauceLabsCapabilities` (extends or incorporates `AppiumBaseCapabilities`):
        *   `'sauce:options'?: SauceLabsSpecificOptions;`
    *   [ ] Define interface `SauceLabsConfig`:
        *   `user: string; // Sauce Labs username`
        *   `key: string; // Sauce Labs access key`
        *   `region: 'us-west-1' | 'eu-central-1' | 'us-east-1'; // Or other regions`
        *   `headless?: boolean; // For Sauce Labs Headless testing`

### Task 1.3: Core Device Class - `AppiumDevice` - Structure and Connection
*   **File:** `packages/android/src/page/appium-device.ts` (Rename [index.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/index.ts:0:0-0:0) in `page` dir or create new)
*   **Sub-Tasks:**
    *   [ ] Import necessary types from `webdriverio` and `../types.ts`.
    *   [ ] Define `class AppiumDevice implements AndroidDevicePage` (Review `AndroidDevicePage` interface from `@acabai/web` - it might need adjustment or a new Appium-specific interface).
    *   [ ] Add private properties:
        *   `private driver: WebdriverIO.Browser | null = null;`
        *   `private serverConfig: AppiumServerConfig;`
        *   `private capabilities: AppiumBaseCapabilities;` // Or a more generic capabilities type
    *   [ ] Implement [constructor(serverConfig: AppiumServerConfig, capabilities: AppiumBaseCapabilities)](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:9:2-17:3):
        *   Store `serverConfig` and `capabilities`.
    *   [ ] Implement `async connect(): Promise<void>`:
        *   Construct `webdriverio.RemoteOptions`:
            *   `hostname: this.serverConfig.hostname`
            *   `port: this.serverConfig.port`
            *   `path: this.serverConfig.path || '/wd/hub'`
            *   `protocol: this.serverConfig.protocol || 'http'`
            *   `capabilities: this.capabilities`
            *   `logLevel: 'info'` (or configurable)
            *   `connectionRetryTimeout: 120000`
            *   `connectionRetryCount: 3`
        *   Call `this.driver = await WebdriverIO.remote(options);`
        *   Add error handling for connection failure.
    *   [ ] Implement `async disconnect(): Promise<void>`:
        *   Check if `this.driver` exists.
        *   Call `await this.driver.deleteSession();`
        *   Set `this.driver = null;`
        *   Add error handling.
    *   [ ] Ensure `debugPage` (or a new `debugDevice`) is used for logging.

### Task 1.4: `AppiumDevice` - Basic Interaction Methods
*   **File:** `packages/android/src/page/appium-device.ts`
*   **Sub-Tasks (Implement using `this.driver.<method>`):**
    *   [ ] `async launchApp(): Promise<void>` (uses `appPackage` and `appActivity` from capabilities, or `driver.activateApp(appIdFromCaps)`). Note: Appium typically launches the app specified in capabilities upon session creation. This method might be for ensuring it's in the foreground or re-launching.
    *   [ ] `async startActivity(appPackage: string, appActivity: string, opts?: object): Promise<void>` (using `driver.startActivity(...)`).
    *   [ ] `async openUrl(url: string): Promise<void>` (using `driver.url(url)` - primarily for webviews or mobile web).
    *   [ ] `async closeApp(): Promise<void>` (using `driver.closeApp()`, takes app ID from capabilities).
    *   [ ] `async terminateApp(appId: string): Promise<boolean>` (using `driver.terminateApp(appId)`).
    *   [ ] `async installApp(appPath: string, options?: WebdriverIO.InstallOptions): Promise<void>` (using `driver.installApp(appPath, options)`).
    *   [ ] `async isAppInstalled(appId: string): Promise<boolean>` (using `driver.isAppInstalled(appId)`).
    *   [ ] `async removeApp(appId: string): Promise<void>` (using `driver.removeApp(appId)`).
    *   [ ] `async takeScreenshot(): Promise<string>` (returns base64 string from `driver.takeScreenshot()`).
    *   [ ] `async getPageSource(): Promise<string>` (using `driver.getPageSource()`).
    *   [ ] `async getWindowSize(): Promise<{ width: number; height: number }>` (using `driver.getWindowSize()`).
    *   [ ] `async getCurrentActivity(): Promise<string>` (using `driver.getCurrentActivity()`).
    *   [ ] `async getCurrentPackage(): Promise<string>` (using `driver.getCurrentPackage()`).
    *   [ ] `async getScreenOrientation(): Promise<'PORTRAIT' | 'LANDSCAPE'>` (using `driver.getOrientation()`).
    *   [ ] `async setScreenOrientation(orientation: 'PORTRAIT' | 'LANDSCAPE'): Promise<void>` (using `driver.setOrientation(orientation)`).
    *   [ ] `async getDeviceTime(): Promise<string>` (using `driver.getDeviceTime()`).
    *   [ ] `async hideKeyboard(): Promise<void>` (using `driver.hideKeyboard()`).
    *   [ ] `async isKeyboardShown(): Promise<boolean>` (using `driver.isKeyboardShown()`).
    *   [ ] `async pressKeyCode(keycode: number, metastate?: number, flags?: number): Promise<void>` (using `driver.pressKeyCode(keycode, metastate, flags)`).
    *   [ ] `async longPressKeyCode(keycode: number, metastate?: number, flags?: number): Promise<void>` (using `driver.longPressKeyCode(keycode, metastate, flags)`).
    *   [ ] `async getContexts(): Promise<string[]>` (using `driver.getContexts()`).
    *   [ ] `async getCurrentContext(): Promise<string>` (using `driver.getContext()`).
    *   [ ] `async switchContext(contextName: string): Promise<void>` (using `driver.switchContext(contextName)`).
    *   [ ] `async executeScript(script: string, args?: any[]): Promise<any>` (using `driver.execute(script, args)`).
    *   [ ] `async getGeoLocation(): Promise<WebdriverIO.Location>` (using `driver.getGeoLocation()`).
    *   [ ] `async setGeoLocation(location: WebdriverIO.Location): Promise<void>` (using `driver.setGeoLocation(location)`).
    *   [ ] `async startRecordingScreen(options?: WebdriverIO.RecordScreenOptions): Promise<void>` (using `driver.startRecordingScreen(options)`).
    *   [ ] `async stopRecordingScreen(): Promise<string>` (using `driver.stopRecordingScreen()`, returns base64 video).

### Task 1.5: `AppiumDevice` - Element Interaction Methods
*   **File:** `packages/android/src/page/appium-device.ts`
*   **Sub-Tasks (Implement using `this.driver.<method>` and `$` / `$$` for elements):**
    *   [ ] Define helper `async _findElement(strategy: string, selector: string): Promise<WebdriverIO.Element>`
    *   [ ] Define helper `async _findElements(strategy: string, selector: string): Promise<WebdriverIO.Element[]>`
    *   [ ] `async findElement(strategy: string, selector: string): Promise<WebdriverIO.Element>` (using `driver.$(selector)` or `driver.custom$(strategy, selector)`) - *Note: WebDriverIO's `$` typically uses default strategies. Explicit strategy might require `custom$`. Clarify best practice.*
    *   [ ] `async findElements(strategy: string, selector: string): Promise<WebdriverIO.Element[]>` (using `driver.$$(selector)` or `driver.custom$$`)
    *   [ ] `async click(element: WebdriverIO.Element | string, strategy?: string): Promise<void>` (If string, find element first).
    *   [ ] `async setValue(element: WebdriverIO.Element | string, value: string | string[], strategy?: string): Promise<void>`.
    *   [ ] `async addValue(element: WebdriverIO.Element | string, value: string | string[], strategy?: string): Promise<void>`.
    *   [ ] `async clearValue(element: WebdriverIO.Element | string, strategy?: string): Promise<void>`.
    *   [ ] `async getText(element: WebdriverIO.Element | string, strategy?: string): Promise<string>`.
    *   [ ] `async getAttribute(element: WebdriverIO.Element | string, attributeName: string, strategy?: string): Promise<string>`.
    *   [ ] `async getElementRect(element: WebdriverIO.Element | string, strategy?: string): Promise<WebdriverIO.Rect>`.
    *   [ ] `async isDisplayed(element: WebdriverIO.Element | string, strategy?: string): Promise<boolean>`.
    *   [ ] `async isEnabled(element: WebdriverIO.Element | string, strategy?: string): Promise<boolean>`.
    *   [ ] `async isSelected(element: WebdriverIO.Element | string, strategy?: string): Promise<boolean>`.
    *   [ ] `async getElementScreenshot(element: WebdriverIO.Element | string, strategy?: string): Promise<string>`.
    *   [ ] `async performTouchAction(actions: WebdriverIO.TouchAction[] | WebdriverIO.MultiTouchAction): Promise<void>` (using `driver.touchPerform(actions)` or `driver.performActions` for W3C actions).
        *   *Consider providing simpler tap/swipe helpers on `AppiumDevice` that construct these actions.*
        *   [ ] `async tap(elementOrX: WebdriverIO.Element | number, y?: number): Promise<void>`
        *   [ ] `async swipe(startX: number, startY: number, endX: number, endY: number, durationMs?: number): Promise<void>`

---

## Phase 2: Agent and Factory Functions

### Task 2.1: [AndroidAgent](cci:2://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:8:0-23:1) Update
*   **File:** [packages/android/src/agent/index.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:0:0-0:0)
*   **Sub-Tasks:**
    *   [ ] Change import: `import { AppiumDevice } from '../page/appium-device';`
    *   [ ] Update class signature: `export class AndroidAgent extends PageAgent<AppiumDevice>`
    *   [ ] Review constructor: [constructor(page: AppiumDevice, opts?: PageAgentOpt)](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:9:2-17:3) - ensure `PageAgentOpt` is still suitable.
    *   [ ] Review `async launch(uri: string): Promise<void>`:
        *   Decide if this single [launch](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:19:2-22:3) method is sufficient or if it should be split/clarified (e.g., `launchAppByPackageActivity`, `openUrlInBrowserOrWebview`).
        *   Currently, it calls `this.page.launch(uri)`. Ensure `AppiumDevice` has a corresponding [launch(uri: string)](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:19:2-22:3) method that intelligently handles different URI schemes (app package, activity, http/s URL) or deprecate this agent method in favor of more specific ones like `agent.page.startActivity(...)` or `agent.page.openUrl(...)`.
    *   [ ] Ensure `vlLocateMode()` check remains if still relevant for AI model selection with Appium.

### Task 2.2: Factory Function Implementation
*   **File:** [packages/android/src/agent/index.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:0:0-0:0)
*   **Sub-Tasks:**
    *   [ ] Remove [agentFromAdbDevice](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:29:0-51:1) and [AgentFromAdbDeviceOptions](cci:2://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:25:0-27:1).
    *   [ ] Import `AppiumServerConfig`, `AppiumBaseCapabilities`, `SauceLabsConfig`, `SauceLabsCapabilities` from `../types.ts`.
    *   [ ] Implement `async agentFromAppiumServer(config: AppiumServerConfig, capabilities: AppiumBaseCapabilities, agentOpts?: PageAgentOpt): Promise<AndroidAgent>`:
        *   Create `const device = new AppiumDevice(config, capabilities);`
        *   Call `await device.connect();`
        *   Return `new AndroidAgent(device, agentOpts);`
        *   Add error handling for device connection.
    *   [ ] Implement `async agentFromLocalAppium(capabilities: AppiumBaseCapabilities, agentOpts?: PageAgentOpt): Promise<AndroidAgent>`:
        *   Define `const localServerConfig: AppiumServerConfig = { hostname: '127.0.0.1', port: 4723, protocol: 'http' };`
        *   Call `return agentFromAppiumServer(localServerConfig, capabilities, agentOpts);`
    *   [ ] Implement `async agentFromSauceLabs(slConfig: SauceLabsConfig, capabilities: AppiumBaseCapabilities & SauceLabsCapabilities, agentOpts?: PageAgentOpt): Promise<AndroidAgent>`:
        *   Construct `AppiumServerConfig` for Sauce Labs:
            *   `hostname: ondemand.${slConfig.region}.saucelabs.com` (or similar, verify exact endpoint structure)
            *   `port: 443` (typically)
            *   `protocol: 'https'`
            *   `path: '/wd/hub'`
        *   Merge/Enrich capabilities:
            *   Ensure `capabilities['sauce:options']` includes `username: slConfig.user` and `accessKey: slConfig.key`.
            *   Pass through other Sauce Labs specific capabilities.
        *   Call `return agentFromAppiumServer(sauceServerConfig, mergedCapabilities, agentOpts);`

---

## Phase 3: Utilities and Cleanup

### Task 3.1: Utilities Update
*   **File:** `packages/android/src/utils/index.ts`
*   **Sub-Tasks:**
    *   [ ] Remove `getConnectedDevices` and `AdbConnectionOptions`.
    *   [ ] Evaluate if any new Appium-specific utilities are needed here. For now, assume the file can be emptied or deleted if no general utils are identified. (Capability builders or helpers might be better placed elsewhere, e.g. `types.ts` or within factory functions if highly specific).

### Task 3.2: Logging Review
*   **Files:** All modified [.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/index.ts:0:0-0:0) files.
*   **Sub-Tasks:**
    *   [ ] Review all `debugPage` (or new `debugDevice`, `debugAgent`) calls.
    *   [ ] Ensure logs clearly indicate Appium commands being sent and responses (or errors).
    *   [ ] Configure `webdriverio` `logLevel` appropriately (perhaps make it configurable via `PageAgentOpt` or a global setting).

### Task 3.3: Error Handling Review
*   **Files:** All modified [.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/index.ts:0:0-0:0) files.
*   **Sub-Tasks:**
    *   [ ] Wrap critical Appium calls (`connect`, `driver.<command>`) in try/catch blocks.
    *   [ ] Re-throw errors with more context or as custom error types if beneficial.
    *   [ ] Provide links to documentation or troubleshooting tips in error messages where possible.

---

## Phase 4: Exports and Documentation

### Task 4.1: Package Exports Update
*   **File:** [packages/android/src/index.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/index.ts:0:0-0:0)
*   **Sub-Tasks:**
    *   [ ] Export `AppiumDevice` from `./page/appium-device`.
    *   [ ] Export [AndroidAgent](cci:2://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:8:0-23:1) from [./agent](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:29:0-51:1).
    *   [ ] Export new factory functions: `agentFromAppiumServer`, `agentFromLocalAppium`, `agentFromSauceLabs`.
    *   [ ] Export relevant configuration types from `./types`.
    *   [ ] Remove old exports (`AndroidDevice` (old name), [agentFromAdbDevice](cci:1://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/agent/index.ts:29:0-51:1), `getConnectedDevices`).
    *   [ ] Keep `overrideAIConfig` export if still relevant.

### Task 4.2: Documentation Update - README
*   **File:** `packages/android/README.md` (and any other relevant markdown files)
*   **Sub-Tasks:**
    *   [ ] Update installation instructions (mention `webdriverio` as a peer/core dependency).
    *   [ ] Rewrite "Getting Started" / "Usage" sections to feature Appium.
    *   [ ] Provide clear examples for:
        *   Connecting to a local Appium server.
        *   Connecting to Sauce Labs (with environment variables for credentials).
        *   Basic interactions using the agent.
    *   [ ] Explain required Appium capabilities (`platformName`, `appium:deviceName`, `appium:app`, etc.).
    *   [ ] Update API reference for exported classes/functions.
    *   [ ] Add a section on "Appium Server Setup" or link to Appium's official documentation.
    *   [ ] Update FAQ and Troubleshooting for Appium-related issues.

### Task 4.3: JSDoc / TSDoc Update
*   **Files:** All modified [.ts](cci:7://file:///c:/Users/Dequ/Desktop/acabAi/packages/android/src/index.ts:0:0-0:0) files.
*   **Sub-Tasks:**
    *   [ ] Add/update TSDoc comments for all public classes, methods, interfaces, and functions.
    *   [ ] Clearly document parameters, return types, and usage examples where appropriate.

### Task 4.4: Example Code Update
*   **Directory:** `examples/android/` (or similar, if it exists in the project)
*   **Sub-Tasks:**
    *   [ ] Create new example scripts demonstrating the Appium-based usage.
    *   [ ] Include examples for local Appium and Sauce Labs.
    *   [ ] Remove or update old ADB-based examples.

---

## Phase 5: Testing

### Task 5.1: Unit Tests
*   **Directory:** `packages/android/tests/unit/` (or similar)
*   **Sub-Tasks:**
    *   [ ] Write unit tests for factory functions (mock `AppiumDevice` and `connect`).
    *   [ ] Write unit tests for any complex logic within `AppiumDevice` (e.g., capability merging, helper methods), mocking `webdriverio.remote` and `driver` calls.
    *   [ ] Aim for good coverage of new/modified code.

### Task 5.2: Integration Tests - Local Appium
*   **Directory:** `packages/android/tests/integration/` (or similar)
*   **Setup:** Requires a local Appium server running and an Android emulator/device connected and configured.
*   **Sub-Tasks:**
    *   [ ] Create test script for `agentFromLocalAppium`.
    *   [ ] Test core agent functionalities:
        *   App launch, close.
        *   Element finding and interaction (tap, type, get text).
        *   Screenshot.
        *   Getting page source.
        *   Basic assertions on UI state.
    *   Use a simple test APK for these tests.

### Task 5.3: Integration Tests - Sauce Labs (Optional but Recommended)
*   **Directory:** `packages/android/tests/integration/`
*   **Setup:** Requires Sauce Labs account and credentials (use environment variables).
*   **Sub-Tasks:**
    *   [ ] Create test script for `agentFromSauceLabs`.
    *   [ ] Upload a test APK to Sauce Labs storage or use a publicly available one.
    *   [ ] Run similar tests as local integration tests, but on Sauce Labs devices.
    *   [ ] This might be run manually or as part of a CI pipeline with secure credential handling.

---

**Post-Refactor:**
*   [ ] Announce changes to users/team.
*   [ ] Monitor for issues and gather feedback.
*   [ ] Plan for any follow-up enhancements based on the new architecture. 