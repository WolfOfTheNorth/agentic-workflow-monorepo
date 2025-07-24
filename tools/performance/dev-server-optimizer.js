// =============================================================================
// Development Server Optimizer
// Optimizes development server performance and provides monitoring
// =============================================================================

import { execSync, spawn } from 'child_process';
import { resolve } from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';

class DevServerOptimizer {
  constructor() {
    this.metricsDir = resolve('./performance-reports/dev-server');
    this.ensureMetricsDir();
    this.activeServers = new Map();
    this.metrics = {
      startupTimes: [],
      memoryUsage: [],
      restartCounts: {},
      hotReloadStats: [],
    };
  }

  ensureMetricsDir() {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  async optimizeDevEnvironment() {
    console.log('🚀 Optimizing development environment...');

    const optimizations = [];

    // Check and optimize Vite configuration
    await this.optimizeViteConfig(optimizations);

    // Check Node.js optimization settings
    await this.checkNodeOptimizations(optimizations);

    // Optimize package.json dev scripts
    await this.optimizeDevScripts(optimizations);

    // Generate optimization report
    await this.generateOptimizationReport(optimizations);

    console.log('✅ Development environment optimization complete!');
    return optimizations;
  }

  async optimizeViteConfig(optimizations) {
    console.log('⚡ Checking Vite configuration...');

    const frontendPath = resolve('./apps/frontend');
    const viteConfigPath = resolve(frontendPath, 'vite.config.ts');

    if (fs.existsSync(viteConfigPath)) {
      const config = fs.readFileSync(viteConfigPath, 'utf8');
      const suggestions = [];

      // Check for development optimizations
      if (!config.includes('server.fs.allow')) {
        suggestions.push({
          type: 'server-config',
          issue: 'Missing file system access optimization',
          fix: 'Add server.fs.allow configuration for monorepo access',
          code: `server: { fs: { allow: ['..', '../..'] } }`,
        });
      }

      if (!config.includes('optimizeDeps')) {
        suggestions.push({
          type: 'deps-optimization',
          issue: 'Missing dependency pre-bundling optimization',
          fix: 'Add optimizeDeps configuration for better startup performance',
          code: `optimizeDeps: { include: ['react', 'react-dom', '@shared/*', '@ui/*', '@api/*'] }`,
        });
      }

      if (!config.includes('hmr')) {
        suggestions.push({
          type: 'hmr-optimization',
          issue: 'Hot Module Replacement not explicitly configured',
          fix: 'Configure HMR for better development experience',
          code: `server: { hmr: { port: 24678, host: 'localhost' } }`,
        });
      }

      if (suggestions.length > 0) {
        optimizations.push({
          category: 'Vite Configuration',
          priority: 'high',
          file: viteConfigPath,
          suggestions,
        });
      } else {
        optimizations.push({
          category: 'Vite Configuration',
          priority: 'low',
          status: 'optimized',
          message: 'Vite configuration appears to be well optimized',
        });
      }
    }
  }

  async checkNodeOptimizations(optimizations) {
    console.log('🔧 Checking Node.js optimizations...');

    const suggestions = [];
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    // Check Node.js version
    if (majorVersion < 18) {
      suggestions.push({
        type: 'node-version',
        issue: `Using Node.js ${nodeVersion}, which may not have latest performance improvements`,
        fix: 'Consider upgrading to Node.js 18+ for better performance',
        impact: 'startup and runtime performance',
      });
    }

    // Check for optimal Node.js flags
    const nodeOptions = process.env.NODE_OPTIONS || '';

    if (!nodeOptions.includes('--max-old-space-size')) {
      suggestions.push({
        type: 'memory-optimization',
        issue: 'No explicit memory limit set for Node.js',
        fix: 'Set NODE_OPTIONS="--max-old-space-size=4096" for better memory management',
        impact: 'memory usage and garbage collection',
      });
    }

    if (!nodeOptions.includes('--experimental-loader')) {
      suggestions.push({
        type: 'loader-optimization',
        issue: 'Not using experimental ESM loader optimizations',
        fix: 'Consider using --experimental-loader for faster module resolution',
        impact: 'module loading performance',
      });
    }

    optimizations.push({
      category: 'Node.js Environment',
      priority: 'medium',
      suggestions,
    });
  }

  async optimizeDevScripts(optimizations) {
    console.log('📜 Optimizing development scripts...');

    const packageJsonPath = resolve('./package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const suggestions = [];
    const scripts = packageJson.scripts || {};

    // Check for parallel development scripts
    if (!scripts.dev || !scripts.dev.includes('concurrently')) {
      suggestions.push({
        type: 'parallel-dev',
        issue: 'Development scripts not running in parallel',
        fix: 'Use concurrently to run frontend and backend simultaneously',
        current: scripts.dev || 'No dev script found',
        recommended:
          'concurrently "pnpm dev:frontend" "pnpm dev:backend" --names "frontend,backend"',
      });
    }

    // Check for dev server restart optimization
    if (!scripts['dev:clean']) {
      suggestions.push({
        type: 'clean-restart',
        issue: 'No clean development restart script',
        fix: 'Add script to clean and restart development servers',
        recommended: 'pnpm clean && pnpm dev',
      });
    }

    // Check for performance monitoring scripts
    if (!scripts['dev:monitor']) {
      suggestions.push({
        type: 'dev-monitoring',
        issue: 'No development performance monitoring script',
        fix: 'Add script to monitor development server performance',
        recommended: 'node tools/performance/dev-server-optimizer.js monitor',
      });
    }

    optimizations.push({
      category: 'Development Scripts',
      priority: 'medium',
      file: packageJsonPath,
      suggestions,
    });
  }

  async monitorDevServers() {
    console.log('📊 Starting development server monitoring...');

    const monitoringData = {
      startTime: new Date().toISOString(),
      servers: {},
      performance: {
        startup: {},
        memory: {},
        hotReload: {},
      },
    };

    // Monitor frontend dev server
    if (await this.isServerRunning('frontend', 5173)) {
      await this.monitorServer('frontend', 5173, monitoringData);
    }

    // Monitor backend dev server
    if (await this.isServerRunning('backend', 8000)) {
      await this.monitorServer('backend', 8000, monitoringData);
    }

    // Generate monitoring report
    await this.generateMonitoringReport(monitoringData);

    return monitoringData;
  }

  async isServerRunning(name, port) {
    try {
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8', timeout: 5000 });
      return result.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  async monitorServer(name, port, monitoringData) {
    console.log(`🔍 Monitoring ${name} server on port ${port}...`);

    const serverData = {
      name,
      port,
      pid: null,
      startTime: null,
      memoryUsage: [],
      cpuUsage: [],
      restartCount: 0,
    };

    try {
      // Get server process ID
      const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
      serverData.pid = pid;

      // Monitor for 30 seconds
      const monitorInterval = setInterval(async () => {
        try {
          // Get memory usage
          const memInfo = execSync(`ps -p ${pid} -o rss=`, { encoding: 'utf8' }).trim();
          const memoryMB = parseInt(memInfo) / 1024;

          // Get CPU usage
          const cpuInfo = execSync(`ps -p ${pid} -o %cpu=`, { encoding: 'utf8' }).trim();
          const cpuPercent = parseFloat(cpuInfo);

          serverData.memoryUsage.push({
            timestamp: new Date().toISOString(),
            memory: memoryMB,
          });

          serverData.cpuUsage.push({
            timestamp: new Date().toISOString(),
            cpu: cpuPercent,
          });
        } catch (error) {
          // Server might have restarted
          serverData.restartCount++;
        }
      }, 2000);

      // Stop monitoring after 30 seconds
      setTimeout(() => {
        clearInterval(monitorInterval);

        // Calculate averages
        serverData.averageMemory =
          serverData.memoryUsage.length > 0
            ? serverData.memoryUsage.reduce((sum, m) => sum + m.memory, 0) /
              serverData.memoryUsage.length
            : 0;

        serverData.averageCpu =
          serverData.cpuUsage.length > 0
            ? serverData.cpuUsage.reduce((sum, c) => sum + c.cpu, 0) / serverData.cpuUsage.length
            : 0;

        monitoringData.servers[name] = serverData;
      }, 30000);
    } catch (error) {
      console.warn(`⚠️ Could not monitor ${name} server:`, error.message);
      serverData.error = error.message;
      monitoringData.servers[name] = serverData;
    }
  }

  async startOptimizedDevServers() {
    console.log('🚀 Starting optimized development servers...');

    const startTime = performance.now();

    // Set optimal Node.js options
    process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096';

    try {
      // Start servers with optimized settings
      const devProcess = spawn('pnpm', ['dev'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          VITE_OPTIMIZE_DEPS: 'true',
          CHOKIDAR_USEPOLLING: 'false', // Better file watching on some systems
          FORCE_COLOR: '1', // Better console output
        },
      });

      const endTime = performance.now();
      const startupTime = endTime - startTime;

      this.metrics.startupTimes.push({
        timestamp: new Date().toISOString(),
        duration: startupTime,
        optimized: true,
      });

      console.log(`✅ Development servers started in ${(startupTime / 1000).toFixed(2)}s`);

      return devProcess;
    } catch (error) {
      console.error('❌ Failed to start development servers:', error.message);
      throw error;
    }
  }

  async generateOptimizationReport(optimizations) {
    console.log('📋 Generating optimization report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalOptimizations: optimizations.length,
        highPriority: optimizations.filter(o => o.priority === 'high').length,
        mediumPriority: optimizations.filter(o => o.priority === 'medium').length,
        lowPriority: optimizations.filter(o => o.priority === 'low').length,
        alreadyOptimized: optimizations.filter(o => o.status === 'optimized').length,
      },
      optimizations,
      recommendations: this.generateGeneralRecommendations(),
    };

    // Save detailed report
    const reportPath = resolve(this.metricsDir, 'optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    await this.generateHtmlOptimizationReport(report);

    console.log(`📊 Optimization report: ${reportPath}`);
    return report;
  }

  generateGeneralRecommendations() {
    return [
      {
        category: 'General Performance',
        recommendations: [
          'Use SSD storage for better file I/O performance',
          'Increase available RAM for better caching',
          'Close unnecessary applications during development',
          'Use latest stable Node.js version',
          'Enable fast refresh for instant feedback',
        ],
      },
      {
        category: 'Development Workflow',
        recommendations: [
          'Use incremental builds when possible',
          'Implement smart file watching to avoid unnecessary rebuilds',
          'Use development proxies to avoid CORS issues',
          'Optimize IDE settings for better performance',
          'Use git hooks to run only necessary checks',
        ],
      },
      {
        category: 'Monitoring',
        recommendations: [
          'Set up development server health checks',
          'Monitor memory usage and restart if needed',
          'Track hot reload performance',
          'Monitor build times and optimize bottlenecks',
          'Set up alerts for development server failures',
        ],
      },
    ];
  }

  async generateHtmlOptimizationReport(report) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Development Server Optimization Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-card h3 { margin: 0 0 10px 0; color: #333; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .high-priority { color: #dc3545; }
        .medium-priority { color: #ffc107; }
        .low-priority { color: #28a745; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .optimization-item { background: #f8f9fa; margin: 15px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .optimization-item.high { border-left-color: #dc3545; }
        .optimization-item.medium { border-left-color: #ffc107; }
        .optimization-item.low { border-left-color: #28a745; }
        .suggestion { background: white; margin: 10px 0; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6; }
        .code { font-family: monospace; background: #f1f3f4; padding: 2px 4px; border-radius: 3px; }
        .recommendations { background: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Development Server Optimization Report</h1>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>Total Optimizations</h3>
                <div class="stat-value">${report.summary.totalOptimizations}</div>
            </div>
            <div class="stat-card">
                <h3>High Priority</h3>
                <div class="stat-value high-priority">${report.summary.highPriority}</div>
            </div>
            <div class="stat-card">
                <h3>Medium Priority</h3>
                <div class="stat-value medium-priority">${report.summary.mediumPriority}</div>
            </div>
            <div class="stat-card">
                <h3>Already Optimized</h3>
                <div class="stat-value">${report.summary.alreadyOptimized}</div>
            </div>
        </div>

        <div class="section">
            <h2>Optimization Details</h2>
            ${report.optimizations
              .map(
                opt => `
                <div class="optimization-item ${opt.priority}">
                    <h3>${opt.category} 
                        ${opt.priority === 'high' ? '🔴' : opt.priority === 'medium' ? '🟡' : '🟢'}
                        ${opt.status === 'optimized' ? '✅' : ''}
                    </h3>
                    ${opt.file ? `<p><strong>File:</strong> <code>${opt.file}</code></p>` : ''}
                    ${opt.message ? `<p>${opt.message}</p>` : ''}
                    ${
                      opt.suggestions
                        ? opt.suggestions
                            .map(
                              sug => `
                        <div class="suggestion">
                            <h4>${sug.type}</h4>
                            <p><strong>Issue:</strong> ${sug.issue}</p>
                            <p><strong>Fix:</strong> ${sug.fix}</p>
                            ${sug.code ? `<p><strong>Code:</strong> <code class="code">${sug.code}</code></p>` : ''}
                            ${sug.current ? `<p><strong>Current:</strong> <code class="code">${sug.current}</code></p>` : ''}
                            ${sug.recommended ? `<p><strong>Recommended:</strong> <code class="code">${sug.recommended}</code></p>` : ''}
                            ${sug.impact ? `<p><strong>Impact:</strong> ${sug.impact}</p>` : ''}
                        </div>
                    `
                            )
                            .join('')
                        : ''
                    }
                </div>
            `
              )
              .join('')}
        </div>

        <div class="section">
            <h2>General Recommendations</h2>
            ${report.recommendations
              .map(
                rec => `
                <div class="recommendations">
                    <h3>${rec.category}</h3>
                    <ul>
                        ${rec.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            `
              )
              .join('')}
        </div>
    </div>
</body>
</html>`;

    const htmlPath = resolve(this.metricsDir, 'optimization-report.html');
    fs.writeFileSync(htmlPath, htmlContent);

    console.log(`📊 HTML optimization report: ${htmlPath}`);
  }

  async generateMonitoringReport(data) {
    const reportPath = resolve(this.metricsDir, 'monitoring-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));

    console.log(`📊 Monitoring report: ${reportPath}`);
    return data;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new DevServerOptimizer();

  const command = process.argv[2] || 'optimize';

  switch (command) {
    case 'optimize':
      await optimizer.optimizeDevEnvironment();
      break;
    case 'monitor':
      await optimizer.monitorDevServers();
      break;
    case 'start':
      await optimizer.startOptimizedDevServers();
      break;
    default:
      console.log('Usage: node dev-server-optimizer.js [optimize|monitor|start]');
  }
}

export default DevServerOptimizer;
