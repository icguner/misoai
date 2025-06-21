/**
 * Utility functions for Android automation
 */

export * from './media';

/**
 * Get list of connected Android devices
 * @returns Promise<string[]> - Array of device IDs
 */
export async function getConnectedDevices(): Promise<string[]> {
  // TODO: Implement actual ADB device discovery
  // For now, return a mock device list
  return ['emulator-5554', 'device-1234'];
}
