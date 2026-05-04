// In-memory store for typing indicators and online status
// userId -> timestamp of last seen (online if within 30s)
const onlineStatus = new Map<number, Date>();

// conversationId -> Map<userId, timestamp>
const typingStatus = new Map<number, Map<number, Date>>();

const ONLINE_TIMEOUT_MS = 30_000;
const TYPING_TIMEOUT_MS = 5_000;

export function updateOnlineStatus(userId: number): void {
  onlineStatus.set(userId, new Date());
}

export function isOnline(userId: number): boolean {
  const lastSeen = onlineStatus.get(userId);
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < ONLINE_TIMEOUT_MS;
}

export function getOnlineUserIds(): number[] {
  const now = Date.now();
  const online: number[] = [];
  for (const [userId, lastSeen] of onlineStatus.entries()) {
    if (now - lastSeen.getTime() < ONLINE_TIMEOUT_MS) {
      online.push(userId);
    }
  }
  return online;
}

export function setTyping(conversationId: number, userId: number, isTyping: boolean): void {
  if (isTyping) {
    if (!typingStatus.has(conversationId)) {
      typingStatus.set(conversationId, new Map());
    }
    typingStatus.get(conversationId)!.set(userId, new Date());
  } else {
    typingStatus.get(conversationId)?.delete(userId);
  }
}

export function getTypingUserIds(conversationId: number): number[] {
  const conversationTyping = typingStatus.get(conversationId);
  if (!conversationTyping) return [];
  const now = Date.now();
  const typing: number[] = [];
  for (const [userId, timestamp] of conversationTyping.entries()) {
    if (now - timestamp.getTime() < TYPING_TIMEOUT_MS) {
      typing.push(userId);
    } else {
      conversationTyping.delete(userId);
    }
  }
  return typing;
}

export function getAllTypingStatuses(): Array<{ conversationId: number; typingUserIds: number[] }> {
  const result = [];
  for (const [conversationId] of typingStatus.entries()) {
    const typingUserIds = getTypingUserIds(conversationId);
    result.push({ conversationId, typingUserIds });
  }
  return result;
}
