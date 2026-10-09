import { useRef, useState } from "react";
import type { Attachment } from "@shared/types";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB — keeps base64 payloads reasonable over the messaging pipeline

function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type || "application/octet-stream", dataUrl: reader.result as string });
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

export function AttachmentPicker({ files, onChange }: { files: Attachment[]; onChange: (files: Attachment[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    setError(null);
    const picked = Array.from(fileList);
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is too large (max 8MB).`);
      // Reset here too — Chrome fires no `change` event for re-selecting the
      // same file while the input still holds it, so without this the error
      // sits there with no way to retry until the user picks a different file.
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    try {
      const read = await Promise.all(picked.map(readFileAsAttachment));
      onChange([...files, ...read]);
    } catch {
      setError("Could not read one of the files.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {files.map((f, i) => (
          <span
            key={`${f.name}-${i}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <span className="truncate">{f.name}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              style={{ color: "var(--text-muted)" }}
              aria-label={`Remove ${f.name}`}
            >
              ✕
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full px-2.5 py-1 text-xs"
          style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
        >
          + Attach files
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt"
        className="hidden"
        onChange={(e) => void onFilesSelected(e.target.files)}
      />
    </div>
  );
}
