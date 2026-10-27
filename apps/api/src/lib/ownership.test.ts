import { describe, expect, it } from "bun:test";
import { isGone } from "./diff";
import { ownedCharacter, refreshedOwned } from "./ownership";

const old = { id: 100, flavour: "classic" as const, realmSlug: "gehennas", name: "Aster" };
const hardcore = { id: 200, flavour: "classic1x" as const, realmSlug: "soulseeker", name: "Aster" };
const paired = [old];
const fresh = { region: "eu" as const, ids: [old.id, hardcore.id], characters: [old, hardcore] };

describe("companion ownership after a later Battle.net login", () => {
  it("accepts a newly created Hardcore character absent from the pairing list", () => {
    expect(ownedCharacter("eu", hardcore.id, paired, fresh)).toEqual(hardcore);
  });

  it("matches the character id rather than another character with the same name", () => {
    expect(ownedCharacter("eu", old.id, paired, fresh)).toEqual(old);
    expect(ownedCharacter("eu", 999, paired, fresh)).toBeUndefined();
  });

  it("does not use another region's proof", () => {
    expect(ownedCharacter("us", hardcore.id, [], fresh)).toBeUndefined();
  });

  it("requires the fresh character to be in the verified ids too", () => {
    expect(ownedCharacter("eu", hardcore.id, paired, { ...fresh, ids: [old.id] })).toBeUndefined();
  });

  it("keeps pairing proof usable after a partial login or with older account records", () => {
    expect(ownedCharacter("eu", old.id, paired, { region: "eu", ids: [], unavailable: ["classic"] })).toEqual(old);
    expect(ownedCharacter("eu", old.id, paired, { region: "eu", ids: [old.id] })).toEqual(old);
  });

  it("prefers the new verified name and realm when these change", () => {
    const renamed = { ...old, name: "Renamed", realmSlug: "another-realm" };
    expect(ownedCharacter("eu", old.id, paired, { ...fresh, characters: [renamed] })).toEqual(renamed);
  });
});

describe("refreshedOwned (Ravenpost's passport)", () => {
  const tbc = { id: 300, flavour: "classicann" as const, realmSlug: "dragonblight", name: "Tbc" };
  const gone = { id: 400, flavour: "classic1x" as const, realmSlug: "soulseeker", name: "Deleted" };
  const before = { region: "eu" as const, ids: [old.id, tbc.id, gone.id], characters: [tbc, gone], at: "2026-10-12T00:00:00.000Z", unavailable: [] as ("classic1x")[] };
  const now = new Date("2026-10-27T20:00:00Z");

  it("adds a new Era character and drops one Battle.net no longer lists", () => {
    const r = refreshedOwned(before, "eu", [hardcore.id], [[hardcore.id, "soulseeker", "Ghurdil"]], now);
    expect(r.ids).toEqual(expect.arrayContaining([old.id, tbc.id, hardcore.id]));
    expect(r.ids).not.toContain(gone.id);
    expect(r.characters).toEqual([tbc, { ...hardcore, name: "Ghurdil" }]);
    expect(r.at).toBe(before.at);
  });

  it("keeps other flavours' proof, and the site login's date and gaps", () => {
    const r = refreshedOwned({ ...before, unavailable: ["classic"] }, "eu", [], [], now);
    expect(r.characters).toEqual([tbc]);
    expect(r.ids).toContain(tbc.id);
    expect(r).toMatchObject({ at: before.at, unavailable: ["classic"] });
  });

  it("still lets the site login's list call a deleted character gone, and a new one not gone", () => {
    const r = refreshedOwned(before, "eu", [hardcore.id], [[hardcore.id, "soulseeker", "Ghurdil"]], now);
    const lists = [{ at: new Date(before.at), ids: r.ids, unavailable: r.unavailable ?? null }];
    // deleted (seen before the list, no longer in it) and a new character not listed yet (seen after it)
    expect(isGone(lists, gone.id, false, "2026-10-10T00:00:00Z", false)).toBe(true);
    expect(isGone(lists, 555, false, "2026-10-27T19:00:00Z", false)).toBe(false);
  });

  it("marks the other flavours unavailable when the entry was never dated (older rows)", () => {
    const r = refreshedOwned({ region: "eu", ids: [old.id] }, "eu", [], [], now);
    expect(r).toMatchObject({ at: now.toISOString(), unavailable: ["classicann", "classic"] });
    expect(isGone([{ at: new Date(r.at!), ids: r.ids, unavailable: r.unavailable ?? null }], 777, false, "2026-10-01T00:00:00Z", false)).toBe(false);
  });

  it("builds a first entry for a region the account had none for", () => {
    const r = refreshedOwned(undefined, "us", [5], [[5, "faerlina", "Nu"]], now);
    expect(r).toMatchObject({ region: "us", ids: [5], characters: [{ id: 5, flavour: "classic1x", realmSlug: "faerlina", name: "Nu" }] });
  });

  it("lets ownedCharacter accept the new character", () => {
    const r = refreshedOwned(before, "eu", [hardcore.id], [[hardcore.id, "soulseeker", "Ghurdil"]], now);
    expect(ownedCharacter("eu", hardcore.id, [], r)?.name).toBe("Ghurdil");
  });
});
