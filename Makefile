# Makefile for autonomous-cicd-template
# Usage: make <target>

.PHONY: help install lint format test test-cov security build clean docker-build docker-run

# Default target
help:
	@echo "Available targets:"
	@echo "  install     - Install dependencies"
	@echo "  lint        - Run linters (ruff, mypy)"
	@echo "  format      - Format code (black, isort)"
	@echo "  test        - Run tests"
	@echo "  test-cov    - Run tests with coverage"
	@echo "  security    - Run security scans"
	@echo "  build       - Build the package"
	@echo "  clean       - Clean build artifacts"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run  - Run Docker container"

# Install dependencies
install:
	pip install -r requirements.txt

# Linting
lint:
	ruff check .
	mypy . --ignore-missing-imports

# Formatting
format:
	black .
	isort .

# Format check (CI mode)
format-check:
	black --check .
	isort --check-only .

# Run tests
test:
	pytest tests/ -v

# Run tests with coverage
test-cov:
	pytest tests/ --cov=src --cov-report=term-missing --cov-report=xml --cov-fail-under=85

# Run integration tests
test-integration:
	pytest tests/integration/ -v -m integration

# Security scans
security:
	bandit -r src/ -ll
	safety check -r requirements.txt

# Build package
build:
	pip install build
	python -m build

# Clean build artifacts
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	rm -rf .ruff_cache/
	rm -rf htmlcov/
	rm -rf coverage.xml
	find . -type d -name __pycache__ -exec rm -rf {} +

# Docker
docker-build:
	docker build -t autonomous-cicd-template:latest .

docker-run:
	docker run --rm -it --env-file .env autonomous-cicd-template:latest

# CI targets
ci-lint: format-check lint
ci-test: test-cov
ci-security: security
ci: ci-lint ci-test ci-security
