# ArduPilot source dung lam SITL. Mac dinh la ~/ardupilot TRONG WSL — khong
# phai trong repo (Phase 02 viec 02.2 clone vao $HOME, xem plan). Doi bang
# ARDUPILOT_DIR neu ban dat cho khac.
#
# `make sitl` CHI CHAY DUOC TRONG WSL. Goi tu PowerShell:
#   wsl -d Ubuntu -- bash -lc "cd /mnt/d/Coding/IOT-CV && make sitl"
ARDUPILOT_DIR ?= $(HOME)/ardupilot

.PHONY: help setup setup-ml lint fmt test run sitl github-bootstrap clean

help:
	@echo "make setup            - cai phu thuoc backend (uv, Python 3.13)"
	@echo "make setup-ml         - cai phu thuoc ML thuan Python (KHONG gom torch)"
	@echo "make lint             - ruff check"
	@echo "make fmt              - ruff format"
	@echo "make test             - pytest"
	@echo "make run              - chay backend FastAPI (reload)"
	@echo "make sitl             - chay ArduCopter SITL (CHI TRONG WSL)"
	@echo "make github-bootstrap - tao labels/milestones/issues tren GitHub (can gh)"

setup:
	uv sync --extra dev

# ml/ la du an uv RIENG. torch/torchvision KHONG nam trong ml/pyproject.toml va
# muc nay KHONG cai chung — phai cai truoc bang --index-url cu130, xem AI Phase 1
# §A1.1. De pip tu keo torch theo ultralytics se ra ban CPU, khong canh bao gi.
setup-ml:
	cd ml && uv sync

lint:
	uv run ruff check .

fmt:
	uv run ruff format .

test:
	uv run pytest

run:
	uv run uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000

sitl:
	ARDUPILOT_DIR='$(ARDUPILOT_DIR)' ./scripts/run_sitl.sh

github-bootstrap:
	uv run python scripts/github/bootstrap_github.py

clean:
	find . -type d -name __pycache__ -not -path "./ardupilot/*" -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache
