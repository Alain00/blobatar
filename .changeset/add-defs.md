---
"blobatar": minor
"@blobatar/react": minor
"@blobatar/vue": minor
"@blobatar/solid": minor
"@blobatar/preact": minor
"@blobatar/svelte": minor
"@blobatar/angular": minor
"@blobatar/react-native": minor
---

Add `defs` and `paint`, so the body can be filled with a gradient, a pattern or an image instead of a flat color.

```ts
blobatar(user.email, {
  defs: `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#818cf8"/>
         </linearGradient>`,
  paint: "url(#sky)",
});
```

`defs` is SVG markup for a `<defs>` block, emitted as given. `paint` is what the body is drawn with in place of its color, usually `url(#id)` into `defs`. A pattern can layer a base color, an image and a gradient over it.

`paint` replaces what is drawn and leaves the color alone, so the eyes keep their contrast and a tinting `expression` still tints them. That is the difference from `palette: { head: "url(#id)" }`, which replaces the color, so a tinting pose has no color to mix and the paint is lost. It works in the string API, in `blobatarUri` and in the static `<img>`, where `defs` travels inside the image, and with `animate`, where `defs` leads the inline markup and `paint` goes into `--mo-head`, so no adapter renders anything new. The README has a section on ids and on `<image>` inside an `<img>`.

Blobatars without `defs` and `paint` render byte-identically to before, and the seed to look mapping does not move: the golden fixture is untouched. The animated markup still does not depend on the expression.

`@blobatar/vue`, `@blobatar/solid`, `@blobatar/preact`, `@blobatar/svelte` and `@blobatar/angular` forward the two new props the same way they forward `palette`. They are web SVG only: `@blobatar/react-native` has no markup to put them in, so its props omit them, as they omit `animate`, and the Flutter port does not gain them. The React Native entry is listed only because the set is versioned together.
