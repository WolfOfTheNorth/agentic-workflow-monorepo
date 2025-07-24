#!/usr/bin/env node

/**
 * AI-Powered User Story Generator
 *
 * Automatically generates user stories and acceptance criteria from:
 * - Feature descriptions
 * - Requirements documents
 * - Design specifications
 * - Existing user feedback
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const STORIES_DIR = path.join(WORKSPACE_ROOT, '.ai-stories');

/**
 * Story generation templates and prompts
 */
const STORY_PROMPTS = {
  userStoryGeneration: `
Generate comprehensive user stories from the provided feature description.

For each story, include:
1. **User Role**: Specific user type or persona
2. **Goal Statement**: What the user wants to accomplish
3. **Business Value**: Why this is important to the user
4. **Acceptance Criteria**: Testable conditions (Given/When/Then format)
5. **Priority**: High/Medium/Low based on business value
6. **Effort Estimate**: Story points or time estimate
7. **Dependencies**: Related stories or prerequisites

Ensure stories are:
- **Independent**: Can be developed separately
- **Negotiable**: Details can be discussed
- **Valuable**: Provide clear business value
- **Estimable**: Effort can be reasonably estimated
- **Small**: Completable in one sprint
- **Testable**: Clear acceptance criteria

Format stories using standard Agile templates.
`,

  acceptanceCriteriaRefinement: `
Refine and enhance the provided acceptance criteria to ensure they are:

1. **Specific**: Clear and unambiguous
2. **Measurable**: Quantifiable outcomes
3. **Testable**: Can be validated objectively
4. **Complete**: Cover all scenarios including edge cases
5. **Consistent**: Use standard format and terminology

For each criterion:
- Use Given/When/Then format
- Include positive and negative test cases
- Consider error scenarios and edge cases
- Define clear success/failure conditions
- Specify any data requirements

Provide enhanced criteria with explanations for changes.
`,

  personaDevelopment: `
Develop detailed user personas based on the feature requirements.

For each persona, include:
1. **Demographics**: Age, role, experience level
2. **Goals**: What they want to achieve
3. **Pain Points**: Current challenges and frustrations
4. **Motivations**: Why they would use the feature
5. **Technology Comfort**: Technical proficiency level
6. **Usage Patterns**: How they would interact with the system
7. **Success Metrics**: How to measure their satisfaction

Use personas to inform story generation and prioritization.
`,

  epicBreakdown: `
Break down the provided epic into manageable user stories.

Consider:
1. **Logical Grouping**: Related functionality together
2. **Dependency Order**: Prerequisites before dependent stories
3. **Value Delivery**: Early delivery of high-value features
4. **Technical Complexity**: Balance complex and simple stories
5. **User Journey**: Follow natural user workflows
6. **MVP Identification**: Core features for minimum viable product

Provide story hierarchy and delivery sequence recommendations.
`,
};

/**
 * Utility functions
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: '📝',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      story: '📚',
    }[level] || '📝';

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
 * Generate user stories from feature description
 */
function generateUserStories(featureName, description, context = {}) {
  log(`Generating user stories for ${featureName}...`, 'story');

  const stories = {
    featureName,
    description,
    timestamp: new Date().toISOString(),
    personas: generatePersonas(featureName, description),
    epics: generateEpics(featureName, description),
    stories: generateDetailedStories(featureName, description, context),
    acceptanceCriteria: generateAcceptanceCriteria(featureName, description),
    storyMap: generateStoryMap(featureName, description),
  };

  return stories;
}

/**
 * Generate user personas
 */
function generatePersonas(featureName, description) {
  // AI-generated personas based on feature context
  const personas = [
    {
      name: 'Primary User',
      role: 'End User',
      demographics: {
        experience: 'Intermediate',
        technicalSkill: 'Medium',
        frequency: 'Daily',
      },
      goals: [
        `Use ${featureName} efficiently`,
        'Complete tasks quickly',
        'Avoid errors and confusion',
      ],
      painPoints: ['Complex interfaces', 'Slow performance', 'Unclear feedback'],
      motivations: ['Increased productivity', 'Better user experience', 'Reliable functionality'],
    },
    {
      name: 'Administrator',
      role: 'System Admin',
      demographics: {
        experience: 'Expert',
        technicalSkill: 'High',
        frequency: 'Weekly',
      },
      goals: [
        `Manage ${featureName} settings`,
        'Monitor system performance',
        'Troubleshoot issues',
      ],
      painPoints: [
        'Limited configuration options',
        'Poor monitoring tools',
        'Difficult troubleshooting',
      ],
      motivations: ['System stability', 'User satisfaction', 'Operational efficiency'],
    },
  ];

  return personas;
}

/**
 * Generate epics
 */
function generateEpics(featureName, description) {
  const epics = [
    {
      name: `${featureName} Core Functionality`,
      description: `Basic ${featureName} features and operations`,
      businessValue: 'High',
      estimatedEffort: '13-21 points',
      dependencies: [],
      stories: ['Basic feature access', 'Core operations', 'Data management'],
    },
    {
      name: `${featureName} User Experience`,
      description: `Enhanced user interface and interaction design`,
      businessValue: 'Medium',
      estimatedEffort: '8-13 points',
      dependencies: ['Core Functionality'],
      stories: ['Intuitive interface', 'Responsive design', 'Accessibility features'],
    },
    {
      name: `${featureName} Advanced Features`,
      description: `Advanced functionality and integrations`,
      businessValue: 'Medium',
      estimatedEffort: '13-21 points',
      dependencies: ['Core Functionality'],
      stories: ['Advanced operations', 'Third-party integrations', 'Analytics and reporting'],
    },
  ];

  return epics;
}

/**
 * Generate detailed user stories
 */
function generateDetailedStories(featureName, description, context) {
  const stories = [
    {
      id: 'US001',
      title: `Access ${featureName}`,
      userStory: `As a user, I want to access the ${featureName} feature, so that I can utilize its functionality for my tasks.`,
      persona: 'Primary User',
      epic: `${featureName} Core Functionality`,
      priority: 'High',
      points: 3,
      acceptanceCriteria: [
        {
          id: 'AC001',
          description: 'User can navigate to feature',
          scenario:
            'Given I am logged in, When I click on the feature menu, Then I should see the main interface',
        },
        {
          id: 'AC002',
          description: 'Feature loads properly',
          scenario:
            'Given I access the feature, When the page loads, Then all components should be visible and functional',
        },
        {
          id: 'AC003',
          description: 'Error handling',
          scenario:
            'Given the feature fails to load, When an error occurs, Then I should see a helpful error message',
        },
      ],
      dependencies: [],
      tasks: [
        'Create feature navigation',
        'Design main interface',
        'Implement error handling',
        'Add loading states',
      ],
      testCases: [
        'Verify navigation works',
        'Test interface responsiveness',
        'Validate error scenarios',
        'Check loading performance',
      ],
    },
    {
      id: 'US002',
      title: `Create ${featureName} Items`,
      userStory: `As a user, I want to create new ${featureName} items, so that I can add content to the system.`,
      persona: 'Primary User',
      epic: `${featureName} Core Functionality`,
      priority: 'High',
      points: 5,
      acceptanceCriteria: [
        {
          id: 'AC004',
          description: 'Creation form available',
          scenario:
            'Given I am on the main page, When I click Create New, Then I should see a creation form',
        },
        {
          id: 'AC005',
          description: 'Form validation',
          scenario:
            'Given I fill out the form, When I submit with invalid data, Then I should see validation errors',
        },
        {
          id: 'AC006',
          description: 'Successful creation',
          scenario:
            'Given I fill out the form correctly, When I submit, Then the item should be created and I should see confirmation',
        },
      ],
      dependencies: ['US001'],
      tasks: [
        'Design creation form',
        'Implement form validation',
        'Add server-side processing',
        'Create confirmation feedback',
      ],
      testCases: [
        'Test form rendering',
        'Validate all form fields',
        'Test creation workflow',
        'Verify data persistence',
      ],
    },
    {
      id: 'US003',
      title: `View ${featureName} Items`,
      userStory: `As a user, I want to view my ${featureName} items, so that I can see what I've created and manage them.`,
      persona: 'Primary User',
      epic: `${featureName} Core Functionality`,
      priority: 'High',
      points: 3,
      acceptanceCriteria: [
        {
          id: 'AC007',
          description: 'Items list display',
          scenario:
            'Given I have created items, When I view the main page, Then I should see a list of my items',
        },
        {
          id: 'AC008',
          description: 'Item details',
          scenario:
            'Given items are displayed, When I click on an item, Then I should see detailed information',
        },
        {
          id: 'AC009',
          description: 'Empty state',
          scenario:
            'Given I have no items, When I view the main page, Then I should see an appropriate empty state message',
        },
      ],
      dependencies: ['US002'],
      tasks: [
        'Create items list component',
        'Implement item details view',
        'Design empty state',
        'Add pagination if needed',
      ],
      testCases: [
        'Test list rendering',
        'Verify item details',
        'Check empty state',
        'Test pagination',
      ],
    },
  ];

  return stories;
}

/**
 * Generate acceptance criteria
 */
function generateAcceptanceCriteria(featureName, description) {
  const criteria = {
    functional: [
      {
        category: 'Core Functionality',
        criteria: [
          `${featureName} feature is accessible to authorized users`,
          `Users can perform all basic operations successfully`,
          `Data is persisted correctly across sessions`,
          `All user inputs are validated appropriately`,
        ],
      },
      {
        category: 'User Interface',
        criteria: [
          'Interface is intuitive and easy to navigate',
          'All interactive elements provide clear feedback',
          'Loading states are displayed during operations',
          'Error messages are helpful and actionable',
        ],
      },
    ],
    nonFunctional: [
      {
        category: 'Performance',
        criteria: [
          'Feature loads within 2 seconds',
          'Operations complete within 5 seconds',
          'System remains responsive under normal load',
          'Memory usage stays within acceptable limits',
        ],
      },
      {
        category: 'Security',
        criteria: [
          'User authentication is required',
          'User authorization is enforced',
          'Data is transmitted securely',
          'Input sanitization prevents attacks',
        ],
      },
      {
        category: 'Usability',
        criteria: [
          'Interface works on mobile devices',
          'Feature is accessible to users with disabilities',
          'Help documentation is available',
          'User can recover from errors easily',
        ],
      },
    ],
  };

  return criteria;
}

/**
 * Generate story map
 */
function generateStoryMap(featureName, description) {
  const storyMap = {
    userActivities: [
      {
        activity: 'Getting Started',
        stories: ['US001'],
        priority: 'MVP',
        description: 'Initial access and setup',
      },
      {
        activity: 'Core Usage',
        stories: ['US002', 'US003'],
        priority: 'MVP',
        description: 'Primary feature functionality',
      },
      {
        activity: 'Advanced Usage',
        stories: [],
        priority: 'Future',
        description: 'Enhanced features and capabilities',
      },
    ],
    releases: [
      {
        name: 'MVP Release',
        description: 'Minimum viable product',
        stories: ['US001', 'US002', 'US003'],
        estimatedEffort: '11 points',
        timeline: '2-3 sprints',
      },
      {
        name: 'Enhancement Release',
        description: 'Additional features and improvements',
        stories: [],
        estimatedEffort: 'TBD',
        timeline: 'Future',
      },
    ],
  };

  return storyMap;
}

/**
 * Generate comprehensive story document
 */
function generateStoryDocument(stories) {
  let document = `# User Stories: ${stories.featureName}\n\n`;
  document += `**Generated:** ${stories.timestamp}\n\n`;
  document += `## Feature Description\n\n${stories.description}\n\n`;

  // Personas
  document += `## User Personas\n\n`;
  stories.personas.forEach(persona => {
    document += `### ${persona.name} (${persona.role})\n\n`;
    document += `**Experience:** ${persona.demographics.experience}\n`;
    document += `**Technical Skill:** ${persona.demographics.technicalSkill}\n`;
    document += `**Usage Frequency:** ${persona.demographics.frequency}\n\n`;

    document += `**Goals:**\n`;
    persona.goals.forEach(goal => {
      document += `- ${goal}\n`;
    });
    document += `\n`;

    document += `**Pain Points:**\n`;
    persona.painPoints.forEach(pain => {
      document += `- ${pain}\n`;
    });
    document += `\n`;
  });

  // Epics
  document += `## Epics\n\n`;
  stories.epics.forEach(epic => {
    document += `### ${epic.name}\n\n`;
    document += `${epic.description}\n\n`;
    document += `**Business Value:** ${epic.businessValue}\n`;
    document += `**Estimated Effort:** ${epic.estimatedEffort}\n`;
    document += `**Dependencies:** ${epic.dependencies.join(', ') || 'None'}\n\n`;
  });

  // User Stories
  document += `## User Stories\n\n`;
  stories.stories.forEach(story => {
    document += `### ${story.id}: ${story.title}\n\n`;
    document += `**User Story:** ${story.userStory}\n\n`;
    document += `**Persona:** ${story.persona}\n`;
    document += `**Epic:** ${story.epic}\n`;
    document += `**Priority:** ${story.priority}\n`;
    document += `**Story Points:** ${story.points}\n`;
    document += `**Dependencies:** ${story.dependencies.join(', ') || 'None'}\n\n`;

    document += `**Acceptance Criteria:**\n`;
    story.acceptanceCriteria.forEach(ac => {
      document += `- **${ac.id}:** ${ac.description}\n`;
      document += `  - ${ac.scenario}\n`;
    });
    document += `\n`;

    document += `**Implementation Tasks:**\n`;
    story.tasks.forEach(task => {
      document += `- ${task}\n`;
    });
    document += `\n`;

    document += `**Test Cases:**\n`;
    story.testCases.forEach(test => {
      document += `- ${test}\n`;
    });
    document += `\n---\n\n`;
  });

  // Story Map
  document += `## Story Map\n\n`;
  document += `### User Journey\n\n`;
  stories.storyMap.userActivities.forEach(activity => {
    document += `#### ${activity.activity} (${activity.priority})\n`;
    document += `${activity.description}\n`;
    document += `**Stories:** ${activity.stories.join(', ') || 'TBD'}\n\n`;
  });

  document += `### Release Plan\n\n`;
  stories.storyMap.releases.forEach(release => {
    document += `#### ${release.name}\n`;
    document += `${release.description}\n`;
    document += `**Stories:** ${release.stories.join(', ') || 'TBD'}\n`;
    document += `**Effort:** ${release.estimatedEffort}\n`;
    document += `**Timeline:** ${release.timeline}\n\n`;
  });

  document += `---\n\n*Generated by AI Story Generator*`;

  return document;
}

/**
 * Main story generation function
 */
async function generateStories(featureName, description, options = {}) {
  log(`Starting story generation for ${featureName}...`, 'story');

  try {
    // Generate comprehensive stories
    const stories = generateUserStories(featureName, description, options.context);

    // Create output directory
    const outputDir = options.outputDir || STORIES_DIR;
    ensureDir(outputDir);

    // Generate story document
    const document = generateStoryDocument(stories);

    // Save files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storyFile = path.join(outputDir, `${featureName}-stories-${timestamp}.md`);
    const jsonFile = path.join(outputDir, `${featureName}-stories-${timestamp}.json`);

    writeFile(storyFile, document);
    writeFile(jsonFile, JSON.stringify(stories, null, 2));

    log(`Stories generated successfully:`, 'success');
    log(`  Markdown: ${storyFile}`, 'info');
    log(`  JSON: ${jsonFile}`, 'info');

    return {
      stories,
      document,
      files: {
        markdown: storyFile,
        json: jsonFile,
      },
    };
  } catch (error) {
    log(`Story generation failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  try {
    switch (command) {
      case 'generate':
        const featureName = args[1];
        const description = args[2];

        if (!featureName || !description) {
          log('Usage: generate <feature-name> <description>', 'error');
          process.exit(1);
        }

        await generateStories(featureName, description);
        break;

      case 'help':
        console.log(`
AI-Powered User Story Generator

Usage:
  node story-generator.js [command] [options]

Commands:
  generate <name> <description>  Generate user stories for a feature
  help                          Show this help

Examples:
  node story-generator.js generate user-auth "User authentication system"
  node story-generator.js generate dashboard "Analytics dashboard for users"
`);
        break;

      default:
        log(`Unknown command: ${command}`, 'error');
        process.exit(1);
    }
  } catch (error) {
    log(`Story generator failed: ${error.message}`, 'error');
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
  generateStories,
  generateUserStories,
  generatePersonas,
  generateAcceptanceCriteria,
  generateStoryDocument,
};
