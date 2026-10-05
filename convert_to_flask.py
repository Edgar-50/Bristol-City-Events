from __future__ import annotations

import re
import shutil
from pathlib import Path

SOURCE_HTML = ".html"
CSS_EXT = ".css"
JS_EXT = ".js"
ASSET_DIRS = {"assets", "images", "img", "fonts"}

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR
TEMPLATES_DIR = PROJECT_ROOT / "templates"
STATIC_DIR = PROJECT_ROOT / "static"
STATIC_CSS = STATIC_DIR / "css"
STATIC_JS = STATIC_DIR / "js"
STATIC_ASSETS = STATIC_DIR / "assets"


def ensure_structure() -> None:
    TEMPLATES_DIR.mkdir(exist_ok=True)
    STATIC_CSS.mkdir(parents=True, exist_ok=True)
    STATIC_JS.mkdir(parents=True, exist_ok=True)
    STATIC_ASSETS.mkdir(parents=True, exist_ok=True)


def rewrite_html(content: str) -> str:
    content = re.sub(r'href=["\'](?!https?:|#|mailto:|{{)([^"\']+\.css)["\']', r'href="{{ url_for(\'static\', filename=\'css/\1\') }}"', content)
    content = re.sub(r'src=["\'](?!https?:|{{)([^"\']+\.js)["\']', r'src="{{ url_for(\'static\', filename=\'js/\1\') }}"', content)
    content = re.sub(r'(src|href)=["\'](?!https?:|#|mailto:|{{)(assets/[^"\']+)["\']', r'\1="{{ url_for(\'static\', filename=\'\2\') }}"', content)

    route_map = {
        "index.html": "index",
        "about.html": "about",
        "contact.html": "contact",
        "events.html": "events",
        "explore.html": "explore",
        "news.html": "news",
        "support.html": "support",
        "login.html": "login",
        "admin.html": "admin",
        "userpanel.html": "userpanel",
    }

    for file_name, endpoint in route_map.items():
        content = re.sub(
            rf'href=["\']{re.escape(file_name)}["\']',
            f'href="{{{{ url_for(\'{endpoint}\') }}}}"',
            content,
        )

    return content


def convert() -> None:
    ensure_structure()

    for item in PROJECT_ROOT.iterdir():
        if item.name in {"templates", "static", "instance", "__pycache__"}:
            continue
        if item.name.startswith("."):
            continue

        if item.is_dir() and item.name.lower() in ASSET_DIRS:
            destination = STATIC_ASSETS / item.name
            if destination.exists():
                shutil.rmtree(destination)
            shutil.copytree(item, destination)
            continue

        if item.is_file() and item.suffix.lower() == SOURCE_HTML:
            html = item.read_text(encoding="utf-8", errors="ignore")
            (TEMPLATES_DIR / item.name).write_text(rewrite_html(html), encoding="utf-8")
        elif item.is_file() and item.suffix.lower() == CSS_EXT:
            shutil.copy2(item, STATIC_CSS / item.name)
        elif item.is_file() and item.suffix.lower() == JS_EXT:
            shutil.copy2(item, STATIC_JS / item.name)

    print("Conversion complete. HTML files moved to templates/, CSS to static/css/, JS to static/js/, assets to static/assets/.")


if __name__ == "__main__":
    convert()
