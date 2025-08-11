import { RequireAuth } from '../components/auth/AuthGuard';

/**
 * Dashboard and authenticated route components
 * Components that require authentication
 */

export const DashboardRoute = ({ onAuthRequired, onSignOut }) => (
  <RequireAuth onAuthRequired={onAuthRequired} redirectDelay={2000}>
    <div className='min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-8'>
      <div className='max-w-4xl mx-auto'>
        <div className='bg-white rounded-xl shadow-lg p-8'>
          <div className='flex justify-between items-center mb-8'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Dashboard</h1>
              <p className='text-gray-600 mt-2'>Welcome to Agentic Workflow!</p>
            </div>
            <button
              onClick={onSignOut}
              className='bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors'
            >
              Sign Out
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            <div className='bg-blue-50 p-6 rounded-lg'>
              <h3 className='text-lg font-semibold text-blue-900 mb-2'>Workflows</h3>
              <p className='text-blue-700'>Manage your automated workflows</p>
            </div>
            <div className='bg-green-50 p-6 rounded-lg'>
              <h3 className='text-lg font-semibold text-green-900 mb-2'>Tasks</h3>
              <p className='text-green-700'>Track and organize your tasks</p>
            </div>
            <div className='bg-purple-50 p-6 rounded-lg'>
              <h3 className='text-lg font-semibold text-purple-900 mb-2'>Analytics</h3>
              <p className='text-purple-700'>View your productivity insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </RequireAuth>
);
