/*@e144e80279de530b994e4f60d5b4aff8*/

/**
 * First test for integration
 *
 * User: chad
 * Date: 9/11/13
 * Time: 10:18 PM
 */

var thrust_state = {
    iter: data.cycle,
    val : data.thrust
}

var torque_state = {
    iter: data.cycle,
    val : data.torque
}

/**
 * Return a thrust float value in range [0, 1]
 *
 * 0 is no thrust, 1 is full thrust
 */
function instruct_thrust(){
    thrust_state.val = Math.max(Math.sin( thrust_state.iter * ( Math.PI / 180 ) ), 0);
    thrust_state.iter++;

    return thrust_state.val;
}

/**
 * Return a torque float value in range [-1, 1]
 *
 * -1 is full thrust left, 1 is full thrust right
 */
function instruct_torque(){
    torque_state.val = Math.sin( torque_state.iter * ( Math.PI / 180 ) );
    torque_state.iter++;

    return torque_state.val;
}

data.thrust  = instruct_thrust();
data.torque = instruct_torque();