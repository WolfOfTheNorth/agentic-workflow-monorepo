import { ApiClient } from '../src/client/base';
import { AuthApiClient } from '../src/client/auth';

// Mock the base ApiClient
jest.mock('../src/client/base');

describe('AuthApiClient', () => {
  let mockApiClient: jest.Mocked<ApiClient>;
  let authClient: AuthApiClient;

  beforeEach(() => {
    mockApiClient = new ApiClient({ baseUrl: 'https://api.example.com' }) as jest.Mocked<ApiClient>;
    authClient = new AuthApiClient(mockApiClient);
  });

  describe('login', () => {
    it('should call login endpoint with credentials', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      const mockResponse = {
        data: {
          access_token: 'token123',
          refresh_token: 'refresh123',
          expires_in: 3600,
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        },
        status: 200,
        success: true,
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authClient.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', credentials);
      expect(result).toBe(mockResponse);
    });
  });

  describe('register', () => {
    it('should call register endpoint with user data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const mockResponse = {
        data: {
          access_token: 'token123',
          refresh_token: 'refresh123',
          expires_in: 3600,
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        },
        status: 201,
        success: true,
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authClient.register(userData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/register', userData);
      expect(result).toBe(mockResponse);
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      const mockResponse = {
        data: null,
        status: 200,
        success: true,
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authClient.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout');
      expect(result).toBe(mockResponse);
    });
  });

  describe('getProfile', () => {
    it('should call profile endpoint', async () => {
      const mockResponse = {
        data: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
        success: true,
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await authClient.getProfile();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/profile');
      expect(result).toBe(mockResponse);
    });
  });

  describe('updateProfile', () => {
    it('should call update profile endpoint with data', async () => {
      const profileData = { name: 'Updated Name' };
      const mockResponse = {
        data: {
          id: '1',
          email: 'test@example.com',
          name: 'Updated Name',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
        success: true,
      };

      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await authClient.updateProfile(profileData);

      expect(mockApiClient.patch).toHaveBeenCalledWith('/api/auth/profile', profileData);
      expect(result).toBe(mockResponse);
    });
  });

  describe('refreshToken', () => {
    it('should call refresh token endpoint', async () => {
      const refreshData = { refresh_token: 'refresh123' };
      const mockResponse = {
        data: {
          access_token: 'newtoken123',
          expires_in: 3600,
        },
        status: 200,
        success: true,
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authClient.refreshToken(refreshData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/refresh', refreshData);
      expect(result).toBe(mockResponse);
    });
  });
});
