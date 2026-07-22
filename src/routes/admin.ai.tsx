import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, KeyRound, CheckCircle2, XCircle, Loader2, Power, Zap, Settings2, ExternalLink, AlertCircle, Save, Trash2, Eye, EyeOff, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { testAIProvider, toggleAIProvider, setProviderPriority, checkAIKeysStatus, saveProviderKey, deleteProviderKey } from "@/lib/ai-management.functions";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({ meta: [{ title: "إدارة الذكاء الاصطناعي" }] }),
  component: AIManagementPage,
});

const PROVIDERS = [
  { slug: "lovable", name: "Lovable AI Gateway ⭐", secret: "LOVABLE_API_KEY", docs: "https://docs.lovable.dev/features/ai", desc: "المزود الافتراضي — Gemini + GPT بدون مفاتيح إضافية" },
  { slug: "gemini", name: "Google Gemini", secret: "GEMINI_API_KEY", docs: "https://aistudio.google.com/apikey", desc: "متعدد الوسائط — للامتحانات والمحتوى" },
  { slug: "openai", name: "OpenAI", secret: "OPENAI_API_KEY", docs: "https://platform.openai.com/api-keys", desc: "GPT — للتصحيح والتحليل والدردشة" },
  { slug: "claude", name: "Anthropic Claude", secret: "ANTHROPIC_API_KEY", docs: "https://console.anthropic.com/settings/keys", desc: "احتياطي أول — تحليل وكتابة" },
  { slug: "groq", name: "Groq", secret: "GROQ_API_KEY", docs: "https://console.groq.com/keys", desc: "استجابات فائقة السرعة" },
  { slug: "deepseek", name: "DeepSeek", secret: "DEEPSEEK_API_KEY", docs: "https://platform.deepseek.com/api_keys", desc: "احتياطي ثاني" },
  { slug: "mistral", name: "Mistral", secret: "MISTRAL_API_KEY", docs: "https://console.mistral.ai/api-keys/", desc: "احتياطي ثالث" },
  { slug: "openrouter", name: "OpenRouter", secret: "OPENROUTER_API_KEY", docs: "https://openrouter.ai/keys", desc: "بوابة احتياطية عامة" },
] as const;

function AIManagementPage() {
  const qc = useQueryClient();
  const testFn = useServerFn(testAIProvider);
  const toggleFn = useServerFn(toggleAIProvider);
  const priorityFn = useServerFn(setProviderPriority);
  const keyStatusFn = useServerFn(checkAIKeysStatus);
  const saveKeyFn = useServerFn(saveProviderKey);
  const deleteKeyFn = useServerFn(deleteProviderKey);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const { data: providers, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: async () => (await supabase.from("ai_providers").select("*").order("priority")).data ?? [],
  });

  const { data: keyStatus } = useQuery({
    queryKey: ["ai-keys-status"],
    queryFn: () => keyStatusFn(),
  });

  const { data: stats } = useQuery({
    queryKey: ["ai-usage-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await supabase.from("ai_usage_logs")
        .select("provider_id, success, latency_ms").gte("created_at", since);
      const by: Record<string, { total: number; errors: number; avg: number }> = {};
      (data ?? []).forEach((r: any) => {
        const k = r.provider_id ?? "unknown";
        by[k] ??= { total: 0, errors: 0, avg: 0 };
        by[k].total++;
        if (!r.success) by[k].errors++;
        if (r.latency_ms) by[k].avg = ((by[k].avg * (by[k].total - 1)) + r.latency_ms) / by[k].total;
      });
      return by;
    },
  });

  const testMut = useMutation({
    mutationFn: async (slug: string) => testFn({ data: { slug: slug as any } }),
    onSuccess: (r, slug) => {
      if (r.ok) toast.success(`✅ ${slug}: الاتصال ناجح (${r.latencyMs}ms)`);
      else toast.error(`❌ ${slug}: ${r.error}`);
      qc.invalidateQueries({ queryKey: ["ai-providers"] });
    },
  });

  const toggleMut = useMutation({
    mutationFn: async (v: { slug: string; enabled: boolean }) => toggleFn({ data: { slug: v.slug as any, enabled: v.enabled } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-providers"] }); toast.success("تم الحفظ"); },
  });

  const priorityMut = useMutation({
    mutationFn: async (v: { slug: string; priority: number }) => priorityFn({ data: { slug: v.slug as any, priority: v.priority } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-providers"] }); },
  });

  const saveKeyMut = useMutation({
    mutationFn: async (v: { slug: string; key: string }) => saveKeyFn({ data: { slug: v.slug as any, key: v.key } }),
    onSuccess: (_r, v) => {
      toast.success("✅ تم حفظ المفتاح");
      setEditing((s) => { const c = { ...s }; delete c[v.slug]; return c; });
      qc.invalidateQueries({ queryKey: ["ai-keys-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل حفظ المفتاح"),
  });

  const deleteKeyMut = useMutation({
    mutationFn: async (slug: string) => deleteKeyFn({ data: { slug: slug as any } }),
    onSuccess: () => {
      toast.success("تم حذف المفتاح المخصص");
      qc.invalidateQueries({ queryKey: ["ai-keys-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const missingKeys = PROVIDERS.filter(p => keyStatus && !keyStatus[p.slug]?.ok).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Bot className="h-5 w-5"/></span>
            إدارة الذكاء الاصطناعي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">حالة كل مزود، اختبار الاتصال، الأولوية، والتفعيل. المفاتيح محفوظة في Secrets فقط.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={testMut.isPending || !keyStatus}
            onClick={async () => {
              const targets = PROVIDERS.filter(p => keyStatus?.[p.slug]?.ok);
              if (!targets.length) { toast.error("لا يوجد مزود بمفتاح صالح"); return; }
              toast.info(`جاري اختبار ${targets.length} مزود...`);
              for (const t of targets) {
                await testMut.mutateAsync(t.slug);
              }
            }}
          >
            <Zap className="h-4 w-4"/>اختبار الكل
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/ai/mapping"><Settings2 className="h-4 w-4"/>ربط الوظائف بالمزودين</Link>
          </Button>
        </div>
      </div>



      {missingKeys > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"/>
            <div className="text-sm">
              <p className="font-semibold">يوجد {missingKeys} مزود بدون مفتاح API</p>
              <p className="text-muted-foreground mt-1">أضف المفتاح من زر "إضافة مفتاح" أمام كل مزود، وسيتم اختباره مباشرة.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-64"/>)
          : PROVIDERS.map((meta) => {
              const row = providers?.find(p => p.slug === meta.slug) as any;
              const ks = keyStatus?.[meta.slug];
              const hasKey = ks?.ok ?? false;
              const isFromDb = ks?.db ?? false;
              const stat = row && stats?.[row.id];
              const testing = testMut.isPending && testMut.variables === meta.slug;
              const statusColor = row?.test_status === "ok" ? "text-green-600" : row?.test_status === "fail" ? "text-red-600" : "text-muted-foreground";

              return (
                <Card key={meta.slug} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {meta.name}
                          {hasKey ? <CheckCircle2 className="h-4 w-4 text-green-600"/> : <XCircle className="h-4 w-4 text-muted-foreground"/>}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">{meta.desc}</CardDescription>
                      </div>
                      <Switch
                        checked={row?.enabled ?? false}
                        disabled={!hasKey}
                        onCheckedChange={(v) => toggleMut.mutate({ slug: meta.slug, enabled: v })}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="text-muted-foreground">الحالة</div>
                        <div className={`font-semibold ${statusColor}`}>
                          {row?.test_status === "ok" ? "متصل" : row?.test_status === "fail" ? "فشل" : "لم يُختبر"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="text-muted-foreground">زمن الاستجابة</div>
                        <div className="font-semibold">{row?.avg_latency_ms ? `${row.avg_latency_ms}ms` : "—"}</div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="text-muted-foreground">الطلبات (7ي)</div>
                        <div className="font-semibold">{stat?.total ?? 0}</div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="text-muted-foreground">الأخطاء</div>
                        <div className="font-semibold text-red-600">{stat?.errors ?? 0}</div>
                      </div>
                    </div>

                    {row?.test_error && (
                      <div className="rounded-lg bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
                        {row.test_error}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">الأولوية:</span>
                      <Input
                        type="number" min={1} max={20}
                        defaultValue={row?.priority ?? 99}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value);
                          if (v && v !== row?.priority) priorityMut.mutate({ slug: meta.slug, priority: v });
                        }}
                        className="h-7 w-16"
                      />
                      <span className="text-muted-foreground">Secret:</span>
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{meta.secret}</code>
                    </div>
                  </CardContent>
                  <div className="p-3 pt-0 flex items-center gap-2 border-t mt-2">
                    <Button
                      size="sm" variant="outline" className="flex-1 gap-1"
                      disabled={!hasKey || testing}
                      onClick={() => testMut.mutate(meta.slug)}
                    >
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Zap className="h-3.5 w-3.5"/>}
                      اختبار
                    </Button>
                    <Button size="sm" variant="ghost" asChild className="gap-1">
                      <a href={meta.docs} target="_blank" rel="noreferrer">
                        <KeyRound className="h-3.5 w-3.5"/>الحصول على مفتاح<ExternalLink className="h-3 w-3"/>
                      </a>
                    </Button>
                  </div>
                </Card>
              );
            })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Power className="h-4 w-4"/>ترتيب الـ Fallback</CardTitle>
          <CardDescription>عند فشل مزود يتم الانتقال تلقائياً للمزود التالي حسب الأولوية.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(providers ?? []).filter((p: any) => p.enabled).map((p: any, i: number) => (
              <div key={p.slug} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">←</span>}
                <Badge variant="secondary" className="gap-1">
                  <span className="text-[10px] opacity-60">{p.priority}</span>
                  {PROVIDERS.find(x => x.slug === p.slug)?.name ?? p.slug}
                </Badge>
              </div>
            ))}
            {!providers?.some((p: any) => p.enabled) && (
              <span className="text-muted-foreground">لا يوجد مزود مفعل — أضف مفتاحاً وفعّل المزود.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
