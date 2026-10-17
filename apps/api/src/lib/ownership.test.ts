import { describe, expect, it } from "bun:test";
import { ownedCharacter } from "./ownership";

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
