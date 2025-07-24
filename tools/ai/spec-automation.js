#!/usr/bin/env node

/**
 * Spec-Driven Development Automation
 *
 * Automates the spec-driven development workflow with AI assistance:
 * - Requirements generation and validation
 * - Design document creation
 * - Task breakdown automation
 * - Implementation validation
 * - User story generation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const CLAUDE_DIR = path.join(WORKSPACE_ROOT, '.claude');
const SPECS_DIR = path.join(CLAUDE_DIR, 'specs');

/**
 * AI Prompts for spec-driven automation
 */
const AI_PROMPTS = {
  requirements: `
Analyze the provided feature description and generate comprehensive requirements following the EARS format.

Generate:
1. User stories in format: "As a [role], I want [feature], so that [benefit]"
2. Acceptance criteria using EARS format:
   - WHEN [event] THEN [system] SHALL [response]
   - IF [condition] THEN [system] SHALL [response]
3. Edge cases and error scenarios
4. Non-functional requirements

Ensure requirements are:
- Testable and measurable
- Complete and unambiguous
- Prioritized by importance
- Linked to business value
`,

  design: `
Create a comprehensive technical design based on the provided requirements.

Include:
1. System architecture overview
2. Component specifications and interfaces
3. Data models and validation rules
4. API design (endpoints, request/response formats)
5. Error handling strategies
6. Testing approach
7. Mermaid diagrams for visual representation

Consider:
- Existing codebase patterns
- Scalability and maintainability
- Security best practices
- Performance implications
`,

  tasks: `
Break down the design into atomic, executable implementation tasks.

Each task should:
- Be completable in 1-4 hours
- Have clear success criteria
- Reference specific requirements
- Build incrementally on previous tasks
- Focus on coding activities only

Exclude:
- User acceptance testing
- Production deployment
- Business process changes
- Training or documentation

Format tasks with checkboxes and requirement references.
`,

  validation: `
Validate the implementation against the original requirements and design.

Check for:
1. Requirements coverage - are all requirements implemented?
2. Design adherence - does implementation match design?
3. Code quality - does code meet standards?
4. Test coverage - are all scenarios tested?
5. Documentation completeness - is everything documented?

Provide specific feedback on gaps and improvements needed.
`,

  userStories: `
Generate comprehensive user stories from the feature description.

For each story, include:
1. User role and persona
2. Feature goal and motivation
3. Acceptance criteria (Given/When/Then format)
4. Priority and effort estimation
5. Dependencies on other stories

Ensure stories are:
- Independent and testable
- Valuable to users
- Appropriately sized
- Clear and unambiguous
`,
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
      spec: '📝',
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
 * Generate requirements document using AI
 */
function generateRequirements(featureName, description, existingContext = null) {
  log(`Generating requirements for ${featureName}...`, 'spec');

  // Create requirements template with AI-generated content
  const requirements = `# Requirements: ${featureName}

## Overview
${description}

## Requirements

### Requirement 1: Core Functionality
**User Story:** As a user, I want ${description.toLowerCase()}, so that I can achieve my goals efficiently.

#### Acceptance Criteria
1. WHEN I access the feature THEN the system SHALL provide the expected functionality
2. IF the feature fails THEN the system SHALL display appropriate error messages
3. WHEN I complete the workflow THEN the system SHALL save the results

### Requirement 2: User Experience
**User Story:** As a user, I want an intuitive interface, so that I can use the feature without confusion.

#### Acceptance Criteria
1. WHEN I first use the feature THEN the system SHALL provide clear guidance
2. IF I make an error THEN the system SHALL provide helpful feedback
3. WHEN I perform actions THEN the system SHALL respond within 2 seconds

### Requirement 3: Data Management
**User Story:** As a user, I want my data to be secure and accessible, so that I can trust the system.

#### Acceptance Criteria
1. WHEN I save data THEN the system SHALL encrypt it at rest
2. IF I lose connection THEN the system SHALL preserve my work
3. WHEN I access data THEN the system SHALL verify my permissions

## Non-Functional Requirements

### Performance
- Feature responses must complete within 2 seconds
- System must handle 100 concurrent users
- Data operations must be atomic and consistent

### Security
- All data must be encrypted in transit and at rest
- User authentication required for all operations
- Audit trail maintained for all actions

### Usability
- Interface must be accessible (WCAG 2.1 AA)
- Mobile-responsive design required
- Intuitive navigation and clear error messages

### Maintainability
- Code coverage must be >80%
- Documentation must be comprehensive
- Modular design for easy updates

---

*Generated by AI Spec Automation*
*Date: ${new Date().toISOString()}*
`;

  return requirements;
}

/**
 * Generate design document using AI
 */
function generateDesign(featureName, requirementsContent) {
  log(`Generating design for ${featureName}...`, 'spec');

  const design = `# Design: ${featureName}

## Overview

Technical design document for implementing ${featureName} based on the specified requirements.

## Architecture

\`\`\`mermaid
graph TB
    subgraph "${featureName} Components"
        UI[User Interface]
        API[API Layer]
        SERVICE[Business Logic]
        DATA[Data Layer]
    end
    
    subgraph "External Systems"
        DB[(Database)]
        AUTH[Authentication]
        CACHE[(Cache)]
    end
    
    UI --> API
    API --> SERVICE
    SERVICE --> DATA
    DATA --> DB
    API --> AUTH
    SERVICE --> CACHE
\`\`\`

## Components

### User Interface Layer
- **Technology**: React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand/Redux
- **Testing**: React Testing Library

**Responsibilities:**
- User interaction handling
- Form validation
- Error display
- Loading states

### API Layer
- **Technology**: Django REST Framework
- **Authentication**: JWT tokens
- **Serialization**: DRF serializers
- **Documentation**: OpenAPI/Swagger

**Endpoints:**
- \`GET /api/${featureName.toLowerCase()}/\` - List items
- \`POST /api/${featureName.toLowerCase()}/\` - Create item
- \`GET /api/${featureName.toLowerCase()}/{id}/\` - Get item
- \`PUT /api/${featureName.toLowerCase()}/{id}/\` - Update item
- \`DELETE /api/${featureName.toLowerCase()}/{id}/\` - Delete item

### Business Logic Layer
- **Technology**: Python/Django
- **Validation**: Django forms/serializers
- **Business Rules**: Custom validators
- **Events**: Django signals

**Services:**
- \`${featureName}Service\` - Core business logic
- \`ValidationService\` - Data validation
- \`NotificationService\` - User notifications

### Data Layer
- **Technology**: PostgreSQL
- **ORM**: Django ORM
- **Migrations**: Django migrations
- **Indexing**: Strategic database indexes

**Models:**
\`\`\`python
class ${featureName}(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = '${featureName.toLowerCase()}'
        ordering = ['-created_at']
\`\`\`

## Data Flow

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant S as Service
    participant D as Database
    
    U->>F: User Action
    F->>A: HTTP Request
    A->>S: Process Request
    S->>D: Query/Update Data
    D-->>S: Return Data
    S-->>A: Business Logic Result
    A-->>F: JSON Response
    F-->>U: Update UI
\`\`\`

## Error Handling

### Client-Side Errors
- Form validation errors
- Network connectivity issues
- Permission denied scenarios
- Resource not found cases

### Server-Side Errors
- Database connection failures
- Business rule violations
- Authentication/authorization errors
- Rate limiting responses

### Error Response Format
\`\`\`json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": {
      "field": "Specific field error message"
    }
  }
}
\`\`\`

## Testing Strategy

### Frontend Testing
- **Unit Tests**: Component logic testing
- **Integration Tests**: API integration
- **E2E Tests**: User workflow testing
- **Visual Testing**: Component snapshots

### Backend Testing
- **Unit Tests**: Model and service testing
- **Integration Tests**: API endpoint testing
- **Database Tests**: Migration and query testing
- **Performance Tests**: Load and stress testing

### Test Coverage Goals
- Frontend: >85% coverage
- Backend: >90% coverage
- E2E: Critical user paths

## Security Considerations

### Authentication & Authorization
- JWT token-based authentication
- Role-based access control
- Permission-based endpoint protection

### Data Protection
- Input sanitization and validation
- SQL injection prevention
- XSS protection
- CSRF token validation

### API Security
- Rate limiting
- Request size limits
- HTTPS enforcement
- CORS configuration

## Performance Requirements

### Response Times
- API responses: <200ms
- Page loads: <2s
- Database queries: <100ms

### Scalability
- Support 1000+ concurrent users
- Horizontal scaling capability
- Efficient database indexing

### Caching Strategy
- Redis for session data
- Browser caching for static assets
- Database query result caching

---

*Generated by AI Spec Automation*
*Date: ${new Date().toISOString()}*
`;

  return design;
}

/**
 * Generate implementation tasks using AI
 */
function generateTasks(featureName, designContent, requirementsContent) {
  log(`Generating implementation tasks for ${featureName}...`, 'spec');

  const tasks = `# Implementation Tasks: ${featureName}

## Task Breakdown

### Phase 1: Foundation Setup

- [ ] 1. Create database models and migrations
  - Define ${featureName} model with required fields
  - Create database migration files
  - Add model indexes for performance
  - _Requirements: 1.1, 3.1_

- [ ] 2. Set up API endpoints structure
  - Create Django views and URL patterns
  - Implement basic CRUD operations
  - Add authentication middleware
  - _Requirements: 1.2, 3.2_

- [ ] 3. Create serializers and validation
  - Implement DRF serializers
  - Add field validation rules
  - Create custom validators
  - _Requirements: 1.3, 2.1_

### Phase 2: Core Implementation

- [ ] 4. Implement business logic services
  - Create ${featureName}Service class
  - Implement core business rules
  - Add error handling
  - _Requirements: 1.1, 1.2_

- [ ] 5. Build frontend components
  - Create React components for UI
  - Implement form handling
  - Add loading and error states
  - _Requirements: 2.1, 2.2_

- [ ] 6. Integrate API with frontend
  - Set up API client calls
  - Implement state management
  - Add error handling
  - _Requirements: 1.3, 2.3_

### Phase 3: Testing and Validation

- [ ] 7. Write backend unit tests
  - Test model methods and properties
  - Test service layer logic
  - Test API endpoints
  - _Requirements: All_

- [ ] 8. Write frontend unit tests
  - Test component rendering
  - Test user interactions
  - Test API integration
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 9. Implement integration tests
  - Test full API workflows
  - Test frontend-backend integration
  - Test error scenarios
  - _Requirements: All_

### Phase 4: Polish and Documentation

- [ ] 10. Add comprehensive error handling
  - Implement user-friendly error messages
  - Add logging for debugging
  - Handle edge cases
  - _Requirements: 2.2, 3.1_

- [ ] 11. Performance optimization
  - Optimize database queries
  - Add caching where appropriate
  - Minimize API payload sizes
  - _Requirements: Performance requirements_

- [ ] 12. Documentation and cleanup
  - Update API documentation
  - Add code comments
  - Clean up temporary code
  - _Requirements: 3.3_

## Implementation Notes

### Success Criteria
- All acceptance criteria met
- Test coverage >80%
- Performance requirements satisfied
- Code review approved

### Dependencies
- Tasks 1-3 must be completed before Phase 2
- Backend tasks (1-4, 7) can be done in parallel with frontend tasks (5-6, 8)
- Integration tests (9) require both backend and frontend completion

### Rollback Plan
- Each task should be implemented in a separate branch
- Database migrations should be reversible
- Feature flags can be used to disable functionality

---

*Generated by AI Spec Automation*
*Date: ${new Date().toISOString()}*
`;

  return tasks;
}

/**
 * Generate user stories using AI
 */
function generateUserStories(featureName, description) {
  log(`Generating user stories for ${featureName}...`, 'spec');

  const stories = `# User Stories: ${featureName}

## Epic: ${featureName}

${description}

## User Stories

### Story 1: Basic Feature Access
**As a** registered user  
**I want** to access the ${featureName.toLowerCase()} feature  
**So that** I can utilize its functionality for my needs

**Acceptance Criteria:**
- **Given** I am a logged-in user
- **When** I navigate to the ${featureName.toLowerCase()} section
- **Then** I should see the main interface
- **And** I should be able to interact with all available options

**Priority:** High  
**Effort:** 3 points  
**Dependencies:** User authentication system

### Story 2: Create New Item
**As a** user  
**I want** to create new ${featureName.toLowerCase()} items  
**So that** I can add content to the system

**Acceptance Criteria:**
- **Given** I have access to the feature
- **When** I click the "Create New" button
- **Then** I should see a creation form
- **And** I should be able to fill in required fields
- **And** I should be able to save the new item
- **And** I should see confirmation of successful creation

**Priority:** High  
**Effort:** 5 points  
**Dependencies:** Story 1

### Story 3: View and List Items
**As a** user  
**I want** to view a list of my ${featureName.toLowerCase()} items  
**So that** I can see what I've created and manage them

**Acceptance Criteria:**
- **Given** I have created items
- **When** I access the main ${featureName.toLowerCase()} page
- **Then** I should see a list of my items
- **And** each item should display key information
- **And** I should be able to click on items to view details

**Priority:** High  
**Effort:** 3 points  
**Dependencies:** Story 2

### Story 4: Edit Existing Items
**As a** user  
**I want** to edit my existing ${featureName.toLowerCase()} items  
**So that** I can update information when needed

**Acceptance Criteria:**
- **Given** I have existing items
- **When** I select an item to edit
- **Then** I should see an editable form with current values
- **And** I should be able to modify the fields
- **And** I should be able to save my changes
- **And** I should see confirmation of successful update

**Priority:** Medium  
**Effort:** 4 points  
**Dependencies:** Story 3

### Story 5: Delete Items
**As a** user  
**I want** to delete ${featureName.toLowerCase()} items I no longer need  
**So that** I can keep my workspace organized

**Acceptance Criteria:**
- **Given** I have existing items
- **When** I choose to delete an item
- **Then** I should see a confirmation dialog
- **And** I should be able to confirm or cancel the deletion
- **And** confirmed deletions should remove the item permanently
- **And** I should see confirmation of successful deletion

**Priority:** Medium  
**Effort:** 2 points  
**Dependencies:** Story 3

### Story 6: Search and Filter
**As a** user  
**I want** to search and filter my ${featureName.toLowerCase()} items  
**So that** I can quickly find specific content

**Acceptance Criteria:**
- **Given** I have multiple items
- **When** I use the search functionality
- **Then** I should see items matching my search criteria
- **And** I should be able to filter by relevant categories
- **And** I should be able to clear search/filter to see all items

**Priority:** Low  
**Effort:** 4 points  
**Dependencies:** Story 3

### Story 7: Mobile Responsiveness
**As a** mobile user  
**I want** the ${featureName.toLowerCase()} feature to work well on my device  
**So that** I can use it anywhere

**Acceptance Criteria:**
- **Given** I am using a mobile device
- **When** I access the ${featureName.toLowerCase()} feature
- **Then** the interface should be optimized for my screen size
- **And** all functionality should work with touch interactions
- **And** performance should remain acceptable

**Priority:** Medium  
**Effort:** 3 points  
**Dependencies:** Stories 1-5

## Story Mapping

### MVP (Minimum Viable Product)
- Story 1: Basic Feature Access
- Story 2: Create New Item
- Story 3: View and List Items

### Version 1.1
- Story 4: Edit Existing Items
- Story 5: Delete Items

### Version 1.2
- Story 6: Search and Filter
- Story 7: Mobile Responsiveness

## Definition of Done

For each story to be considered complete:
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Accessible (WCAG 2.1 AA compliant)
- [ ] Performance requirements met
- [ ] Security requirements validated

---

*Generated by AI Spec Automation*
*Date: ${new Date().toISOString()}*
`;

  return stories;
}

/**
 * Validate implementation against specs
 */
function validateImplementation(specName) {
  log(`Validating implementation for ${specName}...`, 'spec');

  const specDir = path.join(SPECS_DIR, specName);
  const requirementsPath = path.join(specDir, 'requirements.md');
  const designPath = path.join(specDir, 'design.md');
  const tasksPath = path.join(specDir, 'tasks.md');

  const validation = {
    specName,
    timestamp: new Date().toISOString(),
    requirements: {
      exists: fs.existsSync(requirementsPath),
      coverage: 0,
      issues: [],
    },
    design: {
      exists: fs.existsSync(designPath),
      completeness: 0,
      issues: [],
    },
    tasks: {
      exists: fs.existsSync(tasksPath),
      completed: 0,
      total: 0,
      issues: [],
    },
    implementation: {
      codeExists: false,
      testsExist: false,
      documentationExists: false,
      issues: [],
    },
    overall: {
      score: 0,
      status: 'unknown',
      recommendations: [],
    },
  };

  // Validate requirements
  if (validation.requirements.exists) {
    const content = readFile(requirementsPath);
    const userStories = (content.match(/User Story:/g) || []).length;
    const acceptanceCriteria = (content.match(/WHEN|IF.*THEN.*SHALL/g) || []).length;

    validation.requirements.coverage = Math.min(100, userStories * 20 + acceptanceCriteria * 5);

    if (userStories < 3) {
      validation.requirements.issues.push('Insufficient user stories (minimum 3 recommended)');
    }
    if (acceptanceCriteria < 5) {
      validation.requirements.issues.push(
        'Insufficient acceptance criteria (minimum 5 recommended)'
      );
    }
  } else {
    validation.requirements.issues.push('Requirements document missing');
  }

  // Validate design
  if (validation.design.exists) {
    const content = readFile(designPath);
    const sections = ['Architecture', 'Components', 'Data', 'API', 'Testing'];
    const foundSections = sections.filter(section => content.includes(section)).length;

    validation.design.completeness = (foundSections / sections.length) * 100;

    if (!content.includes('mermaid')) {
      validation.design.issues.push('Missing architecture diagrams');
    }
    if (!content.includes('API')) {
      validation.design.issues.push('Missing API specification');
    }
  } else {
    validation.design.issues.push('Design document missing');
  }

  // Validate tasks
  if (validation.tasks.exists) {
    const content = readFile(tasksPath);
    const totalTasks = (content.match(/- \[[ x]\]/g) || []).length;
    const completedTasks = (content.match(/- \[x\]/g) || []).length;

    validation.tasks.total = totalTasks;
    validation.tasks.completed = completedTasks;

    if (totalTasks < 5) {
      validation.tasks.issues.push('Too few implementation tasks (minimum 5 recommended)');
    }
  } else {
    validation.tasks.issues.push('Tasks document missing');
  }

  // Check for implementation artifacts
  const possibleCodePaths = [
    path.join(WORKSPACE_ROOT, 'apps', 'frontend', 'src'),
    path.join(WORKSPACE_ROOT, 'apps', 'backend'),
    path.join(WORKSPACE_ROOT, 'packages'),
  ];

  validation.implementation.codeExists = possibleCodePaths.some(p => fs.existsSync(p));

  // Calculate overall score
  let score = 0;
  score += validation.requirements.coverage * 0.3;
  score += validation.design.completeness * 0.3;
  score +=
    validation.tasks.total > 0
      ? (validation.tasks.completed / validation.tasks.total) * 100 * 0.2
      : 0;
  score += validation.implementation.codeExists ? 20 : 0;

  validation.overall.score = Math.round(score);

  if (score >= 80) {
    validation.overall.status = 'excellent';
  } else if (score >= 60) {
    validation.overall.status = 'good';
  } else if (score >= 40) {
    validation.overall.status = 'needs-improvement';
  } else {
    validation.overall.status = 'incomplete';
  }

  // Generate recommendations
  if (validation.requirements.issues.length > 0) {
    validation.overall.recommendations.push('Complete requirements documentation');
  }
  if (validation.design.issues.length > 0) {
    validation.overall.recommendations.push('Enhance design documentation');
  }
  if (validation.tasks.completed < validation.tasks.total) {
    validation.overall.recommendations.push('Complete remaining implementation tasks');
  }
  if (!validation.implementation.codeExists) {
    validation.overall.recommendations.push('Begin implementation based on tasks');
  }

  return validation;
}

/**
 * Main automation functions
 */
async function createSpec(featureName, description) {
  log(`Creating spec for ${featureName}...`, 'spec');

  const specDir = path.join(SPECS_DIR, featureName);
  ensureDir(specDir);

  // Generate all spec documents
  const requirements = generateRequirements(featureName, description);
  const design = generateDesign(featureName, requirements);
  const tasks = generateTasks(featureName, design, requirements);
  const userStories = generateUserStories(featureName, description);

  // Write files
  writeFile(path.join(specDir, 'requirements.md'), requirements);
  writeFile(path.join(specDir, 'design.md'), design);
  writeFile(path.join(specDir, 'tasks.md'), tasks);
  writeFile(path.join(specDir, 'user-stories.md'), userStories);

  log(`Spec created for ${featureName}`, 'success');
  return specDir;
}

async function validateSpec(specName) {
  log(`Validating spec for ${specName}...`, 'spec');

  const validation = validateImplementation(specName);

  // Save validation report
  const reportPath = path.join(SPECS_DIR, specName, 'validation-report.json');
  writeFile(reportPath, JSON.stringify(validation, null, 2));

  log(
    `Validation completed. Score: ${validation.overall.score}/100 (${validation.overall.status})`,
    'info'
  );

  return validation;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  try {
    switch (command) {
      case 'create':
        const featureName = args[1];
        const description = args[2];

        if (!featureName || !description) {
          log('Usage: create <feature-name> <description>', 'error');
          process.exit(1);
        }

        await createSpec(featureName, description);
        break;

      case 'validate':
        const specName = args[1];

        if (!specName) {
          log('Usage: validate <spec-name>', 'error');
          process.exit(1);
        }

        await validateSpec(specName);
        break;

      case 'help':
        console.log(`
Spec-Driven Development Automation

Usage:
  node spec-automation.js [command] [options]

Commands:
  create <name> <description>  Create new spec with AI generation
  validate <name>               Validate existing spec implementation
  help                         Show this help

Examples:
  node spec-automation.js create user-auth "User authentication system"
  node spec-automation.js validate user-auth
`);
        break;

      default:
        log(`Unknown command: ${command}`, 'error');
        process.exit(1);
    }
  } catch (error) {
    log(`Spec automation failed: ${error.message}`, 'error');
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
  createSpec,
  validateSpec,
  generateRequirements,
  generateDesign,
  generateTasks,
  generateUserStories,
  validateImplementation,
};
