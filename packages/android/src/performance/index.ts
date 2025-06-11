/**
 * Performance monitoring utilities for Android devices
 */
import type { AppiumDevice } from '../page/appium-device';
import { debugDevice } from '../page/appium-device';

/**
 * Interface for CPU information
 */
export interface CpuInfo {
  user: number;
  system: number;
  idle: number;
  total: number;
}

/**
 * Interface for memory information
 */
export interface MemoryInfo {
  totalMem: number;
  freeMem: number;
  usedMem: number;
  usedMemPercent: number;
}

/**
 * Interface for battery information
 */
export interface BatteryInfo {
  level: number;
  status: string;
  temperature: number;
}

/**
 * Interface for network information
 */
export interface NetworkInfo {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

/**
 * Interface for device information
 */
export interface DeviceInfo {
  model: string;
  manufacturer: string;
  androidVersion: string;
  cpuArchitecture: string;
  cpuCores: number;
  totalRam: string;
  screenDensity: string;
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
  timestamp: number;
  packageName: string;
  cpuInfo?: CpuInfo;
  memoryInfo?: MemoryInfo;
  batteryInfo?: BatteryInfo;
  networkInfo?: NetworkInfo;
}

/**
 * Performance monitor class for Android devices
 */
export class PerformanceMonitor {
  private device: AppiumDevice;
  private defaultPackageName?: string;
  private metrics: PerformanceMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private availableMetrics: string[] = [];
  private lastActivePackage = '';

  /**
   * Creates a new PerformanceMonitor instance
   *
   * @param device - AppiumDevice instance
   * @param defaultPackageName - Optional default package name to use if active package detection fails
   */
  constructor(device: AppiumDevice, defaultPackageName?: string) {
    this.device = device;
    this.defaultPackageName = defaultPackageName;
  }

  /**
   * Gets the currently active package name
   */
  private async getActivePackage(): Promise<string> {
    try {
      // Try to get the current package from the device
      const currentPackage = await this.device.getCurrentPackage();
      if (currentPackage) {
        this.lastActivePackage = currentPackage;
        return currentPackage;
      }
    } catch (error: any) {
      debugDevice('Error getting active package: %s', error.message);
    }

    // If we couldn't get the current package, use the last known active package
    if (this.lastActivePackage) {
      return this.lastActivePackage;
    }

    // If we don't have a last known active package, use the default package name
    if (this.defaultPackageName) {
      return this.defaultPackageName;
    }

    // If all else fails, return a placeholder
    return 'unknown.package';
  }

  /**
   * Initializes the performance monitor
   */
  public async initialize(): Promise<string[]> {
    debugDevice('Initializing performance monitor');
    const driver = await this.device.getDriver();
    this.availableMetrics = await driver.getPerformanceDataTypes();
    debugDevice('Available performance metrics: %O', this.availableMetrics);
    return this.availableMetrics;
  }

  /**
   * Gets device information
   */
  public async getDeviceInfo(): Promise<DeviceInfo> {
    debugDevice('Getting device information');
    const driver = await this.device.getDriver();

    const executeShellCommand = async (command: string): Promise<string> => {
      return await driver.executeScript('mobile: shell', [
        {
          command,
        },
      ]);
    };

    const model = await executeShellCommand('getprop ro.product.model');
    const manufacturer = await executeShellCommand(
      'getprop ro.product.manufacturer',
    );
    const androidVersion = await executeShellCommand(
      'getprop ro.build.version.release',
    );
    const cpuArchitecture = await executeShellCommand('uname -m');
    const cpuCores = Number.parseInt(
      await executeShellCommand('cat /proc/cpuinfo | grep processor | wc -l'),
      10,
    );
    const totalRam = await executeShellCommand(
      'cat /proc/meminfo | grep MemTotal',
    );
    const screenDensity = await executeShellCommand('wm density');

    const deviceInfo: DeviceInfo = {
      model: model.trim(),
      manufacturer: manufacturer.trim(),
      androidVersion: androidVersion.trim(),
      cpuArchitecture: cpuArchitecture.trim(),
      cpuCores: Number.isNaN(cpuCores) ? 0 : cpuCores,
      totalRam: totalRam.trim(),
      screenDensity: screenDensity.trim(),
    };

    debugDevice('Device information: %O', deviceInfo);
    return deviceInfo;
  }

  /**
   * Gets current performance metrics
   */
  public async getCurrentMetrics(): Promise<PerformanceMetrics> {
    debugDevice('Getting current performance metrics');
    const driver = await this.device.getDriver();

    // Get the active package name
    const activePackage = await this.getActivePackage();
    debugDevice(
      'Getting performance metrics for active package: %s',
      activePackage,
    );

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      packageName: activePackage,
    };

    try {
      if (this.availableMetrics.includes('cpuinfo')) {
        const cpuData = await driver.getPerformanceData(
          activePackage,
          'cpuinfo',
          1,
        );
        if (cpuData && cpuData.length > 1) {
          const headers = cpuData[0];
          const values = cpuData[1];

          const userIndex = headers.indexOf('user');
          const systemIndex = headers.indexOf('system');
          const idleIndex = headers.indexOf('idle');
          const totalIndex = headers.indexOf('total');

          metrics.cpuInfo = {
            user: userIndex >= 0 ? Number.parseFloat(values[userIndex]) : 0,
            system:
              systemIndex >= 0 ? Number.parseFloat(values[systemIndex]) : 0,
            idle: idleIndex >= 0 ? Number.parseFloat(values[idleIndex]) : 0,
            total: totalIndex >= 0 ? Number.parseFloat(values[totalIndex]) : 0,
          };
        }
      }

      if (this.availableMetrics.includes('memoryinfo')) {
        const memData = await driver.getPerformanceData(
          activePackage,
          'memoryinfo',
          1,
        );
        if (memData && memData.length > 1) {
          const headers = memData[0];
          const values = memData[1];

          const totalIndex = headers.indexOf('totalMem');
          const freeIndex = headers.indexOf('freeMem');

          const totalMem =
            totalIndex >= 0 ? Number.parseInt(values[totalIndex], 10) : 0;
          const freeMem =
            freeIndex >= 0 ? Number.parseInt(values[freeIndex], 10) : 0;
          const usedMem = totalMem - freeMem;
          const usedMemPercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;

          metrics.memoryInfo = {
            totalMem,
            freeMem,
            usedMem,
            usedMemPercent,
          };
        }
      }

      if (this.availableMetrics.includes('batteryinfo')) {
        const batteryData = await driver.getPerformanceData(
          activePackage,
          'batteryinfo',
          1,
        );
        if (batteryData && batteryData.length > 1) {
          const headers = batteryData[0];
          const values = batteryData[1];

          const levelIndex = headers.indexOf('level');
          const statusIndex = headers.indexOf('status');
          const tempIndex = headers.indexOf('temperature');

          metrics.batteryInfo = {
            level:
              levelIndex >= 0 ? Number.parseInt(values[levelIndex], 10) : 0,
            status: statusIndex >= 0 ? values[statusIndex] : '',
            temperature:
              tempIndex >= 0 ? Number.parseInt(values[tempIndex], 10) / 10 : 0,
          };
        }
      }

      if (this.availableMetrics.includes('networkinfo')) {
        const networkData = await driver.getPerformanceData(
          activePackage,
          'networkinfo',
          1,
        );
        if (networkData && networkData.length > 1) {
          const headers = networkData[0];
          const values = networkData[1];

          const rxBytesIndex = headers.indexOf('rxBytes');
          const txBytesIndex = headers.indexOf('txBytes');
          const rxPacketsIndex = headers.indexOf('rxPackets');
          const txPacketsIndex = headers.indexOf('txPackets');

          metrics.networkInfo = {
            rxBytes:
              rxBytesIndex >= 0 ? Number.parseInt(values[rxBytesIndex], 10) : 0,
            txBytes:
              txBytesIndex >= 0 ? Number.parseInt(values[txBytesIndex], 10) : 0,
            rxPackets:
              rxPacketsIndex >= 0
                ? Number.parseInt(values[rxPacketsIndex], 10)
                : 0,
            txPackets:
              txPacketsIndex >= 0
                ? Number.parseInt(values[txPacketsIndex], 10)
                : 0,
          };
        }
      }
    } catch (error: any) {
      debugDevice('Error getting performance metrics: %s', error.message);
    }

    this.metrics.push(metrics);
    return metrics;
  }

  /**
   * Starts monitoring performance metrics at the specified interval
   *
   * @param intervalMs - Interval in milliseconds (default: 5000)
   */
  public startMonitoring(intervalMs = 5000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    debugDevice(
      'Starting performance monitoring with interval %d ms',
      intervalMs,
    );
    this.monitoringInterval = setInterval(async () => {
      await this.getCurrentMetrics();
    }, intervalMs);
  }

  /**
   * Stops monitoring performance metrics
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      debugDevice('Stopping performance monitoring');
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Gets all collected metrics
   */
  public getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  /**
   * Clears all collected metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Exports metrics to JSON string
   */
  public exportMetricsToJson(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Exports metrics to a JSON file
   *
   * @param filePath - Path to save the JSON file
   */
  public async exportMetricsToFile(filePath: string): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write metrics to file
      const jsonData = this.exportMetricsToJson();
      await fs.writeFile(filePath, jsonData, 'utf8');

      debugDevice('Performance metrics exported to %s', filePath);
    } catch (error: any) {
      debugDevice('Error exporting metrics to file: %s', error.message);
      throw new Error(`Failed to export metrics to file: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets metrics for a specific package
   *
   * @param packageName - Package name to filter by
   */
  public getMetricsForPackage(packageName: string): PerformanceMetrics[] {
    return this.metrics.filter((metric) => metric.packageName === packageName);
  }

  /**
   * Gets metrics within a time range
   *
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   */
  public getMetricsInTimeRange(
    startTime: number,
    endTime: number,
  ): PerformanceMetrics[] {
    return this.metrics.filter(
      (metric) => metric.timestamp >= startTime && metric.timestamp <= endTime,
    );
  }
}

export default PerformanceMonitor;
