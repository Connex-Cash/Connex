import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { BRAND, CHAIN, hasGithub, hasX } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { HOME_DESCRIPTION, HOME_TITLE, OG_IMAGE } from "@/lib/seo";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

/** Applies a saved light/dark choice before first paint so the page never flashes the other theme. */
const THEME_INIT = `try{var t=localStorage.getItem("connex-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: HOME_TITLE, template: `%s | ${BRAND.name}` },
  description: HOME_DESCRIPTION,
  applicationName: BRAND.name,
  category: "finance",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    url: "/",
    siteName: BRAND.name,
    locale: "en_US",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    ...(hasX ? { site: BRAND.xHandle, creator: BRAND.xHandle } : {}),
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
  viewportFit: "cover",
};

const SAME_AS = ([hasX ? BRAND.x : null, hasGithub ? BRAND.github : null] as (string | null)[]).filter((v): v is string => Boolean(v));

const ORG = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BRAND.url}/#org`,
      name: BRAND.name,
      url: BRAND.url,
      logo: { "@type": "ImageObject", url: `${BRAND.url}/icon.png`, width: 512, height: 512 },
      ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
    },
    {
      "@type": "WebSite",
      "@id": `${BRAND.url}/#site`,
      name: BRAND.name,
      url: BRAND.url,
      description: HOME_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${BRAND.url}/#org` },
    },
    {
      "@type": "WebApplication",
      "@id": `${BRAND.url}/#app`,
      name: BRAND.name,
      url: BRAND.url,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web browser",
      description: `${BRAND.category} on ${CHAIN.name}: every 30 minutes an AI agent turns a trending topic into a token on Pons, holds none of it and splits the creator fees between a $CONNEX buyback and the next launch.`,
      publisher: { "@id": `${BRAND.url}/#org` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="overflow-x-hidden">
        <JsonLd data={ORG} />
        <WalletProvider>
          <WalletModalProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </WalletModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
