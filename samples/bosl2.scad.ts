import * as scad from '../src/scad';

let cyl = scad.cylinder({r:4, h:20, center:true}).rotate([0, 90, 0]).highlight();

console.log(`
	include <BOSL2/std.scad>
	difference() {
		cuboid([10, 10, 10], rounding=3);
		${cyl.getCode().join('\n')}
	}
   `);
