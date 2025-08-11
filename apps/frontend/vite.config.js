import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Bundle analyzer plugin for performance optimization
    mode === 'analyze' &&
      visualizer({
        filename: 'dist/bundle-analysis.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),

  build: {
    // Enable code splitting optimization
    rollupOptions: {
      output: {
        manualChunks: id => {
          // Node modules chunking
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Supabase auth
            if (id.includes('@supabase/supabase-js')) {
              return 'auth-vendor';
            }
            // Other vendors
            return 'vendor';
          }

          // Application code chunking
          if (id.includes('/src/components/auth/')) {
            // Split auth forms into individual chunks for lazy loading
            if (id.includes('LoginForm')) return 'login-form';
            if (id.includes('SignupForm')) return 'signup-form';
            if (id.includes('ResetPasswordForm')) return 'reset-form';
            if (id.includes('AuthGuard')) return 'auth-guard';
            return 'auth-components';
          }

          if (id.includes('/src/components/ui/')) {
            return 'ui-components';
          }

          if (id.includes('/src/contexts/')) {
            return 'contexts';
          }

          if (id.includes('/src/hooks/')) {
            return 'hooks';
          }

          if (id.includes('/src/routes/')) {
            return 'routes';
          }
        },
      },
    },

    // Target modern browsers for better optimization
    target: 'esnext',

    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Enable source maps for production debugging
    sourcemap: mode === 'development' ? true : 'hidden',
  },

  // Performance optimizations for development
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js'],
  },
}));
