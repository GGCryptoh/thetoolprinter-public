import { Bot, CheckCircle2, KeyRound, RadioTower, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createServiceClient } from '@/lib/supabase/server';
import {
  AI_PROVIDERS,
  type AiProvider,
  type AiProviderConfig,
  normalizeModelCatalog,
} from '@/lib/ai/provider-config';
import { saveAiProviderKey, refreshAiProviderModels, selectAiProviderModel } from '../actions';

export default async function AiProvidersPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[]; saved?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const saved = Array.isArray(params?.saved) ? params?.saved[0] : params?.saved;
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('aitea_ai_provider_configs')
    .select('provider, vault_secret_id, selected_model, active_for_scoring, model_catalog, last_checked_at, updated_at')
    .order('provider', { ascending: true });

  const configs = new Map(
    ((data ?? []) as AiProviderConfig[]).map((config) => [
      config.provider,
      {
        ...config,
        model_catalog: normalizeModelCatalog(config.provider, config.model_catalog),
      },
    ])
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Store provider keys in Supabase Vault, fetch each provider&apos;s available model list,
            and choose the model the scoring pipeline should use.
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <KeyRound className="size-3.5" />
          Vault backed
        </Badge>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          Provider settings saved.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {AI_PROVIDERS.map((provider) => {
          const config = configs.get(provider.id);
          return (
            <ProviderCard
              key={provider.id}
              id={provider.id}
              label={provider.label}
              keyHint={provider.keyHint}
              config={config}
            />
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RadioTower className="size-4" />
            Runtime note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
          <p>
            Keys entered here stay server-side and are stored through Supabase Vault. The app uses them
            to validate access and enumerate models without printing or rendering the key again.
          </p>
          <p>
            Scoring calls still go through Vercel AI Gateway using the selected model ID. To spend a
            provider key through Vercel at runtime, add the key or paid Gateway access in Vercel for
            this project, then redeploy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderCard({
  id,
  label,
  keyHint,
  config,
}: {
  id: AiProvider;
  label: string;
  keyHint: string;
  config?: AiProviderConfig;
}) {
  const hasKey = Boolean(config?.vault_secret_id);
  const models = config?.model_catalog ?? [];
  const selectedModel = config?.selected_model ?? '';

  return (
    <Card className={config?.active_for_scoring ? 'border-emerald-500/50' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Bot className="size-4" />
            {label}
          </span>
          <Badge variant={hasKey ? 'default' : 'secondary'}>{hasKey ? 'Key stored' : 'No key'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={saveAiProviderKey} className="space-y-3">
          <input type="hidden" name="provider" value={id} />
          <div className="space-y-2">
            <Label htmlFor={`${id}-key`}>API key</Label>
            <Input
              id={`${id}-key`}
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={hasKey ? 'Paste new key to rotate' : keyHint}
              required={!hasKey}
            />
          </div>
          <Button type="submit" size="sm" className="w-full">
            <KeyRound className="mr-2 size-3.5" />
            Save and fetch models
          </Button>
        </form>

        <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Models</span>
            <Badge variant="outline">{models.length}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Active</span>
            {config?.active_for_scoring ? (
              <Badge className="gap-1 bg-emerald-600 text-white">
                <CheckCircle2 className="size-3" />
                Scoring
              </Badge>
            ) : (
              <Badge variant="secondary">Standby</Badge>
            )}
          </div>
          <p className="break-words font-mono text-xs text-muted-foreground">
            {selectedModel || 'No model selected'}
          </p>
          {config?.last_checked_at && (
            <p className="text-xs text-muted-foreground">
              Checked {new Date(config.last_checked_at).toLocaleString()}
            </p>
          )}
        </div>

        {models.length > 0 && (
          <form action={selectAiProviderModel} className="space-y-3">
            <input type="hidden" name="provider" value={id} />
            <div className="space-y-2">
              <Label htmlFor={`${id}-model`}>Scoring model</Label>
              <select
                id={`${id}-model`}
                name="model"
                defaultValue={selectedModel}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {models.map((model) => (
                  <option key={model.gatewayModelId} value={model.gatewayModelId}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline" className="w-full">
              Use for scoring
            </Button>
          </form>
        )}

        {hasKey && (
          <form action={refreshAiProviderModels.bind(null, id)}>
            <Button type="submit" size="sm" variant="ghost" className="w-full">
              <RefreshCw className="mr-2 size-3.5" />
              Refresh model list
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
