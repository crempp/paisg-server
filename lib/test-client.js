var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();

var config   = require('config');

/** Global client handle */
var client;



var connectToServer = function (next) {
    console.log("Initializing client...");

    var client = net.connect({port: config.server.port},
        function() { //'connect' listener
            console.log('client connected');
            client.write('world!\r\n');
        });

    client.on('data', function(data) {
        console.log(data.toString());
        client.end();
    });

    client.on('end', function() {
        console.log('client disconnected');
    });

    next();
}

/**
 * Run the client
 */
console.log("Booting client...");
sequence.then(connectToServer);

