import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadDotEnv, mergeProcessEnv } from "./env.ts";

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "acon-env-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body, "utf8");
  }
  return dir;
}

const touched: string[] = [];

afterEach(() => {
  for (const key of touched.splice(0)) {
    delete process.env[key];
  }
});

describe("loadDotEnv", () => {
  test("reads plain key/value pairs", () => {
    const dir = fixture({ ".env": "REPLICATE_API_TOKEN=r8_abc\nECON_AGENT_PROVIDER=gemini\n" });

    expect(loadDotEnv(dir)).toEqual({
      REPLICATE_API_TOKEN: "r8_abc",
      ECON_AGENT_PROVIDER: "gemini",
    });
  });

  test("ignores comments and blank lines", () => {
    const dir = fixture({ ".env": "# a comment\n\n  \nKEY=value\n" });

    expect(loadDotEnv(dir)).toEqual({ KEY: "value" });
  });

  test("strips surrounding quotes", () => {
    const dir = fixture({ ".env": `SINGLE='one'\nDOUBLE="two"\n` });

    expect(loadDotEnv(dir)).toEqual({ SINGLE: "one", DOUBLE: "two" });
  });

  test("keeps equals signs inside a value", () => {
    const dir = fixture({ ".env": "KEY=a=b=c\n" });

    expect(loadDotEnv(dir).KEY).toBe("a=b=c");
  });

  test("tolerates an export prefix and padding", () => {
    const dir = fixture({ ".env": "export KEY = value \n" });

    expect(loadDotEnv(dir).KEY).toBe("value");
  });

  test("skips lines with no assignment", () => {
    const dir = fixture({ ".env": "NOT_AN_ASSIGNMENT\nKEY=value\n" });

    expect(loadDotEnv(dir)).toEqual({ KEY: "value" });
  });

  test("returns nothing when the directory holds no env files", () => {
    expect(loadDotEnv(fixture({}))).toEqual({});
  });

  test("lets .env.local override .env, matching Vite", () => {
    const dir = fixture({
      ".env": "KEY=base\nONLY_BASE=kept\n",
      ".env.local": "KEY=local\n",
    });

    expect(loadDotEnv(dir)).toEqual({ KEY: "local", ONLY_BASE: "kept" });
  });

  test("lets the mode file override the shared one", () => {
    const dir = fixture({
      ".env": "KEY=base\n",
      ".env.production": "KEY=production\n",
    });

    expect(loadDotEnv(dir, "production").KEY).toBe("production");
  });

  test("ranks .env.<mode>.local highest", () => {
    const dir = fixture({
      ".env": "KEY=base\n",
      ".env.local": "KEY=local\n",
      ".env.production": "KEY=production\n",
      ".env.production.local": "KEY=production-local\n",
    });

    expect(loadDotEnv(dir, "production").KEY).toBe("production-local");
  });

  test("ignores a mode file for a different mode", () => {
    const dir = fixture({
      ".env": "KEY=base\n",
      ".env.development": "KEY=development\n",
    });

    expect(loadDotEnv(dir, "production").KEY).toBe("base");
  });
});

describe("mergeProcessEnv", () => {
  test("a real environment variable beats the file, as it does in the dev server", () => {
    touched.push("ACON_TEST_KEY");
    process.env.ACON_TEST_KEY = "from-shell";

    expect(mergeProcessEnv({ ACON_TEST_KEY: "from-file" }).ACON_TEST_KEY).toBe("from-shell");
  });

  test("keeps file values that the shell does not define", () => {
    expect(mergeProcessEnv({ ACON_FILE_ONLY: "from-file" }).ACON_FILE_ONLY).toBe("from-file");
  });

  test("drops undefined entries so lookups stay string-typed", () => {
    for (const value of Object.values(mergeProcessEnv({}))) {
      expect(typeof value).toBe("string");
    }
  });
});
