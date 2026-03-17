import bs58 from "bs58";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupApiDataSource } from "./groupApiDataSource";

const { mockAxiosGet, mockAxiosPost, mockAxiosPut } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockAxiosPut: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
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
    mockAxiosPost.mockReset();
    mockAxiosPut.mockReset();
  });

  it("passes the optional alias when creating a group", async () => {
    mockAxiosPost.mockResolvedValue({
      status: 200,
      data: {
        data: {
          groupId: "group-1",
        },
      },
      statusText: "OK",
    });

    const dataSource = new GroupApiDataSource();
    const response = await dataSource.createGroup({
      applicationId: "app-1",
      upgradePolicy: "LazyOnAccess",
      alias: "Product Team",
    });

    expect(mockAxiosPost).toHaveBeenCalledWith(
      "http://localhost:2428/admin-api/groups",
      {
        applicationId: "app-1",
        upgradePolicy: "LazyOnAccess",
        alias: "Product Team",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(response).toEqual({
      data: {
        groupId: "group-1",
      },
      error: null,
    });
  });

  it("returns the invitation group alias when the backend wraps the payload", async () => {
    mockAxiosPost.mockResolvedValue({
      status: 200,
      data: {
        data: {
          invitation: {
            invitation: {
              inviter_identity: "admin",
              group_id: "group-1",
              expiration_height: 42,
              secret_salt: [1, 2, 3],
              protocol: "near",
              network: "testnet",
              contract_id: "contract.testnet",
            },
            inviter_signature: "signature",
          },
          groupAlias: "Product Team",
        },
      },
      statusText: "OK",
    });

    const dataSource = new GroupApiDataSource();
    const response = await dataSource.createInvitation("group-1");

    expect(response).toEqual({
      data: {
        invitation: {
          invitation: {
            inviter_identity: "admin",
            group_id: "group-1",
            expiration_height: 42,
            secret_salt: [1, 2, 3],
            protocol: "near",
            network: "testnet",
            contract_id: "contract.testnet",
          },
          inviter_signature: "signature",
        },
        groupAlias: "Product Team",
      },
      error: null,
    });
  });

  it("forwards the optional group alias when joining a group", async () => {
    const invitation = {
      invitation: {
        inviter_identity: "admin",
        group_id: "group-1",
        expiration_height: 42,
        secret_salt: [1, 2, 3],
        protocol: "near",
        network: "testnet",
        contract_id: "contract.testnet",
      },
      inviter_signature: "signature",
    };
    mockAxiosPost.mockResolvedValue({
      status: 200,
      data: {
        data: {
          groupId: "group-1",
          memberIdentity: "member-1",
        },
      },
      statusText: "OK",
    });

    const dataSource = new GroupApiDataSource();
    const response = await dataSource.joinGroup({
      invitation,
      groupAlias: "Product Team",
    });

    expect(mockAxiosPost).toHaveBeenCalledWith(
      "http://localhost:2428/admin-api/groups/join",
      {
        invitation,
        groupAlias: "Product Team",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(response).toEqual({
      data: {
        groupId: "group-1",
        memberIdentity: "member-1",
      },
      error: null,
    });
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
