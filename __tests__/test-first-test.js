'use strict'

jest.unmock('../first-test'); // unmock to use the actual implementation of sum

describe('summ', () => {
  it('adds 1 + 2 to equal 3', () => {
    const summ = require('../first-test');
    expect(summ(1, 2)).toBe(3);
  });
});