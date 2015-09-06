var os = require('os');

var STR_PAD_LEFT = 1;
var STR_PAD_RIGHT = 2;
var STR_PAD_BOTH = 3;

/**
 * Pad the string with the given number of pad characters in the give direction
 *
 * http://www.webtoolkit.info/
 *
 * @param str
 * @param len
 * @param pad
 * @param dir
 * @returns {*}
 */
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

var USAGE_HISTORY = {
    hydrated : false,
    total  : {
        user : 0,
        nice : 0,
        sys  : 0,
        idle : 0,
        irq  : 0
    },
    diff : {
        user : 0,
        nice : 0,
        sys  : 0,
        idle : 0,
        irq  : 0},
    percent: {}
};

/**
 * Calculate CPU usage
 *
 * TODO: Add per-cpu calculated values
 *
 * @returns {{total: {}, diff: {}, percent: {}}}
 */
function usage() {
    var cpus = os.cpus();

    var ts  = new Date().getTime();
    var sum = 0;

    var calculated = {
        total : {
            user : 0,
            nice : 0,
            sys  : 0,
            idle : 0,
            irq  : 0
        },
        diff : {
            user : 3400,
            nice : 0,
            sys  : 800,
            idle : 34400,
            irq  : 0
        },
        percent: {
            user  : 0,
            nice  : 0,
            sys   : 0,
            idle  : 0,
            irq   : 0,
            usage : 0
        }
    };

    // Add time for each CPU to get a total time for each type
    for (var i = 0; i < cpus.length; i++) {
        Object.keys(cpus[i].times).forEach(function(key){
            calculated.total[key] += cpus[i].times[key];
        });
    }

    // Calculate difference
    if (USAGE_HISTORY.hydrated) {
        Object.keys(calculated.total).forEach(function(key){
            // Calculate the difference for this type
            calculated.diff[key] = calculated.total[key] - USAGE_HISTORY.total[key];

            // Add to the sum
            sum += calculated.diff[key]
        });

        // Calculate the percentage
        Object.keys(calculated.total).forEach(function(key){
            calculated.percent[key] = calculated.diff[key] / sum;
        });
        // Append the usage
        calculated.percent.usage = 1 - calculated.percent.idle;
    }

    USAGE_HISTORY = calculated;
    USAGE_HISTORY.hydrated = true;
    USAGE_HISTORY.ts = ts;

    return calculated;
}

exports.pad = pad;
exports.usage = usage;
exports.STR_PAD_LEFT  = STR_PAD_LEFT;
exports.STR_PAD_RIGHT = STR_PAD_RIGHT;
exports.STR_PAD_BOTH  = STR_PAD_BOTH;