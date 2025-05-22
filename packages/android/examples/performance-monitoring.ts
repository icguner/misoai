/**
 * Example for continuous performance monitoring during test execution using misoai-android
 */
import { agentFromLocalAppium, type AppiumBaseCapabilities } from 'misoai-android';
import { PerformanceMonitor } from '../src/performance';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    console.log('Starting Android performance monitoring example...');

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
    const appPackage = 'com.android.settings';
    console.log(`Launching app: ${appPackage}...`);
    await agent.launch(appPackage);

    // Create a performance monitor with auto-detection of active app
    console.log('Initializing performance monitor with active app detection...');
    // Note: We don't pass a fixed package name, so it will auto-detect the active app
    const performanceMonitor = new PerformanceMonitor(agent.page);

    // Initialize the monitor and get available metrics
    const availableMetrics = await performanceMonitor.initialize();
    console.log('Available performance metrics:', availableMetrics);

    // Get device information
    console.log('Getting device information...');
    const deviceInfo = await performanceMonitor.getDeviceInfo();
    console.log('Device information:', deviceInfo);

    // Start monitoring performance metrics every 2 seconds
    console.log('Starting performance monitoring...');
    performanceMonitor.startMonitoring(2000);

    // Perform some actions to generate performance data
    console.log('Performing actions to generate performance data...');

    // Get screen size
    const size = await agent.page.size();

    // Scroll down a few times
    for (let i = 0; i < 5; i++) {
      console.log(`Scrolling down (${i + 1}/5)...`);
      await agent.page.scrollDown(300);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Scroll up a few times
    for (let i = 0; i < 5; i++) {
      console.log(`Scrolling up (${i + 1}/5)...`);
      await agent.page.scrollUp(300);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Tap in the middle of the screen a few times
    for (let i = 0; i < 3; i++) {
      console.log(`Tapping in the middle of the screen (${i + 1}/3)...`);
      await agent.page.tap(size.width / 2, size.height / 2);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Stop monitoring
    console.log('Stopping performance monitoring...');
    performanceMonitor.stopMonitoring();

    // Get collected metrics
    const metrics = performanceMonitor.getMetrics();
    console.log(`Collected ${metrics.length} performance metrics samples`);

    // Export metrics to JSON file using the new method
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const resultsDir = path.join(process.cwd(), 'performance-results');
    const metricsFilePath = path.join(resultsDir, `metrics-${timestamp}.json`);

    await performanceMonitor.exportMetricsToFile(metricsFilePath);
    console.log(`Metrics saved to: ${metricsFilePath}`);

    // Get metrics for the settings app specifically
    const settingsAppMetrics = performanceMonitor.getMetricsForPackage('com.android.settings');
    console.log(`Collected ${settingsAppMetrics.length} metrics specifically for the settings app`);

    // Save device info to a file
    const deviceInfoFilePath = path.join(resultsDir, `device-info-${timestamp}.json`);
    fs.writeFileSync(deviceInfoFilePath, JSON.stringify(deviceInfo, null, 2));
    console.log(`Device info saved to: ${deviceInfoFilePath}`);

    // Generate a simple HTML report
    const htmlReport = generateHtmlReport(deviceInfo, metrics);
    const htmlReportPath = path.join(resultsDir, `report-${timestamp}.html`);
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`HTML report saved to: ${htmlReportPath}`);

    // Disconnect from the Appium server
    console.log('Disconnecting from Appium server...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in Android performance monitoring example:', error);
  }
}

/**
 * Generates a simple HTML report from the collected metrics
 *
 * @param deviceInfo - Device information
 * @param metrics - Collected performance metrics
 * @returns HTML report
 */
function generateHtmlReport(deviceInfo: any, metrics: any[]): string {
  // Group metrics by package name
  const packageGroups: Record<string, any[]> = {};

  metrics.forEach(metric => {
    const packageName = metric.packageName || 'unknown';
    if (!packageGroups[packageName]) {
      packageGroups[packageName] = [];
    }
    packageGroups[packageName].push(metric);
  });

  // Get unique package names
  const packageNames = Object.keys(packageGroups);

  // Create CPU usage data for chart
  const cpuData = metrics
    .filter(m => m.cpuInfo)
    .map(m => ({
      timestamp: new Date(m.timestamp).toLocaleTimeString(),
      packageName: m.packageName,
      user: m.cpuInfo?.user || 0,
      system: m.cpuInfo?.system || 0,
      idle: m.cpuInfo?.idle || 0
    }));

  // Create memory usage data for chart
  const memoryData = metrics
    .filter(m => m.memoryInfo)
    .map(m => ({
      timestamp: new Date(m.timestamp).toLocaleTimeString(),
      packageName: m.packageName,
      usedMemPercent: m.memoryInfo?.usedMemPercent || 0
    }));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Android Performance Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .chart-container { height: 300px; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Android Performance Report</h1>

    <div class="card">
      <h2>Device Information</h2>
      <table>
        <tr><th>Model</th><td>${deviceInfo.model}</td></tr>
        <tr><th>Manufacturer</th><td>${deviceInfo.manufacturer}</td></tr>
        <tr><th>Android Version</th><td>${deviceInfo.androidVersion}</td></tr>
        <tr><th>CPU Architecture</th><td>${deviceInfo.cpuArchitecture}</td></tr>
        <tr><th>CPU Cores</th><td>${deviceInfo.cpuCores}</td></tr>
        <tr><th>Total RAM</th><td>${deviceInfo.totalRam}</td></tr>
        <tr><th>Screen Density</th><td>${deviceInfo.screenDensity}</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Monitored Applications</h2>
      <table>
        <tr>
          <th>Package Name</th>
          <th>Number of Metrics</th>
          <th>Time Range</th>
        </tr>
        ${packageNames.map(pkg => {
          const pkgMetrics = packageGroups[pkg];
          const startTime = new Date(Math.min(...pkgMetrics.map(m => m.timestamp))).toLocaleTimeString();
          const endTime = new Date(Math.max(...pkgMetrics.map(m => m.timestamp))).toLocaleTimeString();
          return `<tr>
            <td>${pkg}</td>
            <td>${pkgMetrics.length}</td>
            <td>${startTime} - ${endTime}</td>
          </tr>`;
        }).join('')}
      </table>
    </div>

    <div class="card">
      <h2>CPU Usage</h2>
      <div class="chart-container">
        <canvas id="cpuChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>Memory Usage</h2>
      <div class="chart-container">
        <canvas id="memoryChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>Application Switching Timeline</h2>
      <div class="chart-container">
        <canvas id="appSwitchChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>Raw Metrics</h2>
      <pre>${JSON.stringify(metrics, null, 2)}</pre>
    </div>
  </div>

  <script>
    // CPU Chart
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    new Chart(cpuCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(cpuData.map(d => d.timestamp))},
        datasets: [
          {
            label: 'User CPU (%)',
            data: ${JSON.stringify(cpuData.map(d => d.user))},
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1
          },
          {
            label: 'System CPU (%)',
            data: ${JSON.stringify(cpuData.map(d => d.system))},
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.1
          },
          {
            label: 'Idle CPU (%)',
            data: ${JSON.stringify(cpuData.map(d => d.idle))},
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });

    // Memory Chart
    const memCtx = document.getElementById('memoryChart').getContext('2d');
    new Chart(memCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(memoryData.map(d => d.timestamp))},
        datasets: [
          {
            label: 'Memory Usage (%)',
            data: ${JSON.stringify(memoryData.map(d => d.usedMemPercent))},
            borderColor: 'rgba(153, 102, 255, 1)',
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });

    // Application Switching Timeline
    const appSwitchCtx = document.getElementById('appSwitchChart').getContext('2d');

    // Create datasets for each package
    const appSwitchDatasets = ${JSON.stringify(packageNames)}.map((pkg, index) => {
      // Create a color based on index
      const hue = (index * 137) % 360; // Use golden ratio to spread colors
      const color = \`hsl(\${hue}, 70%, 60%)\`;

      // Create data points where the package is active
      const dataPoints = ${JSON.stringify(metrics.map(m => ({
        timestamp: new Date(m.timestamp).toLocaleTimeString(),
        packageName: m.packageName
      })))}.map(point => ({
        x: point.timestamp,
        y: point.packageName === pkg ? 1 : 0
      }));

      return {
        label: pkg,
        data: dataPoints,
        backgroundColor: color,
        borderColor: color,
        stepped: true,
        fill: false
      };
    });

    new Chart(appSwitchCtx, {
      type: 'line',
      data: {
        datasets: appSwitchDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'category',
            labels: ${JSON.stringify(metrics.map(m => new Date(m.timestamp).toLocaleTimeString()))}
          },
          y: {
            beginAtZero: true,
            max: 1.2,
            ticks: {
              stepSize: 1,
              callback: function(value) {
                return value === 1 ? 'Active' : (value === 0 ? 'Inactive' : '');
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const pkg = context.dataset.label;
                const status = context.raw.y === 1 ? 'Active' : 'Inactive';
                return \`\${pkg}: \${status}\`;
              }
            }
          }
        }
      }
    });
  </script>
</body>
</html>
  `;
}

// Run the example
main().catch(console.error);
