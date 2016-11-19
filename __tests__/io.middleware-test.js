'use strict'
jest.unmock('../../../vendor/underscore-min');
// jest.unmock('../../../vendor/es6-promise-min');
jest.unmock('../underscore.ext');
jest.unmock('../io'); // unmock to use the actual implementation of sum
jest.unmock('../io.middleware'); // unmock to use the actual implementation of sum


// const Promise = require('../../../vendor/es6-promise-min').Promise;
window._ = require('../../../vendor/underscore-min');
window._ = require('../underscore.ext');
window.IO = require('../io');

//console.log('createExceptionClass:::', typeof _.createExceptionClass);

// //console.log('u_ext:', u_ext);


const 
	Transport = require('../io').Transport,
	transport = require('../io').transport;

const Endpoint = require('../io').Endpoint;
const Service = require('../io').Service;
const ObjectReflection = require('../io.middleware').ObjectReflection;
const ItemReflection = require('../io.middleware').ItemReflection;


function MockTransport(url, options) {
	// returns response as: "method>url"
	var self = Transport(url, options);
	var mockDB = options.mockDB;
	options.mode = options.mode || 'resolve';

	var _node = function (uri, data) {
		var cursor, name;
		var tags = uri.replace(/^[./]/, '').replace(/[./]$/, '').split('/');
		tags.reverse();
		if (!mockDB) mockDB = {};
		cursor = mockDB;
		while (tags.length > 1) {
			name = tags.pop();
			if (!cursor[name]) { 
				if (typeof data !== 'undefined') // write operation, so create subtree: 
					cursor[name] = {};
				else
					break
			}
			cursor = cursor[name]
		}
		name = tags.pop()

		if (typeof data === 'undefined') {
			// read
			//console.log('read db: ', mockDB)
			return cursor[name];
		} else if (data === null) {
			// remove
			delete cursor[name]
		} else {
			// data define, write
			var val = cursor[name], val2;
			if (typeof val === 'object' && typeof data === 'object') {
				val2 = 	_.extend(val, data || {});
			} else {val2 = data};
			cursor[name] = val2;
			//console.log('write db: ', mockDB)
		}
	}

	// override:
	self._dispatchRequest = function(verb, urn, rqOptions, data) {
		try {
			switch (verb) {
				case 'create':
				case 'update':
					_node(urn, data);
					return Promise.resolve();
				case 'read':
					return Promise.resolve(_node(urn));
				case 'delete':
					_node(urn, null)
					return Promise.resolve();
				default:
					return Promise.reject('Unknown verb: '+verb);
			}
		} catch (e) {
			return Promise.reject(e);
		}
	}

	return self;
}


describe('ObjectReflection', () => {
	var mockDB = {};
	var spy;

	var TestObjReflection = ObjectReflection(null);

	TestObjReflection.toJS(function (obj) {
		var result = {} 
		if ('A' in obj) result['a'] = obj['A'] 
		if ('B' in obj) result['b'] = obj['B'] 
		return result
	})

	TestObjReflection.fromJS(function (obj, data) {
		//console.log('fromJS->', obj, data);
		if (data) {
			_.extend(obj, {
				A: data.a,
				B: data.b
			})
		} else {
			obj = data
		}
	})

	var ep, tsp, svc;

	beforeEach(()=>{
		ep = Endpoint('/my/data');
		tsp = MockTransport('', {'mockDB':mockDB});
		svc = Service(ep, tsp);
		TestObjReflection.wrap(svc);
		mockDB = {};
		spy = jasmine.createSpy('spy')		
	})

	it('1. should "save" converted data in storage', () => {
		var myObj = {A:1, B:2};
		return TestObjReflection.save(myObj)
			.then(()=>{
				expect(mockDB).toEqual({"my": {"data": {"a": 1, "b": 2}}});
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})
	});

	it('2. should "load" converted data from storage', () => {
		var myObj = {}, dataToRead = {A:1, B:2};
		return TestObjReflection
			.save(dataToRead)
			.then(()=>{
				return TestObjReflection.load(myObj)
			})
			.then(()=>{
				expect(mockDB).toEqual({"my": {"data": {"a": 1, "b": 2}}});
				expect(myObj).toEqual(dataToRead);
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})
	});

	it('3. should "update" data in storage', () => {
		var myObj = {}, dataToRead = {A:1, B:2};
		return TestObjReflection
			.save(dataToRead)
			.then(()=>{
				return TestObjReflection.update({B:3})
			})
			.then(()=>{
				return TestObjReflection.load(myObj)
			})
			.then(()=>{
				expect(mockDB).toEqual({"my": {"data": {"a": 1, "b": 3}}});
				expect(myObj).toEqual({"A": 1, "B": 3});
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})
	});

	it('4. should "remove" data from storage', () => {
		var myObj = {}, data = {A:1, B:2};
		return TestObjReflection
			.save(data)
			.then(()=>{
				return TestObjReflection.remove(myObj)
			})
			.then(()=>{
				expect(mockDB).toEqual( {"my": {}});
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})
	});
	
	
});

describe('ItemReflection', () => {
	var mockDB = {};
	var spy;

	ObjFactory.count = 0;
	function ObjFactory(data) {
		data = data || {};
		this.oid = (typeof data.oid !== 'undefined') ? data.oid : ++ObjFactory.count
		this.A = data.A
		this.B = data.B
	}
	ObjFactory.prototype.toString = function(){return '{}';}

	var TestItemReflection = ItemReflection(null);

	TestItemReflection.toJS(function (obj) {
		var result = {'oid': obj.oid} 
		if ('A' in obj) result['a'] = obj['A'] 
		if ('B' in obj) result['b'] = obj['B'] 
		return result
	})

	TestItemReflection.fromJS(function (obj, data) {
		//console.log('fromJS->', obj, data);
		if (data) {
			_.extend(obj, {
				oid: data.oid,
				A: data.a,
				B: data.b
			})
		} else {
			obj = data
		}
		return obj;
	})

	TestItemReflection.itemFactory(function (data) {
		return new ObjFactory(data)
	})

	TestItemReflection.makeKey(function (obj) {
		return obj.oid;
	})



	var ep = Endpoint('/my/items');
	var tsp = MockTransport('', {'mockDB': mockDB});
	var svc = Service(ep, tsp);
	TestItemReflection.wrap(svc);

	beforeEach(()=>{
		ObjFactory.count = 0;
		mockDB = {};
		spy = jasmine.createSpy('spy')
	})

	it('1. should "enum"  data from storage', () => {
		Promise.all([
				// write test items
				TestItemReflection.save(new ObjFactory({'A':1,'B':2, "oid": 1})),
				TestItemReflection.save(new ObjFactory({'A':10,'B':20, "oid": 2})),
				TestItemReflection.save(new ObjFactory({'A':100,'B':200, "oid": 3}))
			]).then(()=>{
				// enum
				return TestItemReflection.enum()
			}).then((response)=>{
				// check create items from
				expect(response['1']).toEqual({"A": 1, "B": 2, "oid": 1})
				expect(response['2']).toEqual({"A": 10, "B": 20, "oid": 2})
				expect(response['3']).toEqual({"A": 100, "B": 200, "oid": 3});
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})

	});

	it('2. should "save" item to storage to correct location', () => {
		TestItemReflection.save(new ObjFactory({'oid':4,'A':44,'B':444}))
			.then(()=>{
				expect(mockDB['my']['items']['4']).toEqual({"a": 44, "b": 444, "oid": 4})
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})
	})

	it('3. should "load" individual item with assigned ID', () => {
		var result = new ObjFactory({ 'oid':5 });
		TestItemReflection.save(new ObjFactory({'oid':5,'A':55,'B':555}))
			.then(()=>{
				return TestItemReflection.load(result)
			})
			.then((response)=>{
				expect(response).toEqual({'oid':5,'A':55,'B':555})
			})
			.catch(()=>{expect(spy).not.toHaveBeenCalled()})
	})
});