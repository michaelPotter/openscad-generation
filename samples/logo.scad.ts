import * as scad from '../src/scad';

let sphere_d = 40;
let cyl_d = 20;
let cut_cyl = scad.cylinder({d:cyl_d, h:sphere_d + 10, fn:32}).down(sphere_d/ 2 + 5);
let logo =
	scad.sphere({d:sphere_d, fn:32})
		.difference([
			cut_cyl,
			cut_cyl.rotate([90, 0, 0]).highlight(),
			cut_cyl.rotate([0, 90, 0]),
		]);

scad.printScadCode(logo);
