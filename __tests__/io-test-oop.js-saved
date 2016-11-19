'use strict'
jest.unmock('../../../vendor/underscore-min');
jest.unmock('../underscore.ext');
jest.unmock('../io'); // unmock to use the actual implementation of sum


window._ = require('../../../vendor/underscore-min');
var u_ext = require('../underscore.ext');

// console.log('u_ext:', u_ext);

// mock promise:
function MockPromise(response, raise) {
	// body...
	var 
		_transport_request_args = {},
		_response = response,
		_raise = raise;

	this.spawnCount = (++MockPromise.spawnCount);
	this.dump = {};

	/**
	 * Allow to save extra data when MockPromise instance is creatd (read-write property)
	 * @method traceArgs
	 * @param  {object}  value Values to trace
	 * @return {this}        Same instance, for chaining
	 */
	this.traceArgs = function (value) {
		if (typeof value === 'undefined') return _transport_request_args;
		_.deepExtend(_transport_request_args, value);
		return this;
	}

	this.then = function (handler) {
		var result, _spawned;
		try {
			if (!_raise) result = handler(_response);
		} catch (e) {
			// force to call .catch() if any in the following chain:
			_raise = true;
			this.exception = e;
			return this;
		}
		// return self for chaining or a new promise if handler returns result:
		if (typeof result === 'undefined') return this;

		_spawned = new MockPromise(result);
		// copy trace for spawned object:
		_spawned.traceArgs(_transport_request_args);
		return _spawned;
	}

	this.catch = function (handler) {
		var result;
		if (_raise) result = handler(this.exception || _response);
		// return self for chaining or a new promise if handler returns result:
		if (typeof result === 'undefined') return this;

		_spawned = new MockPromise(result);
		// copy trace for spawned object:
		_spawned.traceArgs(_transport_request_args);
		return _spawned;
	}
}
MockPromise.spawnCount = 0;

var 
	Transport = require('../io').Transport,
	transport = require('../io').transport;


MockTransport.prototype = Object.create(Transport.prototype);
MockTransport.prototype.constructor = MockTransport;

function MockTransport(url, options) {
	Transport.call(this, url, options);

	this._request = function(method, uri, rqOptions) {
		var
			mockResponse = _.popAttr(rqOptions, 'mockResponse'),
			mockRaise = _.popAttr(rqOptions, 'mockRaise');

		// options.mockResponse._transport_request_args = {method: method, uri: uri, rqOptions: rqOptions};
		var _promise = new MockPromise(mockResponse, mockRaise);
		_promise.traceArgs({method: method, uri: uri, rqOptions: rqOptions});
		// _promise.dump = {method: method, uri: uri, rqOptions: rqOptions};
		return _promise;
	}
}

// register transport with "test" scheme:
Transport.registry.uriScheme['test'] = MockTransport;


describe('endpoint', () => {

	// import factory:
	const endpoint = require('../io').endpoint;

	it('urn property', () => {
		var ep = endpoint('/my/urn');
		expect(ep.urn()).toBe('/my/urn');
	});

	it('pathNodes property (read)', () => {
		var ep = endpoint('/my/urn');
		expect(ep.pathNodes()).toEqual(['','my','urn']);
	});

	it('options property (read)', () => {
		var ep = endpoint('/my/urn', {'prop':'text'});
		expect(ep.options()).toEqual({'prop':'text'});
	});
	
	it('options property (write)', () => {
		var ep = endpoint('/my/urn', {'prop':'text'});
		ep.options({'prop':'new text'})
		expect(ep.options()).toEqual({'prop':'new text'});
	});

	it('child method (read urn)', () => {
		var ep = endpoint('/my/urn');
		expect(ep.child('child').urn()).toBe('/my/urn/child');
	});
	
	it('child method (read options)', () => {
		var ep = endpoint('/my/urn', {'prop':'child text'});
		expect(ep.child('child').options()).toEqual({'prop':'child text'});
	});

	it('Perform requests', () => {
		var 
			testTransportOptions = {
				mockResponse : {"status": "ok", "body": "test data"},
				mockRaise: false,
				timeout: 3000
			},

			t = new MockTransport('test://transport-url', testTransportOptions),

			ep = endpoint('endpoint-urn/:arg1/:arg2', {}),

			rqOptions = {
				pathArgs: {arg1:'1', arg2:'2'},
				qryArgs: {var1:'My name', var2:'My Surname'},
				data: {a: 1}
			},

			_promise = ep.query(t, rqOptions),
			_response = 'No response!';

		_promise.then(function (rspData) {
			_response = rspData;
		});

		expect(_response).toEqual({status: 'ok', body: 'test data'});

		expect(_promise.traceArgs()).toEqual({ 
			method: 'read', 
			uri: 'test://transport-url/endpoint-urn/1/2?var1=My%20name&var2=My%20Surname', 
			rqOptions: { 
				timeout: 3000, 
				data: Object({ a: 1 }) 
			} 
		});
	});


	// to-do: test resolvePath
	
	// Transport:
	
	
});

describe('transport', () => {

	it('shoud build URI from URL and URN', () => {
		var
			t = transport('test://transport-url/'),
			urn = '/urn/of/some/resource/',
			uri = t._resolveUri(urn);
		expect(uri).toBe('test://transport-url/urn/of/some/resource/');
	});

	it('should create appropriate Transport by url scheme', function() {
		var 
			// transport = require('../io').transport,
			t = transport('test://transport-url/');
		expect(t.url()).toEqual('test://transport-url/');
	});

	it('it should decode response', () => {
		var 
			testTransportOptions = {
				mockResponse : '{"status": "ok", "body": "test data"}',
				mockRaise: false,
				timeout: 3000
			},

			// t = new MockTransport('test://transport-url', testTransportOptions).decodeFrom('js-object'),
			t = new MockTransport('test://transport-url', testTransportOptions).decodeFrom('json'),
			_promise = t.query('urn', {data: {}}),
			_response;

		// console.log('transport: -->', t);
		// console.log('new _promise: -->', _promise);
		_promise.then(function (rspData) {
			_response = rspData;
		}).catch(function (e) {
			_response = e;
		});

		expect(_response).toEqual({ status: 'ok', body: 'test data' });

	});

});
// describe('Property', () => {
//   it('Object with read-only property (defined by a string)', () => {
// 	const Property = require('../io').Property;
// 	var c1 = function () {
// 		this._prop = '123';
// 		this.prop = Property(function () {
// 			return this._prop
// 		})		
// 	}
// 	var o1 = new c1();

//     expect(o1.prop()).toBe('123');
//     // write to property:
//     var doWrite = function () {
//     	o1.prop('something')
//     }
//     expect(doWrite).toThrowError(/Cannot write/)
//   });

//   it('Object with read-only property (defined by a function)', () => {
// 	const Property = require('../io').Property;
// 	var c1 = function () {
// 		var _prop = '123';
// 		this.prop = Property(function () {
// 			return _prop
// 		})		
// 	}
// 	var o1 = new c1();

//     expect(o1.prop()).toBe('123');
//     // write to property:
//     var doWrite = function () {
//     	o1.prop('something')
//     }
//     expect(doWrite).toThrowError(/Cannot write/)
//   });


// });

// // describe('endpoint', () => {
// //   it('endpoint not empty', () => {
// // 	const IO = require('../io');
// //     expect(endpoint('/test').).toBe(3);
// //   });
// // });