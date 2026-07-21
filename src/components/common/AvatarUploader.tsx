import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  table: "students" | "admins";
  rowId: string;
  currentUrl: string | null | undefined;
  fallback?: string;
  onChange?: (url: string | null) => void;
  size?: number;
}

export function AvatarUploader({ table, rowId, currentUrl, fallback = "؟", onChange, size = 96 }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("اختر ملف صورة");
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5 ميجا");
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("يجب تسجيل الدخول");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? null;
      const { error: dbErr } = await supabase.from(table).update({ avatar_url: url }).eq("id", rowId);
      if (dbErr) throw new Error(dbErr.message);
      setPreview(url);
      onChange?.(url);
      toast.success("تم تحديث الصورة");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الرفع");
    } finally { setBusy(false); }
  }

  async function removeAvatar() {
    if (!confirm("حذف الصورة الحالية؟")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from(table).update({ avatar_url: null }).eq("id", rowId);
      if (error) throw new Error(error.message);
      setPreview(null);
      onChange?.(null);
      toast.success("تم الحذف");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحذف");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar style={{ width: size, height: size }}>
          <AvatarImage src={preview ?? undefined} />
          <AvatarFallback className="text-xl">{fallback.slice(0, 1)}</AvatarFallback>
        </Avatar>
        {busy && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Camera className="h-4 w-4 ml-1" /> تغيير الصورة
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={busy}>
            <Trash2 className="h-4 w-4 ml-1 text-destructive" /> حذف
          </Button>
        )}
      </div>
    </div>
  );
}
