interface IconProps {
  className?: string;
}

export function NavIconHome({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavIconStudio({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2.75 12h2.5M18.75 12h2.5M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavIconGallery({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <path d="m3 16 5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconDemo({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.45 4.45L18 9l-4.55 1.55L12 15l-1.45-4.45L6 9l4.55-1.55L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 16.5l.75 2.25 2.25.75-2.25.75-.75 2.25-.75-2.25-2.25-.75 2.25-.75.75-2.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavIconRequest({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8.05-2.7L12 9.4l-1.05-1.1A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavIconPhotographer({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function NavIconMore({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
