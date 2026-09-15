import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://facturepro.faitle.net",
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
