import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Upload, Trash2, RefreshCw, Loader2, Search, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { extractPages, DOC_TYPE_LABELS } from "@/lib/kb-extract";
import {
  listKbDocuments, ingestKbDocument, deleteKbDocument, reindexKbDocument, previewKbSearch, kbStats, ocrKbPages,
} from "@/lib/kb.functions";

const MAX_UPLOAD_MB = 200;
const ACCEPT = ".pdf,.docx,.txt,.md,.csv,image/*";


export const Route = createFileRoute("/admin/ai/knowledge")({
  head: () => ({
    meta: [
      { title: "قاعدة المعرفة | الطارق التعليمية" },
      { name: "description", content: "رفع وفهرسة محتوى المنهج ليعتمد عليه المساعد الذكي في إجاباته." },
      { property: "og:title", content: "قاعدة المعرفة — الطارق التعليمية" },
      { property: "og:description", content: "فهرسة كتب ومذكرات الدراسات الاجتماعية للبحث الدلالي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

const DOC_TYPES = ["book", "notes", "question_bank", "revision", "exam"] as const;

function KnowledgePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKbDocuments);
  const ingestFn = useServerFn(ingestKbDocument);
  const deleteFn = useServerFn(deleteKbDocument);
  const reindexFn = useServerFn(reindexKbDocument);
  const searchFn = useServerFn(previewKbSearch);
  const statsFn = useServerFn(kbStats);
  const ocrFn = useServerFn(ocrKbPages);

  const runOcr = async (images: { page: number; dataUrl: string }[]) => {
    const r = await ocrFn({ data: { images } });
    return (r as any).pages as { page: number; text: string }[];
  };


  const fileRef = useRef<HTMLInputElement>(null);
  const reindexRef = useRef<HTMLInputElement>(null);
  const [reindexId, setReindexId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("book");
  const [classId, setClassId] = useState<string>("none");
  const [term, setTerm] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [query, setQuery] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["kb-documents"],
    queryFn: () => listFn({ data: {} as any }),
  });

  const { data: stats } = useQuery({
    queryKey: ["kb-stats"],
    queryFn: () => statsFn({ data: {} as any }),
  });

  const searchMut = useMutation({
    mutationFn: () => searchFn({ data: { question: query, classId: classId === "none" ? null : classId } }),
    onError: (e: any) => toast.error(e?.message ?? "فشل البحث"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { documentId: id } }),
    onSuccess: () => {
      toast.success("تم حذف المستند");
      qc.invalidateQueries({ queryKey: ["kb-documents"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  function checkSize(file: File) {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_MB} ميجابايت`);
      return false;
    }
    return true;
  }

  async function handleUpload(file: File) {
    if (!checkSize(file)) return;
    setProgress(0);
    setBusyLabel("جاري استخراج النص...");
    try {
      const pages = await extractPages(
        file,
        (p) => {
          setProgress(Math.round(p * 0.5));
          if (p > 40) setBusyLabel("قراءة الصفحات المصوّرة بالذكاء الاصطناعي...");
        },
        runOcr,
      );
      setBusyLabel("جاري الفهرسة الدلالية...");
      setProgress(60);
      const res = await ingestFn({
        data: {
          title: file.name.replace(/\.[^.]+$/, ""),
          docType: docType as any,
          classId: classId === "none" ? null : classId,
          term: term.trim() || null,
          mimeType: file.type || null,
          pages,
        },
      });
      setProgress(100);
      toast.success(`تمت فهرسة ${res.chunks} مقطعاً من ${res.pages} صفحة`);
      qc.invalidateQueries({ queryKey: ["kb-documents"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت الفهرسة");
    } finally {
      setProgress(null);
      setBusyLabel("");
    }
  }

  async function handleReindex(file: File, documentId: string) {
    if (!checkSize(file)) return;
    setProgress(0);
    setBusyLabel("إعادة الفهرسة...");
    try {
      const pages = await extractPages(file, (p) => setProgress(Math.round(p * 0.5)), runOcr);
      setProgress(60);
      const res = await reindexFn({ data: { documentId, pages } });
      toast.success(`تمت إعادة فهرسة ${res.chunks} مقطعاً`);
      qc.invalidateQueries({ queryKey: ["kb-documents"] });
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت إعادة الفهرسة");
    } finally {
      setProgress(null);
      setBusyLabel("");
      setReindexId(null);
    }
  }


  const docs = (data?.documents ?? []) as any[];
  const hits = searchMut.data?.hits ?? [];
  const busy = progress !== null;

  const totals = useMemo(() => ({
    ready: docs.filter((d) => d.status === "ready").length,
    failed: docs.filter((d) => d.status === "failed").length,
  }), [docs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          قاعدة المعرفة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ارفع كتب الوزارة والمذكرات وبنوك الأسئلة — يفهرسها النظام دلالياً ليجيب المساعد من منهجك أنت.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatBox label="المستندات" value={stats?.documents ?? 0} />
        <StatBox label="المقاطع المفهرسة" value={stats?.chunks ?? 0} />
        <StatBox label="جاهزة" value={totals.ready} />
        <StatBox label="فشلت" value={totals.failed} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />رفع مستند جديد</CardTitle>
          <CardDescription>PDF أو Word أو ملف نصي. يُستخرج النص في المتصفح ثم يُفهرس على الخادم.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">طريقة المعالجة</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">الصف الدراسي</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="كل الصفوف" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">كل الصفوف</SelectItem>
                  {(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">الترم (اختياري)</label>
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="الترم الأول" />
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleUpload(f);
            }}
          />
          <input
            ref={reindexRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              const id = reindexId;
              e.target.value = "";
              if (f && id) void handleReindex(f, id);
            }}
          />

          <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? busyLabel : "اختيار ملف وفهرسته"}
          </Button>
          {busy && <Progress value={progress ?? 0} className="h-2" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" />تجربة البحث الدلالي</CardTitle>
          <CardDescription>اكتب سؤالاً كما يكتبه الطالب وشاهد المقاطع التي سيعتمد عليها المساعد.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="مثال: ما أسباب قيام ثورة 1919؟" />
            <Button onClick={() => searchMut.mutate()} disabled={query.trim().length < 3 || searchMut.isPending}>
              {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "بحث"}
            </Button>
          </div>
          {hits.length > 0 && (
            <div className="space-y-2">
              {hits.map((h: any) => (
                <div key={h.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Badge variant="secondary">{Math.round(h.similarity * 100)}%</Badge>
                    <span>{h.title}</span>
                    {h.unit && <span>• {h.unit}</span>}
                    {h.lesson && <span>• {h.lesson}</span>}
                    {h.pageNumber && <span>• صفحة {h.pageNumber}</span>}
                  </div>
                  <p className="line-clamp-3 leading-relaxed">{h.content}</p>
                </div>
              ))}
            </div>
          )}
          {searchMut.isSuccess && hits.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد مقاطع مطابقة — ارفع محتوى المنهج أولاً.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />المستندات المفهرسة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
          {!isLoading && docs.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد مستندات بعد.</p>
          )}
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {d.status === "ready"
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : d.status === "failed"
                      ? <AlertTriangle className="h-4 w-4 text-red-600" />
                      : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <span className="truncate">{d.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</Badge>
                  <span>{d.classes?.name ?? "كل الصفوف"}</span>
                  <span>• {d.chunk_count} مقطع</span>
                  {d.page_count ? <span>• {d.page_count} صفحة</span> : null}
                </div>
                {d.error && <p className="mt-1 text-xs text-red-600">{d.error}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm" variant="outline" className="gap-1" disabled={busy}
                  onClick={() => { setReindexId(d.id); reindexRef.current?.click(); }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />إعادة فهرسة
                </Button>
                <Button
                  size="sm" variant="outline" className="gap-1"
                  disabled={removeMut.isPending}
                  onClick={() => { if (confirm("حذف المستند وكل مقاطعه؟")) removeMut.mutate(d.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />حذف
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${tone === "danger" && value > 0 ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}
