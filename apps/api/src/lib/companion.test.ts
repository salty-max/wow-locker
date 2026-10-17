import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { setDb, type DB } from "@/db";
import { accounts, characters, companionLinks, type AccountRow } from "@/db/schema";
import { loginAccount } from "./accounts";
import { api, BnetError } from "./bnet";
import { handleUpload } from "./companion";
import { refreshCharacter } from "./tracker";
import type { CharacterRow } from "@/db/schema";

const character = { id: 200, name: "Aster", realmSlug: "soulseeker", flavour: "classic1x" as const };
const summary = spyOn(api, "summary");
afterEach(() => summary.mockReset());
afterAll(() => summary.mockRestore());

/** Only persistence is replaced. Login, parsing, ownership and tracking use the real code. */
function database(tracked = false) {
  let owned: AccountRow["owned"] = [];
  const writes: unknown[] = [];
  const link = { id: 1, accountId: 1, region: "eu", createdAt: new Date(0), owned: [], ownedIds: [], unavailable: [] };
  let row: Record<string, unknown> = { id: 10, ownerId: 1, name: character.name, flavour: character.flavour, blizzardId: 200, snapshotVersion: 0, status: "ok", level: 1, missingReportedAt: null, addon: null };
  const created: Record<string, unknown>[] = [];
  setDb({
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === companionLinks) return [link];
          if (table === accounts) return [{ id: 1, owned }];
          return table === characters && tracked ? [row] : [];
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (value: { owned?: AccountRow["owned"] }) => ({
        where: () => {
          writes.push(value);
          if (table === accounts && value.owned) owned = value.owned;
          if (table === characters) row = { ...row, ...value };
          return {
            then: (resolve: (v: unknown[]) => unknown) => resolve([]),
            returning: async () => table === accounts ? [{ id: 1, owned }] : [{ ...row, ...value }],
          };
        },
      }),
    }),
    delete: () => ({ where: async () => [] }),
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (table !== characters) throw new Error("unexpected insert");
            created.push(value);
            row = { ...row, ...value };
            tracked = true;
            return [row];
          },
        }),
      }),
    }),
  } as unknown as DB);
  return { writes, created, get row() { return row as unknown as CharacterRow; } };
}

const upload = { characters: { "Player-6113-000000C8": { name: "Aster", realm: "Soulseeker", class: "WARLOCK", race: "NightElf", faction: "Alliance", state: { level: 7 }, events: [] } } };

describe("uploads through an existing companion after a new login", () => {
  it("saves addon data using the fresh login's proof", async () => {
    database(true);
    await loginAccount({ bnetId: 123, battletag: null, region: "eu", owned: [character.id], characters: [character] });
    expect((await handleUpload("test-token", upload))?.characters).toEqual([
      { guid: "Player-6113-000000C8", name: "Aster", status: "synced", events: 0, characterId: 10 },
    ]);
    expect(summary).not.toHaveBeenCalled();
  });

  it("saves a private character and its addon data while the public profile returns 404", async () => {
    const store = database();
    await loginAccount({ bnetId: 123, battletag: null, region: "eu", owned: [character.id], characters: [character] });
    summary.mockRejectedValue(new BnetError("character profile", 404));

    // Blizzard lists the character as owned, but has not published its profile.
    // This must save the data, not return unknown or fail the whole account's upload.
    expect((await handleUpload("test-token", upload))?.characters[0].status).toBe("synced");
    expect(summary).toHaveBeenCalledWith("classic1x", "eu", "soulseeker", "aster");
    expect(store.created).toHaveLength(1);
    expect(store.created[0]).toMatchObject({ ownerId: 1, blizzardId: 200, name: "Aster", level: 7, classKey: "warlock", race: "Night Elf", faction: "alliance" });
    expect(store.row.addon).not.toBeNull();

    // Continued absence of a never-published profile must not turn into
    // "deleted" on the second poll and suppress the next addon upload.
    await refreshCharacter(store.row);
    await refreshCharacter(store.row);
    expect(store.row.missingReportedAt).toBeNull();
    expect(store.row.status).toBe("ok");
    expect((await handleUpload("test-token", upload))?.characters[0].status).toBe("synced");
    expect(store.created).toHaveLength(1);
  });

  it("keeps upstream outages retryable without creating a fallback character", async () => {
    const store = database();
    await loginAccount({ bnetId: 123, battletag: null, region: "eu", owned: [character.id], characters: [character] });
    summary.mockRejectedValue(new BnetError("character profile", 503));
    await expect(handleUpload("test-token", upload)).rejects.toBeInstanceOf(BnetError);
    expect(store.created).toHaveLength(0);
  });

  it("still refuses characters that have no Battle.net ownership proof", async () => {
    const { writes, created } = database();
    const result = await handleUpload("test-token", upload);
    expect(result?.characters).toEqual([{ guid: "Player-6113-000000C8", name: "Aster", status: "unknown", events: 0 }]);
    expect(summary).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1); // only the link's last upload time
    expect(created).toHaveLength(0);
  });
});
