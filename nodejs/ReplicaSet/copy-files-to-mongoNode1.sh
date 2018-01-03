# if this is your first time running then run this in command:
# chmod +x copy-files-to-mongoNode1.sh && ./copy-files-to-mongoNode1.sh
# Let us continue with passing the files to the container.
docker cp admin.js mongoNode1:/data/admin/
docker cp replica.js mongoNode1:/data/admin/
docker cp mongo-keyfile mongoNode1:/data/keyfile/