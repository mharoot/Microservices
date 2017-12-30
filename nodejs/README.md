# Microservices in NodeJS
- Docker is a utility used to manage microservices in node.

### Installing Docker on Linux
1. sudo apt-get update
2. sudo apt-get install apt-transport-https ca-certificates curl software-properties-common
3. curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
4. sudo apt-key fingerprint 0EBFCD88
5. sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
6. sudo apt-get update
7. sudo apt-get install docker-ce
8. Verify that Docker CE is installed correctly by running the hello-world image.
  - sudo docker run hello-world


#### Docker Forwarding Traffic Setting
1. sudo nano /etc/default/ufw
2. Replace:
  - DEFAULT_FORWARD_POLICY="DROP"
  - to DEFAULT_FORWARD_POLICY="ACCEPT"
3. sudo ufw reload

# How to Deploy a MongoDB Replica Set using Docker
- *ReplicaSet/*

# Build a NodeJS Cinema Microservice and Deploy it with Docker
- *GinepolisCinema/*
