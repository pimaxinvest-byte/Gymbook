# -*- coding: utf-8 -*-
"""Generate GymBook QuickStart PDF using reportlab."""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

OUTPUT = r"C:\Users\pietr\gym-booking\GymBook-QuickStart.pdf"

# Brand colours
ORANGE       = colors.HexColor("#f97316")
ORANGE_DARK  = colors.HexColor("#ea580c")
ORANGE_LIGHT = colors.HexColor("#fff7ed")
GRAY_TEXT    = colors.HexColor("#374151")
GRAY_LIGHT   = colors.HexColor("#f9fafb")
GRAY_BORDER  = colors.HexColor("#e5e7eb")
WHITE        = colors.white
BLACK        = colors.HexColor("#111827")
GREEN_C      = colors.HexColor("#16a34a")
RED_C        = colors.HexColor("#dc2626")
YELLOW_C     = colors.HexColor("#ca8a04")

W, H = A4
MARGIN = 18 * mm
COL_W = W - 2 * MARGIN


# ── Paragraph styles ──────────────────────────────────────────────────────────

def ps(name, **kw):
    return ParagraphStyle(name, **kw)

S = {
    "cover_title": ps("cover_title", fontName="Helvetica-Bold", fontSize=52,
                      textColor=ORANGE, alignment=TA_CENTER, spaceAfter=6),
    "cover_sub":   ps("cover_sub",   fontName="Helvetica-Bold", fontSize=20,
                      textColor=BLACK, alignment=TA_CENTER, spaceAfter=4),
    "cover_body":  ps("cover_body",  fontName="Helvetica",      fontSize=12,
                      textColor=GRAY_TEXT, alignment=TA_CENTER, spaceAfter=6),
    "cover_small": ps("cover_small", fontName="Helvetica",      fontSize=10,
                      textColor=GRAY_TEXT, alignment=TA_CENTER, spaceAfter=3),
    "section_hdr": ps("section_hdr", fontName="Helvetica-Bold", fontSize=13,
                      textColor=WHITE, spaceBefore=0, spaceAfter=0),
    "subsection":  ps("subsection",  fontName="Helvetica-Bold", fontSize=10,
                      textColor=ORANGE_DARK, spaceBefore=8, spaceAfter=3),
    "body":        ps("body",        fontName="Helvetica",      fontSize=9,
                      textColor=GRAY_TEXT, spaceAfter=3, leading=13),
    "body_b":      ps("body_b",      fontName="Helvetica-Bold", fontSize=9,
                      textColor=BLACK, spaceAfter=3),
    "note":        ps("note",        fontName="Helvetica-Oblique", fontSize=8.5,
                      textColor=ORANGE_DARK, spaceAfter=4, leftIndent=8),
    "step":        ps("step",        fontName="Helvetica",      fontSize=9,
                      textColor=GRAY_TEXT, spaceAfter=0, leftIndent=8, leading=13),
    "bullet":      ps("bullet",      fontName="Helvetica",      fontSize=9,
                      textColor=GRAY_TEXT, spaceAfter=2, leftIndent=8, leading=13),
    "check":       ps("check",       fontName="Helvetica",      fontSize=9,
                      textColor=GRAY_TEXT, spaceAfter=3, leftIndent=6, leading=13),
    "th":          ps("th",          fontName="Helvetica-Bold", fontSize=8,
                      textColor=WHITE),
    "td":          ps("td",          fontName="Helvetica",      fontSize=8,
                      textColor=GRAY_TEXT, leading=12),
    "mono":        ps("mono",        fontName="Courier",        fontSize=8,
                      textColor=ORANGE_DARK),
    "back_title":  ps("back_title",  fontName="Helvetica-Bold", fontSize=36,
                      textColor=WHITE, alignment=TA_CENTER, spaceAfter=8),
    "back_body":   ps("back_body",   fontName="Helvetica-Bold", fontSize=12,
                      textColor=ORANGE_DARK, alignment=TA_CENTER, spaceAfter=4),
    "back_small":  ps("back_small",  fontName="Helvetica",      fontSize=9,
                      textColor=GRAY_TEXT, alignment=TA_CENTER, spaceAfter=3),
}

# ── Helpers ───────────────────────────────────────────────────────────────────

TABLE_BASE = TableStyle([
    ("BACKGROUND",    (0, 0), (-1, 0),  ORANGE),
    ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
    ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
    ("FONTSIZE",      (0, 0), (-1, 0),  8),
    ("TOPPADDING",    (0, 0), (-1, 0),  6),
    ("BOTTOMPADDING", (0, 0), (-1, 0),  6),
    ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",      (0, 1), (-1, -1), 8),
    ("TEXTCOLOR",     (0, 1), (-1, -1), GRAY_TEXT),
    ("TOPPADDING",    (0, 1), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ("LEFTPADDING",   (0, 0), (-1, -1), 7),
    ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
    ("GRID",          (0, 0), (-1, -1), 0.4, GRAY_BORDER),
    ("LINEABOVE",     (0, 0), (-1, 0),  1,   ORANGE),
    ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
])


def section_header(text, num):
    p = Paragraph(f"{num}. {text}", S["section_hdr"])
    t = Table([[p]], colWidths=[COL_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ORANGE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def gtable(headers, rows, widths):
    """Generic styled table — headers is a list of strings, rows list of lists of Paragraph."""
    hrow = [Paragraph(h, S["th"]) for h in headers]
    data = [hrow] + rows
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TABLE_BASE)
    return t


def step_row(n, bold, rest=""):
    num_p = Paragraph(f"<b>{n}</b>", ps("sn", fontName="Helvetica-Bold", fontSize=10,
                                         textColor=WHITE, alignment=TA_CENTER))
    txt = f"<b>{bold}</b>" + (f" — {rest}" if rest else "")
    txt_p = Paragraph(txt, S["step"])
    t = Table([[num_p, txt_p]], colWidths=[18, COL_W - 18])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, 0), ORANGE),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (0, 0),  3),
        ("LEFTPADDING",   (1, 0), (1, 0),  8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("LINEBELOW",     (1, 0), (1, 0), 0.3, GRAY_BORDER),
    ]))
    return t


def info_box(text):
    p = Paragraph(text, ps("ib", fontName="Helvetica-Oblique", fontSize=8.5,
                            textColor=ORANGE_DARK, leading=13))
    t = Table([[p]], colWidths=[COL_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ORANGE_LIGHT),
        ("LINEALL",       (0, 0), (-1, -1), 1, ORANGE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def centre_table(inner_table):
    t = Table([[inner_table]], colWidths=[COL_W])
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    return t


# ── Page callbacks ────────────────────────────────────────────────────────────

_page_num = [0]


def on_page(c, doc):
    _page_num[0] += 1
    pg = _page_num[0]
    if pg == 1:
        return  # cover — no header/footer

    c.saveState()
    # Header bar
    c.setFillColor(ORANGE)
    c.rect(MARGIN, H - 13 * mm, COL_W, 1, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(ORANGE_DARK)
    c.drawString(MARGIN, H - 11 * mm, "GymBook — Guia de Inicio Rapido")
    c.setFont("Helvetica", 8)
    c.setFillColor(GRAY_TEXT)
    c.drawRightString(W - MARGIN, H - 11 * mm, "v1.2.0")
    # Footer bar
    c.setFillColor(GRAY_BORDER)
    c.rect(MARGIN, 9 * mm, COL_W, 0.5, fill=1, stroke=0)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(GRAY_TEXT)
    c.drawString(MARGIN, 6 * mm, "gymbook-app-production.up.railway.app")
    c.drawRightString(W - MARGIN, 6 * mm, f"Pagina {pg - 1}")
    c.restoreStore = c.restoreState
    c.restoreState()


# ── Story builder ─────────────────────────────────────────────────────────────

def build_story():  # noqa: C901
    story = []
    sp = lambda n=4: Spacer(1, n)

    # ── COVER ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 50 * mm))

    badge_p = Paragraph("GymBook", ps("bg", fontName="Helvetica-Bold", fontSize=48,
                                       textColor=WHITE, alignment=TA_CENTER))
    badge_t = Table([[badge_p]], colWidths=[120 * mm])
    badge_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ORANGE),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (-1, -1), 20),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 20),
    ]))
    story.append(centre_table(badge_t))
    story.append(sp(12 * mm))
    story.append(Paragraph("Guia de Inicio Rapido", S["cover_sub"]))
    story.append(Paragraph("Sistema de reservas para gimnasio", S["cover_body"]))
    story.append(HRFlowable(width="60%", thickness=1, color=ORANGE, spaceAfter=14))

    meta_items = [
        ("Version",    "1.2.0"),
        ("URL",        "gymbook-app-production.up.railway.app"),
        ("Bot",        "@Daddysgymbook_bot"),
        ("Soporte",    "@rohypus . Pietro Anoe"),
    ]
    for label, val in meta_items:
        row = Table(
            [[Paragraph(label, ps("ml", fontName="Helvetica-Bold", fontSize=9,
                                  textColor=ORANGE_DARK, alignment=TA_RIGHT)),
              Paragraph(val,   ps("mv", fontName="Helvetica",      fontSize=9,
                                  textColor=GRAY_TEXT,  alignment=TA_LEFT))]],
            colWidths=[60 * mm, 90 * mm])
        row.setStyle(TableStyle([
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(row)

    story.append(sp(20 * mm))
    story.append(Paragraph("(c) 2025 - Todos los derechos reservados", S["cover_small"]))
    story.append(PageBreak())

    # ── SECTION 1 — Accesos ──────────────────────────────────────────────────
    story.append(section_header("Accesos Iniciales", 1))
    story.append(sp())
    rows1 = [
        ["Admin",    "admin@gymbook.com",     "admin123",   "Acceso completo"],
        ["Profesor", "max.romeo@me.com",       "Max123",     "Max Romeo - Entrenamiento Personal"],
        ["Profesor", "rohypus@gmail.com",      "Pietro123",  "Pietro Anoe - Entrenamiento Personal"],
        ["Profesor", "lolamarca@hotmail.es",   "(ver seed)", "Lola Martin Carmona - Yoga"],
    ]
    rows1_p = [[Paragraph(c, S["td"]) for c in row] for row in rows1]
    story.append(gtable(["Rol", "Email", "Contrasena", "Descripcion"],
                        rows1_p, [22*mm, 52*mm, 26*mm, 65*mm]))
    story.append(sp())
    story.append(info_box("IMPORTANTE: Cambiar las contrasenas en el primer inicio de sesion desde Ajustes -> Mi perfil."))

    # ── SECTION 2 — Roles ────────────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Roles y Permisos", 2))
    story.append(sp())

    def role_col(title, items, bg=ORANGE):
        cells = [[Paragraph(title, ps("rh", fontName="Helvetica-Bold", fontSize=9,
                                       textColor=WHITE, alignment=TA_CENTER))]]
        for item in items:
            cells.append([Paragraph(f"- {item}", S["bullet"])])
        t = Table(cells, colWidths=[COL_W / 3 - 3])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), bg),
            ("TOPPADDING",    (0, 0), (0, 0), 7),
            ("BOTTOMPADDING", (0, 0), (0, 0), 7),
            ("TOPPADDING",    (0, 1), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("BOX",           (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ]))
        return t

    roles_t = Table([[
        role_col("ADMIN",    ["Panel completo","Aprueba clientes","Gestiona profesores y actividades","Configura Telegram","Estadisticas completas"],    ORANGE),
        role_col("PROFESOR", ["Planning semanal","Abre disponibilidad","Gestiona creditos y pagos","Notificaciones Telegram"],                           colors.HexColor("#c2410c")),
        role_col("CLIENTE",  ["Reserva sesiones","Ve sus creditos y saldo","Historial de reservas","Notificaciones Telegram"],                           colors.HexColor("#9a3412")),
    ]], colWidths=[COL_W / 3] * 3)
    roles_t.setStyle(TableStyle([
        ("LEFTPADDING",  (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(roles_t)

    # ── SECTION 3 — Onboarding ───────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Flujo de Onboarding de Cliente", 3))
    story.append(sp())
    for n, bold, rest in [
        (1, "Registro",            "Cliente accede a /register y rellena: nombre, apellido, email, contrasena, telefono, Telegram (opcional), objetivo."),
        (2, "Acepta condiciones",  "Marca la casilla de aceptacion de terminos y envia la solicitud."),
        (3, "Notificacion admin",  "El admin recibe aviso por Telegram y en el panel /admin/clients."),
        (4, "Aprobacion / Rechazo","Admin aprueba o rechaza desde la ficha del cliente en el panel."),
        (5, "Activacion",          "Si aprueba: el cliente recibe mensaje de bienvenida por Telegram y puede reservar."),
        (6, "Rechazo",             "Si rechaza: el cliente recibe notificacion con el motivo indicado por el admin."),
    ]:
        story.append(step_row(n, bold, rest))
        story.append(sp(2))

    # ── SECTION 4 — Espacios ─────────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Gestion de Espacios", 4))
    story.append(sp())
    rows4 = [
        ["SALA",     "Interior", "Max 10 personas", "Un profesor a la vez"],
        ["EXTERIOR", "Exterior", "Max 20 personas", "Un profesor a la vez"],
    ]
    rows4_p = [[Paragraph(c, S["td"]) for c in row] for row in rows4]
    story.append(gtable(["Espacio","Tipo","Capacidad","Regla"], rows4_p,
                        [28*mm, 26*mm, 40*mm, 71*mm]))
    story.append(sp())
    story.append(info_box("Regla critica: El sistema valida automaticamente que no existan dos reservas activas en el mismo espacio a la misma hora. Si hay conflicto, la accion se bloquea y se muestra un mensaje de error claro."))

    # ── SECTION 5 — Actividades ───────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Actividades Disponibles", 5))
    story.append(sp())
    rows5 = [
        ["Entrenamiento Personal", "60 min", "1 cliente",  "INDIVIDUAL"],
        ["Yoga",                   "60 min", "5 clientes", "SGT (Small Group Training)"],
    ]
    rows5_p = [[Paragraph(c, S["td"]) for c in row] for row in rows5]
    story.append(gtable(["Actividad","Duracion","Capacidad","Tipo"], rows5_p,
                        [52*mm, 24*mm, 28*mm, 61*mm]))
    story.append(sp())
    story.append(Paragraph("Para anadir nuevas: Admin -> /admin/activities -> Nueva actividad (nombre, capacidad, duracion, color).", S["note"]))

    story.append(PageBreak())

    # ── SECTION 6 — Disponibilidad ────────────────────────────────────────────
    story.append(section_header("Como el Profesor Abre Disponibilidad", 6))
    story.append(sp())
    for n, bold, rest in [
        (1, "Iniciar sesion",         "Acceder con las credenciales de profesor."),
        (2, "Ir a Disponib.",         "Pulsar 'Disponib.' en el menu inferior de la aplicacion."),
        (3, "Nueva disponibilidad",   "Pulsar el boton 'Nueva disponibilidad'."),
        (4, "Rellenar formulario",    "Seleccionar actividad, espacio, hora inicio (fin automatico +60 min), tipo: Individual o SGT."),
        (5, "Puntual o recurrente",   "Puntual: seleccionar fecha. Recurrente: marcar dias de la semana y rango de fechas."),
        (6, "Crear",                  "El sistema valida conflictos antes de crear. Si hay conflicto, lo muestra y bloquea."),
    ]:
        story.append(step_row(n, bold, rest))
        story.append(sp(2))

    # ── SECTION 7 — Reserva ───────────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Como el Cliente Reserva una Sesion", 7))
    story.append(sp())
    for n, bold, rest in [
        (1, "Iniciar sesion",      "Acceder con credenciales de cliente (debe estar ACTIVO)."),
        (2, "Ir a Reservar",       "Pulsar 'Reservar' en el menu inferior."),
        (3, "Ver franjas",         "Se muestran las sesiones disponibles de sus profesores asignados."),
        (4, "Verificar creditos",  "Cada franja muestra el saldo de creditos disponible para ese profesor y tipo."),
        (5, "Reservar",            "Pulsar 'Reservar'. Se descuenta 1 credito automaticamente."),
        (6, "Confirmacion",        "El cliente recibe confirmacion en la app y notificacion por Telegram."),
    ]:
        story.append(step_row(n, bold, rest))
        story.append(sp(2))
    story.append(sp())
    story.append(info_box("El profesor puede tambien reservar sesiones para sus clientes directamente desde /teacher/clients."))

    # ── SECTION 8 — Creditos y Pagos ─────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Sistema de Creditos y Pagos", 8))
    story.append(sp())

    story.append(Paragraph("TIPOS DE CREDITO", S["subsection"]))
    story.append(Paragraph("- INDIVIDUAL: para sesiones 1:1 (Entrenamiento Personal).", S["bullet"]))
    story.append(Paragraph("- SGT: para sesiones en grupo (Yoga). Cada tipo se gestiona por separado.", S["bullet"]))

    story.append(Paragraph("ASIGNACION", S["subsection"]))
    story.append(Paragraph("El admin o el profesor asigna creditos desde /credits -> 'Asignar creditos'. Al asignar se puede indicar el estado de pago directamente.", S["body"]))

    story.append(Paragraph("SEGUIMIENTO DE PAGOS", S["subsection"]))
    rows8 = [
        [Paragraph("PAID - Pagado",      S["td"]),
         Paragraph("Pago completo recibido",   S["td"]),
         Paragraph("Verde",    ps("g", fontName="Helvetica-Bold", fontSize=8, textColor=GREEN_C))],
        [Paragraph("UNPAID - Sin pagar", S["td"]),
         Paragraph("Pendiente de cobro",       S["td"]),
         Paragraph("Rojo",     ps("r", fontName="Helvetica-Bold", fontSize=8, textColor=RED_C))],
        [Paragraph("PARTIAL - Parcial",  S["td"]),
         Paragraph("Pago parcial con importe", S["td"]),
         Paragraph("Amarillo", ps("y", fontName="Helvetica-Bold", fontSize=8, textColor=YELLOW_C))],
    ]
    story.append(gtable(["Estado","Descripcion","Badge"], rows8, [48*mm, 80*mm, 37*mm]))
    story.append(sp())
    story.append(Paragraph("<b>Metodos de pago:</b> Efectivo - Tarjeta - Transferencia - Bizum - Otro.", S["body"]))
    story.append(Paragraph("<b>Campos adicionales:</b> importe pagado (EUR), metodo, fecha de pago, notas internas.", S["body"]))
    story.append(Paragraph("<b>Caducidad:</b> Los creditos caducan 6 meses desde la ultima asignacion (configurable en Ajustes).", S["body"]))
    story.append(Paragraph("<b>Devolucion:</b> Si el cliente cancela con mas de 24h de antelacion, el credito se devuelve automaticamente.", S["body"]))
    story.append(Paragraph("<b>Historial (CreditLog):</b> Registro completo de todos los movimientos: asignacion, uso, devolucion, pago. Visible desde la ficha de creditos.", S["body"]))

    story.append(PageBreak())

    # ── SECTION 9 — Telegram ─────────────────────────────────────────────────
    story.append(section_header("Telegram - Configuracion y Comandos", 9))
    story.append(sp())

    for label, val in [
        ("Bot",     "@Daddysgymbook_bot"),
        ("Token",   "[configurado en TELEGRAM_BOT_TOKEN - ver Railway Variables]"),
        ("Webhook", "gymbook-app-production.up.railway.app/api/telegram/webhook"),
    ]:
        t = Table([[Paragraph(f"<b>{label}:</b>", S["body"]),
                    Paragraph(val, S["body"])]],
                  colWidths=[28 * mm, COL_W - 28 * mm])
        t.setStyle(TableStyle([
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(t)

    story.append(sp())
    story.append(Paragraph("Como conectar: Ajustes -> 'Conectar Telegram' -> pulsar el enlace -> escribir /start al bot.", S["body"]))

    story.append(Paragraph("PANEL DE CONTROL TELEGRAM (solo admin): /admin/telegram", S["subsection"]))
    for item in [
        "Ver usuarios conectados por rol con estado de conexion",
        "Enviar mensaje de difusion (broadcast) a TEACHER / CLIENT / ADMIN",
        "Ver log de notificaciones (ultimas 20)",
        "Enviar mensaje de prueba a un chat ID especifico",
    ]:
        story.append(Paragraph(f"- {item}", S["bullet"]))

    story.append(sp(4))
    story.append(Paragraph("COMANDOS DISPONIBLES", S["subsection"]))
    rows9 = [
        [Paragraph("/reservas", S["mono"]),  Paragraph("Ver las proximas sesiones", S["td"])],
        [Paragraph("/cancelar", S["mono"]),  Paragraph("Cancelar una reserva (menu inline)", S["td"])],
        [Paragraph("/checkin",  S["mono"]),  Paragraph("Confirmar asistencia (disponible 2h antes)", S["td"])],
        [Paragraph("/creditos", S["mono"]),  Paragraph("Ver saldo de creditos por profesor y tipo", S["td"])],
        [Paragraph("/espera",   S["mono"]),  Paragraph("Ver posicion en lista de espera", S["td"])],
        [Paragraph("/ayuda",    S["mono"]),  Paragraph("Mostrar ayuda y lista de comandos", S["td"])],
    ]
    story.append(gtable(["Comando", "Descripcion"], rows9, [42*mm, COL_W - 42*mm]))

    # ── SECTION 10 — Panel Admin ─────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Panel de Administracion", 10))
    story.append(sp())
    rows10 = [
        ["Dashboard",    "/admin/dashboard",  "Resumen rapido: reservas hoy/semana/mes. Accesos directos a todas las secciones."],
        ["Estadisticas", "/admin/stats",      "Dashboard completo: graficos por dia/hora/actividad/profesor, ocupacion, tendencia semanal, resumen de pagos. Filtros por periodo/profesor/actividad/espacio."],
        ["Calendario",   "/calendar",          "Vista semanal de todas las reservas. Crear franjas manuales."],
        ["Profesores",   "/admin/teachers",   "Gestionar profesores, asignar actividades, conectar Telegram."],
        ["Clientes",     "/admin/clients",    "Lista con filtros (estado, Telegram). Aprobar, rechazar, ver ficha."],
        ["Actividades",  "/admin/activities", "Crear y editar actividades (nombre, capacidad, duracion, color)."],
        ["Espacios",     "/admin/spaces",     "Gestionar SALA y EXTERIOR."],
        ["Telegram",     "/admin/telegram",   "Panel de control del bot: usuarios conectados, broadcast, logs, mensajes de prueba."],
        ["Invitar",      "/admin/invite",     "Generar enlace de invitacion. Compartir via WhatsApp, email o copiar."],
        ["Ajustes",      "/settings",         "Configuracion general, horarios, cancelacion, Telegram, colores."],
    ]
    rows10_p = [[Paragraph(c, S["td"]) for c in row] for row in rows10]
    story.append(gtable(["Seccion","Ruta","Descripcion"], rows10_p,
                        [30*mm, 42*mm, COL_W - 72*mm]))

    story.append(PageBreak())

    # ── SECTION 11 — PWA ─────────────────────────────────────────────────────
    story.append(section_header("Instalacion en Movil / Desktop (PWA)", 11))
    story.append(sp())
    story.append(Paragraph(
        "GymBook es una <b>Progressive Web App (PWA)</b> - se puede instalar como app nativa "
        "sin pasar por la App Store ni Google Play.", S["body"]))
    story.append(sp(6))

    pwa_platforms = [
        ("iPhone / iPad (Safari)", [
            "Abrir gymbook-app-production.up.railway.app en Safari.",
            "Pulsar el boton compartir.",
            "Seleccionar 'Anadir a pantalla de inicio'.",
            "El icono naranja de GymBook aparecera como una app mas.",
        ]),
        ("Android (Chrome)", [
            "Abrir la URL en Chrome.",
            "Pulsar el menu (tres puntos) -> 'Anadir a pantalla de inicio'.",
            "Tambien puede aparecer un banner automatico de instalacion.",
        ]),
        ("Desktop - Chrome / Edge", [
            "Abrir la URL en el navegador.",
            "Clic en el icono de instalacion en la barra de direccion.",
            "Seleccionar 'Instalar GymBook'.",
        ]),
    ]
    for platform, steps in pwa_platforms:
        story.append(Paragraph(platform, S["subsection"]))
        for i, s in enumerate(steps, 1):
            story.append(Paragraph(f"{i}. {s}", S["step"]))
        story.append(sp(4))

    story.append(info_box(
        "Ventajas: pantalla completa sin barra del navegador - funciona como app nativa "
        "- icono naranja en pantalla de inicio - carga rapida."))

    # ── SECTION 12 — Reglas de negocio ───────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Reglas de Negocio Clave", 12))
    story.append(sp())
    for rule in [
        "Un profesor puede impartir varias actividades (relacion many-to-many).",
        "Un cliente puede tener maximo 2 profesores asignados.",
        "Entrenamiento Personal: 1 cliente por sesion (tipo INDIVIDUAL).",
        "Yoga / SGT: maximo 5 clientes por sesion (configurable en Ajustes).",
        "No hay solapamientos de espacio ni de profesor - validacion automatica.",
        "Los clientes solo pueden reservar con sus profesores asignados.",
        "El cliente nuevo esta en estado PENDIENTE hasta que el admin lo aprueba.",
        "Las contrasenas se guardan siempre hasheadas con bcrypt (nunca en texto plano).",
        "El telegram_chat_id es necesario para recibir mensajes; sin el las notificaciones se omiten sin errores criticos.",
        "Los creditos caducan automaticamente a los 6 meses (configurable).",
        "La devolucion de credito solo aplica si se cancela dentro del limite de tiempo configurado.",
    ]:
        story.append(Paragraph(f"[ok]  {rule}", S["check"]))

    # ── SECTION 13 — Stack ────────────────────────────────────────────────────
    story.append(sp(8))
    story.append(section_header("Stack Tecnico", 13))
    story.append(sp())
    rows13 = [
        ["Frontend",    "Next.js 16, TypeScript, Tailwind CSS, FullCalendar 6, Recharts"],
        ["Backend",     "Next.js API Routes (App Router)"],
        ["ORM / DB",    "Prisma 5 ORM + PostgreSQL en Railway"],
        ["Auth",        "NextAuth v5 (JWT strategy, Credentials provider)"],
        ["Despliegue",  "Railway (auto-deploy desde GitHub)"],
        ["Repositorio", "github.com/pimaxinvest-byte/Gymbook"],
        ["Produccion",  "gymbook-app-production.up.railway.app"],
        ["Telegram",    "Bot API v7 - Webhook + comandos inline"],
    ]
    rows13_p = [[Paragraph(c, S["td"]) for c in row] for row in rows13]
    story.append(gtable(["Capa","Tecnologia"], rows13_p, [34*mm, COL_W - 34*mm]))

    # ── BACK COVER ────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Spacer(1, 40 * mm))

    gb_p = Paragraph("GB", ps("gb", fontName="Helvetica-Bold", fontSize=42,
                               textColor=WHITE, alignment=TA_CENTER))
    gb_t = Table([[gb_p]], colWidths=[80 * mm])
    gb_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ORANGE),
        ("TOPPADDING",    (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
    ]))
    story.append(centre_table(gb_t))
    story.append(sp(10 * mm))

    story.append(Paragraph("gymbook-app-production.up.railway.app", S["back_body"]))
    story.append(Paragraph("Bot Telegram: @Daddysgymbook_bot",       S["back_small"]))
    story.append(sp(4))
    story.append(Paragraph("Desarrollado por Pietro Anoe . @rohypus", S["back_small"]))
    story.append(Paragraph("GymBook v1.2.0 . 2025",                   S["back_small"]))

    return story


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=14 * mm, bottomMargin=14 * mm,
        title="GymBook - Guia de Inicio Rapido",
        author="Pietro Anoe",
        subject="Sistema de reservas para gimnasio",
        creator="GymBook v1.2.0",
    )
    story = build_story()
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"OK -> {OUTPUT}")


if __name__ == "__main__":
    main()
