export interface User {
  id: number;
  phone: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  about: string;
  is_online: boolean;
  last_seen: string;
}

export interface Member {
  id: number;
  role: "admin" | "member";
  user: User;
}

export interface Reaction {
  emoji: string;
  user_id: number;
}

export interface Attachment {
  id: number;
  url: string;
  type: string;
  filename: string | null;
  size: number | null;
}

export interface ReplyPreview {
  id: number;
  sender_id: number;
  content: string;
  type: string;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  type: "text" | "image" | "file" | "system";
  status: MessageStatus;
  reply_to_id: number | null;
  disappear_after: number | null;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
  reactions: Reaction[];
  attachments: Attachment[];
  reply_to: ReplyPreview | null;
  read_by: number[];
  // client-only optimistic fields
  _localId?: string;
}

export interface Conversation {
  id: number;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: number | null;
  updated_at: string;
  members: Member[];
  last_message: Message | null;
  unread_count: number;
}
