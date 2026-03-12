terraform {
  required_version = ">= 1.5.0"

  required_providers {
    phala = {
      source = "phala-network/phala"
    }
  }
}

provider "phala" {
  api_key = var.phala_api_key
}

data "phala_account" "current" {}

data "phala_workspace" "current" {}

data "phala_sizes" "all" {}

data "phala_regions" "all" {}

data "phala_images" "all" {}

locals {
  selected_size   = var.size != "" ? var.size : data.phala_sizes.all.sizes[0].slug
  selected_region = var.region != "" ? var.region : data.phala_regions.all.regions[0].slug
}

resource "phala_ssh_key" "smoke" {
  count = var.create_resources && var.ssh_public_key != "" ? 1 : 0

  name       = var.ssh_key_name
  public_key = var.ssh_public_key
}

resource "phala_app" "smoke" {
  count = var.create_resources ? 1 : 0

  name                = var.app_name
  size                = local.selected_size
  region              = local.selected_region
  image               = var.image != "" ? var.image : null
  ssh_authorized_keys = var.cvm_ssh_authorized_keys
  env                 = var.app_env
  docker_compose      = var.docker_compose
  replicas            = var.app_replicas

  wait_for_ready       = var.wait_for_ready
  wait_timeout_seconds = var.wait_timeout_seconds
}

resource "phala_app" "consumer" {
  count = var.create_resources && var.create_consumer_app ? 1 : 0

  name                = var.consumer_app_name
  size                = local.selected_size
  region              = local.selected_region
  image               = var.image != "" ? var.image : null
  ssh_authorized_keys = var.cvm_ssh_authorized_keys
  env = merge(
    var.consumer_app_env,
    {
      UPSTREAM_APP_ID   = phala_app.smoke[0].app_id
      UPSTREAM_ENDPOINT = phala_app.smoke[0].endpoint
    }
  )
  docker_compose = var.consumer_app_docker_compose
  replicas       = var.consumer_app_replicas

  wait_for_ready       = var.wait_for_ready
  wait_timeout_seconds = var.wait_timeout_seconds
}

resource "phala_cvm_power" "smoke" {
  count = var.create_resources && var.cvm_power_state != "" ? 1 : 0

  cvm_id = phala_app.smoke[0].primary_cvm_id
  state  = var.cvm_power_state

  wait_for_state       = var.wait_for_ready
  wait_timeout_seconds = var.wait_timeout_seconds
}
