import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Home, Store, ShoppingBag, PlusSquare, User, MapPin, MessageCircle, Loader2, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "P2P — Marketplace vendeurs & acheteurs" },
      { name: "description", content: "P2P connecte vendeurs et acheteurs partout: électronique, hôtels, cargo, vêtements, voitures et plus." },
      { property: "og:title", content: "P2P — Marketplace vendeurs & acheteurs" },
      { property: "og:description", content: "Connectez-vous directement avec vendeurs et acheteurs sur P2P." },
    ],
  }),
  component: Index,
});

const CATEGORIES = [
  "Électroniques", "Hôtels", "Restaurants", "Cargo", "Vêtements",
  "Kit de Cuisine", "Kit de Sport", "Voitures", "Instruments de Musique",
  "Kit Média", "Hôpitaux", "Les Vivres", "Immobilier", "Beauté", "Agriculture",
];

type FeedPost = {
  id: string;
  role: "seller" | "buyer";
  description: string;
  price: string | null;
  images: string[];
  imageUrls: string[];
  address: string;
  shop_name: string;
  whatsapp: string;
  payment_methods: string[];
  category: string | null;
  created_at: string;
  boosted_at: string | null;
  author_id: string;
  score: number;
  boosted: boolean;
  author: {
    username: string;
    avatar_url: string | null;
    avatarSignedUrl: string | null;
    online: boolean;
    last_active_at: string | null;
    city: string | null;
    province: string | null;
  };
};

function initials(name: string) {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

function Index() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [me, setMe] = useState<{ id: string; city: string | null; province: string | null; last_boost_at: string | null } | null>(null);

  const loadFeed = async (viewer: typeof me) => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, role, description, price, images, address, shop_name, whatsapp, payment_methods, category, created_at, boosted_at, author_id, profiles:author_id(username, avatar_url, online_until, last_active_at, city, province)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) { setPosts([]); return; }

    const now = Date.now();
    const MAX_AGE_DAYS = 14;
    const active = data.filter((row: any) => {
      const ageDays = (now - new Date(row.created_at).getTime()) / 86_400_000;
      return ageDays <= MAX_AGE_DAYS;
    });

    const enriched: FeedPost[] = await Promise.all(
      active.map(async (row: any) => {
        const imageUrls: string[] = [];
        for (const p of row.images ?? []) {
          const { data: s } = await supabase.storage.from("post-images").createSignedUrl(p, 60 * 60);
          if (s?.signedUrl) imageUrls.push(s.signedUrl);
        }
        let avatarSignedUrl: string | null = null;
        if (row.profiles?.avatar_url) {
          const { data: s } = await supabase.storage.from("avatars").createSignedUrl(row.profiles.avatar_url, 60 * 60);
          avatarSignedUrl = s?.signedUrl ?? null;
        }

        // Scoring
        let complet = 0;
        if ((row.images ?? []).length > 0) complet += 0.4;
        if ((row.description ?? "").trim().length > 20) complet += 0.2;
        if (row.price && String(row.price).trim().length > 0) complet += 0.2;
        if ((row.address ?? "").trim().length > 0) complet += 0.2;

        const lastActive = row.profiles?.last_active_at
          ? new Date(row.profiles.last_active_at).getTime()
          : row.profiles?.online_until
            ? new Date(row.profiles.online_until).getTime() - 24 * 3600_000
            : 0;
        const minsSinceActive = lastActive ? (now - lastActive) / 60_000 : Infinity;
        let online = 0.1;
        if (minsSinceActive <= 15) online = 1.0;
        else if (minsSinceActive <= 60 * 24) online = 0.6;
        else if (minsSinceActive <= 60 * 24 * 7) online = 0.3;

        const ageDays = (now - new Date(row.created_at).getTime()) / 86_400_000;
        const recency = 1 / (1 + ageDays);

        let region = 0.3;
        if (viewer?.city && row.profiles?.city && viewer.city.trim().toLowerCase() === String(row.profiles.city).trim().toLowerCase()) {
          region = 1.0;
        } else if (viewer?.province && row.profiles?.province && viewer.province.trim().toLowerCase() === String(row.profiles.province).trim().toLowerCase()) {
          region = 0.6;
        }

        let score = complet * 0.35 + online * 0.25 + recency * 0.25 + region * 0.15;

        const boosted = row.boosted_at ? (now - new Date(row.boosted_at).getTime()) < 24 * 3600_000 : false;
        if (boosted) score += 0.3;

        return {
          id: row.id, role: row.role, description: row.description, price: row.price,
          images: row.images ?? [], imageUrls,
          address: row.address, shop_name: row.shop_name, whatsapp: row.whatsapp,
          payment_methods: row.payment_methods ?? [],
          category: row.category ?? null,
          created_at: row.created_at,
          boosted_at: row.boosted_at ?? null,
          author_id: row.author_id,
          score, boosted,
          author: {
            username: row.profiles?.username ?? "utilisateur",
            avatar_url: row.profiles?.avatar_url ?? null,
            avatarSignedUrl,
            online: row.profiles?.online_until ? new Date(row.profiles.online_until).getTime() > now : false,
            last_active_at: row.profiles?.last_active_at ?? null,
            city: row.profiles?.city ?? null,
            province: row.profiles?.province ?? null,
          },
        };
      }),
    );

    // Sort by score desc
    enriched.sort((a, b) => b.score - a.score);

    // Category interleaving: no more than 2 consecutive same category
    const result: FeedPost[] = [];
    const pool = [...enriched];
    while (pool.length) {
      const lastCat = result.length >= 2 && result[result.length - 1].category === result[result.length - 2].category
        ? result[result.length - 1].category
        : null;
      let pickIdx = 0;
      if (lastCat) {
        const alt = pool.findIndex((p) => p.category !== lastCat);
        if (alt !== -1) pickIdx = alt;
      }
      result.push(pool.splice(pickIdx, 1)[0]);
    }

    setPosts(result);
  };

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      let viewer: typeof me = null;
      if (auth.user) {
        // heartbeat presence
        await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", auth.user.id);
        const { data: p } = await supabase
          .from("profiles")
          .select("id, city, province, last_boost_at")
          .eq("id", auth.user.id)
          .maybeSingle();
        viewer = p ? { id: p.id, city: p.city, province: p.province, last_boost_at: p.last_boost_at } : { id: auth.user.id, city: null, province: null, last_boost_at: null };
        setMe(viewer);
      }
      await loadFeed(viewer);
    })();
  }, []);

  const handleBoost = async (postId: string) => {
    if (!me) return;
    const now = Date.now();
    if (me.last_boost_at && now - new Date(me.last_boost_at).getTime() < 7 * 86_400_000) {
      const daysLeft = Math.ceil((7 * 86_400_000 - (now - new Date(me.last_boost_at).getTime())) / 86_400_000);
      alert(`Prochain boost gratuit dans ${daysLeft} jour(s).`);
      return;
    }
    const iso = new Date().toISOString();
    const { error } = await supabase.from("posts").update({ boosted_at: iso }).eq("id", postId).eq("author_id", me.id);
    if (error) { alert("Erreur boost"); return; }
    await supabase.from("profiles").update({ last_boost_at: iso }).eq("id", me.id);
    const nextMe = { ...me, last_boost_at: iso };
    setMe(nextMe);
    await loadFeed(nextMe);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-black tracking-tight">
            <span className="text-seller">P</span>
            <span className="text-foreground">2</span>
            <span className="text-buyer">P</span>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder={t("search.placeholder")}
              className="w-full h-10 pl-9 pr-3 rounded-full bg-secondary text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <LanguageSwitcher />
        </div>

        {/* CATEGORIES MARQUEE */}
        <div className="relative overflow-hidden border-t border-border bg-card/40">
          <div className="flex whitespace-nowrap animate-marquee py-2.5">
            {[...CATEGORIES, ...CATEGORIES].map((cat, i) => (
              <span
                key={i}
                className="mx-2 px-4 py-1.5 rounded-full bg-secondary border border-border text-xs font-medium text-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* FEED */}
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">
        {posts === null ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <h2 className="text-lg font-bold">Encore aucune publication</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Soyez le premier à publier sur P2P.
            </p>
            <Link
              to="/add"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-sm font-semibold hover:opacity-90"
            >
              <PlusSquare className="h-4 w-4" /> Créer un post
            </Link>
          </div>
        ) : (
          posts.map((p) => {
            const isSeller = p.role === "seller";
            const waNumber = p.whatsapp.replace(/[^\d]/g, "");
            const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Bonjour ${p.author.username}, je vous contacte via P2P au sujet de: ${p.description}`)}`;
            const isMine = me?.id === p.author_id;
            return (
              <article key={p.id} className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div
                        className={`h-12 w-12 rounded-full overflow-hidden grid place-items-center font-bold text-sm ${
                          isSeller ? "bg-seller text-primary-foreground" : "bg-buyer text-foreground"
                        }`}
                      >
                        {p.author.avatarSignedUrl ? (
                          <img src={p.author.avatarSignedUrl} alt={p.author.username} className="h-full w-full object-cover" />
                        ) : (
                          initials(p.author.username)
                        )}
                      </div>
                      <span
                        title={p.author.online ? "En ligne" : "Hors ligne"}
                        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-card ${
                          p.author.online ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">{p.author.username}</h3>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            isSeller ? "bg-seller/15 text-seller" : "bg-buyer/15 text-buyer"
                          }`}
                        >
                          {t(isSeller ? "role.Vendeur" : "role.Acheteur")}
                        </span>
                        {p.boosted && (
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 inline-flex items-center gap-1">
                            <Flame className="h-3 w-3" /> En avant
                          </span>
                        )}
                        {p.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{p.address} · {p.shop_name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {p.imageUrls.length > 0 && (
                  <div className={`grid gap-1 ${p.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {p.imageUrls.slice(0, 4).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                <div className="px-4 pt-3">
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{p.description}</p>
                  {p.payment_methods.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.payment_methods.map((m) => (
                        <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 mt-2 flex items-center justify-between gap-3 border-t border-border">
                  <div className="text-base font-bold text-foreground">{p.price ?? ""}</div>
                  <div className="flex items-center gap-2">
                    {isMine && !p.boosted && (
                      <button
                        onClick={() => handleBoost(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 px-3 py-2 text-xs font-semibold hover:bg-orange-500/20"
                      >
                        <Flame className="h-3.5 w-3.5" /> Booster
                      </button>
                    )}
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-whatsapp text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>

      {/* FOOTER NAV */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-2xl px-2 py-2 grid grid-cols-5 items-center gap-1 text-[11px]">
          <FooterBtn icon={<Home className="h-5 w-5" />} label={t("nav.home")} active />
          <FooterBtn icon={<Store className="h-5 w-5" />} label={t("nav.seller")} tone="seller" />
          <Link to="/add" className="flex flex-col items-center justify-center">
            <span className="h-11 w-11 -mt-6 rounded-full bg-foreground text-background grid place-items-center shadow-lg">
              <PlusSquare className="h-5 w-5" />
            </span>
            <span className="mt-1 font-medium text-muted-foreground">{t("nav.add")}</span>
          </Link>
          <FooterBtn icon={<ShoppingBag className="h-5 w-5" />} label={t("nav.buyer")} tone="buyer" />
          <Link to="/profile" className="flex flex-col items-center justify-center py-1 gap-0.5 text-muted-foreground hover:text-foreground">
            <User className="h-5 w-5" />
            <span className="font-medium text-[11px]">{t("nav.profile")}</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}

function FooterBtn({
  icon, label, tone, active,
}: { icon: React.ReactNode; label: string; tone?: "seller" | "buyer"; active?: boolean }) {
  const color =
    tone === "seller" ? "text-seller"
    : tone === "buyer" ? "text-buyer"
    : active ? "text-foreground" : "text-muted-foreground";
  return (
    <button className={`flex flex-col items-center justify-center py-1 gap-0.5 ${color}`}>
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
