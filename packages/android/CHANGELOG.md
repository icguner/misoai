# Changelog

All notable changes to the `misoai-android` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.3] - 2024-07-11

### Changed
- Updated dependency on misoai-web to version 1.0.1
- Centralized package version management in root package.json

## [3.0.2] - 2024-07-11

### Added
- Enhanced PerformanceMonitor with automatic active application detection
- Added timestamp and package name to performance metrics
- Added methods to filter metrics by package name and time range
- Added application switching timeline to performance reports

### Changed
- Updated PerformanceMonitor constructor to make package name optional
- Improved HTML report generation with application switching visualization

## [3.0.1] - 2024-07-10

### Added
- Comprehensive bilingual README.md (English and Turkish)
- Detailed documentation for helper methods

### Fixed
- Proper session termination for Sauce Labs integration
- Improved resource cleanup in disconnect method

### Changed
- Package name updated from `@acabai/android` to `misoai-android`

## [3.0.0] - 2024-06-15

### Added
- Enhanced media utilities for screenshots and video recording
- Comprehensive performance monitoring capabilities
- Improved AI-powered automation features
- Support for CAPTCHA handling with deep thinking capability
- Better integration with Sauce Labs and custom Appium servers

### Changed
- Package name updated from `@acabai/android` to `misoai-android`
- Updated all imports to use misoai-prefixed package names

## [2.0.0] - 2023-07-15

### Added
- Complete rewrite using Appium and WebdriverIO
- New `AppiumDevice` class that implements the `AndroidDevicePage` interface
- Factory functions for creating agents from different Appium server configurations:
  - `agentFromAppiumServer` - Create an agent from a custom Appium server
  - `agentFromLocalAppium` - Create an agent from a local Appium server
  - `agentFromSauceLabs` - Create an agent from Sauce Labs
- Comprehensive TypeScript interfaces for Appium configuration
- Support for Sauce Labs cloud testing platform
- Example scripts demonstrating different use cases
- Detailed documentation in README.md

### Changed
- Replaced direct ADB interactions with Appium WebDriver protocol
- Updated README.md with new usage examples and configuration options
- Updated package.json with new dependencies and peer dependencies
- Improved error handling and debugging

### Removed
- `AndroidDevice` class (replaced by `AppiumDevice`)
- `agentFromAdbDevice` function (replaced by new factory functions)
- Direct dependency on `appium-adb`
- ADB-specific utilities

## [1.0.1] - 2023-06-01

### Added
- Initial release of the Android automation library
- Support for basic Android device automation using ADB
- Integration with acabAI core functionality
- Basic documentation and examples
