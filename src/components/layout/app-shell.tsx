import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  gymName?: string;
  logoUrl?: string;
}

export function AppShell({ children, title, gymName, logoUrl }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header title={title} gymName={gymName} logoUrl={logoUrl} />
      <main className="flex-1 pb-nav overflow-y-auto">
        {children}
        <p className="text-center text-[10px] text-gray-300 py-2 select-none">
          Creado por Pietro
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
