export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}
export interface Workspace {
  id: string;
  name: string;
  slug: string;
}
export interface Rule {
  trigger: string;
  response: string;
}
export interface AgentTheme {
  primary?: string;
  radius?: number;
  position?: "left" | "right";
  launcher_label?: string;
}
export interface Agent {
  id: string;
  name: string;
  role_title: string;
  emoji: string;
  status: "draft" | "live";
  instructions: string;
  tone: "friendly" | "formal" | "casual" | "playful";
  language: "id" | "en";
  rules: Rule[];
  guardrails: string[];
  engine: "auto" | "openai" | "offline";
  model: string | null;
  temperature: number;
  retrieval_top_k: number;
  greeting: string;
  starter_prompts: string[];
  fallback_message: string;
  handoff_enabled: boolean;
  handoff_message: string;
  theme: AgentTheme;
  allowed_origins: string[];
  channels: Record<string, { enabled?: boolean; phone_number_id?: string; page_id?: string; access_token?: string; verify_token?: string }>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
  conversation_count: number;
  public_key: string | null;
}
export interface KnowledgeDoc {
  id: string;
  title: string;
  source: string;
  content: string;
  created_at: string;
  updated_at: string;
  chunk_count: number;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  latency_ms: number | null;
  sources: { document_id: string; title: string; score: number }[];
  engine: string;
  created_at: string;
  feedback: { id: string; rating: string; comment: string }[];
}
export interface Conversation {
  id: string;
  channel: string;
  visitor_name: string | null;
  visitor_email: string | null;
  origin: string | null;
  status: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  last_message: string;
}
export interface ConversationDetail extends Conversation {
  messages: Message[];
}
export interface ApiKeyRow {
  id: string;
  label: string;
  kind: string;
  public_key: string | null;
  prefix: string;
  revoked: boolean;
  created_at: string;
}
export interface Overview {
  greeting: string;
  agents_live: number;
  agents_total: number;
  tasks_now: number;
  conversations_today: number;
  conversations_done: number;
  conversations_todo: number;
  messages_today: number;
  resolution_rate: number;
  avg_response_s: number;
  csat: number;
  time_saved_h: number;
  activity: {
    id: string;
    kind: string;
    icon: string;
    title: string;
    detail: string;
    agent: string;
    ago: string;
    created_at: string;
  }[];
  recent_conversations: Conversation[];
  week_series: number[];
}

export interface AgentAnalytics {
  conversations_total: number;
  messages_total: number;
  resolution_rate: number;
  csat: number;
  avg_latency_s: number;
  busiest_hour: number;
  series: { date: string; conversations: number; messages: number }[];
  by_channel: Record<string, number>;
  hour_histogram: number[];
  top_sources: { title: string; hits: number }[];
  feedback: { up: number; down: number };
  engine_split: Record<string, number>;
}

export interface LLMSettings {
  base_url: string;
  model: string;
  has_key: boolean;
  key_masked: string | null;
  source: "workspace" | "env" | "none";
}
