'use strict'
jest.unmock('../../../vendor/underscore-min');
jest.unmock('../underscore.ext');
jest.unmock('../io'); // unmock to use the actual implementation of sum
jest.unmock('../node_modules/firebase/firebase'); // unmock to use the actual implementation of sum
jest.unmock('../io.firebase'); // unmock to use the actual implementation of sum


window._ = require('../../../vendor/underscore-min');
var u_ext = require('../underscore.ext');
window.IO = require('../io')
require('../node_modules/firebase/firebase');


var 
	IO = require('../io.firebase'), //<- use extended version of IO
	Endpoint = IO.Endpoint,
	FirebaseDB = IO.FirebaseDB,
	FirebaseStorage = IO.FirebaseStorage,

	PromiseException = _.createExceptionClass('PromiseException', Error),
	ExtPromiseException = _.createExceptionClass('ExtPromiseException', PromiseException);


// Initialization code for the real back-end ()

// <script src="https://www.gstatic.com/firebasejs/3.4.0/firebase.js"></script>
// <script>
//   // Initialize Firebase
//   var config = {
//     apiKey: "AIzaSyCYwYFEAnnXaVE-rDVUmEr5IXENEd9Ol24",
//     authDomain: "io-firebase-unittest.firebaseapp.com",
//     databaseURL: "https://io-firebase-unittest.firebaseio.com",
//     storageBucket: "io-firebase-unittest.appspot.com",
//     messagingSenderId: "914902878760"
//   };
//   firebase.initializeApp(config);
// </script>

  // Initialize Firebase
  var fbConfig = {
    apiKey: "AIzaSyCYwYFEAnnXaVE-rDVUmEr5IXENEd9Ol24",
    authDomain: "io-firebase-unittest.firebaseapp.com",
    databaseURL: "https://io-firebase-unittest.firebaseio.com",
    storageBucket: "io-firebase-unittest.appspot.com",
    // messagingSenderId: "914902878760"
  };

describe('FirebaseDB', () => {
	var 
		epItem = IO.Endpoint('/test-node/items'),
		transport = FirebaseDB('', {});

	transport.init(fbConfig);

	var originalTimeout;
	var spy;
	beforeEach(() => {
		// Create "bare" spy without function:
		spy = jasmine.createSpy('spy')

		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
	});

	afterEach(function() {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});

	xit('should authenticate...', () => {
		return transport.authenticate()
			.then((result)=>{
				spy('Done');
				return result;
			})
			.catch((reason)=>{
				spy('Error');
				console.warn('??? Auth: ', reason);
				return reason;
			})

			.then((result)=>{
				expect(spy).toHaveBeenCalledWith('Done');
				expect(spy).not.toHaveBeenCalledWith('Error');
				expect(result).toEqual({});
				return result;
			});
	});

	xit('should create resource', () => {
		var 
			exitData,
			item = {'name':'item1', 'attrs': {comment: 'text'}};
		return epItem.create(transport, {
			data: item,
			pathArgs: {},
			qryArgs: {}
		})
		.then((response)=>{
			exitData = response
			spy('ok')
			return response
		})
		.catch((reason)=>{
			exitData = reason
			spy('error')
			return reason
		})
		.then((result)=>{
			expect(spy).toHaveBeenCalledWith('ok')
			expect(spy).not.toHaveBeenCalledWith('error')
			expect(result).toEqual({});
			return result;
		});
	});

});


// var uploadTask = self.storage.ref(currentUser.uid + '/' + Date.now() + '/' + file.name)
//     .put(file, {'contentType': file.type});
