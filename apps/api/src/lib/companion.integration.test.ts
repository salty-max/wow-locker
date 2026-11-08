import { expect, it, spyOn } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setDb, schema, type DB } from "@/db";
import { accounts, characters, characterEvents, companionLinks, itemIcons } from "@/db/schema";
import { loginAccount } from "./accounts";
import { api, BnetError } from "./bnet";
import { handleUpload, renewOwned } from "./companion";
import { refreshCharacter, toSummary, getCharacter, SNAPSHOT_VERSION } from "./tracker";

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
      await tx.insert(itemIcons).values({ region: "eu", flavour: "classic1x", itemId: 57, url: "https://example.test/robe.jpg" }).onConflictDoNothing();
      const guid = `Player-6113-${character.id.toString(16)}`;
      const body = { characters: { [guid]: {
        name: "Uploadedname", realm: "Test realm", class: "MAGE", race: "Gnome", faction: "Alliance",
        state: { level: 7, updatedAt: Math.floor(Date.now() / 1000), money: 123, equipment: [{ slot: "CHEST", id: 57, name: "Acolyte's Robe", color: "ffffff" }] },
        events: [{ type: "quest_accept", questId: 1, title: "Test quest", t: Math.floor(Date.now() / 1000) - 10 }],
      } } };
      const first = await handleUpload(token, body);
      expect(first?.characters[0]).toMatchObject({ status: "synced", events: 1 });
      const id = first!.characters[0].characterId!;
      const read = async () => (await tx.select().from(characters).where(eq(characters.id, id)))[0];
      let row = await read();
      expect(row).toMatchObject({ ownerId: account.id, shared: false, blizzardId: character.id, name: character.name, level: 7, classKey: "mage", snapshotVersion: 0 });
      expect(row.addon?.money).toBe(123);
      const detail = await getCharacter(id, { touch: false, viewer: { accountId: account.id } });
      expect(detail?.equipment).toHaveLength(1);
      expect(detail?.equipment[0]).toMatchObject({ slot: "CHEST", itemId: 57, name: "Acolyte's Robe", iconUrl: expect.stringContaining("robe.jpg") });
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

it.skipIf(!process.env.TEST_DATABASE_URL)("tracks a Forever character from the account's list and the addon, never asking Battle.net for it", async () => {
  const client = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const rollback = new Error("roll back integration fixture");
  const summary = spyOn(api, "summary").mockRejectedValue(new BnetError("character profile", 404));
  try {
    await db.transaction(async (tx) => {
      setDb(tx as unknown as DB);
      const bnetId = Date.now();
      const account = await loginAccount({ bnetId, battletag: null, region: "eu", owned: [], characters: [] });
      const oma = { id: 672976, name: "Oma Dessala" };
      const passport = { aud: "sites", bnetId, battletag: "T#1", iat: 0, exp: 9_999_999_999, jti: `f-${bnetId}`, owned: [{ region: "eu", game: "forever", ids: [oma.id], characters: [[oma.id, "6946", oma.name]] as [number, string, string][] }] };
      expect(await renewOwned(account.id, passport)).toEqual({ characters: 1 });
      const token = crypto.randomUUID();
      const tokenHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))).toString("hex");
      await tx.insert(companionLinks).values({ tokenHash, region: "eu", accountId: account.id, owned: [], ownedIds: [] });
      const now = Math.floor(Date.now() / 1000);
      const sheet = { name: oma.name, realm: "Classic Beta PvP", class: "SHAMAN", race: "Dwarf", faction: "Alliance", state: { level: 4, updatedAt: now }, events: [] };
      // The same id under another realm is not the account's character.
      const wrong = await handleUpload(token, { characters: { [`Player-6113-${oma.id.toString(16)}`]: sheet } });
      expect(wrong?.characters[0].status).not.toBe("synced");
      const up = await handleUpload(token, { characters: { [`Player-6946-${oma.id.toString(16)}`]: sheet } });
      expect(up?.characters[0]).toMatchObject({ status: "synced", name: oma.name });
      const id = up!.characters[0].characterId!;
      // A later login on the site (Classic's list, complete) keeps the Forever characters.
      await loginAccount({ bnetId, battletag: null, region: "eu", owned: [], characters: [] });
      const old = { characters: { [`Player-6946-${oma.id.toString(16)}`]: { ...sheet, state: { ...sheet.state, updatedAt: now - 3600 } } } };
      expect((await handleUpload(token, old))?.characters[0].status).toBe("synced");
      // A renamed character takes the list's new name.
      const renamedPassport = { ...passport, jti: `g-${bnetId}`, owned: [{ ...passport.owned[0], characters: [[oma.id, "6946", "Oma Skye"]] as [number, string, string][] }] };
      expect(await renewOwned(account.id, renamedPassport)).toEqual({ characters: 1 });
      expect((await handleUpload(token, { characters: { [`Player-6946-${oma.id.toString(16)}`]: sheet } }))?.characters[0].status).toBe("synced");
      expect((await tx.select().from(characters).where(eq(characters.id, id)))[0]).toMatchObject({ name: "Oma Skye", nameKey: "oma-skye" });
      await tx.update(characters).set({ name: oma.name, nameKey: "oma-dessala" }).where(eq(characters.id, id));
      const [row] = await tx.select().from(characters).where(eq(characters.id, id));
      expect(row).toMatchObject({ flavour: "forever", realmSlug: "6946", name: oma.name, nameKey: "oma-dessala", blizzardId: oma.id, ownerId: account.id, level: 4, classKey: "shaman" });
      expect((await tx.select().from(accounts).where(eq(accounts.id, account.id)))[0].roster).toContain(id);
      // No character endpoint to ask: a refresh does nothing, and the 404s never read as deleted.
      await refreshCharacter(row);
      expect(summary).not.toHaveBeenCalled();
      expect((await tx.select().from(characters).where(eq(characters.id, id)))[0].status).toBe("ok");
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  } finally {
    summary.mockRestore();
    await client.end();
  }
});
