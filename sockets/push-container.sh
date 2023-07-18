CLOUD_HOST=registry.digitalocean.com
REGISTRY=mahogo-registry
BACKEND_CONTAINER=mahogo-backend

docker push $CLOUD_HOST/$REGISTRY/$BACKEND_CONTAINER
