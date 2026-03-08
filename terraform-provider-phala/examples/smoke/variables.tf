variable "phala_api_key" {
  type      = string
  sensitive = true
}

variable "create_resources" {
  type        = bool
  default     = false
  description = "If false, run read-only smoke checks with data sources only."
}

variable "create_app_resources" {
  type        = bool
  default     = false
  description = "If true, create app-first resources (phala_app) for smoke tests."
}

variable "ssh_public_key" {
  type        = string
  default     = ""
  description = "Optional SSH public key for phala_ssh_key smoke resource."
}

variable "ssh_key_name" {
  type    = string
  default = "tf-smoke-key"
}

variable "cvm_name" {
  type    = string
  default = "tf-smoke-cvm"
}

variable "app_name" {
  type    = string
  default = "tf-smoke-app"
}

variable "app_replicas" {
  type        = number
  default     = 1
  description = "Desired replica count for phala_app smoke resource."
}

variable "create_consumer_app" {
  type        = bool
  default     = false
  description = "If true, create a second app that consumes app_id/endpoint from the first app."
}

variable "consumer_app_name" {
  type    = string
  default = "tf-smoke-consumer"
}

variable "consumer_app_replicas" {
  type        = number
  default     = 1
  description = "Desired replica count for the consumer app."
}

variable "create_linked_cvm" {
  type        = bool
  default     = false
  description = "If true, create a second CVM wired to the primary CVM via env (PRIMARY_APP_ID, PRIMARY_ENDPOINT)."
}

variable "linked_cvm_name" {
  type    = string
  default = "tf-smoke-cvm-linked"
}

variable "cvm_ssh_authorized_keys" {
  type        = list(string)
  default     = []
  description = "Optional per-deployment SSH public keys injected at CVM launch."
}

variable "cvm_env" {
  type        = map(string)
  default     = {}
  sensitive   = true
  description = "Optional plaintext env map. Provider auto-encrypts it."
}

variable "app_env" {
  type        = map(string)
  default     = {}
  sensitive   = true
  description = "Optional env map for the primary app."
}

variable "cvm_power_state" {
  type        = string
  default     = ""
  description = "Optional desired power state for phala_cvm_power (running or stopped). Empty disables the power resource."
}

variable "size" {
  type        = string
  default     = ""
  description = "Optional explicit size slug. Defaults to first from phala_sizes."
}

variable "region" {
  type        = string
  default     = ""
  description = "Optional explicit region slug. Defaults to first from phala_regions."
}

variable "image" {
  type        = string
  default     = ""
  description = "Optional explicit image name."
}

variable "docker_compose" {
  type    = string
  default = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
}

variable "linked_cvm_env" {
  type        = map(string)
  default     = {}
  sensitive   = true
  description = "Optional additional env for the linked CVM. PRIMARY_APP_ID/PRIMARY_ENDPOINT are injected automatically."
}

variable "consumer_app_env" {
  type        = map(string)
  default     = {}
  sensitive   = true
  description = "Optional additional env for the consumer app. UPSTREAM_APP_ID/UPSTREAM_ENDPOINT are injected automatically."
}

variable "linked_docker_compose" {
  type    = string
  default = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
}

variable "app_docker_compose" {
  type    = string
  default = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
}

variable "consumer_app_docker_compose" {
  type    = string
  default = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
}

variable "wait_for_ready" {
  type        = bool
  default     = true
  description = "Wait until CVM reaches running state."
}

variable "wait_timeout_seconds" {
  type        = number
  default     = 900
  description = "Timeout for wait_for_ready."
}
