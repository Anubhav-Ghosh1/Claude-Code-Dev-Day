export function JsonViewer({ value }: { value: unknown }) {
  const json = JSON.stringify(value, null, 2);
  // light-touch highlighting: keys muted, strings bone, numbers/bools accent
  const html = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null|-?\d+(?:\.\d+)?)\b/g, (m, str, colon, lit) => {
      if (str && colon) return `<span class="text-muted">${str}</span>${colon}`;
      if (str) return `<span class="text-ink-2">${str}</span>`;
      return `<span class="text-accent">${lit}</span>`;
    });
  return (
    <pre
      className="max-h-80 overflow-auto rounded-md border border-line bg-page p-3 font-mono text-[11.5px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
