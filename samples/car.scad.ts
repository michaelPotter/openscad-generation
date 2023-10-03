import * as scad from '../src/scad'
import {
	cylinder,
	text,
	union,
	scale,
	cube,
	comment,
	V2,
	V3,
} from '../src/scad'

function car() {
	let base_height = 8;
	let top_height = 14;
	let wheel_radius = 8;
	let track = 80;
	let wheel = (rotation?:V2|V3) => cylinder({h:3,r:wheel_radius, center:true}).rotate([90,0,0]).rotate(rotation ?? [0,0,0]);
	let axle = cylinder({h:track,r:2,center:true}).rotate([90, 0, 0]);

	return union([
		text("$fa = 1;"),
		text("$fs = 0.4;"),
		scale([1.2, 1, 1], [
			comment("Car body base"),
			cube([60,20,base_height], {center:true}),
			comment("Car body top"),
			cube([30,20,top_height], {center:true}).translate([5,0,base_height/2+top_height/2-0.001]),
		]).rotate([5,0,0]),
		wheel([0,0,-20]).translate([-20, -track / 2, 0]),
		wheel([0,0,-20]).translate([-20, track / 2, 0]),
		wheel().translate([20, -track / 2, 0]),
		wheel().translate([20, track / 2, 0]),
		axle.right(20),
		axle.left(20),
	]);
};

scad.printScadCode(car());
