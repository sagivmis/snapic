import { useEffect, useState } from "react";

interface StickyMobileCtaProps {
  label: string;
  href: string;
  onClick?: () => void;
}

export function StickyMobileCta({ label, href, onClick }: StickyMobileCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 320);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="sticky-mobile-cta" role="region" aria-label={label}>
      <a href={href} className="btn btn-primary sticky-mobile-cta__btn" onClick={onClick}>
        {label}
      </a>
    </div>
  );
}
