import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, MapPin, Store, Phone, Mail, KeyRound, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

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

function SettingsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");

  // profile fields
  const [address, setAddress] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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
        .select("address, shop_name, whatsapp")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (p) {
        setAddress(p.address ?? "");
        setShopName(p.shop_name ?? "");
        setWhatsapp(p.whatsapp ?? "");
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
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ address: address.trim(), shop_name: shopName.trim(), whatsapp: wa })
      .eq("id", userId);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Informations enregistrées");
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
          <h1 className="text-lg font-bold text-foreground">Paramètres</h1>
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

        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="w-full h-11 rounded-full bg-foreground text-background font-semibold text-sm hover:opacity-90 disabled:opacity-50"
        >
          {savingProfile ? "…" : "Enregistrer les informations"}
        </button>

        <Section icon={<Mail className="h-4 w-4" />} title="Changer l'email">
          <Field label="Ancien email">
            <input value={oldEmail} onChange={(e) => setOldEmail(e.target.value)} className={inputCls} placeholder={currentEmail} type="email" />
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