"use client";
import i18next from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import { useEffect, type ReactNode } from "react";
import { en } from "./catalogue";
export { en };
if (!i18next.isInitialized)
  void i18next.use(initReactI18next).init({
    lng: "en-NG",
    fallbackLng: "en-NG",
    resources: { "en-NG": { translation: en } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
export function t(key: string, options?: Record<string, any>): string {
  if (!i18next.exists(key, options)) {
    console.warn("Missing locale message");
    return en.common.error.replace("{{code}}", "");
  }
  return String(i18next.t(key, options));
}
export function LocaleProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const invalid = (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.setCustomValidity)
        input.setCustomValidity(
          t(
            input.validity.valueMissing
              ? "validation.required"
              : "validation.invalid",
          ),
        );
    };
    const clear = (e: Event) => {
      const input = e.target as HTMLInputElement;
      input.setCustomValidity?.("");
    };
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", clear, true);
    return () => {
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", clear, true);
    };
  }, []);
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
export function date(value: any, utc = false) {
  if (!value) return t("common.unknown");
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: utc ? "UTC" : "Africa/Lagos",
    timeZoneName: "short",
  }).format(new Date(value));
}
export function number(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(
    value,
  );
}
