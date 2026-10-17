import { expect, it, spyOn } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setDb, schema, type DB } from "@/db";
import { accounts, characters, characterEvents, companionLinks } from "@/db/schema";
import { loginAccount } from "./accounts";
import { api, BnetError } from "./bnet";
import { handleUpload } from "./companion";
import { refreshCharacter, toSummary, SNAPSHOT_VERSION } from "./tracker";

// CI supplies an isolated Postgres. Locally, opt in with TEST_DATABASE_URL.
it.skipIf(!process.env.TEST_DATABASE_URL)("saves, deduplicates and enriches an owned character before its public profile exists", async () => {
  const client = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const rollback = new Error("roll back integration fixture");
  const summary = spyOn(api, "summary").mockRejectedValue(new BnetError("character profile", 404));
  const equipment = spyOn(api, "equipment").mockResolvedValue({ equipped_items: [] });
  const specs = spyOn(api, "specializations").mockResolvedValue({ specialization_groups: [] });
  const stats = spyOn(api, "statistics").mockResolvedValue({});
  const media = spyOn(api, "media").mockResolvedValue({ assets: [] });
  const realms = spyOn(api, "realmSearch").mockResolvedValue({ results: [] });
  try {
    await db.transaction(async (tx) => {
      setDb(tx as unknown as DB);
      const character = { id: 700000001, name: "Rpcheck", realmSlug: `rp-test-${Date.now()}`, flavour: "classic1x" as const };
      const account = await loginAccount({ bnetId: Date.now(), battletag: null, region: "eu", owned: [character.id], characters: [character] });
      // Different Classic namespaces can reuse numeric character ids.
      const [otherGame] = await tx.insert(characters).values({
        region: "eu", flavour: "classic", realmSlug: character.realmSlug, realmName: "Test realm",
        name: character.name, nameKey: character.name.toLowerCase(), blizzardId: character.id,
      }).returning();
      const token = crypto.randomUUID();
      const tokenHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))).toString("hex");
      await tx.insert(companionLinks).values({ tokenHash, region: "eu", accountId: account.id, owned: [], ownedIds: [] });
      const guid = `Player-6113-${character.id.toString(16)}`;
      const body = { characters: { [guid]: {
        name: "Uploadedname", realm: "Test realm", class: "MAGE", race: "Gnome", faction: "Alliance",
        state: { level: 7, updatedAt: Math.floor(Date.now() / 1000), money: 123 },
        events: [{ type: "quest_accept", questId: 1, title: "Test quest", t: Math.floor(Date.now() / 1000) - 10 }],
      } } };
      const first = await handleUpload(token, body);
      expect(first?.characters[0]).toMatchObject({ status: "synced", events: 1 });
      const id = first!.characters[0].characterId!;
      const read = async () => (await tx.select().from(characters).where(eq(characters.id, id)))[0];
      let row = await read();
      expect(row).toMatchObject({ ownerId: account.id, shared: false, blizzardId: character.id, name: character.name, level: 7, classKey: "mage", snapshotVersion: 0 });
      expect(row.addon?.money).toBe(123);
      const [untouched] = await tx.select().from(characters).where(eq(characters.id, otherGame.id));
      expect(untouched.ownerId).toBeNull();
      expect(untouched.addon).toBeNull();
      expect(toSummary(row).restricted).toBe(true);
      expect((await tx.select().from(accounts).where(eq(accounts.id, account.id)))[0].roster).toContain(id);

      await refreshCharacter(row);
      await refreshCharacter(await read());
      row = await read();
      expect(row.missingReportedAt).toBeNull();
      expect(row.status).toBe("ok");
      expect((await handleUpload(token, body))?.characters[0]).toMatchObject({ status: "synced", events: 0, characterId: id });

      // Once Blizzard publishes it, enrich the same row without inventing
      // events for the initial API snapshot or losing the uploaded history.
      summary.mockResolvedValue({
        id: character.id, name: character.name, level: 7,
        realm: { slug: character.realmSlug, name: "Test realm" },
        gender: { type: "FEMALE", name: "Female" }, faction: { type: "ALLIANCE", name: "Alliance" },
        race: { id: 7, name: "Gnome" }, character_class: { id: 8, name: "Mage" },
      });
      await refreshCharacter(await read());
      row = await read();
      expect(row.snapshotVersion).toBe(SNAPSHOT_VERSION);
      expect(row.ownerId).toBe(account.id);
      expect(row.addon?.money).toBe(123);
      expect(await tx.select().from(characterEvents).where(eq(characterEvents.characterId, id))).toHaveLength(1);
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  } finally {
    for (const spy of [summary, equipment, specs, stats, media, realms]) spy.mockRestore();
    await client.end();
  }
});
