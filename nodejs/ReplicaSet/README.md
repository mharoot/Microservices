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
To create a docker machine we need to issue the next command in a terminal.  This command will create a machine called manager1 using virtualbox as our virtualization provider:
- docker-machine create -d virtualbox manager1
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

-------------------------------------------------------------------------------

Before creating our mongoDB containers, there is a very important topic that has been long discussed around **database persistence** in **docker containers**, and to achieve this challenge what we are going to do is to create a **docker volume**.
- docker volume create --name mongo_storage

-------------------------------------------------------------------------------

Now let’s attached our volume created to start our first mongo container and set the configurations.
- `docker run --name mongoNode1 -v mongo_storage:/data -d mongo --smallfiles`

-------------------------------------------------------------------------------

Next we need to create the **key file**. *The contents of the keyfile serves as the shared password for the members of the replica set. The content of the keyfile must be the same for all members of the replica set.*
- `openssl rand -base64 741 > mongo-keyfile`
- `chmod 600 mongo-keyfile`

-------------------------------------------------------------------------------

Next let’s create the folders where is going to hold the data, keyfile and configurations inside the mongo_storage volume:
- `docker exec mongoNode1 bash -c 'mkdir /data/keyfile /data/admin'`

-------------------------------------------------------------------------------

The next step is to create some admin users, let’s create a **admin.js** and a **replica.js** file that looks like this:
```javascript
// admin.js
admin = db.getSiblingDB("admin")
// creation of the admin user
admin.createUser(
  {
    user: "cristian",
    pwd: "cristianPassword2017",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
  }
);
// let's authenticate to create the other user
db.getSiblingDB("admin").auth("cristian", "cristianPassword2017" );
// creation of the replica set admin user
db.getSiblingDB("admin").createUser(
  {
    "user" : "replicaAdmin",
    "pwd" : "replicaAdminPassword2017",
    roles: [ { "role" : "clusterAdmin", "db" : "admin" } ]
  }
);
```
```javascript
//replica.js
rs.initiate({
 _id: 'rs1',
 members: [{
  _id: 0, host: 'manager1:27017'
 }]
});
```

-------------------------------------------------------------------------------

Let us continue with passing the files to the container.
- `docker cp admin.js mongoNode1:/data/admin/`
- `docker cp replica.js mongoNode1:/data/admin/`
- `docker cp mongo-keyfile mongoNode1:/data/keyfile/`

-------------------------------------------------------------------------------

Change folder owner to the user container
- `docker exec mongoNode1 bash -c 'chown -R mongodb:mongodb /data'`

-------------------------------------------------------------------------------

- What we have done is that we pass the files needed to the container, and then **change the /data folder owner to the container user**, since the the container user is the user that will need access to this folder and files.
- Now everything has been set, and we are ready to restart the mongod instance with the replica set configurations.
- Before we start the authenticated mongo container let’s create an `env` file to set our users and passwords.
```env
MONGO_USER_ADMIN=cristian
MONGO_PASS_ADMIN=cristianPassword2017

MONGO_REPLICA_ADMIN=replicaAdmin
MONGO_PASS_REPLICA=replicaAdminPassword2017
```

-------------------------------------------------------------------------------

Now we need to remove the container and start a new one. Why ?, because we need to provide the replica set and authentication parameters, and to do that we need to run the following command:
 - `docker rm -f mongoNode1`

-------------------------------------------------------------------------------

Now lets start our container with authentication 
 - `docker run --name mongoNode1 --hostname mongoNode1 -v mongo_storage:/data --env-file env --add-host manager1:192.168.99.100 --add-host worker1:192.168.99.101 --add-host worker2:192.168.99.102 -p 27017:27017 -d mongo --smallfiles --keyFile /data/keyfile/mongo-keyfile --replSet 'rs1' --storageEngine wiredTiger --port 27017`

-------------------------------------------------------------------------------

Final step for the mongoNode1 container, is to start the replica set, and we are going to do that by running the following command:
- `docker exec mongoNode1 bash -c 'mongo < /data/admin/replica.js'`

-------------------------------------------------------------------------------

Now to get in to the replica run the following command:

- `docker exec -it mongoNode1 bash -c 'mongo -u $MONGO_REPLICA_ADMIN -p $MONGO_PASS_REPLICA --eval "rs.status()" --authenticationDatabase "admin"'`

# Step 3— Adding 2 more mongo node containers