# How to Deploy a MongoDB Replica Set using Docker
Be sure to read the nodejs/README.md and have set up docker.

### Install Docker Machine
- curl -L https://github.com/docker/machine/releases/download/v0.13.0/docker-machine-`uname -s`-`uname -m` >/tmp/docker-machine &&
 chmod +x /tmp/docker-machine && sudo cp /tmp/docker-machine /usr/local/bin/docker-machine
- Debian-based Linux distributions
  - Add the following line to your /etc/apt/sources.list. According to your distribution, replace '<mydist>' with 'artful', 'zesty', 'yakkety', 'xenial', 'vivid', 'utopic', 'trusty', 'raring', 'quantal', 'precise', 'stretch', 'lucid', 'jessie', 'wheezy', or 'squeeze':
  - deb http://download.virtualbox.org/virtualbox/debian xenial contrib
- wget -q https://www.virtualbox.org/download/oracle_vbox_2016.asc -O- | sudo apt-key add -
- wget -q https://www.virtualbox.org/download/oracle_vbox.asc -O- | sudo apt-key add -
- sudo apt-get update
- sudo apt-get install virtualbox-5.2

### Step 1 —Create our 3 docker-machine
To create a docker machine we need to issue the next command in a terminal:
- docker-machine create -d virtualbox manager1
This command will create a machine called manager1 using virtualbox as our virtualization provider.  Now let’s create the two lefting docker-machine.
- docker-machine create -d virtualbox worker1
- docker-machine create -d virtualbox worker2
To verify if our machines are created, let’s run the following command:
- docker-machine ls
- note: it may take a while for all the machines to be created, just be paitient, and you will get the output:
  - NAME       ACTIVE   DRIVER       STATE     URL                         SWARM   DOCKER        ERRORS
  - manager1   -        virtualbox   Running   tcp://192.168.99.100:2376           v17.12.0-ce   
  - worker1    -        virtualbox   Running   tcp://192.168.99.102:2376           v17.12.0-ce   
  - worker2    -        virtualbox   Running   tcp://192.168.99.101:2376           v17.12.0-ce   

# Step 2 — Configuration of master node of MongoDB
Now that we have our three machines lets position it in our first machine to start the mongodb configuration, let’s run the next command:
- eval `docker-machine env manager1`
Before creating our mongoDB containers, there is a very important topic that has been long discussed around **database persistence** in **docker containers**, and to achieve this challenge what we are going to do is to create a **docker volume**.
- docker volume create --name mongo_storage