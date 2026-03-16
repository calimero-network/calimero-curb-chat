import { describe, expect, it } from "vitest";
import { buildDmMemberOptions } from "./dmMemberOptions";

describe("buildDmMemberOptions", () => {
  it("keeps only other group member identities and preserves known labels", () => {
    const options = buildDmMemberOptions({
      groupMembers: [
        { identity: "member-me", role: "Admin" },
        { identity: "member-a", alias: "Alice Alias", role: "Member" },
        { identity: "member-b", role: "Member" },
      ],
      currentMemberIdentity: "member-me",
      labelsByIdentity: new Map([
        ["member-a", "Alice"],
        ["member-b", "Bob"],
      ]),
    });

    expect(Array.from(options.entries())).toEqual([
      ["member-a", "Alice Alias"],
      ["member-b", "Bob"],
    ]);
  });

  it("omits the current identity even when no labels are known", () => {
    const options = buildDmMemberOptions({
      groupMembers: [
        { identity: "member-me", role: "Member" },
        { identity: "member-a", role: "Member" },
      ],
      currentMemberIdentity: "member-me",
      labelsByIdentity: new Map(),
    });

    expect(Array.from(options.keys())).toEqual(["member-a"]);
    expect(options.get("member-a")).toBe("member-a");
    expect(options.has("member-me")).toBe(false);
  });
});
