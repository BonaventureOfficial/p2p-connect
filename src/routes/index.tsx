import { createFileRoute } from "@tanstack/react-router";
import { Search, Home, Store, ShoppingBag, PlusSquare, User, MapPin, MessageCircle } from "lucide-react";

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

type Role = "Vendeur" | "Acheteur";
const POSTS: Array<{
  id: number; name: string; role: Role; avatar: string;
  description: string; address: string; price: string; phone: string;
}> = [
  { id: 1, name: "Jean-Claude M.", role: "Vendeur", avatar: "JM",
    description: "iPhone 14 Pro 256GB, état neuf, boîte et accessoires inclus.",
    address: "Bujumbura, Rohero", price: "1 250 000 BIF", phone: "25779123456" },
  { id: 2, name: "Aline K.", role: "Acheteur", avatar: "AK",
    description: "Recherche 20 sacs de riz Kirundo qualité premium pour restaurant.",
    address: "Gitega, Centre", price: "Budget 2 000 000 BIF", phone: "25771987654" },
  { id: 3, name: "Hotel Panorama", role: "Vendeur", avatar: "HP",
    description: "Suite exécutive avec vue lac, petit-déjeuner et wifi inclus.",
    address: "Bujumbura, Kiriri", price: "180 000 BIF / nuit", phone: "25722445566" },
  { id: 4, name: "David N.", role: "Vendeur", avatar: "DN",
    description: "Toyota RAV4 2018, 78 000 km, entretien à jour, très propre.",
    address: "Ngozi, Ville", price: "38 500 000 BIF", phone: "25776554433" },
  { id: 5, name: "Cargo Express", role: "Vendeur", avatar: "CE",
    description: "Transport cargo Bujumbura ↔ Dar es Salaam, 3 rotations/semaine.",
    address: "Port de Bujumbura", price: "à partir de 950 USD/tonne", phone: "25778112233" },
  { id: 6, name: "Sarah B.", role: "Acheteur", avatar: "SB",
    description: "Cherche kit de cuisine professionnel complet pour ouverture resto.",
    address: "Bujumbura, Kinindo", price: "Budget 5 000 USD", phone: "25779332211" },
  { id: 7, name: "MusicStore BDI", role: "Vendeur", avatar: "MB",
    description: "Guitare électrique Fender Squier + ampli 40W, garantie 6 mois.",
    address: "Bujumbura, Asiatique", price: "780 000 BIF", phone: "25771556677" },
  { id: 8, name: "Clinique Amani", role: "Vendeur", avatar: "CA",
    description: "Consultation générale, cardiologie et laboratoire sur rendez-vous.",
    address: "Bujumbura, Mutanga", price: "dès 25 000 BIF", phone: "25722998877" },
];

function Index() {
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
              placeholder="Rechercher un produit, service, vendeur…"
              className="w-full h-10 pl-9 pr-3 rounded-full bg-secondary text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <nav className="flex items-center rounded-full border border-border bg-secondary p-0.5 text-xs font-semibold">
            <button className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground">ANG</button>
            <button className="px-2.5 py-1 rounded-full bg-accent text-foreground">FR</button>
            <button className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground">Ki</button>
          </nav>
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
        {POSTS.map((p) => {
          const isSeller = p.role === "Vendeur";
          const waUrl = `https://wa.me/${p.phone}?text=${encodeURIComponent(`Bonjour ${p.name}, je vous contacte via P2P au sujet de: ${p.description}`)}`;
          return (
            <article key={p.id} className="rounded-2xl bg-card border border-border p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div
                  className={`h-12 w-12 shrink-0 rounded-full grid place-items-center font-bold text-sm ${
                    isSeller ? "bg-seller text-primary-foreground" : "bg-buyer text-foreground"
                  }`}
                  aria-hidden
                >
                  {p.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        isSeller ? "bg-seller/15 text-seller" : "bg-buyer/15 text-buyer"
                      }`}
                    >
                      {p.role}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/90 leading-relaxed">{p.description}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{p.address}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-base font-bold text-foreground">{p.price}</div>
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
        })}
      </main>

      {/* FOOTER NAV */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-2xl px-2 py-2 grid grid-cols-5 items-center gap-1 text-[11px]">
          <FooterBtn icon={<Home className="h-5 w-5" />} label="Home" active />
          <FooterBtn icon={<Store className="h-5 w-5" />} label="Vendeur" tone="seller" />
          <button className="flex flex-col items-center justify-center">
            <span className="h-11 w-11 -mt-6 rounded-full bg-foreground text-background grid place-items-center shadow-lg">
              <PlusSquare className="h-5 w-5" />
            </span>
            <span className="mt-1 font-medium text-muted-foreground">Ajouter</span>
          </button>
          <FooterBtn icon={<ShoppingBag className="h-5 w-5" />} label="Acheteur" tone="buyer" />
          <FooterBtn icon={<User className="h-5 w-5" />} label="Profil" />
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
