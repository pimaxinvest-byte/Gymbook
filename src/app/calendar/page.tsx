import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarPageClient } from "./calendar-client";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <CalendarPageClient role={session.user.role} userId={session.user.id} />;
}
