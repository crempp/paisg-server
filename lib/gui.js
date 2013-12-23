var blessed = require('blessed');
var os      = require("os");
var osutils = require('os-utils');

// Create a screen object.
var screen = blessed.screen();

// Global everything for the moment
var titleBox, titleCycleBox, titleCPUBox, computeBox, logBox;

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
        content : 'gcCyc: 234423',
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
            label : {
                fg: 'cyan',
                bg: 'lightblack'
            }
        }
    });

    computeBox.add('{black-fg}{black-bg}{bold}' +
                    pad("pid",          5,  "  ", STR_PAD_RIGHT) +
                    pad("cycleDelta",   15, "  ", STR_PAD_RIGHT) +
                    pad("cyclesPerSec", 15, "  ", STR_PAD_RIGHT) +
                    pad("cyclesBehind", 15, "  ", STR_PAD_RIGHT) +
                    pad("cpu",          10, "  ", STR_PAD_RIGHT) +
                    '{/bold}{/black-bg}{/black-fg}');
    computeBox.down(1);

    titleBox.append(titleCPUBox);
    titleBox.append(titleCycleBox);

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
var log = function(msg, type) {
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

    computeBox.add('{black-fg}{black-bg}{bold}' +
        pad(srv.pid.toString(),          5,  "  ", STR_PAD_RIGHT) +
        pad(srv.cycleDelta.toString(),   15, "  ", STR_PAD_RIGHT) +
        pad(srv.cyclesPerSec.toString(), 15, "  ", STR_PAD_RIGHT) +
        pad(srv.cyclesBehind.toString(), 15, "  ", STR_PAD_RIGHT) +
        pad(srv.cpu.toString(),          10, "  ", STR_PAD_RIGHT) +
        '{/bold}{/black-bg}{/black-fg}');
    computeBox.down(1);
};

var updateComputeList = function() {
    for (var i = 0; i < computeServers.length; i++) {
        var index = i + 1;
        var srv = computeServers[i];

        computeBox.items[index].setContent('{black-fg}{black-bg}{bold}' +
            pad(srv.pid.toString(),          10,  "  ", STR_PAD_RIGHT) +
            pad(srv.cycleDelta.toString(),   15, "  ", STR_PAD_RIGHT) +
            pad(srv.cyclesPerSec.toString(), 15, "  ", STR_PAD_RIGHT) +
            pad(srv.cyclesBehind.toString(), 15, "  ", STR_PAD_RIGHT) +
            pad(srv.cpu.toString(),          10, "  ", STR_PAD_RIGHT) +
            '{/bold}{/black-bg}{/black-fg}');

    }
};
var updateComputeEntry = function (data) {
    for (var i = 0; i < computeServers.length; i++) {
        if (computeServers[i].pid === data.pid) {
            computeServers[i].cycleDelta   = data.cycleDelta;
            computeServers[i].cyclesPerSec = data.cyclesPerSec;
            computeServers[i].cyclesBehind = data.cyclesBehind;
            computeServers[i].cpu          = data.cpu;
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

    setInterval(function(){
        // Compute list update
        updateComputeList();

        // CPU Update
        // This won't complete until the next render but that's fine.
        osutils.cpuUsage(function(v){
            var pct = v * 10;
            var str;
            if (pct < 100) {
                str = pct.toFixed(1);
            } else {
                str = "100"
            }

            updateCPU(str);
        });

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

/**
 *
 *  Javascript string pad
 *  http://www.webtoolkit.info/
 *
 **/

var STR_PAD_LEFT = 1;
var STR_PAD_RIGHT = 2;
var STR_PAD_BOTH = 3;

function pad(str, len, pad, dir) {

    if (typeof(len) == "undefined") { var len = 0; }
    if (typeof(pad) == "undefined") { var pad = ' '; }
    if (typeof(dir) == "undefined") { var dir = STR_PAD_RIGHT; }

    if (len + 1 >= str.length) {

        switch (dir){

            case STR_PAD_LEFT:
                str = Array(len + 1 - str.length).join(pad) + str;
                break;

            case STR_PAD_BOTH:
                var right = Math.ceil((padlen = len - str.length) / 2);
                var left = padlen - right;
                str = Array(left+1).join(pad) + str + Array(right+1).join(pad);
                break;

            default:
                str = str + Array(len + 1 - str.length).join(pad);
                break;

        } // switch

    }

    return str;

}