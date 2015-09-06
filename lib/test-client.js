var fs       = require('fs');
var file     = __dirname + '/StubData.json';
var net      = require('net');
var sequence = require('sequence').create();

var config   = require('config');

/** Global client handle */
var client;

var isLoaded = false;

var gameState;

var handleServerMessage = function (msg) {
    var msgObj = JSON.parse(msg.toString());

    //console.log(msg.toString());
    //console.log("INSPECTING");
    //console.dir(msgObj)

    console.log("received message", msgObj);

    if ('object' !== typeof msgObj) {
        gui.error("Server message is non-object");
        return;
    }
    if ('undefined' === typeof msgObj.cmd) {
        gui.error("Server message has no command");
        return;
    }

    switch (msgObj.cmd) {
        case 'stateupdate' :
            //console.dir(msgObj.data.units);
            if (! isLoaded) {
                gameState = msgObj.data;
                client.write(JSON.stringify({cmd: "ready", data: null}));
                isLoaded = true;
            } else {
                gameState = msgObj.data;
                update();
            }

            break;
        default :
            gui.error("Client message has invalid command");
            return;
    }
};

var update = function() {
    for (var i = 0; i < gameState.length; i++) {
        console.log("PLAYER: " + gameState[i].name);
        for (var j = 0; j < gameState[i].units.length; j++) {
            //console.log("  unit [" + gameState[i].units[j].name + "] thrust = " + gameState[i].units[j].thrust + ", heading = " + gameState[i].units[j].heading);

//            console.log("  unit [" + gameState[i].units[j].name + "] position = (" +
//                                    gameState[i].units[j].position.x + "," +
//                                    gameState[i].units[j].position.y + ")" +
//                        ", heading = " + gameState[i].units[j].heading);

            console.dir(gameState[i].units[j]);
        }
    }
}

var connectToServer = function (next) {
    console.log("Initializing client...");

    client = net.connect({port: config.server.port},
        function() {
            console.log('client connected');
        });

    client.on('data', handleServerMessage);

    client.on('end', function() {
        console.log('client disconnected [end]');
    });

    next();
};
//
//var loadData = function () {
//
//};

process.on( 'SIGINT', function() {
    client.emit('disconnect');
    process.exit( );
})

/**
 * Run the client
 */
console.log("Booting client...");
sequence.then(connectToServer);

