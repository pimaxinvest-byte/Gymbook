// ── Google Calendar & ICS export utilities ───────────────────────────────────

export interface ExportBooking {
  id: string;
  startDatetime: string | Date;
  endDatetime: string | Date;
  activityName: string;
  teacherName: string;
  spaceName: string;
  notes?: string | null;
  sessionType?: string;
}

// Format a Date as YYYYMMDDTHHmmssZ (Google Calendar / ICS format)
function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Open a Google Calendar "Add event" page for a single booking
export function googleCalendarUrl(b: ExportBooking): string {
  const start = new Date(b.startDatetime);
  const end = new Date(b.endDatetime);
  const title = encodeURIComponent(
    `${b.activityName}${b.sessionType === "SGT" ? " (SGT)" : ""} con ${b.teacherName}`
  );
  const dates = `${toICSDate(start)}/${toICSDate(end)}`;
  const details = encodeURIComponent(
    [
      `Entrenador: ${b.teacherName}`,
      `Espacio: ${b.spaceName}`,
      b.sessionType === "SGT" ? "Sesión en grupo (SGT)" : "Sesión individual",
      b.notes ? `Notas: ${b.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
  const location = encodeURIComponent(b.spaceName);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}&sf=true`;
}

// Build an ICS string for one or many bookings
export function generateICS(bookings: ExportBooking[]): string {
  const events = bookings
    .map((b) => {
      const start = toICSDate(new Date(b.startDatetime));
      const end = toICSDate(new Date(b.endDatetime));
      const summary = `${b.activityName}${b.sessionType === "SGT" ? " (SGT)" : ""} con ${b.teacherName}`;
      const description = [
        `Entrenador: ${b.teacherName}`,
        `Espacio: ${b.spaceName}`,
        b.sessionType === "SGT" ? "Tipo: Pequeño grupo (SGT)" : "Tipo: Individual",
        b.notes ? `Notas: ${b.notes}` : "",
      ]
        .filter(Boolean)
        .join("\\n");

      return [
        "BEGIN:VEVENT",
        `UID:gymbook-${b.id}@gymbook`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${b.spaceName}`,
        "STATUS:CONFIRMED",
        `CREATED:${toICSDate(new Date())}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GymBook//GymBook v1.0//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

// Trigger a browser download of an ICS file
export function downloadICS(bookings: ExportBooking[], filename = "gymbook-clases.ics") {
  const ics = generateICS(bookings);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
