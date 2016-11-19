'use strict'
// unmock to use the actual implementation of sum

jest.unmock('../../../vendor/underscore-min');
jest.unmock('../underscore.ext');

window._ = require('../../../vendor/underscore-min');
window._ = require('../underscore.ext');
window.$ = require('../../../vendor/jquery-1.11.3.min');


describe('deepClone', () => {
  it('After cloning, nested objects should be an unique instance', () => {

  	var nestedObj = {prop1: 1};

	var srcObj = {
		txtAttr: 'text',
		objAttr: nestedObj,
		function (argument) {
			// body...
		}
	};

	var newObj = _.deepClone(srcObj);

    expect(newObj).toEqual({		
    	txtAttr: 'text',
		objAttr: {
			prop1: 1
		}
	});
	
	newObj.objAttr.prop1 = 1000;
    expect(srcObj.objAttr.prop1).toBe(1);
    expect(newObj.objAttr.prop1).toBe(1000);

  });
});

describe('deepExtend', () => {
  it('After extending, nested objects should be an unique instance', () => {

	var destObj = {
		txtAttr: 'text',
		objAttr: {prop1: 1}
	};

	var srcObj = {
		txtAttr: 'text',
		objAttr: {prop2: 2, prop3: 3}
	};

	var newObj = _.deepExtend(destObj, srcObj);

    expect(newObj).toEqual({
		txtAttr: 'text',
		objAttr: {prop1: 1, prop2: 2, prop3: 3}
    });

    newObj.objAttr.prop3 = 0;
    expect(srcObj.objAttr.prop3).toBe(3);
  });
});

describe('replaceDefinedProps', () => {
  it('After extending, nested objects should be an unique instance', () => {

	var destObj = {
		prop1: 1,
		objAttr: {nestedProp1: 1}
	};

	var srcObj = {
		prop1: 1000,
		prop2: 2000,
		prop3: 3000,
		objAttr: {nestedProp1: 100, nestedProp2: 200}
	};

	var newObj = _.replaceDefinedProps(destObj, srcObj);

    expect(newObj).toEqual({
    	prop1: 1000,
    	objAttr: {nestedProp1: 100}
    });
  });
});


describe('removeUndefinedProps', () => {
  it('After extending, nested objects should be an unique instance', () => {

	var 
		srcObj = {
		prop1: 1,
		nestedObj: {prop1: undefined, prop2: 'text'},
		prop2: undefined,
		prop3: undefined,
		prop4: void 0
	};

	var newObj = _.removeUndefinedProps(srcObj);

    expect(newObj).toEqual({
    	prop1: 1,
		nestedObj: {prop2: 'text'}
    });
  });
});

describe('popAttr', () => {
  it('After extending, nested objects should be an unique instance', () => {

	var srcObj = {
		prop1: 1000,
		prop2: 2000,
		prop3: 3000
	};

	var pop1 = _.popAttr(srcObj, 'prop1');
	expect(pop1).toBe(1000);
    expect(srcObj).toEqual({		
    	prop2: 2000,
		prop3: 3000
	});
  });
});

describe('getQueryVariable', () => {
  it('After extending, nested objects should be an unique instance', () => {

  	var query = '?var1=1&var2=2&var3=3';
  	console.log('query-->', query);
  	var value = _.getQueryVariable('var2', query);
	expect(value).toBe('2');
  });
});

describe('serializeUriVariables', () => {
  it('After extending, nested objects should be an unique instance', () => {

  	var query = {var1:1, var2:2, var3:3};
  	var value = _.serializeUriVariables(query);
	expect(value).toBe('var1=1&var2=2&var3=3');
  });
});

describe('deserializeUriVariables', () => {
  it('After extending, nested objects should be an unique instance', () => {

  	var query = 'var1=1&var2=2&var3=3';
  	var value = _.deserializeUriVariables(query);
	expect(value).toEqual({var1:'1', var2:'2', var3:'3'});
  });
});


describe('createExceptionClass', () => {
  it('It should be an error with a specified type name', () => {
  	var 
  		_MyExceptionClass = _.createExceptionClass('MyException'),
  		error = new _MyExceptionClass();

	expect(error.name).toBe('MyException');
  });

  it('It should be an descendant of a specified parent', () => {
  	var 
  		_MyExceptionClass = _.createExceptionClass('MyException'),
  		_MyDescendantClass = _.createExceptionClass('MyException', _MyExceptionClass),
  		error = new _MyDescendantClass();

	expect(error instanceof _MyExceptionClass).toBe(true);
  });
});


describe('Exception', () => {
  it('After extending, nested objects should be an unique instance', () => {
  	var error = _.Exception('Message', {name: 'TestType', code: 500});
  	console.log('Custom Error -->', error);
	expect(error).toEqual(jasmine.objectContaining({
		message: 'Message', 
		name: 'TestType', 
		code: 500
	}));
  });
});


describe('assertTrue', () => {
	// assertType: function (value, arg, errMessage)
	// // 'object', 'string', 'undefined'
	
	it('Test "truish" value - truish case', () => {
		expect(_.assertTrue(1, 'Defined!')).toEqual(1);
	});

	it('Test "false" value - false case', () => {
		expect(function () {
			_.assertTrue((void 0), 'Undefined!')			
		}).toThrowError(/Undefined!/);
	});

});


describe('assertDefined', () => {
	// assertType: function (value, arg, errMessage)
	// // 'object', 'string', 'undefined'
	
	it('Test defined value - truish case', () => {
		expect(_.assertDefined(1, 'Defined!')).toEqual(1);
	});

	it('Test undefined value - false case', () => {
		expect(function () {
			_.assertDefined((void 0), 'Undefined!')			
		}).toThrowError(/Undefined!/);
	});

});


describe('assertType', () => {
	// assertType: function (value, arg, errMessage)
	// // 'object', 'string', 'undefined'
	
	it('Test type (specified by string) - truish case', () => {
		expect(_.assertType({prop1:'text'}, 'object')).toEqual({prop1:'text'});
	});

	it('Test type (specified by string) - false case', () => {
		expect(function () {
			_.assertType({}, 'string')			
		}).toThrowError(/type mismatch/);
	});

	it('Test type (specified by array) - truish case', () => {
		expect(_.assertType({prop1:'text'}, ['object'])).toEqual({prop1:'text'});
	});

	it('Test type (specified by array) - false case', () => {
		expect(function () {
			_.assertType({}, ['string'])			
		}).toThrowError(/type mismatch/);
	});

});




// describe('endpoint', () => {
//   it('endpoint not empty', () => {
// 	const IO = require('../io');
//     expect(endpoint('/test').).toBe(3);
//   });
// });