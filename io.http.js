//io.http;
(function(root, factory) {
	// var _modname = 'IO';
	if (typeof define === "function" && define.amd) { // AMD mode
		define(["underscore", "IO"], factory);
	} else if (typeof exports === "object") { // CommonJS mode
		var _ = (typeof window._ === 'undefined') ? require("underscore") : window._;
		var IO = (typeof window.IO === 'undefined') ? require("IO") : window.IO;
		var firebase = (typeof window.firebase === 'undefined') ? require("firebase") : window.firebase;
		module.exports = factory(_, IO);
	} else {
	// This module extends "IO" (which already exists as a global variable)
		factory(root._, root.IO); // Plain JS, "rtl" is in window scope
		// root[_modname] = factory(root._, root.IO, root.firebase); // Plain JS, "rtl" is in window scope
	}
}(this, function(_, IO) {
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
		replaceDefinedProps = _.replaceDefinedProps,
		popAttr = _.popAttr,
		getQueryVariable = _.getQueryVariable,
		serializeUriVariables = _.serializeUriVariables,
		deserializeUriVariables = deserializeUriVariables;


	// Function injects a new factory into IO namespace and returns new extended singleton
	var Transport = IO.Transport,
		extendOptions = IO.extendOptions;

	// Promise "polyfill"
	if (typeof Promise === 'undefined') {
		throw new Error("'Promise' is undefined - use promise polyfill");
	}

	var
		HTTPError = createExceptionClass('IO.HTTPError', IO.BaseError),
		HTTPAuthError = createExceptionClass('IO.HTTPAuthError', IO.AuthError);

	var _httpDefaults = {
		'timeout': 30 * 1000 //
			// -- data format in exchange with server (now is text, to-do: support json)
		,'contentType': 'application/json' //
		,'encodeTo': 'json' // <-- data expected from server text or json?
		,'cache': false
			// 'crossDomain': true,
	};

	var _contentTypes = {
		'text': 'text/plain; charset=utf-8',
		'json': 'application/json; charset=utf-8',
		'xml': 'application/xml; charset=utf-8'
	};


	Transport.registry.uriScheme['http'] = HttpTransport;
	Transport.registry.uriScheme['https'] = HttpTransport;

	HttpTransport._contentTypes = {
		'text': 'text/plain; charset=utf-8',
		'json': 'application/json; charset=utf-8',
		'xml': 'application/xml; charset=utf-8'
	};

	function HttpTransport(url, options) {
		// to-do: migrate to native ES6 "fetch" or to "fetch" polyfill (https://github.com/github/fetch)

		// See hints about jQuery ajax formats:
		// http://www.virtualsecrets.com/jquery-send-receive-xml-json.html

		var self = Transport(url, options);
		self._tname = 'HttpTransport';

		if (typeof window.fetch === 'undefined')
			throw new Error('HttpTransport requires "fetch" API interface (use polyfill for this browser?)');

		self._encodeTo(_httpDefaults.encodeTo); // <- sync http options and internal encoding

		// Default mapping verb -> http method:
		self._methodsMap = {
			'create': 'post',
			'update': 'put',
			'read': 'get',
			'delete': 'delete',
			'query': 'get'
		};
		// ^ Idea - extend to use with header to redefine method X-Method-Override

		return _.extend(self, {

			// "json", "xml" means serialized representation (as string),
			// while "js-object" means javascript object as-is
			'encodeTo': Property(
				function() {
					return _encodeTo },
				function(value) {
					_encodeTo = assertType(value, ['json', 'xml', 'text']);
					self.options({
						encodeTo: value, // <- assume symmetrical type of the server response
						contentType: HttpTransport._contentTypes[value],
						processData: self.options().processData && !(_encodeTo === 'json' || _encodeTo === 'xml')
					})
				}),

			'_request': function(method, uri, rqOptions) {

				var rqSettings = $.extend({}, rqOptions || {}, {
					'method': method
				});

				return $.Deferred(function(def) {

					$.ajax(uri, rqSettings)
						.done(function(data) {
							try {
								// throw exception inside "done" to handle case with application-level errors
								// for example, server returns 200, but "data" contains some application-defined
								// error flag.
								// note that you can also transform fields of "data" and
								// handle changed values in the "promise.done"
								_done(data);
							} catch (e) {
								def.reject(e);
							}
							// deferred: resolve
							def.resolve(data, def);
						})
						.fail(function(jqXHR, textStatus, errorThrown) {
							var
								e = RequestError([textStatus, errorThrown, jqXHR.responseText].join(' '), {name: "IO.AjaxError", code: jqXHR.statusCode()});
							self.onError(e);
							// deferred: reject
							def.reject(e);
						});

					// return promise:
				}).promise();
			}
		});

	}


	// return extended namespace

	return _.extend(IO, {
		HttpTransport: HttpTransport,
		HTTPError: HTTPError,
		HTTPAuthError: HTTPAuthError
	});


}));
