'use client';

import { AuthProvider, useAuth } from '@/lib/auth';
import { FeedbackProvider } from '@/components/ui/Feedback';
import { ThemeProvider } from '@/lib/theme';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DashboardRouteGate } from '@/components/DashboardRouteGate';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth();

  useEffect(() => {
    if (!loading && !profile) {
      window.location.replace('/login');
    }
  }, [loading, profile]);

  if (loading) {
    return (
      <div className="admin-loading">
        <LoadingSpinner size="lg" label="در حال بارگذاری پنل…" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="admin-loading">
        <LoadingSpinner size="md" label="در حال انتقال به ورود…" />
      </div>
    );
  }
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <FeedbackProvider>
          <AuthGate>
            <DashboardRouteGate>{children}</DashboardRouteGate>
          </AuthGate>
        </FeedbackProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
