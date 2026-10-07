import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

/** Every indexable page (the same list as the nav and footer). /deploy and single-launch pages stay out (noindex). */
export const SITEMAP_PATHS: { path: string; priority: number; changeFrequency: "hourly" | "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/round", priority: 0.6, changeFrequency: "hourly" },
  { path: "/launches", priority: 0.6, changeFrequency: "hourly" },
  { path: "/earnings", priority: 0.6, changeFrequency: "daily" },
  { path: "/spend", priority: 0.6, changeFrequency: "daily" },
  { path: "/playbook", priority: 0.6, changeFrequency: "daily" },
  { path: "/docs", priority: 0.6, changeFrequency: "weekly" },
  { path: "/contracts", priority: 0.6, changeFrequency: "weekly" },
  { path: "/token", priority: 0.6, changeFrequency: "weekly" },
  { path: "/terms", priority: 0.6, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const modified = new Date("2026-10-08T00:00:00Z");
  return SITEMAP_PATHS.map((p) => ({
    url: `${BRAND.url}${p.path === "/" ? "" : p.path}`,
    lastModified: modified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
