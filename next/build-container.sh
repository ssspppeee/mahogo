CLOUD_HOST=registry.digitalocean.com
REGISTRY=mahogo-registry

DOMAIN=go.samesler.com
BACKEND_API_HOST=$DOMAIN
BACKEND_API_PORT=80
BACKEND_SOCKET_HOST=$DOMAIN
BACKEND_SOCKET_PORT=80
FRONTEND_CONTAINER=mahogo-frontend
FRONTEND_BUILD_ARGS="--build-arg backend_api_host=$BACKEND_API_HOST --build-arg backend_api_port=$BACKEND_API_PORT --build-arg backend_socket_host=$BACKEND_SOCKET_HOST --build-arg backend_socket_port=$BACKEND_SOCKET_PORT"
FRONTEND_DIR=.

docker build -t $CLOUD_HOST/$REGISTRY/$FRONTEND_CONTAINER $FRONTEND_BUILD_ARGS $FRONTEND_DIR
