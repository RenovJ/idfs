const IPFS_IPADDR = '172.16.1.12'
const IPFS_API_PORT = '5001'
const IPFS_GATEWAY_PORT = '8080'

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const Buffer = require('buffer').Buffer
const EosApi = require('eosjs-api')
const crypto = require('crypto')
const eccrypto = require('eccrypto')
const bs58 = require('bs58')
const ipfsClient = require('ipfs-http-client')
const level = require('level')

const db = level('idfs')
const app = express();
app.use(cors());
app.use(fileUpload());

const idfs_private_key = '5JfamdVo1DkQ8sTZoTK94xJzMuUQypPxprbQ7RBeHLeUEkSjnzw'
const idfs_public_key = 'OSB56tSQutcPf4MGfwqZsyTiYvmBpHVf8NJXoDRXHc6sf6ZGPuQHR'
var idfs_cluster_id = 0

// connect to ipfs daemon API server
var ipfs = ipfsClient(IPFS_IPADDR, IPFS_API_PORT, { protocol: 'http' }) // leaving out the arguments will default to these values

process.env.NODE_ENV = ( process.env.NODE_ENV && ( process.env.NODE_ENV ).trim().toLowerCase() == 'production' ) ? 'production' : 'development';
if (process.env.NODE_ENV == 'production') {
	console.log("Production Mode!!");
	global.config = require('./config/prod.conf')
} else {
	console.log("Development Mode!!");
	global.config = require('./config/dev.conf')
}
const osbConfig = {
  chainId: config.chainId,
  httpEndpoint: `${config.protocol}://${config.host}:${config.port}`,
  broadcast: true,
  verbose: false,
  sign: true,
//  expireInSeconds: 60
};

const eos = EosApi(osbConfig)
var server = app.listen(3002, "0.0.0.0", function(){
    console.log("Express server has started on port 3002")
})

app.get('/', function(req, res){
});

app.post('/v0/add_data', async function(req, res){
	const providerAccount   	= req.body.provider_account
	const contractAddr	    	= req.body.contract_addr
	const reservedDataId    	= req.body.reserved_dataId
	const fragmentNo	    	= req.body.fragment_no
	const encryptedDecryptKey	= req.body.decrypt_key
	const data_type			    = req.body.data_type
	const data			    	= req.body.data
	const isDataEncrypted		= req.body.is_data_encrypted

	var encryptedData
	if (data_type === 'text') {
		encryptedData = Buffer.from(data)
	} else if (data_type === 'file') {
		encryptedData = req.files['data'].data
	}

	var decryptedDataBuffer
	if (isDataEncrypted === true) {
		// 받은 복호화 키는 보관자의 public key로 암호화 되어 있으므로, 보관자의 private key로 복호화하여 원래 복호화 키를 얻는다.
		const privBuffer = bs58.decode(idfs_private_key).slice(1, 33)
		const decryptKeyBuffer = await eccrypto.decrypt(privBuffer, Buffer.from(encryptedDecryptKey))
		// 원래 복호화 키를 이용하여 받은 데이터를 복호화 한다.
		decryptedDataBuffer = await eccrypto.decrypt(decryptKeyBuffer, encryptedData)
	} else {
		decryptedDataBuffer = encryptedData
	}
	// 복호화 된 데이터의 해시값을 얻는다.
	const digest = crypto.createHash('sha256').update(decryptedDataBuffer).digest()
	const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
	const hashFunction = Buffer.from('12', 'hex') // 0x20
	const combined = Buffer.concat([hashFunction, digestSize, digest])
	const calculatedDataHash = bs58.encode(combined)
	
	// 복호화 된 데이터의 해시값을 블록체인에서 확인한다.(무결성 확인)
    const dataList = await eos.getTableRows({
        json: true,
        code: config.osbTrader,
        scope: config.osbTrader,
        table: "data",
        table_key: dataId
    }).catch(function(error) {
        console.log(error);
        res.json({
            result: false,
            msg: 'failed to retrieve data list'
        });
    });
    
	for (int i = 0; i < dataList.length; i++) {
		if (dataList.rows[i].data_id === reservedDataId) {
			if (dataList.rows[i].data_hash_original !== calculatedDataHash) {
				res.json({
			        result: false,
			        msg: 'The data hash is unmatched!'
			    });
			}
			
			// 문제가 없다면 IPFS에 암호화되어 있는 데이터를 업로드 한다.
			const result = await ipfs.add(encryptedData)
			.then(function(result){
				const hash = result[0].hash
				
				db.put(hash, encryptedDecryptKey, function (err) {
					if (err) return console.log('Failed to insert the decrypt_key in db', err) // some kind of I/O error
					ret = {
						data_hash_cid: hash,
						data_hash: calculatedDataHash
					}
					res.json(ret)
				})
			})
			.catch(function (error) {
				res.send(error)
			})
			
			return
		}
	}
	
	// error!
	res.json({
        result: false,
        msg: 'wrong reserved data id!'
    });
});

app.get('/v0/get_data', function(req, res){
	const cid = req.query.cid
	const dataUrl = 'http://' + IPFS_IPADDR + ':' + IPFS_GATEWAY_PORT + '/ipfs/' + cid
	res.setHeader("content-disposition", "attachment; filename="+cid);
	res.end(dataUrl);
});

app.get('/v0/get_decrypt_key', async function(req, res){
	const dataId = req.query.data_id
    const fragmentNo = req.query.fragment_no
    const cid = req.query.cid
    const buyerAccount = req.query.buyer_account
    const buyerKey = req.query.buyer_key

    (async () => {
    	const buyhistoryList = await eos.getTableRows({
            json: true,
            code: config.osbTrader,
            scope: config.osbTrader,
            table: "buyhistory",
            table_key: ""
        })
        
        if (!buyhistoryList) {
        	// error!
        }
        
    	var i;
        for (i = 0; i < buyhistoryList.rows.length; i++) {
        	if (buyhistoryList.rows[i].data_id === dataId &&
        		buyhistoryList.rows[i].buyer === buyerAccount &&
        		buyhistoryList.rows[i].buyer_key === buyerKey) {
        		break
        	}
        }
        if (i === buyhistoryList.rows.length) {
        	// error! - the buyerAccount don't have authority to access the data with the inputs
        	res.send("error! - the buyerAccount don't have authority to access the data with the inputs")
        }
        
        const dataList = await eos.getTableRows({
            json: true,
            code: config.osbTrader,
            scope: config.osbTrader,
            table: "data",
            table_key: dataId
        }).catch(function(error) {
            console.log(error);
            res.json({
                result: false,
            });
        });

        var dataFragmentList = null
        for (i = 0; i < dataList.rows.length; i++) {
        	if (dataList.rows[i].data_id === dataId) {
        		dataFragmentList = dataList.rows[i].fragments
        		break
        	}
        }
        if (!dataFragmentList) {
        	// error! Basically unreachable to here.
        	res.send("error! - Basically unreachable to here.")
        }
        
        console.log(dataFragmentList)
        
        var fragment = null
        for (i = 0; i < dataFragmentList.length; i++) {
        	if (fragmentNo		=== dataFragmentList.rows[i].fragment_no &&
        		cid				=== dataFragmentList.rows[i].hash_idfs &&
        		idfs_cluster_id === dataFragmentList.rows[i].idfs_cluster_id) {
        		fragment = dataFragmentList.rows[i]
        		break;
        	}
        }
        if (i === dataFragmentList.length) {
        	// error! Not matched fragment
        	res.send("error! - Not matched fragment")
        }

        db.get(cid, async function (err, value) {
		    if (err) res.send(cid + ' - does not exist')
	
		    const encryptedDecryptKey = value
		    // encryptedDecryptKey를 idfs_private_key로 복호화하여 decryptKey를 얻음
		    const privkeyBuffer = bs58.decode(idfs_private_key).slice(1, 33);
		    const decryptKeyBuffer = await eccrypto.decrypt(privkeyBuffer, Buffer.from(encryptedDecryptKey));
		    // decryptKey를 키 요청자의 pubkey로 암호화
		    const buyerKeyBuffer = bs58.decode(buyerKey.slice(3)).slice(0, 33);
		    const decryptKeyForRequesterBuffer = await eccrypto.encrypt(buyerKeyBuffer, decryptKeyBuffer);
		    const ret = JSON.stringify(decryptKeyForRequesterBuffer.toString())
		    res.json( ret )
		  })
        
	})();
	
});

app.get('/v0/get_public_key', function(req, res){
	res.end(idfs_public_key);
});



