'use client';

import { useCallback, useState } from 'react';
import { toQueryError } from '@city-manager/shared';

export function useQueryLoad(initialLoading = true) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(toQueryError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, run };
}
