import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const TOKEN_KEY = "ponte_token";

let authToken: string | null = null;

export function getAuthToken() {
  return authToken;
}

export async function loadToken(): Promise<string | null> {
  authToken = await storage.secureGet<string | null>(TOKEN_KEY, null);
  return authToken;
}

export async function persistToken(token: string | null) {
  authToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || "Ocorreu um erro";
    throw new ApiError(typeof detail === "string" ? detail : "Ocorreu um erro", res.status);
  }
  return data as T;
}

export type User = {
  id: string;
  username: string;
  display_name: string;
  language: "pt" | "es";
  avatar_color: string;
  email?: string;
};

export type Reaction = { user_id: string; emoji: string };

export type ReplyPreview = { id: string; sender_id: string; preview: string };

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: "text" | "voice";
  original_text: string;
  original_lang: string | null;
  translated_text: string;
  translated_lang: string | null;
  audio_media_id: string | null;
  tts_media_id: string | null;
  duration: number | null;
  reply_to: ReplyPreview | null;
  reactions: Reaction[];
  edited: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type ConversationSummary = {
  id: string;
  other_user: User;
  last_message: { preview: string; created_at: string; sender_id: string; type: string } | null;
  last_message_at: string;
  unread_count: number;
};

export const api = {
  register: (body: {
    email: string;
    password: string;
    username: string;
    display_name: string;
    language: "pt" | "es";
  }) => request<{ access_token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ access_token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  me: () => request<User>("/auth/me"),

  searchUsers: (q: string) => request<User[]>(`/users/search?q=${encodeURIComponent(q)}`),

  startConversation: (username: string) =>
    request<{ id: string }>("/conversations", { method: "POST", body: JSON.stringify({ username }) }),

  listConversations: () => request<ConversationSummary[]>("/conversations"),

  getConversation: (id: string) => request<{ id: string; other_user: User | null }>(`/conversations/${id}`),

  getMessages: (id: string) => request<Message[]>(`/conversations/${id}/messages`),

  sendMessage: (id: string, text: string, reply_to?: string | null) =>
    request<Message>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, reply_to: reply_to ?? null }),
    }),

  editMessage: (msgId: string, text: string) =>
    request<Message>(`/messages/${msgId}`, { method: "PATCH", body: JSON.stringify({ text }) }),

  deleteMessage: (msgId: string) => request<{ ok: boolean }>(`/messages/${msgId}`, { method: "DELETE" }),

  reactMessage: (msgId: string, emoji: string) =>
    request<Message>(`/messages/${msgId}/react`, { method: "POST", body: JSON.stringify({ emoji }) }),

  sendVoice: async (id: string, uri: string, duration: number, reply_to?: string | null) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, "voice.m4a");
    } else {
      form.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as any);
    }
    form.append("duration", String(duration));
    if (reply_to) form.append("reply_to", reply_to);
    return request<Message>(`/conversations/${id}/voice`, { method: "POST", body: form });
  },
};

export function mediaUrl(mediaId: string) {
  return `${BASE}/media/${mediaId}`;
}
