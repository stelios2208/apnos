// Premium shareable result card (Instagram/Facebook portrait, 1080×1350).
// Built as a self-contained SVG (no external fonts/images so it rasterises
// cleanly to PNG) then shared via the Web Share API or downloaded as fallback.

export interface ShareCardData {
  athleteName: string;
  disciplineLabel: string;
  resultLabel: string; // "5:30" or "150 m"
  dateLabel: string;
  isPB: boolean;
  lang: string;
}

const W = 1080;
const H = 1350;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

function bubbles(): string {
  const spec = [
    [140, 1180, 10],
    [230, 1240, 6],
    [330, 1120, 14],
    [180, 980, 5],
    [860, 1200, 12],
    [780, 1090, 7],
    [940, 1250, 9],
    [700, 1260, 5],
    [520, 1180, 8],
    [610, 1130, 6],
    [420, 1240, 7],
    [90, 1080, 6],
  ];
  return spec
    .map(
      ([cx, cy, r], i) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#9FE1CB" opacity="${(0.1 + (i % 4) * 0.06).toFixed(2)}"/>`,
    )
    .join("");
}

export function buildShareSvg(d: ShareCardData): string {
  const pbBadge = d.isPB
    ? `<g transform="translate(540 848)">
         <rect x="-160" y="-34" width="320" height="68" rx="34" fill="#EF9F27" opacity="0.16" stroke="#EF9F27" stroke-width="1.5" stroke-opacity="0.5"/>
         <text x="0" y="10" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="6" fill="#EF9F27">${d.lang === "el" ? "ΑΤΟΜΙΚΟ ΡΕΚΟΡ" : "PERSONAL BEST"}</text>
       </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#1a3a5c"/>
      <stop offset="0.45" stop-color="#10293f"/>
      <stop offset="1" stop-color="#070a10"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="-0.05" r="0.75">
      <stop offset="0" stop-color="#5DCAA5" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#1D9E75" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mk-breath" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5DCAA5"/><stop offset="1" stop-color="#1D9E75"/>
    </linearGradient>
    <radialGradient id="mk-fall" cx="50%" cy="38%" r="65%">
      <stop offset="0" stop-color="#7BD9B8"/><stop offset="1" stop-color="#1D9E75"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>

  <!-- light rays -->
  <g stroke="#5DCAA5" stroke-width="2" opacity="0.06">
    <line x1="240" y1="0" x2="320" y2="900"/>
    <line x1="540" y1="0" x2="500" y2="900"/>
    <line x1="840" y1="0" x2="760" y2="900"/>
  </g>

  ${bubbles()}

  <!-- Apnos logo mark -->
  <g transform="translate(487 74) scale(2.6)">
    <path d="M25.47 4.96 A16 16 0 1 1 14.53 4.96" stroke="url(#mk-breath)" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <circle cx="20" cy="25" r="4.2" fill="url(#mk-fall)"/>
    <circle cx="20" cy="15.5" r="1.05" fill="#5DCAA5" opacity="0.55"/>
    <circle cx="20" cy="19.2" r="1.5" fill="#5DCAA5" opacity="0.8"/>
  </g>

  <!-- wordmark -->
  <text x="540" y="250" text-anchor="middle" font-family="${FONT}" font-size="46" font-weight="800" letter-spacing="14" fill="#9FE1CB">APNOS</text>
  <text x="540" y="292" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="8" fill="#5DCAA5" opacity="0.7">${d.lang === "el" ? "ΗΜΕΡΟΛΟΓΙΟ ΑΠΝΟΙΑΣ" : "FREEDIVING LOG"}</text>

  <!-- discipline -->
  <text x="540" y="560" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="600" letter-spacing="6" fill="#5DCAA5">${esc(d.disciplineLabel.toUpperCase())}</text>

  <!-- result -->
  <text x="540" y="740" text-anchor="middle" font-family="${FONT}" font-size="210" font-weight="300" letter-spacing="-4" fill="#ffffff">${esc(d.resultLabel)}</text>

  ${pbBadge}

  <!-- divider -->
  <rect x="360" y="1010" width="360" height="2" rx="1" fill="#ffffff" opacity="0.12"/>

  <!-- athlete + date -->
  <text x="540" y="1105" text-anchor="middle" font-family="${FONT}" font-size="54" font-weight="700" fill="#ffffff">${esc(d.athleteName)}</text>
  <text x="540" y="1160" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="400" fill="#ffffff" opacity="0.5">${esc(d.dateLabel)}</text>

  <!-- footer -->
  <text x="540" y="1285" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="600" letter-spacing="2" fill="#5DCAA5">apnos.app</text>
</svg>`;
}

// ── Programme card (for coaches to send their athletes) ──────────────────────

export interface ProgramCardData {
  title: string;
  disciplineCode: string;
  disciplineLabel: string;
  accent: string;
  lines: string[]; // one readable line per set/round
  footerName: string; // coach or athlete name
  lang: string;
}

export function buildProgramSvg(d: ProgramCardData): string {
  const MAX = 9;
  const shown = d.lines.slice(0, MAX);
  const extra = d.lines.length - shown.length;
  const trunc = (s: string) => (s.length > 42 ? s.slice(0, 41) + "…" : s);
  const y0 = 640,
    step = 62;

  const lineEls = shown
    .map((ln, i) => {
      const y = y0 + i * step;
      return (
        `<circle cx="150" cy="${y - 11}" r="5" fill="${d.accent}"/>` +
        `<text x="180" y="${y}" font-family="${FONT}" font-size="34" font-weight="500" fill="#e8f2ee">${esc(trunc(ln))}</text>`
      );
    })
    .join("");
  const extraEl =
    extra > 0
      ? `<text x="540" y="${y0 + shown.length * step + 12}" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="600" fill="#5DCAA5">+${extra} ${d.lang === "el" ? "ακόμα" : "more"}</text>`
      : "";
  const title = d.title.length > 26 ? d.title.slice(0, 25) + "…" : d.title;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="pbg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#1a3a5c"/><stop offset="0.45" stop-color="#10293f"/><stop offset="1" stop-color="#070a10"/>
    </linearGradient>
    <radialGradient id="psun" cx="0.5" cy="-0.05" r="0.75">
      <stop offset="0" stop-color="#5DCAA5" stop-opacity="0.28"/><stop offset="1" stop-color="#1D9E75" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pmk-breath" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5DCAA5"/><stop offset="1" stop-color="#1D9E75"/>
    </linearGradient>
    <radialGradient id="pmk-fall" cx="50%" cy="38%" r="65%">
      <stop offset="0" stop-color="#7BD9B8"/><stop offset="1" stop-color="#1D9E75"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#pbg)"/>
  <rect width="${W}" height="${H}" fill="url(#psun)"/>
  ${bubbles()}

  <!-- logo + wordmark -->
  <g transform="translate(487 74) scale(2.6)">
    <path d="M25.47 4.96 A16 16 0 1 1 14.53 4.96" stroke="url(#pmk-breath)" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <circle cx="20" cy="25" r="4.2" fill="url(#pmk-fall)"/>
    <circle cx="20" cy="15.5" r="1.05" fill="#5DCAA5" opacity="0.55"/>
    <circle cx="20" cy="19.2" r="1.5" fill="#5DCAA5" opacity="0.8"/>
  </g>
  <text x="540" y="250" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="800" letter-spacing="12" fill="#9FE1CB">APNOS</text>

  <!-- discipline badge -->
  <g transform="translate(540 360)">
    <rect x="-90" y="-30" width="180" height="60" rx="30" fill="${d.accent}" opacity="0.16" stroke="${d.accent}" stroke-width="1.5" stroke-opacity="0.5"/>
    <text x="0" y="11" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="800" letter-spacing="3" fill="${d.accent}">${esc(d.disciplineCode)}</text>
  </g>

  <!-- title -->
  <text x="540" y="470" text-anchor="middle" font-family="${FONT}" font-size="52" font-weight="700" fill="#ffffff">${esc(title)}</text>
  <text x="540" y="522" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="500" letter-spacing="3" fill="#5DCAA5">${esc(d.disciplineLabel.toUpperCase())}</text>

  <!-- sets panel -->
  <rect x="90" y="565" width="900" height="${Math.max(120, shown.length * step + 70)}" rx="28" fill="#ffffff" opacity="0.03"/>
  ${lineEls}
  ${extraEl}

  <!-- footer -->
  <text x="540" y="1250" text-anchor="middle" font-family="${FONT}" font-size="36" font-weight="700" fill="#ffffff" opacity="0.85">${esc(d.footerName)}</text>
  <text x="540" y="1298" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="600" letter-spacing="2" fill="#5DCAA5">${d.lang === "el" ? "Πρόγραμμα" : "Programme"} · apnos.app</text>
</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    };
    img.onerror = () => reject(new Error("svg image load failed"));
    img.src = svgDataUrl(svg);
  });
}

export async function shareOrDownload(
  pngBlob: Blob,
  filename: string,
  shareText: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([pngBlob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; text?: string; title?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: shareText, title: "Apnos" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared"; // user cancelled
      // otherwise fall back to download
    }
  }
  const url = URL.createObjectURL(pngBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return "downloaded";
}
