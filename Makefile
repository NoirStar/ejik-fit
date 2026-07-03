COMPOSE ?= docker compose

.PHONY: setup up down logs migrate seed sources crawl test backend-test web-test smoke

setup:
	@test -f .env || cp .env.example .env

up: setup
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f api worker web

migrate:
	$(COMPOSE) exec -T api alembic -c /app/packages/backend/alembic.ini upgrade head

seed:
	$(COMPOSE) exec -T api ejikfit seed-sources

sources:
	$(COMPOSE) exec -T api ejikfit list-sources

crawl:
	@test -n "$(SOURCE_ID)" || (echo "SOURCE_ID가 필요합니다. make sources로 확인하세요."; exit 1)
	$(COMPOSE) exec -T api ejikfit crawl-source "$(SOURCE_ID)"

backend-test:
	$(COMPOSE) run --rm --build api pytest /app/packages/backend/tests -v

web-test:
	docker build --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg http_proxy --build-arg https_proxy --target builder -f apps/web/Dockerfile -t ejik-fit-web-test .
	docker run --rm --entrypoint sh ejik-fit-web-test -c "npm test -- --run && npm run lint"

test: backend-test web-test

smoke:
	bash scripts/smoke.sh
