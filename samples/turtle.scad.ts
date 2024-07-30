'use strict';

import _ from 'underscore';
import * as g from '../src/scad';
import {
	Geometry,
	V2,
	V3,
	vDelta,
	strokePath,
	Path,
	vMult,
	vAdd,
	rotatePointAroundOrigin,
	Turtle,
	unitArc,
	getNormalVector,
	getVectorLength,
	setVectorLength,
} from '../src/scad';

let turtlePath = new Turtle()
	.walk(10)
	.turn(-60)
	.walk(10)
	.turn(-60)
	.walk(10)
	.turn(-60)
	.walk(10)
	.turn(-60)
	.walk(10)
	.turn(-60)
	.walk(10)
	// .east(10)
	.getPath();

g.printScadCode(
	g.strokePath(turtlePath),
);
