import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Pixelify_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { BRAND, CHAIN, hasGithub, hasX } from "@/config/brand";
import { Toaster } from "@/components/CopyCa";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { HOME_DESCRIPTION, HOME_TITLE, OG_IMAGE } from "@/lib/seo";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-jbmono", display: "swap" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pressstart", display: "swap" });
const pixel2 = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-pixelify", display: "swap" });

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
  themeColor: "#05070f",
  colorScheme: "dark",
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
    <html lang="en" className={`${manrope.variable} ${mono.variable} ${pixel.variable} ${pixel2.variable}`}>
      <body className="overflow-x-hidden">
        <JsonLd data={ORG} />
        <WalletProvider>
          <WalletModalProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
            <Toaster />
          </WalletModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
