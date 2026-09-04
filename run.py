#!/usr/bin/env python3
"""Sapa AI — one-command runner (stdlib only, Windows/Linux/Mac).

    python run.py              # DEV: api:8000 + web:3000 (default, satu command)
    python run.py dev          # sama seperti di atas
    python run.py api          # backend saja (foreground)
    python run.py web          # dashboard saja (foreground)
    python run.py build        # build widget (+ --all ikut build web produksi)
    python run.py test         # pytest backend (+ --full ikut typecheck web & widget)
    python run.py docker       # build widget lalu `docker compose up --build`
    python run.py check        # cek prasyarat: python/node/npm/.env/port/widget

Opsi: --api-port, --web-port, --no-build, --no-install, --no-reload, -d/--detached.
Env yang dihormati: PORT (web), API_PORT (api). Contoh:
    python run.py --web-port 3100
    SECRET_KEY=rahasia python run.py docker -d
"""

from __future__ import annotations

import argparse
import os
import queue
import shutil
import socket
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_DIR = ROOT / "apps" / "api"
WEB_DIR = ROOT / "apps" / "web"
WIDGET_DIR = ROOT / "packages" / "widget"
WIDGET_BUNDLE = WIDGET_DIR / "dist" / "widget.js"


def log(msg: str) -> None:
    print(f"[run] {msg}", flush=True)


def fail(msg: str, code: int = 1) -> typing.NoReturn:
    print(f"[run] ERROR: {msg}", flush=True)
    raise SystemExit(code)


# ---------------------------------------------------------------- helpers ---

def venv_python() -> str:
    """Python venv backend bila ada, fallback ke interpreter saat ini."""
    cand = (
        API_DIR / ".venv" / "Scripts" / "python.exe"
        if os.name == "nt"
        else API_DIR / ".venv" / "bin" / "python"
    )
    return str(cand) if cand.exists() else sys.executable


def npm_bin_dir() -> Path:
    return ROOT / "node_modules" / ".bin"


def with_node_bin(env: dict) -> dict:
    """Pastikan binary hoisted workspace (next, tsc, esbuild) ketemu."""
    d = str(npm_bin_dir())
    if npm_bin_dir().exists() and d not in env.get("PATH", "").split(os.pathsep):
        env["PATH"] = d + os.pathsep + env.get("PATH", "")
    return env


def ensure_env_file() -> None:
    env, example = ROOT / ".env", ROOT / ".env.example"
    if not env.exists() and example.exists():
        shutil.copy(example, env)
        log("membuat .env dari .env.example — sesuaikan SECRET_KEY & OPENAI_API_KEY")


def ensure_node_modules(allow_install: bool) -> bool:
    if (ROOT / "node_modules").exists():
        return True
    if not allow_install:
        log("node_modules belum ada (--no-install): langkah node bisa gagal")
        return False
    log("npm install ... (pertama kali, 1-3 menit)")
    subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd=ROOT, check=True)
    return True


def ensure_widget(allow_install: bool, allow_build: bool) -> bool:
    if WIDGET_BUNDLE.exists():
        return True
    if not allow_build:
        log("dist/widget.js belum ada (--no-build): /embed/widget.js akan 404")
        return False
    ensure_node_modules(allow_install)
    log("build widget (packages/widget -> dist/widget.js) ...")
    subprocess.run(["npm", "run", "build:widget"], cwd=ROOT, check=True)
    return WIDGET_BUNDLE.exists()


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


# ---------------------------------------------------------------- commands ---

def api_cmd(port: int, reload: bool) -> list[str]:
    cmd = [
        venv_python(), "-m", "uvicorn", "app.main:app",
        "--app-dir", str(API_DIR),
        "--host", "0.0.0.0", "--port", str(port),
    ]
    if reload:
        cmd.append("--reload")
    return cmd


def web_cmd(port: int) -> list[str]:
    # Binary next langsung (cwd apps/web) — port bebas tanpa ubah package.json.
    return [str(npm_bin_dir() / "next") if (npm_bin_dir() / "next").exists() else "npx",
            *([] if (npm_bin_dir() / "next").exists() else ["--yes", "next"]),
            "dev" if (npm_bin_dir() / "next").exists() else "dev",
            "-H", "0.0.0.0", "-p", str(port)]


def _pump(prefix: str, pipe, out_q: "queue.Queue[str]") -> None:
    try:
        for line in iter(pipe.readline, ""):
            out_q.put(f"{prefix} {line.rstrip()}")
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def run_many(cmds: list[tuple[str, list[str], Path]]) -> int:
    """Jalankan N proses paralel, log ber-prefix, Ctrl+C mematikan semua."""
    out_q: queue.Queue[str | None] = queue.Queue()
    procs: list[tuple[str, subprocess.Popen]] = []
    stop = threading.Event()

    def printer() -> None:
        while not stop.is_set():
            try:
                line = out_q.get(timeout=0.2)
            except queue.Empty:
                continue
            if line is None:
                return
            print(line, flush=True)

    t = threading.Thread(target=printer, daemon=True)
    t.start()
    try:
        for name, cmd, cwd in cmds:
            env = with_node_bin({**os.environ, "PYTHONUNBUFFERED": "1"})
            p = subprocess.Popen(
                cmd, cwd=str(cwd), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1,
            )
            procs.append((name, p))
            threading.Thread(target=_pump, args=(f"[{name}]", p.stdout, out_q), daemon=True).start()
            log(f"{name}: pid {p.pid} — {' '.join(cmd)}")
        while True:
            for name, p in procs:
                try:
                    code = p.wait(timeout=0.5)
                except subprocess.TimeoutExpired:
                    continue
                log(f"{name} berhenti (exit {code}) — mematikan sisanya")
                return code
    except KeyboardInterrupt:
        log("Ctrl+C — mematikan semua proses ...")
        return 130
    finally:
        for _, p in procs:
            if p.poll() is None:
                p.terminate()
        for _, p in procs:
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                p.kill()
        stop.set()
        out_q.put(None)


def cmd_dev(a: argparse.Namespace) -> int:
    ensure_env_file()
    ensure_widget(allow_install=not a.no_install, allow_build=not a.no_build)
    procs: list[tuple[str, list[str], Path]] = []
    procs.append(("api", api_cmd(a.api_port, reload=not a.no_reload), ROOT))
    if not port_free(a.web_port):
        fail(f"port web {a.web_port} sudah dipakai — bebas kan dulu atau --web-port lain")
    procs.append(("web", web_cmd(a.web_port), WEB_DIR))
    log(f"dashboard http://localhost:{a.web_port} | api http://localhost:{a.api_port} (/docs)")
    log("login default admin@sapa.ai / admin123 — Ctrl+C untuk berhenti")
    return run_many(procs)


def cmd_single(a: argparse.Namespace, which: str) -> int:
    ensure_env_file()
    if which == "api":
        if which == "api":
            ensure_widget(allow_install=not a.no_install, allow_build=not a.no_build)
        log(f"api http://localhost:{a.api_port} (/docs)")
        return run_many([("api", api_cmd(a.api_port, reload=not a.no_reload), ROOT)])
    log(f"dashboard http://localhost:{a.web_port}")
    return run_many([("web", web_cmd(a.web_port), WEB_DIR)])


def cmd_build(a: argparse.Namespace) -> int:
    ensure_node_modules(allow_install=not a.no_install)
    subprocess.run(["npm", "run", "build:widget"], cwd=ROOT, check=True)
    log(f"widget OK: {WIDGET_BUNDLE.relative_to(ROOT)}")
    if a.all:
        subprocess.run(["npm", "run", "build:web"], cwd=ROOT, check=True)
        log("web OK: apps/web/.next")
    return 0


def cmd_test(a: argparse.Namespace) -> int:
    r = subprocess.run([venv_python(), "-m", "pytest", "-q"], cwd=API_DIR)
    if r.returncode != 0:
        fail("pytest backend GAGAL — lihat output di atas")
    log("pytest backend: HIJAU")
    if a.full:
        for d in (WEB_DIR, WIDGET_DIR):
            log(f"typecheck {d.relative_to(ROOT)} ...")
            r = subprocess.run(["npx", "--yes", "tsc", "--noEmit"], cwd=d)
            if r.returncode != 0:
                fail(f"typecheck {d.name} GAGAL")
        log("typecheck web + widget: HIJAU")
    return 0


def cmd_docker(a: argparse.Namespace) -> int:
    ensure_env_file()
    ensure_widget(allow_install=not a.no_install, allow_build=not a.no_build)
    cmd = ["docker", "compose", "up", "--build"]
    if a.detached:
        cmd.append("-d")
    log(" ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT).returncode


def cmd_check(a: argparse.Namespace) -> int:
    ok = True

    def row(name: str, good: bool, hint: str = "", required: bool = True) -> None:
        nonlocal ok
        if good:
            print(f"[check] [OK ] {name} {hint}", flush=True)
        elif required:
            print(f"[check] [!! ] {name} {hint}", flush=True)
            ok = False
        else:
            print(f"[check] [-- ] {name} {hint}", flush=True)

    py_v = sys.version_info
    row(f"python {py_v.major}.{py_v.minor}.{py_v.micro}", py_v >= (3, 10), "(butuh >=3.10)")
    node = shutil.which("node")
    node_v = ""
    if node:
        try:
            node_v = subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()
        except Exception:
            pass
    row(f"node {node_v or 'tidak ketemu'}", bool(node) and node_v.lstrip("v").split(".")[0].isdigit() and int(node_v.lstrip("v").split(".")[0]) >= 20, "(butuh >=20)")
    row("npm", bool(shutil.which("npm")))
    row("docker", bool(shutil.which("docker")), "(opsional, hanya untuk run.py docker)", required=False)
    row(".env", (ROOT / ".env").exists(), "(auto-dibuat dari .env.example saat dev/docker)", required=False)
    row("venv backend", venv_python() != sys.executable or (API_DIR / ".venv").exists(), "(make install-api bila belum)")
    row("node_modules", (ROOT / "node_modules").exists(), "(auto-install saat dev)")
    row("widget dist", WIDGET_BUNDLE.exists(), "(auto-build saat dev)")
    row(f"port api {a.api_port} bebas", port_free(a.api_port))
    row(f"port web {a.web_port} bebas", port_free(a.web_port))
    log("semua prasyarat OK" if ok else "ada yang kurang — ikuti hint di atas")
    return 0 if ok else 1


# ------------------------------------------------------------------ main ---

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Sapa AI — one-command runner")
    p.add_argument("command", nargs="?", default="dev",
                   choices=["dev", "api", "web", "build", "test", "docker", "check"])
    p.add_argument("--api-port", type=int, default=int(os.environ.get("API_PORT", "8000")))
    p.add_argument("--web-port", type=int, default=int(os.environ.get("PORT", "3000")))
    p.add_argument("--no-build", action="store_true", help="jangan build widget otomatis")
    p.add_argument("--no-install", action="store_true", help="jangan npm install otomatis")
    p.add_argument("--no-reload", action="store_true", help="uvicorn tanpa --reload")
    p.add_argument("--all", action="store_true", help="build: ikut build web produksi")
    p.add_argument("--full", action="store_true", help="test: + typecheck web & widget")
    p.add_argument("-d", "--detached", action="store_true", help="docker: up background")
    a = p.parse_args(argv)

    if a.command == "dev":
        return cmd_dev(a)
    if a.command in ("api", "web"):
        return cmd_single(a, a.command)
    if a.command == "build":
        return cmd_build(a)
    if a.command == "test":
        return cmd_test(a)
    if a.command == "docker":
        return cmd_docker(a)
    if a.command == "check":
        return cmd_check(a)
    p.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
