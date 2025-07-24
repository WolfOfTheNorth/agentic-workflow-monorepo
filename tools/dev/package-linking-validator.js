#!/usr/bin/env node

/**
 * Package Linking and Validation Script
 *
 * This script validates internal package dependencies, imports, TypeScript path mapping,
 * and the build process to ensure proper workspace integration.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname, relative } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';
import minimist from 'minimist';
import chalk from 'chalk';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'help', 'fix', 'full-build'],
  string: ['workspace-root'],
  alias: {
    h: 'help',
    v: 'verbose',
    f: 'fix',
    w: 'workspace-root',
    b: 'full-build',
  },
  default: {
    'workspace-root': '..',
  },
});

if (argv.help) {
  console.log(`
${chalk.blue('Package Linking and Validation Script')}

Usage: node package-linking-validator.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -f, --fix               Attempt to fix detected issues
  -w, --workspace-root    Path to workspace root (default: ..)
  -b, --full-build        Run full build test

Examples:
  node package-linking-validator.js
  node package-linking-validator.js --verbose --fix
  node package-linking-validator.js --full-build
`);
  process.exit(0);
}

const WORKSPACE_ROOT = resolve(argv['workspace-root']);
const VERBOSE = argv.verbose;
const FIX_ISSUES = argv.fix;
const FULL_BUILD = argv['full-build'];

// Track validation results
const validationResults = {
  packageDependencies: { passed: 0, failed: 0, issues: [] },
  typeScriptPaths: { passed: 0, failed: 0, issues: [] },
  imports: { passed: 0, failed: 0, issues: [] },
  builds: { passed: 0, failed: 0, issues: [] },
  exports: { passed: 0, failed: 0, issues: [] },
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
      if (VERBOSE) {
        process.stdout.write(output);
      }
    });

    child.stderr?.on('data', data => {
      const output = data.toString();
      stderr += output;
      if (VERBOSE) {
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
            relativePath: relative(WORKSPACE_ROOT, match),
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
 * Get TypeScript configuration
 */
function getTypeScriptConfig() {
  const tsConfigPath = join(WORKSPACE_ROOT, 'tsconfig.json');
  if (!existsSync(tsConfigPath)) {
    return null;
  }

  try {
    const content = readFileSync(tsConfigPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (VERBOSE) {
      console.warn(chalk.yellow(`Warning: Could not parse tsconfig.json: ${error.message}`));
    }
    return null;
  }
}

/**
 * Validate package dependencies
 */
function validatePackageDependencies(packages) {
  console.log(chalk.cyan('📦 Validating Package Dependencies'));

  const packageNames = new Set(packages.map(pkg => pkg.name));

  for (const pkg of packages) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check workspace dependencies
    for (const [depName, version] of Object.entries(allDeps)) {
      if (packageNames.has(depName)) {
        // This is a workspace dependency
        if (version === 'workspace:*') {
          validationResults.packageDependencies.passed++;
          if (VERBOSE) {
            console.log(chalk.green(`  ✅ ${pkg.name} → ${depName} (${version})`));
          }
        } else {
          validationResults.packageDependencies.failed++;
          const issue = `${pkg.name} references workspace package ${depName} with non-workspace version: ${version}`;
          validationResults.packageDependencies.issues.push(issue);
          console.log(chalk.red(`  ❌ ${issue}`));

          if (FIX_ISSUES) {
            console.log(chalk.yellow(`    🔧 Fixing: Setting ${depName} to workspace:*`));
            pkg.packageJson.dependencies = pkg.packageJson.dependencies || {};
            pkg.packageJson.devDependencies = pkg.packageJson.devDependencies || {};

            if (pkg.packageJson.dependencies[depName]) {
              pkg.packageJson.dependencies[depName] = 'workspace:*';
            }
            if (pkg.packageJson.devDependencies[depName]) {
              pkg.packageJson.devDependencies[depName] = 'workspace:*';
            }

            // Write updated package.json
            const packageJsonPath = join(pkg.path, 'package.json');
            writeFileSync(packageJsonPath, JSON.stringify(pkg.packageJson, null, 2) + '\n');
          }
        }
      }
    }

    // Check for missing workspace dependencies
    const sourceFiles = glob.sync('src/**/*.{ts,tsx,js,jsx}', { cwd: pkg.path });
    for (const file of sourceFiles) {
      const filePath = join(pkg.path, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');

          // Look for imports from workspace packages
          for (const otherPkg of packages) {
            if (otherPkg.name === pkg.name) continue;

            const importPattern = new RegExp(`from\\s+['"]${otherPkg.name}['"]`, 'g');
            const importSubPattern = new RegExp(`from\\s+['"]${otherPkg.name}/`, 'g');

            if (importPattern.test(content) || importSubPattern.test(content)) {
              // This package imports from otherPkg, check if it's in dependencies
              if (!allDeps[otherPkg.name]) {
                validationResults.packageDependencies.failed++;
                const issue = `${pkg.name} imports from ${otherPkg.name} but doesn't declare it as a dependency`;
                validationResults.packageDependencies.issues.push(issue);
                console.log(chalk.red(`  ❌ ${issue}`));

                if (FIX_ISSUES) {
                  console.log(chalk.yellow(`    🔧 Fixing: Adding ${otherPkg.name} as dependency`));
                  pkg.packageJson.dependencies = pkg.packageJson.dependencies || {};
                  pkg.packageJson.dependencies[otherPkg.name] = 'workspace:*';

                  const packageJsonPath = join(pkg.path, 'package.json');
                  writeFileSync(packageJsonPath, JSON.stringify(pkg.packageJson, null, 2) + '\n');
                }
              }
            }
          }
        } catch (error) {
          if (VERBOSE) {
            console.warn(chalk.yellow(`Warning: Could not analyze ${filePath}: ${error.message}`));
          }
        }
      }
    }
  }

  console.log();
}

/**
 * Validate TypeScript path mapping
 */
function validateTypeScriptPaths(packages, tsConfig) {
  console.log(chalk.cyan('🔗 Validating TypeScript Path Mapping'));

  if (!tsConfig || !tsConfig.compilerOptions || !tsConfig.compilerOptions.paths) {
    validationResults.typeScriptPaths.failed++;
    validationResults.typeScriptPaths.issues.push(
      'No TypeScript path mapping found in root tsconfig.json'
    );
    console.log(chalk.red('  ❌ No TypeScript path mapping found'));
    return;
  }

  const paths = tsConfig.compilerOptions.paths;

  // Check that all workspace packages have path mappings
  for (const pkg of packages) {
    if (pkg.name.startsWith('@agentic-workflow/')) {
      const expectedPaths = [pkg.name, `${pkg.name}/*`];

      for (const expectedPath of expectedPaths) {
        if (paths[expectedPath]) {
          validationResults.typeScriptPaths.passed++;
          if (VERBOSE) {
            console.log(chalk.green(`  ✅ ${expectedPath} → ${paths[expectedPath]}`));
          }
        } else {
          validationResults.typeScriptPaths.failed++;
          const issue = `Missing TypeScript path mapping for ${expectedPath}`;
          validationResults.typeScriptPaths.issues.push(issue);
          console.log(chalk.red(`  ❌ ${issue}`));

          if (FIX_ISSUES) {
            console.log(chalk.yellow(`    🔧 Fixing: Adding path mapping for ${expectedPath}`));
            const relativePath = relative(WORKSPACE_ROOT, join(pkg.path, 'src'));
            if (expectedPath.endsWith('/*')) {
              paths[expectedPath] = [`./${relativePath}/*`];
            } else {
              paths[expectedPath] = [`./${relativePath}`];
            }
          }
        }
      }
    }
  }

  if (FIX_ISSUES && validationResults.typeScriptPaths.failed > 0) {
    const tsConfigPath = join(WORKSPACE_ROOT, 'tsconfig.json');
    writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2) + '\n');
    console.log(chalk.yellow('    🔧 Updated tsconfig.json with missing path mappings'));
  }

  console.log();
}

/**
 * Validate imports and exports
 */
async function validateImportsAndExports(packages) {
  console.log(chalk.cyan('📥 Validating Imports and Exports'));

  for (const pkg of packages) {
    // Check if package has proper exports
    if (pkg.packageJson.exports) {
      validationResults.exports.passed++;
      if (VERBOSE) {
        console.log(chalk.green(`  ✅ ${pkg.name} has proper exports configuration`));
      }
    } else if (pkg.relativePath.startsWith('packages/')) {
      validationResults.exports.failed++;
      const issue = `${pkg.name} is a library package but missing exports configuration`;
      validationResults.exports.issues.push(issue);
      console.log(chalk.red(`  ❌ ${issue}`));
    }

    // Test actual imports by creating a temporary test file
    const testDir = join(pkg.path, '.temp-validation');
    const testFile = join(testDir, 'import-test.ts');

    try {
      if (!existsSync(testDir)) {
        mkdirSync(testDir, { recursive: true });
      }

      // Generate import test code
      let testCode = '// Temporary import validation test\n';

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const workspaceDeps = Object.keys(allDeps).filter(dep =>
        dep.startsWith('@agentic-workflow/')
      );

      for (const dep of workspaceDeps) {
        testCode += `import * as ${dep.replace(/[@/-]/g, '_')} from '${dep}';\n`;

        // Test subpath imports if package has exports
        const depPkg = packages.find(p => p.name === dep);
        if (depPkg && depPkg.packageJson.exports) {
          const exports = depPkg.packageJson.exports;
          for (const [exportPath, exportConfig] of Object.entries(exports)) {
            if (exportPath !== '.' && typeof exportConfig === 'object' && exportConfig.import) {
              const subpath = exportPath.startsWith('./') ? exportPath.slice(2) : exportPath;
              testCode += `import * as ${dep.replace(/[@/-]/g, '_')}_${subpath.replace(/[/-]/g, '_')} from '${dep}/${subpath}';\n`;
            }
          }
        }
      }

      testCode += '\n// Test successful\nconsole.log("Import validation passed");\n';

      writeFileSync(testFile, testCode);

      // Try to compile the test file
      try {
        const result = await execCommand('npx', ['tsc', '--noEmit', '--skipLibCheck', testFile], {
          cwd: WORKSPACE_ROOT,
        });

        if (result.code === 0) {
          validationResults.imports.passed++;
          if (VERBOSE) {
            console.log(chalk.green(`  ✅ ${pkg.name} imports compile successfully`));
          }
        } else {
          validationResults.imports.failed++;
          const issue = `${pkg.name} import compilation failed: ${result.stderr}`;
          validationResults.imports.issues.push(issue);
          console.log(chalk.red(`  ❌ Import compilation failed for ${pkg.name}`));
          if (VERBOSE) {
            console.log(chalk.gray(`    ${result.stderr}`));
          }
        }
      } catch (error) {
        validationResults.imports.failed++;
        const issue = `${pkg.name} import test failed: ${error.message}`;
        validationResults.imports.issues.push(issue);
        console.log(chalk.red(`  ❌ Import test failed for ${pkg.name}: ${error.message}`));
      }
    } catch (error) {
      console.log(
        chalk.yellow(`  ⚠️  Could not create import test for ${pkg.name}: ${error.message}`)
      );
    } finally {
      // Clean up test files
      try {
        if (existsSync(testFile)) {
          const fs = await import('fs/promises');
          await fs.rm(testDir, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  console.log();
}

/**
 * Validate build process
 */
async function validateBuildProcess(packages) {
  console.log(chalk.cyan('🔨 Validating Build Process'));

  if (FULL_BUILD) {
    console.log(chalk.blue('Running full build test...'));

    try {
      // First clean all packages
      const cleanResult = await execCommand('pnpm', ['-r', 'clean'], {
        cwd: WORKSPACE_ROOT,
      });

      if (cleanResult.code !== 0) {
        console.log(chalk.yellow('  ⚠️  Clean command had warnings, continuing...'));
      }

      // Then build in dependency order
      const buildResult = await execCommand('pnpm', ['-r', 'build'], {
        cwd: WORKSPACE_ROOT,
      });

      if (buildResult.code === 0) {
        validationResults.builds.passed++;
        console.log(chalk.green('  ✅ Full workspace build successful'));
      } else {
        validationResults.builds.failed++;
        const issue = `Full workspace build failed: ${buildResult.stderr}`;
        validationResults.builds.issues.push(issue);
        console.log(chalk.red('  ❌ Full workspace build failed'));
        if (VERBOSE) {
          console.log(chalk.gray(`    ${buildResult.stderr}`));
        }
      }
    } catch (error) {
      validationResults.builds.failed++;
      const issue = `Build process error: ${error.message}`;
      validationResults.builds.issues.push(issue);
      console.log(chalk.red(`  ❌ Build process error: ${error.message}`));
    }
  } else {
    console.log(chalk.gray('  ℹ️  Skipping full build test (use --full-build to enable)'));
  }

  // Test individual package builds
  for (const pkg of packages) {
    if (pkg.packageJson.scripts && pkg.packageJson.scripts.build) {
      try {
        const result = await execCommand('pnpm', ['--filter', pkg.name, 'build'], {
          cwd: WORKSPACE_ROOT,
        });

        if (result.code === 0) {
          validationResults.builds.passed++;
          if (VERBOSE) {
            console.log(chalk.green(`  ✅ ${pkg.name} build successful`));
          }
        } else {
          validationResults.builds.failed++;
          const issue = `${pkg.name} build failed: ${result.stderr}`;
          validationResults.builds.issues.push(issue);
          console.log(chalk.red(`  ❌ ${pkg.name} build failed`));
          if (VERBOSE) {
            console.log(chalk.gray(`    ${result.stderr}`));
          }
        }
      } catch (error) {
        validationResults.builds.failed++;
        const issue = `${pkg.name} build error: ${error.message}`;
        validationResults.builds.issues.push(issue);
        console.log(chalk.red(`  ❌ ${pkg.name} build error: ${error.message}`));
      }
    }
  }

  console.log();
}

/**
 * Generate validation report
 */
function generateReport() {
  console.log(chalk.blue('📊 Validation Report'));
  console.log();

  const categories = [
    { name: 'Package Dependencies', key: 'packageDependencies' },
    { name: 'TypeScript Paths', key: 'typeScriptPaths' },
    { name: 'Imports/Exports', key: 'imports' },
    { name: 'Exports Config', key: 'exports' },
    { name: 'Build Process', key: 'builds' },
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let hasFailures = false;

  for (const category of categories) {
    const result = validationResults[category.key];
    totalPassed += result.passed;
    totalFailed += result.failed;

    if (result.failed > 0) {
      hasFailures = true;
      console.log(
        chalk.red(`❌ ${category.name}: ${result.failed} failed, ${result.passed} passed`)
      );
    } else if (result.passed > 0) {
      console.log(chalk.green(`✅ ${category.name}: ${result.passed} passed`));
    } else {
      console.log(chalk.gray(`➖ ${category.name}: No tests run`));
    }
  }

  console.log();
  console.log(chalk.blue('Summary:'));
  console.log(`Total passed: ${chalk.green(totalPassed)}`);
  console.log(`Total failed: ${chalk.red(totalFailed)}`);

  if (hasFailures) {
    console.log();
    console.log(chalk.red('❌ Validation failed! Issues found:'));

    for (const category of categories) {
      const result = validationResults[category.key];
      if (result.issues.length > 0) {
        console.log(chalk.cyan(`\n${category.name}:`));
        for (const issue of result.issues) {
          console.log(`  • ${issue}`);
        }
      }
    }

    if (FIX_ISSUES) {
      console.log();
      console.log(
        chalk.yellow(
          '🔧 Some issues were automatically fixed. Please review the changes and run validation again.'
        )
      );
    } else {
      console.log();
      console.log(chalk.yellow('💡 Run with --fix to attempt automatic fixes for some issues.'));
    }

    return false;
  } else {
    console.log();
    console.log(chalk.green('🎉 All validations passed! Package linking is working correctly.'));
    return true;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(chalk.blue('🔍 Package Linking and Validation'));
    console.log();

    const packages = findWorkspacePackages();

    if (packages.length === 0) {
      console.log(chalk.yellow('No packages found in workspace'));
      return;
    }

    console.log(chalk.blue(`Found ${packages.length} packages to validate`));
    console.log();

    const tsConfig = getTypeScriptConfig();

    // Run all validations
    validatePackageDependencies(packages);
    validateTypeScriptPaths(packages, tsConfig);
    await validateImportsAndExports(packages);
    await validateBuildProcess(packages);

    // Generate final report
    const success = generateReport();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('❌ Validation error:'), error.message);
    process.exit(1);
  }
}

main();
