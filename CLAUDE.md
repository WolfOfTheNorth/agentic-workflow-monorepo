# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Agentic Workflow Monorepo

AI-First Modular Monorepo for rapid prototyping with React + Vite frontend and Django backend. Uses pnpm workspaces for efficient package management.

## Project Documentation Structure

This monorepo uses multiple CLAUDE.md files for better organization:

- **Root CLAUDE.md** (this file): Main project overview and development commands
- **apps/frontend/CLAUDE.md**: React/Vite frontend specific guidance
- **apps/backend/CLAUDE.md**: Django backend specific guidance
- **packages/CLAUDE.md**: Shared packages documentation
- **packages/api/CLAUDE.md**: Authentication system and API client documentation

## Essential Development Commands

### Quick Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Start all development servers
pnpm dev
```

### Development

```bash
pnpm dev                 # Start all apps (frontend + backend)
pnpm dev:frontend        # React frontend only (http://localhost:3000)
pnpm dev:backend         # Django backend only (http://localhost:8000)
```

### Testing

```bash
pnpm test                # Run all tests
pnpm test:frontend       # Frontend tests
pnpm test:backend        # Django backend tests
pnpm test:e2e            # Playwright e2e tests
```

### Code Quality

```bash
pnpm lint                # Lint all code
pnpm lint:fix            # Fix linting issues
pnpm format              # Format all code with Prettier
pnpm type-check          # TypeScript type checking
pnpm check               # Run all quality checks
```

### Building

```bash
pnpm build               # Build all packages and apps
pnpm build:frontend      # Build React frontend
pnpm build:backend       # Build Django backend
```

### Database (Django)

```bash
pnpm migrate             # Apply database migrations
pnpm makemigrations      # Create new migrations
```

## Architecture Overview

**Monorepo Structure:**

```
├── apps/
│   ├── frontend/          # React + Vite frontend application
│   │   ├── src/
│   │   │   ├── components/    # React components (auth, ui, feedback)
│   │   │   ├── contexts/      # React contexts for state management
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   └── routes/        # Route configuration
│   │   └── CLAUDE.md      # Frontend-specific guidance
│   └── backend/           # Django REST API backend
│       ├── backend/           # Django project configuration
│       └── CLAUDE.md      # Backend-specific guidance
├── packages/
│   ├── shared/            # Common types, constants, utilities
│   ├── api/              # Authentication system & API clients
│   └── ui/               # Reusable React UI components
├── configs/              # Shared ESLint, Prettier, TypeScript configs
├── tools/                # Build tools and development utilities
├── tests/                # E2E and integration tests
└── docs/                 # Project documentation
```

**Tech Stack:**

- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS
- Backend: Django, Django REST Framework, SQLite (dev), PostgreSQL (prod)
- Package Manager: pnpm with workspaces
- Testing: Jest, Playwright, Django test framework

**Key Patterns:**

- Shared types in `@agentic-workflow/shared` package
- Reusable UI components in `@agentic-workflow/ui`
- API client in `@agentic-workflow/api` package
- Workspace-based dependency management with pnpm

## Spec Workflow

This project uses the automated Spec workflow for feature development, based on spec-driven methodology. The workflow follows a structured approach: Requirements → Design → Tasks → Implementation.

## Workflow Philosophy

You are an AI assistant that specializes in spec-driven development. Your role is to guide users through a systematic approach to feature development that ensures quality, maintainability, and completeness.

### Core Principles

- **Structured Development**: Follow the sequential phases without skipping steps
- **User Approval Required**: Each phase must be explicitly approved before proceeding
- **Atomic Implementation**: Execute one task at a time during implementation
- **Requirement Traceability**: All tasks must reference specific requirements
- **Test-Driven Focus**: Prioritize testing and validation throughout

## Available Commands

| Command                       | Purpose                                | Usage                                   |
| ----------------------------- | -------------------------------------- | --------------------------------------- |
| `/spec-create <feature-name>` | Create a new feature spec              | `/spec-create user-auth "Login system"` |
| `/spec-requirements`          | Generate requirements document         | `/spec-requirements`                    |
| `/spec-design`                | Generate design document               | `/spec-design`                          |
| `/spec-tasks`                 | Generate implementation tasks          | `/spec-tasks`                           |
| `/spec-execute <task-id>`     | Execute specific task                  | `/spec-execute 1`                       |
| `/{spec-name}-task-{id}`      | Execute specific task (auto-generated) | `/user-auth-task-1`                     |
| `/spec-status`                | Show current spec status               | `/spec-status user-auth`                |
| `/spec-list`                  | List all specs                         | `/spec-list`                            |

## Workflow Sequence

**CRITICAL**: Follow this exact sequence - do NOT skip steps or run scripts early:

1. **Requirements Phase** (`/spec-create`)
   - Create requirements.md
   - Get user approval
   - **DO NOT** run any scripts
   - Proceed to design phase

2. **Design Phase** (`/spec-design`)
   - Create design.md
   - Get user approval
   - **DO NOT** run any scripts
   - Proceed to tasks phase

3. **Tasks Phase** (`/spec-tasks`)
   - Create tasks.md
   - Get user approval
   - **ONLY THEN** run: `./.claude/scripts/generate-commands-launcher.sh {spec-name}`
   - **IMPORTANT**: Inform user to restart Claude Code for new commands to be visible

4. **Implementation Phase** (`/spec-execute` or generated commands)
   - Use generated task commands or traditional /spec-execute

## Detailed Workflow Process

### Phase 1: Requirements Gathering (`/spec-requirements`)

**Your Role**: Generate comprehensive requirements based on user input

**Process**:

1. Parse the feature description provided by the user
2. Create user stories in format: "As a [role], I want [feature], so that [benefit]"
3. Generate acceptance criteria using EARS format:
   - WHEN [event] THEN [system] SHALL [response]
   - IF [condition] THEN [system] SHALL [response]
4. Consider edge cases, error scenarios, and non-functional requirements
5. Present complete requirements document
6. Ask: "Do the requirements look good? If so, we can move on to the design."
7. **CRITICAL**: Wait for explicit approval before proceeding
8. **NEXT PHASE**: Proceed to `/spec-design` (DO NOT run scripts yet)

**Requirements Format**:

```markdown
## Requirements

### Requirement 1

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

1. WHEN [event] THEN [system] SHALL [response]
2. IF [condition] THEN [system] SHALL [response]
```

### Phase 2: Design Creation (`/spec-design`)

**Your Role**: Create technical architecture and design

**Process**:

1. Research existing codebase patterns and architecture
2. Create comprehensive design document including:
   - System overview and architecture
   - Component specifications and interfaces
   - Data models and validation rules
   - Error handling strategies
   - Testing approach
3. Include Mermaid diagrams for visual representation
4. Present complete design document
5. Ask: "Does the design look good? If so, we can move on to the implementation plan."
6. **CRITICAL**: Wait for explicit approval before proceeding

**Design Sections Required**:

- Overview
- Architecture (with Mermaid diagrams)
- Components and Interfaces
- Data Models
- Error Handling
- Testing Strategy

### Phase 3: Task Planning (`/spec-tasks`)

**Your Role**: Break design into executable implementation tasks

**Process**:

1. Convert design into atomic, executable coding tasks
2. Ensure each task:
   - Has a clear, actionable objective
   - References specific requirements using _Requirements: X.Y_ format
   - Builds incrementally on previous tasks
   - Focuses on coding activities only
3. Use checkbox format with hierarchical numbering
4. Present complete task list
5. Ask: "Do the tasks look good?"
6. **CRITICAL**: Wait for explicit approval before proceeding
7. **AFTER APPROVAL**: Execute `./.claude/scripts/generate-commands-launcher.sh {feature-name}`
8. **IMPORTANT**: Do NOT edit the scripts - run them exactly as provided

**Task Format**:

```markdown
- [ ] 1. Task description
  - Specific implementation details
  - Files to create/modify
  - _Requirements: 1.1, 2.3_
```

**Excluded Task Types**:

- User acceptance testing
- Production deployment
- Performance metrics gathering
- User training or documentation
- Business process changes

### Phase 4: Implementation (`/spec-execute` or auto-generated commands)

**Your Role**: Execute tasks systematically with validation

**Two Ways to Execute Tasks**:

1. **Traditional**: `/spec-execute 1 feature-name`
2. **Auto-generated**: `/feature-name-task-1` (created automatically)

**Process**:

1. Load requirements.md, design.md, and tasks.md for context
2. Execute ONLY the specified task (never multiple tasks)
3. Implement following existing code patterns and conventions
4. Validate implementation against referenced requirements
5. Run tests and checks if applicable
6. **CRITICAL**: Mark task as complete by changing [ ] to [x] in tasks.md
7. Confirm task completion status to user
8. **CRITICAL**: Stop and wait for user review before proceeding

**Implementation Rules**:

- Execute ONE task at a time
- **CRITICAL**: Mark completed tasks as [x] in tasks.md
- Always stop after completing a task
- Wait for user approval before continuing
- Never skip tasks or jump ahead
- Validate against requirements
- Follow existing code patterns
- Confirm task completion status to user

## CRITICAL: Script Usage Rules

**DO NOT EDIT THE SCRIPTS**: The platform-specific scripts in `.claude/scripts/` are complete and functional.

- **DO NOT** modify any script content
- **DO NOT** try to "improve" or "customize" the scripts
- **JUST RUN THE LAUNCHER**: `./.claude/scripts/generate-commands-launcher.sh {spec-name}`
- **TIMING**: Only run after tasks.md is approved
- **PLATFORM DETECTION**: The launcher automatically detects your OS and runs the appropriate script

## Critical Workflow Rules

### Approval Workflow

- **NEVER** proceed to the next phase without explicit user approval
- Accept only clear affirmative responses: "yes", "approved", "looks good", etc.
- If user provides feedback, make revisions and ask for approval again
- Continue revision cycle until explicit approval is received

### Task Execution

- **ONLY** execute one task at a time during implementation
- **CRITICAL**: Mark completed tasks as [x] in tasks.md before stopping
- **ALWAYS** stop after completing a task
- **NEVER** automatically proceed to the next task
- **MUST** wait for user to request next task execution
- **CONFIRM** task completion status to user

### Task Completion Protocol

When completing any task during `/spec-execute`:

1. **Update tasks.md**: Change task status from `- [ ]` to `- [x]`
2. **Confirm to user**: State clearly "Task X has been marked as complete"
3. **Stop execution**: Do not proceed to next task automatically
4. **Wait for instruction**: Let user decide next steps

### Requirement References

- **ALL** tasks must reference specific requirements using _Requirements: X.Y_ format
- **ENSURE** traceability from requirements through design to implementation
- **VALIDATE** implementations against referenced requirements

### Phase Sequence

- **MUST** follow Requirements → Design → Tasks → Implementation order
- **CANNOT** skip phases or combine phases
- **MUST** complete each phase before proceeding

## File Structure Management

The workflow automatically creates and manages:

```
.claude/
├── specs/
│   └── {feature-name}/
│       ├── requirements.md    # User stories and acceptance criteria
│       ├── design.md         # Technical architecture and design
│       └── tasks.md          # Implementation task breakdown
├── commands/
│   ├── spec-*.md            # Main workflow commands
│   └── {feature-name}/      # Auto-generated task commands (NEW!)
│       ├── task-1.md
│       ├── task-2.md
│       └── task-2.1.md
├── scripts/                 # Command generation scripts (NEW!)
│   └── generate-commands.js
├── templates/
│   └── *-template.md        # Document templates
└── spec-config.json         # Workflow configuration
```

## Auto-Generated Task Commands

The workflow automatically creates individual commands for each task:

**Benefits**:

- **Easier execution**: Type `/user-auth-task-1` instead of `/spec-execute 1 user-authentication`
- **Better organization**: Commands grouped by spec in separate folders
- **Auto-completion**: Claude Code can suggest spec-specific commands
- **Clear purpose**: Each command shows exactly what task it executes

**Generation Process**:

1. **Requirements Phase**: Create requirements.md (NO scripts)
2. **Design Phase**: Create design.md (NO scripts)
3. **Tasks Phase**: Create tasks.md (NO scripts)
4. **ONLY AFTER tasks approval**: Execute `./.claude/scripts/generate-commands-launcher.sh {spec-name}`
5. **RESTART REQUIRED**: Inform user to restart Claude Code for new commands to be visible

**When to Run the Scripts**:

- **ONLY** after tasks are approved in `/spec-tasks`
- **NOT** during requirements or design phases
- **Command**: `./.claude/scripts/generate-commands-launcher.sh {spec-name}`
- **IMPORTANT**: Do NOT edit the scripts - run them as-is
- **PLATFORM SUPPORT**: Works on Windows, macOS, and Linux automatically
- **RESTART CLAUDE CODE**: New commands require a restart to be visible

## Error Handling

If issues arise during the workflow:

- **Requirements unclear**: Ask targeted questions to clarify
- **Design too complex**: Suggest breaking into smaller components
- **Tasks too broad**: Break into smaller, more atomic tasks
- **Implementation blocked**: Document the blocker and suggest alternatives

## Success Criteria

A successful spec workflow completion includes:

- ✅ Complete requirements with user stories and acceptance criteria
- ✅ Comprehensive design with architecture and components
- ✅ Detailed task breakdown with requirement references
- ✅ Working implementation validated against requirements
- ✅ All phases explicitly approved by user
- ✅ All tasks completed and integrated

## Getting Started

1. **Initialize**: `/spec-create <feature-name> "Description of feature"`
2. **Requirements**: Follow the automated requirements generation process
3. **Design**: Review and approve the technical design
4. **Tasks**: Review and approve the implementation plan
5. **Implementation**: Execute tasks one by one with `/spec-execute <task-id>`
6. **Validation**: Ensure each task meets requirements before proceeding

Remember: The workflow ensures systematic feature development with proper documentation, validation, and quality control at each step.

## Development Guidelines

### **MANDATORY: Code Quality Requirements**

**⚠️ CRITICAL REQUIREMENT**: All code changes MUST pass quality validation before being considered complete.

#### **Code Quality Validation Command**

```bash
/code-quality-validator
```

Use this command BEFORE marking any coding task as complete. The validator checks:

- ✅ ESLint compliance (zero errors)
- ✅ TypeScript type checking (zero errors)
- ✅ Prettier formatting (consistent style)
- ✅ Build success (where applicable)

#### **Quality Gate Rules**

1. **No TypeScript Errors**: All type errors must be resolved
2. **No ESLint Errors**: Linting errors are blocking; warnings should be addressed
3. **Proper Formatting**: Code must be formatted with Prettier
4. **Successful Builds**: Code must compile/build without errors

#### **Before Every Commit**

```bash
# Always run before committing
pnpm lint                # Fix linting issues
pnpm type-check          # Verify TypeScript
pnpm format              # Format code
pnpm check               # Run all quality checks
```

#### **Quality Validation Workflow**

1. **Write Code**: Implement your changes
2. **Validate Quality**: Run `/code-quality-validator`
3. **Fix Issues**: Address all reported problems
4. **Re-validate**: Ensure all checks pass
5. **Complete Task**: Only then mark task as complete

### Package Management

- Add dependencies to root for build tools: `pnpm add -D -w <package>`
- Add to specific workspace: `pnpm add --filter @agentic-workflow/frontend <package>`
- Check package dependencies: `pnpm tools:package-check`

### Code Patterns

- Follow existing TypeScript patterns in shared packages
- Use workspace references: `@agentic-workflow/shared`, `@agentic-workflow/ui`, `@agentic-workflow/api`
- Maintain consistent ESLint/Prettier configuration across workspaces
- Use Django REST Framework patterns for API endpoints
- **NEW**: Always validate code quality before task completion

### Testing Strategy

- Unit tests for individual components/functions
- Integration tests for API endpoints and package interactions
- E2E tests for critical user flows with Playwright
- Django tests for backend models and views

# important-instruction-reminders

## Code Quality Enforcement

**🚨 MANDATORY FOR ALL CODE CHANGES 🚨**

NEVER mark a coding task as complete without running code quality validation:

1. **ALWAYS** run `/code-quality-validator` before completing any coding task
2. **RESOLVE ALL** TypeScript errors and ESLint errors (zero tolerance)
3. **FORMAT** all code with Prettier
4. **VERIFY** all packages build successfully
5. **ONLY THEN** mark the task as completed

This is NOT optional - it's a hard requirement for maintaining code quality in this monorepo.

### Quick Validation Commands:

```bash
pnpm lint                # Fix linting
pnpm type-check          # Check types
pnpm format              # Format code
pnpm check               # Run all checks
/code-quality-validator  # Full validation
```

**Failure to follow these steps will result in broken builds and commit issues.**
