import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Settings, LogOut, Camera, User as UserIcon, Pencil, Check, X, ImageIcon, Trash2, RefreshCw, Circle } from "lucide-react";
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
  const [bio, setBio] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [posts, setPosts] = useState<
    { id: string; description: string; images: string[]; signedThumbs: string[]; created_at: string }[]
  >([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [onlineUntil, setOnlineUntil] = useState<Date | null>(null);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [busyPost, setBusyPost] = useState(false);
  const isOnline = !!onlineUntil && onlineUntil.getTime() > Date.now();

  const loadProfile = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setEmail(auth.user.email ?? "");
    setUserId(auth.user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url, bio, online_until")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile) {
      setUsername(profile.username);
      setBio(profile.bio ?? "");
      setBioDraft(profile.bio ?? "");
      setOnlineUntil((profile as any).online_until ? new Date((profile as any).online_until) : null);
      if (profile.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_url, 60 * 60);
        setAvatarUrl(signed?.signedUrl ?? null);
      } else {
        setAvatarUrl(null);
      }
    }
    await loadPosts(auth.user.id);
  };

  const toggleOnline = async () => {
    if (!userId) return;
    setTogglingOnline(true);
    const next = isOnline ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { error } = await supabase
      .from("profiles")
      .update({ online_until: next ? next.toISOString() : null } as any)
      .eq("id", userId);
    if (error) toast.error(error.message);
    else {
      setOnlineUntil(next);
      toast.success(next ? "En ligne pendant 24h" : "Hors ligne");
    }
    setTogglingOnline(false);
  };

  const deletePost = async (postId: string, images: string[]) => {
    if (!confirm("Supprimer ce post définitivement ?")) return;
    setBusyPost(true);
    if (images.length > 0) {
      await supabase.storage.from("post-images").remove(images);
    }
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) toast.error(error.message);
    else {
      toast.success("Post supprimé");
      setActivePostId(null);
      if (userId) await loadPosts(userId);
    }
    setBusyPost(false);
  };

  const replacePostImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !activePostId || !userId) return;
    const post = posts.find((x) => x.id === activePostId);
    if (!post) return;
    setBusyPost(true);
    // Delete old images
    if (post.images.length > 0) {
      await supabase.storage.from("post-images").remove(post.images);
    }
    const newPaths: string[] = [];
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} > 5 Mo`);
        continue;
      }
      const ext = f.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${activePostId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("post-images").upload(path, f, { contentType: f.type });
      if (error) toast.error(error.message);
      else newPaths.push(path);
    }
    if (newPaths.length > 0) {
      const { error } = await supabase.from("posts").update({ images: newPaths }).eq("id", activePostId);
      if (error) toast.error(error.message);
      else toast.success("Photos remplacées");
    }
    setActivePostId(null);
    setBusyPost(false);
    await loadPosts(userId);
  };

  const loadPosts = async (uid: string) => {
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id, description, images, created_at")
      .eq("author_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoadingPosts(false);
      return;
    }
    const rows = await Promise.all(
      (data ?? []).map(async (p) => {
        const thumbs = (p.images ?? []).slice(0, 3);
        const signedThumbs: string[] = [];
        for (const path of thumbs) {
          const { data: s } = await supabase.storage
            .from("post-images")
            .createSignedUrl(path, 60 * 60);
          if (s?.signedUrl) signedThumbs.push(s.signedUrl);
        }
        return { ...p, signedThumbs };
      }),
    );
    setPosts(rows);
    setLoadingPosts(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const saveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bioDraft.trim() || null })
      .eq("id", userId);
    if (error) toast.error(error.message);
    else {
      setBio(bioDraft.trim());
      setEditingBio(false);
      toast.success("Bio mise à jour");
    }
    setSavingBio(false);
  };

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
          <Link
            to="/settings"
            aria-label="Paramètres"
            className="h-10 w-10 rounded-full border border-border bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </Link>
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

        {/* Online toggle */}
        <button
          onClick={toggleOnline}
          disabled={togglingOnline}
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition ${
            isOnline
              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40"
              : "bg-red-500/10 text-red-500 border-red-500/30"
          } disabled:opacity-50`}
        >
          <Circle className={`h-3 w-3 fill-current`} />
          {isOnline ? "En ligne" : "Hors ligne"}
        </button>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isOnline
            ? `Actif jusqu'à ${onlineUntil!.toLocaleString()}`
            : "Touchez pour activer 24h"}
        </p>

        {uploading && (
          <p className="mt-3 text-xs text-muted-foreground">Envoi en cours…</p>
        )}

        {/* Bio */}
        <div className="mt-6 w-full">
          {editingBio ? (
            <div className="space-y-2">
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Parlez brièvement de vous…"
                className="w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setBioDraft(bio);
                    setEditingBio(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Annuler
                </button>
                <button
                  onClick={saveBio}
                  disabled={savingBio}
                  className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingBio(true)}
              className="group w-full text-left rounded-xl border border-border bg-card p-3 text-sm text-foreground/90 hover:border-foreground/40 transition"
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 whitespace-pre-wrap">
                  {bio || <span className="text-muted-foreground italic">Ajouter une bio…</span>}
                </span>
                <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </div>
            </button>
          )}
        </div>

        {/* Gallery */}
        <div className="mt-8 w-full">
          <h2 className="text-sm font-bold text-foreground mb-3">
            Ma galerie <span className="text-muted-foreground font-normal">({posts.length})</span>
          </h2>
          {loadingPosts ? (
            <div className="text-center py-8 text-xs text-muted-foreground">Chargement…</div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 py-10 text-center text-sm text-muted-foreground">
              Aucune publication pour l'instant.
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePostId(p.id)}
                  className="w-full text-left rounded-xl border border-border bg-card overflow-hidden hover:border-foreground/40 transition"
                >
                  <div className="grid grid-cols-3 gap-0.5 bg-border">
                    {[0, 1, 2].map((i) => {
                      const src = p.signedThumbs[i];
                      return (
                        <div
                          key={i}
                          className="aspect-square bg-secondary grid place-items-center overflow-hidden"
                        >
                          {src ? (
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="p-3 text-xs text-foreground/80 line-clamp-2">{p.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action sheet */}
        {activePostId && (
          <div
            className="fixed inset-0 z-50 bg-black/60 grid place-items-end sm:place-items-center"
            onClick={() => !busyPost && setActivePostId(null)}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-card border border-border p-4 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-foreground mb-2">Modifier ce post</h3>
              <button
                onClick={() => replaceInput.current?.click()}
                disabled={busyPost}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Remplacer les photos
              </button>
              <button
                onClick={() => {
                  const p = posts.find((x) => x.id === activePostId);
                  if (p) deletePost(p.id, p.images);
                }}
                disabled={busyPost}
                className="w-full flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 hover:bg-red-500/15 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer le post
              </button>
              <button
                onClick={() => setActivePostId(null)}
                disabled={busyPost}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>
              <input
                ref={replaceInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={replacePostImages}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}