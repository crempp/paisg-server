PAISG Server
=======
PAISG (temporary name) is a massively multiplayer online real-time space
strategy game, only you're not the one in the drivers seat.

Current Version and Completed Features
-----
* v0.1 - Basic POC
  * Basic Gui
  * Compute node processes (multiple compute node support)
  * Base communication protocol

Road Map
-----
* v0.2 - Support for more modules
       - [ ] Plan (and implement some) more of the communication flow and protocol
       - [ ] Module uploads
       - [ ] Sensor modules
       - [ ] 3 ship types
* v0.3 - ?
* v0.4 - ?

TODO
----
* Script CPU time limit
* Fork the compute master into it's own process. The goal is to reduce the
  number of items in the event loop queue so that the accuracy of setTimeout
  is as high as possible
* State checksum?

Client Connection Flow
---
1. Client connects to server (TCP Socket connection)
1. Client sends 'cli-ready' command (data?)
1. Server sends 'srv-ready' command and data package
1. ...

Client Login Flow
---
1. Client sends 'auth-req' command and data package (username, pass)
1. Server sends 'auth-resp' command and data package (success info)
1. Client sends 'init-req' command
1. Server sends 'init-resp' command and data package (player data and current state);
1. Client sets state and prepares for state updates
1. Server adds the connected client to it's state update list and begins pushing state updates with 'state-push' command
1. Client receives and handles state updates

Game State Flow
---
1. Server pushes state updates with 'state-push' command
1. Client receives and handles state updates

Script Update Flow
----
??

Client Disconnect Flow
----
??

Star Types
---
See [Stellar classification](http://en.wikipedia.org/wiki/Stellar_classification) for details. Probability has been tweaked from actual values and will need further tweaking.

| Type  | Color        | Probability |
| ----- | ------------ | ----------- |
| O     | Blue         | 0.1101%     |
| B     | Blue White   | 0.13%       |
| A     | White        | 0.6%        |
| F     | Yellow White | 3%          |
| G     | Yellow       | 7.6%        |
| K     | Orange       | 12.1%       |
| M     | Red          | 76.45%     |
| L     | Red Brown    | 0.0033%    |
| T     | Brown        | 0.0033%    |
| Y     | Dark Brown   | 0.0033%    |

Planet Types
---
See [Class M Planet](http://en.wikipedia.org/wiki/Class_M_planet)

API
---

###Client Commands

####cli-ready

####auth-req

####init-req


###Server Commands

####srv-ready
(data includes server version, current load levels, ...)

####auth-resp

####init-resp

####state-push
This server command pushes game state data to the client. Currently (<v0.5) the entire state object is pushed to every client. This will need to change.
```json
{
   "systems" : [
       {
            "id" : 1,
            "name" : "tatooine",
            "type" : 
            "position" : {"x": 0, "y": 0},
            
       }
   ],
   "players": [
       {
           "id"  : 1,
           "name": "chad",
           "units": [
               {
                   "name"     : "drone-1",
                   "type"     : "drone",
                   "module"   : "e144e80279de530b994e4f60d5b4aff8",

                   "moi"      : 1,

                   "thrust"   : 0,
                   "torque"   : 0,

                   "heading"  : 0,
                   "position" : {"x": 0, "y": 0},
                   "velocity" : {"x": 0, "y": 0}
               }
           ]
       },
       {
           "id"  : 2,
           "name": "seth",
           "units": [
               {
                   "name"     : "drone-2",
                   "type"     : "drone",
                   "module"   : "5daf68b513be84e76fb9bad237d9c8af",

                   "moi"      : 1,

                   "thrust"   : 0,
                   "torque"   : 0,

                   "heading"  : 0,
                   "position" : {"x": 0, "y": 0},
                   "velocity" : {"x": 0, "y": 0}
               }
           ]
       }
   ]
}
```