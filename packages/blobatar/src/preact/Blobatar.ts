import { useMemo } from "preact/hooks";
import { _parts } from "../blobatar";
import { blobatarUri } from "../uri";
import type { BlobatarProps } from "./types";

export function Blobatar({
  name: seed,
  size,
  generation,
  background,
  palette,
  hue,
  tone,
  normalize,
  contrast,
  title,
  animate,
  expression,
  traits,
  ...rest
}: BlobatarProps) {
  const opts = { generation, background, palette, hue, tone, normalize, contrast, title, expression, traits };

  const dep = JSON.stringify([seed, opts, animate]);

  const src = useMemo(
    () => (animate ? "" : blobatarUri(seed, opts)),
    [dep],
  );

  const parts = useMemo(
    () => (animate ? _parts(seed, { ...opts, animate }) : null),
    [dep],
  );

  if (parts) {
    const { style, ...svgRest } = rest as Record<string, unknown>;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    if (size) {
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
    }
    if (title) {
      svg.setAttribute("role", "img");
      const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "title");
      titleEl.textContent = title;
      svg.appendChild(titleEl);
    } else {
      svg.setAttribute("aria-hidden", "true");
    }
    const mergedStyle = { ...(parts.vars as Record<string, string>), ...(style as Record<string, string>) };
    Object.entries(mergedStyle).forEach(([k, v]) => svg.style.setProperty(k, String(v)));
    for (const [k, v] of Object.entries(svgRest)) {
      if (v !== undefined && v !== null) {
        svg.setAttribute(k, String(v));
      }
    }
    if (parts.bg) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", parts.bg.d);
      path.setAttribute("fill", parts.bg.fill);
      svg.appendChild(path);
    }
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (parts.cls) g.setAttribute("class", parts.cls);
    g.innerHTML = parts.inner;
    svg.appendChild(g);
    return svg;
  }

  const { alt, ...imgRest } = rest as Record<string, unknown>;
  const img = document.createElement("img");
  img.src = src;
  if (size) {
    img.width = size;
    img.height = size;
  }
  img.alt = (alt as string) ?? title ?? "";
  for (const [k, v] of Object.entries(imgRest)) {
    if (v !== undefined && v !== null) {
      if (k === "class") {
        img.className = String(v);
      } else if (k === "style" && typeof v === "object") {
        Object.entries(v as Record<string, string>).forEach(([sk, sv]) =>
          img.style.setProperty(sk, String(sv)),
        );
      } else {
        img.setAttribute(k, String(v));
      }
    }
  }
  return img;
}
