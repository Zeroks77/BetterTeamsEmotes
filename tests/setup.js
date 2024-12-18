// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock clipboard API
global.navigator.clipboard = {
  write: jest.fn()
};

// Mock fetch
global.fetch = jest.fn();
