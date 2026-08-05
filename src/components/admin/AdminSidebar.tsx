import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Users, FileText, Bot, MessageSquare, Award, BarChart3, Bell, FolderOpen, Settings, GraduationCap, HeartPulse, ClipboardCheck, Ticket, ClipboardList,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/common/Logo";
import { useAdminUnreadBadges, type AdminBadges } from "@/hooks/useUnreadBadges";

type BadgeKey = keyof AdminBadges | null;
const items: Array<{ title: string; url: string; icon: any; badge: BadgeKey }> = [
  { title: "الرئيسية", url: "/admin/dashboard", icon: Home, badge: null },
  { title: "المساعد الذكي", url: "/admin/assistant", icon: Bot, badge: null },
  { title: "الطلاب", url: "/admin/students", icon: Users, badge: null },
  { title: "أكواد الانضمام", url: "/admin/join-codes", icon: Ticket, badge: null },
  { title: "طلبات التسجيل", url: "/admin/registration-requests", icon: ClipboardList, badge: null },
  { title: "الصفوف الدراسية", url: "/admin/classes", icon: GraduationCap, badge: null },
  { title: "الامتحانات", url: "/admin/exams", icon: FileText, badge: null },
  { title: "الفيديوهات التعليمية", url: "/admin/videos", icon: Video, badge: null },

  { title: "النتائج", url: "/admin/results", icon: ClipboardCheck, badge: "results" },
  { title: "الذكاء الاصطناعي", url: "/admin/ai", icon: Bot, badge: null },
  { title: "قاعدة المعرفة", url: "/admin/ai/knowledge", icon: Bot, badge: null },
  { title: "أسئلة الطلاب", url: "/admin/ai/questions", icon: Bot, badge: null },

  { title: "الرسائل", url: "/admin/messages", icon: MessageSquare, badge: "messages" },
  { title: "الجوائز والمسابقات", url: "/admin/rewards", icon: Award, badge: null },
  { title: "الترتيب والتقارير", url: "/admin/reports", icon: BarChart3, badge: null },
  { title: "الإشعارات", url: "/admin/notifications", icon: Bell, badge: "notifications" },
  { title: "بنك الأسئلة", url: "/admin/question-bank", icon: FolderOpen, badge: null },
  { title: "حالة النظام والنسخ", url: "/admin/system", icon: HeartPulse, badge: null },
  { title: "الإعدادات", url: "/admin/settings", icon: Settings, badge: null },
];

export function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const badges = useAdminUnreadBadges();
  const handleNavClick = () => { if (isMobile) setOpenMobile(false); };
  const badgeFor = (k: BadgeKey) => (k ? badges[k] : 0);

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b p-3">
        {collapsed ? <Logo size={32} showText={false}/> : <Logo size={40} />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>لوحة التحكم</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                const count = badgeFor(item.badge);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} onClick={handleNavClick} className="flex items-center gap-3">
                        <span className="relative shrink-0">
                          <item.icon className="h-4 w-4" />
                          {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-sidebar">
                              {count > 9 ? "9+" : count}
                            </span>
                          )}
                        </span>
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {!collapsed && count > 0 && (
                          <span className="ms-auto h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
