/*jshint unused:false*/

'use strict';

var inherits = require('util').inherits;
var ModbusFunction = require('../ModbusFunction');
var ExceptionResponse = require('./ExceptionResponse');

module.exports = Request;

/**
 * @constructor
 * @extends {ModbusFunction}
 * @param {number} code
 */
function Request(code)
{
  ModbusFunction.call(this, code);
}

inherits(Request, ModbusFunction);

/**
 * @param {object} options
 * @param {number} options.code
 * @returns {Request}
 */
Request.fromOptions = function(options)
{
  var functions = require('./index');

  if (!functions.hasOwnProperty(options.code))
  {
    throw new Error("Unknown request for function code: " + options.code);
  }

  return functions[options.code].fromOptions(options);
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 */
Request.prototype.createResponse = function(responseBuffer)
{
  throw new Error("Abstract method must be overridden by the child class!");
};

/**
 * @protected
 * @param {Buffer} responseBuffer
 * @param {function(new:functions.Response)} Response
 * @returns {Response}
 */
Request.prototype.createExceptionOrResponse = function(responseBuffer, Response)
{
  if (responseBuffer[0] > 0x80)
  {
    return ExceptionResponse.fromBuffer(responseBuffer);
  }

  return Response.fromBuffer(responseBuffer);
};
