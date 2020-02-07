// Copyright (c) 2019 Foundation OASIS LTD. All Rights Reserved.
// OASISBloc Client SDK code distributed under the GPLv3 license, see LICENSE file.
const express = require('express')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const Buffer = require('buffer').Buffer
const EosApi = require('eosjs')
const EosjsEcc = require('eosjs-ecc')
const crypto = require('crypto')
const eccrypto = require('eccrypto')
const bs58 = require('bs58')
const ipfsClient = require('ipfs-http-client')
const level = require('level')
const bitwise = require('bitwise')

const db = level('idfs')
const app = express()
app.use(cors())
app.use(fileUpload())
app.use(express.json({ limit : "500gb" }))

const SECP256K1_TYPE = 714

process.env.NODE_ENV = ( process.env.NODE_ENV && ( process.env.NODE_ENV ).trim().toLowerCase() == 'production' ) ? 'production' : 'development'
if (process.env.NODE_ENV == 'production') {
	console.log("Production Mode!!")
	global.config = require('./config/prod.conf')
} else {
	console.log("Development Mode!!")
	global.config = require('./config/dev.conf')
}

// connect to ipfs daemon API server
var ipfs = ipfsClient(config.IPFS_IPADDR, config.IPFS_API_PORT, { protocol: 'http' }) // leaving out the arguments will default to these values

const osbConfig = {
  chainId: config.CHAIN_ID,
  httpEndpoint: `${config.CHAIN_PROTOCOL}://${config.CHAIN_IPADDR}:${config.CHAIN_PORT}`,
  broadcast: true,
  verbose: false,
  sign: true,
  keyProvider: config.IDFS_ACCOUNT_PRIVATE_KEY
//  expireInSeconds: 60
}

const eos = EosApi(osbConfig)
var server = app.listen(config.IDFS_PORT, "0.0.0.0", function(){
    console.log(`Express server has started on port ${config.IDFS_PORT}`)
})

app.get('/', function(req, res){
	const FRAG_NUM = 2
	var data = Buffer.from("한글도 되나")
	
	console.log ("\nOriginal Data: " + data.toString())
	console.log ('====FRAGMENTATION====')
	////////////////////// FRAGMENTATION //////////////////
	
	var frag = []
	frag[0] = Buffer.alloc( Math.ceil(data.length / FRAG_NUM) )
	frag[1] = Buffer.alloc( Math.ceil(data.length / FRAG_NUM) )
	console.log( "Original: " + bitwise.bits.toString(bitwise.buffer.read(data), 4, ' ') )
	
	for (var i=0; i < data.length; i++) {
		bitwise.buffer.modify(frag[0], bitwise.buffer.read(data, i*8, 4), i*4)
		bitwise.buffer.modify(frag[1], bitwise.buffer.read(data, i*8+4, 4), i*4)
	}
	console.log( "frag1: " + bitwise.bits.toString(bitwise.buffer.read(frag[0]), 4, ' ') )
	console.log( "frag2: " + bitwise.bits.toString(bitwise.buffer.read(frag[1]), 4, ' ') )
	
	
	///////////////////////// MERGE ///////////////////////
	
	console.log (frag[0].length)
	console.log ('====MERGE====')
	var mergedData = Buffer.alloc(data.length)
	
	for (var i = 0; i < data.length; i++) {
		bitwise.buffer.modify(mergedData, bitwise.buffer.read(frag[0], i*4, 4), i*8)
		bitwise.buffer.modify(mergedData, bitwise.buffer.read(frag[1], i*4, 4), i*8+4)
	}
	//console.log( bitwise.bits.toString(bitwise.buffer.read(mergedData), 4, ' ') )
	console.log("Merged Data: " + mergedData.toString())
})

app.post('/v0/add_data', async function(req, res){
	console.log('\nadd_data')
	
	const providerAccount   	= req.body.provider_account
	const contractAddr	    	= req.body.contract_addr
	const reservedDataId    	= req.body.reserved_data_id
	const fragmentNo	    	= req.body.fragment_no
	const encryptedDecryptKey	= req.body.decrypt_key
	const data			    	= req.body.data
	const isDataEncrypted		= req.body.is_data_encrypted

	const encryptedDecryptKeyBuffer = Buffer(encryptedDecryptKey)
	const encryptedData = Buffer(data)
/*	if (data_type === 'text') {
		encryptedData = Buffer.from(data)
	} else if (data_type === 'file') {
		encryptedData = req.files['data'].data
	}*/

	var decryptedDataBuffer
	var decryptKey
	var encryptKey
	if (isDataEncrypted === true) {
		// 받은 복호화 키는 보관자의 public key로 암호화 되어 있으므로, 보관자의 private key로 복호화하여 원래 복호화 키를 얻는다.
		const decryptKeyBuffer = await decode(encryptedDecryptKeyBuffer, config.IDFS_KEEPER_PRIVATE_KEY)
		decryptKey = decryptKeyBuffer.toString()
		// 원래 복호화 키를 이용하여 받은 데이터를 복호화 한다.
		decryptedDataBuffer = await decode(encryptedData, decryptKey)
		// 복호화 키로부터 암호화 키를 얻는다
		encryptKey = EosjsEcc.privateToPublic(decryptKey, config.PUBKEY_PREFIX)
	} else {
		decryptedDataBuffer = encryptedData
	}
	// 암호화 되어있는 데이터의 해시값을 얻는다.
	const dataHashEncrypted = getDataHash(encryptedData)
	console.log('dataHashEncrypted: ' + dataHashEncrypted)
	// 복호화 된 데이터의 해시값을 얻는다.
	const dataHashOriginal = getDataHash(decryptedDataBuffer)
	decryptedDataBuffer = null
	console.log('dataHashOriginal: ' + dataHashOriginal)
	
	// 블록체인에서 무결성 확인을 위해 해당 데이터 정보를 가져온다.
    const dataList = await eos.getTableRows({
        json: true,
        code: contractAddr,
        scope: contractAddr,
        table: "data",
        table_key: "data_id",
        lower_bound: reservedDataId,
        upper_bound: reservedDataId+1
    }).catch(function(error) {
        console.log(error);
        res.json({
            result: false,
            msg: 'failed to retrieve data list'
        });
        return
    });
	
	console.log(dataList)
    
	// Retrieve data info from the contract
	var dataInfoFromContract = false
	for (var i = 0; i < dataList.rows.length; i++) {
		if (dataList.rows[i].data_id === reservedDataId) {
			dataInfoFromContract = dataList.rows[i]
			console.log('\nRetrieved data info...')
			console.log(dataList.rows[i])
			break
		}
	}
	if (!dataInfoFromContract) {
		console.log('Error - wrong reserved data id!');
	    res.json({
	        result: false,
	        msg: 'Error - wrong reserved data id!'
	    })
	    return
	}
	
	// Retrieve fragment info from the contract
	var fragmentInfoFromContract = false
	for (var i = 0; i < dataInfoFromContract.fragments.length; i++) {
		if (dataInfoFromContract.fragments[i].fragment_no === fragmentNo) {
			fragmentInfoFromContract = dataInfoFromContract.fragments[i]
		}
	}
	if (!fragmentInfoFromContract) {
		console.log('Error - wrong reserved fragment no!');
	    res.json({
	        result: false,
	        msg: 'Error - wrong reserved fragment no!'
	    })
	    return
	}
	if (fragmentInfoFromContract.hash_original !== dataHashOriginal) {
		console.log(`Error - The original hash of the fragment is unmatched! (calculated hash: ${dataHashOriginal}, hash on contract: ${fragmentInfoFromContract.hash_original})`);
	    res.json({
	        result: false,
	        msg: `Error - The original hash of the fragment is unmatched! (calculated hash: ${dataHashOriginal}, hash on contract: ${fragmentInfoFromContract.hash_original})`
	    })
	    return
	}
	if (fragmentInfoFromContract.hash_encrypted !== dataHashEncrypted) {
		console.log(`Error - The encrypted hash of the fragment is unmatched! (calculated hash: ${dataHashEncrypted}, hash on contract: ${fragmentInfoFromContract.hash_encrypted})`);
	    res.json({
	        result: false,
	        msg: `Error - The encrypted hash of the fragment is unmatched! (calculated hash: ${dataHashEncrypted}, hash on contract: ${fragmentInfoFromContract.hash_encrypted})`
	    })
	    return
	}
	
	console.log('\nUploading the encrypted data to IPFS')
	// 문제가 없다면 IPFS에 암호화되어 있는 데이터를 업로드 한다.
	const result = await ipfs.add(encryptedData)
	.then(function(result){
		const hash = result[0].hash
		
		db.put(hash, decryptKey, function (err) {
			if (err) return console.log('Failed to insert the decrypt_key in db', err) // some kind of I/O error
			console.log(`Adding encryptedDecryptKey into DB (key:${hash}, value:${decryptKey})`)
			ret = {
				result: true,
				cid: hash,
				data_hash_original: dataHashOriginal,
				encrypt_key: encryptKey
			}
			res.json(ret)
			
			console.log('add_data return:')
			console.log(ret)

			result[0] = null
			req.body.data = null
		})
	})
	.catch(function (error) {
		console.log('Failed to uploading the encrypted data to IPFS')
		console.log(error)
		res.json({
	        result: false,
	        msg: 'Failed to uploading the encrypted data to IPFS'
	    })
	})
})

app.get('/v0/get_data', function(req, res){
	console.log('get_data')
	console.log(req.body)
	console.log(req.query)
	const cid = req.query.cid
	const dataUrl = `${config.IPFS_API_PROTOCOL}://${config.IPFS_IPADDR}:${config.IPFS_GATEWAY_PORT}/ipfs/${cid}`
	res.setHeader("content-disposition", "attachment; filename="+cid)
	res.json({
		result: true,
		data_url: dataUrl
	})
})

app.post('/v0/upload_decrypt_key', async function(req, res){
	const providerAccount   	= req.body.provider_account
	const contractAddr	    	= req.body.contract_addr
	const reservedDataId    	= req.body.reserved_data_id
	const fragmentNo	    	= req.body.fragment_no
	const encryptedDecryptKey	= req.body.decrypt_key
	const cid					= req.body.cid
	
	console.log('upload_decrypt_key')
	console.log(req.body)
	
    //블록체인에서 해당 데이터 조각이 내가 속한 클러스터에 등록된 것인지 확인
    // 복호화 된 데이터의 해시값을 블록체인에서 확인한다.(무결성 확인)
    // 블록체인에서 무결성 확인을 위해 해당 데이터 정보를 가져온다.
    const dataList = await eos.getTableRows({
        json: true,
        code: contractAddr,
        scope: contractAddr,
        table: "data",
        table_key: "data_id",
        lower_bound: reservedDataId,
        upper_bound: reservedDataId+1
    }).catch(function(error) {
        console.log(error);
        res.json({
            result: false,
            msg: 'failed to retrieve data list'
        });
        return
    });
	
	console.log(dataList)
	
	var dataRow = dataList.rows[0]
	if (dataRow.data_id === reservedDataId) {
		console.log('found data info with dataid: ' + reservedDataId)
		console.log(dataRow)
	} else {
		console.log(`${dataList.rows[i].data_id} is different with ${reservedDataId}`)
	}
	
	// 받은 복호화 키는 보관자의 public key로 암호화 되어 있으므로, 보관자의 private key로 복호화하여 원래 복호화 키를 얻는다.
	const encryptedDecryptKeyBuffer = Buffer(encryptedDecryptKey)
	const decryptKeyBuffer = await decode(encryptedDecryptKeyBuffer, config.IDFS_KEEPER_PRIVATE_KEY)
	const decryptKey = decryptKeyBuffer.toString()
	const encryptKey = EosjsEcc.privateToPublic(decryptKey, config.PUBKEY_PREFIX)
	
	for (var i = 0; i < dataRow.fragments.length; i++) {
		if (dataRow.fragments[i].fragment_no === fragmentNo) {		
			if (dataRow.fragments[i].idfs_cluster_id !== config.IDFS_CLUSTER_ID) {
				console.log('The cluster-id of the data fragment is unmatched!')
				res.json({
			        result: false,
			        msg: 'The cluster-id of the data fragment is unmatched!'
			    })
			    return
			}
			
			if (dataRow.fragments[fragmentNo-1].encrypt_key === encryptKey) {
				//키를 저장한다
				db.put(cid, decryptKey, function (err) {
					console.log(`Adding encryptedDecryptKey into DB (key:${cid}, value:${decryptKey})`)
					if (err) return console.log('Failed to insert the decrypt_key in db', err) // some kind of I/O error
					ret = {
						result: true,
						encrypt_key: encryptKey
					}
					res.json(ret)
					
					console.log('return:')
					console.log(ret)
				})
				return
			} else {
				res.json({
				    result: false,
				    msg: 'The encrypt_key of the data fragment is unmatched!'
				})
			}
		}
	}
	res.json({
	    result: false,
	    msg: 'The fragment is not found'
	})
})
	
app.get('/v0/get_decrypt_key', async function(req, res){
	const dataId = parseInt(req.query.data_id)
    const fragmentNo = parseInt(req.query.fragment_no)
    const cid = req.query.cid
    const buyId = req.query.buy_id
    const buyerAccount = req.query.buyer_account
    const buyerKey = req.query.buyer_key
    
	console.log('get_decrypt_key')
	console.log(req.query)

	const buyhistoryList = await eos.getTableRows({
        json: true,
        code: config.DATA_TRADE_CONTRACT_NAME,
        scope: config.DATA_TRADE_CONTRACT_NAME,
        table: "buyhistory",
        table_key: "buy_id",
        lower_bound: buyId,
        upper_bound: buyId+1
    })
    
    if (!buyhistoryList) {
    	// error!
    }
	console.log(buyhistoryList.rows[0])
    
	if (buyhistoryList.rows[0].data_id === dataId &&
		buyhistoryList.rows[0].buyer === buyerAccount &&
		buyhistoryList.rows[0].buyer_key === buyerKey) {
		console.log('Found buyhistory: ')
		console.log(buyhistoryList.rows[0])
	} else {
    	// error! - the buyerAccount don't have authority to access the data with the inputs
		// or wrong input
    	console.log("error! - the buyerAccount don't have authority to access the data with the inputs")
    	res.json({
    		result: false,
    		msg: "error! - the buyerAccount don't have authority to access the data with the inputs"
    	})
    	return
    }
    
    const dataList = await eos.getTableRows({
        json: true,
        code: config.DATA_TRADE_CONTRACT_NAME,
        scope: config.DATA_TRADE_CONTRACT_NAME,
        table: "data",
        table_key: "data_id",
        lower_bound: dataId,
        upper_bound: dataId+1
    }).catch(function(error) {
        console.log(error)
        res.json({
            result: false,
            msg: 'Failed to get table info of data list'
        })
        return
    })
    
    console.log('\ndataList:')
    console.log(dataList)

    var dataFragmentList = null
    for (i = 0; i < dataList.rows.length; i++) {
    	if (dataList.rows[i].data_id === dataId) {
    		dataFragmentList = dataList.rows[i].fragments
    		break
    	}
    }
    if (!dataFragmentList) {
    	// error! Basically unreachable to here.
    	console.log("error! - Basically unreachable to here.")
        res.json({
            result: false,
            msg: 'error! - Basically unreachable to here.'
        })
        return
    }
    
    console.log('dataFragmentList: ')
    console.log(dataFragmentList)
    
    var fragment = null
    for (i = 0; i < dataFragmentList.length; i++) {
    	if (fragmentNo		=== dataFragmentList[i].fragment_no &&
    		cid				=== dataFragmentList[i].cid &&
    		config.IDFS_CLUSTER_ID === dataFragmentList[i].idfs_cluster_id) {
    		console.log('found the fragment info:')
    		console.log(dataFragmentList[i])
    		fragment = dataFragmentList[i]
    		break
    	}
    }
    if (!fragment) {
    	// error! Not matched fragment
    	console.log("error! - Not matched fragment")
    	console.log(`${fragmentNo} / ${cid} / ${config.IDFS_CLUSTER_ID}`)
    	res.json({
    		result: false,
    		msg: "error! - Not matched fragment"
    	})
    	return
    }

    db.get(cid, async function (err, decryptKey) {
	    if (err) console.log(cid + ' - does not exist')
	    console.log(`Getting decryptKey into DB (key: ${cid}, value: ${decryptKey})`)
	    
	    const decryptKeyBuffer = Buffer.from(decryptKey)
	    // decryptKey를 키 요청자의 pubkey로 암호화
	    const decryptKeyForRequesterBuffer = await encode(decryptKeyBuffer, buyerKey)
	    const ret = {
	    	result: true,
	    	decrypt_key: decryptKeyForRequesterBuffer
	    }
	    res.json( ret )
	    
	    console.log('The decrypt key:')
	    console.log(decryptKeyBuffer.toString())
	    console.log('The reencrypted decrypt key:')
	    console.log(decryptKeyForRequesterBuffer)
	})
})

app.get('/v0/get_public_key', function(req, res){
	res.json({
		result: true,
		public_key: EosjsEcc.privateToPublic(config.IDFS_KEEPER_PRIVATE_KEY, config.PUBKEY_PREFIX)
	})
})


function getDataHash(data) {
	// validating the parameter
	if (!Buffer.isBuffer(data)) {
		console.log('data should be Buffer')
		return
	}
	
	const digest = crypto.createHash('sha256').update(data).digest()
	const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
	const hashFunction = Buffer.from('12', 'hex') // 0x20
	const combined = Buffer.concat([hashFunction, digestSize, digest])
	const calculatedDataHash = bs58.encode(combined)
	return calculatedDataHash
}

async function encode(data, encryptKey) {
	const encryptKeyBuffer = bs58.decode(encryptKey.slice(3)).slice(0, 33)
	const opts = await eccrypto.encrypt(encryptKeyBuffer, data)
	
	//assert(opts.iv.length === 16, "Bad IV")
    //assert(opts.ephemPublicKey.length === 65, "Bad public key")
    //assert(opts.mac.length === 32, "Bad MAC")
    // 16 + 2 + 2 + 32 + 2 + 32 + ? + 32
    var buf = new Buffer(118 + opts.ciphertext.length)
    opts.iv.copy(buf)
    buf.writeUInt16BE(SECP256K1_TYPE, 16, true)  // Curve type
    buf.writeUInt16BE(32, 18, true)  // Rx length
    opts.ephemPublicKey.copy(buf, 20, 1, 33)  // Rx
    buf.writeUInt16BE(32, 52, true)  // Ry length
    opts.ephemPublicKey.copy(buf, 54, 33)  // Ry
    opts.ciphertext.copy(buf, 86)
    opts.mac.copy(buf, 86 + opts.ciphertext.length)
    return buf
}

async function decode(buf, decryptKey) {
	//assert(buf.length >= 118, "Buffer is too small")
    //assert(buf.readUInt16BE(16, true) === SECP256K1_TYPE, "Bad curve type")
    //assert(buf.readUInt16BE(18, true) === 32, "Bad Rx length")
    //assert(buf.readUInt16BE(52, true) === 32, "Bad Ry length")
    var iv = new Buffer(16)
    buf.copy(iv, 0, 0, 16)
    var ephemPublicKey = new Buffer(65)
    ephemPublicKey[0] = 0x04
    buf.copy(ephemPublicKey, 1, 20, 52)
    buf.copy(ephemPublicKey, 33, 54, 86)
    // NOTE(Kagami): We do copy instead of slice to protect against
    // possible source buffer modification by user.
    var ciphertext = new Buffer(buf.length - 118)
    buf.copy(ciphertext, 0, 86, buf.length - 32)
    var mac = new Buffer(32)
    buf.copy(mac, 0, buf.length - 32)
    const encryptedData = {
      iv: iv,
      ephemPublicKey: ephemPublicKey,
      ciphertext: ciphertext,
      mac: mac,
    }
    console.log('\ndecode()')
	const decryptKeyBuffer = bs58.decode(decryptKey).slice(1, 33)
    const data = await eccrypto.decrypt(decryptKeyBuffer, encryptedData)
	return data
}




