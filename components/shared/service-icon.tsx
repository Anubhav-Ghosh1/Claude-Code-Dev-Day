import { Activity, Box, Cpu, Database, KeyRound, ScrollText, Server, Shield, Workflow, Zap } from "lucide-react";

const ICONS: Record<string, typeof Box> = {
  s3: Database,
  dynamodb: Server,
  lambda: Zap,
  iam: KeyRound,
  sts: Shield,
  logs: ScrollText,
  cloudwatch: Activity,
  ec2: Cpu,
  glue: Workflow,
};

export function ServiceIcon({ service, size = 14 }: { service: string; size?: number }) {
  const Icon = ICONS[service] ?? Box;
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-line bg-page text-ink-2" title={service}>
      <Icon size={size} />
    </span>
  );
}
