var fs           = require('fs');
var path         = require('path');
var vm           = require('vm');
var sequence     = require('sequence').create();
var forEachAsync = require('forEachAsync');
//var cluster      = require('cluster');

var events = require('events');
var eventEmitter = new events.EventEmitter();

var config   = require('config');

/**
 * Submodule script storage
 *
 * @type {{}}
 */
var smStore = {};

/**
 * Regular expression to match ID tags in scripts.
 *
 * @type {RegExp}
 */
var scriptIdRegEx = /\/\*\s*@\s*([a-fA-F0-9]{32})\s*\*\//;

/**
 * Player state
 *
 * This is originally sent from the master server and then syncronized
 * after the compute cycle begins
 */
var playerState;

/**
 * Global compute cycle couter
 *
 * @type {number}
 */
var gcCycle = 0;


/**
 * Flag indicating if the player data has been sent
 *
 * @type {boolean}
 */
var playerStateInitialized = false;


var cycleState = {
    msPerCycle: 0,
    prevTime : null
}

/**
 * Load all scripts, extract their ID and store them in the submodule store (smStore)
 *
 * @param next
 */
var loadScripts = function (next) {
    console.log("Loading submodule scripts...");

    // Assemble path to submodule script directory
    var dir = __dirname + "/" + config.subroutines.testDir;

    var loadedFileCount = 0;

    var loadFileHandler = function (next, element, index, array) {
        console.log("  loading subroutine - " + element);

        // Assemble path to current submodule
        var srPath = path.normalize(dir + "/" + element);

        console.log("    file : " + srPath);

        fs.readFile(srPath, 'utf8', function (err, data) {
            if (err) {
                ccycleState.prevTimeonsole.log("Error: " + err);

                // Continue
                next();

                return;
            }

            // Extract the id from the file
            var result = scriptIdRegEx.exec(data);
            if (result) {
                var smID = (result[1]).toLowerCase();
                console.log("    id : " + smID);

                // Save script
                smStore[smID] = data;

                // Continue
                next();
            } else {
                console.log("Error: No ID specified in script or invalid format");

                // Continue
                next();

                return;
            }
        });
    };

    // Scan directory
    fs.readdir(dir, function(err, files){

        if (err) {
            console.log(err);
        }

        forEachAsync.forEachAsync(files, loadFileHandler).then(function(){
            next();
        });
    });
};

var cycle = function () {
    if (playerStateInitialized) {
        // Loop through players
        for (var i = 0; i < playerState.length; i++) {

            // Loop through units
            for (var j = 0; j < playerState[i].units.length; j++) {
                var sandbox = {
                    data : {
                        type    : playerState[i].units[j].type,
                        thrust  : playerState[i].units[j].thrust,
                        heading : playerState[i].units[j].heading,
                        cycle   : gcCycle
                    }
                };

                try {
                    vm.runInNewContext(smStore[playerState[i].units[j].module], sandbox);
                } catch (e) {
                    console.log("SCRIPT ERROR [" + playerState[i].units[j].module + "]: " + e.message)
                }

                // TODO: validate return values

                playerState[i].units[j].thrust  = sandbox.data.thrust;
                playerState[i].units[j].heading = sandbox.data.heading;

                //console.log(playerState[i].units[j]);
            }
        }

        gcCycle++;
    }


    var now = new Date().getTime();
    var timeDelta = now - cycleState.prevTime;

    console.log("  msPerCycle = " + cycleState.msPerCycle);
    console.log("  timedelta  = " + timeDelta);

    if (null !== cycleState.prevTime && timeDelta > cycleState.msPerCycle) {
        process.send({cmd: "cyclealert", desc: "Cycles are running behind by " + (timeDelta - cycleState.msPerCycle)}) + "ms";
    }
    //var wait = cycleState.msPerCycle - ( now - cycleState.prevTime );
    var wait = (cycleState.msPerCycle - timeDelta);
    cycleState.prevTime = now;

    if (wait > 0) {
        console.log("waiting for " + wait);
        setTimeout(cycle, wait);
    } else {
        setImmediate(cycle);
    }
    //setImmediate(cycle);
};

var onMessage = function (msg) {
    if ('object' !== typeof msg) {
        console.error("Master message is non-object");
        return;
    }
    if ('undefined' === typeof msg.cmd) {
        console.error("Master message has no command");
        return;
    }

    switch (msg.cmd) {
        case 'initdataresp':
            if ('object' !== typeof msg.players) {
                console.error("Master initdataresp message has invalid player object");
                return;
            } else {
                playerState = msg.players;
                playerStateInitialized = true;
            }
            break;
        case 'cyclereq':
            process.send({cmd: "cycleresp", cycle: gcCycle})
            break;
        default:
            console.error("Master message has invalid command");
            return;
    }
}


var computeserver = {
    /**var timePerCycle = config.compute.cps
     * Run the compute server boot-up
     */
    boot : function (next) {
        console.log("Booting compute-server...");

        // Setup master message handler
        process.on('message', onMessage);

        // Ask the master for initialization data
        process.send({cmd: "initdata"})

        // Start the cycle loop
        cycleState.msPerCycle = (1 / config.compute.cps) * 1000;
        cycle();

        next();
    },

    run : function (next) {
        console.log("Running compute-server...");

        eventEmitter.emit('cycle');
        /*
        while (true) {
            cycle();
        }
        */

        next();
    },

    getCycle : function () {
        return gcCycle;
    }
};

//console.log("players = " + process.env.players.length);
//console.dir(process.env.players);

sequence.then(loadScripts)
        .then(computeserver.boot)
        .then(computeserver.run);