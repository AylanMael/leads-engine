import assert from "node:assert/strict";
import type { DecodedIdToken } from "firebase-admin/auth";
import { isAdministrator } from "../src/lib/admin-access";
import { GET } from "../src/app/api/admin/leads/route";

async function main() {
const identity = { email: "admin@example.com", email_verified: true } as DecodedIdToken;
assert.equal(isAdministrator(identity, "admin@example.com"), true);
assert.equal(isAdministrator(identity, " ADMIN@EXAMPLE.COM, second@example.com "), true);
assert.equal(isAdministrator(identity, ""), false);
assert.equal(isAdministrator(identity, "another@example.com"), false);
assert.equal(isAdministrator({ ...identity, email_verified: false }, "admin@example.com"), false);
assert.equal(isAdministrator({ ...identity, email: undefined }, "admin@example.com"), false);
assert.equal(isAdministrator({ ...identity, email: "admin@example.com.attacker.test" }, "admin@example.com"), false);
for (const authorization of [null, "Basic fake", "Bearer "]) {
  const response = await GET(new Request("http://localhost/api/admin/leads", {
    headers: authorization ? { authorization } : {},
  }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal("leads" in await response.json(), false);
}
console.log("Admin: comptes non autorisés/non vérifiés refusés ; API anonyme privée (401).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
