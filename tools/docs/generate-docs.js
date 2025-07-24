#!/usr/bin/env node

/**
 * Documentation Generation Script
 *
 * Automatically generates API documentation for all packages using:
 * - TypeDoc for TypeScript packages
 * - Sphinx for Python packages
 * - Custom generators for specific formats
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(WORKSPACE_ROOT, 'docs');
const API_DOCS_DIR = path.join(DOCS_DIR, 'api');

/**
 * Package configuration for documentation generation
 */
const PACKAGES = {
  shared: {
    path: 'packages/shared',
    type: 'typescript',
    generator: 'typedoc',
    output: 'docs/api/shared',
  },
  ui: {
    path: 'packages/ui',
    type: 'typescript',
    generator: 'typedoc',
    output: 'docs/api/ui',
  },
  api: {
    path: 'packages/api',
    type: 'typescript',
    generator: 'typedoc',
    output: 'docs/api/api-client',
  },
  frontend: {
    path: 'apps/frontend',
    type: 'typescript',
    generator: 'typedoc',
    output: 'docs/api/frontend',
  },
  backend: {
    path: 'apps/backend',
    type: 'python',
    generator: 'sphinx',
    output: 'docs/api/backend',
  },
};

/**
 * Utility functions
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: 'ℹ️ ',
      success: '✅',
      error: '❌',
      warning: '⚠️ ',
    }[level] || 'ℹ️ ';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`);
  }
}

function packageExists(packagePath) {
  const fullPath = path.join(WORKSPACE_ROOT, packagePath);
  return fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'package.json'));
}

/**
 * TypeDoc documentation generation
 */
async function generateTypeDocDocs(packageName, config) {
  const packagePath = path.join(WORKSPACE_ROOT, config.path);
  const outputPath = path.join(WORKSPACE_ROOT, config.output);

  log(`Generating TypeDoc documentation for ${packageName}...`);

  // Ensure output directory exists
  ensureDir(outputPath);

  // Create TypeDoc configuration
  const typedocConfig = {
    entryPoints: ['src/index.ts'],
    out: outputPath,
    theme: 'default',
    includeVersion: true,
    excludePrivate: true,
    excludeProtected: false,
    excludeExternals: true,
    readme: 'README.md',
    name: `@monorepo/${packageName}`,
    tsconfig: 'tsconfig.json',
  };

  const configPath = path.join(packagePath, 'typedoc.json');
  fs.writeFileSync(configPath, JSON.stringify(typedocConfig, null, 2));

  try {
    // Run TypeDoc
    await exec(`cd ${packagePath} && npx typedoc --options typedoc.json`);
    log(`TypeDoc documentation generated for ${packageName}`, 'success');

    // Generate markdown summary
    await generateMarkdownSummary(packageName, config, outputPath);
  } catch (error) {
    log(`Failed to generate TypeDoc docs for ${packageName}: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Sphinx documentation generation for Python packages
 */
async function generateSphinxDocs(packageName, config) {
  const packagePath = path.join(WORKSPACE_ROOT, config.path);
  const outputPath = path.join(WORKSPACE_ROOT, config.output);

  log(`Generating Sphinx documentation for ${packageName}...`);

  // Ensure output directory exists
  ensureDir(outputPath);

  try {
    // Auto-generate RST files from Python modules
    await exec(`cd ${packagePath} && sphinx-apidoc -o ${outputPath} . --force --module-first`);

    // Build HTML documentation
    await exec(`cd ${packagePath} && sphinx-build -b html ${outputPath} ${outputPath}/_build/html`);

    log(`Sphinx documentation generated for ${packageName}`, 'success');
  } catch (error) {
    log(`Failed to generate Sphinx docs for ${packageName}: ${error.message}`, 'error');
    // Don't throw - Sphinx might not be configured yet
    log(`Skipping Sphinx documentation for ${packageName}`, 'warning');
  }
}

/**
 * Generate markdown summary from TypeScript source
 */
async function generateMarkdownSummary(packageName, config, outputPath) {
  try {
    const packagePath = path.join(WORKSPACE_ROOT, config.path);
    const srcPath = path.join(packagePath, 'src');

    if (!fs.existsSync(srcPath)) {
      log(`Source directory not found for ${packageName}`, 'warning');
      return;
    }

    // Read package.json for metadata
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Generate markdown documentation
    const markdownContent = generatePackageMarkdown(packageName, packageJson, srcPath);

    // Write markdown file
    const markdownPath = path.join(API_DOCS_DIR, `${packageName}.md`);
    fs.writeFileSync(markdownPath, markdownContent);

    log(`Markdown documentation generated for ${packageName}`, 'success');
  } catch (error) {
    log(`Failed to generate markdown for ${packageName}: ${error.message}`, 'warning');
  }
}

/**
 * Generate markdown content for a package
 */
function generatePackageMarkdown(packageName, packageJson, srcPath) {
  const title = `@monorepo/${packageName} API Documentation`;
  const description = packageJson.description || `API documentation for ${packageName} package`;
  const version = packageJson.version || '1.0.0';

  return `# ${title}

${description}

**Version:** ${version}

## Installation

\`\`\`bash
pnpm add @monorepo/${packageName}
\`\`\`

## Usage

\`\`\`typescript
import { } from '@monorepo/${packageName}';
\`\`\`

## API Reference

*Auto-generated documentation will be available here after TypeDoc generation.*

### Quick Links

- [TypeDoc Documentation](${packageName}/index.html)
- [Source Code](../../packages/${packageName}/src)
- [Tests](../../packages/${packageName}/tests)

## Contributing

See the main [Contributing Guide](../contributing.md) for development guidelines.

---

*This documentation is automatically generated. Last updated: ${new Date().toISOString()}*
`;
}

/**
 * Generate architecture diagrams using Mermaid
 */
async function generateArchitectureDiagrams() {
  log('Generating architecture diagrams...');

  const diagramsDir = path.join(DOCS_DIR, 'diagrams');
  ensureDir(diagramsDir);

  // System overview diagram
  const systemDiagram = `
graph TB
    subgraph "Monorepo Structure"
        subgraph "Applications"
            FE["📱 Frontend<br/>React + Vite"]
            BE["🔧 Backend<br/>Django + DRF"]
        end
        
        subgraph "Packages"
            SHARED["📦 Shared<br/>Types & Utils"]
            UI["🎯 UI<br/>Components"]
            API["🔌 API<br/>Client"]
        end
        
        subgraph "Tools"
            BUILD["🛠️ Build Tools"]
            DOCS["📚 Documentation"]
        end
    end

    FE --> SHARED
    FE --> UI
    FE --> API
    BE --> SHARED
    API --> SHARED
    UI --> SHARED
`;

  fs.writeFileSync(path.join(diagramsDir, 'system-overview.mmd'), systemDiagram);

  // Data flow diagram
  const dataFlowDiagram = `
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Client
    participant B as Backend
    participant D as Database
    
    U->>F: User Action
    F->>A: API Call
    A->>B: HTTP Request
    B->>D: Query Data
    D-->>B: Return Data
    B-->>A: JSON Response
    A-->>F: Typed Data
    F-->>U: Update UI
`;

  fs.writeFileSync(path.join(diagramsDir, 'data-flow.mmd'), dataFlowDiagram);

  log('Architecture diagrams generated', 'success');
}

/**
 * Update CI/CD workflow to include documentation generation
 */
function updateCIWorkflow() {
  log('Updating CI/CD workflow for documentation...');

  const workflowPath = path.join(WORKSPACE_ROOT, '.github/workflows/docs.yml');

  const docsWorkflow = `name: Documentation

on:
  push:
    branches: [main]
    paths:
      - 'packages/*/src/**'
      - 'apps/*/src/**'
      - 'docs/**'
  pull_request:
    branches: [main]
    paths:
      - 'packages/*/src/**'
      - 'apps/*/src/**'
      - 'docs/**'

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9.15.0'

jobs:
  generate-docs:
    name: Generate Documentation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: \${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate API documentation
        run: |
          node tools/docs/generate-docs.js

      - name: Upload documentation artifacts
        uses: actions/upload-artifact@v3
        with:
          name: documentation
          path: docs/
          retention-days: 30

  deploy-docs:
    name: Deploy Documentation
    runs-on: ubuntu-latest
    needs: generate-docs
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Download documentation
        uses: actions/download-artifact@v3
        with:
          name: documentation
          path: docs/

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
          cname: docs.example.com
`;

  fs.writeFileSync(workflowPath, docsWorkflow);
  log('Documentation workflow created', 'success');
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const packageFilter = args[1];

  log('Starting documentation generation...');

  try {
    // Ensure directories exist
    ensureDir(API_DOCS_DIR);

    if (command === 'all' || command === 'packages') {
      // Generate documentation for each package
      for (const [packageName, config] of Object.entries(PACKAGES)) {
        if (packageFilter && packageName !== packageFilter) {
          continue;
        }

        if (!packageExists(config.path)) {
          log(`Package ${packageName} not found at ${config.path}`, 'warning');
          continue;
        }

        try {
          if (config.generator === 'typedoc') {
            await generateTypeDocDocs(packageName, config);
          } else if (config.generator === 'sphinx') {
            await generateSphinxDocs(packageName, config);
          }
        } catch (error) {
          log(`Failed to generate docs for ${packageName}: ${error.message}`, 'error');
          // Continue with other packages
        }
      }
    }

    if (command === 'all' || command === 'diagrams') {
      await generateArchitectureDiagrams();
    }

    if (command === 'all' || command === 'ci') {
      updateCIWorkflow();
    }

    log('Documentation generation completed successfully!', 'success');
  } catch (error) {
    log(`Documentation generation failed: ${error.message}`, 'error');
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
  generateTypeDocDocs,
  generateSphinxDocs,
  generateArchitectureDiagrams,
  updateCIWorkflow,
};
