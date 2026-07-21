import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, FileText, MessageSquare, Award, LogOut, Star, Trophy, Sparkles, FolderOpen, UserRound } from "lucide-react";

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

const bottomNav = [
  { title: "الرئيسية", url: "/student/dashboard", icon: Home },
  { title: "امتحانات", url: "/student/exams", icon: FileText },
  { title: "الملفات", url: "/student/files", icon: FolderOpen },
  { title: "الرسائل", url: "/student/messages", icon: MessageSquare },
  { title: "المساعد", url: "/student/assistant", icon: Sparkles },
];


export function StudentHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const initial = (profile?.full_name ?? profile?.identifier ?? "ط").slice(0, 1);
  const doSignOut = async () => { await signOut(); navigate({ to: "/login", replace: true }); };

  return (
    <>
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 md:flex md:px-6">
        <Logo size={36} textClassName="hidden min-[380px]:flex" />
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
        <div className="me-auto flex shrink-0 items-center gap-1 md:me-0 md:gap-2">
            <InstallAppButton className="hidden sm:inline-flex" />
            <NotificationsBell />
            <div className="hidden min-[380px]:block"><ThemeToggle /></div>
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
      <div className="border-t bg-muted/30 px-3 py-2 sm:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={profile?.avatar_url ?? undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-xs"><UserRound className="h-4 w-4" /></AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{profile?.full_name ?? "الطالب"}</p>
            <p className="truncate text-[11px] text-muted-foreground leading-tight">كود الطالب: {profile?.identifier}</p>
          </div>
        </div>
      </div>
    </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 px-1">
          {bottomNav.map((n) => {
            const active = pathname === n.url || pathname.startsWith(n.url + "/");
            return (
              <Link
                key={n.url}
                to={n.url}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-bold transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <span className={`grid h-8 w-10 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : "bg-transparent"}`}>
                  <n.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="leading-none">{n.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
