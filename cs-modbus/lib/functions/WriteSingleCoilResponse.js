'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteSingleCoilResponse;

/**
 * The write single coil response (code 0x05).
 *
 * A binary representation of this response is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - an output address (2 bytes),
 *   - an output value (2 bytes).
 *
 * An output value of 0xFF00 means that the output is ON.
 * A value of 0x0000 means that it is OFF.
 *
 * @constructor
 * @extends {Response}
 * @param {number} address An address of the output.
 * Must be between 0x0000 and 0xFFFF.
 * @param {boolean} state A state of the output. `TRUE` - the coil is ON;
 * `FALSE` - the coil is OFF.
 * @throws {Error} If the `address` is not a number between 0x0000 and 0xFFFF.
 */
function WriteSingleCoilResponse(address, state)
{
  Response.call(this, 0x05);

  /**
   * An address of the output. A number between 0x0000 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A state of the output. `TRUE` - the coil is ON; `FALSE` - the coil is OFF.
   *
   * @private
   * @type {boolean}
   */
  this.state = !!state;
}

util.inherits(WriteSingleCoilResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     An output address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `state` (boolean, required) -
 *     A state of the output.
 *     `TRUE` - the coil is ON; `FALSE` - the coil is OFF.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {boolean} [options.state]
 * @returns {WriteSingleCoilResponse} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteSingleCoilResponse.fromOptions = function(options)
{
  return new WriteSingleCoilResponse(options.address, options.state);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {WriteSingleCoilResponse} A response created from
 * its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
WriteSingleCoilResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x05);

  var address = buffer.readUInt16BE(1, true);
  var state = buffer.readUInt16BE(3, true) === 0xFF00;

  return new WriteSingleCoilResponse(address, state);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
WriteSingleCoilResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x05;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.state ? 0xFF00 : 0x0000, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteSingleCoilResponse.prototype.toString = function()
{
  return util.format(
    "0x05 (RES) Coil at address %d was turned %s",
    this.address,
    this.state ? 'ON': 'OFF'
  );
};

/**
 * @returns {number} An address of the output.
 */
WriteSingleCoilResponse.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {boolean} A state of the output.
 */
WriteSingleCoilResponse.prototype.getState = function()
{
  return this.state;
};
