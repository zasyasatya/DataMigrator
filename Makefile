.PHONY: install install-api build-widget dev-api dev-web build test test-api typecheck run docker-up verify

run:
	python3 run.py

docker-up:
	python3 run.py docker

# Smoke test end-to-end ke URL yang sudah hidup (default lokal :3000).
# Contoh produksi:  make verify BASE=https://sapa.zasya.id
verify:
	BASE=$(or $(BASE),http://127.0.0.1:3000) node scripts/verify-deploy.mjs

install: install-api
	npm install --no-audit --no-fund

install-api:
	cd apps/api && python3 -m venv .venv && .venv/bin/pip install -q -r requirements-dev.txt

build-widget:
	npm run build:widget

dev-api:
	cd apps/api && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	npm run dev:web

build: build-widget
	npm run build:web

test: test-api typecheck
	npm run build:widget

test-api:
	cd apps/api && .venv/bin/python -m pytest -q

typecheck:
	cd apps/web && npx tsc --noEmit
	cd packages/widget && npx tsc --noEmit
