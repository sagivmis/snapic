import { useTranslation } from "../i18n";
import "../styles/LegalPages.scss";

interface GuestNoticePanelProps {
  guestUrl: string;
}

export function GuestNoticePanel({ guestUrl }: GuestNoticePanelProps) {
  const { tPath } = useTranslation("events.live.guestNotice");
  const template = tPath("whatsappTemplate", { url: guestUrl });

  function copyTemplate() {
    void navigator.clipboard.writeText(template);
  }

  return (
    <section className="guest-notice card-wedding">
      <h3>{tPath("title")}</h3>
      <p>{tPath("body")}</p>
      <pre className="guest-notice__template">{template}</pre>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copyTemplate}>
        {tPath("copyTemplate")}
      </button>
    </section>
  );
}
