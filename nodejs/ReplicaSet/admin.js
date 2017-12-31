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