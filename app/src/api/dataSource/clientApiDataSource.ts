import {
  type ApiResponse,
  getAppEndpointKey,
  getContextId,
  getExecutorPublicKey,
  rpcClient,
} from "@calimero-network/calimero-client";
import {
  type AcceptInvitationProps,
  type ChannelDataResponse,
  type ChannelInfo,
  type AllChannelsResponse,
  type ClientApi,
  ClientMethod,
  type CreateChannelProps,
  type CreateChannelResponse,
  type CreateDmProps,
  type DeleteChannelProps,
  type DeleteDMProps,
  type DeleteMessageProps,
  type DMChatInfo,
  type EditMessageProps,
  type FullMessageResponse,
  type GetChannelInfoProps,
  type GetChannelMembersProps,
  type GetChatMembersProps,
  type GetMessagesProps,
  type GetNonMemberUsersProps,
  type GetUsernameProps,
  type InviteToChannelProps,
  type JoinChannelProps,
  type JoinChatProps,
  type LeaveChannelProps,
  type Message,
  type PromoteModeratorProps,
  type DemoteModeratorProps,
  type RemoveUserFromChannelProps,
  type ReadDmProps,
  type ReadMessageProps,
  type SendMessageProps,
  type UpdateDmHashProps,
  type UpdateInvitationPayloadProps,
  type UpdateNewIdentityProps,
  type UpdateReactionProps,
  type GetMessagesResponse,
  type MessageWithReactions,
  type DMrawObject,
} from "../clientApi";
import { getDmContextId } from "../../utils/session";

export function getJsonRpcClient() {
  const appEndpointKey = getAppEndpointKey();
  if (!appEndpointKey) {
    throw new Error(
      "Application endpoint key is missing. Please check your configuration."
    );
  }
  return rpcClient;
}

/**
 * Transforms reactions from backend array format to frontend HashMap format
 * Backend format: [{ emoji: "👍", users: [null, "testuser"] }]
 * Frontend format: { "👍": ["testuser"] }
 */
function transformReactions(
  reactions:
    | Array<{ emoji: string; users: (string | null)[] }>
    | Record<string, string[]>
    | undefined
    | null
): Record<string, string[]> {
  const reactionsHashMap: Record<string, string[]> = {};

  if (!reactions) {
    return reactionsHashMap;
  }

  if (Array.isArray(reactions)) {
    // New format: array of { emoji, users }
    reactions.forEach((reaction) => {
      if (reaction?.emoji && Array.isArray(reaction.users)) {
        // Filter out null values and convert to string array
        const validUsers = reaction.users.filter(
          (user): user is string => user !== null && user !== undefined
        );
        if (validUsers.length > 0) {
          reactionsHashMap[reaction.emoji] = validUsers;
        }
      }
    });
  } else if (typeof reactions === "object" && !Array.isArray(reactions)) {
    // Old format: already a HashMap/object
    return reactions as Record<string, string[]>;
  }

  return reactionsHashMap;
}

export class ClientApiDataSource implements ClientApi {
  async joinChat(props: JoinChatProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId:
            (props.isDM
              ? getDmContextId()
              : props.contextId || getContextId()) || "",
          method: ClientMethod.JOIN_CHAT,
          argsJson: {
            username: props.username,
            is_dm: props.isDM || false,
          },
          executorPublicKey:
            (props.isDM
              ? props.executor
              : props.executorPublicKey || getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("joinChat failed:", error);
      let errorMessage = "An unexpected error occurred during joinChat";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async createChannel(
    props: CreateChannelProps
  ): ApiResponse<CreateChannelResponse> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        CreateChannelResponse
      >(
        {
          contextId: getContextId() || "",
          method: ClientMethod.CREATE_CHANNEL,
          argsJson: {
            name: props.channel.name,
          },
          executorPublicKey: getExecutorPublicKey() || "",
          // @ts-expect-error - substitute is not used in the createChannel method
          substitute: [],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      return {
        data: response?.result.output as CreateChannelResponse,
        error: null,
      };
    } catch (error) {
      console.error("createChannel failed:", error);
      let errorMessage = "An unexpected error occurred during createChannel";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getChannels(): ApiResponse<ChannelDataResponse[]> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        { result: ChannelDataResponse[] }
      >(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_CHANNELS,
          argsJson: {},
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: response?.result?.output?.result as any,
        error: null,
      };
    } catch (error) {
      console.error("getChannels failed:", error);
      let errorMessage = "An unexpected error occurred during getChannels";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getAllChannelsSearch(): ApiResponse<AllChannelsResponse> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        { result: AllChannelsResponse }
      >(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_ALL_CHANNELS_SEARCH,
          argsJson: {},
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output?.result as AllChannelsResponse,
        error: null,
      };
    } catch (error) {
      console.error("getAllChannelsSearch failed:", error);
      let errorMessage =
        "An unexpected error occurred during getAllChannelsSearch";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getChannelInfo(props: GetChannelInfoProps): ApiResponse<ChannelInfo> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, ChannelInfo>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_CHANNEL_INFO,
          argsJson: {
            channel: props.channel,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as ChannelInfo,
        error: null,
      };
    } catch (error) {
      console.error("getChannelInfo failed:", error);
      let errorMessage = "An unexpected error occurred during getChannelInfo";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getChannelMembers(
    props: GetChannelMembersProps
  ): ApiResponse<Map<string, string>> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        Map<string, string>
      >(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_CHANNEL_MEMBERS,
          argsJson: {
            channel: props.channel,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      return {
        data: response?.result.output as Map<string, string>,
        error: null,
      };
    } catch (error) {
      console.error("getChannelMembers failed:", error);
      let errorMessage =
        "An unexpected error occurred during getChannelMembers";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async inviteToChannel(props: InviteToChannelProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.INVITE_TO_CHANNEL,
          argsJson: {
            channelId: props.channel.name,
            userId: props.user,
            username: props.username,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("inviteToChannel failed:", error);
      let errorMessage = "An unexpected error occurred during inviteToChannel";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getNonMemberUsers(
    props: GetNonMemberUsersProps
  ): ApiResponse<Record<string, string>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, unknown>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_INVITE_USERS,
          argsJson: {
            channelId: props.channel.name,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      const normalizeInvitees = (payload: unknown): Record<string, string> => {
        if (!payload) return {};

        let parsedData: unknown = payload;

        if (typeof parsedData === "string") {
          try {
            parsedData = JSON.parse(parsedData);
          } catch {
            const key = parsedData as string;
            return { [key]: key };
          }
        }

        if (
          typeof parsedData === "object" &&
          parsedData !== null &&
          Object.prototype.hasOwnProperty.call(parsedData, "result")
        ) {
          parsedData = (parsedData as { result: unknown }).result;
        }

        const map: Record<string, string> = {};

        if (Array.isArray(parsedData)) {
          parsedData.forEach((entry) => {
            if (!entry) return;

            if (typeof entry === "string") {
              map[entry] = entry;
              return;
            }

            if (typeof entry === "object") {
              const userId =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (entry as any).userId ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (entry as any).user_id ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (entry as any).id;

              if (!userId) return;

              const username =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (entry as any).username ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (entry as any).userName ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (entry as any).name ??
                userId;

              map[userId] = username;
            }
          });
        } else if (typeof parsedData === "object" && parsedData !== null) {
          Object.entries(parsedData as Record<string, unknown>).forEach(
            ([key, value]) => {
              map[key] = typeof value === "string" ? value : key;
            }
          );
        }

        return map;
      };

      const invitees = normalizeInvitees(response?.result?.output);

      return {
        data: invitees,
        error: null,
      };
    } catch (error) {
      console.error("getNonMemberUsers failed:", error);
      let errorMessage =
        "An unexpected error occurred during getNonMemberUsers";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        data: null,
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async joinChannel(props: JoinChannelProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.JOIN_CHANNEL,
          argsJson: {
            channelId: props.channel.name,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("joinChannel failed:", error);
      let errorMessage = "An unexpected error occurred during joinChannel";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async leaveChannel(props: LeaveChannelProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.LEAVE_CHANNEL,
          argsJson: { channelId: props.channel.name },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("leaveChannel failed:", error);
      let errorMessage = "An unexpected error occurred during leaveChannel";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async deleteChannel(props: DeleteChannelProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.DELETE_CHANNEL,
          argsJson: { channelId: props.channel.name },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("deleteChannel failed:", error);
      let errorMessage = "An unexpected error occurred during deleteChannel";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async promoteModerator(props: PromoteModeratorProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.PROMOTE_MODERATOR,
          argsJson: {
            channelId: props.channel.name,
            userId: props.user,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("promoteModerator failed:", error);
      let errorMessage = "An unexpected error occurred during promoteModerator";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async demoteModerator(props: DemoteModeratorProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.DEMOTE_MODERATOR,
          argsJson: {
            channelId: props.channel.name,
            userId: props.user,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("demoteModerator failed:", error);
      let errorMessage = "An unexpected error occurred during demoteModerator";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async removeUserFromChannel(
    props: RemoveUserFromChannelProps
  ): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.REMOVE_USER_FROM_CHANNEL,
          argsJson: {
            channelId: props.channel.name,
            userId: props.user,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("removeUserFromChannel failed:", error);
      let errorMessage =
        "An unexpected error occurred during removeUserFromChannel";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getMessages(props: GetMessagesProps): ApiResponse<FullMessageResponse> {
    try {
      const useContext = props.refetch_context_id
        ? props.refetch_context_id
        : (props.is_dm ? getDmContextId() : getContextId()) || "";
      const useIdentity = props.refetch_identity
        ? props.refetch_identity
        : (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "";

      // Convert old props format to new GetMessagesArgs format
      const getMessagesArgs = {
        channelId: props.group.name,
        parentId: props.parent_message || null,
        limit: props.limit,
        offset: props.offset,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const argsJson: any = getMessagesArgs;

      // Add search_term if present (legacy support - might need to be handled differently)
      if (props.searchTerm) {
        // Note: search_term might need to be part of GetMessagesArgs in the future
        // For now, keeping it separate for backward compatibility
        argsJson.searchTerm = props.searchTerm;
      }

      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        GetMessagesResponse
      >(
        {
          contextId: useContext,
          method: ClientMethod.GET_MESSAGES,
          argsJson,
          executorPublicKey: useIdentity,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (response?.error) {
        console.error("getMessages API error:", response.error);
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      // Backend returns: { result: { output: { result: [...] } } }
      // We need to transform it to FullMessageResponse format
      const getMessagesObject = response?.result?.output?.result as
        | FullMessageResponse
        | undefined;
      if (!getMessagesObject) {
        return {
          data: null,
          error: {
            code: 500,
            message: "An unexpected error occurred during getMessages",
          },
        };
      }

      // Transform messages from backend format to frontend format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedMessages = getMessagesObject.messages.map((msg: any) => {
        // Convert timestamp from nanoseconds (string) to milliseconds (number)
        const timestampNs =
          typeof msg.timestamp === "string"
            ? BigInt(msg.timestamp)
            : BigInt(msg.timestamp || 0);
        const timestampMs = Number(timestampNs / BigInt(1_000_000));

        // Convert editedAt from nanoseconds to milliseconds if present
        let editedAt: number | undefined = undefined;
        if (msg.editedAt !== null && msg.editedAt !== undefined) {
          const editedAtNs =
            typeof msg.editedAt === "string"
              ? BigInt(msg.editedAt)
              : BigInt(msg.editedAt || 0);
          editedAt = Number(editedAtNs / BigInt(1_000_000));
        }

        // Transform reactions from array format to HashMap format
        const reactionsHashMap = transformReactions(msg.reactions);

        // Transform attachments: map blob_id_str to blob_id and ensure uploaded_at exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformAttachment = (attachment: any) => {
          if (!attachment) return null;
          return {
            name: attachment.name,
            blob_id: attachment.blob_id || attachment.blob_id_str || "",
            mime_type: attachment.mime_type,
            size: attachment.size,
            uploaded_at: attachment.uploaded_at || 0,
          };
        };

        return {
          id: msg.id,
          sender: msg.senderId,
          senderUsername: msg.senderUsername,
          text: msg.text,
          timestamp: timestampMs,
          deleted: msg.deleted || false,
          editedAt,
          reactions: reactionsHashMap,
          threadCount: msg.threadCount || 0,
          threadLastTimestamp: msg.threadLastTimestamp
            ? typeof msg.threadLastTimestamp === "string"
              ? Number(BigInt(msg.threadLastTimestamp) / BigInt(1_000_000))
              : msg.threadLastTimestamp
            : 0,
          group: props.group.name,
          mentions: msg.mentions,
          mentionUsernames: msg.mentionUsernames,
          files: (msg.files || []).map(transformAttachment).filter(Boolean),
          images: (msg.images || []).map(transformAttachment).filter(Boolean),
        };
      });

      const fullMessageResponse: FullMessageResponse = {
        messages: transformedMessages,
        total_count: getMessagesObject.total_count,
        start_position: getMessagesObject.start_position,
      };

      return {
        data: fullMessageResponse,
        error: null,
      };
    } catch (error) {
      console.error("getMessages failed:", error);
      let errorMessage = "An unexpected error occurred during getMessages";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async sendMessage(
    props: SendMessageProps
  ): ApiResponse<MessageWithReactions> {
    try {
      if (!props.message) {
        return {
          error: {
            code: 400,
            message: "Message is required",
          },
        };
      }
      const sendMessageArgs = {
        channelId: props.group.name,
        text: props.message,
        parentId: props.parent_message || null,
        files: props.files,
        images: props.images,
        mentionUsernames: props.usernames,
        mentions: props.mentions,
      };

      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        { result: { output: { result: MessageWithReactions } } }
      >(
        {
          contextId: (props.is_dm ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.SEND_MESSAGE,
          argsJson: sendMessageArgs,
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMessage = response?.result?.output?.result as any;

      if (!rawMessage) {
        return {
          data: null,
          error: {
            code: 500,
            message: "An unexpected error occurred during sendMessage",
          },
        };
      }

      // Transform attachments: map blob_id_str to blob_id and ensure uploaded_at exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformAttachment = (attachment: any) => {
        if (!attachment) return null;
        return {
          name: attachment.name,
          blob_id: attachment.blob_id || attachment.blob_id_str || "",
          mime_type: attachment.mime_type,
          size: attachment.size,
          uploaded_at: attachment.uploaded_at || 0,
        };
      };

      // Transform reactions from array format to HashMap format
      const transformedMessage: MessageWithReactions = {
        ...rawMessage,
        reactions: transformReactions(rawMessage.reactions || []),
        files: (rawMessage.files || [])
          .map(transformAttachment)
          .filter(Boolean),
        images: (rawMessage.images || [])
          .map(transformAttachment)
          .filter(Boolean),
      };

      return {
        data: transformedMessage,
        error: null,
      };
    } catch (error) {
      console.error("sendMessage failed:", error);
      let errorMessage = "An unexpected error occurred during sendMessage";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getDmIdentityByContext(props: {
    context_id: string;
  }): ApiResponse<string> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        string
      >(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_DM_IDENTITY_BY_CONTEXT,
          argsJson: {
            context_id: props.context_id,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("getDmIdentityByContext failed:", error);
      let errorMessage =
        "An unexpected error occurred during getDmIdentityByContext";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getDms(): ApiResponse<DMChatInfo[]> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        { result: { output: { result: DMrawObject[] } } }
      >(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_DMS,
          argsJson: {},
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }

      const dmRawObjects = response?.result.output?.result as
        | DMrawObject[]
        | undefined;

      const transformedDms = dmRawObjects?.map((dm: DMrawObject) => ({
        channel_type: dm.channelType,
        created_at: dm.createdAt,
        created_by: dm.createdBy,
        channel_user: dm.channelUser,
        context_id: dm.contextId,
        other_identity_new: dm.otherIdentityNew,
        other_identity_old: dm.otherIdentityOld,
        other_username: dm.otherUsername,
        own_identity: dm.ownIdentity,
        own_identity_old: dm.ownIdentityOld,
        own_username: dm.ownUsername,
        did_join: dm.didJoin,
        invitation_payload: dm.invitationPayload,
        old_hash: dm.oldHash,
        new_hash: dm.newHash,
        unread_messages: dm.unreadMessages,
      }));

      return {
        data: transformedDms as DMChatInfo[],
        error: null,
      };
    } catch (error) {
      console.error("getDms failed:", error);
      let errorMessage = "An unexpected error occurred during getDms";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getChatMembers(
    props: GetChatMembersProps
  ): ApiResponse<Map<string, string>> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        Map<string, string>
      >(
        {
          contextId: (props.isDM ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.GET_CHAT_USERNAMES,
          argsJson: {},
          executorPublicKey:
            (props.isDM ? props.executor : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as Map<string, string>,
        error: null,
      };
    } catch (error) {
      console.error("getChatMembers failed:", error);
      let errorMessage = "An unexpected error occurred during getChatMembers";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async createDm(props: CreateDmProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.CREATE_DM,
          argsJson: {
            contextId: props.context_id,
            contextHash: props.context_hash,
            creator: props.creator,
            creatorNewIdentity: props.creator_new_identity,
            invitee: props.invitee,
            timestamp: props.timestamp,
            invitationPayload: props.payload,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("createDm failed:", error);
      let errorMessage = "An unexpected error occurred during createDm";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async updateReaction(props: UpdateReactionProps): ApiResponse<string> {
    try {
      // Convert old props format to new UpdateReactionArgs format
      const updateReactionArgs = {
        messageId: props.messageId,
        emoji: props.emoji,
        add: props.add,
        username: props.userId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: (props.is_dm ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.UPDATE_REACTION,
          argsJson: updateReactionArgs,
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("updateReaction failed:", error);
      let errorMessage = "An unexpected error occurred during updateReaction";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async deleteMessage(props: DeleteMessageProps): ApiResponse<string> {
    try {
      // Convert old props format to new DeleteMessageArgs format
      const deleteMessageArgs = {
        channelId: props.is_dm ? "private_dm" : props.group.name,
        messageId: props.messageId,
        parentId: props.parent_id || null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: (props.is_dm ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.DELETE_MESSAGE,
          argsJson: deleteMessageArgs,
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("deleteMessage failed:", error);
      let errorMessage = "An unexpected error occurred during deleteMessage";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async editMessage(props: EditMessageProps): ApiResponse<Message> {
    try {
      // Convert old props format to new EditMessageArgs format
      const editMessageArgs = {
        channelId: props.is_dm ? "private_dm" : props.group.name,
        messageId: props.messageId,
        text: props.newMessage,
        parentId: props.parent_id || null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, Message>(
        {
          contextId: (props.is_dm ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.EDIT_MESSAGE,
          argsJson: editMessageArgs,
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as Message,
        error: null,
      };
    } catch (error) {
      console.error("editMessage failed:", error);
      let errorMessage = "An unexpected error occurred during editMessage";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async updateNewIdentity(props: UpdateNewIdentityProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.UPDATE_NEW_IDENTITY,
          argsJson: {
            otherUser: props.other_user,
            newIdentity: props.new_identity,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("updateNewIdentity failed:", error);
      let errorMessage =
        "An unexpected error occurred during updateNewIdentity";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async updateInvitationPayload(
    props: UpdateInvitationPayloadProps
  ): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.UPDATE_INVITATION_PAYLOAD,
          argsJson: {
            other_user: props.other_user,
            invitation_payload: props.invitation_payload,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("updateInvitationPayload failed:", error);
      let errorMessage =
        "An unexpected error occurred during updateInvitationPayload";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async acceptInvitation(props: AcceptInvitationProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.ACCEPT_INVITATION,
          argsJson: {
            other_user: props.other_user,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("acceptInvitation failed:", error);
      let errorMessage = "An unexpected error occurred during acceptInvitation";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async deleteDM(props: DeleteDMProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.DELETE_DM,
          argsJson: { otherUser: props.other_user },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("deleteDM failed:", error);
      let errorMessage = "An unexpected error occurred during deleteDM";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async readMessage(props: ReadMessageProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.READ_MESSAGE,
          argsJson: {
            channelId: props.channelId,
            messageId: props.messageId,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("readMessage failed:", error);
      let errorMessage = "An unexpected error occurred during readMessage";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async updateDmHash(props: UpdateDmHashProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.UPDATE_DM_HASH,
          argsJson: {
            contextId: props.dmContextId,
            newHash: props.newHash,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("updateDmHash failed:", error);
      let errorMessage = "An unexpected error occurred during updateDmHash";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async readDm(props: ReadDmProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.READ_DM,
          argsJson: {
            contextId: props.dmContextId,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output as string,
        error: null,
      };
    } catch (error) {
      console.error("readDM failed:", error);
      let errorMessage = "An unexpected error occurred during readDM";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async getUsername(props: GetUsernameProps): ApiResponse<string> {
    try {
      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        { result: string }
      >(
        {
          contextId: props.contextId || getContextId() || "",
          method: ClientMethod.GET_USERNAME,
          argsJson: {},
          executorPublicKey:
            props.executorPublicKey || getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (response?.error) {
        return {
          data: null,
          error: {
            code: response?.error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response?.error.error.cause.info as any).message,
          },
        };
      }
      return {
        data: response?.result.output?.result as string,
        error: null,
      };
    } catch (error) {
      console.error("getUsername failed:", error);
      let errorMessage = "An unexpected error occurred during getUsername";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return {
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }
}
