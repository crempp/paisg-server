var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();

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
    console.log("Initializing server...");

    server = net.createServer(function(c) { //'connection' listener
        console.log('  server connected');

        c.on('end', function() {
            console.log('  server disconnected');
        });

        c.write('hello\r\n');

        c.pipe(c);
    });

    next();
}

var runServer = function (next) {
    console.log("Starting server...");

    server.listen(config.server.port, function() { //'listening' listener
        console.log('  server bound to port ' + config.server.port);
    });

    next();
}


/**
 * Run the server boot-up
 */
console.log("Booting server...");
sequence.then(loadPlayers)
        .then(initServer)
        .then(runServer);

