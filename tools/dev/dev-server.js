#!/usr/bin/env node

/**
 * Development Server Management Utility
 *
 * This script provides intelligent management of development servers
 * with port management, health checks, and coordinated startup.
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { glob } from 'glob';
import minimist from 'minimist';
import chalk from 'chalk';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'help', 'health-check', 'watch-mode'],
  string: ['workspace-root', 'services', 'port-range'],
  alias: {
    h: 'help',
    v: 'verbose',
    w: 'workspace-root',
    s: 'services',
    p: 'port-range',
    c: 'health-check',
  },
  default: {
    'workspace-root': '..',
    'port-range': '3000-4000',
  },
});

if (argv.help) {
  console.log(`
${chalk.blue('Development Server Management')}

Usage: node dev-server.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -w, --workspace-root    Path to workspace root (default: ../..)
  -s, --services          Comma-separated list of services to start
  -p, --port-range        Port range for auto-assignment (default: 3000-4000)
  -c, --health-check      Enable health checks for services
  --watch-mode            Enable file watching for auto-restart

Examples:
  node dev-server.js
  node dev-server.js --services frontend,backend
  node dev-server.js --health-check --watch-mode
  node dev-server.js --port-range 3000-5000
`);
  process.exit(0);
}

const WORKSPACE_ROOT = resolve(argv['workspace-root']);
const VERBOSE = argv.verbose;
const HEALTH_CHECK = argv['health-check'];
const WATCH_MODE = argv['watch-mode'];
const SERVICES = argv.services ? argv.services.split(',').map(s => s.trim()) : null;
const [PORT_START, PORT_END] = argv['port-range'].split('-').map(Number);

// Track running processes
const runningProcesses = new Map();
const usedPorts = new Set();

/**
 * Check if a port is available
 */
async function isPortAvailable(port) {
  return new Promise(resolve => {
    const net = require('net');
    const server = net.createServer();

    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port in the specified range
 */
async function findAvailablePort(startPort = PORT_START) {
  for (let port = startPort; port <= PORT_END; port++) {
    if (!usedPorts.has(port) && (await isPortAvailable(port))) {
      usedPorts.add(port);
      return port;
    }
  }

  throw new Error(`No available ports in range ${PORT_START}-${PORT_END}`);
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
 * Find all packages with dev servers
 */
function findDevServices() {
  const workspaceConfigPath = join(WORKSPACE_ROOT, 'pnpm-workspace.yaml');
  let patterns = ['apps/*', 'packages/*'];

  if (existsSync(workspaceConfigPath)) {
    try {
      const workspaceConfig = readFileSync(workspaceConfigPath, 'utf8');
      const packagesMatch = workspaceConfig.match(/packages:\s*\n((?:\s*-\s*[^\n]+\n?)*)/);
      if (packagesMatch) {
        patterns = packagesMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.substring(1).trim().replace(/['"]/g, ''))
          .filter(pattern => pattern.startsWith('apps/') || pattern.startsWith('packages/'));
      }
    } catch (error) {
      if (VERBOSE) {
        console.warn(
          chalk.yellow(`Warning: Could not parse pnpm-workspace.yaml: ${error.message}`)
        );
      }
    }
  }

  const services = [];

  for (const pattern of patterns) {
    const fullPattern = join(WORKSPACE_ROOT, pattern);
    try {
      const matches = glob.sync(fullPattern, { onlyDirectories: true });

      for (const match of matches) {
        const packageJson = getPackageJson(match);
        if (packageJson && packageJson.name && packageJson.scripts && packageJson.scripts.dev) {
          // Apply service filter if specified
          if (SERVICES && !SERVICES.some(s => packageJson.name.includes(s))) {
            continue;
          }

          services.push({
            name: packageJson.name,
            path: match,
            packageJson,
            devScript: packageJson.scripts.dev,
            defaultPort: getDefaultPort(packageJson, match),
            type: getServiceType(packageJson, match),
          });
        }
      }
    } catch (error) {
      if (VERBOSE) {
        console.warn(chalk.yellow(`Warning: Error globbing pattern ${pattern}: ${error.message}`));
      }
    }
  }

  return services;
}

/**
 * Get default port for a service
 */
function getDefaultPort(packageJson, packagePath) {
  // Check common port configurations
  const configFiles = ['vite.config.js', 'vite.config.ts', 'next.config.js', 'webpack.config.js'];

  for (const configFile of configFiles) {
    const configPath = join(packagePath, configFile);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        const portMatch = content.match(/port:\s*(\d+)/);
        if (portMatch) {
          return parseInt(portMatch[1]);
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  }

  // Default ports by service type
  if (packageJson.name.includes('frontend') || packageJson.name.includes('web')) {
    return 3000;
  } else if (packageJson.name.includes('backend') || packageJson.name.includes('api')) {
    return 8000;
  } else if (packageJson.name.includes('storybook')) {
    return 6006;
  }

  return 3000;
}

/**
 * Get service type
 */
function getServiceType(packageJson, packagePath) {
  if (packageJson.name.includes('frontend') || packageJson.name.includes('web')) {
    return 'frontend';
  } else if (packageJson.name.includes('backend') || packageJson.name.includes('api')) {
    return 'backend';
  } else if (packageJson.name.includes('storybook')) {
    return 'storybook';
  } else if (packageJson.dependencies && packageJson.dependencies.react) {
    return 'frontend';
  } else {
    return 'service';
  }
}

/**
 * Start a development server
 */
async function startService(service) {
  const port = await findAvailablePort(service.defaultPort);

  console.log(chalk.blue(`🚀 Starting ${service.name} on port ${port}...`));

  const env = {
    ...process.env,
    PORT: port.toString(),
    NODE_ENV: 'development',
  };

  // Set up arguments for different service types
  let command = 'pnpm';
  let args = ['--filter', service.name, 'dev'];

  // Special handling for different types
  if (service.type === 'backend' && service.devScript.includes('python')) {
    command = 'python3';
    args = service.devScript.split(' ').slice(1);
    env.PORT = port.toString();
  }

  const child = spawn(command, args, {
    cwd: WORKSPACE_ROOT,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let output = '';

  child.stdout?.on('data', data => {
    const text = data.toString();
    output += text;

    if (VERBOSE) {
      process.stdout.write(chalk.gray(`[${service.name}] `) + text);
    }

    // Look for startup indicators
    if (
      text.includes('Local:') ||
      text.includes('ready') ||
      text.includes('started') ||
      text.includes('running')
    ) {
      console.log(chalk.green(`✅ ${service.name} started successfully on port ${port}`));
    }
  });

  child.stderr?.on('data', data => {
    const text = data.toString();

    if (VERBOSE) {
      process.stderr.write(chalk.yellow(`[${service.name}] `) + text);
    }
  });

  child.on('exit', code => {
    runningProcesses.delete(service.name);
    usedPorts.delete(port);

    if (code === 0) {
      console.log(chalk.gray(`${service.name} stopped`));
    } else {
      console.log(chalk.red(`❌ ${service.name} exited with code ${code}`));
    }
  });

  runningProcesses.set(service.name, {
    process: child,
    port,
    service,
    startTime: Date.now(),
  });

  return { port, process: child };
}

/**
 * Perform health check on a service
 */
async function healthCheck(serviceName, port) {
  try {
    const response = await fetch(`http://localhost:${port}/`);
    return response.status < 400;
  } catch (error) {
    return false;
  }
}

/**
 * Monitor services
 */
async function monitorServices() {
  if (!HEALTH_CHECK) return;

  const interval = setInterval(async () => {
    for (const [serviceName, info] of runningProcesses) {
      const isHealthy = await healthCheck(serviceName, info.port);

      if (!isHealthy) {
        console.log(chalk.yellow(`⚠️  Health check failed for ${serviceName}`));
      } else if (VERBOSE) {
        console.log(chalk.green(`💚 ${serviceName} is healthy`));
      }
    }
  }, 30000); // Check every 30 seconds

  // Cleanup on exit
  process.on('SIGINT', () => {
    clearInterval(interval);
  });
}

/**
 * Graceful shutdown
 */
function setupGracefulShutdown() {
  async function shutdown() {
    console.log(chalk.yellow('\\n🛑 Shutting down services...'));

    const shutdownPromises = Array.from(runningProcesses.values()).map(info => {
      return new Promise(resolve => {
        info.process.on('exit', resolve);
        info.process.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          info.process.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    });

    await Promise.all(shutdownPromises);
    console.log(chalk.green('✅ All services stopped'));
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(chalk.blue('🎯 Development Server Manager'));
    console.log();

    const services = findDevServices();

    if (services.length === 0) {
      console.log(chalk.yellow('No development services found'));
      return;
    }

    console.log(chalk.blue(`Found ${services.length} development services:`));
    for (const service of services) {
      const typeColor =
        service.type === 'frontend'
          ? chalk.cyan
          : service.type === 'backend'
            ? chalk.green
            : service.type === 'storybook'
              ? chalk.magenta
              : chalk.gray;

      console.log(`  ${typeColor('●')} ${service.name} ${chalk.gray(`(${service.type})`)}`);
    }
    console.log();

    setupGracefulShutdown();

    // Start services
    const startPromises = services.map(service => startService(service));
    await Promise.all(startPromises);

    console.log();
    console.log(chalk.green('🎉 All services started!'));
    console.log();
    console.log(chalk.blue('Running services:'));
    for (const [serviceName, info] of runningProcesses) {
      const typeColor =
        info.service.type === 'frontend'
          ? chalk.cyan
          : info.service.type === 'backend'
            ? chalk.green
            : chalk.gray;

      console.log(`  ${typeColor('●')} ${serviceName}: http://localhost:${info.port}`);
    }

    console.log();
    console.log(chalk.gray('Press Ctrl+C to stop all services'));

    // Start monitoring
    await monitorServices();

    // Keep the process alive
    await new Promise(() => {}); // Never resolve
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

main();
