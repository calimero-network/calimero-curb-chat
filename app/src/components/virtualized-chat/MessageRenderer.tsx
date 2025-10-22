import React from 'react';
import type { AccountData, CurbMessage } from './types/curbTypes';
import ImageRepository from './VitualizedChat/ImageRepository';

import { Message } from '.';

interface MessageRendererProps {
  accountId: string;
  isThread: boolean;
  handleReaction: (message: CurbMessage, reaction: string) => void;
  setThread?: (message: CurbMessage) => void;
  getIconFromCache: (accountId: string) => Promise<string | null>;
  toggleEmojiSelector: (message: CurbMessage) => void;
  openMobileReactions: string;
  setOpenMobileReactions: (messageId: string) => void;
  editable: (message: CurbMessage) => boolean;
  deleteable: (message: CurbMessage) => boolean;
  onEditModeRequested: (message: CurbMessage, isThread: boolean) => void;
  onEditModeCancelled: (message: CurbMessage) => void;
  onMessageUpdated: (message: CurbMessage) => void;
  onDeleteMessageRequested: (message: CurbMessage) => void;
  fetchAccounts: (prefix: string) => void;
  autocompleteAccounts: AccountData[];
  authToken: string | undefined;
  privateIpfsEndpoint: string;
}

const messageRender = ({
  accountId,
  isThread = false,
  handleReaction,
  setThread,
  getIconFromCache,
  openMobileReactions,
  setOpenMobileReactions,
  toggleEmojiSelector,
  editable,
  onEditModeRequested,
  onEditModeCancelled,
  onMessageUpdated,
  deleteable,
  onDeleteMessageRequested,
  fetchAccounts,
  autocompleteAccounts,
  authToken,
  privateIpfsEndpoint,
}: MessageRendererProps) => {
  const store = new ImageRepository(getIconFromCache);
  const openThread = (message: CurbMessage) => {
    if (!isThread && setThread) {
      setThread(message);
    }
  };
  const toggleReaction = (message: CurbMessage, reaction: string) => {
    handleReaction(message, reaction);
  };

  const handleEmojiSelector = (message: CurbMessage) => {
    toggleEmojiSelector(message);
  };
  const renderMessage = (
    message: CurbMessage,
    prevMessage?: CurbMessage,
  ): React.ReactElement => {
    return (
      <Message
        message={message}
        prevMessage={prevMessage}
        accountId={accountId}
        openThread={() => openThread(message)}
        handleReaction={(reaction) => toggleReaction(message, reaction)}
        isThread={isThread}
        getIconFromCache={(id) => store.getCacheImage(id)!}
        toggleEmojiSelector={() => handleEmojiSelector(message)}
        openMobileReactions={openMobileReactions}
        setOpenMobileReactions={(id) => setOpenMobileReactions(id)}
        editable={editable(message)}
        deletable={deleteable(message)}
        editMessage={() => onEditModeRequested(message, isThread)}
        cancelEditMessage={() => onEditModeCancelled(message)}
        submitEditedMessage={(text) => onMessageUpdated({ ...message, text })}
        deleteMessage={() => onDeleteMessageRequested(message)}
        fetchAccounts={fetchAccounts}
        autocompleteAccounts={autocompleteAccounts}
        authToken={authToken}
        privateIpfsEndpoint={privateIpfsEndpoint}
      />
    );
  };
  return renderMessage;
};

export default messageRender;
