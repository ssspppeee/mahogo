# Mahogo
[Mahogo](http://go.samesler.com) is a website for the board game Go/Igo/Baduk/Weiqi. It is designed to allow users to instantly set up a game with someone by simply sending them a link, with no sign-up required. 
![image](https://github.com/ssspppeee/mahogo/assets/46858241/4640db02-ba17-44ba-bce6-fd47796abe0e)

## Technical design
- The [frontend](next/) is written in with ReactJS in Typescript, served by Next.js
- The [backend](sockets/) is a Node.js server, also written in Typescript, using Socket.IO to handle WebSockets
- The backend server uses a Redis instance to handle pub/sub events to enable live chat and gameplay
- An NGINX reverse proxy routes traffic to the front and backend servers as appropriate

## Infrastructure
- The elements above run in Docker containers, each with their own Pod
- The pods run on a small Kubernetes cluster, currently hosted on DigitalOcean cloud
- The infrastructure is provisioned with [Terraform](infra/)
- The deployment is defined in a [Helm chart](helm/)
