# idfs
IDFS (Inter-Domain File System) is a decentralized file system providing storage for encrypted data and managing decryption keys.
IDFS is based on IPFS (http://ipfs.io).

# install
    npm install --save eosjs ipfs-http-client level express cors express-fileupload eccrypto bitwise

# check keeper list
    node registration keeperlist

# register keeper cluster
    node registration addcluster [CLUSTER_KEY]

# register keeper
    node registration addkeeper [CAPACITY] [CLUSTER_ID]

# launch idfs
    node idfs
