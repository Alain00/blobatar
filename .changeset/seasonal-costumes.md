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

The mapping does not move: renders without `season` are byte-identical to 2.8.0.

Add `season`, a costume for a date, with `blobatar/seasonal` as its entry point.

```ts
import { seasonNow } from "blobatar/seasonal";
blobatar(user.email, { season: seasonNow() });
```

`halloween` (24 Oct – 1 Nov) makes each name a pumpkin or a ghost; `christmas` (10–26 Dec) adds a Santa hat, and a beard for half the names. `seasonNow()` is the only function that reads the clock, so `blobatar()` stays deterministic. A season costs about 1.6 KB gzipped to whoever imports it and 93 B in the core. Every adapter forwards the prop the way it forwards `expression`; the Flutter port has no `season` yet.
