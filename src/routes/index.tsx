import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Home, Store, ShoppingBag, PlusSquare, User, MapPin, MessageCircle, Loader2 } from "lucide-react";
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
  author: { username: string; avatar_url: string | null; avatarSignedUrl: string | null; online: boolean };
};

function initials(name: string) {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

function Index() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, role, description, price, images, address, shop_name, whatsapp, payment_methods, author_id, profiles:author_id(username, avatar_url, online_until)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !data) { setPosts([]); return; }

      const enriched: FeedPost[] = await Promise.all(
        data.map(async (row: any) => {
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
          return {
            id: row.id, role: row.role, description: row.description, price: row.price,
            images: row.images ?? [], imageUrls,
            address: row.address, shop_name: row.shop_name, whatsapp: row.whatsapp,
            payment_methods: row.payment_methods ?? [],
            author: {
              username: row.profiles?.username ?? "utilisateur",
              avatar_url: row.profiles?.avatar_url ?? null,
              avatarSignedUrl,
              online: row.profiles?.online_until ? new Date(row.profiles.online_until).getTime() > Date.now() : false,
            },
          };
        }),
      );
      setPosts(enriched);
    })();
  }, []);

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
