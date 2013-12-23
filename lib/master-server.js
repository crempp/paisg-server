var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();
var cluster  = require("cluster");
var clusterMaster = require("cluster-master");


var gui = require('./gui');

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
    gui.log("Loading players...");
    fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
            gui.log('Error: ' + err);
            return;
        }

        players = JSON.parse(data).players;

        gui.log("  loaded " + players.length + " players");

        next();
    });
}

var initServer = function (next) {
    gui.log("Initializing master-server...");

    var options = {
        allowHalfOpen: config.server.port
    }

    server = net.createServer(options, function(c) { //'connection' listener
        gui.log('  server connected');

        c.on('end', function() {
            gui.log('  server disconnected');
        });

        c.write('hello\r\n');

        c.pipe(c);
    });



    next();
}

var runServer = function (next) {
    gui.log("Opening connection for master-server...");

    gui.log("Running master-server...");
    server.listen(config.server.port, config.server.host, function() { //'listening' listener
        gui.log('  server bound to port ' + config.server.port);
    });

    next();
}

var handleWorkerMessage = function (msg) {
    if ('object' !== typeof msg) {
        gui.error("Worker message is non-object");
        return;
    }
    if ('undefined' === typeof msg.cmd) {
        gui.error("Worker message has no command");
        return;
    }

    switch (msg.cmd) {
        case 'initdata':
            computeWorker.send({cmd: "initdataresp", players: players});
            break;
        case 'cycleresp':
            if ('number' !== typeof msg.cycle) {
                gui.error("Worker cycleresp message has invalid cycle data");
                return;
            } else {
                var now        = new Date().getTime();
                var cycleDelta = msg.cycle - monitorState.prevCycle;
                var timeDelta  = (now - monitorState.prevTime) / 1000;
                var cyclesPerSec = cycleDelta / timeDelta;

                monitorState.prevCycle = msg.cycle;
                monitorState.prevTime  = now;

                gui.updateComputeEntry(
                    {
                        pid          : computeWorker.process.pid,
                        cycleDelta   : cycleDelta,
                        cyclesPerSec : cyclesPerSec,
                        cyclesBehind : 0,
                        cpu          : 0
                    }
                )
            }
            break;
        default:
            gui.error("Worker message has invalid command");
            return;
    }
}

var startComputeNodes = function (next) {
    gui.log("Starting compute nodes...");

    cluster.setupMaster({
        exec: config.compute.cspath,
        silent : false,

    });

    computeWorker = cluster.fork();

    // Setup process message handlers
    computeWorker.on('message', handleWorkerMessage);

    gui.addComputeServer({
        pid          : computeWorker.process.pid,
        cycleDelta   : 0,
        cyclesPerSec : 0,
        cyclesBehind : 0,
        cpu          : 0
    });

    // Start compute monitor
    var intervalId = setInterval(function(){
        computeWorker.send({cmd: "cyclereq"});
    }, config.compute.monitorint);

};

var initGUI = function(next) {
    gui.initialize();
    next();
}

/**
 * Run the server boot-up
 */
//gui.log("Booting master-server...");
sequence.then(initGUI)
        .then(loadPlayers)
        .then(initServer)
        //.then(initComputeServer)
        .then(runServer)
        .then(startComputeNodes);

