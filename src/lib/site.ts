// Canonical public origin of the deployed app — the single source of truth for
// SEO surfaces (canonical link, og:url, sitemap <loc>, robots Sitemap line).
// ▸ When the custom domain goes live, change it HERE and in public/robots.txt.
export const SITE_URL = "https://apnos-three.vercel.app";

// Social-share image (1200×630-ish raster; SVG isn't supported by FB/Twitter
// crawlers). Currently the Lovable-hosted screenshot — replace with a
// self-hosted /og.png when a designed card exists.
export const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9dbcc58f-39c3-4237-aa50-3fff6dc38f40/id-preview-225a5f16--5cc244fb-1fab-481f-8259-a5bb9e400730.lovable.app-1781730265401.png";
