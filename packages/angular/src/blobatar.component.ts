import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  inject,
  input,
  viewChild,
  type InputSignal,
  type Signal,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { DomSanitizer, type SafeHtml } from "@angular/platform-browser";
import { _parts, serializeVars, type Animate, type BlobatarOptions } from "blobatar/internal";
import { blobatarUri } from "blobatar/uri";

/**
 * `<blobatar>` — the Angular adapter.
 *
 * The same component every other adapter is: one required `name`, core's
 * options as inputs and nothing else, an `<img>` when still and an inline
 * `<svg>` when `animate` is on. `packages/harness` renders it next to the React
 * adapter and asserts the two produce the same blobatar, so an input that
 * changed the picture here and nowhere else would fail there.
 *
 * Three things differ from the JSX adapters, all of them Angular's shape rather
 * than a choice:
 *
 * - **There is a host element.** `<blobatar>` stays in the DOM around the
 *   `<img>` or `<svg>`, so a `class` or `style` written on it lands on the host
 *   rather than being spread onto the inner element. That is why `alt` is an
 *   input: an `alt` attribute on the host would label nothing.
 * - **The animated `<svg>` is written twice: as a template for the browser and
 *   as a string for the server.** Angular's server DOM (domino) throws
 *   `NotYetImplemented` for `innerHTML` on any SVG element, and core's figure
 *   only exists as markup, so the template that works in a browser cannot run
 *   during SSR at all. The server instead parses the whole `<svg>` as HTML
 *   inside a `display: contents` wrapper, which domino does support, and the
 *   host carries `ngSkipHydration` so the browser re-renders it rather than
 *   trying to adopt markup its own template did not produce. Both paths build
 *   the same three children from the same `_parts` call; `packages/harness`
 *   compares the server's against React's.
 * - **The gaze layer is a directive** at `@blobatar/angular/gaze`, the same
 *   subpath bargain React makes, and it finds the `<svg>` through `svg` below.
 */
@Component({
  selector: "blobatar",
  standalone: true,
  // No styles of its own, so nothing to encapsulate. Every rule an adapter
  // could add here would be a difference from the other adapters' picture.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: "true" },
  // Three real children of the <svg> rather than one innerHTML blob, for the
  // reason React's adapter gives: only the root <g> varies when the expression
  // changes, and an innerHTML that included it would rebuild the subtree the
  // morph runs in. <title> must be the first child to label the <svg>, and the
  // backdrop sits outside the hover lift.
  template: `
    @if (parts(); as p) {
      @if (browser) {
        <svg
          #svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          [attr.width]="size()"
          [attr.height]="size()"
          [attr.role]="title() ? 'img' : null"
          [attr.aria-hidden]="title() ? null : 'true'"
          [attr.style]="style()"
        >
          @if (title()) {
            <title>{{ title() }}</title>
          }
          @if (p.bg) {
            <path [attr.d]="p.bg.d" [attr.fill]="p.bg.fill" />
          }
          <g [attr.class]="p.cls" [innerHTML]="inner()"></g>
        </svg>
      } @else {
        <span style="display: contents" [innerHTML]="serverSvg()"></span>
      }
    } @else {
      <img
        [attr.src]="src()"
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.alt]="alt() ?? title() ?? ''"
      />
    }
  `,
})
export class Blobatar {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Who the blobatar is for. A username, a display name, an email, a user id —
   * any string, and the same string always renders the same blobatar. The only
   * required input.
   */
  readonly name = input.required<string>();

  /**
   * `"hover"` or `"always"` renders the animated `<svg>`; omitted or `false`
   * renders the static `<img>`. Needs `blobatar/motion.css`.
   */
  readonly animate = input<Animate | false | undefined>(undefined);

  // Core's options, one input each and no defaults: an omitted input is
  // `undefined`, so core stays the only place a default is written down.
  readonly size = input<BlobatarOptions["size"]>(undefined);
  readonly background = input<BlobatarOptions["background"]>(undefined);
  readonly backgroundColor = input<BlobatarOptions["backgroundColor"]>(undefined);
  // Annotated, not inferred: the expanded type names core's internal `color`
  // module, which a published declaration file cannot reach (TS2742).
  readonly palette: InputSignal<BlobatarOptions["palette"]> = input<BlobatarOptions["palette"]>(undefined);
  readonly defs = input<BlobatarOptions["defs"]>(undefined);
  readonly paint = input<BlobatarOptions["paint"]>(undefined);
  readonly hue = input<BlobatarOptions["hue"]>(undefined);
  readonly tone = input<BlobatarOptions["tone"]>(undefined);
  readonly normalize = input<BlobatarOptions["normalize"]>(undefined);
  readonly contrast = input<BlobatarOptions["contrast"]>(undefined);
  readonly title = input<BlobatarOptions["title"]>(undefined);
  readonly expression = input<BlobatarOptions["expression"]>(undefined);
  readonly traits = input<BlobatarOptions["traits"]>(undefined);

  /** The `<img>`'s `alt`. Defaults to `title`, then to `""` (decorative). */
  readonly alt = input<string | undefined>(undefined);

  /**
   * The rendered `<svg>`, or `undefined` while the blobatar is static. Public
   * for `@blobatar/angular/gaze`, which needs an element to drive.
   */
  readonly svg = viewChild<ElementRef<SVGSVGElement>>("svg");

  private readonly opts = computed<BlobatarOptions>(() => ({
    size: this.size(),
    background: this.background(),
    backgroundColor: this.backgroundColor(),
    palette: this.palette(),
    defs: this.defs(),
    paint: this.paint(),
    hue: this.hue(),
    tone: this.tone(),
    normalize: this.normalize(),
    contrast: this.contrast(),
    title: this.title(),
    expression: this.expression(),
    traits: this.traits(),
  }));

  protected readonly src = computed(() =>
    this.animate() ? null : blobatarUri(this.name(), this.opts()),
  );

  protected readonly parts: Signal<ReturnType<typeof _parts> | null> = computed(() => {
    const animate = this.animate();
    return animate ? _parts(this.name(), { ...this.opts(), animate }) : null;
  });

  protected readonly style = computed(() => {
    const vars = this.parts()?.vars;
    return vars ? serializeVars(vars) : null;
  });

  /**
   * Core's markup, trusted as core's output. Angular's sanitizer would strip
   * SVG from an `[innerHTML]` binding; what reaches here was built by
   * `_parts`, which escapes every caller-supplied string itself — the same
   * trust the React adapter extends through `dangerouslySetInnerHTML`.
   */
  protected readonly inner = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.parts()?.inner ?? ""),
  );

  /**
   * The browser template above, as the string the server parses instead. Every
   * caller-supplied value is escaped here; `inner` is core's, escaped by core.
   */
  protected readonly serverSvg = computed<SafeHtml>(() => {
    const p = this.parts();
    if (!p) return "";
    const size = this.size();
    const title = this.title();
    const style = this.style();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"` +
      (size !== undefined ? ` width="${escape(String(size))}" height="${escape(String(size))}"` : "") +
      (title ? ` role="img"` : ` aria-hidden="true"`) +
      (style ? ` style="${escape(style)}"` : "") +
      `>` +
      (title ? `<title>${escape(title)}</title>` : "") +
      (p.bg ? `<path d="${escape(p.bg.d)}" fill="${escape(p.bg.fill)}"></path>` : "") +
      (p.cls ? `<g class="${escape(p.cls)}">` : `<g>`) +
      `${p.inner}</g></svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
