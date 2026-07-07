import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";

interface TermsConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

export function TermsConsentCheckbox({
  checked,
  onChange,
  id = "terms-consent",
  className = "terms-consent",
}: TermsConsentCheckboxProps) {
  const { tPath } = useTranslation("legal.consent");

  return (
    <label className={className} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required
        className={`${className}__checkbox`}
      />
      <span className={`${className}__label`}>
        {tPath("prefix")}{" "}
        <Link to="/terms" target="_blank" rel="noopener noreferrer">
          {tPath("terms")}
        </Link>{" "}
        {tPath("and")}{" "}
        <Link to="/privacy" target="_blank" rel="noopener noreferrer">
          {tPath("privacy")}
        </Link>
      </span>
    </label>
  );
}
