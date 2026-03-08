terraform {
  required_version = ">= 1.5.0"

  required_providers {
    phala = {
      source  = "phala-network/phala"
      version = "0.2.0-beta.1"
    }
  }
}

provider "phala" {}

resource "phala_app" "hello" {
  name      = "hello-phala"
  size      = "tdx.medium"
  region    = "US-WEST-1"
  image     = "dstack-dev-0.5.7-9b6a5239"
  disk_size = 40
  replicas  = 1

  docker_compose = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML

  wait_for_ready       = true
  wait_timeout_seconds = 900
}

output "app_id" {
  value = phala_app.hello.app_id
}

output "endpoint" {
  value = phala_app.hello.endpoint
}
