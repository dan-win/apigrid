//amplifyjs-wrapper.js

// STUB FOR DEBUGGING
if (typeof define !== "function" || !define.amd) {
	define = function (ignore, modfunc) {
		MODULES.io_extended = modfunc(
			IO, // <-- global
			amplify // <-- global
			);
	}
}

// Extends IO singleton with a new transport factory for a local storage

define(['shared/io', 'amplify'], function(IO, amplify) {
	// note that amplify creates global variable, working through shim

	// Function injects a new factory into IO namespace and returns new extended singleton

	// Extending existing IO:
	IO.LocalStorageFactory = function (root, options) { // jQuery ajax settings
		// var dataOrigin, dataDest, opts, done, fail;
		var // Instantiate TransportFactory with updated settings:
			self = IO.TransportFactory(root, $.extend({
					'storageType': 'local:auto' // type of storage, set "false" for default for AmplifyJS
				}, options || {})),
			lsType = self.options().storageType.split(':')[1] || null,
			accessor;

		switch (self.options().storageType) {
			case 'local:auto':
				accessor = amplify.store;
				break;
			case 'local:localStorage':
			case 'local:sessionStorage':
			case 'local:globalStorage':
			case 'local:userData': // IE9 only (?)
			case 'local:memory':
				accessor = amplify.store[lsType];
				if (!accessor) 
					throw new Error(
						'Local storage \"'+lsType+'\" is not available for this browser! ';
				break;
			default:
				throw new Error('IO middleware: unsupported storage type: '+ self.options().storageType);
		}

		self.request = function (endpoint, args, vars) {
			var 
				method = endpoint.method().toLowerCase(),
				dataKey = self.resolveUrl(endpoint, args, vars),
				data;
			// endpoint.done!: endpoint._done || function () {}

			return $.Deferred(function(def){

				function read(dataKey) {
					data = accessor(dataKey);
					if (typeof data == 'undefined')
						throw {
							name: 'Io.RequestError',
							message: 'Resource not found: id='+dataKey,
							code: 404 // Like http 404 "Not found"
						}
					return data;
				}

				try {

					if (!endpoint)
						throw {
							name: 'Io.RequestError',
							message: 'Endpoint is not defined!',
							code: 400 // Like http 400 "Bad request"
						};

					if ('put' == method || 'post' == method ) {
						data = endpoint._requestData();
						console.log('data->', data);
						accessor(dataKey, data);
						endpoint._done(data);
					} else if ('get' == method || 'delete' == method ) {
						data = read(dataKey);
						if ('delete' == method) 
							accessor(dataKey, null);
						endpoint._done(data);
					} else {
						throw {
							name: 'Io.RequestError',
							message: 'Method not supported: '+method,
							code: 405 // Like http 405 "Method not allowed"
						};
					}

					def.resolve(data, def);

				} catch (e) {
					console.log('Error in io.extended.js: ', e);
					def.reject(e, e.message, e.code);
				}

			}).promise();
		}

		self.requestAny = function (epArray, args, vars) {
			// polling stub - always use a first endpoint
			// to-do: polling from several sources (?)
			return self.request(epArray[0], args, vars);
		}

		// return instance:
		return self;
	}

	return IO;

});