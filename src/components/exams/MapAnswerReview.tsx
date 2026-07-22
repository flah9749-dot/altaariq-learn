import { MapPin, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Sub = { id: string; type: string; text: string; answer?: string; options?: any[]; points?: number };
type Point = { label: string; prompt?: string; x: number; y: number; questions?: Sub[] };

function normalize(s: any) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatSubAnswer(v: any, sq: Sub) {
  if (v == null || v === "") return "—";
  if (sq.type === "mcq") return sq.options?.[Number(v)]?.text ?? String(v);
  if (sq.type === "true_false") return String(v) === "true" ? "صح" : "خطأ";
  return String(v);
}

function formatSubCorrect(sq: Sub) {
  if (sq.type === "mcq") {
    const idx = (sq.options ?? []).findIndex((o: any) => o.is_correct);
    return idx >= 0 ? sq.options?.[idx]?.text ?? "—" : "—";
  }
  if (sq.type === "true_false") return normalize(sq.answer) === "true" ? "صح" : "خطأ";
  return String(sq.answer ?? "").trim() || "—";
}

function isSubCorrect(v: any, sq: Sub) {
  if (v == null || v === "") return false;
  if (sq.type === "mcq") {
    const idx = (sq.options ?? []).findIndex((o: any) => o.is_correct);
    return idx >= 0 && Number(v) === idx;
  }
  if (sq.type === "true_false") return normalize(v) === normalize(sq.answer);
  if (sq.type === "essay") return false; // manual grading only
  return normalize(v) === normalize(sq.answer);
}

export function MapAnswerReview({ question, answer }: { question: any; answer: any }) {
  const points: Point[] = Array.isArray(question?.correct_answer?.points)
    ? question.correct_answer.points
    : [];
  const labels: string[] = Array.isArray(answer?.labels) ? answer.labels : [];
  const items: Record<string, Record<string, any>> =
    answer?.items && typeof answer.items === "object" ? answer.items : {};

  if (!points.length) return <p className="text-sm text-muted-foreground">لا توجد نقاط على هذه الخريطة.</p>;

  return (
    <div className="space-y-3">
      {question?.image_url && (
        <div className="w-full overflow-auto rounded-lg border bg-muted p-2 text-center">
          <div className="relative inline-block max-w-full align-top">
            <img src={question.image_url} alt="خريطة السؤال" className="block max-h-[24rem] max-w-full" />
            {points.map((p, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-primary-foreground shadow"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {points.map((p, i) => {
          const subs = Array.isArray(p.questions) ? p.questions : [];
          const studentLabel = labels[i];
          return (
            <div key={i} className="rounded-lg border p-3 bg-background space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="w-8 justify-center shrink-0 mt-0.5">{i + 1}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    <MapPin className="inline h-3 w-3 ml-1 text-primary" />
                    {p.prompt?.trim() || (subs.length === 0 ? `اكتب اسم الموضع رقم ${i + 1}` : `الموقع رقم ${i + 1}`)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    الإجابة الصحيحة: <span className="font-semibold text-success">{p.label}</span>
                  </p>
                </div>
              </div>

              {subs.length === 0 ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded bg-muted/50">
                    <div className="text-[11px] text-muted-foreground mb-0.5">إجابة الطالب</div>
                    <div className="font-medium flex items-center gap-1">
                      {isSubCorrect(studentLabel, { id: "", type: "short", text: "", answer: p.label })
                        ? <Check className="h-3.5 w-3.5 text-success" />
                        : <X className="h-3.5 w-3.5 text-destructive" />}
                      {String(studentLabel ?? "").trim() || <span className="text-muted-foreground">لا إجابة</span>}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-success/5 border border-success/20">
                    <div className="text-[11px] text-muted-foreground mb-0.5">الصحيح</div>
                    <div className="font-medium">{p.label}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pr-3 border-r-2 border-primary/30">
                  {subs.map((sq, si) => {
                    const v = items[String(i)]?.[sq.id];
                    const correct = isSubCorrect(v, sq);
                    return (
                      <div key={sq.id} className="text-sm space-y-1">
                        <p className="text-xs">
                          <Badge variant="secondary" className="ml-1">س{si + 1}</Badge>
                          {sq.text || "سؤال"}
                          {sq.points ? <span className="text-[11px] text-muted-foreground mr-2">({sq.points} درجة)</span> : null}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded bg-muted/50">
                            <div className="text-[11px] text-muted-foreground mb-0.5">إجابة الطالب</div>
                            <div className="font-medium flex items-center gap-1">
                              {sq.type === "essay" ? null : correct
                                ? <Check className="h-3.5 w-3.5 text-success" />
                                : <X className="h-3.5 w-3.5 text-destructive" />}
                              <span className={sq.type === "essay" ? "" : correct ? "text-success" : "text-destructive"}>
                                {formatSubAnswer(v, sq)}
                              </span>
                            </div>
                          </div>
                          <div className="p-2 rounded bg-success/5 border border-success/20">
                            <div className="text-[11px] text-muted-foreground mb-0.5">الصحيح</div>
                            <div className="font-medium">{formatSubCorrect(sq)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
