const IPFS_IPADDR = '172.16.1.12'
const IPFS_API_PORT = '5001'
const IPFS_GATEWAY_PORT = '8080'

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const Buffer = require('buffer').Buffer
var ipfsClient = require('ipfs-http-client')
const level = require('level')

const db = level('idfs')
const app = express();
app.use(cors());
app.use(fileUpload());

const idfs_private_key = 'privkey';
const idfs_public_key = 'pubkey';

// connect to ipfs daemon API server
var ipfs = ipfsClient(IPFS_IPADDR, IPFS_API_PORT, { protocol: 'http' }) // leaving out the arguments will default to these values

var server = app.listen(3002, function(){
    console.log("Express server has started on port 3002")
})

app.get('/', function(req, res){
    res.send('Hello OASISBloc');
});

app.post('/v0/add_data', async function(req, res){
	const providerAccount	= req.body.provider_account
	const contractAddr		= req.body.contract_addr
	const reservedDataId	= req.body.reserved_dataId
	const fragmentNo		= req.body.fragment_no
	const decrypt_key		= req.body.decrypt_key
	const data_type			= req.body.data_type
	const data				= req.body.data

	var input
	if (data_type === 'text') {
		input = Buffer.from(data)
	} else if (data_type === 'file') {
		input = req.files['data'].data
	}
	
	// 받은 복호화 키는 보관자의 public key로 암호화 되어 있으므로, 보관자의 private key로 복호화하여 원래 복호화 키를 얻는다.
	// 원래 복호화 키를 이용하여 받은 데이터를 복호화 한다.
	// 복호화 된 데이터의 해시값을 블록체인에서 확인한다.(무결성 확인)
	// 문제가 없다면 IPFS에 암호화되어 있는 데이터를 업로드 한다.
	
	const result = await ipfs.add(input)
	.then(function(result){
		const hash = result[0].hash
		
		db.put(hash, decrypt_key, function (err) {
			if (err) return console.log('Failed to insert the decrypt_key in db', err) // some kind of I/O error
			res.json(result)
		})
	})
	.catch(function (error) {
		res.send(error)
	})
});

app.get('/v0/get_data', function(req, res){
	const cid = req.query.cid
	const dataUrl = 'http://' + IPFS_IPADDR + ':' + IPFS_GATEWAY_PORT + '/ipfs/' + cid
	res.setHeader("content-disposition", "attachment; filename="+cid);
	res.end(dataUrl);
});

app.get('/v0/get_decrypt_key', function(req, res){
	const cid = req.query.cid
    const publicKey = req.query.public_key
    
    db.get(cid, function (err, value) {
	    if (err) return console.log(cid + ' - does not exist')
	    const decryptKey = value
	    const ret = JSON.stringify(decryptKey)
	    res.json( ret )
	  })
});

app.get('/v0/get_public_key', function(req, res){
	res.end(idfs_public_key);
});



