"""
GymBook Quick Start Guide PDF Generator
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import Flowable

# Brand colours
ORANGE      = colors.HexColor("#f97316")
ORANGE_DARK = colors.HexColor("#ea580c")
ORANGE_LIGHT= colors.HexColor("#fff7ed")
GRAY_900    = colors.HexColor("#111827")
GRAY_600    = colors.HexColor("#4b5563")
GRAY_400    = colors.HexColor("#9ca3af")
GRAY_100    = colors.HexColor("#f3f4f6")
BLUE        = colors.HexColor("#2563eb")
PURPLE      = colors.HexColor("#7c3aed")
GREEN       = colors.HexColor("#16a34a")
GREEN_LIGHT = colors.HexColor("#f0fdf4")
AMBER_LIGHT = colors.HexColor("#fffbeb")
AMBER       = colors.HexColor("#d97706")

W, H = A4

# ── Styles ────────────────────────────────────────────────────────────────────

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

cover_title = S("CoverTitle",
    fontSize=36, leading=44, textColor=GRAY_900,
    fontName="Helvetica-Bold", alignment=TA_CENTER)

cover_sub = S("CoverSub",
    fontSize=15, leading=22, textColor=GRAY_600,
    fontName="Helvetica", alignment=TA_CENTER)

cover_meta = S("CoverMeta",
    fontSize=11, leading=18, textColor=GRAY_400,
    fontName="Helvetica", alignment=TA_CENTER)

h1 = S("H1",
    fontSize=18, leading=26, textColor=ORANGE_DARK,
    fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=6)

h2 = S("H2",
    fontSize=13, leading=20, textColor=GRAY_900,
    fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=4)

body = S("Body",
    fontSize=10, leading=16, textColor=GRAY_600,
    fontName="Helvetica", spaceAfter=4)

body_bold = S("BodyBold",
    fontSize=10, leading=16, textColor=GRAY_900,
    fontName="Helvetica-Bold", spaceAfter=2)

bullet = S("Bullet",
    fontSize=10, leading=16, textColor=GRAY_600,
    fontName="Helvetica", leftIndent=16, spaceAfter=3)

step = S("Step",
    fontSize=10, leading=16, textColor=GRAY_900,
    fontName="Helvetica-Bold", leftIndent=0, spaceAfter=2)

code_style = S("Code",
    fontSize=9, leading=14, textColor=colors.HexColor("#374151"),
    fontName="Courier", backColor=GRAY_100,
    borderPadding=(4, 8, 4, 8), spaceAfter=4)

note = S("Note",
    fontSize=9, leading=14, textColor=AMBER,
    fontName="Helvetica-Oblique", leftIndent=10)

footer_style = S("Footer",
    fontSize=8, leading=12, textColor=GRAY_400,
    fontName="Helvetica", alignment=TA_CENTER)

# ── Helpers ───────────────────────────────────────────────────────────────────

def hr():
    return HRFlowable(width="100%", thickness=1, color=GRAY_100,
                       spaceAfter=8, spaceBefore=4)

def section_rule():
    return HRFlowable(width="100%", thickness=2, color=ORANGE,
                       spaceAfter=10, spaceBefore=2)

def sp(h=6):
    return Spacer(1, h)

def orange_box(text, style=None):
    """A paragraph inside an orange-tinted box."""
    st = style or body
    data = [[Paragraph(text, st)]]
    t = Table(data, colWidths=[W - 4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), ORANGE_LIGHT),
        ("BOX",        (0,0), (-1,-1), 1, ORANGE),
        ("LEFTPADDING",  (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
        ("ROUNDED",      (0,0), (-1,-1), 6),
    ]))
    return t

def green_box(text):
    data = [[Paragraph(text, S("gb", fontSize=10, leading=16, textColor=GREEN, fontName="Helvetica"))]]
    t = Table(data, colWidths=[W - 4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), GREEN_LIGHT),
        ("BOX",        (0,0), (-1,-1), 1, GREEN),
        ("LEFTPADDING",  (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
    ]))
    return t

def amber_box(text):
    data = [[Paragraph(text, S("ab", fontSize=10, leading=16, textColor=AMBER, fontName="Helvetica"))]]
    t = Table(data, colWidths=[W - 4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), AMBER_LIGHT),
        ("BOX",        (0,0), (-1,-1), 1, AMBER),
        ("LEFTPADDING",  (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
    ]))
    return t

def cmd_table(rows):
    """Table for Telegram commands."""
    tdata = []
    for cmd, desc in rows:
        tdata.append([
            Paragraph(cmd,  S("cmd", fontSize=9, fontName="Courier", textColor=ORANGE_DARK)),
            Paragraph(desc, S("cdesc", fontSize=9, fontName="Helvetica", textColor=GRAY_600)),
        ])
    t = Table(tdata, colWidths=[3.5*cm, W - 4*cm - 3.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), GRAY_100),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, GRAY_100]),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("GRID", (0,0), (-1,-1), 0.5, GRAY_100),
    ]))
    return t

def steps_table(steps):
    tdata = []
    for i, (title, desc) in enumerate(steps, 1):
        num = Paragraph(f"<b>{i}</b>",
            S("sn", fontSize=13, fontName="Helvetica-Bold",
              textColor=colors.white, alignment=TA_CENTER))
        content = Paragraph(f"<b>{title}</b><br/>{desc}",
            S("sc", fontSize=10, leading=15, fontName="Helvetica", textColor=GRAY_900))
        tdata.append([num, content])
    t = Table(tdata, colWidths=[1*cm, W - 4*cm - 1*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (0,-1), ORANGE),
        ("BACKGROUND",    (1,0), (1,-1), colors.white),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",   (0,0), (0,-1), 4),
        ("RIGHTPADDING",  (0,0), (0,-1), 4),
        ("LEFTPADDING",   (1,0), (1,-1), 10),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("LINEBELOW", (0,0), (-1,-2), 0.5, GRAY_100),
        ("BOX", (0,0), (-1,-1), 1, GRAY_100),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t

def role_card(role, color, emoji, items):
    lines = [f"<b>{emoji} {role}</b>"]
    for item in items:
        lines.append(f"  • {item}")
    text = "<br/>".join(lines)
    st = S("rc", fontSize=10, leading=16, textColor=GRAY_900, fontName="Helvetica")
    data = [[Paragraph(text, st)]]
    t = Table(data, colWidths=[(W - 4*cm - 0.4*cm) / 3])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.white),
        ("BOX",        (0,0), (-1,-1), 2, color),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING",   (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
    ]))
    return t

# ── Page callbacks ─────────────────────────────────────────────────────────────

def on_page(canvas, doc):
    if doc.page == 1:
        return  # No footer on cover
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(2*cm, 1.2*cm, "GymBook — Guia de Inicio Rapido  v1.2.0")
    canvas.drawRightString(W - 2*cm, 1.2*cm, f"Pagina {doc.page - 1}")
    canvas.setStrokeColor(GRAY_100)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.6*cm, W - 2*cm, 1.6*cm)
    canvas.restoreState()

# ── Build content ──────────────────────────────────────────────────────────────

story = []

# ────────────────────────────────────────────────────────────── COVER PAGE ──

story.append(Spacer(1, 3.5*cm))

# Orange accent bar
accent = Table([[""]], colWidths=[3*cm], rowHeights=[0.35*cm])
accent.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), ORANGE),
    ("LEFTPADDING", (0,0), (-1,-1), 0),
]))
wrapper = Table([[accent]], colWidths=[W - 4*cm])
wrapper.setStyle(TableStyle([("ALIGN", (0,0), (-1,-1), "CENTER")]))
story.append(wrapper)
story.append(sp(20))

story.append(Paragraph("GymBook", cover_title))
story.append(sp(8))
story.append(Paragraph("Guia de Inicio Rapido", cover_sub))
story.append(sp(4))
story.append(Paragraph("Sistema de reservas para gimnasio", S("csub2",
    fontSize=13, textColor=GRAY_400, fontName="Helvetica", alignment=TA_CENTER)))

story.append(sp(40))

# Info box
info_data = [
    ["Version",  "1.2.0"],
    ["URL",      "gymbook-app-production.up.railway.app"],
    ["Bot",      "@Daddysgymbook_bot"],
    ["Soporte",  "@rohypus · Pietro Anoe"],
]
info_t = Table(info_data, colWidths=[3*cm, 9*cm])
info_t.setStyle(TableStyle([
    ("FONTNAME",  (0,0), (0,-1), "Helvetica-Bold"),
    ("FONTNAME",  (1,0), (1,-1), "Helvetica"),
    ("FONTSIZE",  (0,0), (-1,-1), 11),
    ("TEXTCOLOR", (0,0), (0,-1), GRAY_900),
    ("TEXTCOLOR", (1,0), (1,-1), ORANGE_DARK),
    ("TOPPADDING",    (0,0), (-1,-1), 6),
    ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("BACKGROUND", (0,0), (-1,-1), ORANGE_LIGHT),
    ("BOX", (0,0), (-1,-1), 1.5, ORANGE),
    ("LINEBELOW", (0,0), (-1,-2), 0.5, ORANGE),
]))
info_wrap = Table([[info_t]], colWidths=[W - 4*cm])
info_wrap.setStyle(TableStyle([("ALIGN", (0,0), (-1,-1), "CENTER")]))
story.append(info_wrap)

story.append(sp(60))
story.append(Paragraph("2025 — Todos los derechos reservados", cover_meta))
story.append(PageBreak())

# ────────────────────────────────────────── 1. ACCESOS INICIALES ──

story.append(Paragraph("1. Accesos Iniciales", h1))
story.append(section_rule())
story.append(sp(4))

acc_headers = [
    Paragraph("<b>Rol</b>",         body_bold),
    Paragraph("<b>Email</b>",       body_bold),
    Paragraph("<b>Contrasena</b>",  body_bold),
    Paragraph("<b>Descripcion</b>", body_bold),
]
acc_rows = [
    acc_headers,
    [Paragraph("Admin",   body), Paragraph("admin@gymbook.com",      body), Paragraph("admin123",   body), Paragraph("Acceso completo",                    body)],
    [Paragraph("Profesor",body), Paragraph("max.romeo@me.com",       body), Paragraph("Max123",     body), Paragraph("Max Romeo — Entrenamiento Personal", body)],
    [Paragraph("Profesor",body), Paragraph("rohypus@gmail.com",      body), Paragraph("Pietro123",  body), Paragraph("Pietro Anoe — Entrenamiento Personal",body)],
    [Paragraph("Profesor",body), Paragraph("lolamarca@hotmail.es",   body), Paragraph("(ver seed)", body), Paragraph("Lola Martin Carmona — Yoga",         body)],
]
acc_t = Table(acc_rows, colWidths=[2.2*cm, 5.2*cm, 2.8*cm, 7.3*cm])
acc_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0),  ORANGE),
    ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
    ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,-1), 9),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, ORANGE_LIGHT]),
    ("GRID",          (0,0), (-1,-1), 0.5, GRAY_100),
    ("TOPPADDING",    (0,0), (-1,-1), 6),
    ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ("RIGHTPADDING",  (0,0), (-1,-1), 8),
    ("ALIGN",         (0,0), (-1,-1), "LEFT"),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
]))
story.append(acc_t)
story.append(sp(8))
story.append(amber_box("IMPORTANTE: Cambiar las contrasenas en el primer inicio de sesion desde Ajustes → Mi perfil."))

# ────────────────────────────────────────── 2. ROLES Y PERMISOS ──

story.append(sp(14))
story.append(Paragraph("2. Roles y Permisos", h1))
story.append(section_rule())

admin_card  = role_card("ADMIN",   ORANGE,  "🛡",  ["Panel completo", "Aprueba clientes", "Gestiona profesores y actividades", "Configura Telegram"])
teacher_card= role_card("PROFESOR",BLUE,    "👨‍🏫", ["Planning semanal", "Abre disponibilidad", "Gestiona creditos", "Notificaciones Telegram"])
client_card = role_card("CLIENTE", PURPLE,  "👤",  ["Reserva sesiones", "Ve sus creditos", "Historial de reservas", "Notificaciones Telegram"])

cards_t = Table([[admin_card, sp(6), teacher_card, sp(6), client_card]],
    colWidths=[(W-4*cm-0.4*cm)/3, 0.2*cm, (W-4*cm-0.4*cm)/3, 0.2*cm, (W-4*cm-0.4*cm)/3])
cards_t.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING",  (0,0), (-1,-1), 0),
    ("RIGHTPADDING", (0,0), (-1,-1), 0),
    ("TOPPADDING",   (0,0), (-1,-1), 0),
    ("BOTTOMPADDING",(0,0), (-1,-1), 0),
]))
story.append(cards_t)

# ────────────────────────────────────────── 3. ONBOARDING CLIENTE ──

story.append(sp(14))
story.append(Paragraph("3. Flujo de Onboarding de Cliente", h1))
story.append(section_rule())
story.append(sp(4))

onboard_steps = [
    ("Registro", "Cliente accede a /register y rellena: nombre, apellido, email, contrasena, telefono, Telegram (opcional), objetivo."),
    ("Acepta condiciones", "Marca la casilla de aceptacion de terminos y envia la solicitud."),
    ("Notificacion admin", "El admin recibe aviso por Telegram y en el panel /admin/clients."),
    ("Aprobacion / Rechazo", "Admin aprueba o rechaza desde la ficha del cliente en el panel."),
    ("Activacion", "Si aprueba: el cliente recibe mensaje de bienvenida por Telegram y puede reservar."),
    ("Rechazo", "Si rechaza: el cliente recibe notificacion con el motivo indicado por el admin."),
]
story.append(steps_table(onboard_steps))

# ────────────────────────────────────────── 4. ESPACIOS ──

story.append(sp(14))
story.append(Paragraph("4. Gestion de Espacios", h1))
story.append(section_rule())

spaces_rows = [
    [Paragraph("<b>Espacio</b>", body_bold), Paragraph("<b>Tipo</b>", body_bold), Paragraph("<b>Capacidad</b>", body_bold), Paragraph("<b>Regla</b>", body_bold)],
    [Paragraph("SALA",     body), Paragraph("Interior",  body), Paragraph("Max 10 personas", body), Paragraph("Un profesor a la vez", body)],
    [Paragraph("EXTERIOR", body), Paragraph("Exterior",  body), Paragraph("Max 20 personas", body), Paragraph("Un profesor a la vez", body)],
]
sp_t = Table(spaces_rows, colWidths=[3*cm, 3.5*cm, 4*cm, 7*cm])
sp_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0),  ORANGE),
    ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
    ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,-1), 10),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, ORANGE_LIGHT]),
    ("GRID",          (0,0), (-1,-1), 0.5, GRAY_100),
    ("TOPPADDING",    (0,0), (-1,-1), 8),
    ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ("LEFTPADDING",   (0,0), (-1,-1), 10),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
]))
story.append(sp_t)
story.append(sp(8))
story.append(orange_box("<b>Regla critica:</b> El sistema valida automaticamente que no existan dos reservas activas en el mismo espacio a la misma hora. Si hay conflicto, la accion se bloquea y se muestra un mensaje de error claro."))

# ────────────────────────────────────────── 5. ACTIVIDADES ──

story.append(sp(14))
story.append(Paragraph("5. Actividades Disponibles", h1))
story.append(section_rule())

act_rows = [
    [Paragraph("<b>Actividad</b>",  body_bold), Paragraph("<b>Duracion</b>", body_bold), Paragraph("<b>Capacidad</b>", body_bold), Paragraph("<b>Tipo</b>", body_bold)],
    [Paragraph("Entrenamiento Personal", body), Paragraph("60 min", body), Paragraph("1 cliente",  body), Paragraph("INDIVIDUAL", body)],
    [Paragraph("Yoga",                  body), Paragraph("60 min", body), Paragraph("5 clientes", body), Paragraph("SGT (Small Group Training)", body)],
]
act_t = Table(act_rows, colWidths=[5.5*cm, 3*cm, 3.5*cm, 5.5*cm])
act_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0),  ORANGE),
    ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
    ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,-1), 10),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, ORANGE_LIGHT]),
    ("GRID",          (0,0), (-1,-1), 0.5, GRAY_100),
    ("TOPPADDING",    (0,0), (-1,-1), 8),
    ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ("LEFTPADDING",   (0,0), (-1,-1), 10),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
]))
story.append(act_t)
story.append(sp(8))
story.append(Paragraph("Para anadir nuevas actividades: Admin → /admin/activities → Nueva actividad (nombre, capacidad, duracion, color, estado activo/inactivo).", body))

story.append(PageBreak())

# ────────────────────────────────────────── 6. DISPONIBILIDAD (PROFESOR) ──

story.append(Paragraph("6. Como el Profesor Abre Disponibilidad", h1))
story.append(section_rule())
story.append(sp(4))

avail_steps = [
    ("Iniciar sesion", "Acceder con las credenciales de profesor."),
    ("Ir a Disponib.", "Pulsar 'Disponib.' en el menu inferior de la aplicacion."),
    ("Nueva disponibilidad", "Pulsar el boton 'Nueva disponibilidad'."),
    ("Rellenar formulario", "Seleccionar actividad, espacio, hora inicio. El fin se calcula automaticamente (+60 min). Elegir tipo: Individual o SGT."),
    ("Puntual o recurrente", "Puntual: seleccionar fecha. Recurrente: marcar dias de la semana y rango de fechas."),
    ("Crear", "El sistema valida conflictos de espacio y profesor antes de crear la franja. Si hay conflicto, lo muestra y bloquea."),
]
story.append(steps_table(avail_steps))

# ────────────────────────────────────────── 7. RESERVA (CLIENTE) ──

story.append(sp(14))
story.append(Paragraph("7. Como el Cliente Reserva una Sesion", h1))
story.append(section_rule())
story.append(sp(4))

book_steps = [
    ("Iniciar sesion", "Acceder con credenciales de cliente (debe estar ACTIVO)."),
    ("Ir a Reservar", "Pulsar 'Reservar' en el menu inferior."),
    ("Ver franjas disponibles", "Se muestran las sesiones disponibles de sus profesores asignados."),
    ("Verificar creditos", "Cada franja muestra el saldo de creditos del cliente para ese profesor y tipo."),
    ("Reservar", "Pulsar 'Reservar'. Se descuenta 1 credito automaticamente."),
    ("Confirmacion", "El cliente recibe confirmacion en la app y notificacion por Telegram."),
]
story.append(steps_table(book_steps))
story.append(sp(8))
story.append(green_box("El profesor puede tambien reservar sesiones para sus clientes directamente desde el panel /teacher/clients."))

# ────────────────────────────────────────── 8. CREDITOS ──

story.append(sp(14))
story.append(Paragraph("8. Sistema de Creditos", h1))
story.append(section_rule())

cred_items = [
    ("Tipos de credito", "INDIVIDUAL (sesiones 1:1) y SGT (sesiones en grupo). Cada tipo se gestiona por separado."),
    ("Asignacion", "El admin o el profesor asigna creditos desde /teacher/clients → ficha del cliente → + creditos."),
    ("Caducidad", "Los creditos caducan 6 meses despues de la ultima asignacion (configurable en Ajustes)."),
    ("Devolucion", "Si el cliente cancela con mas de 24h de antelacion (configurable), se devuelve el credito."),
    ("Historial", "Log completo de transacciones (asignado, descontado, devuelto) visible para el cliente y el admin."),
]
for title, desc in cred_items:
    story.append(Paragraph(f"<b>{title}:</b> {desc}", bullet))

# ────────────────────────────────────────── 9. TELEGRAM ──

story.append(sp(14))
story.append(Paragraph("9. Telegram — Configuracion y Comandos", h1))
story.append(section_rule())
story.append(sp(4))

tg_info = [
    ["Bot",     "@Daddysgymbook_bot"],
    ["Token",   "[configurado en TELEGRAM_BOT_TOKEN — ver .env.local / Railway]"],
    ["Webhook", "gymbook-app-production.up.railway.app/api/telegram/webhook"],
]
tg_t = Table(tg_info, colWidths=[2.5*cm, W - 4*cm - 2.5*cm])
tg_t.setStyle(TableStyle([
    ("FONTNAME",  (0,0), (0,-1), "Helvetica-Bold"),
    ("FONTSIZE",  (0,0), (-1,-1), 9),
    ("FONTNAME",  (1,0), (1,-1), "Courier"),
    ("TEXTCOLOR", (0,0), (0,-1), GRAY_900),
    ("TEXTCOLOR", (1,0), (1,-1), BLUE),
    ("TOPPADDING",    (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ("BACKGROUND", (0,0), (-1,-1), GRAY_100),
    ("LINEBELOW", (0,0), (-1,-2), 0.5, colors.white),
    ("BOX", (0,0), (-1,-1), 1, GRAY_400),
]))
story.append(tg_t)
story.append(sp(8))
story.append(Paragraph("Como conectar la cuenta: Ajustes → 'Conectar Telegram' → pulsar el enlace → escribir /start al bot.", body_bold))
story.append(sp(8))
story.append(Paragraph("Comandos disponibles:", body_bold))
story.append(sp(4))
story.append(cmd_table([
    ("/reservas", "Ver las proximas sesiones"),
    ("/cancelar", "Cancelar una reserva (muestra botones inline)"),
    ("/checkin",  "Confirmar asistencia a una sesion (disponible 2h antes)"),
    ("/creditos", "Ver el saldo de creditos por profesor y tipo"),
    ("/espera",   "Ver posicion en lista de espera"),
    ("/ayuda",    "Mostrar ayuda y lista de comandos"),
]))

story.append(PageBreak())

# ────────────────────────────────────────── 10. PANEL ADMIN ──

story.append(Paragraph("10. Panel de Administracion", h1))
story.append(section_rule())
story.append(sp(4))

admin_sections = [
    ("Dashboard",   "/admin/dashboard",  "Estadisticas globales: reservas, clientes, ingresos, ocupacion."),
    ("Calendario",  "/calendar",         "Vista semanal de todas las reservas. Crear franjas manuales."),
    ("Profesores",  "/admin/teachers",   "Gestionar profesores, asignar actividades, conectar Telegram, cambiar contrasena."),
    ("Clientes",    "/admin/clients",    "Lista de clientes con filtros (estado, Telegram). Aprobar, rechazar, ver ficha."),
    ("Actividades", "/admin/activities", "Crear y editar actividades (nombre, capacidad, duracion, color, activo/inactivo)."),
    ("Espacios",    "/admin/spaces",     "Gestionar SALA y EXTERIOR."),
    ("Ajustes",     "/settings",         "Config general, horarios, politica de cancelacion, Telegram bot, colores."),
]
sec_rows = [[
    Paragraph("<b>Seccion</b>", body_bold),
    Paragraph("<b>Ruta</b>", body_bold),
    Paragraph("<b>Descripcion</b>", body_bold),
]]
for name, route, desc in admin_sections:
    sec_rows.append([
        Paragraph(name,  body),
        Paragraph(route, S("rt", fontSize=9, fontName="Courier", textColor=BLUE)),
        Paragraph(desc,  body),
    ])
sec_t = Table(sec_rows, colWidths=[2.8*cm, 4.5*cm, W - 4*cm - 7.3*cm])
sec_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0),  ORANGE),
    ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
    ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,-1), 9),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, ORANGE_LIGHT]),
    ("GRID",          (0,0), (-1,-1), 0.5, GRAY_100),
    ("TOPPADDING",    (0,0), (-1,-1), 7),
    ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ("VALIGN",        (0,0), (-1,-1), "TOP"),
]))
story.append(sec_t)

# ────────────────────────────────────────── 11. REGLAS DE NEGOCIO ──

story.append(sp(14))
story.append(Paragraph("11. Reglas de Negocio Clave", h1))
story.append(section_rule())
story.append(sp(4))

rules = [
    "Un profesor puede impartir varias actividades (relacion many-to-many).",
    "Un cliente puede tener maximo 2 profesores asignados.",
    "Entrenamiento Personal: 1 cliente por sesion (tipo INDIVIDUAL).",
    "Yoga / SGT: maximo 5 clientes por sesion (configurable).",
    "No hay solapamientos de espacio ni de profesor — validacion automatica.",
    "Los clientes solo pueden reservar con sus profesores asignados.",
    "El cliente nuevo esta en estado PENDIENTE hasta que el admin lo aprueba.",
    "Las contrasenas se guardan siempre hasheadas con bcrypt (nunca en texto plano).",
    "El telegram_chat_id es necesario para recibir mensajes. El username solo es informativo.",
    "Si no hay chat_id, las notificaciones se omiten sin generar errores criticos.",
]
rules_data = [[Paragraph(f"• {r}", bullet)] for r in rules]
rules_t = Table(rules_data, colWidths=[W - 4*cm])
rules_t.setStyle(TableStyle([
    ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, ORANGE_LIGHT]),
    ("LEFTPADDING",    (0,0), (-1,-1), 12),
    ("RIGHTPADDING",   (0,0), (-1,-1), 12),
    ("TOPPADDING",     (0,0), (-1,-1), 5),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 5),
    ("BOX",            (0,0), (-1,-1), 1, GRAY_100),
]))
story.append(rules_t)

# ────────────────────────────────────────── 12. STACK TECNICO ──

story.append(sp(14))
story.append(Paragraph("12. Stack Tecnico", h1))
story.append(section_rule())
story.append(sp(4))

stack = [
    ("Frontend",    "Next.js 16, TypeScript, Tailwind CSS, FullCalendar 6"),
    ("Backend",     "Next.js API Routes (App Router)"),
    ("Base de datos","Prisma 5 ORM + PostgreSQL en Railway"),
    ("Auth",        "NextAuth v5 (JWT strategy, Credentials provider)"),
    ("Despliegue",  "Railway (auto-deploy desde GitHub)"),
    ("Repositorio", "github.com/pimaxinvest-byte/Gymbook"),
    ("Produccion",  "gymbook-app-production.up.railway.app"),
    ("Telegram",    "Bot API v7 — Webhook + comandos inline"),
]
stack_rows = [[
    Paragraph(k, body_bold),
    Paragraph(v, S("sv", fontSize=10, fontName="Courier", textColor=BLUE)),
] for k, v in stack]
stack_t = Table(stack_rows, colWidths=[3.5*cm, W - 4*cm - 3.5*cm])
stack_t.setStyle(TableStyle([
    ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, GRAY_100]),
    ("FONTSIZE",       (0,0), (-1,-1), 10),
    ("TOPPADDING",     (0,0), (-1,-1), 6),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 6),
    ("LEFTPADDING",    (0,0), (-1,-1), 8),
    ("BOX",            (0,0), (-1,-1), 1, GRAY_100),
    ("LINEBELOW",      (0,0), (-1,-2), 0.5, GRAY_100),
]))
story.append(stack_t)

# ────────────────────────────────────────── BACK COVER ──

story.append(PageBreak())
story.append(sp(5*cm))

back_accent = Table([[""]], colWidths=[W - 4*cm], rowHeights=[0.4*cm])
back_accent.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), ORANGE)]))
story.append(back_accent)
story.append(sp(24))

story.append(Paragraph("GymBook", S("bt", fontSize=28, fontName="Helvetica-Bold",
    textColor=GRAY_900, alignment=TA_CENTER)))
story.append(sp(6))
story.append(Paragraph("Sistema de reservas para gimnasio", S("bst",
    fontSize=13, textColor=GRAY_400, fontName="Helvetica", alignment=TA_CENTER)))
story.append(sp(24))
story.append(Paragraph("gymbook-app-production.up.railway.app", S("burl",
    fontSize=11, textColor=ORANGE_DARK, fontName="Courier", alignment=TA_CENTER)))
story.append(sp(8))
story.append(Paragraph("Bot Telegram: @Daddysgymbook_bot", S("btg",
    fontSize=11, textColor=BLUE, fontName="Helvetica", alignment=TA_CENTER)))
story.append(sp(32))
story.append(Paragraph("Desarrollado por Pietro Anoe  ·  @rohypus  ·  GymBook v1.2.0  ·  2025", footer_style))

# ── Build PDF ─────────────────────────────────────────────────────────────────

output_path = r"C:\Users\pietr\gym-booking\GymBook-QuickStart.pdf"

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm,  bottomMargin=2.5*cm,
    title="GymBook — Guia de Inicio Rapido",
    author="Pietro Anoe",
    subject="Sistema de reservas para gimnasio",
)

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f"PDF generado: {output_path}")
