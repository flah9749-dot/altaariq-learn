import { BookOpen, Compass, Globe2 } from "lucide-react";

interface LogoProps { size?: number; showText?: boolean; className?: string; textClassName?: string; }

export function Logo({ size = 44, showText = true, className = "", textClassName = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} dir="rtl">
      <div
        className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-md shrink-0"
        style={{ width: size, height: size }}
      >
        <Globe2 className="text-gold" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.8} />
        <Compass
          className="absolute text-primary-foreground/90"
          style={{ width: size * 0.28, height: size * 0.28, bottom: size * 0.08, insetInlineEnd: size * 0.08 }}
          strokeWidth={2}
        />
        <BookOpen
          className="absolute text-gold"
          style={{ width: size * 0.24, height: size * 0.24, top: size * 0.08, insetInlineStart: size * 0.08 }}
          strokeWidth={2}
        />
      </div>
      {showText && (
        <div className={`flex flex-col leading-tight ${textClassName}`}>
          <span className="font-bold text-lg tracking-tight">الطارق التعليمية</span>
          <span className="text-xs text-muted-foreground">الدراسات الاجتماعية</span>
        </div>
      )}
    </div>
  );
}
