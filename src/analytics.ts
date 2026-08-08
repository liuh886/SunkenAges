const CLOUDFLARE_WEB_ANALYTICS_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

export function initializeAnalytics(): void {
  const token = String(import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN ?? "").trim();
  if (!token || typeof document === "undefined") return;
  if (document.querySelector(`script[src="${CLOUDFLARE_WEB_ANALYTICS_SRC}"]`)) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = CLOUDFLARE_WEB_ANALYTICS_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(script);
}
