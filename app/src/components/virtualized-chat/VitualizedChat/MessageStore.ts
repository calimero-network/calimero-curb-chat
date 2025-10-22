export interface UpdateFunction<T> {
  (currentMessage: T): Partial<T>;
}

export type UpdateDescriptor<T> =
  | { updatedFields: Partial<T> }
  | { updateFunction: UpdateFunction<T> };

type InternalMessage<T> = T & { version?: number };

class MessageStore<
  T extends {
    id: string;
  },
> {
  public messages: InternalMessage<T>[] = [];

  private messageMap: Map<string, number> = new Map();

  private startOffset: number = 0;

  private endOffset: number = 0;

  private updateLookup(messages: T[], isPrepend: boolean = false) {
    messages.forEach((msg, index) => {
      if (!msg.id) {
        throw new Error('Message must have a valid ID');
      }

      const globalIndex = isPrepend
        ? this.startOffset + index
        : this.endOffset + index;

      this.messageMap.set(msg.id, globalIndex);
    });
  }

  reset() {
    this.messages = [];
    this.startOffset = 0;
    this.endOffset = 0;
    this.messageMap.clear();
  }

  prepend(messages: T[]): void {
    this.messages = messages.concat(this.messages);
    this.startOffset -= messages.length;
    this.updateLookup(messages, true);
  }

  initial(messages: T[]): void {
    this.reset();
    this.append(messages);
  }

  append(messages: T[]): void {
    // Filter out messages that already exist in the store
    let newMessages = messages.filter(msg => !this.messageMap.has(msg.id));
    
    // Also remove optimistic messages that match real messages by content
    // This handles the case where an optimistic temp-123 message should be replaced by real message
    if (newMessages.length > 0) {
      const hasRealMessages = newMessages.some(msg => !msg.id.startsWith('temp-'));
      
      if (hasRealMessages) {
        // Remove any temp- messages that match the content of real messages
        const realMessages = newMessages.filter(msg => !msg.id.startsWith('temp-'));
        this.messages = this.messages.filter(existingMsg => {
          // Keep non-temp messages
          if (!existingMsg.id.startsWith('temp-')) return true;
          
          // Remove temp message if we have a real one with same text and similar timestamp
          const hasMatchingReal = realMessages.some((realMsg: any) => 
            realMsg.text === (existingMsg as any).text && 
            Math.abs((realMsg as any).timestamp - (existingMsg as any).timestamp) < 5000
          );
          
          if (hasMatchingReal) {
            // Remove from messageMap too
            this.messageMap.delete(existingMsg.id);
            return false;
          }
          return true;
        });
      }
      
      this.updateLookup(newMessages);
      this.messages = this.messages.concat(newMessages);
      this.endOffset += newMessages.length;
    }
  }

  _update(oldId: string, updatedFields: Partial<T>): void {
    const globalIndex = this.messageMap.get(oldId);
    if (globalIndex == undefined) return;
    const localIndex = globalIndex - this.startOffset;
    if (
      updatedFields.id &&
      updatedFields.id !== oldId &&
      this.messageMap.has(updatedFields.id)
    ) {
      throw new Error(
        `A message with ID "${updatedFields.id}" already exists.`,
      );
    }
    const existingMessage = this.messages[localIndex];

    const version = existingMessage?.version ? existingMessage.version + 1 : 1;

    this.messages[localIndex] = {
      ...existingMessage,
      ...updatedFields,
      version,
    };

    if (updatedFields.id && updatedFields.id !== oldId) {
      this.messageMap.delete(oldId);
      this.messageMap.set(updatedFields.id, globalIndex);
    }
  }

  computeKey(item: InternalMessage<T>): string {
    return `${item.id}_${item.version ?? 0}`;
  }

  _applyUpdateFunction(oldId: string, updateFunction: UpdateFunction<T>) {
    const globalIndex = this.messageMap.get(oldId);
    if (globalIndex == undefined) return;
    const localIndex = globalIndex - this.startOffset;
    const existingMessage = this.messages[localIndex];
    const updatedFields = updateFunction(existingMessage);
    this._update(oldId, updatedFields);
  }

  getItem(index: number): InternalMessage<T> {
    const localIndex = index - this.startOffset;
    return this.messages[localIndex];
  }

  updateMultiple(
    updates: {
      id: string;
      descriptor: UpdateDescriptor<T>;
    }[],
  ): void {
    updates.forEach((update) => {
      if (update.id) {
        if (
          'updatedFields' in update.descriptor &&
          'updateFunction' in update.descriptor
        ) {
          throw new Error(
            'Message update descriptor cannot have both updatedFields and updateFunction',
          );
        }
        if ('updatedFields' in update.descriptor) {
          this._update(update.id, update.descriptor?.updatedFields);
        }
        if ('updateFunction' in update.descriptor) {
          this._applyUpdateFunction(
            update.id,
            update.descriptor?.updateFunction,
          );
        }
      } else {
        throw new Error('Message must have a valid ID');
      }
    });
  }
}

export default MessageStore;
