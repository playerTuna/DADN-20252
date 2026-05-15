import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { DevicesPage } from './pages/DevicesPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AutomationPage } from './pages/AutomationPage';
import { WeeklyReportPage } from './pages/WeeklyReportPage';
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/weekly-report" element={<WeeklyReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
