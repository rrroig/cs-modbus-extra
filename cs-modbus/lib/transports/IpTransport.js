'use strict';

var util = require('util');
var buffers = require('h5.buffers');
var Transport = require('../Transport');
var InvalidResponseDataError = require('../errors').InvalidResponseDataError;

module.exports = IpTransport;

/**
 * @constructor
 * @extends {Transport}
 * @param {Connection} connection
 * @event request Emitted right before the ADU is passed to the underlying
 * `Connection`.
 */
function IpTransport(connection)
{
  Transport.call(this, connection);

  /**
   * @type {h5.buffers.BufferQueueReader}
   */
  this.reader = new buffers.BufferQueueReader();

  /**
   * @type {IpTransport.Header}
   */
  this.header = new IpTransport.Header();

  /**
   * @private
   * @type {number}
   */
  this.nextTransactionId = 0;

  /**
   * @private
   * @type {object.<number, Transaction>}
   */
  this.transactions = {};

  this.connection.on('data', this.onData.bind(this));
}

util.inherits(IpTransport, Transport);

/**
 * @constructor
 */
IpTransport.Header = function()
{
  /**
   * @type {number}
   */
  this.id = -1;

  /**
   * @type {number}
   */
  this.version = -1;

  /**
   * @type {number}
   */
  this.length = -1;

  /**
   * @type {number}
   */
  this.unit = -1;
};

/**
 * @param {h5.buffers.BufferQueueReader} bufferReader
 */
IpTransport.Header.prototype.read = function(bufferReader)
{
  this.id = bufferReader.shiftUInt16();
  this.version = bufferReader.shiftUInt16();
  this.length = bufferReader.shiftUInt16() - 1;
  this.unit = bufferReader.shiftByte();
};

/**
 * @param {Transaction} transaction
 * @returns {InvalidResponseDataError|null}
 */
IpTransport.Header.prototype.validate = function(transaction)
{
  var message;
  var expectedUnit = transaction.getUnit();

  if (this.version !== 0)
  {
    message = util.format(
      "Invalid version specified in the MODBUS response header. "
        + "Expected: 0, got: %d",
      this.version
    );
  }
  else if (this.length === 0)
  {
    message = "Invalid length specified in the MODBUS response header. "
      + "Expected: at least 1, got: 0.";
  }
  else if (this.unit !== expectedUnit)
  {
    message = util.format(
      "Invalid unit specified in the MODBUS response header. "
        + "Expected: %d, got: %d.",
      expectedUnit,
      this.unit
    );
  }

  return typeof message === 'undefined'
    ? null
    : new InvalidResponseDataError(message);
};

IpTransport.Header.prototype.reset = function()
{
  this.id = -1;
  this.version = -1;
  this.length = -1;
  this.unit = -1;
};

IpTransport.prototype.destroy = function()
{
  this.removeAllListeners();

  if (this.connection !== null)
  {
    this.connection.destroy();
    this.connection = null;
  }

  if (this.transactions !== null)
  {
    Object.keys(this.transactions).forEach(function(id)
    {
      this.transactions[id].destroy();
    }, this);

    this.transactions = null;
  }
};

/**
 * @param {Transaction} transaction
 */
IpTransport.prototype.sendRequest = function(transaction)
{
  var id = this.getNextTransactionId();
  var adu = this.getAdu(id, transaction);

  this.transactions[id] = transaction;

  this.emit('request', transaction);

  this.connection.write(adu);

  transaction.start(this.createTimeoutHandler(id));
};

/**
 * @private
 * @returns {number}
 */
IpTransport.prototype.getNextTransactionId = function()
{
  if (++this.nextTransactionId === 0xFFFF)
  {
    this.nextTransactionId = 0;
  }

  return this.nextTransactionId;
};

/**
 * @private
 * @param {number} id
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
IpTransport.prototype.getAdu = function(id, transaction)
{
  var adu = transaction.getAdu();

  if (adu === null)
  {
    adu = this.buildAdu(id, transaction);
  }
  else
  {
    adu.writeUInt16BE(id, 0);
  }

  return adu;
};

/**
 * @private
 * @param {number} id
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
IpTransport.prototype.buildAdu = function(id, transaction)
{
  var request = transaction.getRequest();
  var pdu = request.toBuffer();
  var adu = this.frame(id, transaction.getUnit(), pdu);

  transaction.setAdu(adu);

  return adu;
};

/**
 * @private
 * @param {number} id
 * @param {number} unit
 * @param {Buffer} pdu
 * @returns {Buffer}
 */
IpTransport.prototype.frame = function(id, unit, pdu)
{
  var builder = new buffers.BufferBuilder();

  builder.pushUInt16(id);
  builder.pushUInt16(0);
  builder.pushUInt16(pdu.length + 1);
  builder.pushByte(unit);
  builder.pushBuffer(pdu);

  return builder.toBuffer();
};

/**
 * @private
 * @param {number} id
 * @returns {function}
 */
IpTransport.prototype.createTimeoutHandler = function(id)
{
  var transactions = this.transactions;

  return function()
  {
    if (typeof transactions[id] !== 'undefined')
    {
      delete transactions[id];
    }
  };
};

/**
 * @private
 * @param {Buffer} [data]
 */
IpTransport.prototype.onData = function(data)
{
  if (typeof data !== 'undefined')
  {
    this.reader.push(data);
  }

  if (this.header.id === -1 && this.reader.length >= 7)
  {
    this.header.read(this.reader);
  }

  if (this.header.id !== -1 && this.reader.length >= this.header.length)
  {
    this.handleFrameData();
  }
};

/**
 * @private
 */
IpTransport.prototype.handleFrameData = function()
{
  var transaction = this.transactions[this.header.id];

  if (typeof transaction === 'undefined')
  {
    this.skipResponseData();
    this.onData();

    return;
  }

  delete this.transactions[this.header.id];

  var validationError = this.header.validate(transaction);

  if (validationError !== null)
  {
    this.skipResponseData();

    transaction.handleError(validationError);

    this.onData();

    return;
  }

  var responseBuffer = this.reader.shiftBuffer(this.header.length);

  this.header.reset();

  var request = transaction.getRequest();

  try
  {
    transaction.handleResponse(request.createResponse(responseBuffer));
  }
  catch (error)
  {
    transaction.handleError(error);
  }

  this.onData();
};

/**
 * @private
 */
IpTransport.prototype.skipResponseData = function()
{
  if (this.header.length > 0)
  {
    this.reader.skip(this.header.length);
  }

  this.header.reset();
};
