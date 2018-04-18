# cs-modbus

A command line utility implementing a Modbus TCP/ASCII/RTU master for node.js.
This module is based on h5.modbus.

## Prerequisites
Install nodejs for your platform (http://nodejs.org)
This will make the `node` and `npm` executables available.

## Installing the utility
From a terminal window, use the command
`npm install -g cs-modbus`

The utility is now available as a terminal command.  To see the available options, use
`mb -h`.
You can list the available serial ports on your system by using the 
`mb -l` command.

## Configuration 
Configuration (for example, how the programs communicate with the target devices) can be controlled in multiple ways.  These are listed in order of priority (command line options have precedence over environment variables have precedence over the config file).

### Command line options
Options can be specified in the terminal when executing the utility.  For available options, see `mb -h'.  For example:
`mb read slave --port=COM1`
Reads the attached slave id using serial port COM1

### Environment variables
Using environment variables allows you to set the configuration in each terminal window, so it does not have to be specified on each command.  The method to set environment variables depends on your operating system.  For example, on Windows you can use
`set MODBUS_PORT=COM1`
On Mac or Linux, you can use
`export MODBUS_PORT=/dev/cu.usbserial`

See `mb -h` for the available environment variables

### Configuration file
If neither the command line option nor environment variable is specified, the configuration stored in a local file is used (it is called config.json, in the installation folder).
Rather than editing this file directly, you can use the --save command line option, which will save the actual configuration to the config.json file.  For example,
`mb --port=COM2 --save`

Will save COM2 as the default serial port.

## Command examples
Refer to `mb -h` for a full list of commands.  Some examples to get you started:

## Format of the config file
For advanced configuration options, you can edit the config.json file directly.
It must be a properly-formatted JSON file:
```JSON
{
  "port" : {
    "name" : "COM1",
    "options" : {
      "baudrate": 19200,
      "rts": false,
      "dtr" : false
    }
  },
  "master" : {
      "transport": {
        "type": "RTU",
        "slaveId" : 127,
        "connection": {
            "type": "serial",
            "serialPort": null
          }
        },
      "suppressTransactionErrors": true,
      "retryOnException": false,
      "maxConcurrentRequests": 1,
      "defaultUnit": 1,
      "defaultMaxRetries": 1,
      "defaultTimeout": 1000
  }

}
```

The "port" object is used to configure a serial port connection.  It has the following settings:
* _name_ the operating system name for the hardware serial port.  To find the available ports, check your operating system device manager, or use the `node examples/ports.js` example program to list available ports.
* _options_ control how the port operates, and are taken from the options offered by the [nodejs serialport module](https://github.com/voodootikigod/node-serialport):
  - _baudrate:_ defaults to 9600. Should be one of: 115200, 57600, 38400, 19200, 9600, 4800, 2400, 1800, 1200, 600, 300, 200, 150, 134, 110, 75, or 50. Custom rates as allowed by hardware is supported.
- _dataBits:_ Data Bits, defaults to 8. Must be one of: 8, 7, 6, or 5.
- _stopBits:_ Stop Bits, defaults to 1. Must be one of: 1 or 2.
- _parity:_ Parity, defaults to 'none'. Must be one of: 'none', 'even', 'mark', 'odd', 'space'

The "websocket" object controls the behavior of a "websocket" type connection.  It has the following settings:
- _url_ the websocket URL to connect
- _reconnection_ whether to reconnect automatically (true)
- _reconnectionAttempts_ (Infinity) before giving up
- _reconnectionDelay_ how long to initially wait before attempting a new reconnection (1000). Affected by +/- randomizationFactor, for example the default initial delay will be between 500 to 1500ms.
- _reconnectionDelayMax_ maximum amount of time to wait between reconnections (5000). Each attempt increases the reconnection delay by 2x along with a randomization as above
randomizationFactor (0.5), 0 <= randomizationFactor <= 1
- _timeout_ connection timeout before a connect_error and connect_timeout events are emitted (20000)

The "master" object controls the behavior of the MODBUS master.  It has the following options:
* _transport:_ Determines how messages will be framed and encoded for transport over the connection.  _rtu_ for (standard) MODBUS RTU, _ascii_ for (standard) MODBUS ASCII, _ip_ for (standard) MODBUS TCP/IP, and _tunnel_ for (Control Solutions proprietary) tunneling of MODBUS commands over an RTU-based network.  Using _tunnel_ allows cs-modbus to act like a master, even as it participates on the physical network as a slave.  This setting requires the 'real' MODBUS master to implement SLAVE_COMMAND polling, as defined in CS document *DOC0003824A-SRS-A*
** _slaveId_ is only used for the _tunnel_ transport; it defines the slave address that cs-modbus will monitor for SLAVE_COMMAND messages.
** _eofTimeout:_ the timeout in milliseconds used to detect the end-of-frame in RTU and tunnel connections.  These transports do not have an explicit end of message indicator; it is provided by measuring idle time on the bus.  This value should be at least 3.5 character times, at the chosen baud rate.  For example, at 19200 this value should be about 20.
** _connection_ defines the physical connection that will be used to communicate with the MODBUS network.
  *** _type:_ The types of supported connections are: _tcp_, _udp_, _serial_.
  *** _serialPort:_ (required for _serial_ connections).  Set to an instance of the node-serialport module. 
  *** TCP and UDP connections require additional parameters that are not detailed here; refer to lib/connnections/TcpConnection.js and lib/connections/UdpConnection.js for additional details.  

* _suppressTransactionErrors:_ (boolean)  determines whether errors detected at the transaction level will throw exceptions (which must be caught by the application code) or not.
* _retryOnException:_ (boolean) determines whether the master will retry the message if the slave returns an exception code, or simply fail the message.
* _maxConcurrentRequests:_ (integer) determines how many transactions may be attempted simultaneously.  This should be '1' for serial connections using RTU or ASCII transport.  A value of '2' provides an efficiency boost for TUNNEL transport over serial.  TCP and UDP connections can support a higher number of simultaneous transactions.  Note: the application may submit multiple requests to the master without concern for this maximum; additional requests will simply be queued until the connection is able to accept them.
* _defaultUnit:_ (integer): the default MODBUS unit identifier to transmit messages to. Can be overridden on a message-by-message basis.
* _defaultMaxRetries:_ (integer) the number of times to retry an unsuccessful transaction before failing it.  Can be overridden on a message-by-message basis
* _defaultTimeout:_ (integer) the number of milliseconds to wait for a response from the slave. This can be tweaked to maximize performance of a given system depending on the connection speed, etc.  Can be overridden on a message-by-message basis.

### mb Utility
The mb utility allows simple MODBUS interactions with an attached slave.  After configuring the connection, run the mb utility.
`node mb -h` shows the available command line options
`node mb read holding 0 3` reads three registers starting at address 0 
`node mb read holding 0 3 -v` reads the same three registers and outputs verbose diagnostic information, including the exact bytes transmitted and received over the link. 

If the cs-modbus package is installed 'globally':
`npm install csllc/cs-modbus.git -g`
the `mb` utility will be available at any terminal prompt, regardless of folder.  In this case, it is simplest to use the environment variable configurations rather than edit the config.json file.  For example:
`set MODBUS_PORT=COM1`
`set MODBUS_SLAVE=10`
`set MODBUS_BAUD=19200`
_(notice 'set' is used on Windows platforms, 'export' is the Mac equivalent)_

## Using cs-modbus to build an application

Create a new folder and navigate there in a command prompt.

Add the MODBUS module to your nodejs project
`npm install csllc/cs-modbus.git`

If you intend to use a serial-port based MODBUS connection, you need
`npm install serialport`

### Basic Use
Create a new file (demo.js) in your project folder and insert the following into it:

```
// Include the module
var modbus = require('cs-modbus');

// Include the serial port handler, and open /dev/ttyAMA0
// (replace the port name with an appropriate one for your
// system)
var SerialPort = require('serialport').SerialPort;
var serialPort = new SerialPort('/dev/ttyAMA0', {
  baudRate: 9600
});

// Configure the master
// In this case we set up for MODBUS-RTU over the serial port
// we just declared.
var master = modbus.createMaster({
  transport: {
    type: 'rtu',
    connection: {
      type: 'serial',
      serialPort: serialPort
    }
  },
});

// When the master is initialized..
master.once('connected', function()
{
  // Read a set of discrete inputs from the slave device with address 1
  // (the parameters of this command will depend on what
  // kind of slave you are connected to)
  var t1 = master.readDiscreteInputs(0x0000, 8, {
    unit: 1
  });

    // The following hooks the transaction complete event, and prints out the result
  t1.on('complete', function(err, response)
  {
    if (err)
    {
      console.error('[Error] %s', err.message);
    }
    else
    {
      console.log(response);
    }
  });
});

```


[The examples](example) or utility programs may be helpful in understanding how to interface to the library.

In order to run the examples, refer to the configuration instructions above (eg config.json)

[Ports](example/ports.js) lists all of the serial ports present on the system - which may help identify the correct port to use for the connection.

[Inspect USB](example/inspect-usb.js) is a straightforward approach to opening a serial port connection and querying the device's ID information (ReportSlaveId message).  The various events are hooked to show the progression of a typical message.

## Development
Clone or fork the repository, and edit the files to make the necessary changes.

Units tests are provided and should be updated for any code changes:
`npm test`

The tests include linting the code with JSHINT, running all unit tests, and producing test coverage reports.

### Style
The module does not at this point use a consistent code style; please follow the convention in the file you are editing, and/or the style as enforced by JSHINT.

### Test Coverage
`npm test` includes generation of code coverage reports.  To view them, review the build/coverage/lcov-report/index.html file.

## License

This project is released under the
[MIT License](https://raw.github.com/csllc/cs-modbus/master/license.md).
