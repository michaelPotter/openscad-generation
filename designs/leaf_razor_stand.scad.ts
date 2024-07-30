'use strict';

import _, { intersection } from 'underscore';
import * as g from '../src/scad';
import {
	Geometry,
	V2,
	V3,
	vDelta,
	strokePath,
	Path,
	Turtle,
	unitArc,
	getNormalVector,
	getVectorLength,
	setVectorLength,
} from '../src/scad';

let standSize = [30, 43.5, 55]; // TODO measure
let backRad = 2;
let frontRad = standSize[0] / 3; // TODO change to 2 for actual fillet
let footHeight = 5; // TODO parameterize
let footlength = 10;

class Body extends g.UserGeometry {
	size = standSize;

	baseProfile: Path = new Turtle()
		.west(standSize[0] / 2)
		.chamfer(frontRad).north(standSize[1])
		.chamfer(backRad).east(standSize[0])
		.chamfer(backRad).south(standSize[1])
		.chamfer(frontRad).west(standSize[0] / 2)
		.getPath();

	sideProfile: Path = new Turtle()
		.north(footHeight)
		.east(footlength) // TODO parameterize
		.chamfer(4).north(standSize[2] - footHeight)
		.east(standSize[1] - footlength)
		.south(standSize[2])
		.west(standSize[1])
		.getPath()
		;

	geometry(): g.Geometry<g.V3> {
		// Main body
		return g.intersection(
			g.polygon(this.baseProfile).linearExtrude(standSize[2], {})
				.right(standSize[0] / 2),
			g.polygon(this.sideProfile).linearExtrude(standSize[0], {})
				.rotate([0, 0, 90])
				.rotate([0, 90, 0])
			,
		)
	}
}
let body = new Body();

class Hole extends g.UserGeometry {
	size = { x: 15, y: 11, z: 100 };
	// pos = {x: 7.5, y: 25, z: 15}
	pos = [7.5, 25, 15] as V3;
	chamfer = 3;

	profile: Path = new Turtle()
		.east(this.size.x)
		.south(this.size.y)
		.chamfer(this.chamfer).west(this.size.x)
		.chamfer(this.chamfer).north(this.size.y)
		.getPath()
		.map(g.vAdd([-this.size.x / 2, this.size.y / 2]))
		;

	geometry() {
		return g.union(
			g.polygon(this.profile).linear_extrude(this.size.z),
			g.cylinder({ d: 4, h: standSize[2] * 4 }).down(standSize[2] * 2),
		).right(this.size.x / 2).back(this.size.y / 2);
	}
}
let hole = new Hole();

g.printScadCode(
	g.code("$fn = 12;"),

	body
		.difference(
			hole.translate(hole.pos),
		),
);

