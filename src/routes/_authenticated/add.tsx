import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, X, Loader2, Store, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/add")({
  component: AddPostPage,
});

type PickedImage = { file: File; previewUrl: string };

function AddPostPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string>("");
  const [profile, setProfile] = useState<{
    address: string | null;
    shop_name: string | null;
    whatsapp: string | null;
    payment_methods: string[];
    cgu_accepted_at: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("address, shop_name, whatsapp, payment_methods, cgu_accepted_at")
        .eq("id", auth.user.id)
        .maybeSingle();
      setProfile(data ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    return () => {
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
  }, [images]);

  const missing: string[] = [];
  if (profile) {
    if (!profile.address?.trim()) missing.push("Adresse physique");
    if (!profile.shop_name?.trim()) missing.push("Galérie / Boutique");
    if (!profile.whatsapp?.trim()) missing.push("WhatsApp");
    if (!profile.payment_methods || profile.payment_methods.length === 0)
      missing.push("Modes de paiement");
    if (!profile.cgu_accepted_at) missing.push("Acceptation des CGU");
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const picked: PickedImage[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: image > 5 Mo ignorée`);
        continue;
      }
      picked.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    setImages((prev) => [...prev, ...picked]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [rm] = next.splice(idx, 1);
      if (rm) URL.revokeObjectURL(rm.previewUrl);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || missing.length > 0) {
      toast.error("Complétez d'abord vos paramètres");
      return;
    }
    const desc = description.trim();
    if (desc.length < 5) {
      toast.error("Description trop courte (min 5 caractères)");
      return;
    }
    setSubmitting(true);
    try {
      const uploadedPaths: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("post-images")
          .upload(path, img.file, { contentType: img.file.type, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
      }

      const { error: insErr } = await supabase.from("posts").insert({
        author_id: userId,
        role,
        description: desc,
        price: price.trim() || null,
        images: uploadedPaths,
        address: profile.address!,
        shop_name: profile.shop_name!,
        whatsapp: profile.whatsapp!,
        payment_methods: profile.payment_methods,
      });
      if (insErr) throw insErr;
      toast.success("Publication en ligne !");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la publication");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            aria-label="Retour"
            className="h-9 w-9 rounded-full border border-border bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-xl font-black tracking-tight">
            <span className="text-seller">P</span>
            <span className="text-foreground">2</span>
            <span className="text-buyer">P</span>
          </div>
          <h1 className="text-base font-semibold ml-2">Nouvelle publication</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : missing.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
            <h2 className="text-lg font-bold">Paramètres incomplets</h2>
            <p className="text-sm text-muted-foreground">
              Avant de publier, complétez et acceptez les éléments suivants dans vos paramètres&nbsp;:
            </p>
            <ul className="text-sm text-foreground/90 space-y-1">
              {missing.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
            <Link
              to="/settings"
              className="inline-flex items-center rounded-full bg-foreground text-background px-5 py-2 text-sm font-semibold hover:opacity-90"
            >
              Ouvrir les paramètres
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Je suis</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("seller")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition ${
                    role === "seller"
                      ? "bg-seller text-primary-foreground border-seller"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  <Store className="h-4 w-4" /> Vendeur
                </button>
                <button
                  type="button"
                  onClick={() => setRole("buyer")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition ${
                    role === "buyer"
                      ? "bg-buyer text-foreground border-buyer"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" /> Acheteur
                </button>
              </div>
            </div>

            {/* Images uploader */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Photos</label>
              <div className="grid grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div
                    key={img.previewUrl}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary group"
                  >
                    <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-background/80 backdrop-blur grid place-items-center text-foreground hover:bg-background"
                      aria-label="Retirer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-border bg-card grid place-items-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"
                >
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs font-medium">Ajouter</span>
                  </div>
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onPick}
              />
              <p className="text-xs text-muted-foreground">
                Ajoutez autant de photos que vous voulez (max 5 Mo chacune).
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="desc" className="text-sm font-semibold">
                Description *
              </label>
              <textarea
                id="desc"
                required
                minLength={5}
                maxLength={2000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre produit / service / demande…"
                className="w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="text-right text-xs text-muted-foreground">
                {description.length}/2000
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label htmlFor="price" className="text-sm font-semibold">
                Prix (optionnel)
              </label>
              <input
                id="price"
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="ex: 1 250 000 BIF"
                className="w-full h-11 rounded-xl bg-card border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Auto-attached preview */}
            <div className="rounded-xl border border-border bg-card/60 p-4 text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground mb-2">
                Attaché automatiquement à ce post :
              </div>
              <div>📍 {profile?.address}</div>
              <div>🏪 {profile?.shop_name}</div>
              <div>📱 {profile?.whatsapp}</div>
              <div>💳 {profile?.payment_methods?.join(", ")}</div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-full bg-foreground text-background font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Publication…" : "Publier"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}