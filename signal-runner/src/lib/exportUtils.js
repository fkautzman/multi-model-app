function slugifyPrompt(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "")
    .slice(0, 30);
}

export function generateFilename(promptText) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = slugifyPrompt(promptText) || "session";
  return `signal-runner-${ts}-${slug}.md`;
}

export function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Latest provider-reported model version across turns, or null. */
function latestReported(model, turns) {
  return (
    [...turns].reverse().map((t) => t.responses?.[model.id]?.model_reported).find(Boolean) ?? null
  );
}

export function buildModelExport(model, turns) {
  const timestamp = new Date().toISOString();
  const originalPrompt = turns[0]?.user || "";
  let md = `# Signal Runner — ${model.label}\n\n`;
  md += `**Model:** ${model.label}  \n`;
  md += `**Role:** ${model.role}  \n`;
  md += `**model_configured:** ${model.model}  \n`;
  md += `**model_reported:** ${latestReported(model, turns) ?? "—"}  \n`;
  md += `**Timestamp:** ${timestamp}  \n\n`;
  md += `---\n\n`;
  md += `## Original Prompt\n\n${originalPrompt}\n\n`;
  md += `---\n\n`;
  md += `## Response\n\n`;

  turns.forEach((turn, idx) => {
    const resp = turn.responses?.[model.id];
    if (turns.length > 1) {
      md += `### Turn ${idx + 1}\n\n`;
      md += `**Prompt:** ${turn.user}\n\n`;
    }
    if (resp?.content) {
      md += `${resp.content}\n\n`;
    } else if (resp?.error) {
      md += `> Error: ${resp.error}\n\n`;
    } else {
      md += `NO_RESPONSE (recorded ${timestamp})\n\n`;
    }
    if (idx < turns.length - 1) md += `---\n\n`;
  });

  return md;
}

export function buildSynthesisExport(synthLabel, content, originalPrompt) {
  const timestamp = new Date().toISOString();
  let md = `# Signal Runner — ${synthLabel}\n\n`;
  md += `**Type:** Synthesis  \n`;
  md += `**Timestamp:** ${timestamp}  \n\n`;
  md += `---\n\n`;
  md += `## Original Prompt\n\n${originalPrompt}\n\n`;
  md += `---\n\n`;
  md += `## ${synthLabel}\n\n${content}\n`;
  return md;
}

export function buildFullSessionExport(session, MODELS) {
  // Every pane gets a section every time. The list is the union of the models
  // enabled on the session and any model that recorded a response, so a pane
  // can never be named in the header and then silently omitted below — and a
  // response can never be dropped because the pane was toggled off afterwards.
  const turns = session.turns || [];
  // No recorded flags at all means we cannot know what was enabled — treat
  // every model as enabled rather than silently dropping panes.
  const flags = session.enabledModels;
  const hasFlags = flags && Object.keys(flags).length > 0;
  const isEnabled = (m) => (hasFlags ? Boolean(flags[m.id]) : true);
  const hasData = (m) => turns.some((t) => t.responses?.[m.id]);
  let modelList = MODELS.filter((m) => isEnabled(m) || hasData(m));
  if (modelList.length === 0) modelList = MODELS;

  const ts = new Date(session.createdAt).toISOString();
  const exportedAt = new Date().toISOString();
  const fmt = (t) => t || "*Not yet generated*";

  let md = `# Signal Runner — Full Session Export\n\n`;
  md += `**Session:** ${session.title}  \n`;
  md += `**Created:** ${ts}  \n`;
  md += `**Models:** ${modelList.map((m) => `${m.label} (${m.role})`).join(", ")}  \n\n`;
  md += `---\n\n`;

  session.turns.forEach((turn, idx) => {
    md += `## Turn ${idx + 1}\n\n`;
    md += `**Prompt:** ${turn.user}\n\n`;
    modelList.forEach((m) => {
      const resp = turn.responses?.[m.id];
      md += `### ${m.label} (${m.role})\n\n`;
      md += `**model_configured:** ${resp?.model_configured ?? m.model}  \n`;
      md += `**model_reported:** ${resp?.model_reported ?? "—"}  \n\n`;
      if (resp?.content) {
        md += `${resp.content}\n\n`;
      } else if (resp?.error) {
        md += `> Error: ${resp.error}\n\n`;
      } else {
        md += `NO_RESPONSE (recorded ${exportedAt})\n\n`;
      }
    });
    if (idx < session.turns.length - 1) md += `---\n\n`;
  });

  if (session.synthesis && Object.values(session.synthesis).some(Boolean)) {
    md += `---\n\n## Synthesis\n\n`;
    if (session.synthesis.disagree) md += `### Disagreements\n\n${fmt(session.synthesis.disagree)}\n\n`;
    if (session.synthesis.insights) md += `### Key Insights\n\n${fmt(session.synthesis.insights)}\n\n`;
    if (session.synthesis.actions) md += `### Action Items\n\n${fmt(session.synthesis.actions)}\n\n`;
  }

  return md;
}
