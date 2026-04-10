import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/components/layout/auth-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        {/* On mobile: no left margin (sidebar is a drawer overlay).
            On md+: push content right by the sidebar width. */}
        <main className="md:ml-64 min-h-screen pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
