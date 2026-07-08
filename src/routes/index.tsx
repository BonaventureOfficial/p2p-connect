import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Home, Store, ShoppingBag, PlusSquare, User, MapPin, MessageCircle, Loader2, Flame, Eye, Heart, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  "Téléphones & Accessoires", "Ordinateurs & Informatique", "Chaussures",
  "Bijoux & Accessoires", "Tissus & Pagnes", "Meubles", "Électroménager",
  "Panneaux Solaires & Générateurs", "Produits Agricoles",
  "Bétail & Volaille", "Matériel Agricole", "Terrains & Immobilier",
  "Construction & Rénovation", "Coiffure & Beauté", "Événementiel",
  "Cours & Formations", "Livres & Fournitures scolaires", "Jeux & Jouets",
  "Réparation & Services techniques", "Produits Cosmétiques",
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

function getAnonId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("p2p_anon_id");
  if (!id) {
    id = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("p2p_anon_id", id);
  }
  return id;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

type Tab = "home" | "seller" | "buyer";

function Index() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [me, setMe] = useState<{ id: string; city: string | null; province: string | null; last_boost_at: string | null } | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [engagement, setEngagement] = useState<Record<string, { views: number; likes: number; comments: number; liked: boolean }>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);

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

    setPosts(enriched);
  };

  // Apply anti-monotony rules on the CURRENT filtered view
  const applyInterleave = (list: FeedPost[], enforceRole: boolean): FeedPost[] => {
    const result: FeedPost[] = [];
    const pool = [...list];
    while (pool.length) {
      const n = result.length;
      const catBlocked = n >= 2 && result[n - 1].category && result[n - 1].category === result[n - 2].category
        ? result[n - 1].category : null;
      const roleBlocked = enforceRole && n >= 2 && result[n - 1].role === result[n - 2].role
        ? result[n - 1].role : null;
      let idx = pool.findIndex((p) =>
        (!catBlocked || p.category !== catBlocked) &&
        (!roleBlocked || p.role !== roleBlocked),
      );
      if (idx === -1) idx = 0;
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  };

  // Load engagement counters + liked state for visible posts
  const loadEngagement = async (ids: string[], userId: string | null) => {
    if (ids.length === 0) return;
    const [{ data: views }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from("post_views").select("post_id").in("post_id", ids),
      supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
      supabase.from("post_comments").select("post_id").in("post_id", ids),
    ]);
    const map: Record<string, { views: number; likes: number; comments: number; liked: boolean }> = {};
    ids.forEach((id) => (map[id] = { views: 0, likes: 0, comments: 0, liked: false }));
    (views ?? []).forEach((r: any) => { if (map[r.post_id]) map[r.post_id].views += 1; });
    (likes ?? []).forEach((r: any) => {
      if (!map[r.post_id]) return;
      map[r.post_id].likes += 1;
      if (userId && r.user_id === userId) map[r.post_id].liked = true;
    });
    (comments ?? []).forEach((r: any) => { if (map[r.post_id]) map[r.post_id].comments += 1; });
    setEngagement((prev) => ({ ...prev, ...map }));
  };

  const recordView = async (postId: string) => {
    const anonId = getAnonId();
    const viewerId = me?.id ?? anonId;
    const viewerType = me?.id ? "user" : "anonymous";
    // Local dedupe cache to avoid repeat insert per session
    const key = `p2p_seen_${postId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const { error } = await supabase.from("post_views").insert({
      post_id: postId, viewer_id: viewerId, viewer_type: viewerType,
    } as any);
    if (!error) {
      setEngagement((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? { views: 0, likes: 0, comments: 0, liked: false }), views: (prev[postId]?.views ?? 0) + 1 },
      }));
    }
  };

  const toggleLike = async (postId: string) => {
    if (!me) { alert("Connectez-vous pour aimer ce post."); return; }
    const cur = engagement[postId];
    if (cur?.liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
      setEngagement((p) => ({ ...p, [postId]: { ...cur, liked: false, likes: Math.max(0, cur.likes - 1) } }));
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: me.id } as any);
      if (!error) {
        setEngagement((p) => ({
          ...p,
          [postId]: { ...(cur ?? { views: 0, likes: 0, comments: 0, liked: false }), liked: true, likes: (cur?.likes ?? 0) + 1 },
        }));
      }
    }
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

  // When posts loaded, fetch engagement counters
  useEffect(() => {
    if (!posts) return;
    loadEngagement(posts.map((p) => p.id), me?.id ?? null);
  }, [posts, me?.id]);

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
          applyInterleave(
            tab === "home" ? posts : posts.filter((p) => p.role === (tab === "seller" ? "seller" : "buyer")),
            tab === "home",
          ).map((p) => {
            const isSeller = p.role === "seller";
            const waNumber = p.whatsapp.replace(/[^\d]/g, "");
            const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Bonjour ${p.author.username}, je vous contacte via P2P au sujet de: ${p.description}`)}`;
            const isMine = me?.id === p.author_id;
            const eng = engagement[p.id] ?? { views: 0, likes: 0, comments: 0, liked: false };
            return (
              <PostCard key={p.id} postId={p.id} onView={recordView}>
              <article className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
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
                <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {eng.views}</span>
                  <button onClick={() => toggleLike(p.id)} className={`inline-flex items-center gap-1 hover:text-foreground ${eng.liked ? "text-red-500" : ""}`}>
                    <Heart className={`h-3.5 w-3.5 ${eng.liked ? "fill-current" : ""}`} /> {eng.likes}
                  </button>
                  <button onClick={() => setOpenComments(p.id)} className="inline-flex items-center gap-1 hover:text-foreground">
                    <MessageSquare className="h-3.5 w-3.5" /> {eng.comments}
                  </button>
                </div>
              </article>
              </PostCard>
            );
          })
        )}
      </main>

      {openComments && (
        <CommentsSheet
          postId={openComments}
          me={me}
          onClose={() => setOpenComments(null)}
          onCountChange={(n) => setEngagement((p) => ({
            ...p,
            [openComments]: { ...(p[openComments] ?? { views: 0, likes: 0, comments: 0, liked: false }), comments: n },
          }))}
        />
      )}

      {/* FOOTER NAV */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-2xl px-2 py-2 grid grid-cols-5 items-center gap-1 text-[11px]">
          <FooterBtn icon={<Home className="h-5 w-5" />} label={t("nav.home")} active={tab === "home"} onClick={() => setTab("home")} />
          <FooterBtn icon={<Store className="h-5 w-5" />} label={t("nav.seller")} tone="seller" active={tab === "seller"} onClick={() => setTab("seller")} />
          <Link to="/add" className="flex flex-col items-center justify-center">
            <span className="h-11 w-11 -mt-6 rounded-full bg-foreground text-background grid place-items-center shadow-lg">
              <PlusSquare className="h-5 w-5" />
            </span>
            <span className="mt-1 font-medium text-muted-foreground">{t("nav.add")}</span>
          </Link>
          <FooterBtn icon={<ShoppingBag className="h-5 w-5" />} label={t("nav.buyer")} tone="buyer" active={tab === "buyer"} onClick={() => setTab("buyer")} />
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
  icon, label, tone, active, onClick,
}: { icon: React.ReactNode; label: string; tone?: "seller" | "buyer"; active?: boolean; onClick?: () => void }) {
  const color =
    active
      ? tone === "seller" ? "text-seller" : tone === "buyer" ? "text-buyer" : "text-foreground"
      : "text-muted-foreground";
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center py-1 gap-0.5 ${color}`}>
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function PostCard({ postId, onView, children }: { postId: string; onView: (id: string) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (!timer) timer = setTimeout(() => { onView(postId); }, 5000);
        } else if (timer) { clearTimeout(timer); timer = null; }
      });
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [postId, onView]);
  return <div ref={ref}>{children}</div>;
}

type CommentRow = { id: string; user_id: string; content: string; created_at: string; author?: { username: string; avatar_url: string | null; avatarSignedUrl: string | null } };

function CommentsSheet({ postId, me, onClose, onCountChange }: {
  postId: string;
  me: { id: string } | null;
  onClose: () => void;
  onCountChange: (n: number) => void;
}) {
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("id, user_id, content, created_at, profiles:user_id(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const enriched: CommentRow[] = await Promise.all((data ?? []).map(async (r: any) => {
      let avatarSignedUrl: string | null = null;
      if (r.profiles?.avatar_url) {
        const { data: s } = await supabase.storage.from("avatars").createSignedUrl(r.profiles.avatar_url, 60 * 60);
        avatarSignedUrl = s?.signedUrl ?? null;
      }
      return { id: r.id, user_id: r.user_id, content: r.content, created_at: r.created_at, author: { username: r.profiles?.username ?? "utilisateur", avatar_url: r.profiles?.avatar_url ?? null, avatarSignedUrl } };
    }));
    setRows(enriched);
    onCountChange(enriched.length);
  };

  useEffect(() => { load(); }, [postId]);

  const send = async () => {
    if (!me) { alert("Connectez-vous pour commenter."); return; }
    const content = text.trim();
    if (!content) return;
    setSending(true);
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: me.id, content } as any);
    if (!error) { setText(""); await load(); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-end" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold text-foreground">Commentaires</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rows === null ? (
            <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Aucun commentaire. Soyez le premier !</p>
          ) : rows.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-bold shrink-0">
                {c.author?.avatarSignedUrl ? <img src={c.author.avatarSignedUrl} alt="" className="h-full w-full object-cover" /> : initials(c.author?.username ?? "?")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs"><span className="font-semibold text-foreground">{c.author?.username}</span> <span className="text-muted-foreground">· {timeAgo(c.created_at)}</span></div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder={me ? "Écrire un commentaire…" : "Connectez-vous pour commenter"}
            disabled={!me || sending}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            className="flex-1 h-10 rounded-full bg-secondary border border-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button onClick={send} disabled={!me || sending || !text.trim()} className="h-10 w-10 grid place-items-center rounded-full bg-foreground text-background disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
