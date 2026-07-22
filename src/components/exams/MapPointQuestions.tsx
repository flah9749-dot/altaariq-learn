import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MAP_SUB_QUESTION_TYPES,
  makeMapSubQuestion,
  type MapSubQuestion,
  type MapSubQuestionType,
} from "@/lib/exam-utils";

export function MapPointQuestions({
  value,
  onChange,
}: {
  value: MapSubQuestion[];
  onChange: (next: MapSubQuestion[]) => void;
}) {
  const [open, setOpen] = useState<boolean>(value.length > 0);
  const update = (idx: number, patch: Partial<MapSubQuestion>) =>
    onChange(value.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  const add = (type: MapSubQuestionType) => {
    onChange([...value, makeMapSubQuestion(type)]);
    setOpen(true);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span>
          {open ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />}
          أسئلة فرعية لهذا الرقم ({value.length})
        </span>
      </button>

      {open && (
        <div className="space-y-2">
          {value.map((sq, i) => (
            <div key={sq.id} className="rounded border bg-background p-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">س{i + 1}</Badge>
                <Select
                  value={sq.type}
                  onValueChange={(v) =>
                    update(i, { ...makeMapSubQuestion(v as MapSubQuestionType), text: sq.text, points: sq.points })
                  }
                >
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAP_SUB_QUESTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 text-xs">
                  <Label>درجة:</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={sq.points}
                    onChange={(e) => update(i, { points: Number(e.target.value) })}
                    className="w-16 h-8"
                  />
                </div>
                <Button size="icon" variant="ghost" className="mr-auto" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <Textarea
                placeholder="نص السؤال..."
                value={sq.text}
                onChange={(e) => update(i, { text: e.target.value })}
                rows={2}
              />

              {sq.type === "mcq" && (
                <div className="space-y-1">
                  {(sq.options ?? []).map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Switch
                        checked={o.is_correct}
                        onCheckedChange={(v) =>
                          update(i, {
                            options: (sq.options ?? []).map((x, xi) => ({
                              ...x,
                              is_correct: xi === oi ? v : v ? false : x.is_correct,
                            })),
                          })
                        }
                      />
                      <Input
                        value={o.text}
                        placeholder={`الاختيار ${oi + 1}`}
                        onChange={(e) =>
                          update(i, {
                            options: (sq.options ?? []).map((x, xi) => (xi === oi ? { ...x, text: e.target.value } : x)),
                          })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          update(i, { options: (sq.options ?? []).filter((_, xi) => xi !== oi) })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update(i, { options: [...(sq.options ?? []), { text: "", is_correct: false }] })
                    }
                  >
                    <Plus className="h-3 w-3 ml-1" />إضافة اختيار
                  </Button>
                </div>
              )}

              {sq.type === "true_false" && (
                <Select value={String(sq.answer ?? "true")} onValueChange={(v) => update(i, { answer: v })}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">صح</SelectItem>
                    <SelectItem value="false">خطأ</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {(sq.type === "short" || sq.type === "complete") && (
                <Input
                  placeholder="الإجابة الصحيحة"
                  value={sq.answer ?? ""}
                  onChange={(e) => update(i, { answer: e.target.value })}
                />
              )}

              {sq.type === "essay" && (
                <p className="text-xs text-muted-foreground">
                  سؤال مقالي — يُصحح يدويًا بعد التسليم.
                </p>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-1 pt-1 border-t">
            <span className="text-xs text-muted-foreground self-center">أضف:</span>
            {MAP_SUB_QUESTION_TYPES.map((t) => (
              <Button key={t.value} size="sm" variant="outline" onClick={() => add(t.value)}>
                <Plus className="h-3 w-3 ml-1" />{t.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
