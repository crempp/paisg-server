var fs           = require('fs');
var path         = require('path');
var vm           = require('vm');
var sequence     = require('sequence').create();
var forEachAsync = require('forEachAsync');
var events       = require('events');

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
 * Flag indicating if the player data has been sent
 *
 * @type {boolean}
 */
var playerStateInitialized = false;

/**
 * Compute node cycle state.
 *
 *
 */
var cycleState = {
    gcCycle         : 0,   // Global compute cycle counter
    timeDelta       : 0,
    msPerCycle      : 0,
    cyclesBehind    : 0,
    msBehind        : 0,
    msAhead         : 0,
    cycleTime       : 0,   // Time it took to complete the most recent cycle
    cycOverlap      : false,
    prevTime        : null,
    running         : false
};

var _rotationRate = Math.PI/4;
var _period = 1000;


var _intervalTime = 1000 / config.compute.cyclespersec;
var _intervalTimeSeconds = _intervalTime / 1000;
var _thrustMultiplier = 2;

/**
 * Load all scripts, extract their ID and store them in the submodule store (smStore)
 *
 * @param next
 */
var loadScripts = function (next) {
    // Assemble path to submodule script directory
    var dir = __dirname + "/" + config.subroutines.testDir;

    var loadFileHandler = function (next, element) {
        // Assemble path to current submodule
        var srPath = path.normalize(dir + "/" + element);

        fs.readFile(srPath, 'utf8', function (err, data) {
            if (err) {
                // Just skip any errors
                next();
                return;
            }

            // Extract the id from the file
            var result = scriptIdRegEx.exec(data);
            if (result) {
                var smID = (result[1]).toLowerCase();

                // Pre-compile the script
                var compiledScript = vm.createScript(data);

                smStore[smID] = {
                    code     : data,
                    compiled : compiledScript
                };
                next();
            } else {
                // Just skip any errors
                next();
                return;
            }
        });
    };

    // Scan directory
    fs.readdir(dir, function(err, files){
        if (err) {
            next();
            return;
        }

        forEachAsync.forEachAsync(files, loadFileHandler)
                    .then(function(){
                        next();
                    });
    });
};

/**
 * Update the heading based on torque
 *
 * @param unit
 * @returns {number}
 * @private
 */
var _updateHeading = function (unit) {
    var rotation = unit.torque * _rotationRate * _intervalTimeSeconds / _period;
    var heading = unit.heading + rotation;

    return heading;
};

/**
 * Update the velocity based on thrust
 *
 * @param unit
 * @returns {{x: number, y: number}}
 * @private
 */
var _updateVelocity = function (unit) {
    var thrust = unit.thrust * _thrustMultiplier * _intervalTimeSeconds / _period;

    var mRotation = [
        [Math.cos(unit.heading), -1 * Math.sin(unit.heading)],
        [Math.sin(unit.heading), Math.cos(unit.heading)]
    ];

    var forward = {x: 0, y: -1};

    var mNormal = {
        x: forward.x * mRotation[0][0] + forward.y * mRotation[0][1],
        y: forward.x * mRotation[1][0] + forward.y * mRotation[1][1]
    };

    var x = unit.velocity.x + (thrust * mNormal.x);
    var y = unit.velocity.y + (thrust * mNormal.y);

    return {x: x, y: y};
};

var _updatePosition = function (unit) {
    var x = unit.position.x + unit.velocity.x;
    var y = unit.position.y + unit.velocity.y;
    return {x: x, y: y};
};

/**
 * The main compute loop
 */
var cycle = function () {
    if (playerStateInitialized) {

        // If a cycle is requested but one is already running then the compute
        // node is behind.
        // I don't know what to do in this situation. For the moment I send a
        // message to the master and skip the request.
        if (cycleState.running) {

            cycleState.cycOverlap = true;

            process.send({pid: process.pid,
                          cmd: "cyclealert",
                          desc: "Cycles are running behind by " + cycleState.msBehind + "ms"});
        } else {
            // Flag that we are running
            cycleState.running = true;

            // Reset the cycOverlap flag
            //   TODO: Change this to a smarter strategy where we try to squeeze an additional cycle in.
            cycleState.cycOverlap = false;

            var startTime = new Date().getTime();

            // Loop through players
            for (var i = 0; i < playerState.length; i++) {

                // Loop through units
                for (var j = 0; j < playerState[i].units.length; j++) {
                    //console.dir(playerState[i].units[j]);
                    var sandbox = {
                        data : {
                            type     : playerState[i].units[j].type,
                            thrust   : playerState[i].units[j].thrust,
                            torque   : playerState[i].units[j].torque,
                            heading  : playerState[i].units[j].heading,
                            position : playerState[i].units[j].position,
                            velocity : playerState[i].units[j].velocity,
                            cycle    : cycleState.gcCycle
                        }
                    };

                    try {
                        // TODO: Pre-compile scripts at load time
                        var compiled = smStore[playerState[i].units[j].module].compiled;

                        compiled.runInNewContext(sandbox);
                    } catch (e) {
                        //console.log("SCRIPT ERROR [" + playerState[i].units[j].module + "]: " + e.message)
                        // TODO: Send error to master and mark script as invalid
                    }

                    // TODO: validate return values
                    playerState[i].units[j].thrust  = sandbox.data.thrust;
                    playerState[i].units[j].torque  = sandbox.data.torque;

                    playerState[i].units[j].heading  = _updateHeading(playerState[i].units[j]);
                    playerState[i].units[j].velocity = _updateVelocity(playerState[i].units[j]);
                    playerState[i].units[j].position = _updatePosition(playerState[i].units[j]);
                }
            }

            var stopTime         = new Date().getTime();
            cycleState.cycleTime = stopTime - startTime;
            cycleState.msBehind  = Math.max(cycleState.cycleTime - _intervalTime, 0);
            cycleState.msAhead   = Math.max(_intervalTime - cycleState.cycleTime, 0);

            // Flag that we are done
            cycleState.running = false;
        }

        cycleState.gcCycle++;
    }

    var now = (stopTime) ? stopTime : new Date().getTime();
    cycleState.timeDelta       = now - cycleState.prevTime;
    cycleState.prevTime        = now;

    process.send({pid: process.pid, cmd: "state", data: playerState});
};

var onMessage = function (msg) {
    if ('object' !== typeof msg) {
        return;
    }
    if ('undefined' === typeof msg.cmd) {
        return;
    }

    switch (msg.cmd) {
        case 'initdataresp':
            if ('object' !== typeof msg.players) {
                return;
            } else {
                playerState = msg.players;
                playerStateInitialized = true;
            }
            break;
        case 'cyclereq':
            process.send({pid: process.pid, cmd: "cycleresp", cycleState: cycleState});
            break;
        case 'tick':
            cycle();
            break;
        default:
            return;
    }
}

var computeserver = {
    /**
     * Run the compute server boot-up
     */
    boot : function (next) {
        // Setup master message handler
        process.on('message', onMessage);

        // Ask the master for initialization data
        process.send({pid: process.pid, cmd: "initdata"})

        // Start the cycle loop
        cycleState.msPerCycle = (1 / config.compute.cyclespersec) * 1000;
        cycle();

        next();
    },

    run : function (next) {
        eventEmitter.emit('cycle');
        next();
    },
};

/**
 * Startup
 */
sequence.then(loadScripts)
        .then(computeserver.boot)
        .then(computeserver.run);