# Frontend CLAUDE.md

This file provides guidance for working with the React + Vite frontend application.

## Frontend Architecture

This is a modern React application built with Vite for fast development and optimized builds.

### Tech Stack

- **React 19**: Modern React with hooks and concurrent features
- **Vite 7**: Fast build tool with HMR (Hot Module Replacement)
- **TypeScript**: Type-safe JavaScript development
- **Tailwind CSS**: Utility-first CSS framework
- **pnpm**: Fast, disk space efficient package manager

### Directory Structure

```
apps/frontend/
├── src/
│   ├── components/           # React components
│   │   ├── auth/            # Authentication components
│   │   │   ├── AuthGuard.tsx       # Route protection
│   │   │   ├── SimpleLoginForm.jsx
│   │   │   ├── SimpleSignupForm.jsx
│   │   │   └── SimpleResetPasswordForm.jsx
│   │   ├── error/           # Error handling components
│   │   │   └── AuthErrorBoundary.tsx
│   │   ├── feedback/        # User feedback components
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ToastContainer.tsx
│   │   └── ui/             # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Input.jsx
│   │       └── LoadingSpinner.jsx
│   ├── contexts/            # React contexts for state management
│   │   └── MockAuthContext.tsx
│   ├── hooks/              # Custom React hooks
│   │   └── useMultiTabSync.ts
│   ├── routes/             # Route configuration
│   │   ├── AuthRoutes.jsx      # Authentication routes
│   │   ├── DashboardRoutes.jsx # Protected dashboard routes
│   │   ├── PublicRoutes.jsx    # Public routes
│   │   └── index.js
│   ├── styles/             # Additional CSS
│   │   └── mobile.css      # Mobile-specific styles
│   ├── App.jsx            # Main application component
│   └── main.jsx           # Application entry point
├── public/                # Static assets
├── configs/               # Configuration files
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration
└── tsconfig.json         # TypeScript configuration
```

## Development Commands

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start frontend only
pnpm dev:frontend
```

### Code Quality

```bash
# Lint and fix issues
pnpm lint
pnpm lint:fix

# Type checking
pnpm type-check

# Format code
pnpm format
```

### Testing

```bash
# Run frontend tests
pnpm test:frontend

# Run with coverage
pnpm test:frontend --coverage
```

### Building

```bash
# Build for production
pnpm build:frontend

# Preview production build
pnpm preview
```

## Key Components and Patterns

### Authentication Components

The authentication system uses modular components:

- **AuthGuard.tsx**: Protects routes requiring authentication
- **SimpleLoginForm.jsx**: Basic login form with validation
- **SimpleSignupForm.jsx**: User registration form
- **SimpleResetPasswordForm.jsx**: Password reset functionality

### State Management

- **MockAuthContext.tsx**: Context for authentication state
- Custom hooks in `hooks/` directory for reusable logic
- Multi-tab synchronization with `useMultiTabSync.ts`

### Error Handling

- **AuthErrorBoundary.tsx**: Catches and handles authentication errors
- Toast notifications for user feedback
- Loading states and spinners

### UI Components

Reusable UI components following consistent patterns:

- **Button.tsx**: Standardized button with variants (primary, secondary, outline, ghost)
- **Input.jsx**: Form input with validation states
- **LoadingSpinner**: Consistent loading indicators

### Routing

Route organization by access level:

- **PublicRoutes.jsx**: Routes accessible without authentication
- **AuthRoutes.jsx**: Authentication-related routes (login, signup)
- **DashboardRoutes.jsx**: Protected application routes

## Development Guidelines

### Component Development

1. **Use TypeScript for new components**: Prefer `.tsx` over `.jsx` for type safety
2. **Follow naming conventions**: PascalCase for components, camelCase for functions
3. **Component structure**:

   ```tsx
   // Component imports
   import React from 'react';

   // Type definitions
   interface ComponentProps {
     // props definition
   }

   // Component implementation
   export const Component = ({ ...props }: ComponentProps) => {
     // component logic
   };

   // Default export
   export default Component;
   ```

### State Management

1. **Use React hooks**: useState, useEffect, useContext, useCallback, useMemo
2. **Context for shared state**: Authentication, theme, user preferences
3. **Custom hooks**: Extract reusable logic into custom hooks

### Styling

1. **Tailwind CSS**: Use utility classes for styling
2. **Component-specific CSS**: Place in `styles/` directory when needed
3. **Responsive design**: Mobile-first approach with Tailwind breakpoints

### Error Handling

1. **Error boundaries**: Use AuthErrorBoundary for authentication errors
2. **Toast notifications**: User-friendly error messages
3. **Loading states**: Always provide feedback for async operations

### Package Dependencies

When adding new dependencies:

```bash
# Add to frontend workspace
pnpm add --filter @agentic-workflow/frontend <package>

# Add dev dependency
pnpm add -D --filter @agentic-workflow/frontend <package>
```

### Testing Strategy

1. **Component testing**: Test user interactions and component behavior
2. **Hook testing**: Test custom hooks with React Testing Library
3. **Integration testing**: Test component interactions
4. **E2E testing**: Use Playwright for full user workflows

## Common Tasks

### Adding a New Component

1. Create component file in appropriate directory
2. Follow TypeScript pattern with proper interfaces
3. Add to component exports if needed
4. Write tests for the component
5. Update documentation if it's a public component

### Adding Authentication

1. Use AuthGuard component to protect routes
2. Access auth context through useAuth hook
3. Handle loading and error states
4. Implement proper logout functionality

### Styling Updates

1. Use Tailwind utility classes
2. Create component variants for reusability
3. Ensure mobile responsiveness
4. Test in different screen sizes

### Performance Optimization

1. Use React.memo for expensive components
2. Implement proper key props for lists
3. Code splitting with React.lazy
4. Optimize bundle size with Vite

## Integration with Backend

The frontend integrates with:

- **API package**: `@agentic-workflow/api` for authentication and data
- **Shared package**: `@agentic-workflow/shared` for common types
- **UI package**: `@agentic-workflow/ui` for shared components

Always use the workspace packages instead of duplicating code.

## Environment Variables

Create `.env.local` file for development:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## Troubleshooting

### Common Issues

1. **HMR not working**: Restart Vite dev server
2. **Type errors**: Run `pnpm type-check` to identify issues
3. **Dependency issues**: Clear node_modules and reinstall
4. **Build failures**: Check for TypeScript errors and missing dependencies

### Debugging

1. Use React DevTools browser extension
2. Enable Vite debug mode: `DEBUG=vite* pnpm dev`
3. Check browser console for runtime errors
4. Use TypeScript strict mode for better error catching
