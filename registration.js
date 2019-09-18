const Buffer = require('buffer').Buffer
const Eosjs = require('eosjs')
const EosjsEcc = require('eosjs-ecc')
const ipfsClient = require('ipfs-http-client')
const level = require('level')
const db = level('idfs_management')
const crypto = require('crypto')
const bs58 = require('bs58')

process.env.NODE_ENV = ( process.env.NODE_ENV && ( process.env.NODE_ENV ).trim().toLowerCase() == 'production' ) ? 'production' : 'development'
if (process.env.NODE_ENV == 'production') {
	console.log("Production Mode!!")
	global.config = require('./config/prod.conf')
} else {
	console.log("Development Mode!!")
	global.config = require('./config/dev.conf')
}

const osbConfig = {
  chainId: config.CHAIN_ID,
  httpEndpoint: `${config.CHAIN_PROTOCOL}://${config.CHAIN_IPADDR}:${config.CHAIN_PORT}`,
  broadcast: true,
  verbose: false,
  sign: true,
  keyProvider: config.IDFS_ACCOUNT_PRIVATE_KEY
//  expireInSeconds: 60
}
const eosjs = Eosjs(osbConfig)

main()

async function main() {
	console.log('Welcome to IDFS register')
	if (process.argv[2] === 'keeperlist') {
		const idfsClusterList = await keeperList()
		for (var c = 0; c < idfsClusterList.length; c++) {
			console.log(idfsClusterList[c])
		}
//		console.log(idfsClusterList)
	} else if (process.argv[2] === 'addcluster') {
		const clusterKey = process.argv[3]
		if (clusterKey === '' || clusterKey === undefined) {
			console.log('Error: The second parameter is empty')
			return
		}
		const res = await addCluster(clusterKey)
		console.log(res)
	} else if (process.argv[2] === 'addkeeper') {
		const capacity = process.argv[3]
		const clusterId = process.argv[4]
		if (capacity === '' || capacity === undefined) {
			console.log('Error: The second parameter is empty')
			return
		}
		if (clusterId === '' || clusterId === undefined) {
			console.log('Error: The third parameter is empty')
			return
		}
		const res = await addKeeper(capacity, clusterId)
		console.log(res)
	}
}

async function keeperList() {
	const clusterList = await eosjs.getTableRows({
        json: true,
        code: config.DATA_TRADE_CONTRACT_NAME,
        scope: config.DATA_TRADE_CONTRACT_NAME,
        table: "idfscluster",
        table_key: "cluster_id",
        limit: 5000,
    }).catch(function(error) {
        console.log(error)
        reject('failed to retrieve cluster list')
    });
	
	const idfsList = await eosjs.getTableRows({
        json: true,
        code: config.DATA_TRADE_CONTRACT_NAME,
        scope: config.DATA_TRADE_CONTRACT_NAME,
        table: "idfs",
        table_key: "idfs_id",
        limit: 5000,
    }).catch(function(error) {
        console.log(error)
        reject('failed to retrieve idfs list')
    });
	
	for (var c = 0; c < clusterList.rows.length; c++) {
		clusterList.rows[c].idfs = []
	}
	
	for (var i = 0; i < idfsList.rows.length; i++) {
		for (var c = 0; c < clusterList.rows.length; c++) {
			if (clusterList.rows[c].cluster_id === idfsList.rows[i].cluster_id) {
				clusterList.rows[c].idfs.push(idfsList.rows[i])
			}
		}
	}
	
	return clusterList.rows
}

async function addCluster(clusterKey) {
	return new Promise(async function(resolve, reject) {
		const clusterKeyHash = getDataHash(Buffer.from(clusterKey))
		const result = await eosjs.transaction({
			actions: [{
		      account: config.DATA_TRADE_CONTRACT_NAME,
		      name: 'addcluster',
		      authorization: [{
		        actor: config.IDFS_ACCOUNT,
		        permission: 'active',
		      }],
		      data: {
		    	idfs_account: config.IDFS_ACCOUNT,	// Keeper's account name
	    	    cluster_key: clusterKeyHash,	// IPFS Cluster secret key의 hash값
		      },
		    }]
		}, {
		  blocksBehind: 3,
		  expireSeconds: 30,
		}).catch(function (error) {
			console.log(error)
			reject(error)
		})
		resolve(result)
	})
}

async function addKeeper(capacity, cluster_id) {
	return new Promise(async function(resolve, reject) {
		const result = await eosjs.transaction({
			actions: [{
		      account: config.DATA_TRADE_CONTRACT_NAME,
		      name: 'addidfs',
		      authorization: [{
		        actor: config.IDFS_ACCOUNT,
		        permission: 'active',
		      }],
		      data: {
			    	idfs_account: config.IDFS_ACCOUNT,
		    	    capacity: capacity,
			    	cluster_id: cluster_id,
		    	    idfs_public_key: EosjsEcc.privateToPublic(config.IDFS_KEEPER_PRIVATE_KEY, 'EOS'),
		    	    ipaddr: config.IDFS_IPADDR,
			    	port: config.IDFS_PORT,
		      },
		    }]
		}, {
		  blocksBehind: 3,
		  expireSeconds: 30,
		}).catch(function (error) {
			console.log(error)
			reject(error)
		})
		resolve(result)
	})
}

function getDataHash(data) {
	// validating the parameter
	if (!Buffer.isBuffer(data)) {
		console.log('data shoud be Buffer')
		return
	}
	
	const digest = crypto.createHash('sha256').update(data).digest()
	const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
	const hashFunction = Buffer.from('12', 'hex') // 0x20
	const combined = Buffer.concat([hashFunction, digestSize, digest])
	const calculatedDataHash = bs58.encode(combined)
	return calculatedDataHash
}
