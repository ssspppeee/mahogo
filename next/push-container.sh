CLOUD_HOST=registry.digitalocean.com
REGISTRY=mahogo-registry
FRONTEND_CONTAINER=mahogo-frontend

docker push $CLOUD_HOST/$REGISTRY/$FRONTEND_CONTAINER
