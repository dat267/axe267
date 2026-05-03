## Aura

Aura is a full-stack web application featuring secure authentication, role-based user management, and cloud storage integration. The system relies on Google Identity Platform for secure access control.

The production app is accessible at https://dat267.github.io

## Project Structure

The repository organizes code into three distinct environments.

The `frontend/` directory contains the React application built with Vite and Tailwind CSS. It handles user authentication flows, theme management, and the administrative dashboard.

The `backend/` directory houses the Go server. It utilizes the Firebase Admin SDK to manage custom user claims and serves as a secure gateway for Google Cloud Storage operations.

The `infra/` directory contains Terraform configurations. It defines the required Google Cloud resources including the Cloud Run service and IAM service accounts.
