var blessed = require('blessed');
var os      = require("os");
var osutils = require('os-utils');
var util    = require('./util');
var config  = require('config');

// Create a screen object.
var screen = blessed.screen();

// Global everything for the moment
var titleBox, titleCycleBox, titleCPUBox, titleMSPCBox, computeBox, logBox;

var drawScreen = function () {
    // Title box
    titleBox = blessed.box({
        top     : '0$',
        left    : '0%',
        width   : '100%',
        height  : 'shrink',
        content : 'PAISG Server',
        tags    : true,
        border  : {
            type: 'line',
            bg: 'lightblack'
        },
        style: {
            fg: 'cyan',
            bg: 'lightblack',
            border: {
                fg: 'white',
                bg: 'lightblack'
            },
            hover: {
                //bg: 'green'
            }
        }
    })
    titleCPUBox = blessed.box({
        top     : 1,
        right   : 2,
        width   : 10,
        height  : 'shrink',
        content : 'CPU: ',
        style: {
            fg: 'white',
            bg: 'lightblue'
        }
    });
    titleCycleBox = blessed.box({
        top     : 1,
        right   : 13,
        width   : 15,
        height  : 'shrink',
        content : 'gcCyc: ',
        style: {
            fg: 'white',
            bg: 'lightblue'
        }
    });
    titleMSPCBox = blessed.box({
        top     : 1,
        right   : 29,
        width   : 12,
        height  : 'shrink',
        content : 'mspc: ' + (1000 / config.compute.cyclespersec).toFixed(1).toString(),
        style: {
            fg: 'white',
            bg: 'lightblue'
        }
    });
    logBox = blessed.List({
        bottom  : 0,
        left    : 0,
        width   : "100%",
        height  : "40%",
        label   : "Log",
        tags    : true,
        //content : '',
        selectedFg : "white",
        selectedBg : "lightblack",
        border  : {
            type: 'line',
            bg: 'lightblack'
        },
        style: {
            fg: 'white',
            bg: 'lightblack',
            border: {
                fg: 'white',
                bg: 'lightblack'
            },
            hover: {
                //bg: 'green'
            },
            label : {
                fg: 'cyan',
                bg: 'lightblack'
            }
        }
    });
    computeBox = blessed.List({
        top     : 3,
        left    : 0,
        width   : "100%",
        //shrink  : "grow",
        height  : "40%",
        label   : "Compute processes",
        tags    : true,
        border  : {
            type: 'line',
            bg: 'lightblack'
        },
        style: {
            fg: 'white',
            bg: 'lightblack',
            border: {
                fg: 'white',
                bg: 'lightblack'
            },
            hover: {
                //bg: 'green'
            },
            focus: {
                fg: 'white',
                bg: 'lightblack'
            },
            label : {
                fg: 'cyan',
                bg: 'lightblack'
            }
        }
    });

    computeBox.add('{green-fg}{black-bg}{bold}' +
                    util.pad("pid",      6,  " ", util.STR_PAD_RIGHT) +
                    util.pad("gcCycle",  10, " ", util.STR_PAD_RIGHT) +
                    util.pad("cycleDel", 10, " ", util.STR_PAD_RIGHT) +
                    util.pad("timeDel",  10, " ", util.STR_PAD_RIGHT) +
                    util.pad("rcps",     10, " ", util.STR_PAD_RIGHT) +
                    util.pad("cycTime",  10, " ", util.STR_PAD_RIGHT) +
                    util.pad("cyclesB",  10, " ", util.STR_PAD_RIGHT) +
                    util.pad("msBehind", 10, " ", util.STR_PAD_RIGHT) +
                    util.pad("msAhead",  10, " ", util.STR_PAD_RIGHT) +
                    util.pad("cycOver",  10, " ", util.STR_PAD_RIGHT) +
                    util.pad("cpu",      10, " ", util.STR_PAD_RIGHT) +
                    '{/bold}{/black-bg}{/green-fg}');
    computeBox.down(1);

    titleBox.append(titleCPUBox);
    titleBox.append(titleCycleBox);
    titleBox.append(titleMSPCBox);

    // Append our box to the screen.
    screen.append(titleBox);
    screen.append(logBox);
    screen.append(computeBox);
}

/**
 *
 * @param gcCycle
 */
var updateCycle = function(gcCycle) {
    titleCycleBox.setContent('gcCyc: ' + gcCycle);
}

/**
 *
 * @param pct
 */
var updateCPU = function(pct) {
    titleCPUBox.setContent('CPU: ' + pct + '%');
}



/**
 *
 * @param msg
 * @param type
 */
var log = function(/**String*/ msg, /**String=*/ type) {
    if ('undefined' === typeof type) type = 'log';

    var textColor = 'white';

    // Type
    switch (type) {
        case 'log'  : textColor = 'white'; break;
        case 'error': textColor = 'red'; break;
        case 'info' : textColor = 'blue'; break;
    }

    // Date
    var d = new Date();
    var time = (d.getMonth() + 1) + "/" + d.getDate() + " " + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
    logBox.add("{green-fg}[" + time + "]{/} {" + textColor + "-fg}" + msg + "{/}");
    logBox.down(1);
}

/**
 *
 * @param msg
 */
var error = function(msg) {
    log(msg, 'error');
}

/**
 *
 * @param msg
 */
var info = function(msg) {
    log(msg, 'info');
}

////////////////////////////////////////////////////////////////////////////////////////////////////
var computeServers = [];
var addComputeServer = function(srv) {
    computeServers.push(srv);

    computeBox.add(' ');
    computeBox.down(1);
};

var updateComputeList = function() {
    for (var i = 0; i < computeServers.length; i++) {
        var index = i + 1;
        var srv = computeServers[i];

        var cycOverlap = (srv.cycOverlap) ? "X" : " ";

        computeBox.items[index].setContent('{white-fg}{black-bg}{bold}' +
            util.pad(srv.pid.toString(),                          6,  " ", util.STR_PAD_RIGHT) +
            util.pad(srv.gcCycle.toString(),                      10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.cycleDelta.toString(),                   10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.timeDelta.toFixed(4).toString(),         10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.runCyclesPerSec.toFixed(2).toString(),   10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.cycleTime.toString(),                    10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.cyclesBehind.toString(),                 10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.msBehind.toFixed(2).toString(),          10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.msAhead.toFixed(2).toString(),           10, " ", util.STR_PAD_RIGHT) +
            util.pad(cycOverlap,                                  10, " ", util.STR_PAD_RIGHT) +
            util.pad(srv.cpu.toFixed(2).toString(),               10, " ", util.STR_PAD_RIGHT) +
            '{/bold}{/black-bg}{/white-fg}');
    }
};
var updateComputeEntry = function (data) {
    for (var i = 0; i < computeServers.length; i++) {
        if (computeServers[i].pid === data.pid) {
            computeServers[i].gcCycle         = data.gcCycle;
            computeServers[i].cycleDelta      = data.cycleDelta;
            computeServers[i].timeDelta       = data.timeDelta;
            computeServers[i].runCyclesPerSec = data.runCyclesPerSec
            computeServers[i].cycleTime       = data.cycleTime;
            computeServers[i].cyclesBehind    = data.cyclesBehind;
            computeServers[i].msBehind        = data.msBehind;
            computeServers[i].msAhead         = data.msAhead;
            computeServers[i].cycOverlap      = data.cycOverlap;
            computeServers[i].cpu             = data.cpu;
        }
    }
};
////////////////////////////////////////////////////////////////////////////////////////////////////

var initialize = function() {
    drawScreen();

    // Quit on Escape, q, or Control-C.
    screen.key(['escape', 'q', 'C-c'], function(ch, key) {
        return process.exit(0);
    });

    // Focus our element.
    computeBox.focus();

    // Initial render of the screen.
    screen.render();

    // Setup GUI update interval
    setInterval(function(){
        // Compute list update
        updateComputeList();

        // CPU Update
        updateCPU(((util.usage().percent.usage) * 100).toFixed(1))

        // Render changes
        screen.render();

    }, 1000);
}

var testRun = function () {
    initialize();
    for (var i = 0; i < 10; i++) {
        log(i + "test");
        error(i + "test2");
        info(i + "test3");
    }

    addComputeServer({
        pid          : 1,
        cycleDelta   : 12,
        cyclesPerSec : 10,
        cyclesBehind : 34,
        cpu          :.90
    });

    setTimeout(function(){
        updateComputeEntry(
            {
                pid          : 1,
                cycleDelta   : 12,
                cyclesPerSec : 10,
                cyclesBehind : 34,
                cpu          :.10
            }
        )
    },2000);
};


exports.initialize         = initialize;
exports.updateCycle        = updateCycle;
exports.updateComputeEntry = updateComputeEntry;
exports.addComputeServer   = addComputeServer;
exports.log                = log;
exports.error              = error;
exports.info               = info;

//testRun();

