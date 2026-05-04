# Quick Vibe

## Overview

Real-time one-to-one and group messaging web app. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite, Tailwind CSS v4, Framer Motion, Wouter routing, shadcn/ui
- **Auth**: Clerk (via `@clerk/react`, `@clerk/express`)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)

## Artifacts

- `artifacts/quick-vibe` — frontend React app at `/` (port `$PORT`, default 24762)
- `artifacts/api-server` — Express API server at `/api` (port 8080)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run push-force` — force push DB schema changes

## Database Tables

- `users` — Clerk user ID, username, displayName, avatarUrl, lastSeenAt
- `conversations` — between two users (user1Id, user2Id)
- `messages` — content, senderId, conversationId, isRead, mediaUrl, mediaType, editedAt, replyToId
- `groups` — name, description, adminOnlyMessaging, createdById
- `group_members` — groupId, userId, isAdmin
- `group_messages` — content, senderId, groupId, mediaUrl, mediaType, editedAt, replyToId

## API Routes (`/api`)

- `GET /api/users/me` / `PATCH` — get/update own profile
- `GET /api/users/search?q=` — search users
- `POST /api/users/online-status` — heartbeat
- `GET /api/users/online-users` — get online user IDs
- `GET /api/conversations` / `POST` — list/create conversations
- `GET /api/conversations/:id` — get conversation (includes otherUser.lastSeenAt)
- `PATCH /api/conversations/:id/read` — mark read
- `GET /api/conversations/:id/messages` / `POST` — list/send messages (with replyTo)
- `PATCH /api/conversations/:id/messages/:messageId` — edit DM message
- `DELETE /api/conversations/:id/messages/:messageId` — delete DM message (own only)
- `POST /api/conversations/:id/typing` — typing indicator
- `GET /api/groups` / `POST` — list/create groups
- `GET /api/groups/:id` / `PATCH` — get/update group
- `POST /api/groups/:id/members` — add member to group
- `DELETE /api/groups/:id/members/:userId` / `PATCH` — remove/update member role
- `GET /api/groups/:id/messages` / `POST` — list/send group messages (with replyTo)
- `PATCH /api/groups/:id/messages/:messageId` — edit group message
- `DELETE /api/groups/:id/messages/:messageId` — delete group message (own only)

## Custom API Hooks (lib/api-client-react/src/custom-hooks.ts)

Manual hooks not covered by codegen:
- `useDeleteMessage` — DELETE /api/conversations/:id/messages/:messageId
- `useDeleteGroupMessage` — DELETE /api/groups/:id/messages/:messageId
- `useAddGroupMember` — POST /api/groups/:id/members

## Features Implemented

- DM chat with real-time polling (3s), typing indicators
- Group chat with admin-only mode, member management
- User online/offline indicator with last-seen timestamps in DM header
- Profile setup (username only; no display name)
- Profile picture upload (resized to 256px, stored as base64)
- Chat background selector (localStorage)
- Message reactions (emoji picker, quick reactions, top-used)
- Message editing (own messages)
- Message deletion: "delete for me" (localStorage) or "delete for everyone" (server, own messages)
- Reply to messages (swipe-to-reply gesture, quoted message preview, stored in DB via replyToId)
- Long-press or double-tap context menu on messages: React, Reply, Edit, Forward, Star, Delete for me, Delete for everyone
- Star messages (localStorage)
- Message search (inline search bar in DM and group headers)
- Voice notes (hold-to-record using MediaRecorder API, sends as audio/webm media)
- "Seen" indicator on last sent DM message that has been read
- Swipe-to-reply gesture on message bubbles
- Sidebar: long-press chat items to Pin/Unpin or Delete
- Pinned chats sorted to top with pin icon (localStorage)
- Group info panel: online status per member, add member button (with user search)
- Forward messages (copies content to input)
- Settings page: username only (no display name)

## Architecture Notes

- `lastSeenAt` is returned as part of the full user object from the DB but not in the OpenAPI User type — access as `(otherUser as any).lastSeenAt`
- Reply state (`replyTo: { id, content, senderName } | null`) is lifted to `chat.tsx` (DM) or `GroupChatArea` (group) and passed as props to both MessageList and MessageInput
- Search state is lifted to `chat.tsx` and passed to headers (onSearch) and message lists (searchQuery)
- "Delete for me" and "Star" and "Pinned chats" are localStorage-only (see hooks in `src/hooks/`)
- Voice notes use browser MediaRecorder API, recorded to audio/webm blob, converted to base64 data URL
