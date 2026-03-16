import bs58 from "bs58";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupApiDataSource } from "./groupApiDataSource";

const { mockAxiosGet, mockAxiosPut } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPut: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: mockAxiosGet,
    put: mockAxiosPut,
  },
  isAxiosError: () => false,
}));

vi.mock("@calimero-network/calimero-client", () => ({
  getAppEndpointKey: () => "http://localhost:2428",
  getAuthConfig: () => ({ jwtToken: "token" }),
}));

describe("GroupApiDataSource", () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockAxiosPut.mockReset();
  });

  it("preserves optional aliases when listing group contexts", async () => {
    const hexContextId = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
    const contextBytes = Uint8Array.from(
      hexContextId.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    );
    const expectedContextId = bs58.encode(
      contextBytes,
    );

    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            contextId: hexContextId,
            alias: "Project Alpha",
          },
        ],
      },
    });

    const dataSource = new GroupApiDataSource();
    const response = await dataSource.listGroupContexts("group-1");

    expect(response).toEqual({
      data: [
        {
          contextId: expectedContextId,
          alias: "Project Alpha",
        },
      ],
      error: null,
    });
  });

  it("updates a member alias through the admin member alias endpoint", async () => {
    mockAxiosPut.mockResolvedValue({
      status: 200,
      data: {
        data: undefined,
      },
      statusText: "OK",
    });

    const dataSource = new GroupApiDataSource();
    const response = await dataSource.setMemberAlias("group-1", "member-1", {
      alias: "Taylor",
    });

    expect(mockAxiosPut).toHaveBeenCalledWith(
      "http://localhost:2428/admin-api/groups/group-1/members/member-1/alias",
      { alias: "Taylor" },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(response).toEqual({
      data: undefined,
      error: null,
    });
  });
});
