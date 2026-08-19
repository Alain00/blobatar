import { createMemo } from "solid-js";
import { _parts, type BlobatarOptions } from "../blobatar";
import { blobatarUri } from "../uri";
import type { BlobatarProps } from "./types";

export function Blobatar(props: BlobatarProps) {
  const opts = createMemo<BlobatarOptions>(() => ({
    generation: props.generation,
    background: props.background,
    palette: props.palette,
    hue: props.hue,
    tone: props.tone,
    normalize: props.normalize,
    contrast: props.contrast,
    title: props.title,
    expression: props.expression,
    traits: props.traits,
  }));

  const isAnimated = createMemo(() => !!props.animate);

  const src = createMemo(() =>
    isAnimated() ? "" : blobatarUri(props.name, opts()),
  );

  const parts = createMemo(() =>
    isAnimated()
      ? _parts(props.name, { ...opts(), animate: props.animate })
      : null,
  );

  return () => {
    const p = parts();
    if (p) {
      const { style, class: className, alt: _alt, ...svgRest } = props as Record<string, unknown>;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      if (props.size) {
        svg.setAttribute("width", String(props.size));
        svg.setAttribute("height", String(props.size));
      }
      if (props.title) {
        svg.setAttribute("role", "img");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = props.title;
        svg.appendChild(title);
      } else {
        svg.setAttribute("aria-hidden", "true");
      }
      const mergedStyle = { ...(p.vars as Record<string, string>), ...(style as Record<string, string>) };
      Object.entries(mergedStyle).forEach(([k, v]) => svg.style.setProperty(k, String(v)));
      if (className) {
        svg.setAttribute("class", String(className));
      }
      for (const [k, v] of Object.entries(svgRest)) {
        if (v !== undefined && v !== null) {
          svg.setAttribute(k, String(v));
        }
      }
      if (p.bg) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", p.bg.d);
        path.setAttribute("fill", p.bg.fill);
        svg.appendChild(path);
      }
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      if (p.cls) g.setAttribute("class", p.cls);
      g.innerHTML = p.inner;
      svg.appendChild(g);
      return svg;
    }

    const { style, class: className, alt, ...imgRest } = props as Record<string, unknown>;
    const img = document.createElement("img");
    img.src = src();
    if (props.size) {
      img.width = props.size;
      img.height = props.size;
    }
    img.alt = (alt as string) ?? props.title ?? "";
    if (className) img.className = String(className);
    if (style && typeof style === "object") {
      Object.entries(style as Record<string, string>).forEach(([k, v]) => img.style.setProperty(k, String(v)));
    }
    for (const [k, v] of Object.entries(imgRest)) {
      if (v !== undefined && v !== null) {
        img.setAttribute(k, String(v));
      }
    }
    return img;
  };
}
