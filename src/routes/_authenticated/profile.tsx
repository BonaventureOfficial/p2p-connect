import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Settings, LogOut, Camera, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${".".repeat(4)}@${domain}`;
}

function ProfilePage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadProfile = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setEmail(auth.user.email ?? "");
    setUserId(auth.user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile) {
      setUsername(profile.username);
      if (profile.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_url, 60 * 60);
        setAvatarUrl(signed?.signedUrl ?? null);
      } else {
        setAvatarUrl(null);
      }
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth" });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop grande (max 5 Mo)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (dbErr) toast.error(dbErr.message);
    else toast.success("Photo mise à jour");
    await loadProfile();
    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-black tracking-tight">
            <span className="text-seller">P</span>
            <span className="text-foreground">2</span>
            <span className="text-buyer">P</span>
          </div>
          <div className="flex-1 flex justify-center">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
          <button
            aria-label="Paramètres"
            className="h-10 w-10 rounded-full border border-border bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10 flex flex-col items-center">
        <div className="relative">
          <div className="h-36 w-36 rounded-full border-4 border-border bg-secondary overflow-hidden grid place-items-center shadow-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-foreground text-background grid place-items-center shadow-md hover:opacity-90 disabled:opacity-50"
            aria-label="Changer la photo"
          >
            <Camera className="h-5 w-5" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        <h1 className="mt-6 text-2xl font-bold text-foreground">{username || "…"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{email ? maskEmail(email) : ""}</p>

        {uploading && (
          <p className="mt-3 text-xs text-muted-foreground">Envoi en cours…</p>
        )}
      </main>
    </div>
  );
}