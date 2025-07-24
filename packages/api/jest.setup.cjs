require('@testing-library/jest-dom');

// Mock fetch for tests
global.fetch = jest.fn();

// Mock Response for tests
global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.statusText = options.statusText || 'OK';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.ok = this.status >= 200 && this.status < 300;
  }

  async text() {
    return this.body;
  }

  async json() {
    return JSON.parse(this.body);
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});
