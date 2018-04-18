'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteMemoryResponse =
  require('./WriteMemoryResponse');

module.exports = WriteMemoryRequest;

/**
 * The write memory request (code 0x46).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes, big endian),
 *   - values to be written (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} the starting address to write
 * @param {Buffer} values the data to write
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `values` is not between 1 and 250 bytes
 */
function WriteMemoryRequest(address, values)
{
  Request.call(this, 0x46);

  if( values.length < 1 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` Buffer must be  "
        + "between 1 and 250, got: %d",
      values.length
    ));
  }

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * Values of the registers. A buffer of variable length.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(WriteMemoryRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     The starting address. If specified, must be a number
 *     between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 1 and 253.
 *
 * @param {object} options An options object.
 * @param {number} [options.type]
 * @param {number} [options.page]
 * @param {number} [options.address]
 * @param {Buffer} options.values
 * @returns {WriteMemoryRequest} A request
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMemoryRequest.fromOptions = function(options)
{
  return new WriteMemoryRequest(
    options.address, options.values);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteMemoryRequest} A request
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteMemoryRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 4);
  util.assertFunctionCode(buffer[0], 0x46);

  var address = buffer.readUInt16BE(1, true);

  var byteCount = buffer.length -3;
  var values = new Buffer( byteCount );

  buffer.copy(values, 0, 3, byteCount + 3);

  return new WriteMemoryRequest(address, values);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteMemoryRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(3 + this.values.length);

  buffer[0] = 0x46;
  buffer.writeUInt16BE(this.address, 1, true);

  this.values.copy(buffer, 3);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteMemoryRequest.prototype.toString = function()
{
  return util.format(
    "0x46 (REQ) Write %d bytes to Memory at address %d:",
    this.values.length,
    this.address,
    this.values
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteMemoryRequest.prototype.createResponse =
  function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteMemoryResponse
  );
};


/**
 * @returns {number} The memory address.
 */
WriteMemoryRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} The byte count.
 */
WriteMemoryRequest.prototype.getCount = function()
{
  return this.values.length;
};

/**
 * @returns {Buffer} Values of the registers
 */
WriteMemoryRequest.prototype.getValues = function()
{
  return this.values;
};
