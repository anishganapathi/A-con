/**
 * One-time sign-in for the Cursor model. Mints a scoped, expiring API key and
 * stores it at ~/.cursor/sdk/auth.json, which the dev server picks up on its
 * next request. Revoke it any time from the Cursor dashboard's API keys page.
 */
import { Cursor } from "@cursor/sdk";

const existing = await Cursor.auth.status();
if (existing.status === "logged-in") {
  console.log(`Already signed in${existing.email ? ` as ${existing.email}` : ""}.`);
  console.log("Run `npm run logout:cursor` first if you want to switch accounts.");
  process.exit(0);
}

console.log("Opening Cursor in your browser to authorize this app...");
const result = await Cursor.auth.login({
  apiKeyName: "E-kon building planner",
  onLoginUrl: (url) => {
    console.log(`If the browser did not open, visit:\n  ${url}`);
  },
});

const expires = new Date(result.apiKeyExpiresAtMs).toISOString().slice(0, 10);
console.log(`Signed in${result.email ? ` as ${result.email}` : ""}. Key expires ${expires}.`);
console.log("Restart `npm run dev` and the chat panel will plan with the Cursor model.");
