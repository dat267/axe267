locals {
  gcp_services = [
    "compute.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "apikeys.googleapis.com",
    "secretmanager.googleapis.com",
    "identitytoolkit.googleapis.com"
  ]
  backend_hash = sha1(join("", [for f in fileset("${path.module}/../backend", "**") : filesha1("${path.module}/../backend/${f}")]))
}

data "google_project" "project" {}

resource "google_project_service" "services" {
  for_each           = toset(local.gcp_services)
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_network" "gcn1" {
  name                    = "gcn1"
  auto_create_subnetworks = true
  depends_on              = [google_project_service.services]
}

resource "google_compute_firewall" "gcf1" {
  name    = "gcf1"
  network = google_compute_network.gcn1.name

  allow { protocol = "tcp" }
  allow { protocol = "udp" }
  allow { protocol = "icmp" }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_service_account" "storage_manager" {
  account_id   = "storage-manager-sa"
  display_name = "General Purpose Storage Manager"
  depends_on   = [google_project_service.services]
}

resource "google_storage_bucket" "gsb1" {
  name                        = var.general_bucket_name
  location                    = var.region
  storage_class               = "STANDARD"
  force_destroy               = true
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  versioning { enabled = true }

  lifecycle_rule {
    condition { num_newer_versions = 3 }
    action { type = "Delete" }
  }
}

resource "google_storage_bucket_iam_member" "storage_admin_binding" {
  bucket = google_storage_bucket.gsb1.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.storage_manager.email}"
}

resource "google_project_iam_member" "firebase_admin" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.storage_manager.email}"
}

resource "google_compute_instance" "gci1" {
  name         = "gci1"
  machine_type = "e2-micro"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-13"
      size  = 30
    }
  }

  network_interface {
    network = google_compute_network.gcn1.name
    access_config {}
  }

  metadata = {
    enable-oslogin = "FALSE"
    ssh-keys       = join("\n", var.ssh_public_keys)
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e
    if [ ! -f /swapfile ]; then
      fallocate -l 2G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    apt-get update
    apt-get upgrade -y
    apt-get install -y wget curl git build-essential
    curl -fsSL https://tailscale.com/install.sh | sh
    tailscale up --authkey=${var.tailscale_auth_key}
  EOT
}

resource "google_artifact_registry_repository" "garr1" {
  location      = var.region
  repository_id = "artifacts"
  format        = "DOCKER"
  depends_on    = [google_project_service.services]
}

resource "random_password" "webhook_secret_data" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "webhook_secret" {
  secret_id = "cloudbuild-webhook-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "webhook_secret_version" {
  secret      = google_secret_manager_secret.webhook_secret.id
  secret_data = random_password.webhook_secret_data.result
}

resource "google_project_iam_member" "cloud_run_ar_reader" {
  project    = data.google_project.project.project_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:service-${data.google_project.project.number}@serverless-robot-prod.iam.gserviceaccount.com"
  depends_on = [google_project_service.services]
}

resource "google_project_iam_member" "cloudbuild_ar_writer" {
  project = data.google_project.project.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = data.google_project.project.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_sa_user" {
  project = data.google_project.project.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

resource "google_secret_manager_secret_iam_member" "webhook_secret_policy" {
  project   = google_secret_manager_secret.webhook_secret.project
  secret_id = google_secret_manager_secret.webhook_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-cloudbuild.iam.gserviceaccount.com"
}

resource "google_cloud_run_v2_service" "gcr1" {
  name     = var.backend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account       = google_service_account.storage_manager.email
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    scaling {
      max_instance_count = 2
      min_instance_count = 0
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      env {
        name  = "INITIAL_ADMIN_EMAIL"
        value = var.initial_admin_email
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 1
        period_seconds        = 3
        failure_threshold     = 3
        tcp_socket {
          port = 8080
        }
      }

      volume_mounts {
        name       = "gcs-volume"
        mount_path = "/mnt/gcs"
      }
    }

    volumes {
      name = "gcs-volume"
      gcs {
        bucket    = google_storage_bucket.gsb1.name
        read_only = false
      }
    }

    max_instance_request_concurrency = 80
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version
    ]
  }

  depends_on = [
    google_project_service.services,
    google_artifact_registry_repository.garr1
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.gcr1.name
  location = google_cloud_run_v2_service.gcr1.location
  project  = google_cloud_run_v2_service.gcr1.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "random_id" "key_suffix" {
  byte_length = 4
}

resource "google_apikeys_key" "webhook_key" {
  name         = "webhook-trigger-key-${random_id.key_suffix.hex}"
  display_name = "Webhook Trigger Key"
  project      = var.project_id
  depends_on   = [google_project_service.services]
}

resource "google_cloudbuild_trigger" "webhook_deploy" {
  name            = "${var.backend_service_name}-trigger"
  location        = var.region
  service_account = "projects/${var.project_id}/serviceAccounts/${data.google_project.project.number}-compute@developer.gserviceaccount.com"

  webhook_config {
    secret = google_secret_manager_secret_version.webhook_secret_version.id
  }

  source_to_build {
    repository = "projects/${data.google_project.project.number}/locations/${var.region}/connections/${var.cloudbuild_connection_name}/repositories/${var.cloudbuild_repository_name}"
    ref        = "refs/heads/main"
    repo_type  = "UNKNOWN"
  }

  lifecycle {
    ignore_changes = [
      source_to_build[0].repo_type
    ]
  }

  substitutions = {
    _COMMIT_SHA = "$(body.run_id)"
  }

  build {
    options {
      logging = "CLOUD_LOGGING_ONLY"
    }

    step {
      name       = "gcr.io/cloud-builders/docker"
      entrypoint = "bash"
      args = [
        "-c",
        "docker pull ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.garr1.repository_id}/${var.backend_service_name}:latest || exit 0"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-t",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.garr1.repository_id}/${var.backend_service_name}:$${_COMMIT_SHA}",
        "-t",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.garr1.repository_id}/${var.backend_service_name}:latest",
        "--cache-from",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.garr1.repository_id}/${var.backend_service_name}:latest",
        "-f",
        "backend/Dockerfile",
        "backend/"
      ]
      env = ["DOCKER_BUILDKIT=1"]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "--all-tags",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.garr1.repository_id}/${var.backend_service_name}"
      ]
    }

    step {
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "run",
        "deploy",
        google_cloud_run_v2_service.gcr1.name,
        "--image",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.garr1.repository_id}/${var.backend_service_name}:$${_COMMIT_SHA}",
        "--region",
        var.region,
        "--project",
        var.project_id
      ]
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.webhook_secret_policy
  ]
}

resource "time_sleep" "wait_for_propagation" {
  create_duration = "60s"

  depends_on = [
    google_cloudbuild_trigger.webhook_deploy,
    google_secret_manager_secret_iam_member.webhook_secret_policy,
    google_apikeys_key.webhook_key,
    google_project_iam_member.cloud_run_ar_reader
  ]
}

resource "terraform_data" "execute_webhook" {
  triggers_replace = [
    local.backend_hash
  ]

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -f -o /dev/null -X POST \
        "https://cloudbuild.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/triggers/${google_cloudbuild_trigger.webhook_deploy.name}:webhook?key=${google_apikeys_key.webhook_key.key_string}&secret=${random_password.webhook_secret_data.result}&trigger=${google_cloudbuild_trigger.webhook_deploy.name}&projectId=${var.project_id}" \
        -H "Content-Type: application/json" \
        -d '{"run_id": "terraform-deploy", "branch": "main"}'
    EOT
  }

  depends_on = [
    time_sleep.wait_for_propagation
  ]
}

resource "google_identity_platform_config" "auth" {
  project = var.project_id

  sign_in {
    allow_duplicate_emails = false
    email {
      enabled           = true
      password_required = true
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_apikeys_key" "frontend_auth_key" {
  name         = "frontend-auth-key-${random_id.key_suffix.hex}"
  display_name = "Frontend Auth API Key"
  project      = var.project_id

  restrictions {
    api_targets {
      service = "identitytoolkit.googleapis.com"
    }
  }

  depends_on = [google_project_service.services]
}
