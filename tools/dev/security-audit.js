#!/usr/bin/env node

/**
 * Security Audit Script
 *
 * This script performs comprehensive security auditing using pnpm audit,
 * provides detailed vulnerability analysis, and suggests remediation steps.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';
import minimist from 'minimist';
import chalk from 'chalk';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'help', 'fix', 'json', 'ci'],
  string: ['workspace-root', 'severity', 'output'],
  alias: {
    h: 'help',
    v: 'verbose',
    f: 'fix',
    w: 'workspace-root',
    s: 'severity',
    o: 'output',
    j: 'json',
    c: 'ci',
  },
  default: {
    'workspace-root': '..',
    severity: 'moderate',
  },
});

if (argv.help) {
  console.log(`
${chalk.blue('Security Audit Script')}

Usage: node security-audit.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -f, --fix               Attempt to fix vulnerabilities automatically
  -w, --workspace-root    Path to workspace root (default: ..)
  -s, --severity          Minimum severity level (low, moderate, high, critical)
  -o, --output           Output file for audit report
  -j, --json             Output in JSON format
  -c, --ci               CI mode (fail on vulnerabilities)

Examples:
  node security-audit.js --verbose
  node security-audit.js --fix --severity high
  node security-audit.js --output audit-report.json --json
  node security-audit.js --ci --severity moderate
`);
  process.exit(0);
}

const WORKSPACE_ROOT = resolve(argv['workspace-root']);
const VERBOSE = argv.verbose;
const FIX_ISSUES = argv.fix;
const MIN_SEVERITY = argv.severity;
const OUTPUT_FILE = argv.output;
const JSON_OUTPUT = argv.json;
const CI_MODE = argv.ci;

// Severity levels for filtering
const SEVERITY_LEVELS = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const MIN_SEVERITY_LEVEL = SEVERITY_LEVELS[MIN_SEVERITY] || 2;

/**
 * Execute a command with proper logging
 */
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    if (VERBOSE) {
      console.log(chalk.gray(`Executing: ${command} ${args.join(' ')}`));
    }

    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: options.cwd || process.cwd(),
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', data => {
      const output = data.toString();
      stdout += output;
      if (VERBOSE && !JSON_OUTPUT) {
        process.stdout.write(output);
      }
    });

    child.stderr?.on('data', data => {
      const output = data.toString();
      stderr += output;
      if (VERBOSE && !JSON_OUTPUT) {
        process.stderr.write(output);
      }
    });

    child.on('close', code => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Get package.json content for a given directory
 */
function getPackageJson(packagePath) {
  const packageJsonPath = join(packagePath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (VERBOSE) {
      console.warn(chalk.yellow(`Warning: Could not parse ${packageJsonPath}: ${error.message}`));
    }
    return null;
  }
}

/**
 * Find all workspace packages
 */
function findWorkspacePackages() {
  const workspaceConfigPath = join(WORKSPACE_ROOT, 'pnpm-workspace.yaml');
  let patterns = ['apps/*', 'packages/*', 'tools/*', 'infra/*'];

  if (existsSync(workspaceConfigPath)) {
    try {
      const workspaceConfig = readFileSync(workspaceConfigPath, 'utf8');
      const packagesMatch = workspaceConfig.match(/packages:\s*\n((?:\s*-\s*[^\n]+\n?)*)/);
      if (packagesMatch) {
        patterns = packagesMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.substring(1).trim().replace(/['"]/g, ''));
      }
    } catch (error) {
      if (VERBOSE) {
        console.warn(
          chalk.yellow(`Warning: Could not parse pnpm-workspace.yaml: ${error.message}`)
        );
      }
    }
  }

  const packages = [];

  for (const pattern of patterns) {
    const fullPattern = join(WORKSPACE_ROOT, pattern);
    try {
      const matches = glob.sync(fullPattern, { onlyDirectories: true });

      for (const match of matches) {
        const packageJson = getPackageJson(match);
        if (packageJson && packageJson.name) {
          packages.push({
            name: packageJson.name,
            path: match,
            packageJson,
          });
        }
      }
    } catch (error) {
      if (VERBOSE) {
        console.warn(chalk.yellow(`Warning: Error globbing pattern ${pattern}: ${error.message}`));
      }
    }
  }

  return packages;
}

/**
 * Run pnpm audit on workspace root
 */
async function runPnpmAudit() {
  if (!JSON_OUTPUT) {
    console.log(chalk.cyan('🔍 Running security audit...'));
  }

  try {
    const result = await execCommand('pnpm', ['audit', '--json'], {
      cwd: WORKSPACE_ROOT,
    });

    let auditData = null;

    if (result.stdout) {
      try {
        // pnpm audit outputs multiple JSON objects, we need to parse the last one
        const lines = result.stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        auditData = JSON.parse(lastLine);
      } catch (error) {
        if (VERBOSE) {
          console.warn(chalk.yellow(`Warning: Could not parse audit JSON: ${error.message}`));
        }

        // Fallback to running without --json
        const fallbackResult = await execCommand('pnpm', ['audit'], {
          cwd: WORKSPACE_ROOT,
        });

        return {
          success: fallbackResult.code === 0,
          vulnerabilities: [],
          summary: { total: 0 },
          rawOutput: fallbackResult.stdout,
        };
      }
    }

    if (auditData && auditData.vulnerabilities) {
      // Filter by severity level
      const filteredVulns = auditData.vulnerabilities.filter(vuln => {
        const severity = vuln.severity || 'low';
        return SEVERITY_LEVELS[severity] >= MIN_SEVERITY_LEVEL;
      });

      return {
        success: result.code === 0,
        vulnerabilities: filteredVulns,
        summary: auditData.metadata || { total: filteredVulns.length },
        rawOutput: result.stdout,
      };
    }

    return {
      success: result.code === 0,
      vulnerabilities: [],
      summary: { total: 0 },
      rawOutput: result.stdout,
    };
  } catch (error) {
    if (!JSON_OUTPUT) {
      console.error(chalk.red(`Error running pnpm audit: ${error.message}`));
    }

    return {
      success: false,
      vulnerabilities: [],
      summary: { total: 0 },
      error: error.message,
    };
  }
}

/**
 * Analyze vulnerability impact
 */
function analyzeVulnerabilityImpact(vulnerabilities, packages) {
  const impactAnalysis = {
    byPackage: new Map(),
    bySeverity: { low: 0, moderate: 0, high: 0, critical: 0 },
    byType: new Map(),
    recommendations: [],
  };

  for (const vuln of vulnerabilities) {
    // Count by severity
    const severity = vuln.severity || 'low';
    if (impactAnalysis.bySeverity[severity] !== undefined) {
      impactAnalysis.bySeverity[severity]++;
    }

    // Count by vulnerability type
    const type = vuln.cwe || vuln.title || 'Unknown';
    impactAnalysis.byType.set(type, (impactAnalysis.byType.get(type) || 0) + 1);

    // Analyze package impact
    if (vuln.via && Array.isArray(vuln.via)) {
      for (const via of vuln.via) {
        if (typeof via === 'string') {
          const packageName = via;
          if (!impactAnalysis.byPackage.has(packageName)) {
            impactAnalysis.byPackage.set(packageName, []);
          }
          impactAnalysis.byPackage.get(packageName).push(vuln);
        }
      }
    }
  }

  // Generate recommendations
  if (impactAnalysis.bySeverity.critical > 0) {
    impactAnalysis.recommendations.push({
      priority: 'critical',
      action: 'Immediate action required: Update or remove packages with critical vulnerabilities',
      count: impactAnalysis.bySeverity.critical,
    });
  }

  if (impactAnalysis.bySeverity.high > 0) {
    impactAnalysis.recommendations.push({
      priority: 'high',
      action: 'Update packages with high severity vulnerabilities within 24 hours',
      count: impactAnalysis.bySeverity.high,
    });
  }

  if (impactAnalysis.bySeverity.moderate > 0) {
    impactAnalysis.recommendations.push({
      priority: 'moderate',
      action: 'Schedule updates for moderate severity vulnerabilities within a week',
      count: impactAnalysis.bySeverity.moderate,
    });
  }

  return impactAnalysis;
}

/**
 * Attempt to fix vulnerabilities
 */
async function attemptVulnerabilityFixes() {
  if (!JSON_OUTPUT) {
    console.log(chalk.yellow('🔧 Attempting to fix vulnerabilities...'));
  }

  const fixes = [];

  try {
    // Try pnpm audit --fix
    const fixResult = await execCommand('pnpm', ['audit', '--fix'], {
      cwd: WORKSPACE_ROOT,
    });

    if (fixResult.code === 0) {
      fixes.push({
        method: 'pnpm audit --fix',
        success: true,
        output: fixResult.stdout,
      });
    } else {
      fixes.push({
        method: 'pnpm audit --fix',
        success: false,
        error: fixResult.stderr,
      });
    }

    // Try updating outdated packages
    const updateResult = await execCommand('pnpm', ['update'], {
      cwd: WORKSPACE_ROOT,
    });

    if (updateResult.code === 0) {
      fixes.push({
        method: 'pnpm update',
        success: true,
        output: updateResult.stdout,
      });
    } else {
      fixes.push({
        method: 'pnpm update',
        success: false,
        error: updateResult.stderr,
      });
    }
  } catch (error) {
    fixes.push({
      method: 'automated fix',
      success: false,
      error: error.message,
    });
  }

  return fixes;
}

/**
 * Check for outdated dependencies
 */
async function checkOutdatedDependencies() {
  if (!JSON_OUTPUT) {
    console.log(chalk.cyan('📦 Checking for outdated dependencies...'));
  }

  try {
    const result = await execCommand('pnpm', ['outdated', '--format', 'json'], {
      cwd: WORKSPACE_ROOT,
    });

    let outdatedData = null;

    if (result.stdout) {
      try {
        outdatedData = JSON.parse(result.stdout);
      } catch (error) {
        // Fallback to regular outdated command
        const fallbackResult = await execCommand('pnpm', ['outdated'], {
          cwd: WORKSPACE_ROOT,
        });

        return {
          success: true,
          outdated: [],
          rawOutput: fallbackResult.stdout,
        };
      }
    }

    return {
      success: true,
      outdated: outdatedData || [],
      rawOutput: result.stdout,
    };
  } catch (error) {
    return {
      success: false,
      outdated: [],
      error: error.message,
    };
  }
}

/**
 * Generate security report
 */
function generateSecurityReport(auditResult, impactAnalysis, packages, outdated, fixes) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPackages: packages.length,
      totalVulnerabilities: auditResult.vulnerabilities.length,
      severityBreakdown: impactAnalysis.bySeverity,
      outdatedPackages: outdated.length,
      fixesAttempted: fixes.length,
    },
    vulnerabilities: auditResult.vulnerabilities,
    impactAnalysis,
    outdatedDependencies: outdated,
    fixes,
    recommendations: impactAnalysis.recommendations,
    workspace: {
      root: WORKSPACE_ROOT,
      packages: packages.map(pkg => ({
        name: pkg.name,
        path: pkg.path,
      })),
    },
  };

  return report;
}

/**
 * Output report in specified format
 */
function outputReport(report) {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.blue('🛡️  Security Audit Report'));
  console.log(chalk.gray(`Generated: ${report.timestamp}`));
  console.log();

  // Summary
  console.log(chalk.cyan('📊 Summary'));
  console.log(`Total packages: ${chalk.white(report.summary.totalPackages)}`);
  console.log(`Total vulnerabilities: ${chalk.white(report.summary.totalVulnerabilities)}`);
  console.log(`Outdated packages: ${chalk.white(report.summary.outdatedPackages)}`);
  console.log();

  // Severity breakdown
  if (report.summary.totalVulnerabilities > 0) {
    console.log(chalk.cyan('⚠️  Vulnerabilities by Severity'));
    const severity = report.summary.severityBreakdown;
    if (severity.critical > 0) console.log(`Critical: ${chalk.red(severity.critical)}`);
    if (severity.high > 0) console.log(`High: ${chalk.red(severity.high)}`);
    if (severity.moderate > 0) console.log(`Moderate: ${chalk.yellow(severity.moderate)}`);
    if (severity.low > 0) console.log(`Low: ${chalk.blue(severity.low)}`);
    console.log();
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log(chalk.cyan('💡 Recommendations'));
    for (const rec of report.recommendations) {
      const color =
        rec.priority === 'critical'
          ? chalk.red
          : rec.priority === 'high'
            ? chalk.red
            : rec.priority === 'moderate'
              ? chalk.yellow
              : chalk.blue;

      console.log(`${color('●')} ${rec.action} (${rec.count} issues)`);
    }
    console.log();
  }

  // Vulnerability details
  if (report.vulnerabilities.length > 0 && VERBOSE) {
    console.log(chalk.cyan('🔍 Vulnerability Details'));
    for (const vuln of report.vulnerabilities.slice(0, 10)) {
      // Show first 10
      const severityColor =
        vuln.severity === 'critical'
          ? chalk.red
          : vuln.severity === 'high'
            ? chalk.red
            : vuln.severity === 'moderate'
              ? chalk.yellow
              : chalk.blue;

      console.log(`${severityColor('●')} ${vuln.title || vuln.name}`);
      if (vuln.url) console.log(`  ${chalk.gray(vuln.url)}`);
      if (vuln.range) console.log(`  ${chalk.gray(`Affected: ${vuln.range}`)}`);
    }

    if (report.vulnerabilities.length > 10) {
      console.log(chalk.gray(`... and ${report.vulnerabilities.length - 10} more`));
    }
    console.log();
  }

  // Fixes attempted
  if (report.fixes.length > 0) {
    console.log(chalk.cyan('🔧 Fix Attempts'));
    for (const fix of report.fixes) {
      const status = fix.success ? chalk.green('✅') : chalk.red('❌');
      console.log(`${status} ${fix.method}`);
      if (!fix.success && fix.error && VERBOSE) {
        console.log(`  ${chalk.gray(fix.error)}`);
      }
    }
    console.log();
  }

  // Overall status
  const hasHighSeverity =
    report.summary.severityBreakdown.critical > 0 || report.summary.severityBreakdown.high > 0;

  if (report.summary.totalVulnerabilities === 0) {
    console.log(chalk.green('✅ No security vulnerabilities found!'));
  } else if (hasHighSeverity) {
    console.log(chalk.red('❌ High or critical vulnerabilities found! Immediate action required.'));
  } else {
    console.log(chalk.yellow('⚠️  Vulnerabilities found. Review and address when possible.'));
  }
}

/**
 * Save report to file
 */
function saveReport(report, filename) {
  try {
    const content = JSON_OUTPUT
      ? JSON.stringify(report, null, 2)
      : `# Security Audit Report\n\nGenerated: ${report.timestamp}\n\n${JSON.stringify(report, null, 2)}`;

    writeFileSync(filename, content);

    if (!JSON_OUTPUT) {
      console.log(chalk.green(`Report saved to: ${filename}`));
    }
  } catch (error) {
    if (!JSON_OUTPUT) {
      console.error(chalk.red(`Error saving report: ${error.message}`));
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    if (!JSON_OUTPUT) {
      console.log(chalk.blue('🛡️  Security Audit & Dependency Management'));
      console.log();
    }

    const packages = findWorkspacePackages();

    if (!JSON_OUTPUT) {
      console.log(chalk.blue(`Found ${packages.length} packages to audit`));
      console.log();
    }

    // Run security audit
    const auditResult = await runPnpmAudit();

    // Analyze vulnerability impact
    const impactAnalysis = analyzeVulnerabilityImpact(auditResult.vulnerabilities, packages);

    // Check outdated dependencies
    const outdatedResult = await checkOutdatedDependencies();

    // Attempt fixes if requested
    let fixes = [];
    if (FIX_ISSUES) {
      fixes = await attemptVulnerabilityFixes();
    }

    // Generate comprehensive report
    const report = generateSecurityReport(
      auditResult,
      impactAnalysis,
      packages,
      outdatedResult.outdated,
      fixes
    );

    // Output report
    outputReport(report);

    // Save to file if requested
    if (OUTPUT_FILE) {
      saveReport(report, OUTPUT_FILE);
    }

    // Exit with appropriate code for CI mode
    if (CI_MODE) {
      const hasHighSeverity =
        report.summary.severityBreakdown.critical > 0 || report.summary.severityBreakdown.high > 0;

      if (hasHighSeverity) {
        process.exit(1);
      }
    }

    console.log();
  } catch (error) {
    if (JSON_OUTPUT) {
      console.error(JSON.stringify({ error: error.message }));
    } else {
      console.error(chalk.red('❌ Security audit failed:'), error.message);
    }
    process.exit(1);
  }
}

main();
