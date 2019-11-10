#[log, to_fix, get_user, inc_time, CNS, asrt] = require './lib'
keys = require './keys.js'

Eth = require 'ethjs'

util = require 'ethjs-util'





log = console.log


#oracle = artifacts.require 'OracleBallot'



ether = (val)->
	Eth.fromWei val, 'ether'


wei = (val)->
	Eth.toWei val, 'ether'


bn = (val)->
	return new Eth.BN val, 10


gas = (val, gas_price)->
	return (bn val).mul(bn '1000000000').mul(bn gas_price).toString()


bytes = (val)->
	res = util.fromAscii(val)
	res += '0' for v in [0..63] when res.length < 66
	return res


send = ->

	oracle = artifacts.require 'OracleBallot'
	addr = '0xde5491f774f0cb009abcea7326342e105dbb1b2e'.toLowerCase()

	oracle = await oracle.at addr

#	try
#		res = await oracle.setAdmin '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase(),
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#
#		log res
#	catch err
#		log err
#
#
#	try
#		res = await oracle.setOracle '0xf17f52151ebef6c7334fad080c5704d77216b732'.toLowerCase(), 'info', 1, true,
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#		log res
#	catch err
#		log err
#
#	try
#		res = await oracle.setOracle '0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef'.toLowerCase(), 'info', 1, true,
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#		log res
#	catch err
#		log err
#
#	try
#		res = await oracle.setOracle '0x821aea9a577a9b44299b9c15c88cf3087f3b5544'.toLowerCase(), 'info', 1, true,
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#		log res
#	catch err
#		log err










#
#
#	try
#		res = await oracle.linkOracle '0x11E957A66f73cB66F35c363798db259639bf479C'.toLowerCase(), '0xcdfa3ac5d2d1e803e667a89256268a73569e22c6'.toLowerCase(),
#			from: '0x11E957A66f73cB66F35c363798db259639bf479C'.toLowerCase()
#		log res
#	catch err
#		log err
#
#	try
#		res = await oracle.linkOracle '0x2679d2Db53A0ba81d107418BfB79Bdaaa03aFAB6'.toLowerCase(), '0xcdfa3ac5d2d1e803e667a89256268a73569e22c6'.toLowerCase(),
#			from: '0x11E957A66f73cB66F35c363798db259639bf479C'.toLowerCase()
#		log res
#	catch err
#		log err
#
#
#	try
#		res = await oracle.linkOracle '0xD6fAFb16AF8b45409F289119d827A04A4445158D'.toLowerCase(), '0xcdfa3ac5d2d1e803e667a89256268a73569e22c6'.toLowerCase(),
#			from: '0x11E957A66f73cB66F35c363798db259639bf479C'.toLowerCase()
#		log res
#	catch err
#		log err
#
#	try
#		res = await oracle.get_vote_result '0xcdfa3ac5d2d1e803e667a89256268a73569e22c6'.toLowerCase(), 0,
#			from: '0x11E957A66f73cB66F35c363798db259639bf479C'.toLowerCase()
#		log res
#	catch err
#		log err


#	try
#		res = await oracle.getProjOracles '0xcdfa3ac5d2d1e803e667a89256268a73569e22c6'.toLowerCase(), 0
#		log res
#	catch err
#		log err


#	rates = artifacts.require 'Rates'
#	addr = '0xa4392264a2d8c998901d10c154c91725b1bf0158'.toLowerCase()
#
#	rates = await rates.at addr

#	try
#		res = await rates.addPricer '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase(),
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#
#		log res
#	catch err
#		log err

#	try
#		res = await rates.addSymbolWithTokenAddress bytes('BT1'), '0x35768e3fcd30887c2d24ddd2dfd3c950df1e7fc5'.toLowerCase(),
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#
#		log res
#	catch err
#		log err
#
#	try
#		res = await rates.set bytes('BT1'), 1,
#			from: '0x627306090abab3a6e1400e9345bc60c78a8bef57'.toLowerCase()
#
#		log res
#	catch err
#		log err



#	tmp = util.fromAscii 'BT1'
#
#	log tmp














	log 'cmpl'




module.exports = (cb)->


	send()







#	eth = new Eth web3.currentProvider
#
#
##	oracle = await oracle.deployed()
#	oracle = await oracle.at '0x45fa97ac8eb37cc2057812759657d87f3b36b85c'.toLowerCase()
#
#	log oracle
#
#
#	res = await oracle.setAdmin keys.user3,
#		from: keys.owner
#	log res






#	try
#		res = await oracle.setOracle keys.user4, 'info4', 1, true,
#			from: keys.user3
#		log res
#
#	catch err
#		log err
#
#	try
#		res = await oracle.setOracle keys.user5, 'info5', 1, false,
#			from: keys.user3
#
#		log res
#
#	catch err
#		log err
#
#	try
#		res = await oracle.setOracle keys.user6, 'info6', 3, true,
#			from: keys.user3
#
#		log res
#
#	catch err
#		log err


#	try
#		res = await oracle.linkOracle keys.user4, keys.user8,
#			from: keys.user3
#
#		log res
#
#	catch err
#		log err
#
#
#	try
#		res = await oracle.getOracles 0,
#			from: keys.user3
#
#		log res
#
#	catch err
#		log err
#
#
#	try
#		res = await oracle.getOracle 0,
#			from: keys.user3
#
#		log res
#
#	catch err
#		log err

#asd =
#	asd: 11
#	asdasd: ->
#
#
#setTimeout =>
#	@scan scan_flag
#	, 10000




#node -e "setTimeout(function(){console.log('asdasd')}, 1000)"