import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { setAIFunctionProvider } from "@/lib/ai-management.functions";

export const Route = createFileRoute("/admin/ai/mapping")({
  head: () => ({ meta: [{ title: "ربط الوظائف بالمزودين" }] }),
  component: MappingPage,
});

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  claude: "Claude",
  groq: "Groq",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  openrouter: "OpenRouter",
};

function MappingPage() {
  const qc = useQueryClient();
  const saveFn = useServerFn(setAIFunctionProvider);

  const { data: mapping, isLoading } = useQuery({
    queryKey: ["ai-mapping"],
    queryFn: async () => (await supabase.from("ai_function_mapping").select("*").order("category")).data ?? [],
  });

  const { data: providers } = useQuery({
    queryKey: ["ai-providers-min"],
    queryFn: async () => (await supabase.from("ai_providers").select("slug, enabled").order("priority")).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async (v: { function_key: string; provider_slug: string }) =>
      saveFn({ data: { function_key: v.function_key, provider_slug: v.provider_slug as any } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-mapping"] }); toast.success("تم الحفظ"); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const grouped = (mapping ?? []).reduce<Record<string, any[]>>((acc, r: any) => {
    (acc[r.category] ??= []).push(r); return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Link2 className="h-5 w-5"/></span>
            ربط الوظائف بالمزودين
          </h1>
          <p className="text-sm text-muted-foreground mt-1">اختر المزود المناسب لكل وظيفة داخل المنصة — التغيير يُحفظ فوراً بدون تعديل الكود.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/ai"><ArrowRight className="h-4 w-4 ml-2"/>عودة لإدارة المزودين</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64"/>)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(grouped).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{cat}</span>
                  <Badge variant="secondary">{items.length} وظيفة</Badge>
                </CardTitle>
                <CardDescription>اختر مزوداً لكل وظيفة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((r: any) => (
                  <div key={r.function_key} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{r.function_name}</span>
                    <Select
                      value={r.provider_slug}
                      onValueChange={(v) => mut.mutate({ function_key: r.function_key, provider_slug: v })}
                    >
                      <SelectTrigger className="w-40 h-8"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {(providers ?? []).map((p: any) => (
                          <SelectItem key={p.slug} value={p.slug}>
                            {PROVIDER_LABELS[p.slug] ?? p.slug} {!p.enabled && "⚠️"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
