import { en } from "./i18n-en";
import { fr } from "./i18n-fr";
import { es } from "./i18n-es";

export type Lang = "en" | "fr" | "es";
export const translations = { en, fr, es } as const;
