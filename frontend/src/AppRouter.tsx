import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/RequireRole";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { EventGuestPage } from "./pages/EventGuestPage";
import { EventManagePage } from "./pages/EventManagePage";
import { LandingPage } from "./pages/LandingPage";
import { LegacyDemoPage } from "./pages/LegacyDemoPage";
import { LoginPage } from "./pages/LoginPage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { SharePage } from "./pages/SharePage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/request-access" element={<RequestAccessPage />} />
      <Route path="/demo" element={<LegacyDemoPage />} />
      <Route path="/e/:slug" element={<EventGuestPage />} />
      <Route
        path="/e/:slug/manage"
        element={
          <RequireAuth>
            <EventManagePage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={["super_admin"]}>
            <AdminDashboardPage />
          </RequireRole>
        }
      />
      <Route path="/share/:shareId" element={<SharePage />} />
      <Route path="/share" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
