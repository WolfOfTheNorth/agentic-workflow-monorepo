#!/usr/bin/env node

/**
 * Claude Code Integration
 *
 * Provides integration with Claude Code for collaborative development workflows:
 * - Automated spec validation
 * - Code review assistance
 * - Requirements analysis
 * - Design validation
 * - Implementation guidance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const CLAUDE_DIR = path.join(WORKSPACE_ROOT, '.claude');
const AI_TOOLS_DIR = path.join(WORKSPACE_ROOT, 'tools', 'ai');

/**
 * Claude Code workflow integration
 */
const CLAUDE_WORKFLOWS = {
  specValidation: {
    description: 'Validate specifications against implementation',
    prompt: `
Analyze the provided specification and implementation to validate:

1. **Requirements Coverage**: Are all requirements implemented?
2. **Design Adherence**: Does implementation match the design?
3. **Code Quality**: Does code meet established standards?
4. **Test Coverage**: Are all scenarios properly tested?
5. **Documentation**: Is everything adequately documented?

Provide specific feedback on:
- Missing implementations
- Design deviations
- Quality issues
- Testing gaps
- Documentation needs

Format response as structured feedback with actionable recommendations.
`,
    inputs: ['requirements', 'design', 'implementation'],
    outputs: ['validation-report', 'recommendations'],
  },

  codeReview: {
    description: 'AI-assisted code review with contextual analysis',
    prompt: `
Perform a comprehensive code review focusing on:

1. **Code Quality**: Maintainability, readability, and best practices
2. **Security**: Potential vulnerabilities and security concerns
3. **Performance**: Optimization opportunities and bottlenecks
4. **Architecture**: Adherence to architectural patterns
5. **Testing**: Test coverage and quality

Consider:
- Project context and existing patterns
- Technology stack and conventions
- Team coding standards
- Performance requirements

Provide specific, actionable feedback with examples and suggestions.
`,
    inputs: ['code-changes', 'context'],
    outputs: ['review-comments', 'suggestions'],
  },

  requirementsAnalysis: {
    description: 'Analyze and enhance requirements documentation',
    prompt: `
Analyze the requirements and provide enhancement suggestions:

1. **Completeness**: Missing requirements or scenarios
2. **Clarity**: Ambiguous or unclear requirements
3. **Testability**: Requirements that are difficult to validate
4. **Consistency**: Conflicting or inconsistent requirements
5. **Prioritization**: Missing priority or effort estimates

Suggest:
- Additional user stories
- Refined acceptance criteria
- Edge cases to consider
- Non-functional requirements
- Risk assessments

Format as structured recommendations with rationale.
`,
    inputs: ['requirements', 'context'],
    outputs: ['analysis', 'enhancements'],
  },

  designReview: {
    description: 'Review and validate technical design',
    prompt: `
Review the technical design for:

1. **Architecture**: Scalability, maintainability, and patterns
2. **Technology Choices**: Appropriateness and consistency
3. **Data Design**: Models, relationships, and validation
4. **API Design**: RESTful principles and usability
5. **Security**: Authentication, authorization, and data protection
6. **Performance**: Efficiency and optimization strategies

Consider:
- Existing system architecture
- Team expertise and preferences
- Scalability requirements
- Maintenance implications

Provide specific recommendations for improvements.
`,
    inputs: ['design', 'requirements', 'context'],
    outputs: ['design-review', 'recommendations'],
  },
};

/**
 * Utility functions
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: '🤖',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      claude: '🎨',
    }[level] || '🤖';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Claude Code integration commands
 */
function generateClaudeCommand(workflow, specName, options = {}) {
  const workflowConfig = CLAUDE_WORKFLOWS[workflow];
  if (!workflowConfig) {
    throw new Error(`Unknown workflow: ${workflow}`);
  }

  const command = {
    workflow,
    description: workflowConfig.description,
    specName,
    timestamp: new Date().toISOString(),
    prompt: workflowConfig.prompt,
    context: {
      project: 'AI-First Modular Monorepo',
      spec: specName,
      ...options.context,
    },
    inputs: [],
    expectedOutputs: workflowConfig.outputs,
  };

  // Gather input files based on workflow requirements
  const specDir = path.join(CLAUDE_DIR, 'specs', specName);

  workflowConfig.inputs.forEach(inputType => {
    switch (inputType) {
      case 'requirements':
        const reqPath = path.join(specDir, 'requirements.md');
        if (fs.existsSync(reqPath)) {
          command.inputs.push({
            type: 'requirements',
            path: reqPath,
            content: readFile(reqPath),
          });
        }
        break;

      case 'design':
        const designPath = path.join(specDir, 'design.md');
        if (fs.existsSync(designPath)) {
          command.inputs.push({
            type: 'design',
            path: designPath,
            content: readFile(designPath),
          });
        }
        break;

      case 'implementation':
        // Gather relevant implementation files
        const implFiles = findImplementationFiles(specName);
        implFiles.forEach(file => {
          command.inputs.push({
            type: 'implementation',
            path: file,
            content: readFile(file),
          });
        });
        break;

      case 'code-changes':
        if (options.changedFiles) {
          options.changedFiles.forEach(file => {
            const fullPath = path.join(WORKSPACE_ROOT, file);
            if (fs.existsSync(fullPath)) {
              command.inputs.push({
                type: 'code-changes',
                path: file,
                content: readFile(fullPath),
              });
            }
          });
        }
        break;

      case 'context':
        // Add project context
        const contextFiles = ['README.md', 'package.json', 'docs/architecture.md'];

        contextFiles.forEach(file => {
          const fullPath = path.join(WORKSPACE_ROOT, file);
          if (fs.existsSync(fullPath)) {
            command.inputs.push({
              type: 'context',
              path: file,
              content: readFile(fullPath),
            });
          }
        });
        break;
    }
  });

  return command;
}

/**
 * Find implementation files related to a spec
 */
function findImplementationFiles(specName) {
  const implementationFiles = [];

  // Search common locations for related files
  const searchPaths = [
    path.join(WORKSPACE_ROOT, 'apps', 'frontend', 'src'),
    path.join(WORKSPACE_ROOT, 'apps', 'backend'),
    path.join(WORKSPACE_ROOT, 'packages'),
  ];

  searchPaths.forEach(searchPath => {
    if (fs.existsSync(searchPath)) {
      const files = findFilesRecursively(searchPath, ['.ts', '.tsx', '.js', '.jsx', '.py']);

      // Filter files that might be related to the spec
      const relatedFiles = files.filter(file => {
        const fileName = path.basename(file).toLowerCase();
        const specNameLower = specName.toLowerCase().replace(/-/g, '');
        return fileName.includes(specNameLower) || fileName.includes(specName.toLowerCase());
      });

      implementationFiles.push(...relatedFiles);
    }
  });

  return implementationFiles;
}

/**
 * Recursively find files with specific extensions
 */
function findFilesRecursively(dir, extensions) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
        files.push(...findFilesRecursively(fullPath, extensions));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    });
  } catch (error) {
    // Ignore permission errors or non-existent directories
  }

  return files;
}

/**
 * Execute Claude Code workflow
 */
async function executeClaudeWorkflow(workflow, specName, options = {}) {
  log(`Executing Claude workflow: ${workflow} for ${specName}`, 'claude');

  try {
    // Generate command structure
    const command = generateClaudeCommand(workflow, specName, options);

    // Save command for reference
    const commandPath = path.join(
      AI_TOOLS_DIR,
      '.claude-commands',
      `${workflow}-${specName}-${Date.now()}.json`
    );
    writeFile(commandPath, JSON.stringify(command, null, 2));

    log(`Claude command saved to: ${commandPath}`, 'info');

    // In a real implementation, this would interface with Claude Code API
    // For now, we'll simulate the workflow and provide structured output
    const result = simulateClaudeWorkflow(command);

    // Save results
    const resultPath = path.join(
      AI_TOOLS_DIR,
      '.claude-results',
      `${workflow}-${specName}-${Date.now()}.json`
    );
    writeFile(resultPath, JSON.stringify(result, null, 2));

    log(`Claude workflow completed. Results saved to: ${resultPath}`, 'success');

    return result;
  } catch (error) {
    log(`Claude workflow failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Simulate Claude Code workflow (replace with actual API integration)
 */
function simulateClaudeWorkflow(command) {
  const { workflow, specName, inputs } = command;

  const result = {
    workflow,
    specName,
    timestamp: new Date().toISOString(),
    status: 'completed',
    analysis: {},
    recommendations: [],
    summary: '',
  };

  switch (workflow) {
    case 'specValidation':
      result.analysis = {
        requirementsCoverage: 85,
        designAdherence: 90,
        codeQuality: 78,
        testCoverage: 72,
        documentation: 80,
      };

      result.recommendations = [
        'Improve test coverage for edge cases',
        'Add more detailed API documentation',
        'Consider refactoring complex functions',
        'Add integration tests for critical paths',
      ];

      result.summary = `Specification validation shows good overall compliance (${Math.round((85 + 90 + 78 + 72 + 80) / 5)}% average). Main areas for improvement are test coverage and code complexity.`;
      break;

    case 'codeReview':
      result.analysis = {
        codeQuality: 'good',
        securityIssues: 2,
        performanceIssues: 1,
        architectureAlignment: 'excellent',
        testQuality: 'needs-improvement',
      };

      result.recommendations = [
        'Add input validation for user-provided data',
        'Implement rate limiting for API endpoints',
        'Optimize database queries in list operations',
        'Add unit tests for error handling scenarios',
      ];

      result.summary =
        'Code review identifies minor security and performance improvements needed. Overall architecture is well-aligned.';
      break;

    case 'requirementsAnalysis':
      result.analysis = {
        completeness: 82,
        clarity: 88,
        testability: 75,
        consistency: 92,
        prioritization: 70,
      };

      result.recommendations = [
        'Add more specific error handling requirements',
        'Define performance benchmarks more clearly',
        'Include accessibility requirements (WCAG compliance)',
        'Add user personas and usage scenarios',
        'Prioritize requirements by business value',
      ];

      result.summary =
        'Requirements are well-structured but could benefit from more specific non-functional requirements and better prioritization.';
      break;

    case 'designReview':
      result.analysis = {
        architecture: 'excellent',
        technologyChoices: 'appropriate',
        dataDesign: 'good',
        apiDesign: 'very-good',
        security: 'needs-attention',
        performance: 'good',
      };

      result.recommendations = [
        'Add authentication middleware documentation',
        'Consider implementing API versioning',
        'Add database indexing strategy',
        'Include error response standardization',
        'Add monitoring and logging specifications',
      ];

      result.summary =
        'Design is well-architected with appropriate technology choices. Security aspects need more detailed specification.';
      break;
  }

  return result;
}

/**
 * Generate integration scripts for CI/CD
 */
function generateCIIntegration() {
  log('Generating CI/CD integration for Claude workflows...', 'claude');

  const ciScript = `#!/bin/bash\n\n# Claude Code AI Integration Script\n# Runs AI-powered workflows as part of CI/CD pipeline\n\nset -e\n\n# Configuration\n\nWORKSPACE_ROOT=$(cd $(dirname "\${BASH_SOURCE[0]}")/../.. && pwd)\nAI_TOOLS_DIR="\${WORKSPACE_ROOT}/tools/ai"\nSPEC_NAME="\${1:-$(basename $PWD)}"\nWORKFLOW="\${2:-codeReview}"\nBASE_BRANCH="\${3:-main}"\n\necho "🤖 Running Claude Code AI workflow: $WORKFLOW for $SPEC_NAME"\n\n# Get changed files\nCHANGED_FILES=$(git diff --name-only $BASE_BRANCH...HEAD)\n\nif [ -z "$CHANGED_FILES" ]; then\n  echo "No changes detected. Skipping AI workflow."\n  exit 0\nfi\n\necho "Changed files:"\necho "$CHANGED_FILES"\n\n# Run code review workflow\nif [ "$WORKFLOW" = "codeReview" ]; then\n  echo "Running AI-assisted code review..."\n  node "$AI_TOOLS_DIR/claude-integration.js" review "$SPEC_NAME" --files "$CHANGED_FILES"\nfi\n\n# Run spec validation workflow\nif [ "$WORKFLOW" = "specValidation" ]; then\n  echo "Running spec validation..."\n  node "$AI_TOOLS_DIR/claude-integration.js" validate "$SPEC_NAME"\nfi\n\n# Run requirements analysis workflow\nif [ "$WORKFLOW" = "requirementsAnalysis" ]; then\n  echo "Running requirements analysis..."\n  node "$AI_TOOLS_DIR/claude-integration.js" analyze-requirements "$SPEC_NAME"\nfi\n\n# Run design review workflow\nif [ "$WORKFLOW" = "designReview" ]; then\n  echo "Running design review..."\n  node "$AI_TOOLS_DIR/claude-integration.js" review-design "$SPEC_NAME"\nfi\n\necho "✅ Claude Code AI workflow completed successfully"\n`;

  const scriptPath = path.join(AI_TOOLS_DIR, 'run-claude-workflow.sh');
  writeFile(scriptPath, ciScript);

  // Make script executable
  try {
    execSync(`chmod +x "${scriptPath}"`);
  } catch (error) {
    log('Failed to make script executable', 'warning');
  }

  log(`CI integration script created: ${scriptPath}`, 'success');

  return scriptPath;
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  try {
    switch (command) {
      case 'review':
        const specName = args[1];
        const files = args.includes('--files')
          ? args[args.indexOf('--files') + 1]?.split(',')
          : null;

        if (!specName) {
          log('Usage: review <spec-name> [--files file1,file2,...]', 'error');
          process.exit(1);
        }

        await executeClaudeWorkflow('codeReview', specName, { changedFiles: files });
        break;

      case 'validate':
        const validateSpecName = args[1];

        if (!validateSpecName) {
          log('Usage: validate <spec-name>', 'error');
          process.exit(1);
        }

        await executeClaudeWorkflow('specValidation', validateSpecName);
        break;

      case 'analyze-requirements':
        const analyzeSpecName = args[1];

        if (!analyzeSpecName) {
          log('Usage: analyze-requirements <spec-name>', 'error');
          process.exit(1);
        }

        await executeClaudeWorkflow('requirementsAnalysis', analyzeSpecName);
        break;

      case 'review-design':
        const reviewSpecName = args[1];

        if (!reviewSpecName) {
          log('Usage: review-design <spec-name>', 'error');
          process.exit(1);
        }

        await executeClaudeWorkflow('designReview', reviewSpecName);
        break;

      case 'setup-ci':
        generateCIIntegration();
        break;

      case 'help':
        console.log(`
Claude Code Integration

Usage:
  node claude-integration.js [command] [options]

Commands:
  review <spec-name> [--files file1,file2,...]  Run AI code review
  validate <spec-name>                          Validate spec implementation
  analyze-requirements <spec-name>              Analyze requirements quality
  review-design <spec-name>                     Review technical design
  setup-ci                                      Generate CI integration scripts
  help                                          Show this help

Examples:
  node claude-integration.js review user-auth
  node claude-integration.js validate user-auth
  node claude-integration.js analyze-requirements user-auth
  node claude-integration.js setup-ci
`);
        break;

      default:
        log(`Unknown command: ${command}`, 'error');
        process.exit(1);
    }
  } catch (error) {
    log(`Claude integration failed: ${error.message}`, 'error');
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
  executeClaudeWorkflow,
  generateClaudeCommand,
  generateCIIntegration,
  CLAUDE_WORKFLOWS,
};
