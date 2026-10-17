import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { setDb, type DB } from "@/db";
import { accounts, characters, companionLinks, type AccountRow } from "@/db/schema";
import { loginAccount } from "./accounts";
import { api, BnetError } from "./bnet";
import { handleUpload } from "./companion";

const character = { id: 200, name: "Aster", realmSlug: "soulseeker", flavour: "classic1x" as const };
const summary = spyOn(api, "summary");
afterEach(() => summary.mockReset());
afterAll(() => summary.mockRestore());

/** Only persistence is replaced. Login, parsing, ownership and tracking use the real code. */
function database(tracked = false) {
  let owned: AccountRow["owned"] = [];
  const writes: unknown[] = [];
  const link = { id: 1, accountId: 1, region: "eu", createdAt: new Date(0), owned: [], ownedIds: [], unavailable: [] };
  const row = { id: 10, ownerId: 1, name: character.name, flavour: character.flavour, level: 1, missingReportedAt: null, addon: null };
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
          return {
            then: (resolve: (v: unknown[]) => unknown) => resolve([]),
            returning: async () => table === accounts ? [{ id: 1, owned }] : [{ ...row, ...value }],
          };
        },
      }),
    }),
    delete: () => ({ where: async () => [] }),
  } as unknown as DB);
  return { writes };
}

const upload = { characters: { "Player-6113-000000C8": { name: "Aster", realm: "Soulseeker", state: {}, events: [] } } };

describe("uploads through an existing companion after a new login", () => {
  it("saves addon data using the fresh login's proof", async () => {
    database(true);
    await loginAccount({ bnetId: 123, battletag: null, region: "eu", owned: [character.id], characters: [character] });
    expect((await handleUpload("test-token", upload))?.characters).toEqual([
      { guid: "Player-6113-000000C8", name: "Aster", status: "synced", events: 0, characterId: 10 },
    ]);
    expect(summary).not.toHaveBeenCalled();
  });

  it("persists fresh character metadata and uses it without pairing again", async () => {
    database();
    await loginAccount({ bnetId: 123, battletag: null, region: "eu", owned: [character.id], characters: [character] });
    summary.mockRejectedValue(new BnetError("character profile", 404));

    // Blizzard lists the character as owned, but has not published its profile.
    // This must reach tracking and leave the upload retryable, not return unknown.
    await expect(handleUpload("test-token", upload)).rejects.toBeInstanceOf(BnetError);
    expect(summary).toHaveBeenCalledWith("classic1x", "eu", "soulseeker", "aster");
  });

  it("still refuses characters that have no Battle.net ownership proof", async () => {
    const { writes } = database();
    const result = await handleUpload("test-token", upload);
    expect(result?.characters).toEqual([{ guid: "Player-6113-000000C8", name: "Aster", status: "unknown", events: 0 }]);
    expect(summary).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1); // only the link's last upload time
  });
});
