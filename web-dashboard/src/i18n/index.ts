import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { ar } from "./ar";
import { en } from "./en";

const STORAGE_KEY = "coe_lang";

function applyDirection(lang: string) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

const savedLang = localStorage.getItem(STORAGE_KEY) ?? "ar";
applyDirection(savedLang);

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lang) => {
  applyDirection(lang);
  localStorage.setItem(STORAGE_KEY, lang);
});

export default i18n;
