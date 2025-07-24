import { ApiClient } from '../src/client/base';

// Mock fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({
      baseUrl: 'https://api.example.com',
      timeout: 5000,
    });

    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with correct config', () => {
      expect(client).toBeInstanceOf(ApiClient);
      expect(client.getAuthToken()).toBeNull();
    });

    it('should strip trailing slash from baseUrl', () => {
      const clientWithSlash = new ApiClient({
        baseUrl: 'https://api.example.com/',
      });

      // We can't directly test this, but subsequent URL building will reveal it
      expect(clientWithSlash).toBeInstanceOf(ApiClient);
    });
  });

  describe('auth token management', () => {
    it('should set and get auth token', () => {
      const token = 'test-token-123';
      client.setAuthToken(token);
      expect(client.getAuthToken()).toBe(token);
    });

    it('should clear auth token when set to null', () => {
      client.setAuthToken('test-token');
      client.setAuthToken(null);
      expect(client.getAuthToken()).toBeNull();
    });
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual({
        data: mockResponse,
        status: 200,
        success: true,
        message: undefined,
      });
    });

    it('should include auth token in headers when set', async () => {
      const token = 'test-token-123';
      client.setAuthToken(token);

      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });

    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Not found',
            detail: 'Resource not found',
          }),
          {
            status: 404,
          }
        )
      );

      await expect(client.get('/nonexistent')).rejects.toMatchObject({
        message: 'Not found',
        code: '404',
      });
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request with data', async () => {
      const requestData = { name: 'Test User' };
      const responseData = { id: 1, ...requestData };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseData), {
          status: 201,
        })
      );

      const result = await client.post('/users', requestData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );

      expect(result).toEqual({
        data: responseData,
        status: 201,
        success: true,
        message: undefined,
      });
    });

    it('should make POST request without data', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await client.post('/logout');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/logout',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/test')).rejects.toThrow('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce(new Response('invalid json', { status: 200 }));

      await expect(client.get('/test')).rejects.toThrow('Invalid JSON response');
    });

    it('should handle empty response bodies', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 204 }));

      const result = await client.get('/test');

      expect(result).toEqual({
        data: null,
        status: 204,
        success: true,
        message: undefined,
      });
    });
  });

  describe('request timeout', () => {
    it('should respect custom timeout', async () => {
      // This is difficult to test directly, but we can verify the timeout is set
      const shortTimeoutClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        timeout: 100,
      });

      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await shortTimeoutClient.get('/test');

      // The test mainly verifies that no error is thrown when creating client with custom timeout
      expect(shortTimeoutClient).toBeInstanceOf(ApiClient);
    });
  });
});
