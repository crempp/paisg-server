/**
 * Master game server
 *
 * This is the master game server responsible for
 *   - Client communication
 *   - Starting compute nodes
 *   - Compute node communication
 *   - Game state management
 *
 * TODO: Partition players between compute nodes
 *
 */

var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();
var cluster  = require("cluster");
var blessed  = require('blessed');
var usage    = require('usage');

var gui    = require('./gui');
var config = require('config');

/******************************************************************************
 * INITIALIZATION CODE
 ******************************************************************************/

/**
 * Load player data
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

        playerState = JSON.parse(data).players;

        gui.log("  loaded " + playerState.length + " players");

        next();
    });
};

/******************************************************************************
 * GUI CODE
 ******************************************************************************/

/**
 * Initialize GUI
 *
 * @param next
 */
var initGUI = function(next) {
    gui.initialize();
    next();
}

/******************************************************************************
 * COMPUTE NODE CODE
 ******************************************************************************/

/** Global list of player loaded in the server */
var playerState;

/**
 * Object to track the state of the compute workers
 *
 */
var computeState = {
    gcCycle : 0,

    nodeList : [],

    addNode : function (computeWorker) {
        this.nodeList.push({
            worker          : computeWorker,
            pid             : computeWorker.process.pid,
            gcCycle         : 0,
            cycleDelta      : 0,
            timeDelta       : 0,
            runCyclesPerSec : 0,
            cycleTime       : 0,
            cyclesBehind    : 0,
            msBehind        : 0,
            msAhead         : 0,
            cpu             : 0,
            prevCycle       : 0,
            prevTime        : new Date().getTime()
        });
        gui.addComputeServer({
            pid             : computeWorker.process.pid,
            gcCycle         : 0,
            cycleDelta      : 0,
            timeDelta       : 0,
            runCyclesPerSec : 0,
            cycleTime       : 0,
            cyclesBehind    : 0,
            msBehind        : 0,
            msAhead         : 0,
            cpu             : 0
        });
    },

    getNodeWithPid : function (pid) {
        for (var i = 0; i < this.nodeList.length; i++) {
            if (this.nodeList[i].pid === pid) {
                return this.nodeList[i]
            }
        }
        return false;
    },

    updateCycle : function (pid, cycleState) {
        var node = this.getNodeWithPid(pid);

        if (node) {
            usage.lookup(pid, { keepHistory: true }, function(err, result) {
                node.cpu = result.cpu;
            });
            usage.clearHistory(pid);

            var now             = new Date().getTime();
            var checkTimeDelta  = (now - node.prevTime) / 1000;
            var cycleDelta      = node.gcCycle - node.prevCycle;
            var runCyclesPerSec = cycleDelta / checkTimeDelta;

            node.prevCycle       = node.gcCycle;
            node.gcCycle         = cycleState.gcCycle;
            node.cycleDelta      = cycleDelta;
            node.timeDelta       = checkTimeDelta;
            node.runCyclesPerSec = runCyclesPerSec;
            node.cycleTime       = cycleState.cycleTime;
            node.cyclesBehind    = this.gcCycle - node.gcCycle;
            node.msBehind        = cycleState.msBehind;
            node.msAhead         = cycleState.msAhead;
            node.prevTime        = now;
            node.cycOverlap      = cycleState.cycOverlap;

            gui.updateComputeEntry(node);
        }
    },

    start : function () {
        var intervalTime = 1000/ config.compute.cyclespersec;
        setInterval(this.tick, intervalTime);
    },

    tick : function() {
        computeState.gcCycle++;

        for (var i = 0; i < computeState.nodeList.length; i++) {
            computeState.nodeList[i].gcCycle++;
            computeState.nodeList[i].worker.send({cmd: "tick", cycle: computeState.gcCycle});
        }
    }
}


/**
 * Start up compute node processes and start compute timer and monitor
 *
 * @param next
 */
var startComputeNodes = function (next) {
    gui.log("Starting compute nodes...");

    // Fork compute node processes
    for (var i = 0; i < config.compute.numnodes; i++) {
        cluster.setupMaster({
            exec: config.compute.cspath,
            silent : false
        });

        var computeWorker = cluster.fork();

        // Save worker
        computeState.addNode(computeWorker);

        // Setup process message handlers
        computeWorker.on('message', handleWorkerMessage);
    }

    // start computation
    computeState.start();

    // Start compute monitor
    var intervalId = setInterval(function(){
        for (var i = 0; i < computeState.nodeList.length; i++) {
            computeState.nodeList[i].worker.send({cmd: "cyclereq"});
        }
        gui.updateCycle(computeState.gcCycle);
    }, config.compute.monitorint);

};

/**
 * Handle messages sent from the compute workers
 *
 * @param msg
 */
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
            for (var i = 0; i < computeState.nodeList.length; i++) {
                computeState.nodeList[i].worker.send({cmd: "initdataresp", players: playerState});
            }
            break;
        case 'cycleresp':
            if ('object' !== typeof msg.cycleState) {
                gui.error("Worker cycleresp message has invalid cycle data");
                return;
            } else {
                // Update compute state
                computeState.updateCycle(msg.pid, msg.cycleState);
            }
            break;
        case 'cyclealert':
            gui.error(msg.desc);
            break;
        case 'state' :
            updatePlayerState(msg.data);
            break
        default:
            gui.error("Worker message has invalid command");
            return;
    }
}

/**
 * Merge computed player state from a worker node into global state
 *
 * @param data
 */
var updatePlayerState = function (data) {
    playerState = data;
}

/******************************************************************************
 * CLIENT SERVER CODE
 ******************************************************************************/

/** Global game server handle */
var gameServer;

/** Array of connected clients */
var connectedClients = [];

/**
 * Initialize game server
 *
 * @param next
 */
var initGameServer = function (next) {
    gui.log("Initializing master-server...");

    var options = {
        allowHalfOpen: config.server.port
    };

    // Start server
    gameServer = net.createServer(options, handleClientConnect);

    gameServer.listen(config.server.port, config.server.host, function() {
        gui.log('  server bound to port ' + config.server.port);
    });

    // Start client update interval
    var intervalId = setInterval(function(){
        for (var i = 0; i < connectedClients.length; i++) {
            connectedClients[i].write(JSON.stringify({cmd: "stateupdate", data: playerState}));
        }
    }, config.server.stateUpdateInterval);

    next();
};

/**
 * Remove a client from the connection pool
 *
 * @param connection
 */
var removeClient = function (connection) {
    for (var i = 0; i < connectedClients.length; i++) {
        if (connection === connectedClients[i]) {
            connectedClients.splice(i, 1);
        }
    }
}

/**
 * Handle game client connections
 *
 * @param connection
 */
var handleClientConnect = function (connection) {
    gui.log('client connected [' + connection.remoteAddress + ']');

    connectedClients.push(connection);

    connection.on('close', function() {
        gui.log('client disconnected, removing from pool.');
        removeClient(connection);
    });
    connection.on('end', function() {
        gui.log('client [' + connection.remoteAddress + '] end');
    })
    connection.on('timeout', function (had_error) {
        gui.log('client [' + connection.remoteAddress + '] timeout : had_error=' + had_error);
        gui.log('  timeout event');
    });
    connection.on('error', function (err) {
        if ('undefined' === typeof connection.remoteAddress) {
            gui.log('client disappeared, removing from pool.');
            removeClient(connection);
        } else {
            gui.log('unknown client error [' + connection.remoteAddress + '] : ' + err);
        }
    });
    connection.on('data', function (data) {
        gui.log('client [' + connection.remoteAddress + '] data');
        handleClientMessage(connection, data);

    });
}

var handleClientMessage = function (connection, msg) {
    var msgObj = JSON.parse(msg);

    if ('object' !== typeof msgObj) {
        gui.error("Client message is non-object");
        return;
    }

    if ('undefined' === typeof msgObj.cmd) {
        gui.error("Client message has no command");
        return;
    }

    switch (msgObj.cmd) {
        case 'load' :
            connection.write(JSON.stringify({cmd: "stateupdate", data: playerState}));
            break;
        case 'ready' :
            gui.log("client [" + connection.remoteAddress + "] is ready");
            break;
        default :
            gui.error("Client message has invalid command");
            return;
    }
};

/**
 * Run the server boot-up
 */
sequence.then(initGUI)
        .then(loadPlayers)
        .then(initGameServer)
        .then(startComputeNodes);

