
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Motion } from "@/editor/snippet";
import { blobatar, type TraitOverrides } from "blobatar";


type DownloadMenuProps = {
  name: string;
  traits: TraitOverrides;
  motion: Motion;
};

export default function DownloadMenu({
  name,
  traits,
  motion,
}: DownloadMenuProps) {
  const SIZE = 512;

  function downloadSvg() {
    const svg = blobatar(name || " ", {
      traits,
      size: SIZE,
    });

    const file = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    saveBlob(file, `${blobatarFilename(name)}.svg`);
  }

  function saveBlob(file: Blob, fileName: string) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function blobatarFilename(name: string) {
    const safeName = name
      .trim()
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    return safeName ? `blobatar-${safeName}` : "blobatar";
  }

  async function downloadPng() {
    const svg = blobatar(name || " ", {
      traits,
      size: SIZE,
    });

    const svgFile = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const svgUrl = URL.createObjectURL(svgFile);

    try {
      const image = await loadImage(svgUrl);

      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not create canvas context");
      }

      context.drawImage(image, 0, 0, SIZE, SIZE);

      const pngFile = await canvasToBlob(canvas);

      saveBlob(pngFile, `${blobatarFilename(name)}.png`);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Could not load SVG for PNG export"));

      image.src = src;
    });
  }

  function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((file) => {
        if (file) {
          resolve(file);
        } else {
          reject(new Error("Could not encode PNG"));
        }
      }, "image/png");
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-ink text-ground inline-flex h-11 overflow-hidden rounded-full">
        <button
          type="button"
          onClick={downloadSvg}
          className="flex items-center cursor-pointer gap-2 px-5 text-sm transition-opacity hover:opacity-80"
        >
          <DownloadIcon />
          <span>Download SVG</span>
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Choose download format"
              className="border-ground/20 cursor-pointer flex w-11 items-center justify-center border-l transition-opacity hover:opacity-70"
            >
              <ChevronDownIcon />
            </button>
          </PopoverTrigger>

          <PopoverContent align="center" sideOffset={8} className="w-56 p-2">
            <button
              type="button"
              onClick={downloadPng}
              className="hover:bg-line/60 cursor-pointer flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors"
            >
              <span className="text-sm">PNG</span>
              <span className="text-muted text-xs">512 × 512 image</span>
            </button>

            {motion && (
              <p className="text-muted border-line mt-2 border-t px-3 pt-3 text-xs leading-relaxed">
                Motion is preview-only. Downloads are static.
              </p>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="m7 9 5 5 5-5" />
    </svg>
  );
}
