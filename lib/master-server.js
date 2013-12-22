var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();
var cluster  = require("cluster");
var blessed  = require('blessed');

var config   = require('config');


/** Global list of player loaded in the server */
var players;

/** Global server handle */
var server;

/**
 * Handle on the compute worker
 *
 * TODO: Merge this into monitorState
 */
var computeWorker;

/**
 * Object to track the state of the compute workers
 *
 * TODO: Change to computeState, merge worker handles into an array.
 *
 * @type {{prevCycle: number, prevTime: number}}
 */
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

                console.log("  Compute Monitor: currCycle    = " + cycleDelta);
                console.log("                 : cycleDelta   = " + msg.cycle);
                console.log("                 : timeDelta    = " + timeDelta);
                console.log("                 : cyclesPerSec = " + cyclesPerSec);
            }
            break;
        case 'cyclealert':
            console.error(msg.desc);
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

var drawScreen = function(next) {
    // Create a screen object.
    var screen = blessed.screen();

    // Create a box perfectly centered horizontally and vertically.
    var box = blessed.box({
        top: 'center',
        left: 'center',
        width: '50%',
        height: '50%',
        content: 'Hello {bold}world{/bold}!',
        tags: true,
        border: {
            type: 'line'
        },
        style: {
            fg: 'white',
            bg: 'magenta',
            border: {
                fg: '#ffffff'
            },
            hover: {
                bg: 'green'
            }
        }
    });

    // Append our box to the screen.
    screen.append(box);

    screen.key(['escape', 'q', 'C-c'], function(ch, key) {
        return process.exit(0);
    });

// Focus our element.
    box.focus();

// Render the screen.
    screen.render();
}


/**
 * Run the server boot-up
 */
console.log("Booting master-server...");
sequence.then(drawScreen);
//        .then(loadPlayers)
//        .then(initServer)
//        .then(runServer)
//        .then(startComputeNodes);

