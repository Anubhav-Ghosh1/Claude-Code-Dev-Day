// Hand-built SVGs for the landing page. Monochrome ink with one semantic accent:
// green = granted, red = denied. Motion classes live in globals.css and are
// disabled under prefers-reduced-motion.

const INK = "#171717";
const LINE = "#d4d4d4";
const MUTED = "#a3a3a3";
const GRANTED = "#10b981";
const DENIED = "#ef4444";
const CLAUDE = "#d97757"; // Claude's coral — used only for the AI review
const CLAUDE_INK = "#b4532f";

export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1" y="1" width="18" height="18" rx="5" fill={INK} />
      <circle cx="10" cy="10" r="4.25" stroke="#fff" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1.25" fill={GRANTED} />
    </svg>
  );
}

/** Claude-style four-point sparkle, centred on (0,0). */
function Sparkle({ size = 6, fill = CLAUDE }: { size?: number; fill?: string }) {
  const k = size;
  const c = size * 0.18;
  return (
    <path
      d={`M0 ${-k} C${c} ${-c} ${c} ${-c} ${k} 0 C${c} ${c} ${c} ${c} 0 ${k} C${-c} ${c} ${-c} ${c} ${-k} 0 C${-c} ${-c} ${-c} ${-c} 0 ${-k}Z`}
      fill={fill}
    />
  );
}

/** A dot that travels along a path (CSS offset-path, so reduced-motion disables it). */
function Packet({ d, r = 3, fill, delay = 0, duration = 2.6 }: { d: string; r?: number; fill: string; delay?: number; duration?: number }) {
  return (
    <g className="packet" style={{ offsetPath: `path("${d}")`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }}>
      <circle r={r * 2.4} fill={fill} opacity="0.16" />
      <circle r={r} fill={fill} />
    </g>
  );
}

/** Hero: agent → three requests → the vault (policy + Claude) → two granted into a scoped, expiring token. */
export function AccessFlow() {
  const requests = [
    { y: 100, label: "s3:GetObject", granted: true },
    { y: 190, label: "s3:ListBucket", granted: true },
    { y: 280, label: "s3:DeleteObject", granted: false },
  ];
  const wire = (y: number) => `M132 190 C 192 190, 188 ${y}, 248 ${y}`;
  const exits = ["M276 100 C 334 100, 334 176, 392 176", "M276 190 C 334 190, 334 204, 392 204"];
  const ttlCircumference = 2 * Math.PI * 8;

  return (
    <svg viewBox="8 30 504 330" className="h-auto w-full" role="img" aria-labelledby="flow-title flow-desc">
      <title id="flow-title">How AgentVault scopes an agent&apos;s request</title>
      <desc id="flow-desc">
        A signed-in user&apos;s agent requests three S3 permissions. GetObject and ListBucket are issued in a 15-minute
        token. DeleteObject is outside the agent&apos;s limit and is blocked; Claude also flags it as unnecessary.
      </desc>
      <defs>
        <pattern id="flow-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#efefed" strokeWidth="1" />
        </pattern>
        <radialGradient id="flow-fade" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="flow-mask">
          <rect width="520" height="380" fill="url(#flow-fade)" />
        </mask>
        <linearGradient id="gate-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#0f0f0f" />
        </linearGradient>
        <linearGradient id="scan-beam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={CLAUDE} stopOpacity="0" />
          <stop offset="0.5" stopColor={CLAUDE} stopOpacity="0.55" />
          <stop offset="1" stopColor={CLAUDE} stopOpacity="0" />
        </linearGradient>
        <clipPath id="gate-clip">
          <rect x="248" y="62" width="28" height="256" rx="14" />
        </clipPath>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.06" />
        </filter>
      </defs>

      <rect y="20" width="520" height="350" fill="url(#flow-grid)" mask="url(#flow-mask)" />

      {/* request wires: agent → gate */}
      {requests.map((r) => (
        <path
          key={r.label}
          d={wire(r.y)}
          fill="none"
          stroke={r.granted ? MUTED : LINE}
          strokeWidth="1.25"
          strokeDasharray={r.granted ? undefined : "3 4"}
        />
      ))}
      {requests.map((r, i) => (
        <Packet key={`${r.label}-p`} d={wire(r.y)} r={2.6} fill={r.granted ? INK : MUTED} delay={i * 0.45} duration={2.2} />
      ))}

      {/* labels sit on the wire at the curve's midpoint (t = 0.5 → x 190, y 95 + y/2) */}
      {requests.map((r) => {
        const cy = 95 + r.y / 2;
        return (
          <g key={`${r.label}-t`}>
            <rect x="143" y={cy - 10} width="94" height="20" rx="10" fill="#fff" stroke={r.granted ? "#e5e5e5" : "#f0efed"} />
            <text x="190" y={cy + 3.5} textAnchor="middle" className="font-mono" fontSize="10" fill={r.granted ? "#404040" : MUTED}>
              {r.label}
            </text>
          </g>
        );
      })}

      {/* blocked request */}
      <g transform="translate(236 280)">
        <circle r="7" fill="#fff" stroke={DENIED} strokeWidth="1.25" />
        <path d="M-2.5 -2.5L2.5 2.5M2.5 -2.5L-2.5 2.5" stroke={DENIED} strokeWidth="1.25" strokeLinecap="round" />
      </g>

      {/* granted exits: gate → token */}
      {exits.map((d, i) => (
        <g key={d}>
          <path d={d} fill="none" stroke={GRANTED} strokeOpacity="0.22" strokeWidth="1.5" />
          <path className="flow-dash" d={d} fill="none" stroke={GRANTED} strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
          <Packet d={d} r={3.2} fill={GRANTED} delay={1 + i * 0.5} duration={1.8} />
        </g>
      ))}

      {/* Claude review: wired to the gate, flags the unneeded permission */}
      <path d="M276 280 C 288 280, 288 292, 300 292" fill="none" stroke={CLAUDE} strokeWidth="1.25" strokeDasharray="2 3" />
      <g filter="url(#soft)">
        <rect x="300" y="268" width="196" height="48" rx="12" fill="#fff" stroke="#f3d9cf" />
      </g>
      <g transform="translate(318 285)" className="sparkle-spin">
        <Sparkle size={6} />
      </g>
      <text x="332" y="288" fontSize="10.5" fontWeight="600" fill={CLAUDE_INK}>
        Claude review
      </text>
      <text x="318" y="305" fontSize="10" fill="#737373">
        DeleteObject isn&apos;t needed here
      </text>

      {/* the signed-in person the agent acts for */}
      <line x1="76" y1="134" x2="76" y2="162" stroke={LINE} strokeWidth="1.25" strokeDasharray="2 3" />
      <g filter="url(#soft)">
        <rect x="20" y="106" width="112" height="28" rx="14" fill="#fff" stroke="#e5e5e5" />
      </g>
      <circle cx="37" cy="120" r="7" fill="#f0efed" />
      <circle cx="37" cy="118" r="2.3" fill="#737373" />
      <path d="M32.8 124.2c.8-1.9 2.4-2.9 4.2-2.9s3.4 1 4.2 2.9" stroke="#737373" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <text x="50" y="123.5" fontSize="10.5" fill={INK}>
        arun · via CLI
      </text>

      {/* agent node, "thinking" */}
      <g filter="url(#soft)">
        <rect x="20" y="162" width="112" height="56" rx="12" fill="#fff" stroke="#e5e5e5" />
      </g>
      <text x="36" y="184" fontSize="9.5" letterSpacing="1.2" fill={MUTED}>
        AGENT
      </text>
      <text x="36" y="202" className="font-mono" fontSize="11.5" fill={INK}>
        s3-reader
      </text>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="think-dot" cx={104 + i * 7} cy="181" r="1.7" fill={INK} style={{ animationDelay: `${i * 0.18}s` }} />
      ))}

      {/* the vault gate, with an evaluation beam sweeping through */}
      <text x="262" y="48" textAnchor="middle" fontSize="11" fontWeight="500" fill="#525252">
        AgentVault
      </text>
      <rect x="248" y="62" width="28" height="256" rx="14" fill="url(#gate-fill)" />
      <g clipPath="url(#gate-clip)">
        <rect className="scan-beam" x="248" y="62" width="28" height="56" fill="url(#scan-beam)" />
      </g>
      <line x1="252.5" y1="76" x2="252.5" y2="304" stroke="#fff" strokeOpacity="0.08" />
      {requests.map((r) => (
        <circle key={`${r.label}-d`} cx="262" cy={r.y} r="3" fill={r.granted ? GRANTED : DENIED} />
      ))}
      <text x="262" y="342" textAnchor="middle" fontSize="10.5" fill={MUTED}>
        policy · Claude review
      </text>

      {/* scoped token */}
      <g filter="url(#soft)">
        <rect x="392" y="140" width="112" height="104" rx="12" fill="#fff" stroke="#e5e5e5" />
      </g>
      <text x="408" y="164" fontSize="9.5" letterSpacing="1.2" fill={MUTED}>
        TOKEN
      </text>
      <circle cx="486" cy="160.5" r="2.5" fill={GRANTED} className="live-dot" />
      <text x="408" y="184" className="font-mono" fontSize="10.5" fill={INK}>
        s3:GetObject
      </text>
      <text x="408" y="201" className="font-mono" fontSize="10.5" fill={INK}>
        s3:ListBucket
      </text>
      <line x1="408" y1="213" x2="488" y2="213" stroke="#f0efed" />
      <text x="408" y="230" fontSize="10.5" fill="#525252">
        expires 15m
      </text>
      {/* TTL ring: drains continuously */}
      <circle cx="480" cy="226" r="8" fill="none" stroke="#f0efed" strokeWidth="2" />
      <circle
        className="ttl-sweep"
        cx="480"
        cy="226"
        r="8"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={ttlCircumference}
        transform="rotate(-90 480 226)"
        style={{ ["--ttl-c" as string]: ttlCircumference }}
      />
    </svg>
  );
}

/** Step glyphs: 24px grid, 1.5 stroke, round joins. */
export function StepIcon({ step }: { step: "signin" | "declare" | "validate" | "issue" | "expire" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {step === "signin" && (
        <g {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M7.5 10l2.5 2-2.5 2M12 14.5h4" />
        </g>
      )}
      {step === "declare" && (
        <g {...common}>
          <path d="M6 3.5h8l4 4v13H6z" />
          <path d="M14 3.5v4h4" />
          <path d="M9 11.5h6M9 15h6M9 18.5h3" />
        </g>
      )}
      {step === "validate" && (
        <>
          <g {...common}>
            <path d="M12 3.5l7 2.8v5.4c0 4.3-3 7.5-7 8.8-4-1.3-7-4.5-7-8.8V6.3z" />
          </g>
          <g transform="translate(12 12)">
            <Sparkle size={4.2} />
          </g>
        </>
      )}
      {step === "issue" && (
        <g {...common}>
          <circle cx="8" cy="12" r="3.5" />
          <path d="M11.5 12h9M17 12v3M20.5 12v2" />
        </g>
      )}
      {step === "expire" && (
        <g {...common}>
          <circle cx="12" cy="12" r="8.5" strokeOpacity="0.3" />
          <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
          <path d="M12 7.5V12l3 2" />
        </g>
      )}
    </svg>
  );
}

/** Four linked blocks: each one carries the previous block's hash. */
export function HashChain() {
  const blocks = [
    { x: 12, seq: "#1042" },
    { x: 120, seq: "#1043" },
    { x: 228, seq: "#1044" },
    { x: 336, seq: "#1045", head: true },
  ];
  return (
    <svg viewBox="0 0 440 88" className="h-auto w-full" role="img" aria-label="Hash-chained audit entries">
      {blocks.slice(0, -1).map((b) => (
        <g key={`link-${b.seq}`}>
          <line x1={b.x + 92} y1="44" x2={b.x + 108} y2="44" stroke={LINE} strokeWidth="1.25" />
          <circle cx={b.x + 100} cy="44" r="2.25" fill={MUTED} />
        </g>
      ))}
      <Packet d="M104 44 H 336" r={2.5} fill={GRANTED} duration={3.2} />
      {blocks.map((b) => (
        <g key={b.seq}>
          {b.head && <rect className="chain-pulse" x={b.x - 3} y="17" width="98" height="54" rx="13" fill="none" stroke={GRANTED} strokeWidth="1" />}
          <rect x={b.x} y="20" width="92" height="48" rx="10" fill="#fff" stroke={b.head ? GRANTED : "#e7e5e4"} />
          <text x={b.x + 12} y="39" className="font-mono" fontSize="10.5" fill={b.head ? INK : MUTED}>
            {b.seq}
          </text>
          <rect x={b.x + 12} y="49" width="44" height="5" rx="2.5" fill="#ececea" />
          <rect x={b.x + 60} y="49" width="18" height="5" rx="2.5" fill={b.head ? GRANTED : "#dcdcd9"} fillOpacity={b.head ? 0.6 : 1} />
        </g>
      ))}
    </svg>
  );
}
