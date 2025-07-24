// =============================================================================
// Build Performance Monitor
// Monitors build times, tracks performance metrics, and provides insights
// =============================================================================

import { execSync, spawn } from 'child_process';
import { resolve } from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';

class BuildMonitor {
  constructor() {
    this.metricsDir = resolve('./performance-reports/build-metrics');
    this.ensureMetricsDir();
    this.buildHistory = this.loadBuildHistory();
  }

  ensureMetricsDir() {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  loadBuildHistory() {
    const historyPath = resolve(this.metricsDir, 'build-history.json');
    if (fs.existsSync(historyPath)) {
      try {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (error) {
        console.warn('Failed to load build history:', error.message);
        return { builds: [] };
      }
    }
    return { builds: [] };
  }

  saveBuildHistory() {
    const historyPath = resolve(this.metricsDir, 'build-history.json');
    fs.writeFileSync(historyPath, JSON.stringify(this.buildHistory, null, 2));
  }

  async monitorFullBuild() {
    console.log('🔍 Monitoring full monorepo build performance...');

    const buildId = `build-${Date.now()}`;
    const startTime = performance.now();
    const buildMetrics = {
      id: buildId,
      timestamp: new Date().toISOString(),
      type: 'full',
      stages: [],
      totalDuration: 0,
      success: false,
      errors: [],
      warnings: [],
    };

    try {
      // Monitor package builds
      await this.monitorPackageBuilds(buildMetrics);

      // Monitor app builds
      await this.monitorAppBuilds(buildMetrics);

      const endTime = performance.now();
      buildMetrics.totalDuration = endTime - startTime;
      buildMetrics.success = true;

      console.log(`✅ Full build completed in ${(buildMetrics.totalDuration / 1000).toFixed(2)}s`);
    } catch (error) {
      buildMetrics.errors.push({
        stage: 'build',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
      buildMetrics.success = false;
      console.error('❌ Build failed:', error.message);
    }

    // Save metrics
    this.buildHistory.builds.push(buildMetrics);
    this.saveBuildHistory();

    // Generate performance report
    await this.generatePerformanceReport(buildMetrics);

    return buildMetrics;
  }

  async monitorPackageBuilds(buildMetrics) {
    const packages = ['shared', 'ui', 'api'];

    for (const pkg of packages) {
      const stageStart = performance.now();
      console.log(`📦 Building package: ${pkg}`);

      const stage = {
        name: `package-${pkg}`,
        startTime: stageStart,
        duration: 0,
        success: false,
        output: '',
        memoryUsage: process.memoryUsage(),
      };

      try {
        // Monitor memory before build
        const memBefore = process.memoryUsage();

        // Execute build with monitoring
        const output = execSync(`pnpm --filter @agentic-workflow/${pkg} build`, {
          encoding: 'utf8',
          cwd: resolve('./'),
          timeout: 300000, // 5 minutes timeout
        });

        // Monitor memory after build
        const memAfter = process.memoryUsage();

        const stageEnd = performance.now();
        stage.duration = stageEnd - stageStart;
        stage.success = true;
        stage.output = output;
        stage.memoryDelta = {
          rss: memAfter.rss - memBefore.rss,
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          external: memAfter.external - memBefore.external,
        };

        console.log(`✅ Package ${pkg} built in ${(stage.duration / 1000).toFixed(2)}s`);
      } catch (error) {
        stage.duration = performance.now() - stageStart;
        stage.success = false;
        stage.error = error.message;
        buildMetrics.errors.push({
          stage: `package-${pkg}`,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        console.error(`❌ Package ${pkg} build failed:`, error.message);
      }

      buildMetrics.stages.push(stage);
    }
  }

  async monitorAppBuilds(buildMetrics) {
    const apps = ['frontend', 'backend'];

    for (const app of apps) {
      const stageStart = performance.now();
      console.log(`🚀 Building app: ${app}`);

      const stage = {
        name: `app-${app}`,
        startTime: stageStart,
        duration: 0,
        success: false,
        output: '',
        memoryUsage: process.memoryUsage(),
      };

      try {
        // Monitor memory before build
        const memBefore = process.memoryUsage();

        // Execute build with monitoring
        const output = execSync(`pnpm --filter @agentic-workflow/${app} build`, {
          encoding: 'utf8',
          cwd: resolve('./'),
          timeout: 300000, // 5 minutes timeout
        });

        // Monitor memory after build
        const memAfter = process.memoryUsage();

        const stageEnd = performance.now();
        stage.duration = stageEnd - stageStart;
        stage.success = true;
        stage.output = output;
        stage.memoryDelta = {
          rss: memAfter.rss - memBefore.rss,
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          external: memAfter.external - memBefore.external,
        };

        console.log(`✅ App ${app} built in ${(stage.duration / 1000).toFixed(2)}s`);
      } catch (error) {
        stage.duration = performance.now() - stageStart;
        stage.success = false;
        stage.error = error.message;
        buildMetrics.errors.push({
          stage: `app-${app}`,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        console.error(`❌ App ${app} build failed:`, error.message);
      }

      buildMetrics.stages.push(stage);
    }
  }

  async generatePerformanceReport(buildMetrics) {
    console.log('📊 Generating performance report...');

    const report = {
      buildId: buildMetrics.id,
      timestamp: buildMetrics.timestamp,
      summary: {
        totalDuration: buildMetrics.totalDuration,
        totalDurationFormatted: `${(buildMetrics.totalDuration / 1000).toFixed(2)}s`,
        success: buildMetrics.success,
        stageCount: buildMetrics.stages.length,
        errorCount: buildMetrics.errors.length,
        warningCount: buildMetrics.warnings.length,
      },
      performance: {
        averageStageTime:
          buildMetrics.stages.length > 0
            ? buildMetrics.stages.reduce((sum, stage) => sum + stage.duration, 0) /
              buildMetrics.stages.length
            : 0,
        slowestStage: buildMetrics.stages.reduce(
          (slowest, stage) => (stage.duration > (slowest?.duration || 0) ? stage : slowest),
          null
        ),
        fastestStage: buildMetrics.stages.reduce(
          (fastest, stage) => (stage.duration < (fastest?.duration || Infinity) ? stage : fastest),
          null
        ),
        memoryUsage: {
          peakRSS: Math.max(...buildMetrics.stages.map(s => s.memoryUsage?.rss || 0)),
          peakHeap: Math.max(...buildMetrics.stages.map(s => s.memoryUsage?.heapUsed || 0)),
          totalMemoryDelta: buildMetrics.stages.reduce(
            (sum, stage) => sum + (stage.memoryDelta?.rss || 0),
            0
          ),
        },
      },
      stages: buildMetrics.stages.map(stage => ({
        name: stage.name,
        duration: stage.duration,
        durationFormatted: `${(stage.duration / 1000).toFixed(2)}s`,
        success: stage.success,
        memoryUsage: stage.memoryUsage,
        memoryDelta: stage.memoryDelta,
        error: stage.error || null,
      })),
      trends: this.calculateTrends(),
      recommendations: this.generateRecommendations(buildMetrics),
    };

    // Save detailed report
    const reportPath = resolve(this.metricsDir, `build-report-${buildMetrics.id}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    await this.generateHtmlReport(report);

    console.log(`📊 Performance report: ${reportPath}`);
    return report;
  }

  calculateTrends() {
    const recentBuilds = this.buildHistory.builds.filter(build => build.success).slice(-10); // Last 10 successful builds

    if (recentBuilds.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const durations = recentBuilds.map(build => build.totalDuration);
    const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const latest = durations[durations.length - 1];
    const trend = latest > average ? 'slower' : 'faster';
    const difference = Math.abs(latest - average);
    const percentageChange = ((difference / average) * 100).toFixed(1);

    return {
      averageBuildTime: average,
      latestBuildTime: latest,
      trend,
      percentageChange,
      message: `Latest build was ${percentageChange}% ${trend} than average`,
    };
  }

  generateRecommendations(buildMetrics) {
    const recommendations = [];

    // Analyze build time
    if (buildMetrics.totalDuration > 120000) {
      // > 2 minutes
      recommendations.push({
        category: 'Build Time',
        priority: 'high',
        issue: 'Long build time detected',
        suggestion: 'Consider implementing incremental builds or build caching',
        impact: 'Can reduce build time by 50-80%',
      });
    }

    // Analyze stage performance
    const slowStages = buildMetrics.stages
      .filter(stage => stage.duration > 30000) // > 30 seconds
      .sort((a, b) => b.duration - a.duration);

    if (slowStages.length > 0) {
      recommendations.push({
        category: 'Stage Performance',
        priority: 'medium',
        issue: `${slowStages.length} slow build stage(s) detected`,
        suggestion: 'Optimize slow stages: ' + slowStages.map(s => s.name).join(', '),
        stages: slowStages.slice(0, 3),
        impact: 'Can improve overall build time',
      });
    }

    // Analyze memory usage
    const highMemoryStages = buildMetrics.stages.filter(
      stage => stage.memoryUsage?.rss > 500 * 1024 * 1024 // > 500MB
    );

    if (highMemoryStages.length > 0) {
      recommendations.push({
        category: 'Memory Usage',
        priority: 'medium',
        issue: 'High memory usage detected in some stages',
        suggestion: 'Consider optimizing memory-intensive build steps',
        stages: highMemoryStages.map(s => s.name),
        impact: 'Can prevent out-of-memory errors and improve stability',
      });
    }

    // Analyze errors
    if (buildMetrics.errors.length > 0) {
      recommendations.push({
        category: 'Build Reliability',
        priority: 'high',
        issue: `${buildMetrics.errors.length} build error(s) occurred`,
        suggestion: 'Address build errors to improve reliability',
        errors: buildMetrics.errors,
        impact: 'Critical for build success',
      });
    }

    // General optimizations
    recommendations.push({
      category: 'General Optimization',
      priority: 'low',
      issue: 'General build optimization opportunities',
      suggestions: [
        'Enable build caching where possible',
        'Use parallel builds for independent packages',
        'Minimize dependencies in build processes',
        'Consider using faster build tools (SWC, esbuild)',
        'Implement build performance budgets',
      ],
      impact: 'Can provide cumulative performance improvements',
    });

    return recommendations;
  }

  async generateHtmlReport(report) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Build Performance Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-card h3 { margin: 0 0 10px 0; color: #333; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .stage-list { background: #f8f9fa; border-radius: 6px; overflow: hidden; }
        .stage-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #dee2e6; }
        .stage-item:last-child { border-bottom: none; }
        .stage-name { font-weight: bold; }
        .stage-duration { color: #6c757d; }
        .recommendations { background: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
        .recommendation-item { margin-bottom: 15px; padding: 10px; background: white; border-radius: 4px; }
        .chart { height: 300px; margin: 20px 0; }
        .trend-up { color: #dc3545; }
        .trend-down { color: #28a745; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Build Performance Report</h1>
            <p>Build ID: ${report.buildId}</p>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <h3>Total Duration</h3>
                <div class="metric-value">${report.summary.totalDurationFormatted}</div>
            </div>
            <div class="metric-card">
                <h3>Build Status</h3>
                <div class="metric-value ${report.summary.success ? 'success' : 'failure'}">
                    ${report.summary.success ? '✅ Success' : '❌ Failed'}
                </div>
            </div>
            <div class="metric-card">
                <h3>Stages</h3>
                <div class="metric-value">${report.summary.stageCount}</div>
            </div>
            <div class="metric-card">
                <h3>Errors</h3>
                <div class="metric-value ${report.summary.errorCount > 0 ? 'failure' : 'success'}">
                    ${report.summary.errorCount}
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="summary">
                <div class="metric-card">
                    <h3>Average Stage Time</h3>
                    <div class="metric-value">${(report.performance.averageStageTime / 1000).toFixed(2)}s</div>
                </div>
                <div class="metric-card">
                    <h3>Slowest Stage</h3>
                    <div class="metric-value">${report.performance.slowestStage?.name || 'N/A'}</div>
                    <small>${report.performance.slowestStage ? (report.performance.slowestStage.duration / 1000).toFixed(2) + 's' : ''}</small>
                </div>
                <div class="metric-card">
                    <h3>Peak Memory</h3>
                    <div class="metric-value">${(report.performance.memoryUsage.peakRSS / 1024 / 1024).toFixed(0)}MB</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Build Stages</h2>
            <canvas id="stagesChart" class="chart"></canvas>
        </div>

        <div class="section">
            <h2>Stage Details</h2>
            <div class="stage-list">
                ${report.stages
                  .map(
                    stage => `
                    <div class="stage-item">
                        <div>
                            <div class="stage-name">${stage.name}</div>
                            <div style="font-size: 0.9em; color: #6c757d;">
                                ${stage.success ? '✅' : '❌'} 
                                Memory: ${(stage.memoryUsage?.rss / 1024 / 1024).toFixed(0)}MB
                            </div>
                        </div>
                        <div class="stage-duration">${stage.durationFormatted}</div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>

        ${
          report.trends.message
            ? `
        <div class="section">
            <h2>Performance Trends</h2>
            <div class="recommendations">
                <p><strong>Trend Analysis:</strong> ${report.trends.message}</p>
                ${
                  report.trends.trend
                    ? `
                <p>Latest build was <span class="${report.trends.trend === 'slower' ? 'trend-up' : 'trend-down'}">${report.trends.percentageChange}% ${report.trends.trend}</span> than average.</p>
                `
                    : ''
                }
            </div>
        </div>
        `
            : ''
        }

        <div class="section">
            <h2>Optimization Recommendations</h2>
            ${report.recommendations
              .map(
                rec => `
                <div class="recommendation-item">
                    <h4>${rec.category} ${rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}</h4>
                    <p><strong>Issue:</strong> ${rec.issue}</p>
                    <p><strong>Suggestion:</strong> ${rec.suggestion || (rec.suggestions ? rec.suggestions.join(', ') : 'N/A')}</p>
                    ${rec.impact ? `<p><strong>Impact:</strong> ${rec.impact}</p>` : ''}
                </div>
            `
              )
              .join('')}
        </div>
    </div>

    <script>
        // Stages performance chart
        const ctx = document.getElementById('stagesChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(report.stages.map(s => s.name))},
                datasets: [{
                    label: 'Build Time (seconds)',
                    data: ${JSON.stringify(report.stages.map(s => s.duration / 1000))},
                    backgroundColor: ${JSON.stringify(report.stages.map(s => (s.success ? '#28a745' : '#dc3545')))}
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Time (seconds)'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

    const htmlPath = resolve(this.metricsDir, `build-performance-${report.buildId}.html`);
    fs.writeFileSync(htmlPath, htmlContent);

    console.log(`📊 HTML report: ${htmlPath}`);
  }

  async monitorSinglePackage(packageName) {
    console.log(`🔍 Monitoring build for package: ${packageName}`);

    const startTime = performance.now();
    const memBefore = process.memoryUsage();

    try {
      const output = execSync(`pnpm --filter @agentic-workflow/${packageName} build`, {
        encoding: 'utf8',
        cwd: resolve('./'),
        timeout: 300000,
      });

      const endTime = performance.now();
      const memAfter = process.memoryUsage();
      const duration = endTime - startTime;

      const metrics = {
        package: packageName,
        duration,
        durationFormatted: `${(duration / 1000).toFixed(2)}s`,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: {
          rss: memAfter.rss - memBefore.rss,
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          external: memAfter.external - memBefore.external,
        },
        output,
        success: true,
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Package ${packageName} built in ${metrics.durationFormatted}`);
      console.log(`📊 Memory usage: ${(memAfter.rss / 1024 / 1024).toFixed(2)}MB`);

      return metrics;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.error(`❌ Package ${packageName} build failed:`, error.message);

      return {
        package: packageName,
        duration,
        durationFormatted: `${(duration / 1000).toFixed(2)}s`,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new BuildMonitor();

  const command = process.argv[2] || 'full';
  const target = process.argv[3];

  switch (command) {
    case 'full':
    case 'all':
      await monitor.monitorFullBuild();
      break;
    case 'package':
      if (!target) {
        console.error('Please specify a package name: node build-monitor.js package <name>');
        process.exit(1);
      }
      await monitor.monitorSinglePackage(target);
      break;
    default:
      console.log('Usage: node build-monitor.js [full|package] [package-name]');
  }
}

export default BuildMonitor;
