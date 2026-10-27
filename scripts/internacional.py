# -*- coding: utf-8 -*-
"""
NEWAR · Prensa internacional.

Lee los titulares de diarios y agencias del mundo (The Economist, The Wall Street Journal, Miami Herald,
Financial Times, The New York Times, BBC, etc.) y los guarda en data/news_internacional.json.
Marca cuáles hablan de Argentina / Salta (campo "arg") y cuáles de América Latina (campo "lat").

Cómo sumar un diario: agregá un bloque a MEDIOS (nombre, país, idioma, lista de RSS y, opcional, el dominio
para buscarlo en Google News si el RSS propio no anda). Si un diario falla, el script lo anota en
data/internacional_status.json y sigue con los demás. Nada de esto inventa notas: cada fila es un titular
que el propio diario publicó, con su enlace.
No traduce: los titulares quedan en el idioma original.
"""
import os, re, json, hashlib, calendar, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import feedparser

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
OUT = os.path.join(DATA, "news_internacional.json")
ST = os.path.join(DATA, "internacional_status.json")
UA = "Mozilla/5.0 (compatible; NEWAR/1.0; lector de RSS)"
MAX_POR_FEED = 30
MAX_GUARDADAS = 6000
DIAS = 14


# Cada diario: (nombre, país, región, idioma, tipo, [(RSS, sección), ...], dominio_para_Google_News)
# tipo: "privado", "publico" (financiado por el Estado pero con independencia editorial declarada) o "estatal" (del gobierno).
# Si ninguno de sus RSS responde, se toman sus titulares desde Google News (site:dominio).
# Secciones: Mundo, Política, Economía, Negocios, Tecnología, Ciencia, Salud, Clima, Deportes, Cultura, General.
NY = "https://rss.nytimes.com/services/xml/rss/nyt/%s.xml"
BBC = "https://feeds.bbci.co.uk/news/%s/rss.xml"
GU = "https://www.theguardian.com/%s/rss"
EC = "https://www.economist.com/%s/rss.xml"
EP = "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/%s/portada"
MEDIOS = [
    # ---- Norteamérica
    ("The New York Times", "EE.UU.", "Norteamérica", "en", "privado", [(NY % "World", "Mundo"), (NY % "Americas", "Mundo"), (NY % "Business", "Economía"), (NY % "Technology", "Tecnología"), (NY % "Science", "Ciencia"), (NY % "Health", "Salud"), (NY % "Climate", "Clima"), (NY % "Sports", "Deportes"), (NY % "Arts", "Cultura"), (NY % "Politics", "Política")], "nytimes.com"),
    ("The Wall Street Journal", "EE.UU.", "Norteamérica", "en", "privado", [("https://feeds.a.dj.com/rss/RSSWorldNews.xml", "Mundo"), ("https://feeds.a.dj.com/rss/RSSMarketsMain.xml", "Economía"), ("https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml", "Negocios"), ("https://feeds.a.dj.com/rss/RSSWSJD.xml", "Tecnología")], "wsj.com"),
    ("The Washington Post", "EE.UU.", "Norteamérica", "en", "privado", [("https://feeds.washingtonpost.com/rss/world", "Mundo"), ("https://feeds.washingtonpost.com/rss/business", "Economía"), ("https://feeds.washingtonpost.com/rss/politics", "Política"), ("https://feeds.washingtonpost.com/rss/national", "General")], "washingtonpost.com"),
    ("Bloomberg", "EE.UU.", "Norteamérica", "en", "privado", [("https://feeds.bloomberg.com/markets/news.rss", "Economía"), ("https://feeds.bloomberg.com/politics/news.rss", "Política"), ("https://feeds.bloomberg.com/technology/news.rss", "Tecnología")], "bloomberg.com"),
    ("CNBC", "EE.UU.", "Norteamérica", "en", "privado", [("https://www.cnbc.com/id/100727362/device/rss/rss.html", "Mundo"), ("https://www.cnbc.com/id/10001147/device/rss/rss.html", "Negocios"), ("https://www.cnbc.com/id/19854910/device/rss/rss.html", "Tecnología"), ("https://www.cnbc.com/id/10000664/device/rss/rss.html", "Economía")], "cnbc.com"),
    ("CNN", "EE.UU.", "Norteamérica", "en", "privado", [("http://rss.cnn.com/rss/edition_world.rss", "Mundo"), ("http://rss.cnn.com/rss/money_latest.rss", "Economía"), ("http://rss.cnn.com/rss/edition_technology.rss", "Tecnología"), ("http://rss.cnn.com/rss/edition_sport.rss", "Deportes"), ("http://rss.cnn.com/rss/edition_entertainment.rss", "Cultura")], "cnn.com"),
    ("NPR", "EE.UU.", "Norteamérica", "en", "publico", [("https://feeds.npr.org/1004/rss.xml", "Mundo"), ("https://feeds.npr.org/1006/rss.xml", "Economía"), ("https://feeds.npr.org/1019/rss.xml", "Tecnología"), ("https://feeds.npr.org/1007/rss.xml", "Ciencia"), ("https://feeds.npr.org/1128/rss.xml", "Salud")], "npr.org"),
    ("CBS News", "EE.UU.", "Norteamérica", "en", "privado", [("https://www.cbsnews.com/latest/rss/world", "Mundo"), ("https://www.cbsnews.com/latest/rss/politics", "Política")], "cbsnews.com"),
    ("ABC News (EE.UU.)", "EE.UU.", "Norteamérica", "en", "privado", [("https://abcnews.go.com/abcnews/internationalheadlines", "Mundo"), ("https://abcnews.go.com/abcnews/politicsheadlines", "Política")], "abcnews.go.com"),
    ("Fox News", "EE.UU.", "Norteamérica", "en", "privado", [("https://moxie.foxnews.com/google-publisher/world.xml", "Mundo"), ("https://moxie.foxnews.com/google-publisher/politics.xml", "Política")], "foxnews.com"),
    ("Politico", "EE.UU.", "Norteamérica", "en", "privado", [("https://www.politico.com/rss/politicopicks.xml", "Política")], "politico.com"),
    ("Los Angeles Times", "EE.UU.", "Norteamérica", "en", "privado", [("https://www.latimes.com/world-nation/rss2.0.xml", "Mundo"), ("https://www.latimes.com/business/rss2.0.xml", "Negocios")], "latimes.com"),
    ("Foreign Policy", "EE.UU.", "Norteamérica", "en", "privado", [("https://foreignpolicy.com/feed", "Mundo")], "foreignpolicy.com"),
    ("The Atlantic", "EE.UU.", "Norteamérica", "en", "privado", [("https://www.theatlantic.com/feed/all/", "General")], "theatlantic.com"),
    ("Miami Herald", "EE.UU.", "Norteamérica", "en", "privado", [], "miamiherald.com"),
    ("Reuters", "Reino Unido", "Global", "en", "privado", [], "reuters.com"),
    ("Associated Press", "EE.UU.", "Global", "en", "privado", [], "apnews.com"),
    ("CBC News", "Canadá", "Norteamérica", "en", "publico", [("https://www.cbc.ca/webfeed/rss/rss-world", "Mundo"), ("https://www.cbc.ca/webfeed/rss/rss-business", "Economía")], "cbc.ca"),
    ("The Globe and Mail", "Canadá", "Norteamérica", "en", "privado", [], "theglobeandmail.com"),
    # ---- Europa
    ("BBC News", "Reino Unido", "Europa", "en", "publico", [(BBC % "world", "Mundo"), (BBC % "business", "Economía"), (BBC % "technology", "Tecnología"), (BBC % "science_and_environment", "Ciencia"), (BBC % "health", "Salud"), (BBC % "entertainment_and_arts", "Cultura"), ("https://feeds.bbci.co.uk/sport/rss.xml", "Deportes"), (BBC % "world/latin_america", "Mundo"), (BBC % "world/europe", "Mundo"), (BBC % "world/asia", "Mundo"), (BBC % "world/middle_east", "Mundo"), (BBC % "world/africa", "Mundo")], "bbc.com"),
    ("The Guardian", "Reino Unido", "Europa", "en", "privado", [(GU % "world", "Mundo"), (GU % "world/americas", "Mundo"), (GU % "business", "Economía"), (GU % "technology", "Tecnología"), (GU % "science", "Ciencia"), (GU % "environment", "Clima"), (GU % "sport", "Deportes"), (GU % "culture", "Cultura"), (GU % "politics", "Política")], "theguardian.com"),
    ("The Economist", "Reino Unido", "Europa", "en", "privado", [(EC % "latest", "General"), (EC % "the-americas", "Mundo"), (EC % "finance-and-economics", "Economía"), (EC % "business", "Negocios"), (EC % "science-and-technology", "Ciencia"), (EC % "international", "Mundo"), (EC % "united-states", "Política")], "economist.com"),
    ("Financial Times", "Reino Unido", "Europa", "en", "privado", [("https://www.ft.com/world?format=rss", "Mundo"), ("https://www.ft.com/companies?format=rss", "Negocios"), ("https://www.ft.com/markets?format=rss", "Economía"), ("https://www.ft.com/technology?format=rss", "Tecnología")], "ft.com"),
    ("Sky News", "Reino Unido", "Europa", "en", "privado", [("https://feeds.skynews.com/feeds/rss/world.xml", "Mundo"), ("https://feeds.skynews.com/feeds/rss/business.xml", "Economía"), ("https://feeds.skynews.com/feeds/rss/technology.xml", "Tecnología"), ("https://feeds.skynews.com/feeds/rss/politics.xml", "Política")], "news.sky.com"),
    ("The Telegraph", "Reino Unido", "Europa", "en", "privado", [("https://www.telegraph.co.uk/rss.xml", "General")], "telegraph.co.uk"),
    ("The Independent", "Reino Unido", "Europa", "en", "privado", [("https://www.independent.co.uk/news/world/rss", "Mundo")], "independent.co.uk"),
    ("Euronews", "Francia", "Europa", "en", "publico", [("https://www.euronews.com/rss?format=mrss", "Mundo")], "euronews.com"),
    ("Euronews (español)", "Francia", "Europa", "es", "publico", [("https://es.euronews.com/rss?format=mrss", "Mundo")], "es.euronews.com"),
    ("DW (inglés)", "Alemania", "Europa", "en", "publico", [("https://rss.dw.com/rdf/rss-en-all", "Mundo")], "dw.com"),
    ("DW Español", "Alemania", "Europa", "es", "publico", [("https://rss.dw.com/rdf/rss-sp-all", "Mundo")], "dw.com"),
    ("France 24 (inglés)", "Francia", "Europa", "en", "publico", [("https://www.france24.com/en/rss", "Mundo")], "france24.com"),
    ("France 24 Español", "Francia", "Europa", "es", "publico", [("https://www.france24.com/es/rss", "Mundo")], "france24.com"),
    ("Le Monde", "Francia", "Europa", "fr", "privado", [("https://www.lemonde.fr/rss/une.xml", "General"), ("https://www.lemonde.fr/international/rss_full.xml", "Mundo")], "lemonde.fr"),
    ("Le Figaro", "Francia", "Europa", "fr", "privado", [("https://www.lefigaro.fr/rss/figaro_actualites.xml", "General")], "lefigaro.fr"),
    ("Der Spiegel (inglés)", "Alemania", "Europa", "en", "privado", [("https://www.spiegel.de/international/index.rss", "Mundo")], "spiegel.de"),
    ("Politico Europe", "Bélgica", "Europa", "en", "privado", [("https://www.politico.eu/feed/", "Política")], "politico.eu"),
    ("Euractiv", "Bélgica", "Europa", "en", "privado", [("https://www.euractiv.com/feed/", "Política")], "euractiv.com"),
    ("ANSA", "Italia", "Europa", "it", "privado", [("https://www.ansa.it/sito/ansait_rss.xml", "General")], "ansa.it"),
    ("El País (España)", "España", "Europa", "es", "privado", [(EP % "internacional", "Mundo"), (EP % "economia", "Economía"), (EP % "tecnologia", "Tecnología"), (EP % "ciencia", "Ciencia"), (EP % "deportes", "Deportes"), (EP % "cultura", "Cultura"), (EP % "america", "Mundo")], "elpais.com"),
    ("El Mundo (España)", "España", "Europa", "es", "privado", [("https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml", "Mundo"), ("https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml", "Economía")], "elmundo.es"),
    ("ABC (España)", "España", "Europa", "es", "privado", [("https://www.abc.es/rss/2.0/internacional/", "Mundo"), ("https://www.abc.es/rss/2.0/economia/", "Economía")], "abc.es"),
    ("La Vanguardia", "España", "Europa", "es", "privado", [("https://www.lavanguardia.com/mvc/feed/rss/internacional", "Mundo")], "lavanguardia.com"),
    ("20minutos", "España", "Europa", "es", "privado", [("https://www.20minutos.es/rss/internacional/", "Mundo")], "20minutos.es"),
    ("RTVE", "España", "Europa", "es", "publico", [("https://www.rtve.es/api/noticias.rss", "General")], "rtve.es"),
    ("El Confidencial", "España", "Europa", "es", "privado", [("https://rss.elconfidencial.com/mundo-1/", "Mundo")], "elconfidencial.com"),
    ("Expansión", "España", "Europa", "es", "privado", [("https://e00-expansion.uecdn.es/rss/portada.xml", "Economía")], "expansion.com"),
    ("Kyiv Independent", "Ucrania", "Eurasia", "en", "privado", [("https://kyivindependent.com/news-archive/rss/", "Mundo")], "kyivindependent.com"),
    ("The Moscow Times", "Rusia", "Eurasia", "en", "privado", [("https://www.themoscowtimes.com/rss/news", "Mundo")], "themoscowtimes.com"),
    ("Meduza", "Letonia", "Eurasia", "en", "privado", [("https://meduza.io/rss/en/all", "Mundo")], "meduza.io"),
    ("TASS", "Rusia", "Eurasia", "en", "estatal", [("https://tass.com/rss/v2.xml", "Mundo")], "tass.com"),
    # ---- Latinoamérica
    ("BBC Mundo", "Reino Unido", "Latinoamérica", "es", "publico", [("https://feeds.bbci.co.uk/mundo/rss.xml", "Mundo")], "bbc.com"),
    ("CNN en Español", "EE.UU.", "Latinoamérica", "es", "privado", [], "cnnespanol.cnn.com"),
    ("Infobae (América)", "Argentina", "Latinoamérica", "es", "privado", [], "infobae.com/america"),
    ("Buenos Aires Times", "Argentina", "Latinoamérica", "en", "privado", [("https://www.batimes.com.ar/feed", "General")], "batimes.com.ar"),
    ("MercoPress", "Uruguay", "Latinoamérica", "en", "privado", [("https://en.mercopress.com/rss", "General")], "en.mercopress.com"),
    ("Folha de S.Paulo", "Brasil", "Latinoamérica", "pt", "privado", [("https://feeds.folha.uol.com.br/mundo/rss091.xml", "Mundo"), ("https://feeds.folha.uol.com.br/mercado/rss091.xml", "Economía")], "folha.uol.com.br"),
    ("g1 (Globo)", "Brasil", "Latinoamérica", "pt", "privado", [("https://g1.globo.com/rss/g1/mundo/", "Mundo"), ("https://g1.globo.com/rss/g1/economia/", "Economía")], "g1.globo.com"),
    ("Estadão", "Brasil", "Latinoamérica", "pt", "privado", [], "estadao.com.br"),
    ("El Universal (México)", "México", "Latinoamérica", "es", "privado", [("https://www.eluniversal.com.mx/rss.xml", "General")], "eluniversal.com.mx"),
    ("Milenio", "México", "Latinoamérica", "es", "privado", [], "milenio.com"),
    ("La Jornada", "México", "Latinoamérica", "es", "privado", [], "jornada.com.mx"),
    ("La Tercera", "Chile", "Latinoamérica", "es", "privado", [("https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml", "General")], "latercera.com"),
    ("Emol", "Chile", "Latinoamérica", "es", "privado", [], "emol.com"),
    ("El Tiempo", "Colombia", "Latinoamérica", "es", "privado", [("https://www.eltiempo.com/rss/mundo.xml", "Mundo")], "eltiempo.com"),
    ("El Espectador", "Colombia", "Latinoamérica", "es", "privado", [], "elespectador.com"),
    ("El Comercio (Perú)", "Perú", "Latinoamérica", "es", "privado", [], "elcomercio.pe"),
    ("El País (Uruguay)", "Uruguay", "Latinoamérica", "es", "privado", [], "elpais.com.uy"),
    ("El Nacional (Venezuela)", "Venezuela", "Latinoamérica", "es", "privado", [], "elnacional.com"),
    ("14ymedio", "Cuba", "Latinoamérica", "es", "privado", [("https://www.14ymedio.com/rss/", "General")], "14ymedio.com"),
    ("Bloomberg Línea", "EE.UU.", "Latinoamérica", "es", "privado", [], "bloomberglinea.com"),
    # ---- Asia-Pacífico
    ("South China Morning Post", "Hong Kong", "Asia-Pacífico", "en", "privado", [("https://www.scmp.com/rss/91/feed", "Mundo"), ("https://www.scmp.com/rss/92/feed", "Economía")], "scmp.com"),
    ("Nikkei Asia", "Japón", "Asia-Pacífico", "en", "privado", [("https://asia.nikkei.com/rss/feed/nar", "Economía")], "asia.nikkei.com"),
    ("The Japan Times", "Japón", "Asia-Pacífico", "en", "privado", [("https://www.japantimes.co.jp/feed/", "General")], "japantimes.co.jp"),
    ("The Straits Times", "Singapur", "Asia-Pacífico", "en", "privado", [("https://www.straitstimes.com/news/world/rss.xml", "Mundo"), ("https://www.straitstimes.com/news/business/rss.xml", "Economía")], "straitstimes.com"),
    ("The Hindu", "India", "Asia-Pacífico", "en", "privado", [("https://www.thehindu.com/news/international/feeder/default.rss", "Mundo"), ("https://www.thehindu.com/business/feeder/default.rss", "Economía")], "thehindu.com"),
    ("Times of India", "India", "Asia-Pacífico", "en", "privado", [("https://timesofindia.indiatimes.com/rssfeeds/296589292.cms", "Mundo")], "timesofindia.indiatimes.com"),
    ("NDTV", "India", "Asia-Pacífico", "en", "privado", [("https://feeds.feedburner.com/ndtvnews-world-news", "Mundo")], "ndtv.com"),
    ("ABC News (Australia)", "Australia", "Oceanía", "en", "publico", [("https://www.abc.net.au/news/feed/2942460/rss.xml", "General")], "abc.net.au"),
    ("The Sydney Morning Herald", "Australia", "Oceanía", "en", "privado", [("https://www.smh.com.au/rss/world.xml", "Mundo"), ("https://www.smh.com.au/rss/business.xml", "Economía")], "smh.com.au"),
    ("NZ Herald", "Nueva Zelanda", "Oceanía", "en", "privado", [("https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/world/?outputType=xml", "Mundo")], "nzherald.co.nz"),
    ("The Korea Herald", "Corea del Sur", "Asia-Pacífico", "en", "privado", [("http://www.koreaherald.com/common/rss_xml.php?ct=102", "Mundo")], "koreaherald.com"),
    ("The Korea Times", "Corea del Sur", "Asia-Pacífico", "en", "privado", [], "koreatimes.co.kr"),
    ("China Daily", "China", "Asia-Pacífico", "en", "estatal", [("https://www.chinadaily.com.cn/rss/world_rss.xml", "Mundo"), ("https://www.chinadaily.com.cn/rss/business_rss.xml", "Economía")], "chinadaily.com.cn"),
    ("Xinhua", "China", "Asia-Pacífico", "en", "estatal", [], "xinhuanet.com"),
    ("CGTN", "China", "Asia-Pacífico", "en", "estatal", [], "cgtn.com"),
    ("Dawn", "Pakistán", "Asia-Pacífico", "en", "privado", [("https://www.dawn.com/feeds/home", "General"), ("https://www.dawn.com/feeds/business", "Economía")], "dawn.com"),
    # ---- Medio Oriente
    ("Al Jazeera", "Catar", "Medio Oriente", "en", "publico", [("https://www.aljazeera.com/xml/rss/all.xml", "Mundo")], "aljazeera.com"),
    ("Al Arabiya English", "Arabia Saudita", "Medio Oriente", "en", "privado", [("https://english.alarabiya.net/tools/rss", "Mundo")], "english.alarabiya.net"),
    ("The Times of Israel", "Israel", "Medio Oriente", "en", "privado", [("https://www.timesofisrael.com/feed/", "General")], "timesofisrael.com"),
    ("The Jerusalem Post", "Israel", "Medio Oriente", "en", "privado", [("https://www.jpost.com/rss/rssfeedsheadlines.aspx", "General")], "jpost.com"),
    ("Haaretz", "Israel", "Medio Oriente", "en", "privado", [], "haaretz.com"),
    ("Middle East Eye", "Reino Unido", "Medio Oriente", "en", "privado", [("https://www.middleeasteye.net/rss", "General")], "middleeasteye.net"),
    ("Arab News", "Arabia Saudita", "Medio Oriente", "en", "privado", [("https://www.arabnews.com/rss.xml", "General")], "arabnews.com"),
    ("Hürriyet Daily News", "Turquía", "Medio Oriente", "en", "privado", [("https://www.hurriyetdailynews.com/rss", "General")], "hurriyetdailynews.com"),
    ("Tehran Times", "Irán", "Medio Oriente", "en", "estatal", [("https://www.tehrantimes.com/rss", "General")], "tehrantimes.com"),
    # ---- África
    ("AllAfrica", "Sudáfrica", "África", "en", "privado", [("https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", "General")], "allafrica.com"),
    ("Africanews", "Francia", "África", "en", "publico", [("https://www.africanews.com/feed/rss", "General")], "africanews.com"),
    ("Daily Maverick", "Sudáfrica", "África", "en", "privado", [("https://www.dailymaverick.co.za/dmrss/", "General")], "dailymaverick.co.za"),
    ("Mail & Guardian", "Sudáfrica", "África", "en", "privado", [("https://mg.co.za/feed/", "General")], "mg.co.za"),
    ("News24", "Sudáfrica", "África", "en", "privado", [], "news24.com"),
    ("The East African", "Kenia", "África", "en", "privado", [], "theeastafrican.co.ke"),
    # ---- Asia-Pacífico (más medios locales)
    ("Channel NewsAsia", "Singapur", "Asia-Pacífico", "en", "publico", [("https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", "Mundo")], "channelnewsasia.com"),
    ("The Diplomat", "EE.UU.", "Asia-Pacífico", "en", "privado", [("https://thediplomat.com/feed/", "Mundo")], "thediplomat.com"),
    ("Taipei Times", "Taiwán", "Asia-Pacífico", "en", "privado", [("https://www.taipeitimes.com/xml/index.rss", "General")], "taipeitimes.com"),
    ("Focus Taiwan", "Taiwán", "Asia-Pacífico", "en", "publico", [("https://focustaiwan.tw/rss", "General")], "focustaiwan.tw"),
    ("NHK World", "Japón", "Asia-Pacífico", "en", "publico", [], "www3.nhk.or.jp/nhkworld"),
    ("Kyodo News", "Japón", "Asia-Pacífico", "en", "privado", [], "english.kyodonews.net"),
    ("The Asahi Shimbun", "Japón", "Asia-Pacífico", "en", "privado", [], "asahi.com/ajw"),
    ("Yonhap News", "Corea del Sur", "Asia-Pacífico", "en", "publico", [("https://en.yna.co.kr/RSS/news.xml", "General")], "en.yna.co.kr"),
    ("The Jakarta Post", "Indonesia", "Asia-Pacífico", "en", "privado", [], "thejakartapost.com"),
    ("Rappler", "Filipinas", "Asia-Pacífico", "en", "privado", [("https://www.rappler.com/feed/", "General")], "rappler.com"),
    ("Philippine Daily Inquirer", "Filipinas", "Asia-Pacífico", "en", "privado", [], "inquirer.net"),
    ("Bangkok Post", "Tailandia", "Asia-Pacífico", "en", "privado", [], "bangkokpost.com"),
    ("VnExpress International", "Vietnam", "Asia-Pacífico", "en", "privado", [("https://e.vnexpress.net/rss/news.rss", "General")], "e.vnexpress.net"),
    ("The Star (Malasia)", "Malasia", "Asia-Pacífico", "en", "privado", [], "thestar.com.my"),
    ("Hindustan Times", "India", "Asia-Pacífico", "en", "privado", [("https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml", "Mundo")], "hindustantimes.com"),
    ("The Indian Express", "India", "Asia-Pacífico", "en", "privado", [("https://indianexpress.com/section/world/feed/", "Mundo")], "indianexpress.com"),
    ("The Wire (India)", "India", "Asia-Pacífico", "en", "privado", [("https://thewire.in/rss", "General")], "thewire.in"),
    ("The Daily Star (Bangladesh)", "Bangladesh", "Asia-Pacífico", "en", "privado", [], "thedailystar.net"),
    ("Global Times", "China", "Asia-Pacífico", "en", "estatal", [], "globaltimes.cn"),
    ("Korea JoongAng Daily", "Corea del Sur", "Asia-Pacífico", "en", "privado", [], "koreajoongangdaily.joins.com"),
    # ---- Oceanía
    ("RNZ", "Nueva Zelanda", "Oceanía", "en", "publico", [("https://www.rnz.co.nz/rss/world.xml", "Mundo")], "rnz.co.nz"),
    ("The Guardian Australia", "Australia", "Oceanía", "en", "privado", [("https://www.theguardian.com/australia-news/rss", "General")], "theguardian.com/australia-news"),
    ("The Australian", "Australia", "Oceanía", "en", "privado", [], "theaustralian.com.au"),
    ("Stuff (Nueva Zelanda)", "Nueva Zelanda", "Oceanía", "en", "privado", [], "stuff.co.nz"),
    ("Pacific Islands Report", "Fiyi", "Oceanía", "en", "privado", [], "pireport.org"),
    # ---- Medio Oriente y Norte de África
    ("Daily Sabah", "Turquía", "Medio Oriente", "en", "privado", [("https://www.dailysabah.com/rssFeed/10", "Mundo")], "dailysabah.com"),
    ("Anadolu Agency", "Turquía", "Medio Oriente", "en", "estatal", [("https://www.aa.com.tr/en/rss/default?cat=world", "Mundo")], "aa.com.tr"),
    ("TRT World", "Turquía", "Medio Oriente", "en", "estatal", [], "trtworld.com"),
    ("Ynetnews", "Israel", "Medio Oriente", "en", "privado", [], "ynetnews.com"),
    ("The National (EAU)", "Emiratos Árabes", "Medio Oriente", "en", "privado", [], "thenationalnews.com"),
    ("Gulf News", "Emiratos Árabes", "Medio Oriente", "en", "privado", [], "gulfnews.com"),
    ("Asharq Al-Awsat (inglés)", "Arabia Saudita", "Medio Oriente", "en", "privado", [("https://english.aawsat.com/feed", "General")], "english.aawsat.com"),
    ("Ahram Online", "Egipto", "Medio Oriente", "en", "estatal", [], "english.ahram.org.eg"),
    ("Egypt Independent", "Egipto", "Medio Oriente", "en", "privado", [], "egyptindependent.com"),
    ("Al-Monitor", "EE.UU.", "Medio Oriente", "en", "privado", [("https://www.al-monitor.com/rss", "General")], "al-monitor.com"),
    ("Iran International", "Reino Unido", "Medio Oriente", "en", "privado", [], "iranintl.com"),
    ("Press TV", "Irán", "Medio Oriente", "en", "estatal", [("https://www.presstv.ir/rss.xml", "General")], "presstv.ir"),
    ("Kurdistan24", "Irak", "Medio Oriente", "en", "privado", [], "kurdistan24.net"),
    ("The Jordan Times", "Jordania", "Medio Oriente", "en", "privado", [], "jordantimes.com"),
    ("Morocco World News", "Marruecos", "Medio Oriente", "en", "privado", [("https://www.moroccoworldnews.com/feed", "General")], "moroccoworldnews.com"),
    ("Libya Observer", "Libia", "Medio Oriente", "en", "privado", [], "libyaobserver.ly"),
    # ---- África
    ("Premium Times (Nigeria)", "Nigeria", "África", "en", "privado", [("https://www.premiumtimesng.com/feed", "General")], "premiumtimesng.com"),
    ("Vanguard (Nigeria)", "Nigeria", "África", "en", "privado", [("https://www.vanguardngr.com/feed/", "General")], "vanguardngr.com"),
    ("The Punch (Nigeria)", "Nigeria", "África", "en", "privado", [], "punchng.com"),
    ("Daily Nation (Kenia)", "Kenia", "África", "en", "privado", [], "nation.africa"),
    ("The Citizen (Tanzania)", "Tanzania", "África", "en", "privado", [], "thecitizen.co.tz"),
    ("GhanaWeb", "Ghana", "África", "en", "privado", [], "ghanaweb.com"),
    ("Addis Standard", "Etiopía", "África", "en", "privado", [], "addisstandard.com"),
    ("Jeune Afrique", "Francia", "África", "fr", "privado", [("https://www.jeuneafrique.com/feed/", "General")], "jeuneafrique.com"),
    ("The Africa Report", "Francia", "África", "en", "privado", [("https://www.theafricareport.com/feed/", "General")], "theafricareport.com"),
    ("IOL (Sudáfrica)", "Sudáfrica", "África", "en", "privado", [("https://iol.co.za/rss", "General")], "iol.co.za"),
    ("SABC News", "Sudáfrica", "África", "en", "publico", [("https://www.sabcnews.com/sabcnews/feed/", "General")], "sabcnews.com"),
    ("BusinessDay (Sudáfrica)", "Sudáfrica", "África", "en", "privado", [], "businesslive.co.za"),
    ("The Zimbabwe Independent", "Zimbabue", "África", "en", "privado", [], "theindependent.co.zw"),
    ("Africa News Agency", "Sudáfrica", "África", "en", "privado", [], "africannewsagency.com"),
    # ---- Eurasia
    ("Ukrainska Pravda (inglés)", "Ucrania", "Eurasia", "en", "privado", [("https://www.pravda.com.ua/eng/rss/", "General")], "pravda.com.ua/eng"),
    ("Kyiv Post", "Ucrania", "Eurasia", "en", "privado", [], "kyivpost.com"),
    ("Ukrinform", "Ucrania", "Eurasia", "en", "estatal", [], "ukrinform.net"),
    ("RFE/RL", "República Checa", "Eurasia", "en", "publico", [], "rferl.org"),
    ("Eurasianet", "EE.UU.", "Eurasia", "en", "privado", [("https://eurasianet.org/rss.xml", "General")], "eurasianet.org"),
    ("The Astana Times", "Kazajistán", "Eurasia", "en", "estatal", [("https://astanatimes.com/feed/", "General")], "astanatimes.com"),
    ("Civil Georgia", "Georgia", "Eurasia", "en", "privado", [("https://civil.ge/feed", "General")], "civil.ge"),
    ("Interfax", "Rusia", "Eurasia", "en", "privado", [], "interfax.com"),
    ("RT", "Rusia", "Eurasia", "en", "estatal", [], "rt.com"),
    ("Sputnik", "Rusia", "Eurasia", "en", "estatal", [], "sputnikglobe.com"),
    ("Belsat", "Polonia", "Eurasia", "en", "publico", [], "belsat.eu"),
    # ---- Europa (más lugares)
    ("The Irish Times", "Irlanda", "Europa", "en", "privado", [("https://www.irishtimes.com/arc/outboundfeeds/feed/", "General")], "irishtimes.com"),
    ("RTÉ", "Irlanda", "Europa", "en", "publico", [("https://www.rte.ie/news/rss/news-headlines.xml", "General")], "rte.ie"),
    ("The Scotsman", "Reino Unido", "Europa", "en", "privado", [], "scotsman.com"),
    ("The Brussels Times", "Bélgica", "Europa", "en", "privado", [("https://www.brusselstimes.com/feed", "General")], "brusselstimes.com"),
    ("Swissinfo", "Suiza", "Europa", "en", "publico", [("https://www.swissinfo.ch/eng/rss", "General")], "swissinfo.ch"),
    ("Notes from Poland", "Polonia", "Europa", "en", "privado", [("https://notesfrompoland.com/feed/", "General")], "notesfrompoland.com"),
    ("Radio Prague International", "República Checa", "Europa", "en", "publico", [("https://english.radio.cz/rss", "General")], "english.radio.cz"),
    ("Kathimerini (inglés)", "Grecia", "Europa", "en", "privado", [], "ekathimerini.com"),
    ("The Local (Europa)", "Suecia", "Europa", "en", "privado", [], "thelocal.com"),
    ("DutchNews", "Países Bajos", "Europa", "en", "privado", [("https://www.dutchnews.nl/feed/", "General")], "dutchnews.nl"),
    ("Corriere della Sera", "Italia", "Europa", "it", "privado", [("https://xml2.corriere.it/rss/homepage.xml", "General")], "corriere.it"),
    ("La Repubblica", "Italia", "Europa", "it", "privado", [], "repubblica.it"),
    ("Tagesschau", "Alemania", "Europa", "de", "publico", [("https://www.tagesschau.de/index~rss2.xml", "General")], "tagesschau.de"),
    ("Frankfurter Allgemeine", "Alemania", "Europa", "de", "privado", [("https://www.faz.net/rss/aktuell/", "General")], "faz.net"),
    ("Libération", "Francia", "Europa", "fr", "privado", [], "liberation.fr"),
    ("Público (Portugal)", "Portugal", "Europa", "pt", "privado", [], "publico.pt"),
    ("NOS", "Países Bajos", "Europa", "nl", "publico", [("https://feeds.nos.nl/nosnieuwsalgemeen", "General")], "nos.nl"),
    # ---- Norteamérica (más lugares)
    ("Toronto Star", "Canadá", "Norteamérica", "en", "privado", [], "thestar.com"),
    ("National Post", "Canadá", "Norteamérica", "en", "privado", [], "nationalpost.com"),
    ("CTV News", "Canadá", "Norteamérica", "en", "privado", [], "ctvnews.ca"),
    ("El Financiero (México)", "México", "Latinoamérica", "es", "privado", [], "elfinanciero.com.mx"),
    ("Proceso", "México", "Latinoamérica", "es", "privado", [], "proceso.com.mx"),
    ("Animal Político", "México", "Latinoamérica", "es", "privado", [], "animalpolitico.com"),
    # ---- Latinoamérica (más lugares)
    ("La República (Perú)", "Perú", "Latinoamérica", "es", "privado", [], "larepublica.pe"),
    ("Perú21", "Perú", "Latinoamérica", "es", "privado", [], "peru21.pe"),
    ("El Universo (Ecuador)", "Ecuador", "Latinoamérica", "es", "privado", [], "eluniverso.com"),
    ("Primicias (Ecuador)", "Ecuador", "Latinoamérica", "es", "privado", [], "primicias.ec"),
    ("Los Tiempos (Bolivia)", "Bolivia", "Latinoamérica", "es", "privado", [], "lostiempos.com"),
    ("ABC Color (Paraguay)", "Paraguay", "Latinoamérica", "es", "privado", [], "abc.com.py"),
    ("El Observador (Uruguay)", "Uruguay", "Latinoamérica", "es", "privado", [], "elobservador.com.uy"),
    ("Montevideo Portal", "Uruguay", "Latinoamérica", "es", "privado", [], "montevideo.com.uy"),
    ("Efecto Cocuyo", "Venezuela", "Latinoamérica", "es", "privado", [], "efectococuyo.com"),
    ("La Nación (Costa Rica)", "Costa Rica", "Latinoamérica", "es", "privado", [], "nacion.com"),
    ("La Prensa (Panamá)", "Panamá", "Latinoamérica", "es", "privado", [], "prensa.com"),
    ("Prensa Libre (Guatemala)", "Guatemala", "Latinoamérica", "es", "privado", [], "prensalibre.com"),
    ("Listín Diario", "Rep. Dominicana", "Latinoamérica", "es", "privado", [], "listindiario.com"),
    ("Telesur", "Venezuela", "Latinoamérica", "es", "estatal", [], "telesurtv.net"),
    ("Granma", "Cuba", "Latinoamérica", "es", "estatal", [], "granma.cu"),
    ("Cubadebate", "Cuba", "Latinoamérica", "es", "estatal", [], "cubadebate.cu"),
    ("Agência Brasil", "Brasil", "Latinoamérica", "pt", "publico", [("https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", "General")], "agenciabrasil.ebc.com.br"),
    ("O Globo", "Brasil", "Latinoamérica", "pt", "privado", [], "oglobo.globo.com"),
    ("Valor Econômico", "Brasil", "Latinoamérica", "pt", "privado", [], "valor.globo.com"),
    ("Brasil de Fato", "Brasil", "Latinoamérica", "pt", "privado", [], "brasildefato.com.br"),
    # ---- Global / especializados
    ("Global Voices", "Países Bajos", "Global", "en", "privado", [("https://globalvoices.org/feed/", "General")], "globalvoices.org"),
    ("TechCrunch", "EE.UU.", "Global", "en", "privado", [("https://techcrunch.com/feed/", "Tecnología")], "techcrunch.com"),
    ("The Verge", "EE.UU.", "Global", "en", "privado", [("https://www.theverge.com/rss/index.xml", "Tecnología")], "theverge.com"),
    ("Ars Technica", "EE.UU.", "Global", "en", "privado", [("https://feeds.arstechnica.com/arstechnica/index", "Tecnología")], "arstechnica.com"),
    ("Wired", "EE.UU.", "Global", "en", "privado", [("https://www.wired.com/feed/rss", "Tecnología")], "wired.com"),
    ("MIT Technology Review", "EE.UU.", "Global", "en", "privado", [("https://www.technologyreview.com/feed/", "Tecnología")], "technologyreview.com"),
    ("Nature", "Reino Unido", "Global", "en", "privado", [("https://www.nature.com/nature.rss", "Ciencia")], "nature.com"),
    ("New Scientist", "Reino Unido", "Global", "en", "privado", [("https://www.newscientist.com/feed/home/", "Ciencia")], "newscientist.com"),
    ("ScienceDaily", "EE.UU.", "Global", "en", "privado", [("https://www.sciencedaily.com/rss/top.xml", "Ciencia")], "sciencedaily.com"),
    ("STAT", "EE.UU.", "Global", "en", "privado", [("https://www.statnews.com/feed/", "Salud")], "statnews.com"),
    ("Organización Mundial de la Salud", "Suiza", "Global", "en", "publico", [("https://www.who.int/rss-feeds/news-english.xml", "Salud")], "who.int"),
    ("Noticias ONU", "EE.UU.", "Global", "es", "publico", [("https://news.un.org/feed/subscribe/es/news/all/rss.xml", "Mundo")], "news.un.org"),
    ("UN News", "EE.UU.", "Global", "en", "publico", [("https://news.un.org/feed/subscribe/en/news/all/rss.xml", "Mundo")], "news.un.org"),
    ("Carbon Brief", "Reino Unido", "Global", "en", "privado", [("https://www.carbonbrief.org/feed/", "Clima")], "carbonbrief.org"),
    ("Inside Climate News", "EE.UU.", "Global", "en", "privado", [("https://insideclimatenews.org/feed/", "Clima")], "insideclimatenews.org"),
    ("Mongabay", "EE.UU.", "Global", "en", "privado", [("https://news.mongabay.com/feed/", "Clima")], "mongabay.com"),
    ("Forbes", "EE.UU.", "Global", "en", "privado", [("https://www.forbes.com/real-time/feed2/", "Negocios")], "forbes.com"),
    ("Fortune", "EE.UU.", "Global", "en", "privado", [("https://fortune.com/feed/", "Negocios")], "fortune.com"),
    ("MarketWatch", "EE.UU.", "Global", "en", "privado", [("http://feeds.marketwatch.com/marketwatch/topstories/", "Economía")], "marketwatch.com"),
    ("ESPN", "EE.UU.", "Global", "en", "privado", [("https://www.espn.com/espn/rss/news", "Deportes")], "espn.com"),
    ("Marca", "España", "Global", "es", "privado", [("https://e00-marca.uecdn.es/rss/portada.xml", "Deportes")], "marca.com"),
    ("AS", "España", "Global", "es", "privado", [("https://as.com/rss/tags/ultimas_noticias.xml", "Deportes")], "as.com"),
    ("Variety", "EE.UU.", "Global", "en", "privado", [("https://variety.com/feed/", "Cultura")], "variety.com"),
    ("The Hollywood Reporter", "EE.UU.", "Global", "en", "privado", [("https://www.hollywoodreporter.com/feed/", "Cultura")], "hollywoodreporter.com"),
]

# Ediciones de Google News por tema: traen titulares de MUCHOS diarios de cada región, con el nombre real del diario.
# (edición, región, parámetros). Se usan los temas: mundo, negocios, tecnología, ciencia, salud, deportes, espectáculos.
EDICIONES = [
    # (país, región, parámetros, idioma, temas o None = todos)
    ("EE.UU.", "Norteamérica", "hl=en-US&gl=US&ceid=US:en", "en", None),
    ("Canadá", "Norteamérica", "hl=en-CA&gl=CA&ceid=CA:en", "en", None),
    ("México", "Latinoamérica", "hl=es-419&gl=MX&ceid=MX:es-419", "es", None),
    ("Argentina", "Latinoamérica", "hl=es-419&gl=AR&ceid=AR:es-419", "es", None),
    ("Colombia", "Latinoamérica", "hl=es-419&gl=CO&ceid=CO:es-419", "es", None),
    ("Chile", "Latinoamérica", "hl=es-419&gl=CL&ceid=CL:es-419", "es", None),
    ("Perú", "Latinoamérica", "hl=es-419&gl=PE&ceid=PE:es-419", "es", ("WORLD", "BUSINESS", "SPORTS")),
    ("Venezuela", "Latinoamérica", "hl=es-419&gl=VE&ceid=VE:es-419", "es", ("WORLD", "BUSINESS")),
    ("Uruguay", "Latinoamérica", "hl=es-419&gl=UY&ceid=UY:es-419", "es", ("WORLD", "BUSINESS")),
    ("Ecuador", "Latinoamérica", "hl=es-419&gl=EC&ceid=EC:es-419", "es", ("WORLD", "BUSINESS")),
    ("Cuba", "Latinoamérica", "hl=es-419&gl=CU&ceid=CU:es-419", "es", ("WORLD",)),
    ("Brasil", "Latinoamérica", "hl=pt-419&gl=BR&ceid=BR:pt-419", "pt", None),
    ("Reino Unido", "Europa", "hl=en-GB&gl=GB&ceid=GB:en", "en", None),
    ("Irlanda", "Europa", "hl=en-IE&gl=IE&ceid=IE:en", "en", ("WORLD", "BUSINESS", "TECHNOLOGY")),
    ("España", "Europa", "hl=es&gl=ES&ceid=ES:es", "es", None),
    ("Francia", "Europa", "hl=fr&gl=FR&ceid=FR:fr", "fr", ("WORLD", "BUSINESS", "TECHNOLOGY", "SCIENCE")),
    ("Alemania", "Europa", "hl=de&gl=DE&ceid=DE:de", "de", ("WORLD", "BUSINESS", "TECHNOLOGY", "SCIENCE")),
    ("Italia", "Europa", "hl=it&gl=IT&ceid=IT:it", "it", ("WORLD", "BUSINESS", "TECHNOLOGY")),
    ("Portugal", "Europa", "hl=pt-PT&gl=PT&ceid=PT:pt-150", "pt", ("WORLD", "BUSINESS")),
    ("Ucrania", "Eurasia", "hl=en&gl=UA&ceid=UA:en", "en", ("WORLD", "BUSINESS")),
    ("Turquía", "Medio Oriente", "hl=en&gl=TR&ceid=TR:en", "en", ("WORLD", "BUSINESS")),
    ("Israel", "Medio Oriente", "hl=en-IL&gl=IL&ceid=IL:en", "en", None),
    ("Egipto", "Medio Oriente", "hl=en&gl=EG&ceid=EG:en", "en", ("WORLD", "BUSINESS")),
    ("Arabia Saudita", "Medio Oriente", "hl=en&gl=SA&ceid=SA:en", "en", ("WORLD", "BUSINESS")),
    ("Sudáfrica", "África", "hl=en-ZA&gl=ZA&ceid=ZA:en", "en", None),
    ("Nigeria", "África", "hl=en-NG&gl=NG&ceid=NG:en", "en", None),
    ("Kenia", "África", "hl=en-KE&gl=KE&ceid=KE:en", "en", ("WORLD", "BUSINESS", "TECHNOLOGY", "SPORTS")),
    ("Ghana", "África", "hl=en-GH&gl=GH&ceid=GH:en", "en", ("WORLD", "BUSINESS")),
    ("Etiopía", "África", "hl=en&gl=ET&ceid=ET:en", "en", ("WORLD",)),
    ("India", "Asia-Pacífico", "hl=en-IN&gl=IN&ceid=IN:en", "en", None),
    ("Pakistán", "Asia-Pacífico", "hl=en-PK&gl=PK&ceid=PK:en", "en", ("WORLD", "BUSINESS", "SPORTS")),
    ("Japón", "Asia-Pacífico", "hl=en&gl=JP&ceid=JP:en", "en", ("WORLD", "BUSINESS", "TECHNOLOGY", "SCIENCE")),
    ("Corea del Sur", "Asia-Pacífico", "hl=en&gl=KR&ceid=KR:en", "en", ("WORLD", "BUSINESS", "TECHNOLOGY")),
    ("Hong Kong", "Asia-Pacífico", "hl=en-HK&gl=HK&ceid=HK:en", "en", ("WORLD", "BUSINESS")),
    ("Taiwán", "Asia-Pacífico", "hl=en-TW&gl=TW&ceid=TW:en", "en", ("WORLD", "BUSINESS", "TECHNOLOGY")),
    ("Singapur", "Asia-Pacífico", "hl=en-SG&gl=SG&ceid=SG:en", "en", ("WORLD", "BUSINESS")),
    ("Filipinas", "Asia-Pacífico", "hl=en-PH&gl=PH&ceid=PH:en", "en", ("WORLD", "BUSINESS")),
    ("Indonesia", "Asia-Pacífico", "hl=en-ID&gl=ID&ceid=ID:en", "en", ("WORLD", "BUSINESS")),
    ("Australia", "Oceanía", "hl=en-AU&gl=AU&ceid=AU:en", "en", None),
    ("Nueva Zelanda", "Oceanía", "hl=en-NZ&gl=NZ&ceid=NZ:en", "en", ("WORLD", "BUSINESS", "SPORTS")),
]
TEMAS_GN = [("WORLD", "Mundo"), ("BUSINESS", "Negocios"), ("TECHNOLOGY", "Tecnología"), ("SCIENCE", "Ciencia"), ("HEALTH", "Salud"), ("SPORTS", "Deportes"), ("ENTERTAINMENT", "Cultura")]

ARG = re.compile(r"argentin|milei|buenos aires|salta\b|kicillof|mercosur|malvinas|falkland|kirchner|bullrich|luis caputo|\bbcra\b|peso argentino|patagonia|vaca muerta", re.I)
LAT = re.compile(r"latin america|latam|latinoam|am[eé]rica latina|brazil|brasil|chile\b|mexic|m[eé]xico|colombia|venezuela|peru\b|per[uú]\b|bolivia|uruguay|paraguay|ecuador|cuba\b|lula|maduro|sheinbaum|petro\b|boric|mercosur|the americas|caribbean|caribe", re.I)


def get(url, t=15):
    rq = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5"})
    with urllib.request.urlopen(rq, timeout=t) as r:
        return r.read()


def iso(e):
    for k in ("published_parsed", "updated_parsed"):
        tm = e.get(k)
        if tm:
            try:
                ts = calendar.timegm(tm)
            except (TypeError, ValueError, OverflowError):
                continue
            if ts > time.time() + 2 * 86400:
                continue
            return datetime.fromtimestamp(ts, timezone.utc).isoformat()
    return None


def limpia(t):
    import html
    t = html.unescape(str(t or ""))
    t = re.sub(r"<[^>]*>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def gnews(dom, idioma):
    q = f"site:{dom} when:2d"
    if idioma == "es":
        return f"https://news.google.com/rss/search?q={quote(q)}&hl=es-419&gl=AR&ceid=AR:es-419"
    if idioma == "pt":
        return f"https://news.google.com/rss/search?q={quote(q)}&hl=pt-419&gl=BR&ceid=BR:pt-419"
    return f"https://news.google.com/rss/search?q={quote(q)}&hl=en-US&gl=US&ceid=US:en"


def idn(link, titulo):
    return hashlib.sha256(f"Internacional|{link or titulo}".encode()).hexdigest()[:16]


def leer(url):
    """Devuelve (entradas, error). Nunca levanta excepción."""
    try:
        f = feedparser.parse(get(url))
        return list(f.entries[:MAX_POR_FEED]), None
    except Exception as ex:  # noqa: BLE001
        return [], str(ex)[:140]


def main():
    try:
        viejas = json.load(open(OUT, encoding="utf-8"))
        if not isinstance(viejas, list):
            viejas = []
    except Exception:
        viejas = []
    ids = {n.get("id") for n in viejas}
    claves = {(n.get("source"), re.sub(r"\W+", "", (n.get("title") or "").lower())[:80]) for n in viejas}
    ahora = datetime.now(timezone.utc).isoformat()

    # 1) todos los RSS propios, en paralelo
    tareas = [(m, u, sec) for m in MEDIOS for (u, sec) in m[5]]
    with ThreadPoolExecutor(max_workers=10) as ex:
        res = list(ex.map(lambda t: leer(t[1]), tareas))
    por_medio = {m[0]: [] for m in MEDIOS}
    errores = {}
    for (m, u, sec), (ents, err) in zip(tareas, res):
        for e in ents:
            por_medio[m[0]].append((e, sec, "rss"))
        if err:
            errores[m[0]] = err
    # 2) respaldo por Google News para los diarios sin RSS que funcione
    sin = [m for m in MEDIOS if not por_medio[m[0]] and m[6]]
    with ThreadPoolExecutor(max_workers=10) as ex:
        res2 = list(ex.map(lambda m: leer(gnews(m[6], m[3])), sin))
    for m, (ents, err) in zip(sin, res2):
        for e in ents:
            por_medio[m[0]].append((e, "General", "google_news"))
        if err:
            errores[m[0]] = err
    # 3) ediciones de Google News por tema (traen muchos diarios, con su nombre)
    eds = [(ed, tema, sec) for ed in EDICIONES for tema, sec in TEMAS_GN if ed[4] is None or tema in ed[4]]
    def url_ed(t):
        ed, tema, _ = t
        return f"https://news.google.com/rss/headlines/section/topic/{tema}?{ed[2]}"
    with ThreadPoolExecutor(max_workers=12) as ex:
        res3 = list(ex.map(lambda t: leer(url_ed(t)), eds))

    nuevas, status = 0, {}
    pais_de = {m[0]: m for m in MEDIOS}

    def agrega(e, nombre, pais, region, lang, tipo, sec, via, agg):
        nonlocal nuevas
        link, tit = e.get("link", ""), limpia(e.get("title", ""))
        if via != "rss":
            tit = re.sub(r"\s+-\s+[^-]{2,40}$", "", tit)  # saca « - Nombre del medio » del final
        if not link or not tit:
            return 0
        i = idn(link, tit)
        k = (nombre, re.sub(r"\W+", "", tit.lower())[:80])
        if i in ids or k in claves:
            return 0
        ids.add(i)
        claves.add(k)
        txt = tit + " " + limpia(e.get("summary", ""))[:300]
        viejas.append({"id": i, "category": "Internacional", "title": tit, "link": link, "source": nombre,
                       "country": pais, "region": region, "lang": lang, "tipo": tipo, "sec": sec,
                       "published_iso": iso(e), "collected_at": ahora,
                       "arg": bool(ARG.search(txt)), "lat": bool(LAT.search(txt)), "via": via, "agg": agg})
        nuevas += 1
        return 1

    for m in MEDIOS:
        nombre, pais, region, lang, tipo = m[:5]
        ents = por_medio[nombre]
        hechas = sum(agrega(e, nombre, pais, region, lang, tipo, sec, via, False) for (e, sec, via) in ents)
        via = ents[0][2] if ents else None
        status[nombre] = {"state": "ok" if ents else ("error" if nombre in errores else "sin_resultados"), "via": via,
                          "region": region, "tipo": tipo, "items": len(ents), "nuevas": hechas,
                          "message": errores.get(nombre) if not ents else None, "checked_at": ahora}
    for (ed, tema, sec), (ents, err) in zip(eds, res3):
        hechas = 0
        for e in ents:
            fuente = ""
            try:
                fuente = (e.get("source") or {}).get("title") or ""
            except Exception:  # noqa: BLE001
                pass
            fuente = limpia(fuente) or "Google News"
            hechas += agrega(e, fuente, ed[0], ed[1], ed[3], "privado", sec, "google_news_tema", True)
        clave = f"Google News · {ed[0]} · {sec}"
        status[clave] = {"state": "ok" if ents else ("error" if err else "sin_resultados"), "via": "google_news_tema",
                         "region": ed[1], "tipo": "agregador", "items": len(ents), "nuevas": hechas,
                         "message": err if not ents else None, "checked_at": ahora}
    corte = (datetime.now(timezone.utc) - timedelta(days=DIAS)).isoformat()
    viejas = [n for n in viejas if (n.get("published_iso") or n.get("collected_at") or "") >= corte]
    viejas.sort(key=lambda n: n.get("published_iso") or n.get("collected_at") or "", reverse=True)
    viejas = viejas[:MAX_GUARDADAS]
    os.makedirs(DATA, exist_ok=True)
    json.dump(viejas, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"generated_at": ahora, "medios": status}, open(ST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ok = sum(1 for v in status.values() if v["state"] == "ok")
    print(f"Fuentes que respondieron: {ok} de {len(status)} · titulares nuevos: {nuevas} · guardados: {len(viejas)} · diarios distintos: {len({n['source'] for n in viejas})}")


if __name__ == "__main__":
    main()
