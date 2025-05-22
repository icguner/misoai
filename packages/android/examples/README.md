# @acabai/android Examples

This directory contains example scripts demonstrating how to use the `@acabai/android` package with different configurations and features.

## Prerequisites

Before running these examples, make sure you have:

1. Node.js and npm installed
2. Appium server installed and running (`npm install -g appium` and then `appium`)
3. Android SDK installed and configured
4. At least one Android device connected via USB or an Android emulator running
5. USB debugging enabled on your Android device
6. Required dependencies installed (`npm install`)

## Running the Examples

You can run the examples using the npm scripts defined in the package.json:

```bash
# Basic usage example
npm run example:basic

# Sauce Labs integration example
npm run example:sauce

# AI-powered automation example
npm run example:ai

# Media utilities example (screenshots and video recording)
npm run example:media
```

Or you can run them directly with ts-node:

```bash
npx ts-node examples/basic-usage.ts
npx ts-node examples/sauce-labs.ts
npx ts-node examples/ai-automation.ts
npx ts-node examples/media-utils.ts
```

## Example Descriptions

### Basic Usage (basic-usage.ts)

Demonstrates the fundamental capabilities of the `@acabai/android` package using a local Appium server:

- Connecting to a local Appium server
- Launching an app
- Taking screenshots
- Getting screen size
- Tapping on the screen
- Scrolling
- Using hardware buttons (back, home)

### Sauce Labs Integration (sauce-labs.ts)

Shows how to use `@acabai/android` with Sauce Labs cloud testing platform:

### Media Utilities (media-utils.ts)

Demonstrates how to use the media utility functions for Android automation:

- Taking screenshots and saving them to files
- Recording video of device interactions
- Managing media files with proper file paths and directories

- Configuring Sauce Labs connection
- Setting up device capabilities
- Running tests on cloud-hosted devices
- Performing basic automation tasks

### AI-Powered Automation (ai-automation.ts)

Demonstrates how to use the AI capabilities of the `@acabai/android` package:

- Configuring AI settings
- Using `aiAction` to perform actions based on natural language instructions
- Using `aiAssert` to verify conditions using AI
- Using `aiExtract` to extract information from the screen

## Configuration

### Local Appium Server

The examples use a local Appium server running on the default port (4723). Make sure Appium is installed and running before executing the examples.

### Sauce Labs

To run the Sauce Labs example, you need to set your Sauce Labs credentials as environment variables:

```bash
export SAUCE_USERNAME=your-username
export SAUCE_ACCESS_KEY=your-access-key
```

Or update the example code with your credentials.

### AI Configuration

To run the AI-powered automation example, you need to set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY=your-openai-api-key
```

Or update the example code with your API key.

## Troubleshooting

If you encounter issues running the examples:

1. Make sure Appium server is running
2. Check that your Android device is properly connected and USB debugging is enabled
3. Verify that the device capabilities in the examples match your device
4. Check the Appium server logs for any errors

For more detailed information, refer to the main [README.md](../README.md) file.
