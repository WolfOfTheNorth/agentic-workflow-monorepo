#!/usr/bin/env node

/**
 * Dependency Validation and Conflict Resolution Script
 *
 * This script validates dependencies across the monorepo, detects conflicts,
 * and provides automated resolution strategies.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, join, relative } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';
import minimist from 'minimist';
import chalk from 'chalk';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'help', 'fix', 'dry-run', 'check-outdated'],
  string: ['workspace-root', 'output'],
  alias: {
    h: 'help',
    v: 'verbose',
    f: 'fix',
    d: 'dry-run',
    w: 'workspace-root',
    o: 'output',
    c: 'check-outdated',
  },
  default: {
    'workspace-root': '..',
  },
});

if (argv.help) {
  console.log(`
${chalk.blue('Dependency Validation & Conflict Resolution')}

Usage: node dependency-validator.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -f, --fix               Attempt to fix dependency conflicts automatically
  -d, --dry-run           Show what would be changed without making changes
  -w, --workspace-root    Path to workspace root (default: ..)
  -o, --output           Output file for validation report
  -c, --check-outdated   Check for outdated dependencies

Examples:
  node dependency-validator.js --verbose
  node dependency-validator.js --fix --dry-run
  node dependency-validator.js --check-outdated --output report.json
`);
  process.exit(0);
}

const WORKSPACE_ROOT = resolve(argv['workspace-root']);
const VERBOSE = argv.verbose;
const FIX_ISSUES = argv.fix;
const DRY_RUN = argv['dry-run'];
const CHECK_OUTDATED = argv['check-outdated'];
const OUTPUT_FILE = argv.output;

// Track validation results
const validationResults = {
  versionConflicts: [],
  duplicateDependencies: [],
  peerDependencyIssues: [],
  outdatedPackages: [],
  recommendations: [],
  workspaceIntegrity: { passed: 0, failed: 0, issues: [] },
};

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
    });

    child.stderr?.on('data', data => {
      const output = data.toString();
      stderr += output;
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
            relativePath: relative(WORKSPACE_ROOT, match),
            packageJson,
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            peerDependencies: packageJson.peerDependencies || {},
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
 * Parse semantic version
 */
function parseVersion(versionString) {
  // Remove semver prefixes and parse
  const cleanVersion = versionString.replace(/^[\^~>=<]/, '');
  const [major, minor = '0', patch = '0'] = cleanVersion.split('.');

  return {
    original: versionString,
    major: parseInt(major) || 0,
    minor: parseInt(minor) || 0,
    patch: parseInt(patch) || 0,
    prefix: versionString.match(/^[\^~>=<]/)?.[0] || '',
  };
}

/**
 * Compare versions
 */
function compareVersions(v1, v2) {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);

  if (version1.major !== version2.major) {
    return version1.major - version2.major;
  }
  if (version1.minor !== version2.minor) {
    return version1.minor - version2.minor;
  }
  return version1.patch - version2.patch;
}

/**
 * Detect version conflicts
 */
function detectVersionConflicts(packages) {
  console.log(chalk.cyan('🔍 Detecting version conflicts...'));

  const dependencyVersions = new Map();

  // Collect all dependencies and their versions
  for (const pkg of packages) {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const [depName, version] of Object.entries(allDeps)) {
      if (!dependencyVersions.has(depName)) {
        dependencyVersions.set(depName, []);
      }

      dependencyVersions.get(depName).push({
        package: pkg.name,
        version,
        type: pkg.dependencies[depName] ? 'dependency' : 'devDependency',
        path: pkg.relativePath,
      });
    }
  }

  // Find conflicts
  for (const [depName, usages] of dependencyVersions) {
    if (usages.length > 1) {
      const versions = [...new Set(usages.map(u => u.version))];

      if (versions.length > 1) {
        // Check if versions are actually conflicting (not just different prefixes)
        const parsedVersions = versions.map(v => parseVersion(v));
        const hasMajorDifference = parsedVersions.some(v1 =>
          parsedVersions.some(v2 => v1.major !== v2.major)
        );

        if (hasMajorDifference || versions.some(v => v.startsWith('workspace:'))) {
          validationResults.versionConflicts.push({
            dependency: depName,
            versions,
            usages,
            severity: hasMajorDifference ? 'high' : 'medium',
            recommendation: generateConflictRecommendation(depName, usages, versions),
          });
        }
      }
    }
  }

  if (VERBOSE) {
    console.log(`Found ${validationResults.versionConflicts.length} version conflicts`);
  }
}

/**
 * Generate conflict resolution recommendation
 */
function generateConflictRecommendation(depName, usages, versions) {
  const hasWorkspaceVersion = versions.some(v => v.startsWith('workspace:'));

  if (hasWorkspaceVersion) {
    return {
      action: 'use_workspace',
      reason: 'Workspace packages should use workspace: protocol',
      target: 'workspace:*',
    };
  }

  // Find the highest version
  const sortedVersions = versions.sort((a, b) => compareVersions(b, a));
  const recommendedVersion = sortedVersions[0];

  return {
    action: 'align_versions',
    reason: 'Align all packages to use the same version to avoid conflicts',
    target: recommendedVersion,
  };
}

/**
 * Detect duplicate dependencies
 */
function detectDuplicateDependencies(packages) {
  console.log(chalk.cyan('🔍 Detecting duplicate dependencies...'));

  const allDependencies = new Map();

  for (const pkg of packages) {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const [depName, version] of Object.entries(allDeps)) {
      if (!allDependencies.has(depName)) {
        allDependencies.set(depName, []);
      }

      allDependencies.get(depName).push({
        package: pkg.name,
        version,
        path: pkg.relativePath,
      });
    }
  }

  // Find dependencies that could be hoisted to root
  for (const [depName, usages] of allDependencies) {
    if (usages.length >= 3) {
      // Used in 3+ packages
      const versions = [...new Set(usages.map(u => u.version))];

      if (versions.length === 1) {
        validationResults.duplicateDependencies.push({
          dependency: depName,
          version: versions[0],
          usages,
          recommendation: {
            action: 'hoist_to_root',
            reason: `Used in ${usages.length} packages with same version, consider hoisting to root`,
            target: 'root',
          },
        });
      }
    }
  }

  if (VERBOSE) {
    console.log(
      `Found ${validationResults.duplicateDependencies.length} potential hoisting opportunities`
    );
  }
}

/**
 * Check peer dependency issues
 */
function checkPeerDependencies(packages) {
  console.log(chalk.cyan('🔍 Checking peer dependencies...'));

  for (const pkg of packages) {
    const peerDeps = pkg.peerDependencies;
    const regularDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [peerName, peerVersion] of Object.entries(peerDeps)) {
      // Check if peer dependency is satisfied
      if (!regularDeps[peerName]) {
        // Check if it's available in the workspace
        const workspacePkg = packages.find(p => p.name === peerName);

        if (!workspacePkg) {
          validationResults.peerDependencyIssues.push({
            package: pkg.name,
            peerDependency: peerName,
            requiredVersion: peerVersion,
            issue: 'missing',
            recommendation: {
              action: 'install_peer',
              reason: `Install missing peer dependency ${peerName}@${peerVersion}`,
              target: peerVersion,
            },
          });
        }
      } else {
        // Check version compatibility
        const installedVersion = regularDeps[peerName];

        // Simple version check (could be enhanced)
        if (installedVersion !== peerVersion && !installedVersion.startsWith('workspace:')) {
          const compatible = checkVersionCompatibility(installedVersion, peerVersion);

          if (!compatible) {
            validationResults.peerDependencyIssues.push({
              package: pkg.name,
              peerDependency: peerName,
              requiredVersion: peerVersion,
              installedVersion,
              issue: 'version_mismatch',
              recommendation: {
                action: 'update_version',
                reason: `Update ${peerName} to satisfy peer dependency requirement`,
                target: peerVersion,
              },
            });
          }
        }
      }
    }
  }

  if (VERBOSE) {
    console.log(`Found ${validationResults.peerDependencyIssues.length} peer dependency issues`);
  }
}

/**
 * Check version compatibility (simplified)
 */
function checkVersionCompatibility(installed, required) {
  // This is a simplified check - could be enhanced with proper semver logic
  const installedParsed = parseVersion(installed);
  const requiredParsed = parseVersion(required);

  // If required has ^ prefix, check major version compatibility
  if (required.startsWith('^')) {
    return installedParsed.major === requiredParsed.major;
  }

  // If required has ~ prefix, check major.minor compatibility
  if (required.startsWith('~')) {
    return (
      installedParsed.major === requiredParsed.major &&
      installedParsed.minor === requiredParsed.minor
    );
  }

  // Exact match for others
  return installed === required;
}

/**
 * Check for outdated dependencies
 */
async function checkOutdated() {
  if (!CHECK_OUTDATED) return;

  console.log(chalk.cyan('📦 Checking for outdated dependencies...'));

  try {
    const result = await execCommand('pnpm', ['outdated', '--format', 'json'], {
      cwd: WORKSPACE_ROOT,
    });

    if (result.stdout) {
      try {
        const outdatedData = JSON.parse(result.stdout);
        validationResults.outdatedPackages = Object.entries(outdatedData).map(([name, info]) => ({
          name,
          current: info.current,
          wanted: info.wanted,
          latest: info.latest,
          type: info.dependencyType || 'unknown',
        }));
      } catch (error) {
        if (VERBOSE) {
          console.warn(chalk.yellow(`Could not parse outdated JSON: ${error.message}`));
        }
      }
    }
  } catch (error) {
    if (VERBOSE) {
      console.warn(chalk.yellow(`Could not check outdated dependencies: ${error.message}`));
    }
  }

  if (VERBOSE) {
    console.log(`Found ${validationResults.outdatedPackages.length} outdated packages`);
  }
}

/**
 * Apply automatic fixes
 */
async function applyFixes(packages) {
  if (!FIX_ISSUES) return;

  console.log(chalk.yellow('🔧 Applying automatic fixes...'));

  const fixResults = [];

  // Fix version conflicts
  for (const conflict of validationResults.versionConflicts) {
    if (conflict.recommendation.action === 'align_versions') {
      const targetVersion = conflict.recommendation.target;

      for (const usage of conflict.usages) {
        if (usage.version !== targetVersion) {
          const pkg = packages.find(p => p.name === usage.package);
          if (pkg) {
            if (DRY_RUN) {
              console.log(
                chalk.gray(
                  `Would update ${usage.package}: ${conflict.dependency}@${usage.version} → ${targetVersion}`
                )
              );
            } else {
              // Update package.json
              if (usage.type === 'dependency') {
                pkg.packageJson.dependencies[conflict.dependency] = targetVersion;
              } else {
                pkg.packageJson.devDependencies[conflict.dependency] = targetVersion;
              }

              // Write updated package.json
              const packageJsonPath = join(pkg.path, 'package.json');
              writeFileSync(packageJsonPath, JSON.stringify(pkg.packageJson, null, 2) + '\n');

              console.log(
                chalk.green(`✅ Updated ${usage.package}: ${conflict.dependency}@${targetVersion}`)
              );
            }

            fixResults.push({
              type: 'version_conflict',
              package: usage.package,
              dependency: conflict.dependency,
              from: usage.version,
              to: targetVersion,
              success: true,
            });
          }
        }
      }
    }
  }

  return fixResults;
}

/**
 * Generate comprehensive report
 */
function generateReport(packages, fixResults = []) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPackages: packages.length,
      versionConflicts: validationResults.versionConflicts.length,
      duplicateDependencies: validationResults.duplicateDependencies.length,
      peerDependencyIssues: validationResults.peerDependencyIssues.length,
      outdatedPackages: validationResults.outdatedPackages.length,
      fixesApplied: fixResults.length,
    },
    validationResults,
    fixResults,
    packages: packages.map(pkg => ({
      name: pkg.name,
      path: pkg.relativePath,
      dependencyCount: Object.keys(pkg.dependencies).length,
      devDependencyCount: Object.keys(pkg.devDependencies).length,
      peerDependencyCount: Object.keys(pkg.peerDependencies).length,
    })),
  };

  return report;
}

/**
 * Output report
 */
function outputReport(report) {
  console.log();
  console.log(chalk.blue('📊 Dependency Validation Report'));
  console.log(chalk.gray(`Generated: ${report.timestamp}`));
  console.log();

  // Summary
  console.log(chalk.cyan('Summary'));
  console.log(`Total packages: ${chalk.white(report.summary.totalPackages)}`);
  console.log(`Version conflicts: ${chalk.red(report.summary.versionConflicts)}`);
  console.log(`Duplicate dependencies: ${chalk.yellow(report.summary.duplicateDependencies)}`);
  console.log(`Peer dependency issues: ${chalk.red(report.summary.peerDependencyIssues)}`);
  if (CHECK_OUTDATED) {
    console.log(`Outdated packages: ${chalk.blue(report.summary.outdatedPackages)}`);
  }
  console.log();

  // Version conflicts
  if (report.validationResults.versionConflicts.length > 0) {
    console.log(chalk.cyan('⚠️  Version Conflicts'));
    for (const conflict of report.validationResults.versionConflicts.slice(0, 5)) {
      const severityColor = conflict.severity === 'high' ? chalk.red : chalk.yellow;
      console.log(`${severityColor('●')} ${conflict.dependency}`);
      console.log(`  Versions: ${conflict.versions.join(', ')}`);
      console.log(`  Used by: ${conflict.usages.map(u => u.package).join(', ')}`);
      console.log(`  ${chalk.gray(conflict.recommendation.reason)}`);
    }
    if (report.validationResults.versionConflicts.length > 5) {
      console.log(
        chalk.gray(`... and ${report.validationResults.versionConflicts.length - 5} more`)
      );
    }
    console.log();
  }

  // Duplicate dependencies
  if (report.validationResults.duplicateDependencies.length > 0) {
    console.log(chalk.cyan('📦 Hoisting Opportunities'));
    for (const dup of report.validationResults.duplicateDependencies.slice(0, 3)) {
      console.log(`${chalk.yellow('●')} ${dup.dependency}@${dup.version}`);
      console.log(
        `  Used in ${dup.usages.length} packages: ${dup.usages.map(u => u.package).join(', ')}`
      );
    }
    if (report.validationResults.duplicateDependencies.length > 3) {
      console.log(
        chalk.gray(`... and ${report.validationResults.duplicateDependencies.length - 3} more`)
      );
    }
    console.log();
  }

  // Fixes applied
  if (report.fixResults.length > 0) {
    console.log(chalk.cyan('🔧 Fixes Applied'));
    for (const fix of report.fixResults) {
      const status = fix.success ? chalk.green('✅') : chalk.red('❌');
      console.log(`${status} ${fix.package}: ${fix.dependency} ${fix.from} → ${fix.to}`);
    }
    console.log();
  }

  // Overall status
  const totalIssues = report.summary.versionConflicts + report.summary.peerDependencyIssues;

  if (totalIssues === 0) {
    console.log(chalk.green('✅ No critical dependency issues found!'));
  } else {
    console.log(
      chalk.yellow(`⚠️  ${totalIssues} dependency issues found. Review recommendations above.`)
    );
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(chalk.blue('🔍 Dependency Validation & Conflict Resolution'));
    console.log();

    const packages = findWorkspacePackages();

    console.log(chalk.blue(`Found ${packages.length} packages to validate`));
    console.log();

    // Run all validations
    detectVersionConflicts(packages);
    detectDuplicateDependencies(packages);
    checkPeerDependencies(packages);
    await checkOutdated();

    // Apply fixes if requested
    const fixResults = await applyFixes(packages);

    // Generate and output report
    const report = generateReport(packages, fixResults);
    outputReport(report);

    // Save report if requested
    if (OUTPUT_FILE) {
      writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
      console.log(chalk.green(`Report saved to: ${OUTPUT_FILE}`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Dependency validation failed:'), error.message);
    process.exit(1);
  }
}

main();
