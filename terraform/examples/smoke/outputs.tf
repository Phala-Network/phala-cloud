output "sizes_count" {
  value = length(data.phala_sizes.all.sizes)
}

output "regions_count" {
  value = length(data.phala_regions.all.regions)
}

output "images_count" {
  value = length(data.phala_images.all.images)
}

output "account_username" {
  value = data.phala_account.current.username
}

output "workspace_slug" {
  value = data.phala_workspace.current.slug
}

output "cvm_id" {
  value = var.create_resources ? phala_cvm.smoke[0].id : null
}

output "cvm_endpoint" {
  value = var.create_resources ? phala_cvm.smoke[0].endpoint : null
}

output "app_id" {
  value = var.create_app_resources ? phala_app.smoke[0].app_id : null
}

output "app_endpoint" {
  value = var.create_app_resources ? phala_app.smoke[0].endpoint : null
}

output "app_cvm_ids" {
  value = var.create_app_resources ? phala_app.smoke[0].cvm_ids : null
}

output "consumer_app_id" {
  value = var.create_app_resources && var.create_consumer_app ? phala_app.consumer[0].app_id : null
}

output "linked_cvm_id" {
  value = var.create_resources && var.create_linked_cvm ? phala_cvm.linked[0].id : null
}

output "linked_cvm_endpoint" {
  value = var.create_resources && var.create_linked_cvm ? phala_cvm.linked[0].endpoint : null
}

output "ssh_key_id" {
  value = var.create_resources && var.ssh_public_key != "" ? phala_ssh_key.smoke[0].id : null
}

output "cvm_power_status" {
  value = var.create_resources && var.cvm_power_state != "" ? phala_cvm_power.smoke[0].status : null
}
