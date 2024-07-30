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


let thick = 3;
let cord_d = 8;
let rounding=0.5;
let wing_x = 10;

let cord_r = cord_d/2;



let path: Path = new Turtle()
	.east(wing_x)
	.north(cord_r)
	.north(cord_r)
	.getPath()
	;

g.printScadCode(
	g.code("$fn = 12;"),
	g.strokePath(path),

);

