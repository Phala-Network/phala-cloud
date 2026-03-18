.PHONY: test e2e lint fmt check

lint:
	uv run ruff check .

fmt:
	uv run ruff format .

check: fmt lint test

test:
	uv run pytest -q -p no:cacheprovider

e2e:
	@bash -lc 'set -a; [ -f .env.test ] && source .env.test; set +a; \
	if [ -z "$$PHALA_CLOUD_E2E_API_KEY" ]; then \
		echo "Missing env: PHALA_CLOUD_E2E_API_KEY"; \
		exit 1; \
	fi; \
	ALL_PROXY= NO_PROXY="*" uv run pytest -m e2e -s -q'
