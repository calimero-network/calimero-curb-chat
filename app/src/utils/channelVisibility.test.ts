import { describe, expect, it } from "vitest";
import {
  getChannelVisibilityOption,
  getChannelVisibilityOptionLabel,
  getContextVisibilityLabel,
  getContextVisibilityModeFromOption,
  isRestrictedChannelType,
} from "./channelVisibility";

describe("getChannelVisibilityOption", () => {
  it("defaults the modal to public when the group default is open", () => {
    expect(getChannelVisibilityOption("open")).toBe("public");
  });

  it("defaults the modal to private when the group default is restricted", () => {
    expect(getChannelVisibilityOption("restricted")).toBe("private");
  });
});

describe("getContextVisibilityModeFromOption", () => {
  it("creates an open context when the user keeps or selects public", () => {
    expect(getContextVisibilityModeFromOption("public")).toBe("open");
  });

  it("creates a restricted context when the user switches to private", () => {
    expect(getContextVisibilityModeFromOption("private")).toBe("restricted");
  });
});

describe("visibility labels", () => {
  it("shows open for the public modal option", () => {
    expect(getChannelVisibilityOptionLabel("public")).toBe("Open");
  });

  it("shows restricted for the private modal option", () => {
    expect(getChannelVisibilityOptionLabel("private")).toBe("Restricted");
  });

  it("shows open for open contexts", () => {
    expect(getContextVisibilityLabel("open")).toBe("Open");
  });

  it("shows restricted for restricted contexts", () => {
    expect(getContextVisibilityLabel("restricted")).toBe("Restricted");
  });
});

describe("isRestrictedChannelType", () => {
  it("treats the new restricted label as restricted", () => {
    expect(isRestrictedChannelType("Restricted")).toBe(true);
  });

  it("keeps backward compatibility for the legacy private label", () => {
    expect(isRestrictedChannelType("Private")).toBe(true);
  });

  it("treats open channels as not restricted", () => {
    expect(isRestrictedChannelType("Open")).toBe(false);
  });
});
