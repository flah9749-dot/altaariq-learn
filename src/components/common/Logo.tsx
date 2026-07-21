import appIcon from "@/assets/app-icon.png";

interface LogoProps { size?: number; showText?: boolean; className?: string; textClassName?: string; }

export function Logo({ size = 44, showText = true, className = "", textClassName = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} dir="rtl">
      <img
        src={appIcon}
        alt="الطارق التعليمية"
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-2xl shadow-md"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className={`flex flex-col leading-tight ${textClassName}`}>
          <span className="font-bold text-lg tracking-tight">الطارق التعليمية</span>
          <span className="text-xs text-muted-foreground">الدراسات الاجتماعية</span>
        </div>
      )}
    </div>
  );
}
