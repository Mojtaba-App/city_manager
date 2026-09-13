/**
 * Hand-maintained OpenAPI path types (bootstrap).
 * Regenerate with: pnpm --filter @city-manager/api-client gen:types
 * after running openapi:export against a live DB.
 */
export interface paths {
  '/health': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': { status?: string };
          };
        };
      };
    };
  };
  '/auth/login': {
    post: {
      requestBody: {
        content: {
          'application/json': { email: string; password: string };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              success: boolean;
              data?: unknown;
              error?: { code?: string; message?: string };
            };
          };
        };
      };
    };
  };
  '/auth/me': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': {
              success: boolean;
              data?: unknown;
            };
          };
        };
      };
    };
  };
  '/case/households': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': {
              success: boolean;
              data?: unknown;
            };
          };
        };
      };
    };
  };
  '/gis/neighborhoods': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': {
              success: boolean;
              data?: unknown;
            };
          };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    ApiError: { code?: string; message?: string };
    ApiResponse: {
      success: boolean;
      data?: unknown;
      error?: components['schemas']['ApiError'];
    };
  };
}
