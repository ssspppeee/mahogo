terraform {
  required_providers {
    digitalocean = {
        source = "digitalocean/digitalocean"
        version = "~> 2.0"
    }
  }
}

variable "do_token" {
  sensitive = true
}

provider "digitalocean" {
  token = var.do_token
}

data "digitalocean_kubernetes_versions" "minor_version" {
  version_prefix = "1.27."
}

resource "digitalocean_kubernetes_cluster" "mahogo_cluster" {
  name                 = "mahogo-cluster"
  region               = "syd1"
  auto_upgrade         = true
  registry_integration = true
  version              = data.digitalocean_kubernetes_versions.minor_version.latest_version

  maintenance_policy {
    start_time  = "20:00"
    day         = "saturday"
  }

  node_pool {
    name       = "unipool"
    size       = "s-1vcpu-2gb"
    node_count = 1
  }
}

resource "digitalocean_container_registry" "mahogo_registry" {
  name                   = "mahogo-registry"
  subscription_tier_slug = "basic"
  region                 = "syd1"
}
