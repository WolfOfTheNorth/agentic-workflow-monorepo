#!/usr/bin/env node

/**
 * Workspace Information Utility
 *
 * This script provides detailed information about the workspace packages,
 * their dependencies, and current status.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';
import { glob } from 'glob';
import minimist from 'minimist';
import chalk from 'chalk';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'help', 'dependencies', 'scripts', 'sizes'],
  string: ['workspace-root', 'format'],
  alias: {
    h: 'help',
    v: 'verbose',
    w: 'workspace-root',
    d: 'dependencies',
    s: 'scripts',
    z: 'sizes',
    f: 'format',
  },
  default: {
    'workspace-root': '..',
    format: 'table',
  },
});

if (argv.help) {
  console.log(`
${chalk.blue('Workspace Information Utility')}

Usage: node workspace-info.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -w, --workspace-root    Path to workspace root (default: ../..)
  -d, --dependencies      Show dependency information
  -s, --scripts           Show available scripts
  -z, --sizes             Show package sizes
  -f, --format           Output format: table, json, tree (default: table)

Examples:
  node workspace-info.js
  node workspace-info.js --dependencies --scripts
  node workspace-info.js --format json
  node workspace-info.js --sizes
`);
  process.exit(0);
}

const WORKSPACE_ROOT = resolve(argv['workspace-root']);
const VERBOSE = argv.verbose;
const SHOW_DEPS = argv.dependencies;
const SHOW_SCRIPTS = argv.scripts;
const SHOW_SIZES = argv.sizes;
const FORMAT = argv.format;

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
 * Calculate directory size
 */
function getDirectorySize(dirPath) {
  try {
    const files = glob.sync('**/*', {
      cwd: dirPath,
      nodir: true,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', 'coverage/**'],
    });

    let totalSize = 0;
    for (const file of files) {
      try {
        const filePath = join(dirPath, file);
        const stats = statSync(filePath);
        totalSize += stats.size;
      } catch (error) {
        // Ignore files that can't be read
      }
    }

    return totalSize;
  } catch (error) {
    return 0;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
          const relativePath = relative(WORKSPACE_ROOT, match);

          packages.push({
            name: packageJson.name,
            version: packageJson.version || '0.0.0',
            path: match,
            relativePath,
            packageJson,
            type: getPackageType(packageJson, relativePath),
            size: SHOW_SIZES ? getDirectorySize(match) : 0,
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            scripts: packageJson.scripts || {},
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
 * Determine package type based on location and content
 */
function getPackageType(packageJson, relativePath) {
  if (relativePath.startsWith('apps/')) return 'application';
  if (relativePath.startsWith('packages/')) return 'library';
  if (relativePath.startsWith('tools/')) return 'tool';
  if (relativePath.startsWith('infra/')) return 'infrastructure';

  // Fallback to analyzing package.json
  if (packageJson.main || packageJson.module || packageJson.exports) {
    return 'library';
  }

  return 'unknown';
}

/**
 * Get workspace dependencies (packages that depend on other workspace packages)
 */
function getWorkspaceDependencies(packages) {
  const packageNames = new Set(packages.map(pkg => pkg.name));
  const dependencies = new Map();

  for (const pkg of packages) {
    const workspaceDeps = [];
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const depName of Object.keys(allDeps)) {
      if (packageNames.has(depName)) {
        workspaceDeps.push({
          name: depName,
          version: allDeps[depName],
          type: pkg.dependencies[depName] ? 'production' : 'development',
        });
      }
    }

    if (workspaceDeps.length > 0) {
      dependencies.set(pkg.name, workspaceDeps);
    }
  }

  return dependencies;
}

/**
 * Output in table format
 */
function outputTable(packages, workspaceDeps) {
  console.log(chalk.blue('📦 Workspace Packages'));
  console.log();

  // Basic package info
  const headers = ['Name', 'Version', 'Type', 'Path'];
  if (SHOW_SIZES) headers.push('Size');

  console.log(headers.map(h => chalk.cyan(h.padEnd(20))).join(''));
  console.log('─'.repeat(headers.length * 21));

  for (const pkg of packages) {
    const typeColor =
      pkg.type === 'application'
        ? chalk.yellow
        : pkg.type === 'library'
          ? chalk.green
          : pkg.type === 'tool'
            ? chalk.blue
            : chalk.gray;

    const row = [
      pkg.name.padEnd(20),
      pkg.version.padEnd(20),
      typeColor(pkg.type.padEnd(20)),
      chalk.gray(pkg.relativePath.padEnd(20)),
    ];

    if (SHOW_SIZES) {
      row.push(formatBytes(pkg.size).padEnd(20));
    }

    console.log(row.join(''));
  }

  console.log();

  // Dependencies
  if (SHOW_DEPS && workspaceDeps.size > 0) {
    console.log(chalk.blue('🔗 Workspace Dependencies'));
    console.log();

    for (const [packageName, deps] of workspaceDeps) {
      console.log(chalk.cyan(packageName));
      for (const dep of deps) {
        const typeColor = dep.type === 'production' ? chalk.green : chalk.yellow;
        console.log(`  ${typeColor('●')} ${dep.name} ${chalk.gray(dep.version)}`);
      }
      console.log();
    }
  }

  // Scripts
  if (SHOW_SCRIPTS) {
    console.log(chalk.blue('⚡ Available Scripts'));
    console.log();

    const allScripts = new Set();
    for (const pkg of packages) {
      for (const script of Object.keys(pkg.scripts)) {
        allScripts.add(script);
      }
    }

    for (const script of Array.from(allScripts).sort()) {
      console.log(chalk.cyan(script));
      for (const pkg of packages) {
        if (pkg.scripts[script]) {
          console.log(`  ${chalk.green('✓')} ${pkg.name}`);
        }
      }
      console.log();
    }
  }
}

/**
 * Output in JSON format
 */
function outputJSON(packages, workspaceDeps) {
  const output = {
    summary: {
      totalPackages: packages.length,
      types: packages.reduce((acc, pkg) => {
        acc[pkg.type] = (acc[pkg.type] || 0) + 1;
        return acc;
      }, {}),
      totalSize: SHOW_SIZES ? packages.reduce((acc, pkg) => acc + pkg.size, 0) : undefined,
    },
    packages: packages.map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      type: pkg.type,
      path: pkg.relativePath,
      size: SHOW_SIZES ? pkg.size : undefined,
      dependencies: SHOW_DEPS
        ? {
            production: Object.keys(pkg.dependencies),
            development: Object.keys(pkg.devDependencies),
            workspace: workspaceDeps.get(pkg.name) || [],
          }
        : undefined,
      scripts: SHOW_SCRIPTS ? Object.keys(pkg.scripts) : undefined,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Main execution
 */
async function main() {
  try {
    const packages = findWorkspacePackages();

    if (packages.length === 0) {
      console.log(chalk.yellow('No packages found in workspace'));
      return;
    }

    const workspaceDeps = getWorkspaceDependencies(packages);

    if (FORMAT === 'json') {
      outputJSON(packages, workspaceDeps);
    } else {
      outputTable(packages, workspaceDeps);

      // Summary
      console.log(chalk.blue('📊 Summary'));
      console.log(`Total packages: ${chalk.cyan(packages.length)}`);

      const typeStats = packages.reduce((acc, pkg) => {
        acc[pkg.type] = (acc[pkg.type] || 0) + 1;
        return acc;
      }, {});

      for (const [type, count] of Object.entries(typeStats)) {
        const typeColor =
          type === 'application'
            ? chalk.yellow
            : type === 'library'
              ? chalk.green
              : type === 'tool'
                ? chalk.blue
                : chalk.gray;
        console.log(`${typeColor(type)}: ${count}`);
      }

      if (SHOW_SIZES) {
        const totalSize = packages.reduce((acc, pkg) => acc + pkg.size, 0);
        console.log(`Total size: ${chalk.cyan(formatBytes(totalSize))}`);
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

main();
