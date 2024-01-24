'use strict';

import _ from 'underscore';

import {
	OpenSCADCode,
	V2,
	V3,
	Path,
	vectorTransform,
	booleanTransform,
	Geometry
} from './base';

import {
	getNormalVector,
	getUnitVector,
	getVectorAngle,
	getVectorLength,
	matrixMultiply,
	setVectorLength,
	setZ,
	V2or3toString,
	V2toString,
	V3toString,
	vAdd,
	vDelta,
	vectorChain,
	VectorChain,
	vEquals,
	vInverse,
	vMult,
	vScale,
} from './vectorMath';

import {
	chamferPoints,
} from './PathUtils';

export * from './base';
export * from './vectorMath';
export * from './turtle';

export interface Geometry2D extends Geometry<V2> {
	linear_extrude : (n: number, o?:LinearExtrudeOpts) => Geometry<V3>;
	linearExtrude : (n: number, o?:LinearExtrudeOpts) => Geometry<V3>;
}

export interface Geometry3D extends Geometry<V2> {
}


export abstract class BaseGeometry<G extends V2|V3> implements Geometry<G> {
	abstract getCode(): string[];
	getSize(): V3 { return [0, 0, 0]; }
	// abstract get size(): G // TODO implement this in the future

	translate: vectorTransform<G> = vectorTransformCurryable("translate")(this);
	rotate   : vectorTransform<G> = vectorTransformCurryable("rotate")(this);
	mirror   : vectorTransform<G> = vectorTransformCurryable("mirror")(this);
	scale    : vectorTransform<G> = vectorTransformCurryable("scale")(this);

	union:        booleanTransform<G> = (...g) => new BooleanTransform("union", _.flatten([this, g]));
	difference:   booleanTransform<G> = (...g) => new BooleanTransform("difference", _.flatten([this, g]));
	intersection: booleanTransform<G> = (...g) => new BooleanTransform("intersection", _.flatten([this, g]));
	hull:         booleanTransform<G> = (...g) => new BooleanTransform("hull", _.flatten([this, g]));

	highlight: () => Geometry<G> = () => highlight(this);
	hash: () => Geometry<G> = () => highlight(this);
	color: Geometry<G>['color'] = (c) => new Color(c, this);

	up    = (n: number) => this.translate([0,  0,  n]);
	down  = (n: number) => this.translate([0,  0,  -n]);
	left  = (n: number) => this.translate([-n, 0,  0]);
	right = (n: number) => this.translate([n,  0,  0]);
	fwd   = (n: number) => this.translate([0,  -n, 0]);
	back  = (n: number) => this.translate([0,  n,  0]);

	serialize = () => this.getCode().join("\n")

	constructor() {
		// this.getCode = opts?.getCode ?? this.getCode;
		// this.getSize = opts?.getSize ?? this.getSize;
	}
}
abstract class BaseGeometry3D extends BaseGeometry<V3> {
}
abstract class BaseGeometry2D extends BaseGeometry<V2> {
	linear_extrude: Geometry2D['linear_extrude'] = (h, o?) => new LinearExtrude(h, o ?? {}, [this]);
	linearExtrude: Geometry2D['linearExtrude'] = (h, o?) => new LinearExtrude(h, o ?? {}, [this]);
}

// TODO think this through some more, can we have it both ways?
// Is there a way to make G be V2 if it only contains 2D children, but 3D if it contains any 3D children??
abstract class ParentGeometry<G extends V2|V3> extends BaseGeometry<G> {
	children: Geometry<G>[];
	constructor(children: Geometry<G>|Geometry<G>[]) {
		super();
		this.children = ensureGeometryList(children);
	}
	indentChildCode(): string[] {
		return this.children.flatMap(g => g.getCode().map(l => "  " + l))
	}
}

/**
 * A helper class for defining custom complex geometry.
 * The user can extend this class, and as long as they define geometry(),
 * they can have an object that can be treated like regular geometry with various
 * extra properties.
 */
 // TODO make not V3? I'd rather not have to worry about V2 vs V3 in scripts
export abstract class UserGeometry extends BaseGeometry<V3> {
	getCode() {
		return this.geometry().getCode();
	}
	abstract geometry(): Geometry<V3>;
}

////////////////////////////////////////////////////////////////////////
//                            3D GEOMETRY                             //
////////////////////////////////////////////////////////////////////////

export type CubeOpts = {center:boolean};
export class Cube extends BaseGeometry3D implements Geometry3D {
	size: V3;
	opts: CubeOpts;
	constructor(size: V3, opts = {center: false}) {
		super()
		this.size = size;
		this.opts = opts;
	}

	getCode() {
		return [`cube(${V3toString(this.size)}, center=${this.opts.center});`]
	}
}

export function cube(size: V3, opts?: CubeOpts): Geometry3D {
	return new Cube(size, opts);
}

export interface SphereOpts { d?:number , r?:number , fn?:number; }
export class Sphere extends BaseGeometry3D {
	params: SphereOpts & {d:number};
	get size(): V3 {
		return [this.params.d, this.params.d, this.params.d];
	}
	constructor(opts: SphereOpts) {
		super();
		let r: number, d: number;
		if (opts.r) {
			d = opts.r * 2;
			r = opts.r;
		} else if (opts.d) {
			r = opts.d / 2;
			d = opts.d;
		} else {
			throw new Error("A sphere requires either a d or r; none given");
		}
		this.params = {
			d,
			r,
			fn: opts.fn,
		}
	}
	getCode() {
		return [`sphere(${objectToKwargs(_.omit(this.params, ['r']))});`];
	}
}
export function sphere(opts: SphereOpts): Geometry3D {
	return new Sphere(opts);
}

export interface CylinderOpts { d?:number, r?:number, h: number, fn?:number, center?:boolean }
export class Cylinder extends BaseGeometry3D {
	opts: CylinderOpts & {d:number};
	get size(): V3 {
		return [this.opts.d, this.opts.d, this.opts.h];
	}
	constructor(opts: CylinderOpts) {
		super();
		let r: number, d: number;
		if (opts.r) {
			d = opts.r * 2;
			r = opts.r;
		} else if (opts.d) {
			r = opts.d / 2;
			d = opts.d;
		} else {
			throw new Error("A sphere requires either a d or r; none given");
		}
		this.opts = {
			d,
			r,
			h: opts.h,
			fn: opts.fn,
			center: opts.center ?? false,
		}
	}
	getCode() {
		return [`cylinder(${objectToKwargs(_.omit(this.opts, ['r']))});`];
	}
}
export function cylinder(opts: CylinderOpts): Geometry3D {
	return new Cylinder(opts);
}

class ImportedGeometry extends BaseGeometry3D {
	// TODO resolve ~ and $HOME
	path: string;
	get size(): V3 {
		throw new Error("Cannot return size of imported geometry!")
	}
	constructor(path: string) {
		super();
		this.path = path;
	}
	getCode() {
		return [`import("${this.path}");`];
	}
	getSize(): V3 {
		throw new Error("It is impossible to get the size of an imported geometry");
	}
}
export function importFile(path: string) {
	return new ImportedGeometry(path);
}

// NOTE: assumes points in each layer are defined counterclockwise
export function polyhedronByLayers(layers: V3[][]): Geometry3D {
	let layers_closed = layers.map(closePath)
	let points: V3[] = layers_closed.flatMap(l => l);
	let n = layers_closed[0].length;
	let num_layers = layers.length;

	let faces: number[][] = [
		[...layers[0].keys()].reverse(), // bottom face
		_.range((num_layers-1) * n, num_layers * n), // top face

		// side faces
		... _.range(num_layers-1).flatMap(l => _.range(n-1).map(i =>
			[ (l*n) + i, (l*n) + i+1, ((l+1)*n) + i + 1, ((l+1)*n) + i ])),

	];
	return new TextNode(`polyhedron(points=${JSON.stringify(points)}, faces=${JSON.stringify(faces)});`);
}
    // faces=[[3,2,1,0],[6,7,8,9],[0,1,6,5],[1,2,7,6],[2,3,8,7],[3,4,9,8]]);


//    6-------7
//   /|      /|
// 5,9+-----8 |
//  | |     | |
//  | 1-----|-2
//  |/      |/
// 0,4------3

////////////////////////////////////////////////////////////////////////
//                            2D GEOMETRY                             //
////////////////////////////////////////////////////////////////////////

export type SquareOpts = {center:boolean};
export class Square extends BaseGeometry2D implements Geometry2D {
	size: V2;
	opts: SquareOpts;
	constructor(size: V2, opts = {center: false}) {
		super();
		this.size = size;
		this.opts = opts;
	}
	getCode() {
		return [`square(${V2toString(this.size)}, center=${this.opts.center});`];
	}
}
export function square(size: V2, opts?: SquareOpts): Geometry2D {
	return new Square(size, opts);
}

export type CircleOpts = {d?:number, r?:number, fn?:number};
export class Circle extends BaseGeometry2D implements Geometry2D {
	params: CircleOpts & {d:number};
	get size(): V2 {
		return [this.params.d, this.params.d];
	}
	constructor(opts: CircleOpts) {
		super();
		let r: number, d: number;
		if (opts.r) {
			d = opts.r * 2;
			r = opts.r;
		} else if (opts.d) {
			r = opts.d / 2;
			d = opts.d;
		} else {
			throw new Error("A circle requires either a d or r; none given");
		}
		this.params = {
			d,
			r,
			fn: opts.fn,
		}
	}
	getCode() {
		return [`circle(${objectToKwargs(_.omit(this.params, ['r']))});`];
	}
}
export function circle(opts: CircleOpts): Geometry2D {
	return new Circle(opts);
}

export type LinearExtrudeOpts = {
	center?: boolean,
	convexity?: number,
	twist?: number,
	slices?: number,
	scale?: number,
	fn?: number,
}
export class LinearExtrude extends ParentGeometry<V3> {
	opts: LinearExtrudeOpts;
	height: number;
	// get size() {
	// 	return [super.size[0], super.size[1], this.height];
	// }
	constructor(height: number, opts: LinearExtrudeOpts, children: Geometry2D|Geometry2D[]) {
		// Seems like typescript should fail on this, but oh well.
		super(children);
		this.height = height;
		this.opts = opts;
	}
	getCode(): string[] {
		return [`linear_extrude(` +
				`height=${this.height}` +
				(this.opts.center    == undefined ? '' : ` , center=${this.opts.center}`) +
				(this.opts.convexity == undefined ? '' : ` , convexity=${this.opts.convexity}`) +
				(this.opts.twist     == undefined ? '' : ` , twist=${this.opts.twist}`) +
				(this.opts.slices    == undefined ? '' : ` , slices=${this.opts.slices}`) +
				(this.opts.scale     == undefined ? '' : ` , scale=${this.opts.scale}`) +
				(this.opts.fn        == undefined ? '' : ` , $fn=${this.opts.fn}`) +
				`) {`,
				 ...this.indentChildCode(),
				'}',
			];
	}
}

// TODO support taking a path instead of a geometry
export function linearExtrude(height: number, opts={}, children: Geometry2D|Geometry2D[]) {
	return new LinearExtrude(height, opts, children);
}

export class Polygon extends BaseGeometry2D {
	points: Array<V2>;
	constructor(points: Array<V2>) {
		super();
		this.points = points;
	}
	getCode(): string[] {
		return [`polygon(${JSON.stringify(this.points)});`];
	}
}
export function polygon(points: V2[]) {
	return new Polygon(points);
}

////////////////////////////////////////////////////////////////////////
//                               PATHS                                //
////////////////////////////////////////////////////////////////////////

export type PathAnnotation = {
	chamfer?: number;
}

export type AnnotatedPath = Array<[ number, number, PathAnnotation ]>;
export function tweakPath(path: AnnotatedPath): V2[] {
	const aToP: (a: Parameters<typeof tweakPath>[0][0]) => V2 = (a) => [a[0], a[1]];
	return getPathThruples(path)
		.flatMap(pointSet => {
		let midPoint = pointSet[1];
		if (midPoint[2].chamfer && midPoint[2].chamfer != 0) {
			let ps: [V2, V2, V2] = [aToP(pointSet[0]), aToP(pointSet[1]), aToP(pointSet[2])];
			return chamferPoints(ps, midPoint[2].chamfer);
		} else {
			return [aToP(midPoint)];
		}
	});
}



interface UnitArcOpts {
	steps?: number;
	fn?: number;
	$fn?: number;
}

// TODO add opts
/*
 * Returns a path that describes an arc on the unit circle.
 * Can pass both a start and end angle (in degrees), or just an end angle and
 * the arc will be started from the positive x axis.
 */
export function unitArc(degrees: number, opts?: UnitArcOpts): Path;
export function unitArc(start: number, end: number, opts?: UnitArcOpts): Path;
export function unitArc(a: number, b?: number|UnitArcOpts, c?: UnitArcOpts): Path {
	let defaultOpts = { steps: 8 };
	let end_rads: number, start_rads: number;
	let opts: UnitArcOpts & { steps: number };
	if (typeof b == "number") {
		let start = a;
		let end = b;
		start_rads = start / 180 * Math.PI;
		end_rads = (end - start) / 180 * Math.PI;
		opts = { ... defaultOpts, ... c };
	} else {
		start_rads = 0;
		end_rads = a / 180 * Math.PI;
		opts = { ... defaultOpts, ... b };
	}

	let steps = opts.$fn ?? opts.fn ?? opts.steps;

	let points: V2[] = _.range(steps + 1)
		.map(i => [
			Math.cos(start_rads + end_rads * i / steps),
			Math.sin(start_rads + end_rads * i / steps),
		])
	return [...points];
}


type StrokePathOpts = {
	close?: boolean,
	points?: boolean,
	color?: string,
	strokeColor?: string,
	pointColor?: string,
	strokeWidth?: number,
	pointDiam?: number,
}
export function strokePath(p: Path, opts?:StrokePathOpts): Geometry<V2 | V3> {
	let strokeWidth = opts?.strokeWidth ?? 0.5;
	let strokeColor = opts?.strokeColor ?? opts?.color ?? "gold";
	let pointColor = opts?.pointColor ?? opts?.color ?? "red";
	let pointDiam = opts?.pointDiam ?? 2 * strokeWidth;
	let drawPoints: boolean = !! (opts?.points ?? opts?.pointDiam ?? opts?.pointColor)
	let close = !! opts?.close;

	let points = close ? closePath(p) : p

	let defaultStroke: (points: [V2, V2]) => Geometry<V2 | V3> = ([from, to]) => {
		let rot = getVectorAngle(from, to);
		let dist = _distFromTwoPoints(from, to);
		return cube([dist, strokeWidth, 1])
			.translate([0, -strokeWidth / 2, -0.5])
			.rotate([0, 0, rot])
			.translate(from)
			.color(strokeColor)
	};
	let defaultPoint = circle({ d: pointDiam, fn: 12 }).color(pointColor)

	let strokes = chunkChain(points).map(defaultStroke)
	return union([
		...strokes,
		draw_at_points(drawPoints ? points : [], defaultPoint),
	]);
}

////////////////////////////////////////////////////////////////////////
//                             TRANSFORMS                             //
////////////////////////////////////////////////////////////////////////

class VectorTransform<V extends V2|V3, G extends V2|V3> extends ParentGeometry<G> {
	transform: string;
	v: V;
	constructor(transform: string, v: V, g: Geometry<G>|Geometry<G>[]) {
		super(g);
		this.transform = transform;
		this.v = v;
	}
	getCode() { return [
		`${this.transform}(${V2or3toString(this.v)}) {`,
		 ...this.indentChildCode(),
		`}`,
	]}
}

const vectorTransformCurryable =
	(t: string) =>
		<G extends V2|V3>(g: Geometry<G>|Geometry<G>[]) =>
			(v: V2|V3): Geometry<G> =>
				new VectorTransform(t, v, g)
const basicTransform = (t: string) => <G extends V2|V3>(v: V2|V3, g: Geometry<G>|Geometry<G>[]): Geometry<G> => vectorTransformCurryable(t)(g)(v);
export const translate = basicTransform("translate");
export const rotate = basicTransform("rotate");
export const mirror = basicTransform("mirror");
export const scale = basicTransform("scale");

class BooleanTransform<G extends V2|V3> extends ParentGeometry<G> {
	t: string;
	constructor(t: string, g: Geometry<G>[]) {
		super(g);
		this.t = t;
	}
	getCode() { return [
		`${this.t}() {`,
		...this.indentChildCode(),
		`}`,
	]}
}

const booleanTransformCurryable = (t: string) => (...g: Geometry3D[]|Geometry3D[][]) : Geometry3D => {
	let gx = _.flatten(g);
	return new BooleanTransform(t, gx);
}

export const union = booleanTransformCurryable("union");
export const difference = booleanTransformCurryable("difference");
export const intersection = booleanTransformCurryable("intersection");
export const hull = booleanTransformCurryable("hull");

class Highlight<G extends V2|V3> extends ParentGeometry<G> implements Geometry<G> {
	constructor(g: Geometry<G>) {
		super(g);
	}
	getCode() {
		return [ "#", ...this.children.flatMap(c => c.getCode()) ];
	}
}
export const highlight = (g: Geometry3D): Geometry3D => {
	return new Highlight(g);
}

class Color<G extends V2|V3> extends ParentGeometry<G> implements Geometry<G> {
	_color: string;
	constructor(color: string, g: Geometry<G>) {
		super(g);
		this._color = color;
	}
	getCode() {
		return [
			`color("${this._color}") {`,
			...this.children.flatMap(c => c.getCode()),
			"}",
		];
	}
}
export const color = (c: string, g: Geometry3D): Geometry3D => {
	return new Color(c, g);
}

class TextNode<G extends V2|V3> extends BaseGeometry<G> {
	text: string[];
	constructor(text: string|string[]) {
		super();
		this.text = typeof text === "object" ? text : [text];
	}
	getCode() {
		return this.text;
	}
}

export function code<G extends V2|V3>(t:string|string[]) { return new TextNode<G>(t) };
export const comment = <G extends V2|V3>(t:string|string[]|{toString:()=>string}) => {
	let textList: string[];
	if (typeof t === "string") {
		textList = [t];
	} else if (Array.isArray(t)) {
		textList = t;
	} else {
		textList = [t.toString()];
	}
	return new TextNode<G>(textList.flatMap(t => t.split("\n").map(t => "// " + t)))
};

interface TextOpts {
	size?: number,
	font?: string,
	halign?: "left"|"center"|"right",
	valign?: "top"|"center"|"baseline"|"bottom",
	spacing?: number,
	direction?: "ltr"|"rtl"|"ttb"|"btt",
	language?: string,
	script?: string,
	fn?: number,
}
class Text<G extends V2|V3> extends BaseGeometry<G> {
	opts: TextOpts;
	text: string
	constructor(text: string, textOpts?: TextOpts) {
		super();
		this.text = text;
		this.opts = textOpts ?? {};
	}
	getCode() {
		return [`text(${objectToKwargs({text: this.text, ...this.opts})});`];
	}
}

export const text = (text: string, textOpts?:TextOpts) => new Text(text, textOpts);


////////////////////////////////////////////////////////////////////////
//                               UTILS                                //
////////////////////////////////////////////////////////////////////////


export function ensureGeometryList(g: Geometry3D|Geometry3D[]): Geometry3D[] {
	return "getCode" in g ? [g] : g;
}

export const sum = (a: Array<number>) => a.reduce((cum, v) => cum + v); // TODO probably don't keep this.

// PATH UTILS

/*
 * Given a point, rotates it N degrees around the origin counter-clockwise.
 */
export function rotatePointAroundOrigin(v: V2, degrees: number): V2 {
	let theta = - degrees / 180 * Math.PI;
	let r = matrixMultiply(
		[v],
		[[ Math.cos(theta), - Math.sin(theta) ],
		 [ Math.sin(theta),   Math.cos(theta) ]
		]
	);

	return r[0] as V2;
}

export function draw_at_points(points: Array<V2|V3>, children: Geometry<any>|Geometry<any>[]): Geometry<V2|V3> {
	return union(points.map(p => translate(p, children)));
}

export function closePath<T extends V2|V3>(p: T[]): T[] {
	return vEquals(p[0], p.slice(-1)[0]) ? p : [...p, p[0]]
}

/**
 * Takes a list and chunks into chained pairs.
 * E.g. given the list [1, 2, 3, 4] return [[1, 2], [2, 3], [3, 4]]
 */
 // TODO update this to take a number
 // TODO add a param to "wrap"
 // TODO replace getPathThruples with this.
export function chunkChain<T>(a: T[], size?:number, wrap=false) {
	return _.zip(a.slice(0, -1), a.slice(1))
	// Impl notes:
	// 	- First make a list of lists to be zipped...
	// 	- zip them
	// 	- add in the wrap around chunks if necessary
	// 	    - there will be (chunkSize - 1) extra chunks
	// 	- ... maybe will need to check if the path is closed or else wrap=true could give wonky (duplicate) results
}


// TODO support V3s
export function _angleFromTwoPoints(a: V2, b: V2): number {
	let delta = vDelta(a, b);
	let a2 = Math.atan2(delta[1], delta[0]) * 180 / Math.PI;
	return a2;
}

// TODO support V3s
function _distFromTwoPoints(a: V2, b: V2): number {
	return getVectorLength(vDelta(a, b));
}

// Given a list of points, map each point to a "thruple" containing the previous, current and next point. Wraps around to to the end/beginning of the list for first/last points.
// TODO replace with chunkChain<3> when implemented
function getPathThruples<T>(a: Array<T>): Array<[T, T, T]> {
	let r: Array<[T, T, T]> = [];
	if (a.length < 3) {
		throw new Error("Must pass a list of at least three");
	}
	r.push([a[a.length-1], a[0], a[1]]);
	for (let i = 1; i < a.length - 1; i++) {
		r.push([a[i - 1], a[i], a[i+1]]);
	}
	r.push([a[a.length-2], a[a.length-1], a[0]]);
	return r;
}

function objectToKwargs(o: object) {
	return Object.entries(o)
		.filter(([_, v]) => v != undefined)
		.map(([k, v]) => [k == "fn" ? "$fn" : k, v])
		.map(([k, v]) => `${k}=${v}`)
		.join(", ")
		;
}

export function printScadCode(...scad: OpenSCADCode[]) {
	scad.forEach(s => console.log(s.getCode().join("\n")));
}

////////////////////////////////////////////////////////////////////////
//                           TYPE OVERRIDES                           //
////////////////////////////////////////////////////////////////////////

// interface RelativeIndexable<T> {
//     /**
//      * Takes an integer value and returns the item at that index,
//      * allowing for positive and negative integers.
//      * Negative integers count back from the last item in the array.
//      */
//     at(index: number): T | undefined;
// }
// interface Array<T> extends RelativeIndexable<T> {
// 	// length: Array['length'];
// 	x: T | undefined;
// 	y: T | undefined;
// 	z: T | undefined;
// }

// type x = Array<any>['length']

// Object .defineProperty(Array.prototype, "x", { get() { return this[0]; } });
// Object .defineProperty(Array.prototype, "y", { get() { return this[1]; } });
// Object .defineProperty(Array.prototype, "z", { get() { return this[2]; } });
