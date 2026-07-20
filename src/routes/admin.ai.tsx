import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Plus, Sparkles, KeyRound, Zap, Settings2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({ meta: [{ title: "الذكاء الاصطناعي — لوحة المدرس" }] }),
  component: AIPage,
});

const PROVIDERS = [
  { key: "gemini", name: "Google Gemini", desc: "Gemini 2.5 / 3.x — قوي ومتعدد الوسائط" },
  { key: "openai", name: "OpenAI", desc: "GPT-5 family — استدلال ودقة عالية" },
  { key: "claude", name: "Anthropic Claude", desc: "Claude — كتابة وتحليل ممتازين" },
  { key: "groq", name: "Groq", desc: "استجابات فائقة السرعة" },
  { key: "openrouter", name: "OpenRouter", desc: "بوابة لعشرات النماذج" },
  { key: "deepseek", name: "DeepSeek", desc: "نماذج مفتوحة وقوية" },
  { key: "mistral", name: "Mistral", desc: "نماذج أوروبية متوازنة" },
] as const;

const FUNCTIONS = [
  { key: "exam_generation", name: "توليد الامتحانات", icon: Sparkles },
  { key: "auto_grading", name: "التصحيح التلقائي", icon: Zap },
  { key: "student_chat", name: "شات الطلاب", icon: Bot },
  { key: "content_summary", name: "تلخيص المحتوى", icon: Settings2 },
];

function AIPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-providers-summary"],
    queryFn: async () => {
      const [providers, keys] = await Promise.all([
        supabase.from("ai_providers").select("id, name, enabled"),
        supabase.from("ai_api_keys").select("id, provider_id, enabled"),
      ]);
      return { providers: providers.data ?? [], keys: keys.data ?? [] };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Bot className="h-5 w-5"/></span>
            الذكاء الاصطناعي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة المزودين، المفاتيح، وربط كل وظيفة بمزود مختلف مع Fallback تلقائي.</p>
        </div>
        <Button className="gap-2" disabled><Plus className="h-4 w-4"/>إضافة مفتاح جديد</Button>
      </div>

      <Card className="bg-gradient-to-l from-primary/10 via-accent/5 to-transparent border-primary/20">
        <CardContent className="p-5 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5"/>
          <div className="text-sm">
            <p className="font-semibold">نظام متعدد المزودين مع Fallback</p>
            <p className="text-muted-foreground mt-1">
              يمكنك إضافة مفاتيح غير محدودة لكل مزود، وتحديد مزود مختلف لكل وظيفة داخل المنصة. عند فشل مزود، ينتقل النظام تلقائيًا للمزود التالي.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Providers grid */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">المزودون</h2>
          <Badge variant="secondary">{PROVIDERS.length} مزود</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36"/>)
            : PROVIDERS.map((p) => {
                const dbRow = data?.providers.find((r) => r.name?.toLowerCase() === p.key);
                const keysCount = data?.keys.filter((k) => k.provider_id === dbRow?.id).length ?? 0;
                const enabled = dbRow?.enabled ?? false;
                return (
                  <Card key={p.key} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{p.name}</CardTitle>
                          <CardDescription className="mt-1">{p.desc}</CardDescription>
                        </div>
                        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "مفعل" : "متوقف"}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <KeyRound className="h-4 w-4"/> {keysCount} مفتاح
                      </span>
                      <Button variant="outline" size="sm" disabled>إدارة</Button>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </section>

      {/* Functions mapping */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ربط الوظائف بالمزودين</h2>
        <Card>
          <CardContent className="p-0 divide-y">
            {FUNCTIONS.map((f) => (
              <div key={f.key} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-4 w-4"/></span>
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
                    <p className="text-xs text-muted-foreground">لم يتم الربط بعد</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>اختيار المزود</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">التفعيل الفعلي للمفاتيح والوظائف سيتم في مرحلة قادمة.</p>
      </section>
    </div>
  );
}
