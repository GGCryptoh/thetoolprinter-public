import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog/posts';

const SITE = 'https://thetoolprinter.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE}/what-is-this`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/architecture`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/report`, lastModified: now, changeFrequency: 'hourly', priority: 0.5 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/disclaimer`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogRoutes];
}
