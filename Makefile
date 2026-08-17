# ArduPilot source dung lam SITL. Mac dinh la ./ardupilot (da bi gitignore,
# khong phai code cua du an). Doi bang ARDUPILOT_DIR neu ban dat cho khac.
PYTHON ?= python3
VENV ?= .venv
ARDUPILOT_DIR ?= ./ardupilot

.PHONY: help setup setup-ml lint fmt test run sitl github-bootstrap clean

help:
	@echo "make setup            - tao venv va cai core + dev dependencies"
	@echo "make setup-ml         - cai them ML stack (ultralytics, opencv...)"
	@echo "make lint             - ruff check"
	@echo "make fmt              - ruff format"
	@echo "make test             - pytest"
	@echo "make run              - chay backend FastAPI (reload)"
	@echo "make sitl             - chay ArduCopter SITL"
	@echo "make github-bootstrap - tao labels/milestones/issues tren GitHub (can gh)"

setup:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install -r requirements-dev.txt
	@echo "Xong. Activate bang: source $(VENV)/bin/activate"

setup-ml:
	$(VENV)/bin/pip install -r requirements-ml.txt

lint:
	$(PYTHON) -m ruff check .

fmt:
	$(PYTHON) -m ruff format .

test:
	@if [ -d backend/tests ]; then $(PYTHON) -m pytest; else echo "Chua co backend/tests."; fi

run:
	$(PYTHON) -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000

sitl:
	ARDUPILOT_DIR=$(ARDUPILOT_DIR) ./scripts/run_sitl.sh

github-bootstrap:
	$(PYTHON) scripts/github/bootstrap_github.py

clean:
	find . -type d -name __pycache__ -not -path "./ardupilot/*" -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache
