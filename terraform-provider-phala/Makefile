SHELL := /bin/bash

GO ?= go
PROVIDER_SOURCE ?= phala-network/phala
DEV_PLUGIN_DIR ?= /tmp/phala-tf-dev
DEV_TF_CLI_CONFIG ?= $(DEV_PLUGIN_DIR)/terraformrc
SMOKE_DIR ?= $(CURDIR)/examples/smoke
DIST_DIR ?= $(CURDIR)/dist
VERSION ?= dev
LDFLAGS ?= -s -w -X main.version=$(VERSION)

PHALA_API_KEY ?=
CREATE_RESOURCES ?= false
CREATE_APP_RESOURCES ?= false
SSH_PUBLIC_KEY ?=
SSH_KEY_NAME ?= tf-smoke-key
CVM_NAME ?= tf-smoke-cvm
APP_NAME ?= tf-smoke-app
APP_REPLICAS ?= 1
CREATE_CONSUMER_APP ?= false
CONSUMER_APP_NAME ?= tf-smoke-consumer
CONSUMER_APP_REPLICAS ?= 1
CREATE_LINKED_CVM ?= false
LINKED_CVM_NAME ?= tf-smoke-cvm-linked
CVM_SSH_AUTHORIZED_KEYS ?= []
CVM_ENV ?= {}
APP_ENV ?= {}
CONSUMER_APP_ENV ?= {}
LINKED_CVM_ENV ?= {}
CVM_POWER_STATE ?=
WAIT_FOR_READY ?= true
WAIT_TIMEOUT_SECONDS ?= 900
SIZE ?=
REGION ?=
IMAGE ?=

.PHONY: fmt fmt-check test vet ci build build-release package-release devrc smoke-init smoke-plan smoke-apply smoke-destroy release-dry-run

build:
	@mkdir -p "$(DEV_PLUGIN_DIR)"
	$(GO) build -ldflags "$(LDFLAGS)" -o "$(DEV_PLUGIN_DIR)/terraform-provider-phala" .
	@echo "Built provider binary at $(DEV_PLUGIN_DIR)/terraform-provider-phala"

build-release:
	@mkdir -p "$(DIST_DIR)"
	$(GO) build -ldflags "$(LDFLAGS)" -o "$(DIST_DIR)/terraform-provider-phala" .
	@echo "Built release binary at $(DIST_DIR)/terraform-provider-phala (version=$(VERSION))"

fmt:
	$(GO) fmt ./...

fmt-check:
	@out="$$(gofmt -l $$(find . -name '*.go' -not -path './vendor/*'))"; \
	if [ -n "$$out" ]; then \
		echo "Files need gofmt:"; \
		echo "$$out"; \
		exit 1; \
	fi

test:
	$(GO) test ./...

vet:
	$(GO) vet ./...

ci: fmt-check vet test build-release

devrc:
	@mkdir -p "$(DEV_PLUGIN_DIR)"
	@printf '%s\n' \
		'provider_installation {' \
		'  dev_overrides {' \
		'    "$(PROVIDER_SOURCE)" = "$(DEV_PLUGIN_DIR)"' \
		'  }' \
		'  direct {}' \
		'}' > "$(DEV_TF_CLI_CONFIG)"
	@echo "Wrote Terraform CLI config: $(DEV_TF_CLI_CONFIG)"

smoke-init: build devrc
	@if [ -z "$(PHALA_API_KEY)" ]; then echo "PHALA_API_KEY is required"; exit 1; fi
	@echo "Dev override mode: skipping 'terraform init' (provider is not published yet)"

smoke-plan: smoke-init
	@cd "$(SMOKE_DIR)" && \
		TF_CLI_CONFIG_FILE="$(DEV_TF_CLI_CONFIG)" \
		TF_VAR_phala_api_key="$(PHALA_API_KEY)" \
		TF_VAR_create_resources="$(CREATE_RESOURCES)" \
		TF_VAR_create_app_resources="$(CREATE_APP_RESOURCES)" \
		TF_VAR_ssh_public_key="$(SSH_PUBLIC_KEY)" \
		TF_VAR_ssh_key_name="$(SSH_KEY_NAME)" \
		TF_VAR_cvm_name="$(CVM_NAME)" \
		TF_VAR_app_name="$(APP_NAME)" \
		TF_VAR_app_replicas="$(APP_REPLICAS)" \
		TF_VAR_create_consumer_app="$(CREATE_CONSUMER_APP)" \
		TF_VAR_consumer_app_name="$(CONSUMER_APP_NAME)" \
		TF_VAR_consumer_app_replicas="$(CONSUMER_APP_REPLICAS)" \
		TF_VAR_create_linked_cvm="$(CREATE_LINKED_CVM)" \
		TF_VAR_linked_cvm_name="$(LINKED_CVM_NAME)" \
		TF_VAR_cvm_ssh_authorized_keys='$(CVM_SSH_AUTHORIZED_KEYS)' \
		TF_VAR_cvm_env='$(CVM_ENV)' \
		TF_VAR_app_env='$(APP_ENV)' \
		TF_VAR_consumer_app_env='$(CONSUMER_APP_ENV)' \
		TF_VAR_linked_cvm_env='$(LINKED_CVM_ENV)' \
		TF_VAR_cvm_power_state='$(CVM_POWER_STATE)' \
		TF_VAR_wait_for_ready='$(WAIT_FOR_READY)' \
		TF_VAR_wait_timeout_seconds='$(WAIT_TIMEOUT_SECONDS)' \
		TF_VAR_size="$(SIZE)" \
		TF_VAR_region="$(REGION)" \
		TF_VAR_image="$(IMAGE)" \
		terraform plan

smoke-apply: smoke-init
	@cd "$(SMOKE_DIR)" && \
		TF_CLI_CONFIG_FILE="$(DEV_TF_CLI_CONFIG)" \
		TF_VAR_phala_api_key="$(PHALA_API_KEY)" \
		TF_VAR_create_resources="$(CREATE_RESOURCES)" \
		TF_VAR_create_app_resources="$(CREATE_APP_RESOURCES)" \
		TF_VAR_ssh_public_key="$(SSH_PUBLIC_KEY)" \
		TF_VAR_ssh_key_name="$(SSH_KEY_NAME)" \
		TF_VAR_cvm_name="$(CVM_NAME)" \
		TF_VAR_app_name="$(APP_NAME)" \
		TF_VAR_app_replicas="$(APP_REPLICAS)" \
		TF_VAR_create_consumer_app="$(CREATE_CONSUMER_APP)" \
		TF_VAR_consumer_app_name="$(CONSUMER_APP_NAME)" \
		TF_VAR_consumer_app_replicas="$(CONSUMER_APP_REPLICAS)" \
		TF_VAR_create_linked_cvm="$(CREATE_LINKED_CVM)" \
		TF_VAR_linked_cvm_name="$(LINKED_CVM_NAME)" \
		TF_VAR_cvm_ssh_authorized_keys='$(CVM_SSH_AUTHORIZED_KEYS)' \
		TF_VAR_cvm_env='$(CVM_ENV)' \
		TF_VAR_app_env='$(APP_ENV)' \
		TF_VAR_consumer_app_env='$(CONSUMER_APP_ENV)' \
		TF_VAR_linked_cvm_env='$(LINKED_CVM_ENV)' \
		TF_VAR_cvm_power_state='$(CVM_POWER_STATE)' \
		TF_VAR_wait_for_ready='$(WAIT_FOR_READY)' \
		TF_VAR_wait_timeout_seconds='$(WAIT_TIMEOUT_SECONDS)' \
		TF_VAR_size="$(SIZE)" \
		TF_VAR_region="$(REGION)" \
		TF_VAR_image="$(IMAGE)" \
		terraform apply -auto-approve

smoke-destroy: smoke-init
	@cd "$(SMOKE_DIR)" && \
		TF_CLI_CONFIG_FILE="$(DEV_TF_CLI_CONFIG)" \
		TF_VAR_phala_api_key="$(PHALA_API_KEY)" \
		TF_VAR_create_resources="$(CREATE_RESOURCES)" \
		TF_VAR_create_app_resources="$(CREATE_APP_RESOURCES)" \
		TF_VAR_ssh_public_key="$(SSH_PUBLIC_KEY)" \
		TF_VAR_ssh_key_name="$(SSH_KEY_NAME)" \
		TF_VAR_cvm_name="$(CVM_NAME)" \
		TF_VAR_app_name="$(APP_NAME)" \
		TF_VAR_app_replicas="$(APP_REPLICAS)" \
		TF_VAR_create_consumer_app="$(CREATE_CONSUMER_APP)" \
		TF_VAR_consumer_app_name="$(CONSUMER_APP_NAME)" \
		TF_VAR_consumer_app_replicas="$(CONSUMER_APP_REPLICAS)" \
		TF_VAR_create_linked_cvm="$(CREATE_LINKED_CVM)" \
		TF_VAR_linked_cvm_name="$(LINKED_CVM_NAME)" \
		TF_VAR_cvm_ssh_authorized_keys='$(CVM_SSH_AUTHORIZED_KEYS)' \
		TF_VAR_cvm_env='$(CVM_ENV)' \
		TF_VAR_app_env='$(APP_ENV)' \
		TF_VAR_consumer_app_env='$(CONSUMER_APP_ENV)' \
		TF_VAR_linked_cvm_env='$(LINKED_CVM_ENV)' \
		TF_VAR_cvm_power_state='$(CVM_POWER_STATE)' \
		TF_VAR_wait_for_ready='$(WAIT_FOR_READY)' \
		TF_VAR_wait_timeout_seconds='$(WAIT_TIMEOUT_SECONDS)' \
		TF_VAR_size="$(SIZE)" \
		TF_VAR_region="$(REGION)" \
		TF_VAR_image="$(IMAGE)" \
		terraform destroy -auto-approve

release-dry-run:
	@echo "Running release packaging dry-run (version=$(VERSION))"
	@$(MAKE) package-release VERSION="$(VERSION)"

package-release:
	cd "$(CURDIR)" && ./scripts/package-release.sh "$(VERSION)"
