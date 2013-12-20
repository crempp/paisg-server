var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();

var computeserver = require('./compute-server').computeserver;

var config   = require('config');


/** Global list of player loaded in the server */
var players;

/** Global server handle */
var server;

/**
 *
 * @param next
 */
var loadPlayers = function (next) {
    console.log("Loading players...");
    fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
            console.log('Error: ' + err);
            return;
        }

        players = JSON.parse(data).players;

        console.log("  loaded " + players.length + " players");

        next();
    });
}

var initServer = function (next) {
    console.log("Initializing master-server...");

    var options = {
        allowHalfOpen: config.server.port
    }

    server = net.createServer(options, function(c) { //'connection' listener
        console.log('  server connected');

        c.on('end', function() {
            console.log('  server disconnected');
        });

        c.write('hello\r\n');

        c.pipe(c);
    });

    next();
}

var initComputeServer = function (next) {
    computeserver.boot(next, players);
}

var runServer = function (next) {
    console.log("Opening connection for master-server...");

    console.log("Running master-server...");
    server.listen(config.server.port, config.server.host, function() { //'listening' listener
        console.log('  server bound to port ' + config.server.port);
    });

    next();
}

var startCycles = function (next) {

        // Compute monitor
    var prevCheckCycle = 0;
    var interval = 1000;
    var intervalId = setInterval(function(){
        console.log(computeserver.getCycle());
    }, interval);

    // Main compute loop
    while (true) {
        computeserver.runCycle();
    }

}


/**
 * Run the server boot-up
 */
console.log("Booting master-server...");
sequence.then(loadPlayers)
        .then(initServer)
        .then(initComputeServer)
        .then(runServer)
        .then(startCycles);

