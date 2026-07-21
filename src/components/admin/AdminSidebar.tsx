import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Users, FileText, Bot, MessageSquare, Award, BarChart3, Bell, FolderOpen, Settings, GraduationCap, Archive, HeartPulse, ClipboardCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/common/Logo";

const items = [
  { title: "الرئيسية", url: "/admin/dashboard", icon: Home },
  { title: "المساعد الذكي", url: "/admin/assistant", icon: Bot },
  { title: "الطلاب", url: "/admin/students", icon: Users },
  { title: "الأرشيف", url: "/admin/archive", icon: Archive },
  { title: "الصفوف الدراسية", url: "/admin/classes", icon: GraduationCap },
  { title: "الامتحانات", url: "/admin/exams", icon: FileText },
  { title: "النتائج", url: "/admin/results", icon: ClipboardCheck },
  { title: "الذكاء الاصطناعي", url: "/admin/ai", icon: Bot },
  { title: "الرسائل", url: "/admin/messages", icon: MessageSquare },
  { title: "الجوائز والمسابقات", url: "/admin/rewards", icon: Award },
  { title: "الترتيب والتقارير", url: "/admin/reports", icon: BarChart3 },
  { title: "الإشعارات", url: "/admin/notifications", icon: Bell },
  { title: "الملفات", url: "/admin/files", icon: FolderOpen },
  { title: "حالة النظام والنسخ", url: "/admin/system", icon: HeartPulse },
  { title: "الإعدادات", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const handleNavClick = () => { if (isMobile) setOpenMobile(false); };

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
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} onClick={handleNavClick} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
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
