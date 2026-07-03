# AI Operations Workforce — infrastructure foundation (Terraform).
# Provider-agnostic skeleton: managed Postgres (pgvector), managed Redis, a
# container platform (EKS/ECS/GKE), object storage, and secrets. Fill in the
# module sources for your cloud; the application is cloud-neutral.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # backend "s3" { bucket = "aiow-tfstate" key = "prod/terraform.tfstate" region = "us-east-1" }
}

variable "environment" { default = "production" }
variable "region" { default = "us-east-1" }
variable "db_password" { sensitive = true }

provider "aws" { region = var.region }

# --- PostgreSQL (pgvector) ---------------------------------------------------
# Use RDS Postgres 16 with the `vector` extension enabled, or Neon/Supabase.
# module "postgres" {
#   source  = "terraform-aws-modules/rds/aws"
#   engine  = "postgres"
#   engine_version = "16"
#   instance_class = "db.r6g.large"
#   allocated_storage = 100
#   db_name  = "aiow"
#   username = "aiow"
#   password = var.db_password
#   backup_retention_period = 14   # point-in-time recovery
#   multi_az = true                # high availability
# }

# --- Redis (queues + cache) --------------------------------------------------
# module "redis" {
#   source = "terraform-aws-modules/elasticache/aws"
#   engine = "redis"
#   node_type = "cache.r6g.large"
#   num_cache_clusters = 2          # clustering for HA
# }

# --- Object storage (documents/attachments) ----------------------------------
resource "aws_s3_bucket" "documents" {
  bucket = "aiow-${var.environment}-documents"
}

# --- Secrets -----------------------------------------------------------------
# Store JWT_SECRET, CREDENTIALS_ENCRYPTION_KEY, ANTHROPIC_API_KEY, STRIPE_* in
# AWS Secrets Manager / SSM and inject into the container platform.

output "documents_bucket" { value = aws_s3_bucket.documents.id }
