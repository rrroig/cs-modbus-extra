'use strict';

var util = require('util');
var buffers = require('h5.buffers');
var errors = require('../errors');
var Transport = require('../Transport');

module.exports = RtuTransport;

/**
 * @private
 * @const
 * @type {number}
 */
var MIN_FRAME_LENGTH = 5;
/*
 * ECHO 
*/
var PREV_MSG_ECHO=[];
var PREV_MSG_COUNT=0;

/**
 * @private
 * @const
 * @type {Array.<number>}
 */
var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
];

/**
 * @constructor
 * @extends {Transport}
 * @param {RtuTransport.Options|object} options
 * @event request Emitted right before the ADU is passed to the underlying
 * `Connection`.
 */
function RtuTransport(options)
{
  /**
   * @private
   * @type {RtuTransport.Options}
   */
  this.options = options instanceof RtuTransport.Options
    ? options
    : new RtuTransport.Options(options);

  Transport.call(this, this.options.connection);

  /**
   * @private
   * @type {Transaction}
   */
  this.transaction = null;

  /**
   * @private
   * @type {BufferQueueReader}
   */
  this.reader = new buffers.BufferQueueReader();

  /**
   * @private
   * @type {number|null}
   */
  this.eofTimer = null;
  /**
   * @private enableECHO
   * @type {boolean|null}
   */
  
  this.enableEcho=null;

  /**
   * @private
   * @type {function}
   */
  this.handleFrameData = this.handleFrameData.bind(this);

  /**
   * @private
   * @type {function}
   */
  this.handleTimeout = this.handleTimeout.bind(this);

  this.connection.on('data', this.onData.bind(this));
}

util.inherits(RtuTransport, Transport);

/**
 * @constructor
 * @param {object} options
 * @param {Connection} options.connection
 * @param {number} [options.eofTimeout]
 */
RtuTransport.Options = function(options)
{
  /**
   * @type {Connection}
   */
  this.connection = options.connection;

  /**
   * @type {number}
   */
  this.eofTimeout =
    typeof options.eofTimeout === 'number' && options.eofTimeout >= 1
      ? options.eofTimeout
      : 10;

/**
   * @type {BOOLEAN} ECHO
   */
      
   this.enableEcho =
    typeof options.enableEcho == 'boolean' 
      ? options.enableEcho
      : false;
      
};

RtuTransport.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.connection !== null)
  {
    this.connection.destroy();
    this.connection = null;
  }

  if (this.transaction !== null)
  {
    this.transaction.destroy();
    this.transaction = null;
  }

  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
    this.eofTimer = null;
  }
  
  if (this.enableEcho !== null)
  {
   
    this.enableEcho= null;
  }
};

/**
 * @param {Transaction} transaction
 * @throws {Error}
 */
RtuTransport.prototype.sendRequest = function(transaction)
{
  if (this.transaction !== null)
  {
    throw new Error(
      "Can not send another request while the previous one "
        + "has not yet completed."
    );
  }

  this.transaction = transaction;

  var adu = this.getAdu(transaction);

  this.emit('request', transaction);

  this.connection.write(adu);
  
  

  transaction.start(this.handleTimeout);
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
RtuTransport.prototype.getAdu = function(transaction)
{
  var adu = transaction.getAdu();

  if (adu === null)
  {
    adu = this.buildAdu(transaction);
  }

  return adu;
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
RtuTransport.prototype.buildAdu = function(transaction)
{
  var request = transaction.getRequest();
  var pdu = request.toBuffer();
  var adu = this.frame(transaction.getUnit(), pdu);

  transaction.setAdu(adu);

  return adu;
};

/**
 * @private
 * @param {number} unit
 * @param {Buffer} pdu
 * @returns {Buffer}
 */
RtuTransport.prototype.frame = function(unit, pdu)
{
  var builder = new buffers.BufferBuilder();

  builder.pushByte(unit);
  builder.pushBuffer(pdu);
  builder.pushUInt16(this.crc16(unit, pdu), true);
  
PREV_MSG_COUNT=1+pdu.byteLength+2;
//  console.log ("adu.lenght=" +PREV_MSG_COUNT);
  
  return builder.toBuffer();
};

/**
 * @private
 * @param {number} firstByte
 * @param {Buffer} buffer
 * @returns {number}
 */
RtuTransport.prototype.crc16 = function(firstByte, buffer)
{
  var crc = 0xFFFF;
  var j;

  if (firstByte !== -1)
  {
    j = (crc ^ firstByte) & 0xFF;

    crc >>= 8;
    crc ^= CRC_TABLE[j];
  }

  for (var i = 0, l = buffer.length; i < l; ++i)
  {
    j = (crc ^ buffer[i]) & 0xFF;

    crc >>= 8;
    crc ^= CRC_TABLE[j];
  }

  return crc;
};

/**
 * @private
 */
RtuTransport.prototype.handleTimeout = function()
{
  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
  }

  this.skipResponseData();
};

/**
 * @private
 */
RtuTransport.prototype.skipResponseData = function()
{
  if (this.reader.length > 0)
  {
    this.reader.skip(this.reader.length);
  }

  this.transaction = null;
};

/**
 * @private
 * @param {Buffer} data
 */
RtuTransport.prototype.onData = function(data)
{
  if (this.transaction === null)
  {
    return;
  }

  this.reader.push(data);

  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
  }

  this.eofTimer = setTimeout(this.handleFrameData, this.options.eofTimeout);
  //ECHO RTU 
  this.enableEcho=this.options.enableEcho;
};

/**
 * @private
 */
RtuTransport.prototype.handleFrameData = function()
{
  var transaction = this.transaction;

  if (this.reader.length < MIN_FRAME_LENGTH)
  {
    this.skipResponseData();

    transaction.handleError(new errors.IncompleteResponseFrameError());

    return;
  }

//console.log ("echo? " + this.enableEcho);

if (this.options.enableEcho==true){

	//ECHO
	
	if (this.reader.length<PREV_MSG_COUNT){
		PREV_MSG_COUNT=0;
	}

	var PREV_MSG_COUNT2=PREV_MSG_COUNT;

	if (PREV_MSG_COUNT===0){
		PREV_MSG_COUNT=1;
		}
	
	var unit ;
	var got_no_echo=false;
	
	if (this.reader.length>PREV_MSG_COUNT){
	unit = this.reader.skip(PREV_MSG_COUNT);
	}
	else
	{
		//console.log("zzzz");
		this.reader.shiftBuffer(this.reader.length);
		got_no_echo=true;
	}
	
	var responseBuffer;
	var checksum ;
	
	if (got_no_echo==false){
	
	unit=this.reader.shiftByte();
	responseBuffer = this.reader.shiftBuffer(this.reader.length - 2);
	checksum = this.reader.shiftUInt16(true);
	
	}
	
}
else 
{
	 
	//no echo
	//console.log(this.reader.length);
	var unit = this.reader.shiftByte();
	var responseBuffer = this.reader.shiftBuffer(this.reader.length - 2);
	var checksum = this.reader.shiftUInt16(true);
	got_no_echo=false;
	
}
  
  
  
if (got_no_echo==false){
	  
 this.skipResponseData();

  var validationError = this.validate(
    transaction,
    unit,
    responseBuffer,
    checksum
  );

  if (validationError !== null)
  {
    transaction.handleError(validationError);

    return;
  }

  var request = transaction.getRequest();

  try
  {
    
    transaction.handleResponse(request.createResponse(responseBuffer));
  }
  catch (error)
  {
    transaction.handleError(error);
   // console.log ("errorxx");
  }
}
else
{
	
	 //echo enabled but no echo received 
	
	 //var validationError =new errors.InvalidResponseDataError("error no echo no adapter");
	//transaction.handleError(ResponseNoEcho);
    return;
	}


};

/**
 * @private
 * @param {Transaction} transaction
 * @param {number} actualUnit
 * @param {Buffer} responseBuffer
 * @param {number} expectedChecksum
 * @returns {Error|null}
 */
RtuTransport.prototype.validate =
  function(transaction, actualUnit, responseBuffer, expectedChecksum)
{
//console.log ("expected crc:"+expectedChecksum);
//console.log ("unit + buffer:"+actualUnit +" >> "+ responseBuffer);

var actualChecksum = this.crc16(actualUnit, responseBuffer);

//console.log ("actual crc:"+actualChecksum);
  if (actualChecksum != expectedChecksum)
  {
    return new errors.InvalidChecksumError();
  }
  else
  {
  
  //console.log ("CRC OK!");
  }


  var expectedUnit = transaction.getUnit();

  if (actualUnit != expectedUnit)
  {
    return new errors.InvalidResponseDataError(util.format(
      "Invalid unit specified in the MODBUS response. Expected: %d, got: %d.",
      expectedUnit,
      actualUnit
    ));
  }

  return null;
};
