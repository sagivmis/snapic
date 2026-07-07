import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { RequireAuth, RequireRole } from "./auth/RequireRole";
import { CookieConsent } from "./components/CookieConsent";
import { AppLayout } from "./components/layout/AppLayout";
import { StudioOrgProvider } from "./components/studio/StudioOrgContext";
import { StudioLayout } from "./components/studio/StudioLayout";
import { captureAttributionFromUrl } from "./lib/attribution";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { EventGuestPage } from "./pages/EventGuestPage";
import { EventLivePage } from "./pages/EventLivePage";
import { EventManagePage } from "./pages/EventManagePage";
import { EventSetupPage } from "./pages/EventSetupPage";
import { ForPhotographersPage } from "./pages/ForPhotographersPage";
import { LaunchPage } from "./pages/LaunchPage";
import { LandingPage } from "./pages/LandingPage";
import { LegacyDemoPage } from "./pages/LegacyDemoPage";
import { LoginPage } from "./pages/LoginPage";
import { AccessibilityPage } from "./pages/legal/AccessibilityPage";
import { ContactPage } from "./pages/legal/ContactPage";
import { CookiesPage } from "./pages/legal/CookiesPage";
import { PrivacyPage } from "./pages/legal/PrivacyPage";
import { TermsPage } from "./pages/legal/TermsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { SharePage } from "./pages/SharePage";
import { StudioBillingPage } from "./pages/studio/StudioBillingPage";
import { StudioClientDetailPage } from "./pages/studio/StudioClientDetailPage";
import { StudioClientNewPage } from "./pages/studio/StudioClientNewPage";
import { StudioClientsPage } from "./pages/studio/StudioClientsPage";
import { StudioDashboardPage } from "./pages/studio/StudioDashboardPage";
import { StudioSettingsPage } from "./pages/studio/StudioSettingsPage";
import { StudioSelectPage } from "./pages/studio/StudioSelectPage";
import { StudioSignupPage } from "./pages/studio/StudioSignupPage";
import { StudioTeamPage } from "./pages/studio/StudioTeamPage";
import { AffiliateRedirectPage } from "./pages/AffiliateRedirectPage";

function AttributionCapture() {
  const location = useLocation();
  useEffect(() => {
    captureAttributionFromUrl(location.search);
  }, [location.search]);
  return null;
}

export function AppRouter() {
  return (
    <>
      <AttributionCapture />
      <CookieConsent />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:shareId" element={<SharePage />} />
      <Route path="/share" element={<SharePage />} />
      {/* Lightweight guest preview for iframe embed — no AppLayout chrome or nav hooks */}
      <Route path="/e/:slug/preview" element={<EventGuestPage embed />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/for-photographers" element={<ForPhotographersPage />} />
        <Route path="/launch" element={<LaunchPage />} />
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/r/:code" element={<AffiliateRedirectPage />} />
        <Route path="/demo" element={<LegacyDemoPage />} />
        <Route path="/e/:slug" element={<EventGuestPage />} />
        <Route
          path="/e/:slug/setup"
          element={
            <RequireAuth>
              <EventSetupPage />
            </RequireAuth>
          }
        />
        <Route
          path="/e/:slug/live"
          element={
            <RequireAuth>
              <EventLivePage />
            </RequireAuth>
          }
        />
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
        <Route path="/studio/signup" element={<StudioSignupPage />} />
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <StudioOrgProvider>
                <Outlet />
              </StudioOrgProvider>
            </RequireAuth>
          }
        >
          <Route path="select" element={<StudioSelectPage />} />
          <Route element={<StudioLayout />}>
            <Route index element={<StudioDashboardPage />} />
            <Route path="clients" element={<StudioClientsPage />} />
            <Route path="clients/new" element={<StudioClientNewPage />} />
            <Route path="clients/:eventId" element={<StudioClientDetailPage />} />
            <Route path="settings" element={<StudioSettingsPage />} />
            <Route path="billing" element={<StudioBillingPage />} />
            <Route path="team" element={<StudioTeamPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </>
  );
}

