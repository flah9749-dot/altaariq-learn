import { useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { useAuth } from "@/lib/auth-context";

export function AdminHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (profile?.full_name ?? profile?.identifier ?? "أ").slice(0, 1);

  const doSignOut = async () => { await signOut(); navigate({ to: "/login", replace: true }); };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur px-3 md:px-6">
      <SidebarTrigger />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">مرحبًا</p>
        <p className="text-sm font-semibold truncate">{profile?.full_name ?? profile?.identifier ?? "المدرس"}</p>
      </div>
      <NotificationsBell />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">{initial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{profile?.identifier}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/admin/settings" })}>
            <UserIcon className="me-2 h-4 w-4" /> الحساب والإعدادات
          </DropdownMenuItem>
          <DropdownMenuItem onClick={doSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="me-2 h-4 w-4" /> تسجيل الخروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
