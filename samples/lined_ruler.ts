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
	unitArc,
	circle,
	hull,
	printScadCode,
	linearExtrude,
	code,
	union,
	translate,
} from '../src/scad';

const INCH = 25.4;

let gap_size: V2 = [2 * INCH, 0.8];
// let gap_size: V2 = [10, 0.8];
let gap_spread = INCH / 5;
let margin = gap_spread;
let width = gap_size[0] + 2 * margin;
let nlines = 5;
// let nlines = 2;
let height = (nlines - 1) * gap_spread + gap_size[1] + 2 * margin;
let r = 2;
function pillShape(size: V2) {
	return hull(
		circle({ d: size[1] }).translate([size[1] / 2, size[1] / 2]),
		circle({ d: size[1] }).translate([size[0] - size[1] / 2, size[1] / 2]),
	);
}
let gap = pillShape(gap_size);
let plate = hull(
	circle({ r }).translate([r, r]),
	circle({ r }).translate([width - r, height - r]),
	circle({ r }).translate([r, height - r]),
	circle({ r }).translate([width - r, r]),
);

let edge_inset = pillShape([1 + 0.5, gap_size[1]])

printScadCode(
	linearExtrude(0.5, {}, [
		code("$fn=32;"),
		plate.difference(
			translate([margin, margin, 0],
				_.range(nlines).map(i => gap.back(i * gap_spread)),
			),
		).difference(union(
				[width - 1, -0.5].map(x =>
					translate([x, margin, 0],
						_.range(nlines).map(i => edge_inset.back(i * (gap_spread))),
					)),
			).highlight()),
	]),
);
