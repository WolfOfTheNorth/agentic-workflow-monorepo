// =============================================================================
// Bundle Analyzer Tool
// Analyzes frontend bundle sizes and provides optimization insights
// =============================================================================

import { rollup } from 'rollup';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

class BundleAnalyzer {
  constructor() {
    this.outputDir = resolve('./performance-reports');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async analyzeFrontend() {
    console.log('🔍 Analyzing frontend bundle...');

    try {
      // Build the frontend first
      console.log('📦 Building frontend for analysis...');
      execSync('pnpm --filter @agentic-workflow/frontend build', {
        stdio: 'inherit',
        cwd: resolve('./'),
      });

      // Run bundle analysis using Vite's built-in stats
      const frontendPath = resolve('./apps/frontend');
      const distPath = resolve(frontendPath, 'dist');

      if (fs.existsSync(distPath)) {
        // Generate visualization report
        await this.generateVisualization(distPath);

        // Generate bundle size report
        await this.generateSizeReport(distPath);

        // Generate optimization recommendations
        await this.generateOptimizationReport(distPath);

        console.log('✅ Frontend bundle analysis complete!');
        console.log(`📊 Reports generated in: ${this.outputDir}`);
      } else {
        throw new Error('Frontend build directory not found');
      }
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      throw error;
    }
  }

  async generateVisualization(distPath) {
    console.log('📈 Generating bundle visualization...');

    // Create a simple visualization of the bundle contents
    const stats = await this.getBundleStats(distPath);
    const htmlReport = this.createHtmlReport(stats);

    const reportPath = resolve(this.outputDir, 'bundle-visualization.html');
    fs.writeFileSync(reportPath, htmlReport);

    console.log(`📊 Bundle visualization: ${reportPath}`);
  }

  async getBundleStats(distPath) {
    const stats = {
      totalSize: 0,
      files: [],
      assets: {
        js: [],
        css: [],
        images: [],
        other: [],
      },
    };

    const walkDir = (dir, relativePath = '') => {
      const files = fs.readdirSync(dir);

      files.forEach(file => {
        const fullPath = resolve(dir, file);
        const fileRelativePath = resolve(relativePath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath, fileRelativePath);
        } else {
          const fileInfo = {
            path: fileRelativePath,
            size: stat.size,
            sizeKb: (stat.size / 1024).toFixed(2),
            sizeMb: (stat.size / 1024 / 1024).toFixed(2),
          };

          stats.totalSize += stat.size;
          stats.files.push(fileInfo);

          // Categorize by file type
          const ext = file.split('.').pop().toLowerCase();
          if (['js', 'mjs'].includes(ext)) {
            stats.assets.js.push(fileInfo);
          } else if (['css'].includes(ext)) {
            stats.assets.css.push(fileInfo);
          } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
            stats.assets.images.push(fileInfo);
          } else {
            stats.assets.other.push(fileInfo);
          }
        }
      });
    };

    walkDir(distPath);

    // Sort files by size (largest first)
    stats.files.sort((a, b) => b.size - a.size);
    Object.keys(stats.assets).forEach(key => {
      stats.assets[key].sort((a, b) => b.size - a.size);
    });

    stats.totalSizeKb = (stats.totalSize / 1024).toFixed(2);
    stats.totalSizeMb = (stats.totalSize / 1024 / 1024).toFixed(2);

    return stats;
  }

  createHtmlReport(stats) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bundle Analysis Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-card h3 { margin: 0 0 10px 0; color: #333; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .file-list { background: #f8f9fa; border-radius: 6px; overflow: hidden; }
        .file-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #dee2e6; }
        .file-item:last-child { border-bottom: none; }
        .file-path { font-family: monospace; flex-grow: 1; }
        .file-size { font-weight: bold; }
        .size-large { color: #dc3545; }
        .size-medium { color: #ffc107; }
        .size-small { color: #28a745; }
        .recommendations { background: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .chart { height: 300px; margin: 20px 0; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bundle Analysis Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>Total Bundle Size</h3>
                <div class="stat-value">${stats.totalSizeMb} MB</div>
                <small>${stats.totalSizeKb} KB</small>
            </div>
            <div class="stat-card">
                <h3>Total Files</h3>
                <div class="stat-value">${stats.files.length}</div>
            </div>
            <div class="stat-card">
                <h3>JavaScript Files</h3>
                <div class="stat-value">${stats.assets.js.length}</div>
            </div>
            <div class="stat-card">
                <h3>CSS Files</h3>
                <div class="stat-value">${stats.assets.css.length}</div>
            </div>
        </div>

        <div class="section">
            <h2>Asset Size Distribution</h2>
            <canvas id="assetChart" class="chart"></canvas>
        </div>

        <div class="section">
            <h2>Largest Files</h2>
            <div class="file-list">
                ${stats.files
                  .slice(0, 10)
                  .map(
                    file => `
                    <div class="file-item">
                        <span class="file-path">${file.path}</span>
                        <span class="file-size ${this.getSizeClass(file.size)}">${file.sizeKb} KB</span>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>

        <div class="section">
            <h2>JavaScript Files</h2>
            <div class="file-list">
                ${stats.assets.js
                  .map(
                    file => `
                    <div class="file-item">
                        <span class="file-path">${file.path}</span>
                        <span class="file-size ${this.getSizeClass(file.size)}">${file.sizeKb} KB</span>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>

        <div class="section">
            <h2>CSS Files</h2>
            <div class="file-list">
                ${stats.assets.css
                  .map(
                    file => `
                    <div class="file-item">
                        <span class="file-path">${file.path}</span>
                        <span class="file-size ${this.getSizeClass(file.size)}">${file.sizeKb} KB</span>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>

        ${this.generateRecommendations(stats)}
    </div>

    <script>
        // Asset distribution chart
        const ctx = document.getElementById('assetChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['JavaScript', 'CSS', 'Images', 'Other'],
                datasets: [{
                    data: [
                        ${stats.assets.js.reduce((sum, file) => sum + file.size, 0)},
                        ${stats.assets.css.reduce((sum, file) => sum + file.size, 0)},
                        ${stats.assets.images.reduce((sum, file) => sum + file.size, 0)},
                        ${stats.assets.other.reduce((sum, file) => sum + file.size, 0)}
                    ],
                    backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }

  getSizeClass(size) {
    if (size > 1024 * 1024) return 'size-large'; // > 1MB
    if (size > 100 * 1024) return 'size-medium'; // > 100KB
    return 'size-small';
  }

  generateRecommendations(stats) {
    const recommendations = [];

    // Check for large JavaScript files
    const largeJsFiles = stats.assets.js.filter(file => file.size > 500 * 1024);
    if (largeJsFiles.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Large JavaScript Files Detected',
        message: `Found ${largeJsFiles.length} JavaScript files larger than 500KB. Consider code splitting or lazy loading.`,
        files: largeJsFiles.slice(0, 3),
      });
    }

    // Check total bundle size
    if (stats.totalSize > 5 * 1024 * 1024) {
      recommendations.push({
        type: 'warning',
        title: 'Large Bundle Size',
        message: 'Total bundle size exceeds 5MB. This may impact loading performance.',
        suggestion:
          'Consider implementing code splitting, tree shaking, and removing unused dependencies.',
      });
    }

    // Check for optimization opportunities
    recommendations.push({
      type: 'info',
      title: 'Optimization Suggestions',
      message: 'Ways to optimize your bundle:',
      suggestions: [
        'Enable gzip/brotli compression',
        'Implement code splitting for routes',
        'Use dynamic imports for large libraries',
        'Remove unused CSS and JavaScript',
        'Optimize images and use modern formats (WebP, AVIF)',
        'Consider using a CDN for static assets',
      ],
    });

    return recommendations
      .map(
        rec => `
      <div class="${rec.type === 'warning' ? 'warning' : 'recommendations'}">
        <h3>${rec.title}</h3>
        <p>${rec.message}</p>
        ${rec.files ? `<ul>${rec.files.map(file => `<li><code>${file.path}</code> (${file.sizeKb} KB)</li>`).join('')}</ul>` : ''}
        ${rec.suggestions ? `<ul>${rec.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        ${rec.suggestion ? `<p><strong>Recommendation:</strong> ${rec.suggestion}</p>` : ''}
      </div>
    `
      )
      .join('');
  }

  async generateSizeReport(distPath) {
    console.log('📋 Generating size report...');

    const stats = await this.getBundleStats(distPath);
    const report = {
      timestamp: new Date().toISOString(),
      totalSize: stats.totalSize,
      totalSizeFormatted: `${stats.totalSizeMb} MB`,
      fileCount: stats.files.length,
      breakdown: {
        javascript: {
          files: stats.assets.js.length,
          totalSize: stats.assets.js.reduce((sum, file) => sum + file.size, 0),
        },
        css: {
          files: stats.assets.css.length,
          totalSize: stats.assets.css.reduce((sum, file) => sum + file.size, 0),
        },
        images: {
          files: stats.assets.images.length,
          totalSize: stats.assets.images.reduce((sum, file) => sum + file.size, 0),
        },
        other: {
          files: stats.assets.other.length,
          totalSize: stats.assets.other.reduce((sum, file) => sum + file.size, 0),
        },
      },
      largestFiles: stats.files.slice(0, 10),
    };

    const reportPath = resolve(this.outputDir, 'bundle-size-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Size report: ${reportPath}`);
    return report;
  }

  async generateOptimizationReport(distPath) {
    console.log('🚀 Generating optimization recommendations...');

    const stats = await this.getBundleStats(distPath);
    const optimizations = [];

    // Analyze for code splitting opportunities
    const largeJsFiles = stats.assets.js.filter(file => file.size > 300 * 1024);
    if (largeJsFiles.length > 0) {
      optimizations.push({
        category: 'Code Splitting',
        priority: 'high',
        impact: 'large',
        description: 'Large JavaScript files detected that could benefit from code splitting',
        files: largeJsFiles,
        recommendations: [
          'Implement route-based code splitting',
          'Use dynamic imports for large libraries',
          'Split vendor bundles from application code',
        ],
      });
    }

    // Check for unused assets
    optimizations.push({
      category: 'Asset Optimization',
      priority: 'medium',
      impact: 'medium',
      description: 'General asset optimization recommendations',
      recommendations: [
        'Enable tree shaking to remove unused code',
        'Minify CSS and JavaScript files',
        'Optimize images and convert to modern formats',
        'Use compression (gzip/brotli) on the server',
      ],
    });

    // Performance budget check
    if (stats.totalSize > 2 * 1024 * 1024) {
      optimizations.push({
        category: 'Performance Budget',
        priority: 'high',
        impact: 'large',
        description: `Bundle size (${stats.totalSizeMb} MB) exceeds recommended 2MB limit`,
        recommendations: [
          'Set up performance budgets in build process',
          'Monitor bundle size changes in CI/CD',
          'Consider lazy loading non-critical features',
        ],
      });
    }

    const reportPath = resolve(this.outputDir, 'optimization-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          bundleStats: {
            totalSize: stats.totalSize,
            totalSizeFormatted: stats.totalSizeMb + ' MB',
            fileCount: stats.files.length,
          },
          optimizations,
        },
        null,
        2
      )
    );

    console.log(`🚀 Optimization report: ${reportPath}`);
    return optimizations;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new BundleAnalyzer();

  const command = process.argv[2] || 'analyze';

  switch (command) {
    case 'analyze':
    case 'frontend':
      await analyzer.analyzeFrontend();
      break;
    default:
      console.log('Usage: node bundle-analyzer.js [analyze|frontend]');
  }
}

export default BundleAnalyzer;
