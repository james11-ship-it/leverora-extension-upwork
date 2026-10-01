import type { SelectorConfig } from "@shared/types";
import { findComposeField } from "./selectors";

/**
 * Inserts text into Upwork's message compose field and leaves focus there.
 * Never submits — the human always presses Send themselves (see plan §11).
 */
export function injectText(config: SelectorConfig, text: string): boolean {
  const field = findComposeField(config);
  if (!field) return false;

  field.focus();

  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set;
    setter?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (field.isContentEditable) {
    field.textContent = text;
    field.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  } else {
    return false;
  }

  return true;
}
