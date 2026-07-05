import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en" | "ki";

type Dict = Record<string, string>;

const translations: Record<Lang, Dict> = {
  fr: {
    "search.placeholder": "Rechercher un produit, service, vendeur…",
    "nav.home": "Home",
    "nav.seller": "Vendeur",
    "nav.buyer": "Acheteur",
    "nav.add": "Ajouter",
    "nav.profile": "Profil",
    "role.Vendeur": "Vendeur",
    "role.Acheteur": "Acheteur",
    "settings.title": "Paramètres",
    "settings.intro": "Les champs marqués * sont requis pour publier un post et seront attachés par défaut à chacun de vos posts. Vous pouvez les modifier à tout moment.",
    "settings.address": "Adresse physique *",
    "settings.shop": "Galérie / Boutique *",
    "settings.whatsapp": "WhatsApp *",
    "settings.payment": "Modes de paiement *",
    "settings.payment.hint": "Sélectionnez au moins un mode accepté (ex: Lumicash, EcoCash, Compte bancaire).",
    "settings.payment.custom": "Ajouter un autre mode",
    "settings.payment.add": "Ajouter",
    "settings.save": "Enregistrer les informations",
    "settings.saving": "…",
    "settings.email": "Changer l'email",
    "settings.password": "Changer le mot de passe",
    "settings.cgu": "Conditions Générales d'Utilisation (CGU)",
    "settings.delete": "Supprimer le compte",
  },
  en: {
    "search.placeholder": "Search for a product, service, seller…",
    "nav.home": "Home",
    "nav.seller": "Seller",
    "nav.buyer": "Buyer",
    "nav.add": "Add",
    "nav.profile": "Profile",
    "role.Vendeur": "Seller",
    "role.Acheteur": "Buyer",
    "settings.title": "Settings",
    "settings.intro": "Fields marked * are required to publish a post and will be attached by default to each of your posts. You can change them at any time.",
    "settings.address": "Physical address *",
    "settings.shop": "Gallery / Shop *",
    "settings.whatsapp": "WhatsApp *",
    "settings.payment": "Payment methods *",
    "settings.payment.hint": "Select at least one accepted method (e.g. Lumicash, EcoCash, Bank account).",
    "settings.payment.custom": "Add another method",
    "settings.payment.add": "Add",
    "settings.save": "Save information",
    "settings.saving": "…",
    "settings.email": "Change email",
    "settings.password": "Change password",
    "settings.cgu": "Terms of Use",
    "settings.delete": "Delete account",
  },
  ki: {
    "search.placeholder": "Rondera igicuruzwa, serivisi, umudandaza…",
    "nav.home": "Ahabanza",
    "nav.seller": "Umudandaza",
    "nav.buyer": "Umuguzi",
    "nav.add": "Ongera",
    "nav.profile": "Umwidondoro",
    "role.Vendeur": "Umudandaza",
    "role.Acheteur": "Umuguzi",
    "settings.title": "Amagenamiterere",
    "settings.intro": "Ivyanditse ku * birakenewe kugira ushobore gushira ku rubuga, kandi bizashikirizwa buri ciyagizo. Urashobora kubihindura ico wipfuza.",
    "settings.address": "Aho uba nyabwo *",
    "settings.shop": "Galeriya / Isuku *",
    "settings.whatsapp": "WhatsApp *",
    "settings.payment": "Uburyo bwo kwishura *",
    "settings.payment.hint": "Hitamwo nibura uburyo bumwe bwemewe (nk'akarorero: Lumicash, EcoCash, Konte ya banki).",
    "settings.payment.custom": "Ongerako ubundi buryo",
    "settings.payment.add": "Ongera",
    "settings.save": "Bika amakuru",
    "settings.saving": "…",
    "settings.email": "Hindura imeri",
    "settings.password": "Hindura ijambo ry'ibanga",
    "settings.cgu": "Amabwirizwa yo gukoresha (CGU)",
    "settings.delete": "Futa konte",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("p2p.lang") as Lang | null;
    if (saved === "fr" || saved === "en" || saved === "ki") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("p2p.lang", l);
  };
  const t = (key: string) => translations[lang][key] ?? translations.fr[key] ?? key;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const items: Array<{ v: Lang; label: string }> = [
    { v: "en", label: "ANG" },
    { v: "fr", label: "FR" },
    { v: "ki", label: "Ki" },
  ];
  return (
    <nav className="flex items-center rounded-full border border-border bg-secondary p-0.5 text-xs font-semibold">
      {items.map((it) => (
        <button
          key={it.v}
          onClick={() => setLang(it.v)}
          className={`px-2.5 py-1 rounded-full ${
            lang === it.v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={lang === it.v}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}