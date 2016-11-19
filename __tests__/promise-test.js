'use strict'
jest.unmock('../../../vendor/underscore-min');
jest.unmock('../underscore.ext');
jest.unmock('../io'); // unmock to use the actual implementation of sum
jest.unmock('../node_modules/firebase/firebase'); // unmock to use the actual implementation of sum

window._ = require('../../../vendor/underscore-min');
var u_ext = require('../underscore.ext');
require('../node_modules/firebase/firebase');


// Promise "polyfill"
if (typeof Promise === 'undefined') {
	Promise = firebase.Promise;
	console.log('Native Promise not found, using polyfill!');
}

var 
	PromiseException = _.createExceptionClass('PromiseException', Error),
	ExtPromiseException = _.createExceptionClass('ExtPromiseException', PromiseException);

describe('Promise behaviour', () => {
	// beforeEach(function(done) {

	// 	setTimeout(function() {
	// 		value = 0;
	// 		done();
	// 	}, 1);
	// });

	// var originalTimeout;
	// beforeEach(function() {
	// 	originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
	// 	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
	// });

	// afterEach(function() {
	// 	jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	// });	

	// function promise(args) {
	// 	return new Promise(function (resolve, reject) {
	// 		if (args.action === 'resolve') 
	// 			resolve(args.with)
	// 		else if (args.action === 'reject')
	// 			reject(args.with)
	// 		else throw new Error('Promise argument "action" can be either "resolve" or "reject" only!');
	// 	});
	// }
	// 
	// 
	
	// Utils:

	// Trace functions:
	function toBeCalled(argument) {
		tracer('ok')
		return argument
	}

	function toNotBeCalled(argument) {
		tracer('error')
		return argument
	}

	// Generators for trace points:
	function createPoint(label) {
		return (argument) => {
			// console.log('========> createPoint: ',label, argument);
			tracer(label)
			return argument
		}
	}

	function createExceptionPoint(label, eClass) {
		label = label || '';
		eClass = eClass || PromiseException;
		return (argument) => {
			// console.log('========> createExceptionPoint: ',label, argument);
			tracer(label)
			throw new eClass(label)
		}
	}

	// Trace "allowed point" in the promise chain
	function allowed(label) {
		return () => {
			tracer(label);
			expect(tracer).toHaveBeenCalledWith(label)
			return label
		}
	}

	// Trace "disallowed point" in the promise chain
	function notAllowed(label) {
		return () => {
			tracer(label);
			expect(tracer).not.toHaveBeenCalledWith(label)
			return label
		}
	}

	// Assert promise result
	function assertLastResult(result) {
		return (arg) => {
			expect(arg).toEqual(result)
			return arg
		}
	}
	
	var tracer;
	beforeEach(() => {
		// Create "bare" spy without function:
		tracer = jasmine.createSpy('tracer')
	});


	it('Nice promise code ".catch" (TEMPLATE)', () => {
		// return promise from test (to ensure that jest wais for completion!)
		return Promise.resolve('[1]')
			.then(createPoint('then'))
			.catch(createPoint('catch'))
			.then((result)=>{
				// console.log('========> Last call: ', result)

				expect(tracer).toHaveBeenCalledWith('then')
				expect(tracer).not.toHaveBeenCalledWith('catch')
				return true
			})
	});

	it('1 - .catch should intercept exception from .then()', () => {
		// return promise from test (to ensure that jest wais for completion!)
		return Promise.resolve('[1]')
			.then(createExceptionPoint('then'))
			.catch(createPoint('catch'))
			.then((result)=>{
				// console.log('========> Last call: ', result)

				expect(tracer).toHaveBeenCalledWith('then')
				expect(tracer).toHaveBeenCalledWith('catch')
				return true
			})
	});

	it('2 - .catch can "translate exception" by returning a new rejected promise', () => {
		// return promise from test (to ensure that jest wais for completion!)
		return Promise.resolve('[2]')
			.then(createExceptionPoint('then'))
			.catch((reason)=>{tracer('catch'); return Promise.reject(new ExtPromiseException('Translated exception!'))})

			.catch(createPoint('catch re-raised'))
			.then((result)=>{
				// console.log('========> Last call: ', result)

				expect(tracer).toHaveBeenCalledWith('then')
				expect(tracer).toHaveBeenCalledWith('catch')
				expect(tracer).toHaveBeenCalledWith('catch re-raised')
				expect(result instanceof ExtPromiseException).toBe(true)
				return true
			})
	});

	it('3 - .then can "translate synchronous value" by returning a new value', () => {
		// return promise from test (to ensure that jest wais for completion!)
		return Promise.resolve('[3]')
			.then((result)=>{return 'translated:'+result})

			.then(assertLastResult('translated:[3]'))

			.then(createPoint('process translated'))

			.then((result)=>{
				// console.log('========> Last call: ', result)

				expect(tracer).toHaveBeenCalledWith('process translated')
				expect(result).toBe('translated:[3]');
				return true
			})
	});

	describe('4 - returning a synchronous value or a promise from .then and .catch should give the same result in subsequent chain', () => {

		it('when .then handler return(s) synchronous value...', () => {
			return Promise
				.resolve()
				.then(()=>{return 'test'})
				.then((result)=>{tracer('passed'); expect(result.toString()).toEqual('test')})

				.then(()=>{expect(tracer).toHaveBeenCalledWith('passed')})
		});

		it('when .then handler return(s) synchronous value...', () => {
			return Promise
				.resolve()
				.then(()=>{return Promise.resolve('test')})
				.then((result)=>{tracer('passed'); expect(result.toString()).toEqual('test')})

				.then(()=>{expect(tracer).toHaveBeenCalledWith('passed')})
		});
	});


	// it('should catch exception in subsequent ".catch"', () => {
	// 	// Create "bare" spy without function:
	// 	var 
	// 		tracer = jasmine.createSpy('tracer');

	// 	function onCatch(reason) {
	// 		expect()
	// 		expect(tracer).not.toHaveBeenCalled()
	// 	}
	// 	function onThen(argument) {
	// 		expect(tracer).toHaveBeenCalled('Start value')
	// 		throw new PromiseException('Exception from .then()', {code: 500});
	// 	}

	// 	// return promise from test (to ensure that jest wais for completion!)
	// 	return Promise.resolve('Start value')
	// 		.then(onThen)
	// 		.catch(onCatch)
	// });


	// it('should catch exception in subsequent ".catch"', function(done) {
	// 	var 
	// 		resp,
	// 		requiredResult = 'correct',
	// 		p = promise({action: 'resolve', with: 'Data-1'});

	// 	function handleResult(label, data) {
	// 		expect(label).toBe('correct');
	// 		expect(data).toBe('');
	// 		done();
	// 	}

	// 	console.log('p --->', p);
	// 	p.then(function (result) {
	// 		console.log('>>> >.THEN called: ', result);
	// 		// try {} catch (e) 
	// 		try {
	// 			throw new PromiseException('Exception from .then()');
	// 		} finally {
	// 			done();
	// 		}
	// 	})
	// 	.catch(function (reason) {
	// 		console.log('>>> >.CATCH called: ', reason);
	// 		handleResult('correct', reason);
	// 	});
	// });

	// it('should create new Promise by returning a result value from ".then"', function(done) {
	// 	var 
	// 		resp,
	// 		requiredResult = 'correct',
	// 		p = promise({action: 'resolve', with: 'Data-2'});

	// 	function handleResult(label, data) {
	// 		expect(label).toBe('correct');
	// 		expect(data).toBe();
	// 		done();
	// 	}

	// 	console.log('p --->', p);
	// 	p.then(function (result) {
	// 		console.log('>>> >.THEN-2-1 called: ', result);
	// 		// try {} catch (e) 
	// 		done();
	// 		return 'New Simple Data';
	// 	})
	// 	.catch(function (reason) {
	// 		console.log('>>> >.CATCH-2 called: ', reason);
	// 		handleResult('incorrect', reason);
	// 	})
	// 	.then(function (result) {
	// 		console.log('>>> >.THEN-2-2 called: ', result);
	// 		handleResult('correct', result);
	// 	});
	// });


	// it('3 - should create new Promise with rejected status by returning a new rejected Promise from ".catch"', function(done) {
	// 	var 
	// 		resp,
	// 		requiredResult = 'correct',
	// 		p = promise({action: 'reject', with: 'Data-3'});

	// 	function handleResult(label, data) {
	// 		expect(label).toBe('correct');
	// 		expect(data).toBe();
	// 		done();
	// 	}

	// 	console.log('p --->', p);
	// 	p.then(function (result) {
	// 		console.log('>>> >.THEN-3-1 called: ', result);
	// 		// try {} catch (e) 
	// 		done();
	// 		return 'New Simple Data';
	// 	})
	// 	.catch(function (reason) {
	// 		console.log('>>> >.CATCH-3-1 called: ', reason);
	// 		handleResult('correct', reason);
	// 		return promise({action: 'reject', with: new PromiseException('Spawned Exception from .catch()')})
	// 	})
	// 	//-----
	// 	.catch(function (reason) {
	// 		console.log('>>> >.CATCH-3-2 called: ', reason);
	// 		handleResult('correct', reason);
	// 	});
	// });

//****************************

	// it('should call ".catch" on .reject()', function() {
	// 	var 
	// 		response,
	// 		p = new Promise(function (resolve, reject) {
	// 			this.reject('test reason')
	// 		}).then(function (result) {
	// 			response = result;
	// 			throw new PromiseException('Exception from .then()');
	// 		}).catch(function (reason) {
	// 			response = reason
	// 		});
	// 	expect(response).toBe('');
	// });

	// it('should create appropriate Transport by url scheme', function() {
	// 	var 
	// 		// transport = require('../io').transport,
	// 		t = transport('test://transport-url/');
	// 	expect(t.url()).toEqual('test://transport-url/');
	// });
});

