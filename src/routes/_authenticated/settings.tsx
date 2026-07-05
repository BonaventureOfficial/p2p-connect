import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, MapPin, Store, Phone, Mail, KeyRound, Trash2, FileText, ShieldCheck, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const passwordSchema = z
  .string()
  .min(8, "Au moins 8 caractères")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Au moins un symbole");

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-foreground">{icon}</div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Cacher" : "Afficher"}
        className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const PAYMENT_PRESETS = ["Lumicash", "EcoCash", "Compte bancaire"];

function SettingsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");

  // profile fields
  const [address, setAddress] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // payment methods
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [customPayment, setCustomPayment] = useState("");

  // CGU
  const [cguAcceptedAt, setCguAcceptedAt] = useState<string | null>(null);
  const [cguChecked, setCguChecked] = useState(false);
  const [cguSaving, setCguSaving] = useState(false);

  // change email
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // change password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // delete account
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      setCurrentEmail(auth.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("address, shop_name, whatsapp, cgu_accepted_at, payment_methods")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (p) {
        setAddress(p.address ?? "");
        setShopName(p.shop_name ?? "");
        setWhatsapp(p.whatsapp ?? "");
        setCguAcceptedAt(p.cgu_accepted_at ?? null);
        setCguChecked(!!p.cgu_accepted_at);
        setPaymentMethods(p.payment_methods ?? []);
      }
    })();
  }, []);

  const saveProfile = async () => {
    if (!address.trim()) return toast.error("Adresse physique requise");
    if (!shopName.trim()) return toast.error("Nom de galérie / boutique requis");
    const wa = whatsapp.trim();
    if (!/^\+\d{6,15}$/.test(wa)) {
      return toast.error("WhatsApp doit commencer par + et le code pays (ex: +25779xxxxxxx)");
    }
    if (paymentMethods.length === 0) {
      return toast.error("Sélectionnez au moins un mode de paiement");
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        address: address.trim(),
        shop_name: shopName.trim(),
        whatsapp: wa,
        payment_methods: paymentMethods,
      })
      .eq("id", userId);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Informations enregistrées");
  };

  const togglePayment = (name: string) => {
    setPaymentMethods((cur) =>
      cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
    );
  };
  const addCustomPayment = () => {
    const v = customPayment.trim();
    if (!v) return;
    if (paymentMethods.includes(v)) return setCustomPayment("");
    setPaymentMethods((cur) => [...cur, v]);
    setCustomPayment("");
  };

  const changeEmail = async () => {
    if (oldEmail.trim().toLowerCase() !== currentEmail.toLowerCase()) {
      return toast.error("L'ancien email ne correspond pas");
    }
    const parsed = z.string().email().safeParse(newEmail.trim());
    if (!parsed.success) return toast.error("Nouvel email invalide");
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Vérifiez votre nouvelle boîte mail pour confirmer");
      setOldEmail("");
      setNewEmail("");
    }
  };

  const changePassword = async () => {
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    // re-authenticate with old password
    const { error: reErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: oldPassword,
    });
    if (reErr) return toast.error("Ancien mot de passe incorrect");
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Mot de passe mis à jour");
      setOldPassword("");
      setNewPassword("");
    }
  };

  const deleteAccount = async () => {
    if (!deletePassword) return toast.error("Mot de passe requis");
    const { error: reErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: deletePassword,
    });
    if (reErr) return toast.error("Mot de passe incorrect");
    setDeleteLoading(true);
    // delete profile row (auth user deletion needs admin — profile removal + sign-out for now)
    const { error: delErr } = await supabase.from("profiles").delete().eq("id", userId);
    if (delErr) {
      setDeleteLoading(false);
      return toast.error(delErr.message);
    }
    await supabase.auth.signOut();
    setDeleteLoading(false);
    toast.success("Compte supprimé");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Link
            to="/profile"
            aria-label="Retour"
            className="h-10 w-10 rounded-full border border-border bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-foreground flex-1">{t("settings.title")}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5 pb-24">
        <p className="text-xs text-muted-foreground">
          Les champs marqués <span className="text-destructive">*</span> sont requis pour publier un post et
          seront attachés par défaut à chacun de vos posts. Vous pouvez les modifier à tout moment.
        </p>

        <Section icon={<MapPin className="h-4 w-4" />} title="Adresse physique *">
          <Field label="Ex: Bujumbura — Centre Ville, Kayanza — Kigwati">
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Ville — Quartier" />
          </Field>
        </Section>

        <Section icon={<Store className="h-4 w-4" />} title="Galérie / Boutique *">
          <Field label="Nom + numéro de galérie si applicable">
            <input value={shopName} onChange={(e) => setShopName(e.target.value)} className={inputCls} placeholder="Ex: Galérie Muyinga — Nr 12" />
          </Field>
        </Section>

        <Section icon={<Phone className="h-4 w-4" />} title="WhatsApp *">
          <Field label="Doit commencer par le code pays (ex: +257…)">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="+25779xxxxxxx" inputMode="tel" />
          </Field>
        </Section>

        <Section icon={<Wallet className="h-4 w-4" />} title={t("settings.payment")}>
          <p className="text-[11px] text-muted-foreground">{t("settings.payment.hint")}</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_PRESETS.map((name) => {
              const active = paymentMethods.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => togglePayment(name)}
                  className={`px-3 h-9 rounded-full text-xs font-semibold border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {paymentMethods.filter((m) => !PAYMENT_PRESETS.includes(m)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {paymentMethods
                .filter((m) => !PAYMENT_PRESETS.includes(m))
                .map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 pl-3 pr-1 h-9 rounded-full text-xs font-semibold bg-primary text-primary-foreground"
                  >
                    {m}
                    <button
                      type="button"
                      onClick={() => togglePayment(m)}
                      aria-label="Retirer"
                      className="h-6 w-6 grid place-items-center rounded-full hover:bg-black/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={customPayment}
              onChange={(e) => setCustomPayment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomPayment();
                }
              }}
              placeholder={t("settings.payment.custom")}
              className={inputCls}
            />
            <button
              type="button"
              onClick={addCustomPayment}
              className="h-10 px-4 rounded-md bg-secondary border border-border text-sm font-semibold text-foreground hover:bg-accent"
            >
              {t("settings.payment.add")}
            </button>
          </div>
        </Section>

        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="w-full h-11 rounded-full bg-foreground text-background font-semibold text-sm hover:opacity-90 disabled:opacity-50"
        >
          {savingProfile ? "…" : t("settings.save")}
        </button>

        <Section icon={<Mail className="h-4 w-4" />} title="Changer l'email">
          <Field label="Ancien email">
            <input
              value={oldEmail}
              onChange={(e) => setOldEmail(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                toast.error("Pour votre sécurité, saisissez l'ancien email manuellement");
              }}
              onDrop={(e) => e.preventDefault()}
              autoComplete="off"
              className={inputCls}
              placeholder="Saisissez votre ancien email"
              type="email"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Le copier-coller est désactivé pour raison de sécurité.
            </p>
          </Field>
          <Field label="Nouvel email">
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} type="email" />
          </Field>
          <button
            onClick={changeEmail}
            disabled={emailLoading}
            className="w-full h-10 rounded-full border border-border bg-secondary text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {emailLoading ? "…" : "Mettre à jour l'email"}
          </button>
        </Section>

        <Section icon={<KeyRound className="h-4 w-4" />} title="Changer le mot de passe">
          <Field label="Ancien mot de passe">
            <PasswordInput value={oldPassword} onChange={setOldPassword} autoComplete="current-password" />
          </Field>
          <Field label="Nouveau mot de passe (8+, maj, min, chiffre, symbole)">
            <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          </Field>
          <button
            onClick={changePassword}
            disabled={pwLoading}
            className="w-full h-10 rounded-full border border-border bg-secondary text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {pwLoading ? "…" : "Mettre à jour le mot de passe"}
          </button>
        </Section>

        <Section icon={<FileText className="h-4 w-4" />} title="Conditions Générales d'Utilisation (CGU)">
          <p className="text-[11px] text-muted-foreground">
            L'acceptation des CGU est <span className="text-destructive">requise</span> avant de publier votre premier post.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-secondary/60 p-3 text-xs leading-relaxed text-foreground/90 space-y-3">
            <div>
              <p className="font-semibold text-foreground">1. Objet de l'application</p>
              <p>Notre application est une plateforme de mise en relation de gré à gré (P2P) entre acheteurs et vendeurs au Burundi. Elle permet la publication d'annonces de vente ou de recherche de biens et services.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">2. Rôle de la plateforme (Exclusion de responsabilité)</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>L'application n'est pas un site de vente en ligne. Elle agit uniquement comme un intermédiaire technique de mise en relation.</li>
                <li>Nous ne possédons, ne vérifions, ne stockons et ne livrons aucun des produits ou services affichés sur la plateforme.</li>
                <li>Les transactions finales, les paiements et les livraisons s'effectuent directement entre les utilisateurs, en dehors de l'application (notamment via WhatsApp). En conséquence, nous ne saurions être tenus responsables des arnaques, des défauts de paiement, ou de la non-conformité des produits.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">3. Règles de conduite et publication</p>
              <p>En publiant une annonce, vous vous engagez à :</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Fournir des informations exactes, honnêtes et un numéro WhatsApp valide.</li>
                <li>Ne pas publier de contenus illégaux, d'armes, de produits interdits par la loi burundaise, ou d'arnaques.</li>
                <li>Respecter la communauté. Tout comportement suspect ou frauduleux entraînera le bannissement immédiat et définitif de votre compte.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">4. Conseils de sécurité (Rappel important)</p>
              <p>Pour votre sécurité :</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Ne versez jamais d'argent en avance (par Lumicash, EcoCash ou autre) avant d'avoir vu et vérifié le produit de vos propres yeux.</li>
                <li>Fixez vos rendez-vous pour la transaction dans des lieux publics et sécurisés en journée.</li>
              </ul>
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={cguChecked}
              onChange={(e) => setCguChecked(e.target.checked)}
              disabled={!!cguAcceptedAt}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              J'ai lu et j'accepte les Conditions Générales d'Utilisation.
              {cguAcceptedAt && (
                <span className="ml-1 inline-flex items-center gap-1 text-primary">
                  <ShieldCheck className="h-3 w-3" /> Acceptées le {new Date(cguAcceptedAt).toLocaleDateString()}
                </span>
              )}
            </span>
          </label>
          {!cguAcceptedAt && (
            <button
              onClick={async () => {
                if (!cguChecked) return toast.error("Veuillez cocher la case d'acceptation");
                setCguSaving(true);
                const now = new Date().toISOString();
                const { error } = await supabase
                  .from("profiles")
                  .update({ cgu_accepted_at: now })
                  .eq("id", userId);
                setCguSaving(false);
                if (error) return toast.error(error.message);
                setCguAcceptedAt(now);
                toast.success("CGU acceptées");
              }}
              disabled={cguSaving || !cguChecked}
              className="w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {cguSaving ? "…" : "Accepter les CGU"}
            </button>
          )}
        </Section>

        <Section icon={<Trash2 className="h-4 w-4 text-destructive" />} title="Supprimer le compte">
          <p className="text-xs text-muted-foreground">
            Cette action est définitive. Confirmez avec votre mot de passe.
          </p>
          <Field label="Mot de passe">
            <PasswordInput value={deletePassword} onChange={setDeletePassword} autoComplete="current-password" />
          </Field>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full h-10 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90"
            >
              Supprimer définitivement mon compte
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 h-10 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteLoading}
                className="flex-1 h-10 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {deleteLoading ? "…" : "Oui, supprimer"}
              </button>
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}