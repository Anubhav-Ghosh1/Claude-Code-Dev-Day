// Raw hex for Recharts (it can't read CSS vars in every prop). Mirrors globals.css.
export const C = {
  granted: "#0ca30c", // status: good
  denied: "#d03b3b", // status: critical
  s1: "#3987e5", // categorical slot 1
  s2: "#d95926", // categorical slot 2
  surface: "#1a1a19",
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  ink2: "#c3c2b7",
};

export const axisProps = {
  stroke: C.axis,
  tickLine: false,
  axisLine: { stroke: C.axis },
  tick: { fill: C.muted, fontSize: 11 },
} as const;
