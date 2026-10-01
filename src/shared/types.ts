export type CategorySlug =
  | "copywriting"
  | "seo-content-writing"
  | "web-development"
  | "ai-agent-chatbot-dev"
  | "data-analysis-bi"
  | "seo-audit-strategy"
  | "translation-localization"
  | "technical-documentation"
  | "business-plans-modeling"
  | "legal-document-drafting";

export const CATEGORY_SLUGS: CategorySlug[] = [
  "copywriting",
  "seo-content-writing",
  "web-development",
  "ai-agent-chatbot-dev",
  "data-analysis-bi",
  "seo-audit-strategy",
  "translation-localization",
  "technical-documentation",
  "business-plans-modeling",
  "legal-document-drafting"
];

export type Msg = {
  id: string; // hash(author + timestamp + first80Chars)
  author: string;
  timestamp: number;
  text: string;
  isOwn: boolean;
};

export type Thread = {
  threadKey: string; // sha256("upwork:" + room_id)
  clientName: string; // local only, never sent to server
  categorySlug: CategorySlug | null;
  briefNotes: string;
  lastMessageId: string | null;
  messageCount: number;
  planId: string | null;
};

export type Suggestion = {
  direct: string;
  withQuestions: string;
  suggestedQuestions: string[];
  missingInfo: string[];
};

export type PlanRef = {
  planId: string;
  version: number;
  status: "draft" | "ready" | "revising";
  pdfUrl: string | null;
};

export type Estimate = {
  action: "suggest" | "plan" | "plan_revise" | "execute";
  credits: number;
};

export type SelectorConfig = {
  version: string;
  platform: "upwork";
  messageContainer: string[];
  messageItem: string[];
  authorName: string[];
  messageTimestamp: string[];
  messageText: string[];
  composeField: string[];
  // The logged-in freelancer's own display name, read from the account/nav
  // area (not inside the thread) — compared against each message's author
  // to set isOwn, since Upwork's message markup carries no own/other class.
  ownProfileName: string[];
  // The conversation partner's name in the thread header, used for Thread.clientName.
  conversationHeader: string[];
};

export type ReaderFailedEvent = {
  type: "reader_failed";
  reason: string;
  threadKey: string | null;
  timestamp: number;
};

/** A user-picked file (image/PDF/text/etc), read client-side into a data URL. */
export type Attachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type JobStatus = "queued" | "running" | "done" | "error";

export type JobProgress = {
  jobId: string;
  status: JobStatus;
  message: string | null;
  percent: number | null;
};
