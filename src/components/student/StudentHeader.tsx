import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, FileText, MessageSquare, Award, LogOut, Star, Trophy, Sparkles, FolderOpen } from "lucide-react";

import { Logo } from "@/components/common/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { InstallAppButton } from "@/components/common/InstallAppButton";
import { useAuth } from "@/lib/auth-context";

const nav = [
  { title: "الرئيسية", url: "/student/dashboard", icon: Home },
  { title: "المساعد", url: "/student/assistant", icon: Sparkles },
  { title: "الامتحانات", url: "/student/exams", icon: FileText },
  { title: "الملفات", url: "/student/files", icon: FolderOpen },
  { title: "الجوائز", url: "/student/rewards", icon: Award },
  { title: "نقاطي", url: "/student/points", icon: Star },
  { title: "الإنجازات", url: "/student/achievements", icon: Trophy },
  { title: "الرسائل", url: "/student/messages", icon: MessageSquare },
];


export function StudentHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const initial = (profile?.full_name ?? profile?.identifier ?? "ط").slice(0, 1);
  const doSignOut = async () => { await signOut(); navigate({ to: "/login", replace: true }); };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center gap-4">
        <Logo size={36} />
        <nav className="hidden md:flex items-center gap-1 me-auto ms-4">
          {nav.map((n) => {
            const active = pathname === n.url || pathname.startsWith(n.url + "/");
            return (
              <Link key={n.url} to={n.url} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <n.icon className="h-4 w-4" /> {n.title}
              </Link>
            );
          })}
        </nav>
        <div className="me-auto md:me-0 flex items-center gap-2">
            <InstallAppButton className="hidden sm:inline-flex" />
            <NotificationsBell />
            <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2">
            <Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url ?? undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initial}</AvatarFallback></Avatar>
            <div className="text-xs">
              <p className="font-medium leading-tight">{profile?.full_name ?? "الطالب"}</p>
              <p className="text-muted-foreground leading-tight">{profile?.identifier}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={doSignOut} aria-label="تسجيل الخروج"><LogOut className="h-4 w-4"/></Button>
        </div>
      </div>
      <nav className="md:hidden border-t bg-background/95 backdrop-blur">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((n) => {
            const active = pathname === n.url || pathname.startsWith(n.url + "/");
            return (
              <Link
                key={n.url}
                to={n.url}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg min-w-[68px] px-2 py-1.5 text-[11px] font-medium transition-colors shrink-0 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <n.icon className="h-[18px] w-[18px]" />
                <span className="leading-none">{n.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </header>
  );
}
