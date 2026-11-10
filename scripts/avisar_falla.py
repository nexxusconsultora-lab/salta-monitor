# -*- coding: utf-8 -*-
"""
NEWAR · Aviso corto al celular (ntfy y/o Telegram).

Se usa para que NO te enteres a la mañana de que algo falló la noche de una elección. Usa los mismos secretos que
scripts/notificar.py, así que no hay nada nuevo que configurar:
    NTFY_TOPIC, NTFY_SERVER (opcional), NTFY_TOKEN (opcional), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.

Uso desde la línea de comandos:
    python scripts/avisar_falla.py "Título" "Texto del aviso" --enlace https://...

Reglas: nunca imprime los secretos; si no hay ningún canal configurado, lo dice y sigue (no rompe nada); un aviso que
no se pudo enviar jamás hace fallar el programa que lo pidió. Sin dependencias: usa solo lo que trae Python.
"""
import os, re, sys, json, time, argparse, urllib.request, urllib.error

INTENTOS, ESPERA = 3, 2.0
UA = "NEWAR-avisos/1.0"
MAX_TITULO, MAX_TEXTO = 120, 1500


def _ocultar(txt, secretos):
    for s in secretos:
        if s and len(s) >= 4:
            txt = txt.replace(s, "***")
    return txt


def _post(url, cuerpo, cabeceras, secretos):
    datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
    cab = {"Content-Type": "application/json; charset=utf-8", "User-Agent": UA}
    cab.update(cabeceras)
    ultimo = ""
    for intento in range(1, INTENTOS + 1):
        try:
            req = urllib.request.Request(url, data=datos, headers=cab, method="POST")
            with urllib.request.urlopen(req, timeout=20) as r:
                if 200 <= r.status < 300:
                    return True, ""
                ultimo = f"respuesta {r.status}"
        except urllib.error.HTTPError as e:
            ultimo = f"HTTP {e.code}"
            if e.code in (400, 401, 403, 404):  # configuración mala: reintentar no sirve
                return False, ultimo
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            ultimo = _ocultar(f"error de red ({getattr(e, 'reason', e)})", secretos)
        if intento < INTENTOS:
            time.sleep(ESPERA * intento)
    return False, ultimo


def enviar(titulo, texto, enlace=None):
    """Manda el aviso por todos los canales configurados. Devuelve True si al menos uno lo recibió."""
    env = os.environ
    topic = (env.get("NTFY_TOPIC") or "").strip()
    server = ((env.get("NTFY_SERVER") or "").strip() or "https://ntfy.sh").rstrip("/")
    token = (env.get("NTFY_TOKEN") or "").strip()
    bot = (env.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat = (env.get("TELEGRAM_CHAT_ID") or "").strip()
    api = ((env.get("TELEGRAM_API_URL") or "").strip() or "https://api.telegram.org").rstrip("/")
    secretos = [topic, token, bot, chat]
    titulo, texto = str(titulo)[:MAX_TITULO], str(texto)[:MAX_TEXTO]
    ok, hubo_canal = False, False

    if topic:
        hubo_canal = True
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", topic) or not server.startswith("https://"):
            print("  Aviso por ntfy omitido: NTFY_TOPIC o NTFY_SERVER no tienen el formato esperado.")
        else:
            cuerpo = {"topic": topic, "title": titulo, "message": texto, "tags": ["warning"], "priority": 4}
            if enlace and enlace.startswith("https://"):
                cuerpo["click"] = enlace
            bien, motivo = _post(server + "/", cuerpo, {"Authorization": f"Bearer {token}"} if token else {}, secretos)
            print("  Aviso por ntfy:", "enviado" if bien else f"NO se pudo enviar ({motivo})")
            ok = ok or bien

    if bot or chat:
        hubo_canal = True
        if not (bot and chat) or not re.fullmatch(r"\d{6,12}:[A-Za-z0-9_-]{30,50}", bot) or not api.startswith("https://"):
            print("  Aviso por Telegram omitido: faltan o son inválidos TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID.")
        else:
            msg = f"⚠️ {titulo}\n\n{texto}" + (f"\n\n{enlace}" if enlace and enlace.startswith("https://") else "")
            bien, motivo = _post(f"{api}/bot{bot}/sendMessage", {"chat_id": chat, "text": msg[:4000], "disable_web_page_preview": True}, {}, secretos)
            print("  Aviso por Telegram:", "enviado" if bien else f"NO se pudo enviar ({motivo})")
            ok = ok or bien

    if not hubo_canal:
        print("  No hay ningún canal de avisos configurado (NTFY_TOPIC o TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID): el aviso no salió del registro.")
    return ok


def main(argv=None):
    ap = argparse.ArgumentParser(description="Manda un aviso corto al celular")
    ap.add_argument("titulo")
    ap.add_argument("texto", nargs="?", default="")
    ap.add_argument("--enlace", default=None)
    a = ap.parse_args(argv)
    enviar(a.titulo, a.texto, a.enlace)
    return 0  # un aviso que no sale nunca debe tapar el error original


if __name__ == "__main__":
    sys.exit(main())
