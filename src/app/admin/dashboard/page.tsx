import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminDashboardClient } from "./dashboard-client";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/calendar");
  return <AdminDashboardClient />;
}
