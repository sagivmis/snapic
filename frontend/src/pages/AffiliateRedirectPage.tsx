import { Navigate, useParams } from "react-router-dom";

/** Short affiliate link: /r/CODE → /request-access?ref=CODE */
export function AffiliateRedirectPage() {
  const { code } = useParams<{ code: string }>();
  const ref = encodeURIComponent(code ?? "");
  return <Navigate to={`/request-access?ref=${ref}`} replace />;
}
