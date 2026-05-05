import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getTokens } from '../services/auth';

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tokens = await getTokens();
      if (!cancelled) setAllowed(Boolean(tokens));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed == null) {
    return (
      <div className="page-loader">
        <span className="spinner" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}
