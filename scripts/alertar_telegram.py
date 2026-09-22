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
CANDIDATOS_PATH = ROOT / "data" / "candidatos.json"
CANDIDATOS_AVISADOS_PATH = ROOT / "data" / "candidatos_avisados.json"


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

    enviados, fallidos = 0, 0

    pendientes = []
    if ALERTAS_PATH.exists():
        try:
            pendientes = json.loads(ALERTAS_PATH.read_text(encoding="utf-8")) or []
        except Exception as e:
            print(f"No se pudo leer {ALERTAS_PATH}: {e}")

    if not pendientes:
        print("No hay publicaciones oficiales nuevas con personas para avisar en esta corrida.")
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

    # Aviso aparte, una sola vez por nombre nuevo detectado (scripts/monitor.py).
    avisados = set(json.loads(CANDIDATOS_AVISADOS_PATH.read_text(encoding="utf-8"))) \
        if CANDIDATOS_AVISADOS_PATH.exists() else set()
    try:
        candidatos = json.loads(CANDIDATOS_PATH.read_text(encoding="utf-8")).get("items", [])
    except Exception:
        candidatos = []

    nuevos = [c for c in candidatos if c["name"] not in avisados and c.get("count", 0) >= 2]
    for c in nuevos:
        ejemplo = (c.get("examples") or [{}])[0]
        texto = (
            f"🆕 <b>Nombre nuevo detectado</b>\n"
            f"{c['name']} — mencionado como \"{c.get('cargo_texto', '')}\" ({c.get('count', 0)} veces)\n"
            f"No está en tu lista de politicians.json. Revisalo y agregalo si corresponde.\n"
            f"{ejemplo.get('title', '')}\n{ejemplo.get('link', '')}"
        )
        try:
            enviar_mensaje(token, chat_id, texto)
            avisados.add(c["name"])
            enviados += 1
        except Exception as e:
            fallidos += 1
            print(f"No se pudo enviar el aviso de nombre nuevo '{c['name']}': {e}")

    if nuevos:
        CANDIDATOS_AVISADOS_PATH.write_text(
            json.dumps(sorted(avisados), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    print(f"Avisos de Telegram: {enviados} enviado(s), {fallidos} con error.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
