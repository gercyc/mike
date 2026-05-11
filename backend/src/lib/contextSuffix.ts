// Build a small system-prompt suffix that informs the assistant about the
// user's current composer-time choices: edit mode, creation mode, and any
// active Word selection. Designed to be appended to the existing system
// prompt so we don't bake these toggles into the static prompt text.

export interface ContextSuffixOpts {
  editMode?: "track" | "comments";
  creationMode?: "project" | "this_word_doc";
  selection?: { text: string; has_selection: boolean };
}

const WRITES_BLOCK_TEMPLATE = `\`\`\`json
{"writes":[{"at":"selection|end|after_selection","content_md":"..."}]}
\`\`\``;

export function buildContextSuffix(opts: ContextSuffixOpts): string {
  const sections: string[] = [];

  // Edit-mode hint
  if (opts.editMode === "comments") {
    sections.push(
      "EDIT MODE — COMMENTS:\n" +
        "When proposing changes to a Word document, the user prefers them as Word comments rather than tracked-text replacements. Phrase each `reason` as a complete, standalone explanation that makes sense as a sticky-note comment. Keep `find` accurate and `replace` minimal (often identical to `find` when the change is purely advisory).",
    );
  } else if (opts.editMode === "track") {
    sections.push(
      "EDIT MODE — TRACK CHANGES (Explainable):\n" +
        "Tracked changes are paired with a Word comment carrying the `reason`. Always populate `reason` with a brief (1 sentence) justification — it will appear as a comment alongside the redline so the reviewer sees both the edit and the rationale. Keep `reason` factual and specific to the change.",
    );
  }

  // Creation-mode hint
  if (opts.creationMode === "this_word_doc") {
    sections.push(
      "CREATION MODE — WRITE INTO CURRENT WORD DOCUMENT:\n" +
        "Do NOT call `generate_docx`. The user wants newly authored content inserted into their open Word document, not saved as a separate project file. End your response with a fenced JSON block of the form:\n" +
        WRITES_BLOCK_TEMPLATE +
        "\n" +
        "Pick `at` based on the user's wording:\n" +
        '- "insert here" / "at my cursor" → "selection"\n' +
        '- "after this paragraph" → "after_selection"\n' +
        '- "append" / "add at the end" / unclear → "end"\n' +
        "`content_md` is the new content in light markdown (paragraphs, headings via `#`/`##`, lists, basic `**bold**` and `*italic*`). Do not include a download URL — the client inserts directly into Word.",
    );
  } else if (opts.creationMode === "project") {
    sections.push(
      "CREATION MODE — NEW PROJECT DOCUMENT:\n" +
        "When the user asks for a new document, use `generate_docx` to create a separate file in their project (existing behavior).",
    );
  }

  // Selection-awareness hint
  if (opts.selection?.has_selection && opts.selection.text?.trim()) {
    const trimmed = opts.selection.text.trim();
    const preview = trimmed.length > 200
      ? trimmed.slice(0, 200) + "…"
      : trimmed;
    sections.push(
      "ACTIVE SELECTION:\n" +
        "The user has highlighted the following text in their Word document. Scope your edits or writes to this range — operate ONLY on this selection unless the user explicitly broadens the scope. Use the rest of the document for tone, style, and terminology consistency, but do not propose changes outside the selection.\n" +
        "---\n" +
        preview +
        "\n---",
    );
  }

  return sections.join("\n\n");
}
