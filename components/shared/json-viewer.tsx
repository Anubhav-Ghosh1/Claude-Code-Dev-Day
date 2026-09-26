import type { ReactNode } from "react";

// Keys muted, strings bone, numbers/booleans accent. Built as React nodes (never
// innerHTML) because audit details contain agent-supplied text such as the gist.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null|-?\d+(?:\.\d+)?)\b/g;

function highlight(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of json.matchAll(TOKEN)) {
    const [whole, str, colon, lit] = m;
    const at = m.index ?? 0;
    if (at > last) out.push(json.slice(last, at));
    if (str && colon) {
      out.push(<span key={at} className="text-muted">{str}</span>, colon);
    } else if (str) {
      out.push(<span key={at} className="text-ink-2">{str}</span>);
    } else {
      out.push(<span key={at} className="text-accent">{lit}</span>);
    }
    last = at + whole.length;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

export function JsonViewer({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md border border-line bg-page p-3 font-mono text-[11.5px] leading-relaxed">
      {highlight(JSON.stringify(value, null, 2) ?? "")}
    </pre>
  );
}
