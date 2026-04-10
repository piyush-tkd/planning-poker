import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AuthProvider } from "@/components/layout/auth-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50">
        <AdminSidebar />
        <main className="ml-64">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
