describe('axiosClient', () => {
  function loadModule() {
    let exported: any;
    let requestHandler: any;
    let responseErrorHandler: any;

    jest.isolateModules(() => {
      jest.doMock('axios', () => {
        const client: any = jest.fn((config) => Promise.resolve({ replayed: true, config }));
        client.post = jest.fn();
        client.interceptors = {
          request: {
            use: jest.fn((handler) => {
              requestHandler = handler;
            }),
          },
          response: {
            use: jest.fn((_ok, handler) => {
              responseErrorHandler = handler;
            }),
          },
        };

        return {
          __esModule: true,
          default: {
            create: jest.fn(() => client),
          },
        };
      });

      exported = require('./axiosClient');
    });

    return {
      ...exported,
      requestHandler,
      responseErrorHandler,
      client: exported.default,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('stores tokens and attaches them to requests while resetting inactivity', () => {
    const { tokenStore, setInactivityResetFn, requestHandler } = loadModule();
    const reset = jest.fn();

    setInactivityResetFn(reset);
    tokenStore.set('access-token');

    const config = requestHandler({ headers: {} });

    expect(tokenStore.get()).toBe('access-token');
    expect(config.headers.Authorization).toBe('Bearer access-token');
    expect(reset).toHaveBeenCalled();
  });

  it('dispatches a global server error event on 5xx responses', async () => {
    const { responseErrorHandler } = loadModule();
    const listener = jest.fn();

    window.addEventListener('app:serverError', listener);

    await expect(
      responseErrorHandler({
        response: { status: 500 },
        config: {},
      }),
    ).rejects.toMatchObject({ response: { status: 500 } });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('app:serverError', listener);
  });

  it('refreshes the token and replays the original request after a 401', async () => {
    const { client, responseErrorHandler, tokenStore } = loadModule();
    client.post.mockResolvedValue({ data: { accessToken: 'new-token' } });

    // Seed a token to simulate an authenticated request whose access token expired
    tokenStore.set('current-token');

    const originalRequest = { headers: {}, _retry: false };

    await expect(
      responseErrorHandler({
        response: { status: 401 },
        config: originalRequest,
      }),
    ).resolves.toEqual({
      replayed: true,
      config: {
        headers: { Authorization: 'Bearer new-token' },
        _retry: true,
      },
    });

    expect(client.post).toHaveBeenCalledWith('/auth/refresh');
    expect(tokenStore.get()).toBe('new-token');
  });

  it('redirects to login when refresh fails', async () => {
    const { client, responseErrorHandler, tokenStore } = loadModule();
    const replace = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace },
    });

    tokenStore.set('old-token');
    client.post.mockRejectedValue(new Error('refresh failed'));

    await expect(
      responseErrorHandler({
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      }),
    ).rejects.toThrow('refresh failed');

    expect(tokenStore.get()).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});

export {};
