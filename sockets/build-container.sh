CLOUD_HOST=registry.digitalocean.com
REGISTRY=mahogo-registry

BACKEND_CONTAINER=mahogo-backend
BACKEND_DIR=.

docker build -t $CLOUD_HOST/$REGISTRY/$BACKEND_CONTAINER $BACKEND_DIR