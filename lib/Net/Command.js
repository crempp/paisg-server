var Class     = require('jsclass/src/core').Class;
var Singleton = require('jsclass/src/core').Singleton;

var CommandType = new Singleton({
    clientready_ack : 1,
    clientload_req  : 2,
    stateupdate_req : 3
});

var Command = new Class({
    /**
     * Command type, must be one of the types in CommandType
     */
    type     : null,

    /**
     * Source IP of the command
     */
    source   : null,

    /**
     * ID of the player this command originated from. If the command came from
     * the server this will be 0.
     */
    playerID : null,

    /**
     * Class methods
     */
    extend : {
        /**
         * Set of command handlers
         */
        handlers : {},

        /**
         * Assign the command handler
         */
        setHandler : function(handler) {

        }
    },

    initialize : function (type, source, playerID) {
        // Makesure the command type is valid
        if ('number' !== typeof CommandType[type])
        {
            throw "NET:Command - Invalid command type '" + type + "'";
        }

        this.type = type;
        this.source = source;
        this.playerID = playerID;
    }

});

console.log(CommandType.clientready_ack);