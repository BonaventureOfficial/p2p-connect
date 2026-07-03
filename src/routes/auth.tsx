import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "P2P — Connexion / Inscription" },
      { name: "description", content: "Créez votre compte P2P ou connectez-vous pour vendre et acheter." },
    ],
  }),
  component: AuthPage,
});

const passwordSchema = z
  .string()
  .min(8, "Au moins 8 caractères")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Au moins un symbole");

const signupSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  username: z.string().trim().min(1, "Nom d'utilisateur requis").max(50, "Max 50 caractères"),
  password: passwordSchema,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/profile" });
    });
  }, [navigate]);

  const handleSignup = async () => {
    const parsed = signupSchema.safeParse({ email, username, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setShowConfirm(true);
  };

  const confirmSignup = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`,
        data: { username },
      },
    });
    setLoading(false);
    setShowConfirm(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte créé ! Vérifiez votre email si la confirmation est requise.");
    navigate({ to: "/profile" });
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/profile" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight mb-6">
          <span className="text-seller">P</span>
          <span className="text-foreground">2</span>
          <span className="text-buyer">P</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex rounded-full border border-border bg-secondary p-1 text-sm font-semibold mb-6">
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-full transition ${mode === "signup" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              Créer un compte
            </button>
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-full transition ${mode === "login" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              Se connecter
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Email {mode === "signup" && "(jamais visible publiquement)"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="vous@exemple.com"
                autoComplete="email"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Nom d'utilisateur (visible publiquement, max 50)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 50))}
                  className="mt-1 w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="votre_pseudo"
                  maxLength={50}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Mot de passe {mode === "signup" && "(8+ car., maj, min, chiffre, symbole)"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <button
              onClick={mode === "signup" ? handleSignup : handleLogin}
              disabled={loading}
              className="w-full h-11 rounded-full bg-foreground text-background font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6">
            <h3 className="text-lg font-bold text-foreground">Confirmer la création</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Créer le compte pour <span className="text-foreground font-medium">{email}</span>
              {" "}avec le nom d'utilisateur <span className="text-foreground font-medium">{username}</span> ?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-10 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                onClick={confirmSignup}
                disabled={loading}
                className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
