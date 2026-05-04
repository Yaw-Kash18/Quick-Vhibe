import { useMutation } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export const useDeleteMessage = () =>
  useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: number; messageId: number }) =>
      customFetch<{ ok: boolean }>(`/api/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" }),
  });

export const useDeleteGroupMessage = () =>
  useMutation({
    mutationFn: ({ groupId, messageId }: { groupId: number; messageId: number }) =>
      customFetch<{ ok: boolean }>(`/api/groups/${groupId}/messages/${messageId}`, { method: "DELETE" }),
  });

export const useAddGroupMember = () =>
  useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) =>
      customFetch<{ ok: boolean }>(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }),
  });
