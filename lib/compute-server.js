var fs           = require('fs');
var path         = require('path');
var vm           = require('vm');
var sequence     = require('sequence').create();
var forEachAsync = require('forEachAsync');

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
 *
 */
var playerState;

/**
 * Global compute cycle
 *
 * @type {number}
 */
var gcCycle = 0;

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
                console.log("Error: " + err);

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


var computeserver = {
    /**
     * Run the compute server boot-up
     */
    boot : function (callerNext, players) {
        console.log("Booting compute-server...");
        playerState = players;
        sequence.then(loadScripts)
                .then(function(next){
                    callerNext();
                });
    },

    runCycle : function () {
        //console.log("Running compute-server...");
        cycle();
    },

    getCycle : function () {
        return gcCycle;
    }
};



exports.computeserver = computeserver;