import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, FileText, MessageSquare, Award, LogOut, Star, Trophy, Sparkles, FolderOpen, UserRound, Menu } from "lucide-react";

import { Logo } from "@/components/common/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { InstallAppButton } from "@/components/common/InstallAppButton";
import { useAuth } from "@/lib/auth-context";
import { useStudentUnreadBadges, type StudentBadges } from "@/hooks/useUnreadBadges";

type NavKey = keyof StudentBadges | null;
const nav: Array<{ title: string; url: string; icon: any; badge: NavKey }> = [
  { title: "الرئيسية", url: "/student/dashboard", icon: Home, badge: null },
  { title: "المساعد الذكي", url: "/student/assistant", icon: Sparkles, badge: null },
  { title: "الامتحانات", url: "/student/exams", icon: FileText, badge: "exams" },
  { title: "الملفات", url: "/student/files", icon: FolderOpen, badge: null },
  { title: "الرسائل", url: "/student/messages", icon: MessageSquare, badge: "messages" },
  { title: "الجوائز", url: "/student/rewards", icon: Award, badge: "rewards" },
  { title: "نقاطي", url: "/student/points", icon: Star, badge: null },
  { title: "الإنجازات", url: "/student/achievements", icon: Trophy, badge: "achievements" },
];

export function StudentHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const badges = useStudentUnreadBadges();
  const initial = (profile?.full_name ?? profile?.identifier ?? "ط").slice(0, 1);
  const doSignOut = async () => { await signOut(); navigate({ to: "/login", replace: true }); };
  const isActive = (u: string) => pathname === u || pathname.startsWith(u + "/");
  const badgeFor = (k: NavKey) => (k ? badges[k] : 0);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 md:px-6">
        {/* Mobile / Tablet: hamburger opens side drawer */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="القائمة">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] p-0 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border">
            <div className="p-4 border-b border-sidebar-border">
              <Logo size={40} />
              <div className="mt-4 flex items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0 ring-2 ring-sidebar-primary/40">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
                    {initial || <UserRound className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{profile?.full_name ?? "الطالب"}</p>
                  <p className="truncate text-[11px] text-sidebar-foreground/70">كود: {profile?.identifier}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {nav.map((n) => {
                const active = isActive(n.url);
                const count = badgeFor(n.badge);
                return (
                  <Link
                    key={n.url}
                    to={n.url}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <n.icon className="h-5 w-5" />
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-sidebar">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </span>
                    <span className="flex-1">{n.title}</span>
                    {count > 0 && (
                      <span className="ms-auto h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border p-3 space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-sidebar-foreground/70">المظهر</span>
                <ThemeToggle />
              </div>
              <InstallAppButton className="w-full justify-start" />
              <Button
                variant="ghost"
                onClick={() => { setOpen(false); doSignOut(); }}
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Logo size={36} textClassName="hidden min-[380px]:flex" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 me-auto ms-4">
          {nav.map((n) => {
            const active = isActive(n.url);
            return (
              <Link key={n.url} to={n.url} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <n.icon className="h-4 w-4" /> {n.title}
              </Link>
            );
          })}
        </nav>

        <div className="me-auto flex shrink-0 items-center gap-1 md:me-0 md:gap-2">
          <InstallAppButton className="hidden md:inline-flex" />
          <NotificationsBell />
          <div className="hidden md:block"><ThemeToggle /></div>
          <div className="hidden md:flex items-center gap-2">
            <Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url ?? undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initial}</AvatarFallback></Avatar>
            <div className="text-xs">
              <p className="font-medium leading-tight">{profile?.full_name ?? "الطالب"}</p>
              <p className="text-muted-foreground leading-tight">{profile?.identifier}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={doSignOut} aria-label="تسجيل الخروج" className="hidden md:inline-flex"><LogOut className="h-4 w-4"/></Button>
        </div>
      </div>
    </header>
  );
}
