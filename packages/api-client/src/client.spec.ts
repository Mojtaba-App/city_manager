import { createApiClient } from './client';

describe('createApiClient', () => {
  it('sends Authorization and parses ApiResponse', async () => {
    const fetchMock = jest.fn(async () => ({
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true, data: { status: 'ok' } }),
    }));

    const client = createApiClient({
      baseUrl: 'http://localhost:3001/api/v1',
      getToken: () => 'tok-1',
      fetch: fetchMock as never,
    });

    const res = await client.health();
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/health',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-1',
        }),
      }),
    );
  });

  it('returns structured failure when body is not ApiResponse', async () => {
    const fetchMock = jest.fn(async () => ({
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({ raw: true }),
    }));
    const client = createApiClient({
      baseUrl: 'http://localhost:3001/api/v1',
      fetch: fetchMock as never,
    });
    const res = await client.listNeighborhoods();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('HTTP_502');
  });
});
