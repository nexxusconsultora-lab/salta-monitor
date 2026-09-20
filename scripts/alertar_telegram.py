#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/alertar_telegram.py

Envía un mensaje de Telegram por cada publicación oficial nueva que
nombra a alguien de tu lista de políticos. Lee el archivo que deja
scripts/oficiales.py en data/oficiales_nuevas_con_personas.json.

Es 100% opcional. Si no configuraste los dos Secrets de abajo, este
script no hace nada y termina sin error (no rompe el workflow).

Cómo activarlo (una sola vez):
  1. Hablale a @BotFather en Telegram, mandale /newbot y seguí las
     instrucciones. Te va a dar un token (algo como
     123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx).
  2. Mandale un mensaje cualquiera a tu bot nuevo (para "activarlo").
  3. Abrí en el navegador:
     https://api.telegram.org/bot<TU_TOKEN>/getUpdates
     y buscá el número "id" dentro de "chat": ese es tu TELEGRAM_CHAT_ID.
  4. En GitHub: Settings → Secrets and variables → Actions → New
     repository secret. Cargá dos secrets:
       TELEGRAM_BOT_TOKEN = el token de BotFather
       TELEGRAM_CHAT_ID   = el id que sacaste en el paso 3
  5. Listo: a partir de la próxima corrida del workflow, si alguna
     publicación nueva nombra a alguien de tu lista, te va a llegar un
     mensaje de Telegram con el título y el enlace.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALERTAS_PATH = ROOT / "data" / "oficiales_nuevas_con_personas.json"


def enviar_mensaje(token: str, chat_id: str, texto: str) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    datos = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": texto,
        "parse_mode": "HTML",
        "disable_web_page_preview": "false",
    }).encode("utf-8")
    req = urllib.request.Request(url, data=datos, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("Alertas de Telegram no configuradas (faltan los Secrets). Se omite este paso.")
        return 0

    if not ALERTAS_PATH.exists():
        print("No hay publicaciones nuevas con personas para avisar en esta corrida.")
        return 0

    try:
        pendientes = json.loads(ALERTAS_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"No se pudo leer {ALERTAS_PATH}: {e}")
        return 0

    if not pendientes:
        print("No hay publicaciones nuevas con personas para avisar en esta corrida.")
        return 0

    enviados, fallidos = 0, 0
    for item in pendientes:
        nombres = ", ".join(item.get("personas_nombres") or item.get("personas") or [])
        texto = (
            f"📄 <b>{item.get('fuente', '')}</b>\n"
            f"{item.get('titulo', '')}\n"
            f"Nombra a: {nombres}\n"
            f"{item.get('url', '')}"
        )
        try:
            enviar_mensaje(token, chat_id, texto)
            enviados += 1
        except Exception as e:
            fallidos += 1
            print(f"No se pudo enviar el aviso de '{item.get('titulo', '')[:60]}': {e}")

    print(f"Avisos de Telegram: {enviados} enviado(s), {fallidos} con error.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
