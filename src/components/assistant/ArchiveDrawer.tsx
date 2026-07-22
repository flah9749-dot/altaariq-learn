import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Archive, MessageSquare, Trash2, Pencil, Check, X } from "lucide-react";
import {
  loadSessions,
  deleteSession,
  renameSession,
  clearAll,
  type ArchivedSession,
} from "@/lib/assistant-archive";

type Props = {
  scope: "admin" | "student";
  userId: string | null | undefined;
  activeId: string | null;
  onOpenSession: (s: ArchivedSession) => void;
  refreshKey?: number;
};

function formatWhen(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}

export function ArchiveDrawer({ scope, userId, activeId, onOpenSession, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const reload = () => setSessions(loadSessions(scope, userId));

  useEffect(() => {
    if (open) reload();
  }, [open, userId, scope, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Archive className="h-4 w-4 ml-1" />
          الأرشيف
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              أرشيف المحادثات
            </span>
            {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("حذف كل المحادثات المؤرشفة؟")) {
                    clearAll(scope, userId);
                    reload();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 ml-1" /> مسح الكل
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)] pl-1">
          {sessions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              لا توجد محادثات محفوظة بعد.
              <p className="mt-2 text-xs">تُحفظ محادثاتك تلقائياً بعد أول رد.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeId;
              const isEditing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 transition ${
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      className="flex-1 text-right"
                      onClick={() => {
                        if (isEditing) return;
                        onOpenSession(s);
                        setOpen(false);
                      }}
                    >
                      {isEditing ? (
                        <input
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full bg-background border rounded px-2 py-1 text-sm"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{s.title}</span>
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-muted-foreground flex gap-2">
                        <span>{s.messages.length} رسالة</span>
                        <span>•</span>
                        <span>{formatWhen(s.updatedAt)}</span>
                      </div>
                    </button>
                    <div className="flex flex-col gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              renameSession(scope, userId, s.id, editVal);
                              setEditingId(null);
                              reload();
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(s.id);
                              setEditVal(s.title);
                            }}
                            aria-label="إعادة تسمية"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm("حذف هذه المحادثة؟")) {
                                deleteSession(scope, userId, s.id);
                                reload();
                              }
                            }}
                            aria-label="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
