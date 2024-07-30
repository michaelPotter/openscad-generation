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


let l = [1, 2, 3, 4];
// console.log(`chunkChain(l): `, chunkChain(l))  // TODO DELETE ME


// Takes a Path that describes a line, and expands it out to create a 2d shape. Sort of like inflating a line. Maybe that's what it should be called?
// Should take a delta, and/or a delta1 and delta2
function spreadLine(p: Path): Path {
	// let d1 = opts.d1 ?? opts.delta;
	// let d2 = opts.d1 ?? opts.delta;

	// Impl notes: Middle points should move d in a direction that bisects their angle change, end points should move in the direction of their normal vector.
	return p;
}
function basicNormalTesting() {
	let path: Path = [[0, 0], [1, 3]];
	let delta = vDelta(path[0], path[1]);
	let normal = getNormalVector(delta);

	let strokeWidth = 0.1;
	g.printScadCode(
		g.code("$fn = 12;"),
		strokePath(path, { strokeWidth, points: true }),
		strokePath([[0, 0], normal], { strokeWidth: strokeWidth / 2, color: "green" }),
	);
}

function arcNormalTesting() {
	let arc = unitArc(90, 180);

	arc = arc.map(g.vAdd([1, 0])).reverse();
	// arc = arc.map(g.vAdd([1, 9]));
	// arc = [[10, 10], ...arc, [0, 0]];

	// let squarePath = new Turtle()
	// 	.north(10)
	// 	.east(10)
	// 	.getPath();

	let normals: Path[] = g.chunkChain(arc).map(pair => {
		let norm = setVectorLength(getNormalVector(vDelta(pair[0], pair[1])), .1);
		let path = [g.vAdd(g.vMult(norm, [-1, -1]), pair[0]), g.vAdd(norm, pair[0])];
		return path
	})

	let strokeWidth = 0.1 / 2;
	g.printScadCode(
		// g.comment("points: " + points),
		// g.comment("delta: " + vDelta(points[0], points[1])),
		g.code("$fn = 12;"),
		// g.draw_at_points(points, g.circle({ d: 1 }).color("red")),
		// strokePath(squarePath, { strokeWidth, points: true, strokeColor: "red", pointColor: "green" }),
		strokePath(arc, { strokeWidth, points: true, pointColor: "blue" }),
		g.union(...normals.map(n => strokePath(n, { strokeWidth: strokeWidth / 2, color: "green" }))),
		// ...pSet.flatMap(pair => strokePath(pair, { strokeWidth: 0.1 })),
	);
}


interface ArcOpts {
	fn?: number;
	start?: V2;
	startAngle?: number;
}
// Draws an arc starting at the origin that arcs right.
function basicArcRight(radius: number, degrees = 90, opts?: ArcOpts): Path {
	return basicArcLeftRight("right", radius, degrees, opts);
}
// Draws an arc starting at the origin that arcs right.
function basicArcLeft(radius: number, degrees = 90, opts?: ArcOpts): Path {
	return basicArcLeftRight("left", radius, degrees, opts);
}

function basicArcLeftRight(dir: "left" | "right", radius: number, degrees = 90, opts?: ArcOpts): Path {
	let start = opts?.start ?? [0, 0];
	let startAngle = opts?.startAngle ?? 90;
	let originizeFunc = dir == "left" ? vAdd([-1, 0]) : (p: V2) => vAdd([1, 0], vMult([-1, 1], p));
	let arc = unitArc(degrees, opts)
		// Start the arc at the origin
		.map(originizeFunc)
		// Scale
		.map(vMult([radius, radius]))
		// Rotate
		.map(p => rotatePointAroundOrigin(p, startAngle - 90))
		// Translate
		.map(vAdd([start[0], start[1]]))
	return arc;
}

// interface StartEndArcOpts {
// 	startAngle: number;
// 	endAngle: number;
// 	startPos: number;
// 	radius: number;
// }
// function startEndArc(opts: StartEndArcOpts) {
// 	let startAngle = opts?.startAngle ?? 90;
// 	let originizeFunc = dir == "left" ? vAdd([-1, 0]) : (p: V2) => vAdd([1, 0], vMult([-1, 1], p));
// 	let arc = unitArc(degrees, opts)
// 		// Start the arc at the origin
// 		.map(originizeFunc)
// 		// Scale
// 		.map(vMult([opts.radius, opts.radius]))
// 		// Rotate
// 		.map(p => rotatePointAroundOrigin(p, - startAngle + 90))
// 		// Translate
// 		.map(vAdd([opts.startPos[0], opts.startPos[1]]))
// 	return arc;
// }

// TODO support steps
// TODO doesn't work on a right-to-left path.
function arcOnPoints(points: [V2, V2, V2], radius: number): g.Geometry3D {
	// See https://en.wikipedia.org/wiki/Tangent_lines_to_circles#With_analytic_geometry
	//
	// Terminology:
	//   A, B, C: The given points
	//   a_ABC: The angle between A, B, and C
	//   O: origin point
	//   P: Point to be "radiused"
	//   OP: distance from O to P
	//   T1,T2: the tangent points
	//   thetaT: The angle between the lines OT(1) and OP
	radius = 1;  // TODO DELETE ME
	let [A, B, C] = points;
	let startAngle = g.getVectorAngle(A, B);
	let endAngle = g.getVectorAngle(B, C);
	let a_ABC = 180 - startAngle + endAngle;
	let a_ABC_2 = a_ABC / 2;
	let OP = radius / Math.sin(a_ABC_2 / 180 * Math.PI) // https://math.stackexchange.com/questions/797828/calculate-center-of-circle-tangent-to-two-lines-in-space
	let O = g.vectorChain(g.getUnitVector(180 + startAngle + a_ABC_2))
		.mult([OP, OP])
		.add(points[1])
		.get();
	let thetaT = 90 - a_ABC_2; // Calculated by checking angles of TOP: thetaT = (180 - 90 - a_ABC_2)
	let rot = 90 - a_ABC_2 - startAngle; // How much to rotate the radius arc by
	let mainArc =
		unitArc(90 - thetaT - rot, 180 - (90 - thetaT) - rot, { fn: 40 }) // This could be simplified
			.map(vAdd(O));

	let midArc = unitArc(a_ABC)
		.map(p => rotatePointAroundOrigin(p, 180 + startAngle))
		.map(vAdd(points[1]));
	// return mainArc;


	let strokeWidth = 0.1 / 2;
	return g.union(
		strokePath(mainArc, { strokeWidth, points: false, strokeColor: "red", pointColor: "green" }),
		strokePath(midArc, { strokeWidth, points: true, pointColor: "green" }),
		strokePath([points[1], O], { strokeWidth: strokeWidth / 2, points: true }),
	)
}

function leftRightArcTesting() {
	// let arc = basicArcLeft(2, 90);
	let arc = basicArcLeft(2, 90);
	// let arc = basicArcRight(2, 90, { startAngle: 180 });

	let strokeWidth = 0.1 / 2;
	g.printScadCode(
		g.code("$fn = 12;"),
		strokePath(arc, { strokeWidth, points: true, pointColor: "blue" }),
		strokePath([arc[0]], { strokeWidth, points: true, pointColor: "red" }),
		strokePath(arc.slice(-1), { strokeWidth, points: true, pointColor: "green" }),
	);
}

function arcOnPointsTest() {
	const points: [V2, V2, V2] = [[8, 8], [0, 6], [4, 2]];
	let arc = arcOnPoints(points, 2);


	let strokeWidth = 0.1 / 2;
	g.printScadCode(
		g.code("$fn = 12;"),
		strokePath(points, { strokeWidth, points: true, pointColor: "blue" }),
		arc,
		// strokePath(arc, { strokeWidth, points: true, strokeColor: "red", pointColor: "green" }),
	);
}

arcOnPointsTest();
