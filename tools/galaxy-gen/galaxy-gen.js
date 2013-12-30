/**
 * http://luc.devroye.org/chapter_two.pdf
 * http://en.wikipedia.org/wiki/Cauchy_distribution
 * 
 * 
*/


var sys = require('sys')
  , fs = require('fs')
  , gm = require('gm');

var PARTICLE_COUNT = 20000   // Number of galaxies
  , DIAMETER       = 2000  // Diameter of galaxy
  , IMG_PATH       = __dirname + '/galaxy.png'
  , IMG_BACKGROUND = '#151515'
  , STAR_COLOR     = '#dddddd'
  , DO_WRITE       = true;
  
  
/**
 * Star Object
 */
var Star = {
    x : null,
    y : null,
};

/**
 * Galaxy Object
 */
var Galaxy = {
    stars : []
};

sys.puts("Starting generation...");

var galaxy = Object.create(Galaxy);

// Create stars
draw4();

sys.puts("Drawing galaxy...");

var drawing = gm(DIAMETER, DIAMETER, IMG_BACKGROUND)
              .stroke(STAR_COLOR)
              .fill(STAR_COLOR);

if (DO_WRITE) {
    for (var j = 0; j < galaxy.stars.length; j++) {
      //sys.puts(sys.inspect(j + " : " + galaxy.stars[j]));
      drawing.drawPoint(galaxy.stars[j].x, galaxy.stars[j].y);
    }

    drawing.write(IMG_PATH, function (err) {
      if (err) {
        sys.puts("  oops, something went wrong");
        sys.puts(sys.inspect(err));
        return console.dir(arguments);
      } else {
        sys.puts("  " + this.outname + ' created');
        sys.puts("Done");
      }
    });
}

///////////////////////////////////////////////////////////////
function draw1() {
    for (var i = 0; i < PARTICLE_COUNT; i++) {
        //var min = 0,
        //    max = DIAMETER;
        var a = 0.6,
            b = 0.3,
            rotations = 7,
            spread    = 1.2;
            
        var theta_min = 0,
            theta_max = rotations * (Math.PI * 2);
        
        // New star
        var star = Object.create(Star);
        
        // Equation for the logarithmic spiral
        // r = a * e^(b * theta)
        var theta  = Math.random() * (theta_max - theta_min + 1) + theta_min
        var radius = Math.pow(a * Math.E, b * theta);
        
        // Spread the spiral arms
        var sign = (Math.random() > 0.5) ? 1 : -1;
        theta  = theta  + sign * (Math.random() * spread);
        radius = radius + sign * (Math.random() * spread);
        
        // Convert to cartesian
        star.x = (radius * Math.cos(theta)) + (DIAMETER / 2);
        star.y = (radius * Math.sin(theta)) + (DIAMETER / 2);
        
        galaxy.stars.push(star);
        
        //sys.puts("  created star [" + i + "] at (" + star.x + "," + star.y + ")");
    }
}

// Equation for the logarithmic spiral
// r = a * e^(b * theta)
// We use the following transformation to get a Weibull distribution
// y = ( ( -1/alpha ) * ln( 1 - x) ) ^ (1/beta)
function draw2() {
    var a = 0.6,
        b = 0.4,
        rotations    = 5.5,
        radius_max   = DIAMETER,
        
        alpha        = 0.5,
        beta         = 1;
    
    var theta_min = 0,
        theta_max = rotations * (Math.PI * 2);
    
    for (var i = 0; i < PARTICLE_COUNT; i++) {
        
        // Create a new star
        var star = Object.create(Star);
        
        // Create a random theta
        var theta  = Math.random() * (theta_max - theta_min + 1) + theta_min
        
        // Now use the formula for the logarithmic spiral to get the radius
        var radius = Math.pow(a * Math.E, b * theta);
            
        radius_scaled = radius / radius_max;
        
        radius_dist = Math.pow( ( -1/alpha ) * Math.log( 1 - radius_scaled), (1/beta) );
        
        radius = radius_dist * radius_max;
        
        //radius = radius + sign * (Math.random() * spreadRadius);
        
        // Convert to cartesian
        star.x = (radius * Math.cos(theta)) + (DIAMETER / 2);
        star.y = (radius * Math.sin(theta)) + (DIAMETER / 2);
        
        galaxy.stars.push(star);
        
        //sys.puts("  created star [" + i + "] at (" + star.x + "," + star.y + ")");
    }
    
}

// Equation for the logarithmic spiral
// r = a * e^(b * theta)
// We use the following transformation to get a Weibull distribution
// y = ( ( -1/alpha ) * ln( 1 - x) ) ^ (1/beta)
function draw3() {
    var a = 0.86,
        // b controls tightness and direction of spiral. b=0 is a circle 
        // b->infinity the spiral approaches a straight line
        b = 0.3,
        //b = 0.5,
        rotations    = 3.2,
        radius_max   = DIAMETER,
        
        arms         = 2,
        
        alpha        = 0.5,
        beta         = 1,
        
        x_0          = 0,
        sigma        = 6;
    
    var theta_min = 0,
        theta_max = rotations * (Math.PI * 2);
    for (var j = 0; j < arms; j++) {
    
        
        for (var i = 0; i < PARTICLE_COUNT / arms; i++) {
            
            // Create a new star
            var star = Object.create(Star);
            
            // Create a random theta
            var theta  = Math.random() * (theta_max - theta_min + 1) + theta_min
            
            // Adjust the b value based on which arm we are calculating.
            b2 = b + (0.5 * arms);
            
            // Now use the formula for the logarithmic spiral to get the radius
            var radius = Math.pow(a * Math.E, b2 * theta);
            
            // Use the quantile function (inverse cdf) of the Cauchy
            // distribution to spread the stars from the mainline
            var rad_mod = x_0 + sigma * Math.tan(Math.PI * (Math.random() - 0.5));
            //radius = radius + rad_mod;
            
            // Convert to cartesian
            star.x = (radius * Math.cos(theta)) + (DIAMETER / 2);
            star.y = (radius * Math.sin(theta)) + (DIAMETER / 2);
            
            galaxy.stars.push(star);
            
            //sys.puts("  created star [" + i + "] at (" + star.x + "," + star.y + ")");
        }
    }
    
}


// Based on http://arxiv.org/pdf/0908.0892.pdf
//  r(phi) = A / ( log ( B * tan ( phi / 2 * N ) ) )
function draw4() {
    var A          = 1000,
        B          = 0.2,
        N          = 2,
        arms       = 2,
        
        x_0        = 0,
        sigma      = 25,
        
        rotations  = 0.5,
        radius_max = DIAMETER,
        pass1_count = 15000,
        pass2_count = 25000,
        pass3_count = 10000,
        glob_count  = 30,
        
        do_phase_1  = true,
        do_phase_2  = true,
        do_phase_3  = true;
        
    var theta_min = 0,
        theta_max = rotations * (Math.PI * 2);

    // Pass 1 - place stars along spiral arms
    if (do_phase_1) {
        sys.puts("running phase 1...");
        for (var h = 0; h < arms; h++) {
            for (var i = 0; i < Math.floor(pass1_count/2); i++) {
                // Create a new star
                var star = Object.create(Star);
                
                // Create a random theta
                var theta  = Math.random() * (theta_max - theta_min + 1) + theta_min
                
                // Adjust sign based on which arm we're calculating
                var sign = 1;
                if (h == 1) sign = -1;
                
                var radius = (sign) * ( A / ( Math.log( B * Math.tan( theta / (2 * N) ) ) ) );
                
                // Use the quantile function (inverse cdf) of the Cauchy
                // distribution to spread the stars from the mainline
                var rad_mod = x_0 + sigma * Math.tan(Math.PI * (Math.random() - 0.5));
                radius = radius + rad_mod;
                
                // Convert to cartesian
                star.x = (radius * Math.cos(theta)) + (DIAMETER / 2);
                star.y = (radius * Math.sin(theta)) + (DIAMETER / 2);
                
                // Save star
                galaxy.stars.push(star);
            }
        }
    }
    
    // Pass 2 - place stars in globs
    if (do_phase_2) {
        sys.puts("running phase 2...");
        for (var h = 0; h < arms; h++) {
            for (var i = 0; i < Math.floor(glob_count/2); i++) {
                //sys.puts("Pass 2");
                
                // Create a random theta
                var theta  = Math.random() * (theta_max - theta_min + 1) + theta_min
                
                // Adjust sign based on which arm we're calculating
                var sign = 1;
                if (h == 1) sign = -1;
                
                var radius = (sign) * ( A / ( Math.log( B * Math.tan( theta / (2 * N) ) ) ) );
                
                // Use the quantile function (inverse cdf) of the Cauchy
                // distribution to spread the stars from the mainline
                //var rad_mod = x_0 + sigma * Math.tan(Math.PI * (Math.random() - 0.5));
                //radius = radius + rad_mod;
                
                var glob_min = 0,
                    glob_max = 150;
                
                for (var j = 0; j < (pass2_count/glob_count/2) ; j++){
                    // Create a new star
                    var star = Object.create(Star);
                    
                    var theta_mod  = Math.random() * (theta_max - theta_min + 1) + theta_min;
                    var radius_mod  = Math.random() * (glob_max - glob_min + 1) + glob_min;
                    var radius_mod_dist = x_0 + sigma * Math.tan(Math.PI * radius_mod - 0.5);
                    var x_mod = (radius_mod_dist * Math.cos(theta_mod));
                    var y_mod = (radius_mod_dist * Math.sin(theta_mod));
                    
                    // Convert to cartesian
                    star.x = (radius * Math.cos(theta)) + (DIAMETER / 2) + x_mod;
                    star.y = (radius * Math.sin(theta)) + (DIAMETER / 2) + y_mod;
                    
                    //sys.puts("x=" + star.x + ", y=" + star.y);
                    
                    // Save star
                    galaxy.stars.push(star);
                }                
            }
        }
    }
    // Pass 3 - Galactic core
    if (do_phase_3) {
        sys.puts("running phase 3...");
        var core_theta_min = 0,
            core_theta_max = (Math.PI * 2),
            core_rad_min = 0,
            core_rad_max = 400,
            core_x0      = 0,
            core_sigma   = 35;
    
        for (var k = 0; k < (pass3_count); k++) {
            // Create a new star
            var star = Object.create(Star);
            
            var theta  = Math.random() * (core_theta_max - core_theta_min + 1) + core_theta_min;
            var radius = Math.random() * (core_rad_max - core_rad_min + 1) + core_rad_min;
            
            // Use the quantile function (inverse cdf) of the Cauchy
            // distribution to spread the stars from the mainline
            var rad_mod = core_x0 + core_sigma * Math.tan(Math.PI * (Math.random() - 0.5));
            radius = radius + rad_mod;
            //var radius_mod_dist = x_0 + sigma * Math.tan(Math.PI * radius_mod - 0.5);
            
            star.x = (rad_mod * Math.cos(theta)) + (DIAMETER / 2);
            star.y = (rad_mod * Math.sin(theta)) + (DIAMETER / 2);
            
            //sys.puts("x=" + star.x + ", y=" + star.y);
            
            // Save star
            galaxy.stars.push(star);
        }
    }
}
