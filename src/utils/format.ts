import type { Language } from "../types";
import { getUiString } from "./i18n";

export function formatMoney(amount: number | null, currency: string, language: Language = "en"): string {
  if (amount === null) {
    return getUiString(language, "seeOfficialWebsite");
  }

  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}
