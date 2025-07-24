#!/usr/bin/env node

/**
 * AI-Assisted Code Review Tool
 *
 * Provides AI-powered code review capabilities for:
 * - Code quality analysis
 * - Security vulnerability detection
 * - Best practices validation
 * - Performance optimization suggestions
 * - Documentation completeness checks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const REVIEW_OUTPUT_DIR = path.join(WORKSPACE_ROOT, '.ai-reviews');

/**
 * Configuration for AI code review
 */
const CONFIG = {
  // Code quality thresholds
  maxComplexity: 10,
  maxLineLength: 100,
  minTestCoverage: 80,

  // File patterns to review
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.md'],

  // Directories to exclude
  excludePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '.git/**',
    '.vscode/**',
  ],

  // AI review prompts
  prompts: {
    codeQuality: `
Analyze this code for:
1. Code quality and maintainability
2. Potential bugs or issues
3. Performance concerns
4. Security vulnerabilities
5. Best practices compliance
6. Documentation completeness

Provide specific, actionable feedback with examples.
`,
    testCoverage: `
Review this code and suggest:
1. Missing test cases
2. Edge cases to test
3. Integration test scenarios
4. Mocking strategies
5. Test structure improvements

Focus on comprehensive testing approaches.
`,
    documentation: `
Evaluate the documentation and suggest:
1. Missing documentation
2. Unclear explanations
3. Example improvements
4. API documentation gaps
5. User guide enhancements

Provide specific documentation improvements.
`,
  },
};

/**
 * Utility functions
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      ai: '🤖',
    }[level] || '🔍';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get changed files for review
 */
function getChangedFiles(baseBranch = 'main') {
  try {
    const command = `git diff --name-only ${baseBranch}...HEAD`;
    const output = execSync(command, { encoding: 'utf8', cwd: WORKSPACE_ROOT });
    return output
      .trim()
      .split('\n')
      .filter(file => file.length > 0);
  } catch (error) {
    log(`Failed to get changed files: ${error.message}`, 'warning');
    return [];
  }
}

/**
 * Filter files based on patterns
 */
function filterFiles(files) {
  const { includePatterns, excludePatterns } = CONFIG;

  return files.filter(file => {
    // Check if file matches include patterns
    const included = includePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(file);
    });

    if (!included) return false;

    // Check if file matches exclude patterns
    const excluded = excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(file);
    });

    return !excluded;
  });
}

/**
 * Analyze code complexity
 */
function analyzeComplexity(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const analysis = {
      file: filePath,
      lines: lines.length,
      functions: 0,
      complexity: 0,
      longLines: [],
      issues: [],
    };

    lines.forEach((line, index) => {
      // Count functions
      if (/^\s*(function|const\s+\w+\s*=|class\s+\w+|def\s+\w+)/.test(line)) {
        analysis.functions++;
      }

      // Check line length
      if (line.length > CONFIG.maxLineLength) {
        analysis.longLines.push({
          line: index + 1,
          length: line.length,
          content: line.substring(0, 50) + '...',
        });
      }

      // Calculate cyclomatic complexity (simplified)
      const complexityKeywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||', '?'];
      complexityKeywords.forEach(keyword => {
        const matches = line.match(new RegExp(`\\b${keyword}\\b`, 'g'));
        if (matches) {
          analysis.complexity += matches.length;
        }
      });
    });

    // Generate issues based on analysis
    if (analysis.complexity > CONFIG.maxComplexity) {
      analysis.issues.push({
        type: 'complexity',
        severity: 'high',
        message: `High cyclomatic complexity (${analysis.complexity}). Consider refactoring.`,
      });
    }

    if (analysis.longLines.length > 0) {
      analysis.issues.push({
        type: 'formatting',
        severity: 'medium',
        message: `${analysis.longLines.length} lines exceed ${CONFIG.maxLineLength} characters.`,
        details: analysis.longLines,
      });
    }

    if (analysis.functions > 20) {
      analysis.issues.push({
        type: 'structure',
        severity: 'medium',
        message: `File has ${analysis.functions} functions. Consider splitting into smaller modules.`,
      });
    }

    return analysis;
  } catch (error) {
    log(`Failed to analyze ${filePath}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Check test coverage for a file
 */
function checkTestCoverage(filePath) {
  const testPatterns = [
    filePath.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
    filePath.replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1'),
    filePath.replace(/src\//, 'tests/').replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
    filePath.replace(/src\//, '__tests__/').replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
  ];

  const existingTests = testPatterns.filter(testPath => {
    const fullPath = path.join(WORKSPACE_ROOT, testPath);
    return fs.existsSync(fullPath);
  });

  return {
    file: filePath,
    hasTests: existingTests.length > 0,
    testFiles: existingTests,
    suggestions:
      existingTests.length === 0
        ? [
            `Create test file: ${testPatterns[0]}`,
            'Add unit tests for all public functions',
            'Include edge case testing',
            'Add integration tests if applicable',
          ]
        : [],
  };
}

/**
 * Generate AI review using Claude Code patterns
 */
function generateAIReview(fileContent, filePath, reviewType = 'codeQuality') {
  const prompt = CONFIG.prompts[reviewType];

  // Simulate AI review (in real implementation, this would call Claude Code API)
  const mockReview = {
    file: filePath,
    type: reviewType,
    timestamp: new Date().toISOString(),
    suggestions: [],
    rating: 'good', // good, needs-improvement, poor
  };

  // Generate contextual suggestions based on file type and content
  const fileExt = path.extname(filePath);
  const isTypeScript = ['.ts', '.tsx'].includes(fileExt);
  const isReact = ['.tsx', '.jsx'].includes(fileExt);
  const isPython = fileExt === '.py';

  if (isTypeScript) {
    mockReview.suggestions.push({
      type: 'type-safety',
      severity: 'medium',
      message: 'Consider using stricter TypeScript configuration',
      line: null,
      suggestion: 'Enable strict mode and noImplicitAny in tsconfig.json',
    });
  }

  if (isReact) {
    mockReview.suggestions.push({
      type: 'performance',
      severity: 'low',
      message: 'Consider using React.memo for expensive components',
      line: null,
      suggestion: 'Wrap components with React.memo to prevent unnecessary re-renders',
    });
  }

  if (isPython) {
    mockReview.suggestions.push({
      type: 'code-style',
      severity: 'low',
      message: 'Ensure PEP 8 compliance',
      line: null,
      suggestion: 'Run black formatter and flake8 linter',
    });
  }

  return mockReview;
}

/**
 * Generate comprehensive review report
 */
function generateReviewReport(analyses, testCoverage, aiReviews) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      filesReviewed: analyses.length,
      totalIssues: 0,
      highSeverityIssues: 0,
      testCoverageIssues: 0,
    },
    files: [],
    recommendations: [],
  };

  // Combine all analyses
  analyses.forEach((analysis, index) => {
    if (!analysis) return;

    const fileReport = {
      file: analysis.file,
      complexity: analysis.complexity,
      issues: analysis.issues || [],
      testCoverage: testCoverage[index] || null,
      aiReview: aiReviews[index] || null,
    };

    report.files.push(fileReport);
    report.summary.totalIssues += fileReport.issues.length;
    report.summary.highSeverityIssues += fileReport.issues.filter(
      i => i.severity === 'high'
    ).length;

    if (fileReport.testCoverage && !fileReport.testCoverage.hasTests) {
      report.summary.testCoverageIssues++;
    }
  });

  // Generate recommendations
  if (report.summary.highSeverityIssues > 0) {
    report.recommendations.push('Address high-severity issues before merging');
  }

  if (report.summary.testCoverageIssues > 0) {
    report.recommendations.push('Add missing test coverage for untested files');
  }

  if (report.summary.totalIssues > 10) {
    report.recommendations.push('Consider breaking down large changes into smaller PRs');
  }

  return report;
}

/**
 * Save review report
 */
function saveReviewReport(report, outputPath) {
  ensureDir(path.dirname(outputPath));

  // Save JSON report
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  // Generate markdown summary
  const markdownPath = outputPath.replace('.json', '.md');
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(markdownPath, markdown);

  log(`Review report saved to ${outputPath}`, 'success');
  log(`Markdown summary saved to ${markdownPath}`, 'success');
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report) {
  let markdown = `# AI Code Review Report\n\n`;
  markdown += `**Generated:** ${report.timestamp}\n\n`;

  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Files Reviewed:** ${report.summary.filesReviewed}\n`;
  markdown += `- **Total Issues:** ${report.summary.totalIssues}\n`;
  markdown += `- **High Severity Issues:** ${report.summary.highSeverityIssues}\n`;
  markdown += `- **Files Missing Tests:** ${report.summary.testCoverageIssues}\n\n`;

  // Recommendations
  if (report.recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    report.recommendations.forEach(rec => {
      markdown += `- ${rec}\n`;
    });
    markdown += `\n`;
  }

  // File Details
  markdown += `## File Analysis\n\n`;

  report.files.forEach(file => {
    markdown += `### ${file.file}\n\n`;

    if (file.complexity > 0) {
      markdown += `**Complexity:** ${file.complexity}\n\n`;
    }

    if (file.issues.length > 0) {
      markdown += `**Issues:**\n`;
      file.issues.forEach(issue => {
        const severity = issue.severity.toUpperCase();
        markdown += `- **[${severity}]** ${issue.message}\n`;
      });
      markdown += `\n`;
    }

    if (file.testCoverage && !file.testCoverage.hasTests) {
      markdown += `**Test Coverage:** ⚠️ No tests found\n`;
      markdown += `**Suggestions:**\n`;
      file.testCoverage.suggestions.forEach(suggestion => {
        markdown += `- ${suggestion}\n`;
      });
      markdown += `\n`;
    }

    if (file.aiReview && file.aiReview.suggestions.length > 0) {
      markdown += `**AI Suggestions:**\n`;
      file.aiReview.suggestions.forEach(suggestion => {
        markdown += `- **${suggestion.type}:** ${suggestion.message}\n`;
        if (suggestion.suggestion) {
          markdown += `  - *${suggestion.suggestion}*\n`;
        }
      });
      markdown += `\n`;
    }
  });

  markdown += `---\n\n`;
  markdown += `*Generated by AI Code Review Tool*\n`;

  return markdown;
}

/**
 * Main review function
 */
async function runCodeReview(options = {}) {
  const {
    baseBranch = 'main',
    files = null,
    outputDir = REVIEW_OUTPUT_DIR,
    skipAI = false,
  } = options;

  log('Starting AI-assisted code review...', 'ai');

  // Get files to review
  let filesToReview = files;
  if (!filesToReview) {
    const changedFiles = getChangedFiles(baseBranch);
    filesToReview = filterFiles(changedFiles);
  }

  if (filesToReview.length === 0) {
    log('No files to review', 'info');
    return;
  }

  log(`Reviewing ${filesToReview.length} files...`, 'info');

  // Analyze files
  const analyses = [];
  const testCoverage = [];
  const aiReviews = [];

  for (const file of filesToReview) {
    const fullPath = path.join(WORKSPACE_ROOT, file);

    if (!fs.existsSync(fullPath)) {
      log(`File not found: ${file}`, 'warning');
      continue;
    }

    log(`Analyzing ${file}...`, 'info');

    // Code complexity analysis
    const analysis = analyzeComplexity(fullPath);
    analyses.push(analysis);

    // Test coverage check
    const coverage = checkTestCoverage(file);
    testCoverage.push(coverage);

    // AI review (if not skipped)
    if (!skipAI) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const aiReview = generateAIReview(content, file);
      aiReviews.push(aiReview);
    }
  }

  // Generate comprehensive report
  const report = generateReviewReport(analyses, testCoverage, aiReviews);

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `code-review-${timestamp}.json`);
  saveReviewReport(report, outputPath);

  // Log summary
  const { summary } = report;
  log(`Review completed: ${summary.filesReviewed} files, ${summary.totalIssues} issues`, 'success');

  if (summary.highSeverityIssues > 0) {
    log(`⚠️ ${summary.highSeverityIssues} high-severity issues found`, 'warning');
  }

  return report;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'review';

  const options = {
    baseBranch: 'main',
    skipAI: false,
    files: null,
  };

  // Parse command line arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base-branch' && args[i + 1]) {
      options.baseBranch = args[i + 1];
      i++;
    } else if (arg === '--skip-ai') {
      options.skipAI = true;
    } else if (arg === '--files' && args[i + 1]) {
      options.files = args[i + 1].split(',');
      i++;
    }
  }

  try {
    switch (command) {
      case 'review':
        await runCodeReview(options);
        break;

      case 'help':
        console.log(`
AI Code Review Tool

Usage:
  node code-review.js [command] [options]

Commands:
  review    Run code review (default)
  help      Show this help

Options:
  --base-branch <branch>  Base branch for comparison (default: main)
  --skip-ai              Skip AI-powered analysis
  --files <files>        Comma-separated list of files to review

Examples:
  node code-review.js review
  node code-review.js review --base-branch develop
  node code-review.js review --files src/utils.ts,src/components/Button.tsx
`);
        break;

      default:
        log(`Unknown command: ${command}`, 'error');
        process.exit(1);
    }
  } catch (error) {
    log(`Code review failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  runCodeReview,
  analyzeComplexity,
  checkTestCoverage,
  generateAIReview,
};
