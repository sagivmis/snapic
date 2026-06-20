import { useEffect, useId, useRef, useState } from "react";
import type { SlugCheckResult } from "../types";
import { slugifyEventName } from "../utils/onboarding";
import "../styles/SlugAvailabilityInput.scss";

const SLUG_CHECK_DEBOUNCE_MS = 500;

export type SlugCheckStatus = "idle" | "pending" | "checking" | "available" | "taken";

type SlugCheckState = SlugCheckResult | "checking" | null;

interface SlugAvailabilityInputProps {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  onCheckSlug: (slug: string) => Promise<SlugCheckResult>;
  onStatusChange?: (status: SlugCheckStatus) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

function SlugErrorIcon() {
  return (
    <svg className="slug-field__icon-svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.25v4.5M10 13.75h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function SlugAvailabilityInput({
  id,
  value,
  onChange,
  onCheckSlug,
  onStatusChange,
  disabled = false,
  required = false,
  placeholder,
}: SlugAvailabilityInputProps) {
  const hintId = useId();
  const statusHintId = useId();
  const [slugCheck, setSlugCheck] = useState<SlugCheckState>(null);
  const [isPending, setIsPending] = useState(false);
  const requestGeneration = useRef(0);
  const onCheckSlugRef = useRef(onCheckSlug);
  const onStatusChangeRef = useRef(onStatusChange);

  onCheckSlugRef.current = onCheckSlug;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    const cleaned = value.trim();
    if (!cleaned) {
      setSlugCheck(null);
      setIsPending(false);
      onStatusChangeRef.current?.("idle");
      return;
    }

    setSlugCheck(null);
    setIsPending(true);
    onStatusChangeRef.current?.("pending");

    const timer = window.setTimeout(() => {
      const generation = requestGeneration.current + 1;
      requestGeneration.current = generation;
      setIsPending(false);
      setSlugCheck("checking");
      onStatusChangeRef.current?.("checking");

      void onCheckSlugRef.current(cleaned)
        .then((result) => {
          if (requestGeneration.current !== generation) {
            return;
          }
          setSlugCheck(result);
          onStatusChangeRef.current?.(result.available ? "available" : "taken");
        })
        .catch(() => {
          if (requestGeneration.current !== generation) {
            return;
          }
          setSlugCheck(null);
          onStatusChangeRef.current?.("idle");
        });
    }, SLUG_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestGeneration.current += 1;
    };
  }, [value]);

  const takenCheck =
    slugCheck !== null && slugCheck !== "checking" && !slugCheck.available ? slugCheck : null;
  const isTaken = takenCheck !== null;
  const isChecking = slugCheck === "checking";
  const showLoader = isPending || isChecking;

  return (
    <div className="slug-field">
      <div
        className={`slug-field__control${isTaken ? " slug-field__control--error" : ""}${
          showLoader ? " slug-field__control--checking" : ""
        }`}
      >
        <input
          id={id}
          className="slug-field__input"
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={isTaken || undefined}
          aria-describedby={isTaken ? hintId : showLoader ? statusHintId : undefined}
          aria-busy={showLoader || undefined}
          onChange={(event) => onChange(slugifyEventName(event.target.value))}
        />
        {showLoader && (
          <span className="slug-field__icon slug-field__icon--loading" title="Checking slug availability">
            <span className="slug-field__spinner" aria-hidden="true" />
            <span className="sr-only">Checking slug availability</span>
          </span>
        )}
        {isTaken && !showLoader && (
          <span className="slug-field__icon slug-field__icon--error" title="Slug already taken">
            <SlugErrorIcon />
          </span>
        )}
      </div>

      {showLoader && (
        <p id={statusHintId} className="slug-field__message slug-field__message--checking">
          Checking availability…
        </p>
      )}

      {isTaken && (
        <p id={hintId} className="slug-field__message slug-field__message--error" role="alert">
          This slug is already taken.
          {takenCheck?.suggestion ? (
            <>
              {" "}
              Try{" "}
              <button
                type="button"
                className="slug-field__suggestion"
                disabled={disabled}
                onClick={() => onChange(takenCheck.suggestion ?? value)}
              >
                {takenCheck.suggestion}
              </button>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
