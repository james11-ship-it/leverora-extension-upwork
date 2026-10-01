import type { CategorySlug } from "@shared/types";
import { usePanelStore } from "../store";

const CATEGORIES: Array<{ slug: CategorySlug; icon: string; label: string; description: string }> = [
  { slug: "copywriting", icon: "📝", label: "Copywriting", description: "Sales pages, email sequences, ad copy" },
  { slug: "seo-content-writing", icon: "📈", label: "SEO Content Writing", description: "Optimized long-form articles" },
  { slug: "web-development", icon: "💻", label: "Web Development", description: "Code: landing pages, bug fixes, conversions" },
  { slug: "ai-agent-chatbot-dev", icon: "🤖", label: "AI Agent & Chatbot Dev", description: "Agent/chatbot code + integration" },
  { slug: "data-analysis-bi", icon: "📊", label: "Data Analysis & BI", description: "Reports, dashboards, Excel analysis" },
  { slug: "seo-audit-strategy", icon: "🔍", label: "SEO Audit & Strategy", description: "Technical audit + fix roadmap" },
  { slug: "translation-localization", icon: "🌐", label: "Translation & Localization", description: "Translated documents/websites" },
  { slug: "technical-documentation", icon: "📚", label: "Technical Documentation", description: "API docs, SOPs, user guides" },
  { slug: "business-plans-modeling", icon: "💼", label: "Business Plans & Modeling", description: "Business plan + financial model" },
  { slug: "legal-document-drafting", icon: "⚖️", label: "Legal Document Drafting", description: "Draft contracts, NDAs, ToS, Privacy Policy" }
];

export function CategoryPicker() {
  const setCategory = usePanelStore((s) => s.setCategory);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Which category best fits this conversation?
      </p>
      <div className="flex flex-col gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCategory(c.slug)}
            className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
          >
            <span className="text-xl">{c.icon}</span>
            <span className="flex flex-col">
              <span className="font-medium">{c.label}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {c.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
