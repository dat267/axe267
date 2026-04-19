output "cloud_run_url" {
  value       = google_cloud_run_v2_service.gcr1.uri
  description = "The URL of the deployed Cloud Run service"
}
