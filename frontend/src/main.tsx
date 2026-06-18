import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { AppRouter } from "./AppRouter";
import { AuthProvider } from "./auth/AuthProvider";
import { initSentry, Sentry } from "./monitoring/sentry";
import "./styles/global.scss";

initSentry();
registerSW({ immediate: true });

const app = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please refresh the page and try again.</p>
      </div>
    }
  >
    {app}
  </Sentry.ErrorBoundary>,
);
