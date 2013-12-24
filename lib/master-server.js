var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();
var cluster  = require("cluster");
var blessed  = require('blessed');

var gui = require('./gui');

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
//var computeWorker;

/**
 * Object to track the state of the compute workers
 *
 *
 *
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
            //msPerCycle      : 0,
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
            //msPerCycle      : 0,
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
    },

    updateCycle : function (pid, cycleState) {
        var node = this.getNodeWithPid(pid);

        //console.log(node);

        if (node) {
            var cpu = 0;

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
            node.cyclesBehind    = cycleState.cyclesBehind;
            node.msBehind        = cycleState.msBehind;
            node.msAhead         = cycleState.msAhead;
            node.cpu             = cpu;
            node.prevTime        = now;
            node.isBehind        = now;

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
            computeState.nodeList[i].worker.send({cmd: "tick", cycle: computeState.gcCycle});
        }
    }
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
            for (var i = 0; i < computeState.nodeList.length; i++) {
                computeState.nodeList[i].worker.send({cmd: "initdataresp", players: players});
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
        default:
            gui.error("Worker message has invalid command");
            return;
    }
}

var startComputeNodes = function (next) {
    gui.log("Starting compute nodes...");

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

        // start computation
        computeState.start();
    }

    // Start compute monitor
    var intervalId = setInterval(function(){
        for (var i = 0; i < computeState.nodeList.length; i++) {
            computeState.nodeList[i].worker.send({cmd: "cyclereq"});
        }
        gui.updateCycle(computeState.gcCycle);
    }, config.compute.monitorint);

};

var initGUI = function(next) {
    gui.initialize();
    next();
}


/**
 * Run the server boot-up
 */
sequence.then(initGUI)
        .then(loadPlayers)
        .then(initServer)
        .then(runServer)
        .then(startComputeNodes);

