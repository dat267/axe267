output "cloud_run_url" {
  value       = google_cloud_run_v2_service.gcr1.uri
  description = "The URL of the deployed Cloud Run service"
}

output "identity_platform_config" {
  value = {
    projectId = var.project_id
    apiKey    = google_apikeys_key.frontend_auth_key.key_string
  }
  sensitive = true
}
