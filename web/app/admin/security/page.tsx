import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Database,
  FileText,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Status = 'complete' | 'next' | 'watch';

type Phase = {
  label: string;
  status: Status;
  detail: string;
};

type Finding = {
  item: string;
  status: Status;
  owner: string;
  evidence: string;
};

const phases: Phase[] = [
  {
    label: 'Locate admin data boundary',
    status: 'complete',
    detail: 'Admin data lives in your Supabase project under the public.aitea_* tables, isolated by RLS.',
  },
  {
    label: 'Audit RLS and grants',
    status: 'complete',
    detail: 'Checked table RLS, policies, role grants, views, and public routines through Supabase MCP.',
  },
  {
    label: 'Harden admin database access',
    status: 'complete',
    detail: 'Restricted internal admin tables to service-role access and left only intended public read surfaces selectable.',
  },
  {
    label: 'Harden app privilege boundaries',
    status: 'complete',
    detail: 'Fixed the Next proxy matcher export and auth-gated admin server actions before service-role client creation.',
  },
  {
    label: 'Verify build and behavior',
    status: 'complete',
    detail: 'Production build passes. MCP checks confirm public reads still work and internal reads/writes are denied.',
  },
  {
    label: 'Triage adjacent project risk',
    status: 'next',
    detail: 'Supabase advisor flagged public."aios-linkedin_vault_secrets" with RLS disabled; this is outside The Tool Printer admin but in the same DB.',
  },
];

const findings: Finding[] = [
  {
    item: 'All admin tables have RLS enabled',
    status: 'complete',
    owner: 'Database',
    evidence: 'MCP catalog check returned rls_enabled=true for every public.aitea_* table.',
  },
  {
    item: 'Internal admin telemetry tables were too open',
    status: 'complete',
    owner: 'Database',
    evidence: 'Replaced broad public policies on activity log, daily metrics, and people stats with service-role-only policies.',
  },
  {
    item: 'Anon/authenticated writes were over-granted',
    status: 'complete',
    owner: 'Database',
    evidence: 'Revoked write privileges on all public.aitea_* tables from anon and authenticated roles.',
  },
  {
    item: 'Admin proxy matcher export was wrong',
    status: 'complete',
    owner: 'App',
    evidence: 'Renamed proxyConfig to config in web/proxy.ts so Next detects the matcher.',
  },
  {
    item: 'Admin server actions used service role directly',
    status: 'complete',
    owner: 'App',
    evidence: 'Added checkAuth gate before admin actions create the service-role Supabase client.',
  },
  {
    item: 'Existing lint baseline has unrelated failures',
    status: 'watch',
    owner: 'App',
    evidence: 'Build passes, but eslint still fails on pre-existing React hooks and Link rules outside this security patch.',
  },
  {
    item: 'Adjacent vault table has RLS disabled',
    status: 'next',
    owner: 'Database',
    evidence: 'Supabase advisor flagged public."aios-linkedin_vault_secrets"; needs separate owner/policy decision.',
  },
];

const nextSteps = [
  'Decide whether to harden public."aios-linkedin_vault_secrets" now or split it into a separate AIOS cleanup task.',
  'Fix the existing eslint baseline so security changes can use lint as a clean gate.',
  'Consider adding a scheduled Supabase advisor review to catch future grant/RLS drift.',
  'Move the SQL in docs/sql/harden_aitea_rls.sql into formal migration history if this repo becomes the source of truth for DB changes.',
];

export default function SecurityDashboardPage() {
  const completeFindings = findings.filter((finding) => finding.status === 'complete').length;
  const progress = Math.round((completeFindings / findings.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            RLS, grants, admin auth boundaries, verification status, and follow-up work from the hardening pass.
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <ShieldCheck className="size-3.5" />
          {progress}% remediated
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<Database className="size-4" />} label="Database" value="Supabase" detail="public.aitea_* tables" />
        <MetricCard icon={<LockKeyhole className="size-4" />} label="Admin RLS" value="10 / 10" detail="tables enabled" />
        <MetricCard icon={<CheckCircle2 className="size-4" />} label="Findings fixed" value={`${completeFindings} / ${findings.length}`} detail="security checklist" />
        <MetricCard icon={<ClipboardCheck className="size-4" />} label="Build gate" value="Passing" detail="next build" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDot className="size-5" />
              Remediation phases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {phases.map((phase, index) => (
                <div key={phase.label} className="grid gap-3 rounded-md border p-4 md:grid-cols-[44px_180px_1fr]">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted font-mono text-sm">
                    {index + 1}
                  </div>
                  <div className="space-y-2">
                    <StatusBadge status={phase.status} />
                    <p className="font-medium leading-snug">{phase.label}</p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{phase.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              What’s next
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nextSteps.map((step, index) => (
                <div key={step} className="rounded-md border p-3">
                  <p className="text-xs font-mono text-muted-foreground">NEXT {index + 1}</p>
                  <p className="mt-1 text-sm leading-6">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Findings tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Finding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((finding) => (
                <TableRow key={finding.item}>
                  <TableCell className="min-w-[240px] font-medium whitespace-normal">{finding.item}</TableCell>
                  <TableCell>
                    <StatusBadge status={finding.status} />
                  </TableCell>
                  <TableCell>{finding.owner}</TableCell>
                  <TableCell className="max-w-[560px] whitespace-normal text-muted-foreground">{finding.evidence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'complete') {
    return (
      <Badge variant="default" className="gap-1 bg-emerald-600 text-white">
        <CheckCircle2 className="size-3" />
        Complete
      </Badge>
    );
  }

  if (status === 'next') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        Next
      </Badge>
    );
  }

  return <Badge variant="secondary">Watch</Badge>;
}
