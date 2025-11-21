import type { UserId } from "../api/clientApi";


export function extractAndAddMentions(
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any[],
): {
  userIdMentions: UserId[];
  usernameMentions: string[];
} {
  const regexPattern = /(@everyone)|(@here)|(@[a-zA-Z\s]+)/g;
  const uniqueUserIdMentions = new Set<string>();
  const uniqueUsernameMentions = new Set<string>();
  let match;

  if (!users) {
    return {
      userIdMentions: [],
      usernameMentions: [],
    };
  }

  while ((match = regexPattern.exec(message)) !== null) {
    const mention = match[0].slice(1).trim();

    if (mention === "everyone" || mention === "here") {
      uniqueUsernameMentions.add(mention);
      continue;
    }

    for (const user of users) {
      if (typeof user.username === 'string' && user.username.toLowerCase() === mention.toLowerCase()) {
        uniqueUserIdMentions.add(user.userId);
        uniqueUsernameMentions.add(user.username);
        break;
      }
    }
  }

  return {
    userIdMentions: Array.from(uniqueUserIdMentions) as UserId[],
    usernameMentions: Array.from(uniqueUsernameMentions),
  };
}
