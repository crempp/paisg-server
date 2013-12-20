/*@5daf68b513be84e76fb9bad237d9c8af*/
/**
 * First test for integration
 *
 * User: chad
 * Date: 9/11/13
 * Time: 10:18 PM
 */

var thrust_state = {
    iter: data.cycle,
    val : data.thrust,
}

var heading_state = {
    iter: data.cycle,
    val : data.heading,
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
 * Return a heading float value in range [-1, 1]
 *
 * -1 is full thrust left, 1 is full thrust right
 */
function instruct_heading(){
    heading_state.val = Math.sin( heading_state.iter * ( Math.PI / 180 ) );
    heading_state.iter++;

    return heading_state.val;
}

data.thrust  = instruct_thrust();
data.heading = instruct_heading();