import type { CSSProperties } from "react";
import { DECORATION_THEMES, type DecorationTheme } from "../utils/guestBranding";
import { useTranslation } from "../i18n";
import "../styles/DecorationThemePicker.scss";

interface DecorationThemePickerProps {
  value: DecorationTheme;
  onChange: (theme: DecorationTheme) => void;
  accentColor?: string;
  name?: string;
}

export function DecorationThemePicker({
  value,
  onChange,
  accentColor = "#c9a962",
  name = "decoration-theme",
}: DecorationThemePickerProps) {
  const { tPath } = useTranslation("events.common.branding");

  return (
    <div className="decoration-theme-picker" role="radiogroup" aria-label={tPath("decorationLabel")}>
      {DECORATION_THEMES.map((theme) => (
        <label
          key={theme}
          className={`decoration-theme-picker__option decoration-theme-picker__option--${theme}${
            value === theme ? " decoration-theme-picker__option--selected" : ""
          }`}
          style={{ "--picker-accent": accentColor } as CSSProperties}
        >
          <input
            type="radio"
            name={name}
            value={theme}
            checked={value === theme}
            onChange={() => onChange(theme)}
          />
          <span className="decoration-theme-picker__preview" aria-hidden="true">
            <span className="decoration-theme-picker__preview-inner" />
          </span>
          <span className="decoration-theme-picker__label">{tPath(`decorations.${theme}`)}</span>
        </label>
      ))}
    </div>
  );
}
