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
} from "../clientApi";
import { getDmContextId } from "../../utils/session";

export function getJsonRpcClient() {
  const appEndpointKey = getAppEndpointKey();
  if (!appEndpointKey) {
    throw new Error(
      "Application endpoint key is missing. Please check your configuration.",
    );
  }
  return rpcClient;
}

export class ClientApiDataSource implements ClientApi {
  async joinChat(props: JoinChatProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: (props.isDM ? getDmContextId() : props.contextId || getContextId()) || "",
          method: ClientMethod.JOIN_CHAT,
          argsJson: {
            username: props.username,
            is_dm: props.isDM || false,
          },
          executorPublicKey:
            (props.isDM ? props.executor : (props.executorPublicKey || getExecutorPublicKey())) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
    props: CreateChannelProps,
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
            type: props.channel_type,
            read_only: props.read_only,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, { result: ChannelDataResponse[] }>(
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
        },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, {result: AllChannelsResponse}>(
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
        },
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
        },
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
    props: GetChannelMembersProps,
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
        },
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
            rawInput: {
              input: {
                channelId: props.channel.name,
                userId: props.user,
                username: props.username,
              },
            },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
    props: GetNonMemberUsersProps,
  ): ApiResponse<Record<string, string>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, unknown>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.GET_INVITE_USERS,
          argsJson: {
            rawInput: {
              input: {
                channelId: props.channel.name,
              },
            },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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

      const normalizeInvitees = (
        payload: unknown,
      ): Record<string, string> => {
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
        } else if (
          typeof parsedData === "object" &&
          parsedData !== null
        ) {
          Object.entries(parsedData as Record<string, unknown>).forEach(
            ([key, value]) => {
              map[key] = typeof value === "string" ? value : key;
            },
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
        },
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
          argsJson: {
            input: { channelId: props.channel.name },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
          argsJson: {
            input: { channelId: props.channel.name },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
            rawInput: {
              input: {
                channelId: props.channel.name,
                userId: props.user,
              },
            },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
            rawInput: {
              input: {
                channelId: props.channel.name,
                userId: props.user,
              },
            },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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

  async removeUserFromChannel(props: RemoveUserFromChannelProps): ApiResponse<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: getContextId() || "",
          method: ClientMethod.REMOVE_USER_FROM_CHANNEL,
          argsJson: {
            rawInput: {
              input: {
                channelId: props.channel.name,
                userId: props.user,
              },
            },
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
      let errorMessage = "An unexpected error occurred during removeUserFromChannel";
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
      const useContext = props.refetch_context_id ? props.refetch_context_id : (props.is_dm ? getDmContextId() : getContextId()) || "";
      const useIdentity = props.refetch_identity ? props.refetch_identity : (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "";
      
      // Convert old props format to new GetMessagesArgs format
      const getMessagesArgs = {
        channelId: props.group.name,
        parentId: props.parent_message || null,
        limit: props.limit,
        offset: props.offset,
      };

      // Backend accepts: rawInput: GetMessagesArgs | { input: GetMessagesArgs }
      // Send as { input: GetMessagesArgs } format to match other methods
      const argsJson: any = {
        rawInput: {
          input: getMessagesArgs,
        },
      };

      console.log("getMessages API call:", {
        method: ClientMethod.GET_MESSAGES,
        channelId: getMessagesArgs.channelId,
        parentId: getMessagesArgs.parentId,
        limit: getMessagesArgs.limit,
        offset: getMessagesArgs.offset,
        contextId: useContext,
        executorPublicKey: useIdentity,
      });

      // Add search_term if present (legacy support - might need to be handled differently)
      if (props.search_term) {
        // Note: search_term might need to be part of GetMessagesArgs in the future
        // For now, keeping it separate for backward compatibility
        argsJson.search_term = props.search_term;
      }

      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        FullMessageResponse
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
        },
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

      return {
        data: response?.result.output as FullMessageResponse,
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

  async sendMessage(props: SendMessageProps): ApiResponse<Message> {
    try {
      if (!props.message) {
        return {
          error: {
            code: 400,
            message: "Message is required",
          },
        };
      }
      
      // Convert old props format to new SendMessageArgs format
      const attachments = (props.files && props.files.length > 0) || (props.images && props.images.length > 0)
        ? {
            files: props.files,
            images: props.images,
          }
        : undefined;

      const sendMessageArgs = {
        channelId: props.group.name,
        text: props.message,
        parentId: props.parent_message || null,
        attachments,
      };

      const response = await getJsonRpcClient().execute<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        Message
      >(
        {
          contextId: (props.is_dm ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.SEND_MESSAGE,
          argsJson: {
            rawInput: {
              input: sendMessageArgs,
            },
          },
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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

  async getDmIdentityByContext(props: { context_id: string }): ApiResponse<string> {
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
        },
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
      let errorMessage = "An unexpected error occurred during getDmIdentityByContext";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, DMChatInfo[]>(
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
        },
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
        data: response?.result.output as DMChatInfo[],
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
    props: GetChatMembersProps,
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
        },
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
            // context_hash: props.context_hash,
            creator: props.creator,
            creatorNewIdentity: props.creator_new_identity,
            invitee: props.invitee,
            timestamp: props.timestamp,
            invitation_payload: props.payload,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, string>(
        {
          contextId: (props.is_dm ? getDmContextId() : getContextId()) || "",
          method: ClientMethod.UPDATE_REACTION,
          argsJson: {
            rawInput: {
              input: updateReactionArgs,
            },
          },
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
          argsJson: {
            rawInput: {
              input: deleteMessageArgs,
            },
          },
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
          argsJson: {
            rawInput: {
              input: editMessageArgs,
            },
          },
          executorPublicKey:
            (props.is_dm ? props.dm_identity : getExecutorPublicKey()) || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
            other_user: props.other_user,
            new_identity: props.new_identity,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
    props: UpdateInvitationPayloadProps,
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
        },
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
        },
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
        },
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
            channel: props.channel,
            timestamp: props.timestamp,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
            sender_id: props.sender_id,
            other_user_id: props.other_user_id,
            new_hash: props.new_hash,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
            other_user_id: props.other_user_id,
          },
          executorPublicKey: getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getJsonRpcClient().execute<any, { result: string }>(
        {
          contextId: props.contextId || getContextId() || "",
          method: ClientMethod.GET_USERNAME,
          argsJson: {},
          executorPublicKey: props.executorPublicKey || getExecutorPublicKey() || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
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
