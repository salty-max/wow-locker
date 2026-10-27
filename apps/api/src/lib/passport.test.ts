import { describe, expect, it } from "bun:test";
import { readPassport } from "./passport";

const forged = (p: object) => `${Buffer.from(JSON.stringify(p)).toString("base64url")}.${Buffer.alloc(64).toString("base64url")}`;
const body = { aud: "sites", bnetId: 1, battletag: "T#1", owned: [], iat: 0, exp: 9_999_999_999, jti: "x" };

describe("readPassport", () => {
  it("refuses what the inbox's key didn't sign", () => {
    expect(readPassport(forged(body))).toBeNull();
  });
  it("refuses what isn't a passport", () => {
    expect(readPassport(undefined)).toBeNull();
    expect(readPassport("nope")).toBeNull();
    expect(readPassport("a.b")).toBeNull();
  });
});
