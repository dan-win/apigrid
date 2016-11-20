//io.middleware.js

(function(root, factory) {
	// var _modname = 'IO';
	if (typeof define === "function" && define.amd) { // AMD mode
		define(["underscore.all", "shared/io"], factory);
	} else if (typeof exports === "object") { // CommonJS mode
		var _ = (typeof window._ === 'undefined') ? require("underscore.all") : window._;
		var IO = (typeof window.IO === 'undefined') ? require("shared/io") : window.IO;
		module.exports = factory(_, IO);
	} else {
	// This module extends "IO" (which already exists as a global variable)
		factory(root._, root.IO); // Plain JS, "rtl" is in window scope
		// root[_modname] = factory(root._, root.IO, root.firebase); // Plain JS, "rtl" is in window scope
	}
}(this, function(_, IO) {


	var 
		mandatory = _.assertDefined;




	/**
	 * Works with collections represented in form "key: object"
	 * @method CollectionInterface
	 * @param  {[type]}            svc [description]
	 */

	 // !!!! CollectionInterface is absolete now?

	function CollectionInterface(svc) {
		var self = {
			_svc: mandatory(svc, 'CollectionInterface error: cannot create instance, "svc" is not defined')
		}
		return _.extend(self, {

			'signIn': function (args) {return self._svc.signIn(args)},
			'signOut': function (args) {return self._svc.signOut()},

			'enum': function (rqOptions) {
				return self._svc.read(rqOptions)
			},

			'load': function (key, rqOptions) {
				mandatory(key, 'IO.load error: key is undefined!');
				return self._svc.child(key).read(rqOptions)
			},

			'save': function (key, data, rqOptions) {
				mandatory(key, 'IO.save error: key is undefined!');
				mandatory(data, 'IO.save error: data is undefined!');
				return self._svc.child(key).create(rqOptions, data)
			},

			'update': function (key, data, rqOptions) {
				mandatory(key, 'IO.update error: key is undefined!');
				mandatory(data, 'IO.update error: data is undefined!');
				return self._svc.child(key).update(rqOptions, data)
			},

			'remove': function (key, rqOptions) {
				return self._svc.child(key).delete(rqOptions)
			}

		})
	}

	// To work with a custom Object - instantiate ObjectReflection
	// and setup main methods
	// To implement template - instantiate with ObjectReflection(null),
	// setup main methods, and further clone reflection by ".wrap(service))"

	// Note: svc has 2 main attributes like a Service: endpoint, transport,
	// despite it does not use Service methods directly
	// For convenience
	function ObjectReflection(svc) {
		var _svc = svc || {};

		var self = {
			endpoint: _svc.endpoint,
			transport: _svc.transport,
			_methods: {

				//THESE METHODS for ObjectReflection
				// encode object:
				toJS: function (obj) {return obj},
				// update object attrs from data:
				fromJS: function (obj, data) {return _.extend(obj, data)}
			}
		}

		return _.extend(self, {
			/*
			Protected
			*/
			'_resolveEndpoint': function (objItem) {
				return self.endpoint
			},

			/*
			Utilities, roperties
			*/

			// deferred binding:
			'wrap': function (service) {
				self.endpoint = service.endpoint
				self.transport = service.transport
				return self;
			},
			'toJS': function (method) {self._methods.toJS = method; return self},
			'fromJS': function (method) {self._methods.fromJS = method; return self},

			/*
			Methods
			*/
			'load': function (objItem, rqOptions) {
				var ep = self._resolveEndpoint(objItem)
					,tsp = self.transport;
				return ep.read(tsp, rqOptions) // extract raw object
					.then(function (response) { // transform it - update original objItem
						return self._methods.fromJS(objItem, response)
					})
			},

			// NOTE: item cannot create itself unless "urn" points to its location with ID in REST-like systems
			'save': function (objItem, rqOptions, data) {
				var ep = self._resolveEndpoint(objItem)
					,tsp = self.transport
					,data = self._methods.toJS(objItem);
				return ep.create(tsp, rqOptions, data)
			},

			'update': function (objItem, rqOptions, data) {
				var ep = self._resolveEndpoint(objItem)
					,tsp = self.transport
					,data = self._methods.toJS(objItem);
				return ep.update(tsp, rqOptions, data)
			},

			'remove': function (objItem, rqOptions) {
				var ep = self._resolveEndpoint(objItem)
					,tsp = self.transport
				return ep.delete(tsp, rqOptions) // note - this can work if transport can remove obj by assigning NULL
			},

			'query': function (objItem, rqOptions) {
				var ep = self._resolveEndpoint(objItem)
					,tsp = self.transport
				return ep.query(tsp, rqOptions)
			}

		});
	}


	// Item knows its' ID!
	function ItemReflection(svc) {
		var self = ObjectReflection(svc);

		self._methods = _.extend(self._methods, {
				//THESE METHODS for ItemReflection
				// instantiate object reflection from data
				itemFactory: function (objRfl) {return objRfl},
				// define which field is the unique key for object
				// (return the value which identifies this instance of "obj" only!)
				makeKey: function (obj) {
					_.assertDefined(obj.id, 'makeKey uses obj.id attribute by default!')
					return obj.id
				}
		})

		var _newItemFactory = function (data) {
			// decode data from stream and create new item instance
			var instance = self._methods.itemFactory() // <--- what to pass into constructor???
			return self._methods.fromJS(instance, data)
		}

		return _.extend(self, {
			/*
			Protected
			*/

			// Override inherited:
			'_resolveEndpoint': function (objItem) {
				var key = self._methods.makeKey(objItem)
				// access "sub-object" by "/key":
				return self.endpoint.child(key)
			},

			'itemFactory': function (method) {self._methods.itemFactory = method; return self},
			/**
			 * Defines which field contains key: Extracts key value from object
			 * @method
			 * @param  {[type]} objItem [description]
			 * @return {[type]}         [description]
			 */
			// 'makeKeyValue': function (objItem) {return _.qGUID()},
			'makeKey': function (method) {self._methods.makeKey = method; return self},

			'enum': function (rqOptions) {
				var ep = self.endpoint
					,tsp = self.transport;
				// "Bless" objects using itemFactory to create a new "typed" instance:
				// Use "map" instead of "mapObject" - create array instead
				// of collection because ID contained in objects themselves
				// (each object is unique by instance)
				return ep.read(tsp, rqOptions) // extract raw object
					.then(function (response) { // transform it - update original objItem
						return _.map(response, _newItemFactory)
					})
			}
		})
	}

	// To-do: Is it possible to implement MultiMediaDispatcher as a Joint with Data Transformers???
	/**
	 * MultiMediaDispatcher supports Transport protocol (CRUD+SignIn,...), acts as a transport
	 * @method MultiMediaDispatcher
	 * @param  {[type]}             dataTransport [description]
	 * @param  {[type]}             blobTransport [description]
	 */
	function MultiMediaDispatcher(dataTransport, blobTransport) {
		var self = {
			dataTransport: mandatory(dataTransport, 'MultiMediaDispatcher error: "dataTransport" is not defined'),
			blobTransport: mandatory(blobTransport, 'MultiMediaDispatcher error: "blobTransport" is not defined')
		};

		return _.extend(self, {
			'signIn': function (args) {
				return self.dataTransport.signIn(args)
					.then(function (result) {
						return self.blobTransport.signIn(args)
					})
			},
			'signOut': function () {
				// body...
			},
			'create': function(urn, rqOptions, data) {
				// Here data can contain 'uploadData' attribute which is a BLOB to upload
				// another fields are metadata attributes?
				var file = data.file;
				var metadata = data.metadata;
				mandatory(data.uploadData, 'The upload task requires "uploadData" attribute in "data"!')
				mandatory(data.metadata, 'The upload task requires "metadata" attribute which defines hosting rules for media')
				data.customMetadata = data.customMetadata || {};

				return self.dataTransport.create(urn, rqOptions, {'customMetadata': {'status': 'loading'}})

					.then(function (response) {
						console.log('******* 1 ********', response);
						return response
					})

					.then(function (response) {
						console.log('Uploading...: ', urn, data, rqOptions);
						return  self.blobTransport.create(urn, rqOptions, data)
					})

					.then(function (response) {
						console.log('******* 2 ********', response);
						return response
					})

					.then(function (response) {
						// Update initial data:
						data = _.extend({}, data, response);
						// mark upload as successful:
						data.customMetadata['status'] = 'ok';
						console.log('Updating metadata...: ', urn, data, rqOptions);
						return self.dataTransport.update(urn, rqOptions, data);
					})
					.then(function (response) {
						return data; // <--- !!! after successful update: return updated data!
					})
			},

			'update': function(urn, rqOptions, data) {
				function updateDataStorage() {
					return self.dataTransport.update(urn, rqOptions, data)
				}
				// route metadata between storages
				if (data.metadata) return self.blobTransport.update(urn, rqOptions, data).then(updateDataStorage); 
				return updateDataStorage()
			},

			'read': function(urn, rqOptions) {
				return self.dataTransport.read(urn, rqOptions)
			},

			'delete': function(urn, rqOptions) {
				// delete BLOB:
				return self.blobTransport.delete(urn, rqOptions)
					// delete metadata:
					.then(function () {self.dataTransport.delete(urn, rqOptions)})
			},

			'query': function(urn, rqOptions) {
				// route all queries to metadata storage only:
				return self.dataTransport.query(urn, rqOptions)
			}

		})		
	}

	

	//=====================================================
	// Auth
	//=====================================================

	// Exception
	var	AuthError = _.createExceptionClass('IO.AuthError', IO.BaseError);

	/**
	* User context
	*/
	function UserCtx(data) {
		data = data || {};
		this.isLocked = data.isLocked || false;
		this.isAdmin = data.isAdmin || false;
	}

	/**
	 * Object which contains user info
	 * fiedls are depends on "back-end" ("low-level")
	 * @factory User
	 * @param  {object} data [description]
	 */
	function User(data) {
		var _data = data || {};
		var self = {

			'uid': _data.uid,

			'displayName': _data.displayName || 'Unknown',
			'roles': ['user'], /*can be also "admin", etc...*/
			'Ctx': new UserCtx()
		};
		return self;
	}

	/**
	 * Utility to perform signIn/signOut and to perform basic operation with "low-level" user
	 * only with "own" data (read, update, delete)
	 * @factory Auth
	 * @param  {object} options Contains attributes: user, onAuthStateChanged, endpoint, transport (all are optional)
	 */
	
	function Auth(options) {
		var _data = options || {};
		// set attributes here:
		var self = {
			user: _data.user || null, /*means "options for request?"*/
			_onAuthStateChanged: _data.onAuthStateChanged || null,
		}

		// set methods here:
		return _.extend(self, {
			/**
			 * Set up pre-defined attributes of the request options 
			 * (pathArgs and/or qryArgs or, optionally, http headers:) in accordance with selected URL scheme: 
			 * user info in path or user info in query argument of URL. 
			 * @method applyCredentials
			 * @param  {[type]}         rqOptions [description]
			 * @return {object}                   Modified request options
			 */
			// To-do: Applying Auth in Endpoint: make smart, distinguish betwee Endpoint and Transport 

			'applyCredentials': function (rqOptions) {
				// By default: do not modify anything in options but check that user is signed in:
				if (self.user) {
					return rqOptions;
				} 
				throw new AuthError('Not authorized to perform request!');
			},

			'signIn': function (credentials) {
				self.user = User();
				// Notification:
				if (self._onAuthStateChanged) self._onAuthStateChanged(self.user);
				return Promise.resolve(self.user);
			},

			'signOut': function () {
				self.user = null;
				// Notification:
				if (self._onAuthStateChanged) self._onAuthStateChanged(self.user);
				return Promise.resolve(self.user);
			},

			'retriveSession': function () {
				return Promise.resolve(self.user);
			},

			'isSigned': function () {
				return !!self.user;
			},

			'onAuthStateChanged': function (handler) {
				self._onAuthStateChanged = handler;
				return self;
			},

			'createUser': function (options) {
				return Promise.reject('createUser: not implemented');
			},

			'updateEmail': function (newValue) {
				return Promise.reject('updatePassword: not implemented');
			},

			'updatePassword': function (newValue) {
				return Promise.reject('updatePassword: not implemented');
			},

			'updateProfile': function (newValue) {
				return Promise.reject('updateProfile: not implemented');
			}


			/* Create "AuthManager, which implements CollectionInterface
			and contains adopted methods below
			work is through AuthUserReflection,

			distinguish data by "basicData", "customData",
			data "routing" - by CollectionInterface

			only "admins" have option to create users,
			only "curren user" can change his email and password 

			[...extend Transport - it must use internal chech auth.allows(operation) before...] 

			Maximum amount of data must be stored in "managed" database


			"tricky opertions" are:
			check, whether user is locked??? (special table or "lock" tree) on Auth....

			createUser...
			updateEmail, updatePassword, ...

			handle these particularities inside "data-bind=..." in html

			all these methods can be hidden inside ..._updateUser()

			for specific implementations where some operations not supported - reject promises or raise errors
	

			@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/


			/* Here is the "service" behaviour of Auth.

			Indeed, it routes call to the "child" service */

			// Allow to transform data in descendant to "equalized" fields
			// '_encodeData': function (userInfo) {
			// 	// ensure common mandatory attributes here!
			// 	mandatory(userInfo.uid, 'Auth CRUD operations requires "uid" field!')
			// 	mandatory(userInfo.displayName, 'Auth CRUD operations requires "displayName" field!')
			// 	return userInfo;
			// },

			// // Allow to transform data in descendant to "equalized" fields
			// '_decodeResponse': function (userInfo) {
			// 	// ensure common mandatory attributes here!
			// 	mandatory(userInfo.uid, 'Auth CRUD operations requires "uid" field!')
			// 	mandatory(userInfo.displayName, 'Auth CRUD operations requires "displayName" field!')
			// 	return userInfo;
			// },

			// // These methods can be overriden in descendants:
			// '_createUser': function () {
			// 	return Promise.reject(new AuthError('Prohibited operation!'))
			// },
			// '_readUser': _dummyPromise,
			// '_updateUser': _dummyPromise,
			// '_deleteUser': _dummyPromise,
			// '_queryUser': _dummyPromise,

			// // "Service" interface
			// 'child': function (urn) {
			// 	throw new RequestError('Auth does not support "child" method');
			// },

			// 'create': function(rqOptions, data) {
			// 	return self._createUser(data)
			// 		.then(function (data) {
			// 			return _rqPromise('create', rqOptions, data)
			// 		})
			// },

			// 'update': function(rqOptions, data) {
			// 	return self._updateUser(data)
			// 		.then(function (data) {
			// 			return _rqPromise('update', rqOptions, data);
			// 		})
			// },

			// 'read': function(rqOptions) {
			// 	return self._readUser(data)
			// 		.then(function (data) {
			// 			return _rqPromise('read', rqOptions);
			// 		})
			// },

			// 'delete': function(rqOptions) {
			// 	return self._deleteUser(data)
			// 		.then(function (data) {
			// 			return _rqPromise('delete', rqOptions);
			// 		})
			// },

			// 'query': function(rqOptions) {
			// 	return self._queryUser(data)
			// 		.then(function (data) {
			// 			return _rqPromise('query', rqOptions);
			// 		})
			// }
		})
	}

	// @@@@@@@@@@@@@@@ AuthManager @@@@@@@@@@@@@@@@@

	/**
	 * Works with collections represented in form "key: object"
	 * @method CollectionInterface
	 * @param  {[type]}            svc [description]
	 */
	// function AuthManager(svc, auth) {
	// 	// Implements CollectionInterface protocol!
	// 	var self = {};
	// 	var ci = (svc) ? CollectionInterface(svc) : null;

	// 	// Stub for methods which can be overriden in descendants:
	// 	var _dummyRead = function (key, rqOptions) {
	// 		// Return empty user here:
	// 		var rawUser = User();
	// 		return Promise.resolve(rawUser);
	// 	}
	// 	var _dummyModify = function (key, rawUser, rqOptions) {
	// 		// Return the same user here:
	// 		return Promise.resolve(rawUser);
	// 	}

	// 	return _.extend(self, {


	// 		// These methods can be overriden in descendants:
	// 		'_createUser': function () {
	// 			return Promise.reject(new AuthError('Prohibited operation!'))
	// 		},
	// 		'_createUser': _dummyModify,
	// 		'_readUser': _dummyRead,
	// 		'_updateUser': _dummyModify,
	// 		'_deleteUser': _dummyRead,
	// 		'_queryUser': _dummyRead,

	// 		// CRUD methods:

	// 		'enum': function (rqOptions) {

	// 			return self._svc.read(rqOptions)
	// 		},

	// 		'load': function (key, rqOptions) {
	// 			mandatory(key, 'IO.load error: key is undefined!');

	// 			return self._readUser(key, rqOptions)
	// 				.then(function (rawUser) {
	// 					if (ci) { // read custom data from 
	// 						return ci.load(key, rqOptions)
	// 							.then(function (extUser) {
	// 								return _.extend(rawUser, extUser)
	// 							})
	// 					}
	// 					return rawUser
	// 				})
	// 		},

	// 		'save': function (key, data, rqOptions) {
	// 			mandatory(key, 'IO.save error: key is undefined!');
	// 			mandatory(data, 'IO.save error: data is undefined!');
	// 			return self._svc.child(key).create(rqOptions, data)
	// 		},

	// 		'update': function (key, data, rqOptions) {
	// 			mandatory(key, 'IO.update error: key is undefined!');
	// 			mandatory(data, 'IO.update error: data is undefined!');
	// 			return self._svc.child(key).update(rqOptions, data)
	// 		},

	// 		'remove': function (key, rqOptions) {
	// 			return self._svc.child(key).delete(rqOptions)
	// 		}

	// 	})
	// }


//@@@@@@@@@@@@@@@@@@ en of Auth
	// alias endpoint (?)
	// alias transport (?) 'data'/'blob'/'mmedia'
	function connect(endpoint, transport, reflection) {
		var svc = Service(endpoint, transport);
		// Use a simple object reflection by default:
		reflection = reflection || ObjectReflection;
		reflection.wrap(svc);
		// signIn?
	}


	/*
	Gateway has:
	1. Transports (by alias)
	2. Endpoints (by alias/entity)
	3. Services (by alias/entity)
	Returns: services (by alias)
	 */
	

	return _.extend(IO, {
		// 'Service': Service,
		'CollectionInterface': CollectionInterface,

		'ObjectReflection': ObjectReflection,
		'ItemReflection': ItemReflection,

		'MultiMediaDispatcher': MultiMediaDispatcher,

		'User': User,
		'Auth': Auth,

		'AuthError': AuthError
	});

}));
