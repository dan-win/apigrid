/*
//
// Framework for integration with server API
// Copyright D.Zimoglyadov.
// License: MIT (free for all kind of projects)
//
*/


/*
	!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

About promises (from https://github.com/kriskowal/q):

behaviour of handler passed to ".then":
"
	[RESOLVE]: If you return a value in a handler, outputPromise will get fulfilled.

	[REJECT]:If you throw an exception in a handler, outputPromise will get rejected.

	[GO to new promise / TRANSFORM]: If you return a promise in a handler, outputPromise will “become” that promise. Being able to become a new promise is useful for managing delays, combining results, or recovering from errors.
"

*/

/*
To-do: split module to IO and IO.Http
add _decodeError method (similar o _decodeData)
Refresh JSDoc
Implement "filterCollection" method
 */
// IO base classes and Ajax tools
(function(root, factory) {
		var _modname = 'IO';
		if (typeof define === "function" && define.amd) { // AMD mode
			define(["underscore.all", "json2"], factory);
		} else if (typeof exports === "object") { // CommonJS mode
			window._ = (typeof window._ === 'undefined') ? require("underscore.all") : window._;
			var JSON = (typeof window.JSON === 'undefined') ? require("json2") : window.JSON;
			module.exports = factory(_, JSON);
		} else {
			root[_modname] = factory(root._, root.JSON); // Plain JS, "rtl" is in window scope
		}
	}(this, function(_, JSON) {
		// body...

		var 
			mandatory = _.assertDefined,
			isFunction = _.isFunction,
			isNull = _.isNull,
			isUndefined = _.isUndefined,
			assertType = _.assertType,
			assertDefined = _.assertDefined,
			assertTrue = _.assertTrue,
			ownKeys = _.keys,
			Exception = _.Exception,
			createExceptionClass = _.createExceptionClass,
			raise = _.raise,
			
			deepClone = _.deepClone,
			deepExtend = _.deepExtend,
			extend = _.extend,
			replaceDefinedProps = _.replaceDefinedProps,
			popAttr = _.popAttr,
			getQueryVariable = _.getQueryVariable,
			serializeUriVariables = _.serializeUriVariables,
			deserializeUriVariables = deserializeUriVariables;


		var 
			BaseError = createExceptionClass('IO.Error', Error),
			ArgumentError = createExceptionClass('IO.ArgumentError', BaseError),
			RequestError = createExceptionClass('IO.RequestError', BaseError),
			EncodeErrorClass = createExceptionClass('IO.EncodeError', BaseError),
			DecodeErrorClass = createExceptionClass('IO.DecodeError', BaseError);

		// ***********************************************************

		/**
		 * Same as _.deepExtend but the "data" attribute passed by reference (as a whole) without member-by-member replication
		 * (this is important if data contains native obejcts like File, Blob, etc.)
		 * @method extendOptions
		 * @param  {object}      tObj   Destintion object (will be changed)
		 * @param  {object}      srcObj Multiple "source" arguments allowed
		 * @return {object}             Updated tObj
		 */
		var extendOptions = function (tObj, ___) {
			var 
				length = arguments.length, 
				data;
			if (length < 2 || tObj === null) return tObj;

			for (var index = 1; index < length; index++) {
				var source = arguments[index];
				if (!source) continue;
				// Prevent data corruption (in case if "data" contains native or custom objects):
				data = popAttr(source, 'data');
				tObj = deepExtend(tObj, source);
				if (!!data) tObj['data'] = data;
			}
			return tObj;
		};


		////  options = {verb, "headers, ...., body===data"}
		///// VECTOR: args: pathArgs, qryArgs
		/// args type: rqOptions = {pathArgs, qryArgs, data, raiseOnExtraPathArgs}, tpArgs

		function Endpoint(urn, opts, ctx) {
			var
				self = {
					_urn: urn,
					_pathNodes: urn.split('/'),
					_argsMap: 	[],

					_options: 	_.extend({}, opts),
					_ctx: 		_.extend({}, ctx),
					// Used in child, clone:
					factory: 	Endpoint
				};

			// Parse argument placeholders in URN:
			_.each(self._pathNodes, function(name, indexInPath) {
				var optional = false;
				if (':' == name.charAt(0)) { // argument found
					name = name.substring(1); // remove leading ":" :
					if (name.match(/\?$/)) {
						optional = true;
						name = name.replace(/\?$/, '')
					};
					self._argsMap.push([indexInPath, name, optional]); // add to map "name -> index in tags"
				}
			});
			
			_.extend(self, {
				
				/**
				 * Renders the actual path: replaces optional placeholders like ':arg1' (if any) with actual values.
				 * @method
				 * @param  {object} pathArgs Map of "path" arguments in form "argName":"value", used for path templates like "/path/to/:argName/service"
				 * @return {string}          The actual path
				 */
				'_resolveUrn': function (pathArgs) {
					var
						unknownArgs,
						pathBuffer = self._pathNodes.slice(0), // <-- local copy of entire array
						argsToProcess = deepClone(pathArgs),
						formalCount = _.size(argsToProcess);
					// Predicate function to select only mandatory path placehlders without "...?"
					var mandatory = function (tag) {
						return !tag[2]
					}

					assertType(pathArgs, 'object', ' "pathArgs" must be an object !');

					if (formalCount < _.size(_.filter(self._argsMap, mandatory))) {
						throw new ArgumentError('Not enough arguments \"' + _.keys(pathArgs||{}).join(',') + '\" for URN template: ' + self._pathNodes.join('/'));
					}

					_.each(self._argsMap, function(pair) {
						var indexInPath = pair[0], name = pair[1], isMandatory = !pair[2], value = popAttr(argsToProcess, name);
						if (typeof value === 'undefined') {
							if (isMandatory) throw new ArgumentError('Required argument \"' + name + '\" missed!');
							pathBuffer[indexInPath] = null;
						} else {
							// replace placeholder by actual value:
							pathBuffer[indexInPath] = value;
						}
					});

					if (_.size(argsToProcess) > 0 && self._options.raiseOnExtraPathArgs) {
						unknownArgs = _.keys(argsToProcess);
						throw new ArgumentError('Arguments \"' + unknownArgs.join(',') + '\" now allowed for: ' + self._urn);
					}

					// remove "nulls":
					pathBuffer = _.compact(pathBuffer);

					return pathBuffer.join('/');
				},

				'_dispatchRequest': function (transport, verb, rqOptions, data) {
					var
						tpHandler = mandatory(
							transport[verb], 'Transport does not support verb: ' + verb),
						// _a = rqOptions || {},
						_a = _.extend({}, rqOptions || {}),

						_auth = popAttr(_a, 'auth'), // <-- nullable!
						// Warning : do  not pass "auth" atribute into extendOptions - it contains firebase instances!
						o = extendOptions({}, self._options, _a),

						_urn;

					// Apply Auth here... applyCredentials sets up pathArgs, qryArgs
					if (_auth) { 
						console.log('auth found, calling', _auth);
						o = _auth.applyCredentials(o);
						console.log('credentials applied: ', o)
					}

					// _urn 		= (o.pathArgs) ? self._resolveUrn(o.pathArgs) : self._urn;
					_urn = self._resolveUrn(o.pathArgs || {});

					return tpHandler(_urn, o, data)
				},

				'urn': function () {return self._urn},

				'pathNodes': function () {return _.clone(self._pathNodes)},

				'options': function (obj) {
					if (typeof obj === 'undefined') return self._options; 
					extendOptions(self._options, obj);
					return this;
				},

				// 'child': function (u, o, ctx) {
				// 	u = self._urn + '/' + mandatory(u, 'child "urn" missed!');
				// 	o = extendOptions({}, self._options, o || {});
				// 	ctx = _.extend({}, self._ctx, ctx);
				// 	return self.factory(u, o, ctx)
				// },

				'child': function (u) {
					u = self._urn + '/' + mandatory(u, 'child "urn" missed!');
					return self.factory(u, self._options, self._ctx)
				},

				// to-do: remove "clone" method ??? 
				// 'clone': function () {return self.factory(self._urn, deepClone(self._options), self._ctx)},

				/**
				 * [description]
				 * @method
				 * @param  {[type]} transport [description]
				 * @param  {object} rqOptions    {<object>pathArgs, <object>qryArgs, <optional object>data}
				 * @return {[type]}           [description]
				 */

				 //To-do: 'fetch' method - absolete?
				'fetch': function (transport, rqOptions) {
					return self._dispatchRequest(transport, 'fetch', rqOptions)},

				'create': function(transport, rqOptions, data) {
					return self._dispatchRequest(transport, 'create', rqOptions, data)},

				'update': function(transport, rqOptions, data) {
					return self._dispatchRequest(transport, 'update', rqOptions, data)},

				'read': function(transport, rqOptions) {
					return self._dispatchRequest(transport, 'read', rqOptions)},

				'delete': function(transport, rqOptions) {
					return self._dispatchRequest(transport, 'delete', rqOptions)},

				'query': function(transport, rqOptions) {
					return self._dispatchRequest(transport, 'query', rqOptions)}

			});

			// Initialization (optional)
			if (Endpoint.initInstance) {
				// _epNode becomes "this" inside function:
				Endpoint.initInstance.call(self);
			}

			return self;
		}

		Transport.registry = {uriScheme:{}};

		Transport.factory = function(url, options) {
			var
				scheme = url.split(':')[0],
				factory = Transport.registry.uriScheme[scheme];

			if (typeof factory === 'undefined')
				throw new BaseError('Unknown transport scheme: ' + scheme);

			return factory(url, options);
		}

		var transport = Transport.factory;

		function Transport(url, options) {
			var
				self = {
					_tname: 'Transport',
					_url: url || '',
					_options: options || {},
					_accepts: ['object', 'string', 'undefined'],

					_encodeTo: 'js-object', // <- means "no conversion"
					// Convert data from <format> to ''
					_decodeFrom: 'js-object',
					_methodsMap: {
						'create': 'create',
						'update': 'update',
						'read': 'read',
						'delete': 'delete',
						'query': 'query'
					}
				};
				// type of input data - always only "object" or "string"

			return _.extend(self, {
				'_escapePath': function (value) {
					return value;
				},

				'init': function (config, appName) {
					return self; // chaining
				},

				'signIn': function (args) {
					return Promise.resolve({});
				},

				'signOut': function () {
					return Promise.resolve({});
				},

				'user': function () {
					return {
						uid: 'guest',
						displayName: 'Guest',
						isAnonymous: true
					}
				},

				'_dispatchRequest': function(verb, urn, rqOptions, data) {
					try {
						var 
							mappedMethod = assertDefined(self._methodsMap[verb], 
								'Verb \"'+verb+'\" is not supported by transport '+self.__tname),

							o = _.extend({}, self.options(), rqOptions),

							qryArgs = popAttr(o, 'qryArgs'),

							uri = self._resolveUri(urn, qryArgs, o);

						// validate data type:
						assertType(data, self._accepts, 
							'Invalid type of rqOptions.data: '
							+ (typeof data)
							+ '\nTypes allowed: '+ self._accepts.join(","));

						return self._request(mappedMethod, uri, o, data).then(function (rspData) {
							return self._decodeData(rspData)
						})
					} catch (e) {
						return Promise.reject(e)
					}
				},

				/**
				 * Names of JS types, allowed for the request data (e.g.: 'string', 'object', 'number', ...)
				 * @method
				 * @param  {array of string} value Enumeration of accepted types
				 * @return {self, array}       The transport instance itself (when called with argument), othewise - the current settings
				 */
				'accepts': function (value) {
					if (typeof value === 'undefined') return self._accepts;
					self._accepts = value;
					return self; // for chaining
				},

				// read-only property:
				'url': function() { return self._url },

				/**
				 * Renders the actual URI from template (adding the )
				 * @method
				 * @param  {string} urn       URN for request
				 * @param  {object} qryArgs  Map of "query" arguments (not used here, can be used in descendants). By default, this part is processed by Transport objects (E.g., HTTP transport uses it for the query part of URI, like '...?argName=value&...')
				 * @param  {[type]} rqOptions Request options
				 * @return {string}           Actual URI (the complete path, like: "url"+/+"urn"+[optional query])
				 */
				'_resolveUri': function (urn, qryArgs, rqOptions) {
					var 
						_location = self._url.replace(/[\/]+$/g, ''),
						_urn = urn.replace(/^[\/]+/g, '');
					if (qryArgs) {
						_urn = [_urn, '?', serializeUriVariables(qryArgs)].join('')
					}

					return self._escapePath([_location, '/',_urn].join(''));
				},

				/**
				 * Default settings for this transport (can be overriden with options, specified for request)
				 * @method
				 * @param  {object} value Options in form "key": "value"
				 * @return {self, object}       The transport instance itself (when called with argument), othewise - the current settings
				 */
				'options': function (value) {
					if (typeof value === 'undefined') return self._options;
					extendOptions(self._options, assertType(value, _.isObject), 'Transport.options error');
					return self;
				},

				/**
				 * Object which maps "CRUD" verbs to methods, e.g.: 'create'->'POST', ...
				 * @method
				 * @param  {object} valsHash Mapping
				 * @return {self, object}       The transport instance itself (when called with argument), othewise - the current settings
				 */
				'methodsMap': function (valsHash) {
						if (typeof valsHash === 'undefined') return _.copy(self._methodsMap);
						assertType(valsHash, 'object', 'Transport.methodsMap error');
						//allow to map only predefined verbs:
						var unknownArgs = _.difference(
							_.keys(valsHash), 
							['create','read','update','delete','query']);
						if(unknownArgs.length>0)
							throw new Error('methodsMap error: Unknown verb(s): '+unknownArgs.join(','));
						//allow to use only existing methods:
						var unknownMethods = _.difference(_.values(valsHash), _.keys(self));
						if(unknownMethods.length>0)
							throw new Error('methodsMap error: Unknown methods(s): '+unknownMethods.join(','));
						_.extend(self._methodsMap, valsHash);
						return self; // for chaining
					},

				/**
				 * Type of the request data, acceptable for back-end (default: 'js-object')
				 * @method
				 * @param  {string} value Mnemonic typename, one of: 'json', 'xml', 'text', 'form', 'js-object'. "json", "xml" means serialized representation (as string), while "js-object" means a javascript object (typeof data === 'object').
				 * @return {self, string}       The transport instance itself (when called with argument), othewise - the current settings
				 */
				'encodeTo': function(value) {
						if (typeof value === 'undefined') return self._encodeTo;
						self._encodeTo = assertType(value, ['json', 'xml', 'text', 'form', 'js-object'], 'Transport.encodeTo error');
						return self; // for chaining
					},

				/**
				 * Type of the response data which back-end returns  (default: 'js-object')
				 * @method
				 * @param  {string} value Mnemonic typename, one of: 'json', 'xml', 'text', 'form', 'js-object'. "json", "xml" means serialized representation (as string), while "js-object" means a javascript object (typeof data === 'object').
				 * @return {self, string}       The transport instance itself (when called with argument), othewise - the current settings
				 */
				'decodeFrom': function(value) {
						if (typeof value === 'undefined') return self._decodeFrom;
						assertTrue(['json', 'xml', 'text', 'form', 'js-object'].indexOf(value)>-1, 'Transport.decodeFrom error: invalid type: '+value)
						self._decodeFrom = value;
						return self; // for chaining
					},

				/**
				 * Converts the request data to format, acceptable for back-end (in accordance with .encodeTo settings)
				 * @method
				 * @param  {any} data      Optional data for request
				 * @param  {object} rqOptions Request options
				 * @return {any}           Converted data
				 */
				'_encodeData': function(data, rqOptions) {
					// Code 400: http code "400 Bad Request"
					function EncodeError(message) {
						throw new EncodeErrorClass(message, {code: 400});
					}

					assertType(data, self._accepts, 
						'Cannot perform request: invalid data type: ' + typeof data);
					
					if (typeof data === 'undefined') return;

					switch (self._encodeTo) {
						case 'js-object':
							return _.isObject(data) ? data : EncodeError('cannot encode "string" as "js-object"');
						case 'json':
							return JSON.stringify(data);
						case 'text':
							return _.isString(data) ? data : EncodeError('cannot encode data to "text"');
						case 'form':
							// To-do: encodeData->form
							EncodeError('encodeData->form not implemented');
						case 'xml':
							// To-do: encodeData->xml  
							EncodeError('encodeData->xml not implemented');
					}
				},

				/**
				 * Converts the response data to format, acceptable for application (in accordance with .decodeFrom settings)
				 * @method
				 * @param  {any} data      Optional data for request
				 * @return {any}           Converted data
				 */
				'_decodeData': function (data) {
					// Code 406: http code "Not Acceptable"
					function DecodeError(message) {
						throw new DecodeErrorClass(message, {code: 406});
					}

					var 
						dType = typeof data,
						isStr = dType === 'string',
						isObj = dType === 'object';

					// Allow undefined as a partial case?
					if (dType === 'undefined') return data;

					switch (self._decodeFrom) {
						case 'text':
							return (isStr) ? data : DecodeError('cannot interpret "'+dType+'" as expected "text"');
						case 'js-object': 
							return (isObj) ? data : DecodeError('cannot interpret "'+dType+'" as expected "js-object"');
						case 'json': 
							return (isStr) ? JSON.parse(data) : ('cannot interpret "'+dType+'" as expected "json"')
						case 'xml':
							DecodeError('decodeData for "xml" not implemented');
						default:
							DecodeError('No conversion defined for: '+self._decodeFrom+' from: '+dType);
					}
				},

				/**
				 * Low-level method (invockable from _dispatchRequest)
				 * @method
				 * @param  {string} method    Name of the request method (depends on the transport protocol)
				 * @param  {string} uri       Resolved URI to request
				 * @param  {object} rqOptions Options (optional) - redefines default settings for transport
				 * @return {Promise}           Promise object
				 */
				'_request': function(method, uri, rqOptions, data) {
					return Promise.reject(new RequestError('Not implemented'))
				},

				'create': function(urn, rqOptions, data) {
					return self._dispatchRequest('create', urn, rqOptions, data)
				},

				'update': function(urn, rqOptions, data) {
					return self._dispatchRequest('update', urn, rqOptions, data)
				},

				'read': function(urn, rqOptions) {
					return self._dispatchRequest('read', urn, rqOptions)
				},

				'delete': function(urn, rqOptions) {
					return self._dispatchRequest('delete', urn, rqOptions)
				},

				'query': function(urn, rqOptions) {
					return self._dispatchRequest('read', urn, rqOptions)
				}

			});

		}



		/**
		 * Binding of transport and endpoint.
		 * Final object, for instantiation only (not for inheritance)
		 * @method Service
		 * @param  {Endpoint} endpoint       [description]
		 * @param  {Transport} transport [description]
		 * @return {object}           [description]
		 */
		
		function Service (endpoint, transport) {
			var 
				self = {
					'endpoint': mandatory(endpoint, 'Service requires defined "endpoint"'), 
					'transport': mandatory(transport, 'Service requires defined "transport"')
				};
			// console.log('Service has transport: ', transport);

			return _.extend(self, {
				/**
				 * [description]
				 * @method
				 * @param  {[type]} args [description]
				 * @return {Promise{user?}}      [description]
				 */
				'signIn': function (args) {
					// DEV only !!!
					return self.transport.signIn(args)},

				'signOut': function (args) {return self.transport.signOut()},

				'child': function (urn) {
					return Service(self.endpoint.child(urn), self.transport)},

				'create': function(rqOptions, data) {
					return self.endpoint.create(self.transport, rqOptions, data)},

				'update': function(rqOptions, data) {
					return self.endpoint.update(self.transport, rqOptions, data)},

				'read': function(rqOptions) {
					return self.endpoint.read(self.transport, rqOptions)},

				'delete': function(rqOptions) {
					return self.endpoint.delete(self.transport, rqOptions)},

				'query': function(rqOptions) {
					return self.endpoint.query(self.transport, rqOptions)}
			})
		}


		// entity - endpoint or transport
		function Joint(aEndpointsOrTransports, race) {
			var self = {};
			var join = race ? Promise.race : Promise.all;

			var join = function (list) {
				return (race) ? Promise.race(list) : Promise.all(list)
			}

			var listMethods = function (methodName) {
				return _.map(aEndpointsOrTransports, function (item) {
					return mandatory(item[methodName], 
						'Joint impossible: entity does npt support method: '+methodName)
				})
			}

			var runMethods = function (queue, uri, rqOptions, data) {
				return _.map(queue, function (runner) {
					return runner(uri, rqOptions, data)
				})
			}

			return _.extend(self, {

				'create': function (uri, rqOptions, data) {
					var queue = listMethods('create')
					return join(runMethods(queue, uri, rqOptions, data))
				},

				'read': function (uri, rqOptions, data) {
					var queue = listMethods('read')
					return join(runMethods(queue, uri, rqOptions, data))
				},

				// IDEA - if data is array, "distribute" its items amoung nodes? 
				'update': function (uri, rqOptions, data) {
					var queue = listMethods('update')
					return join(runMethods(queue, uri, rqOptions, data))
				},

				'delete': function (uri, rqOptions, data) {
					var queue = listMethods('delete')
					return join(runMethods(queue, uri, rqOptions, data))
				},

				'query': function (uri, rqOptions, data) {
					var queue = listMethods('query')
					return join(runMethods(queue, uri, rqOptions, data))
				}
			})
		}

		function RequestALL(aEndpointsOrTransports) {
		 	return Joint(aEndpointsOrTransports, false)
		 } 

		function RequestANY(aEndpointsOrTransports) {
		 	return Joint(aEndpointsOrTransports, true)
		 } 

		// return exported namespace

		return {
			Endpoint: Endpoint,
			Transport: Transport,
			transport: transport,

			Service: Service,

			Joint: Joint,
			RequestALL: RequestALL,
			RequestANY: RequestANY,

			BaseError: BaseError,
			ArgumentError: ArgumentError,
			RequestError: RequestError,

			// Utils:
			extendOptions: extendOptions
		};


	}));
