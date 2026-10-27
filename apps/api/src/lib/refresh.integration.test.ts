import { expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setDb, schema, type DB } from "@/db";
import { accounts } from "@/db/schema";
import { loginAccount } from "./accounts";
import { renewOwned } from "./companion";
import type { Passport } from "./passport";

const passport = (bnetId: number, jti: string, owned: Passport["owned"]): Passport => ({ aud: "sites", bnetId, battletag: "T#1", owned, iat: 0, exp: 9_999_999_999, jti });

// CI supplies an isolated Postgres. Locally, opt in with TEST_DATABASE_URL.
it.skipIf(!process.env.TEST_DATABASE_URL)("renews the account's Classic Era proof from a passport, for its own account, once", async () => {
  const client = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const rollback = new Error("roll back integration fixture");
  try {
    await db.transaction(async (tx) => {
      setDb(tx as unknown as DB);
      const bnetId = Date.now();
      const tbc = { id: 300, flavour: "classicann" as const, realmSlug: "dragonblight", name: "Tbc" };
      const account = await loginAccount({ bnetId, battletag: null, region: "eu", owned: [tbc.id], characters: [tbc] });
      const read = async () => (await tx.select().from(accounts).where(eq(accounts.id, account.id)))[0].owned.find((o) => o.region === "eu")!;
      const jti = `j-${bnetId}`;

      // Another Battle.net account's passport: refused, and it doesn't use up the passport.
      expect(await renewOwned(account.id, passport(bnetId + 1, jti, [{ region: "eu", ids: [9] }]))).toBeNull();
      expect((await read()).ids).toEqual([tbc.id]);

      const mine = passport(bnetId, jti, [{ region: "eu", ids: [64379064], characters: [[64379064, "soulseeker", "Ghurdil"]] }]);
      expect(await renewOwned(account.id, mine)).toEqual({ characters: 1 });
      const eu = await read();
      expect(eu.ids.sort()).toEqual([tbc.id, 64379064]);
      expect(eu.characters).toContainEqual({ id: 64379064, flavour: "classic1x", realmSlug: "soulseeker", name: "Ghurdil" });
      expect(eu.characters).toContainEqual(tbc);

      // The same passport again: refused.
      expect(await renewOwned(account.id, mine)).toBeNull();
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  } finally {
    await client.end();
  }
});
