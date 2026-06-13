import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import AppLayout from '@/components/layouts/AppLayout';
import { Toaster } from '@/components/ui/sonner';

import { routes } from './routes';

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <Router>
          <RouteGuard>
            <Routes>
              {routes.map((route, index) => (
                <Route
                  key={index}
                  path={route.path}
                  element={
                    route.public ? (
                      route.element
                    ) : (
                      <AuthenticatedLayout>{route.element}</AuthenticatedLayout>
                    )
                  }
                />
              ))}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </RouteGuard>
          <Toaster />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
