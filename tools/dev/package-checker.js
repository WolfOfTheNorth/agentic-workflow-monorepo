#!/usr/bin/env node

/**
 * Package Dependency Checker
 *
 * This script validates package dependencies, checks for circular dependencies,
 * and ensures workspace integrity.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { glob } from 'glob';
import minimist from 'minimist';
import chalk from 'chalk';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'help', 'circular', 'unused', 'outdated'],
  string: ['workspace-root'],
  alias: {
    h: 'help',
    v: 'verbose',
    w: 'workspace-root',
    c: 'circular',
    u: 'unused',
    o: 'outdated',
  },
  default: {
    'workspace-root': '..',
  },
});

if (argv.help) {
  console.log(`
${chalk.blue('Package Dependency Checker')}

Usage: node package-checker.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -w, --workspace-root    Path to workspace root (default: ../..)
  -c, --circular          Check for circular dependencies
  -u, --unused            Check for unused dependencies
  -o, --outdated          Check for outdated dependencies

Examples:
  node package-checker.js
  node package-checker.js --circular --unused
  node package-checker.js --verbose --outdated
`);
  process.exit(0);
}

const WORKSPACE_ROOT = resolve(argv['workspace-root']);
const VERBOSE = argv.verbose;
const CHECK_CIRCULAR = argv.circular;
const CHECK_UNUSED = argv.unused;
const CHECK_OUTDATED = argv.outdated;

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
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
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
 * Check for circular dependencies
 */
function checkCircularDependencies(packages) {
  const packageMap = new Map(packages.map(pkg => [pkg.name, pkg]));
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(packageName, path = []) {
    if (recursionStack.has(packageName)) {
      const cycleStart = path.indexOf(packageName);
      const cycle = path.slice(cycleStart).concat(packageName);
      cycles.push(cycle);
      return;
    }

    if (visited.has(packageName)) {
      return;
    }

    visited.add(packageName);
    recursionStack.add(packageName);
    path.push(packageName);

    const pkg = packageMap.get(packageName);
    if (pkg) {
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const depName of Object.keys(allDeps)) {
        if (packageMap.has(depName)) {
          dfs(depName, [...path]);
        }
      }
    }

    recursionStack.delete(packageName);
    path.pop();
  }

  for (const pkg of packages) {
    if (!visited.has(pkg.name)) {
      dfs(pkg.name);
    }
  }

  return cycles;
}

/**
 * Check for unused dependencies
 */
function checkUnusedDependencies(packages) {
  const unused = [];

  for (const pkg of packages) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const packageUnused = [];

    // Simple heuristic: check if dependency is imported in any file
    for (const depName of Object.keys(allDeps)) {
      try {
        const files = glob.sync('**/*.{js,jsx,ts,tsx}', {
          cwd: pkg.path,
          ignore: ['node_modules/**', 'dist/**', 'build/**'],
        });

        let isUsed = false;
        for (const file of files) {
          const filePath = join(pkg.path, file);
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');

            // Check for various import patterns
            const importPatterns = [
              new RegExp(`import.*from\\s+['"]${depName}['"]`, 'g'),
              new RegExp(`require\\(['"]${depName}['"]\\)`, 'g'),
              new RegExp(`import\\(['"]${depName}['"]\\)`, 'g'),
            ];

            if (importPatterns.some(pattern => pattern.test(content))) {
              isUsed = true;
              break;
            }
          }
        }

        if (!isUsed) {
          packageUnused.push(depName);
        }
      } catch (error) {
        if (VERBOSE) {
          console.warn(chalk.yellow(`Warning: Error checking usage for ${depName} in ${pkg.name}`));
        }
      }
    }

    if (packageUnused.length > 0) {
      unused.push({
        package: pkg.name,
        unused: packageUnused,
      });
    }
  }

  return unused;
}

/**
 * Validate workspace integrity
 */
function validateWorkspaceIntegrity(packages) {
  const issues = [];
  const packageNames = new Set(packages.map(pkg => pkg.name));

  for (const pkg of packages) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for missing workspace dependencies
    for (const depName of Object.keys(allDeps)) {
      if (depName.startsWith('@agentic-workflow/') && !packageNames.has(depName)) {
        issues.push({
          type: 'missing-workspace-package',
          package: pkg.name,
          dependency: depName,
          message: `References non-existent workspace package: ${depName}`,
        });
      }
    }

    // Check for version mismatches in workspace dependencies
    const workspaceDeps = Object.keys(allDeps).filter(dep => packageNames.has(dep));
    for (const depName of workspaceDeps) {
      const depPkg = packages.find(p => p.name === depName);
      const declaredVersion = allDeps[depName];
      const actualVersion = depPkg?.packageJson.version;

      if (actualVersion && declaredVersion !== actualVersion && declaredVersion !== 'workspace:*') {
        issues.push({
          type: 'version-mismatch',
          package: pkg.name,
          dependency: depName,
          declared: declaredVersion,
          actual: actualVersion,
          message: `Version mismatch for ${depName}: declared ${declaredVersion}, actual ${actualVersion}`,
        });
      }
    }

    // Check for missing required fields
    if (!pkg.packageJson.version) {
      issues.push({
        type: 'missing-version',
        package: pkg.name,
        message: 'Package is missing version field',
      });
    }

    if (!pkg.packageJson.scripts || !pkg.packageJson.scripts.build) {
      const isApp = pkg.path.includes('/apps/');
      const isLibrary = pkg.path.includes('/packages/');

      if (isApp || isLibrary) {
        issues.push({
          type: 'missing-build-script',
          package: pkg.name,
          message: 'Package is missing build script',
        });
      }
    }
  }

  return issues;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(chalk.blue('🔍 Package Dependency Checker'));
    console.log();

    const packages = findWorkspacePackages();

    if (packages.length === 0) {
      console.log(chalk.yellow('No packages found in workspace'));
      return;
    }

    console.log(chalk.blue(`Analyzing ${packages.length} packages...`));
    console.log();

    let hasIssues = false;

    // Basic workspace integrity check
    console.log(chalk.cyan('📋 Workspace Integrity'));
    const integrityIssues = validateWorkspaceIntegrity(packages);

    if (integrityIssues.length === 0) {
      console.log(chalk.green('✅ No integrity issues found'));
    } else {
      hasIssues = true;
      console.log(chalk.red(`❌ Found ${integrityIssues.length} integrity issues:`));

      for (const issue of integrityIssues) {
        console.log(`  ${chalk.red('●')} ${issue.package}: ${issue.message}`);
      }
    }
    console.log();

    // Circular dependency check
    if (CHECK_CIRCULAR) {
      console.log(chalk.cyan('🔄 Circular Dependencies'));
      const cycles = checkCircularDependencies(packages);

      if (cycles.length === 0) {
        console.log(chalk.green('✅ No circular dependencies found'));
      } else {
        hasIssues = true;
        console.log(chalk.red(`❌ Found ${cycles.length} circular dependencies:`));

        for (const cycle of cycles) {
          console.log(`  ${chalk.red('●')} ${cycle.join(' → ')}`);
        }
      }
      console.log();
    }

    // Unused dependencies check
    if (CHECK_UNUSED) {
      console.log(chalk.cyan('📦 Unused Dependencies'));
      const unused = checkUnusedDependencies(packages);

      if (unused.length === 0) {
        console.log(chalk.green('✅ No unused dependencies found'));
      } else {
        console.log(chalk.yellow(`⚠️  Found potentially unused dependencies:`));

        for (const item of unused) {
          console.log(`  ${chalk.yellow('●')} ${item.package}:`);
          for (const dep of item.unused) {
            console.log(`    - ${dep}`);
          }
        }
        console.log(chalk.gray('Note: This is a heuristic check and may have false positives'));
      }
      console.log();
    }

    // Summary
    if (hasIssues) {
      console.log(chalk.red('❌ Issues found! Please review and fix the problems above.'));
      process.exit(1);
    } else {
      console.log(chalk.green('🎉 All checks passed! Workspace is healthy.'));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

main();
