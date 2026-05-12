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

export function buildModelExport(model, turns) {
  const timestamp = new Date().toISOString();
  const originalPrompt = turns[0]?.user || "";
  let md = `# Signal Runner — ${model.label}\n\n`;
  md += `**Model:** ${model.label}  \n`;
  md += `**Role:** ${model.role}  \n`;
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
      md += `*No response*\n\n`;
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
  const enabledModelList = MODELS.filter((m) => (session.enabledModels || {})[m.id]);
  const ts = new Date(session.createdAt).toISOString();
  const fmt = (t) => t || "*Not yet generated*";

  let md = `# Signal Runner — Full Session Export\n\n`;
  md += `**Session:** ${session.title}  \n`;
  md += `**Created:** ${ts}  \n`;
  md += `**Models:** ${enabledModelList.map((m) => `${m.label} (${m.role})`).join(", ")}  \n\n`;
  md += `---\n\n`;

  session.turns.forEach((turn, idx) => {
    md += `## Turn ${idx + 1}\n\n`;
    md += `**Prompt:** ${turn.user}\n\n`;
    enabledModelList.forEach((m) => {
      const resp = turn.responses?.[m.id];
      if (resp?.content) {
        md += `### ${m.label} (${m.role})\n\n${resp.content}\n\n`;
      } else if (resp?.error) {
        md += `### ${m.label} (${m.role})\n\n> Error: ${resp.error}\n\n`;
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
