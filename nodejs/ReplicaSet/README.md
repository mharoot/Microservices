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

# Step 1 —Create our 3 docker-machine
To create a docker machine we need to issue the next command in a terminal.  This command will create a machine called manager1 using virtualbox as our virtualization provider:
- docker-machine create -d virtualbox manager1
- docker-machine create -d virtualbox worker1
- docker-machine create -d virtualbox worker2
To verify if our machines are created, let’s run the following command:
- docker-machine ls
- note: it may take a long time for all the machines to be created, just be paitient, and you will get the output:
```
NAME       ACTIVE   DRIVER       STATE     URL                         SWARM   DOCKER        ERRORS
manager1   -        virtualbox   Running   tcp://192.168.99.100:2376           v17.12.0-ce   
worker1    -        virtualbox   Running   tcp://192.168.99.102:2376           v17.12.0-ce   
worker2    -        virtualbox   Running   tcp://192.168.99.101:2376           v17.12.0-ce   
```

# Step 2 — Configuration of master node of MongoDB
Now that we have our three machines lets position it in our first machine to start the mongodb configuration, let’s run the next command:
- eval `docker-machine env manager1`

-------------------------------------------------------------------------------

Before creating our mongoDB containers, there is a very important topic that has been long discussed around **database persistence** in **docker containers**, and to overcome this challenge what we are going to do is to create a **docker volume**.
- docker volume create --name mongo_storage

-------------------------------------------------------------------------------

Now let us attach our volume mongo_storage to start our first mongo container and set the configurations.
- `docker run --name mongoNode1 -v mongo_storage:/data -d mongo --smallfiles`

#### Note:
`-d mongo` It automatically pulls mongo:latest image if you do not have it already and runs it in the background.

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
    user: "michael",
    pwd: "michaelPassword2017",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
  }
);
// let's authenticate to create the other user
db.getSiblingDB("admin").auth("michael", "michaelPassword2017" );
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
MONGO_USER_ADMIN=michael
MONGO_PASS_ADMIN=michaelPassword2017

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
Now that everything is ready, let’s start 2 more nodes and join them to the replica set.
To add the first node let’s change to the worker1 docker machine, if you are using a local computer run the following command: 
- eval `docker-machine env worker1`

-------------------------------------------------------------------------------

- If you’re not running on local, just point your terminal to the next server.
- Now since we are going to repeat almost all the steps we made for mongoNode1 let’s make a script that runs all of our commands for us.
- Let’s create a file called *create-replica-set.sh* and let us see what is going to be composed in the main function:
```bash
function main {
  init_mongo_primary
  init_mongo_secondaries
  add_replicas manager1 mongoNode1
  check_status manager1 mongoNode1
}
main
```
- Now let us see how what these functions are composed of:
```bash
# ----------- INIT MONGO PRIMARY FUNCTION ----------------------------
# 1) creation of the keyfile for the replica set authentication.
# 2) creation of a mongodb container, and recieves 2 parameters: 
   # a) the server where is going to be located, 
   # b) the name of the container, 
   # c) the name of the docker volume, all this functionality we saw it before.

# 3) It will initiate the replica with the exact same steps, we do before.
function init_mongo_primary {
  # @params name-of-keyfile
  createKeyFile mongo-keyfile
  
  # @params server container volume
  createMongoDBNode manager1 mongoNode1 mongo_storage
  
  # @params container
  init_replica_set mongoNode1
}

# ----------- INIT MONGO SECONDARY FUNCTION ----------------------------
# Creates the other 2 mongo containers for the replica set, and executes the same steps as the mongoNode1, but here we don’t include the replica set instantiation, and the admin users creation, because those aren’t necessary, since the replica set, will share with all the nodes of the replica the database configurations, and later on they will be added to the primary database.
function init_mongo_secondaries {
  # @Params server container volume
  createMongoDBNode worker1 mongoNode1 mongo_storage
  createMongoDBNode worker2 mongoNode2 mongo_storage
}

# -----------  ADD REPLICAS FUNCTION ----------------------------
# @params server container
# Adding the 2 other mongo containers to the primary database on the replica set configuration, first we loop through the machines left to add the containers, in the loop we prepare the configuration, then we check if the container is ready, we do that by calling the function wait_for_databases and we pass the machine to check as the parameter, then we execute the configuration inside the primary database and we should see a messages like this:
#
# MongoDB shell version v3.4.1
# connecting to: mongodb://127.0.0.1:27017
# MongoDB server version: 3.4.1
# { "ok" : 1 }
# That means that the mongo container was added successfully to the replica.
function add_replicas {
  echo '·· adding replicas >>>> '$1' ··'
  switchToServer $1
  
  for server in worker1 worker2
   do
    rs="rs.add('$server:27017')"
    add='mongo --eval "'$rs'" -u $MONGO_REPLICA_ADMIN 
         -p $MONGO_PASS_REPLICA --authenticationDatabase="admin"'
    sleep 2
    wait_for_databases $server
    docker exec -i $2 bash -c "$add"
  done
}


# -----------  CHECK STATUS FUNCTION ----------------------------
#  Checks the status of the replica set.
# @params server container
function check_status {
  switchToServer $1
  cmd='mongo -u $MONGO_REPLICA_ADMIN -p $MONGO_PASS_REPLICA 
        --eval "rs.status()" --authenticationDatabase "admin"'
  docker exec -i $2 bash -c "$cmd"
}
```

-------------------------------------------------------------------------------
- Now that we have seen the functions of our automated script and that we know what it is going to do, it’s time to execute the automated bash script as done in the following:

- **Note**: If you have followed and completed all the steps above, you need to reset everything that we have implemented, to avoid name collision problems.  To reset the configurations grab the ***reset-docker-machines.sh*** file. Make it executable and run it:
  - `chmod +x util/reset-docker-machines.sh && util/./reset-docker-machines.sh`
- Now make it executable and we can execute the script that will configure everything for us.
  - `chmod +x util/create-replica-set.sh && util/./create-replica-set.sh`
  - 
- everything was set correctly, we should see a messages from mongodb that contain this:
  - MongoDB shell version v3.4.1
  - connecting to: mongodb://127.0.0.1:27017
  - MongoDB server version: 3.4.1
  - ...
- As you can see every container is now well configured, some things to notice is that we we use the `--add-host` flag from docker as we used before and this adds these entries into the Docker container’s `/etc/hosts` file so we can use hostnames instead of IP addresses.
- docker logs -ft mongoNode1

-------------------------------------------------------------------------------

Now that we have a MongoDB replica set service up and running, let’s modify our user or you can create another user and grant some permissions to make crud operations over a database, so for illustration purposes only, this a bad practice, let me add a super role to our admin user.
- we are going to assign the root role to our admin user
- we enter to the container
- `docker exec -it mongoNode1 bash -c 'mongo -u $MONGO_USER_ADMIN -p $MONGO_PASS_ADMIN --authenticationDatabase "admin"'`
- Then we execute the following in the mongo shell
  - use admin
  - db.grantRolesToUser( "cristian", [ "root" , { role: "root", db: "admin" } ] )

-------------------------------------------------------------------------------

Now he have a super user that can make anything, so let’s create a database and insert some data.
- `docker exec -it mongoNode1 bash -c 'mongo -u $MONGO_USER_ADMIN -p $MONGO_PASS_ADMIN --authenticationDatabase "admin"'`
- use movies
```javascript
db.movies.insertMany([{
  id: '1',
  title: 'Assasins Creed',
  runtime: 115,
  format: 'IMAX',
  plot: 'Lorem ipsum dolor sit amet',
  releaseYear: 2017,
  releaseMonth: 1,
  releaseDay: 6
}, {
  id: '2',
  title: 'Aliados',
  runtime: 124,
  format: 'IMAX',
  plot: 'Lorem ipsum dolor sit amet',
  releaseYear: 2017,
  releaseMonth: 1,
  releaseDay: 13
}, {
  id: '3',
  title: 'xXx: Reactivado',
  runtime: 107,
  format: 'IMAX',
  plot: 'Lorem ipsum dolor sit amet',
  releaseYear: 2017,
  releaseMonth: 1,
  releaseDay: 20
}, {
  id: '4',
  title: 'Resident Evil: Capitulo Final',
  runtime: 107,
  format: 'IMAX',
  plot: 'Lorem ipsum dolor sit amet',
  releaseYear: 2017,
  releaseMonth: 1,
  releaseDay: 27
}, {
  id: '5',
  title: 'Moana: Un Mar de Aventuras',
  runtime: 114,
  format: 'IMAX',
  plot: 'Lorem ipsum dolor sit amet',
  releaseYear: 2016,
  releaseMonth: 12,
  releaseDay: 2
}])
```
- Now we have a movies database with a movies collection that contains 5 movie and we are finished.