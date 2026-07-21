import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, FileText, MessageSquare, Award, LogOut, Star, Trophy, Sparkles, FolderOpen, UserRound, Menu, type LucideIcon } from "lucide-react";

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
const nav: Array<{ title: string; url: string; icon: LucideIcon; badge: NavKey }> = [
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
    <>
      <aside data-sidebar className="fixed inset-y-0 right-0 z-40 hidden w-72 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl lg:flex">
        <StudentSidebarContent
          profile={profile}
          initial={initial}
          isActive={isActive}
          badgeFor={badgeFor}
          onNavigate={() => undefined}
          onSignOut={doSignOut}
        />
      </aside>

      <header className="sticky top-0 z-30 border-b bg-background/95 lg:hidden">
        <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="القائمة">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[280px] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <StudentSidebarContent
                profile={profile}
                initial={initial}
                isActive={isActive}
                badgeFor={badgeFor}
                onNavigate={() => setOpen(false)}
                onSignOut={() => { setOpen(false); doSignOut(); }}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <Logo size={36} textClassName="hidden min-[380px]:flex" />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <NotificationsBell />
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  );
}

function StudentSidebarContent({
  profile,
  initial,
  isActive,
  badgeFor,
  onNavigate,
  onSignOut,
}: {
  profile: ReturnType<typeof useAuth>["profile"];
  initial: string;
  isActive: (url: string) => boolean;
  badgeFor: (key: NavKey) => number;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="border-b border-sidebar-border p-4">
        <Logo size={40} />
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-sidebar-primary/40">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              {initial || <UserRound className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{profile?.full_name ?? "الطالب"}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/70">كود: {profile?.identifier}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((n) => {
          const active = isActive(n.url);
          const count = badgeFor(n.badge);
          return (
            <Link
              key={n.url}
              to={n.url}
              onClick={onNavigate}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <span className="relative shrink-0">
                <n.icon className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-sidebar">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="min-w-0 truncate">{n.title}</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-destructive-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="hidden items-center justify-between rounded-lg px-2 py-1 lg:flex">
          <span className="text-xs text-sidebar-foreground/70">الإشعارات</span>
          <NotificationsBell />
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-1">
          <span className="text-xs text-sidebar-foreground/70">المظهر</span>
          <ThemeToggle />
        </div>
        <InstallAppButton className="w-full justify-start" />
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="ml-2 h-4 w-4" /> تسجيل الخروج
        </Button>
      </div>
    </>
  );
}
