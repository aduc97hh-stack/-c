import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Linter } from "eslint";
const require = createRequire(import.meta.url);
test("Next 16 lint rootDir glob API stays compatible after security dependency replacement", () => {
  const pluginRequire = createRequire(
    require.resolve("@next/eslint-plugin-next"),
  );
  const glob = pluginRequire("fast-glob") as {
    globSync: (
      pattern: string,
      options: { onlyDirectories: boolean },
    ) => string[];
  };
  const root = mkdtempSync(join(tmpdir(), "gami-glob-"));
  try {
    mkdirSync(join(root, "a"));
    mkdirSync(join(root, "b"));
    writeFileSync(join(root, "file.txt"), "fixture");
    assert.deepEqual(
      glob
        .globSync(root + "/*", { onlyDirectories: true })
        .map((dir) => resolve(dir))
        .sort(),
      [join(root, "a"), join(root, "b")],
    );
    assert.deepEqual(
      glob
        .globSync(root + "/{a,b}", { onlyDirectories: true })
        .map((dir) => resolve(dir))
        .sort(),
      [join(root, "a"), join(root, "b")],
    );
    assert.deepEqual(
      glob.globSync(root + "/missing*", { onlyDirectories: true }),
      [],
    );
    mkdirSync(join(root, "a", "pages"));
    writeFileSync(
      join(root, "a", "pages", "target.tsx"),
      "export default function Page() {}",
    );
    const plugin = require("@next/eslint-plugin-next");
    const messages = new Linter().verify(
      'const view = <a href="/target">Target</a>',
      [
        {
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { next: plugin },
          settings: { next: { rootDir: root + "/{a,b}" } },
          rules: { "next/no-html-link-for-pages": "error" },
        },
      ],
    );
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "next/no-html-link-for-pages");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
