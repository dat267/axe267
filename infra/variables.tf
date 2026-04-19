variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "zone" {
  type = string
}

variable "backend_service_name" {
  type = string
}

variable "general_bucket_name" {
  type = string
}

variable "cloudbuild_connection_name" {
  type = string
}

variable "cloudbuild_repository_name" {
  type = string
}

variable "tailscale_auth_key" {
  type      = string
  sensitive = true
}

variable "ssh_public_keys" {
  type = list(string)
}
