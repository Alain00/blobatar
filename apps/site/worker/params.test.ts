import { expect, test } from "bun:test";
import { happy } from "blobatar/expression";
import { BadRequest, MAX_NAME, parseName, parseOptions } from "./params";

const opts = (qs: string) => parseOptions(new URLSearchParams(qs));
const name = (p: string) => parseName(p, "/avatar/");
const bad = (fn: () => unknown) => {
  expect(fn).toThrow(BadRequest);
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("unreachable");
};

test("no parameters is no options", () => {
  expect(opts("")).toEqual({});
});

test("parameters map onto the library's own names", () => {
  expect(opts("size=64&hue=200&tone=0.25&title=Alain")).toEqual({
    size: 64,
    hue: 200,
    tone: 0.25,
    title: "Alain",
  });
});

test("background=none is the falsy one, and survives being falsy", () => {
  expect(opts("background=none")).toEqual({ background: false });
  expect(opts("background=squircle")).toEqual({ background: "squircle" });
});

test("expressions resolve to the library's values, not to strings", () => {
  expect(opts("expression=happy").expression).toBe(happy);
});

test("the roster is exactly the thirteen poses", () => {
  const roster = ["idle", "happy", "sad", "mad", "surprised", "wink", "sleepy",
    "smug", "unsure", "scared", "love", "shy", "sick"];
  for (const pose of roster) expect(opts(`expression=${pose}`).expression).toBeDefined();
  // The expression module also exports its machinery; none of it is a pose.
  bad(() => opts("expression=poseVars"));
  bad(() => opts("expression=bakePose"));
});

test("prototype keys are not poses either", () => {
  // `"__proto__" in table` is true — `in` walks the prototype chain — so these
  // used to come back as Object.prototype and friends, which are not
  // Expressions and crash the render: a caller typo served as a 500.
  bad(() => opts("expression=__proto__"));
  bad(() => opts("expression=constructor"));
  bad(() => opts("expression=toString"));
  bad(() => opts("background=__proto__"));
});

test("an undocumented parameter is an error, not a silent drop", () => {
  // The failure this exists for: a typo renders a valid blobatar wearing the
  // wrong face, and the caller has nothing to notice.
  expect(bad(() => opts("expresion=happy"))).toContain("unknown parameter");
  bad(() => opts("utm_source=x"));
});

test("size clamps where everything else validates", () => {
  // The one parameter that cannot make the answer wrong — only the wrong scale,
  // which CSS can fix. Also what keeps Gravatar's s=2048 from 400ing.
  expect(opts("size=64").size).toBe(64);
  expect(opts("size=2048").size).toBe(1024);
  expect(opts("size=1").size).toBe(8);
  expect(opts("size=32.6").size).toBe(33);
  // Blank is ignored rather than clamped: `Number("")` is 0, which would
  // otherwise serve an 8px avatar in answer to an empty parameter.
  expect(opts("size=").size).toBeUndefined();
  expect(opts("size=abc").size).toBeUndefined();
});

test("s is Gravatar's spelling of size, and wins when both appear", () => {
  expect(opts("s=64").size).toBe(64);
  expect(opts("s=64&size=256").size).toBe(64);
});

test("the other numeric bounds are inclusive and enforced", () => {
  // A full turn lands on 360 and callers compute into hue.
  expect(opts("hue=360").hue).toBe(360);
  expect(opts("hue=0").hue).toBe(0);
  expect(opts("tone=0").tone).toBe(0);
  expect(opts("tone=1").tone).toBe(1);
  bad(() => opts("tone=1.1"));
  bad(() => opts("hue=361"));
  bad(() => opts("hue=abc"));
});

test("title is capped", () => {
  expect(opts(`title=${"a".repeat(128)}`).title).toHaveLength(128);
  bad(() => opts(`title=${"a".repeat(129)}`));
});

test("names come off the path under the prefix", () => {
  expect(name("/avatar/alain00")).toBe("alain00");
  expect(name("/avatar/alain%40example.com")).toBe("alain@example.com");
  expect(name("/avatar/%F0%9F%A6%8A")).toBe("🦊");
});

test("image extensions are accepted and discarded", () => {
  for (const ext of [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".PNG"]) {
    expect(name(`/avatar/alain${ext}`)).toBe("alain");
  }
});

test("a name that is itself an extension still works", () => {
  expect(name("/avatar/.svg.svg")).toBe(".svg");
});

test("the path is one segment under the prefix", () => {
  expect(bad(() => name("/avatar/a/b"))).toContain("%2F");
  bad(() => name("/avatar/"));
  bad(() => name("/avatar/.svg"));
});

test("malformed encoding is the caller's error, not a 500", () => {
  expect(bad(() => name("/avatar/%"))).toContain("percent-encoding");
});

test("the name cap is measured after decoding", () => {
  // An emoji is one character but nine bytes encoded; capping the encoded form
  // would reject a name well inside the limit.
  const emoji = "🦊".repeat(100);
  expect(name(`/avatar/${encodeURIComponent(emoji)}`)).toHaveLength(200);
  bad(() => name(`/avatar/${"a".repeat(MAX_NAME + 1)}`));
});
