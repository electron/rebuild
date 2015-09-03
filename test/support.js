global.Promise = global.Promise || require('promise');
let chai = require("chai");
let chaiAsPromised = require("chai-as-promised");

chai.should();
chai.use(chaiAsPromised);

global.chaiAsPromised = chaiAsPromised;
global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;
