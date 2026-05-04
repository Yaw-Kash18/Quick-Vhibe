import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useGetGroup, getGetGroupQueryKey } from "@workspace/api-client-react";
import Sidebar from "@/components/chat/sidebar";
import MessageList from "@/components/chat/message-list";
import MessageInput from "@/components/chat/message-input";
import ConversationHeader from "@/components/chat/conversation-header";
import GroupMessageList from "@/components/chat/group-message-list";
import GroupHeader from "@/components/chat/group-header";
import { MessageSquare } from "lucide-react";
import { useChatBackground } from "@/hooks/use-chat-background";
import { useAuth } from "@/App";

// Pattern for backend-generated temporary usernames (e.g. user_3f2a1b4c)
const AUTO_USERNAME_RE = /^user_[0-9a-f]{8}$/;

type ActiveChat = { type: "dm"; id: number } | { type: "group"; id: number };
interface ReplyTo { id: number; content: string; senderName: string; }

function GroupChatArea({ groupId, currentUser, backgroundStyle, onBack }: {
  groupId: number;
  currentUser: { id: number; username: string; displayName: string | null; avatarUrl: string | null };
  backgroundStyle: React.CSSProperties;
  onBack: () => void;
}) {
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: group } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId, refetchInterval: 5000 },
  });

  const currentMember = group?.members.find((m) => m.id === currentUser.id);
  const isReadOnly = (group?.adminOnlyMessaging ?? false) && !(currentMember?.isAdmin ?? false);

  return (
    <>
      <GroupHeader groupId={groupId} currentUserId={currentUser.id} onBack={onBack} onLeft={onBack} onSearch={setSearchQuery} />
      <GroupMessageList groupId={groupId} currentUser={currentUser} backgroundStyle={backgroundStyle} searchQuery={searchQuery} onReply={setReplyTo} />
      <MessageInput chatType="group" chatId={groupId} readOnly={isReadOnly} readOnlyReason="Only admins can send messages in this group" replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
    </>
  );
}

export default function Chat() {
  const [, setLocation] = useLocation();
  const { requireSetup } = useAuth();

  const { data: me, isLoading: isLoadingMe, error } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });

  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [dmReplyTo, setDmReplyTo] = useState<ReplyTo | null>(null);
  const [dmSearchQuery, setDmSearchQuery] = useState("");
  const { background } = useChatBackground(me?.id);

  // If the user somehow reaches chat with an auto-generated username
  // (e.g. they signed in on a different device before completing setup),
  // mark them as needing setup and redirect to /setup.
  useEffect(() => {
    if (me && me.username && AUTO_USERNAME_RE.test(me.username)) {
      requireSetup();
      setLocation("/setup");
    }
  }, [me]);

  // If the token is invalid/expired the API returns 401 → sign them out
  useEffect(() => {
    if (error && (error as any)?.status === 401) {
      // Token is invalid; Auth context keeps isSignedIn, but we'll let the
      // ProtectedRoute redirect handle it after signOut is triggered elsewhere.
      // For now just redirect to home.
      setLocation("/");
    }
  }, [error]);

  if (isLoadingMe) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!me) return null;

  const handleBack = () => {
    setActiveChat(null);
    setDmReplyTo(null);
    setDmSearchQuery("");
  };

  const hasActive = activeChat !== null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <div className={`flex-shrink-0 flex flex-col border-r border-border/50 bg-card h-full w-full md:w-80 ${hasActive ? "hidden md:flex" : "flex"}`}>
        <Sidebar
          currentUser={me}
          activeChat={activeChat}
          onSelectDM={(id) => { setActiveChat({ type: "dm", id }); setDmReplyTo(null); setDmSearchQuery(""); }}
          onSelectGroup={(id) => setActiveChat({ type: "group", id })}
        />
      </div>

      <div className={`flex-1 flex flex-col bg-background min-w-0 relative ${hasActive ? "flex" : "hidden md:flex"}`}>
        {activeChat?.type === "dm" && (
          <>
            <ConversationHeader conversationId={activeChat.id} onBack={handleBack} onSearch={setDmSearchQuery} />
            <MessageList conversationId={activeChat.id} currentUser={me} backgroundStyle={background.style} searchQuery={dmSearchQuery} replyTo={dmReplyTo} onReply={setDmReplyTo} />
            <MessageInput chatType="dm" chatId={activeChat.id} replyTo={dmReplyTo} onCancelReply={() => setDmReplyTo(null)} />
          </>
        )}

        {activeChat?.type === "group" && (
          <GroupChatArea groupId={activeChat.id} currentUser={me} backgroundStyle={background.style} onBack={handleBack} />
        )}

        {!activeChat && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-medium text-foreground">Your Messages</h2>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                Select a conversation from the sidebar, search for a user, or create a group to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
