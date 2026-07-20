import { useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { bulkCreateStudents } from "@/lib/students.functions";
import { Loader2, Upload, FileDown } from "lucide-react";

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

const HEADERS = ["full_name", "code", "phone", "parent_name", "parent_phone", "parent_whatsapp"];

export function ImportStudentsDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const qc = useQueryClient();
  const bulk = useServerFn(bulkCreateStudents);

  const parse = (file: File) => {
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const clean = (res.data as any[]).filter((r) => r.full_name && r.code).map((r) => ({
          full_name: String(r.full_name).trim(),
          code: String(r.code).trim(),
          phone: r.phone?.toString().trim() || null,
          parent_name: r.parent_name?.toString().trim() || null,
          parent_phone: r.parent_phone?.toString().trim() || null,
          parent_whatsapp: r.parent_whatsapp?.toString().trim() || r.parent_phone?.toString().trim() || null,
        }));
        setRows(clean);
      },
    });
  };

  const importMut = useMutation({
    mutationFn: async () => bulk({ data: { students: rows } }),
    onSuccess: (res: any) => {
      toast.success(`تم استيراد ${res.created} طالب`, { description: res.errors.length ? `${res.errors.length} فشل` : undefined });
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false); setRows([]); setFileName("");
    },
    onError: (e: any) => toast.error(e?.message ?? "خطأ في الاستيراد"),
  });

  const downloadTemplate = () => {
    const csv = HEADERS.join(",") + "\n" + "أحمد محمد,STD-001,01000000000,ولي الأمر,01111111111,01111111111\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "students-template.csv"; a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>استيراد طلاب من CSV</DialogTitle>
          <DialogDescription>الأعمدة المطلوبة: {HEADERS.join("، ")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <FileDown className="h-4 w-4" />تحميل نموذج CSV
          </Button>
          <Input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} />
          {fileName && (
            <Alert>
              <AlertDescription>
                تم قراءة <b>{rows.length}</b> صف من الملف: {fileName}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => importMut.mutate()} disabled={!rows.length || importMut.isPending}>
            {importMut.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Upload className="h-4 w-4 ml-2" />}
            استيراد {rows.length ? `(${rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
