var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();
var cluster  = require("cluster");
var clusterMaster = require("cluster-master");


//var computeserver = require('./compute-server').computeserver;

var config   = require('config');


/** Global list of player loaded in the server */
var players;

/** Global server handle */
var server;

var computeWorker;

var monitorState = {
    prevCycle: 0,
    prevTime : new Date().getTime()
}

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

var runServer = function (next) {
    console.log("Opening connection for master-server...");

    console.log("Running master-server...");
    server.listen(config.server.port, config.server.host, function() { //'listening' listener
        console.log('  server bound to port ' + config.server.port);
    });

    next();
}

var handleWorkerMessage = function (msg) {
    if ('object' !== typeof msg) {
        console.error("Worker message is non-object");
        return;
    }
    if ('undefined' === typeof msg.cmd) {
        console.error("Worker message has no command");
        return;
    }

    switch (msg.cmd) {
        case 'initdata':
            computeWorker.send({cmd: "initdataresp", players: players});
            break;
        case 'cycleresp':
            if ('number' !== typeof msg.cycle) {
                console.error("Worker cycleresp message has invalid cycle data");
                return;
            } else {
                var now        = new Date().getTime();
                var cycleDelta = msg.cycle - monitorState.prevCycle;
                var timeDelta  = (now - monitorState.prevTime) / 1000;
                var cyclesPerSec = cycleDelta / timeDelta;

                monitorState.prevCycle = msg.cycle;
                monitorState.prevTime  = now;

                console.log("  Compute Monitor: cycleDelta   = " + cycleDelta);
                console.log("                 : timeDelta    = " + timeDelta);
                console.log("                 : cyclesPerSec = " + cyclesPerSec);
            }
            break;
        default:
            console.error("Worker message has invalid command");
            return;
    }
}

var startComputeNodes = function (next) {
    console.log("Starting compute nodes...");

    cluster.setupMaster({
        exec: config.compute.cspath,
        silent : false,

    });

    computeWorker = cluster.fork();

    // Setup process message handlers
    computeWorker.on('message', handleWorkerMessage);

    // Start compute monitor
    var intervalId = setInterval(function(){
        computeWorker.send({cmd: "cyclereq"});
    }, config.compute.monitorint);

}


/**
 * Run the server boot-up
 */
console.log("Booting master-server...");
sequence.then(loadPlayers)
        .then(initServer)
        //.then(initComputeServer)
        .then(runServer)
        .then(startComputeNodes);

