'use strict';

import _ from 'underscore';

export type V3 = [number, number, number];
export type V2 = [number, number];
export type Path = V2[];

type vectorTransform<G extends V2|V3> = (v: V2|V3) => Geometry<G>
type booleanTransform<G extends V2|V3> = (g:Geometry<G>|Geometry<G>[]) => Geometry<G>

export interface OpenSCADCode {
	getCode: () => string[];
}

export interface Geometry<G extends V2|V3> extends OpenSCADCode {
	getSize: () => V3;

	translate: vectorTransform<G>;
	rotate:    vectorTransform<G>;
	mirror:    vectorTransform<G>;
	scale:     vectorTransform<G>;

	union:        booleanTransform<G>;
	difference:   booleanTransform<G>;
	intersection: booleanTransform<G>;

	linear_extrude : (n: number, o?:LinearExtrudeOpts) => Geometry<V3>;

	highlight : () => Geometry<G>;
	hash      : () => Geometry<G>; // Alias for highlight
	color     : (c: string) => Geometry<G>;

	up    : (n: number) => Geometry<G>;
	down  : (n: number) => Geometry<G>;
	left  : (n: number) => Geometry<G>;
	right : (n: number) => Geometry<G>;
	fwd   : (n: number) => Geometry<G>;
	back  : (n: number) => Geometry<G>;

	serialize: () => string;
}

export interface Geometry2D extends Geometry<V2> {
}
export interface Geometry3D extends Geometry<V2> {
}

export class BaseGeometry<G extends V2|V3> implements Geometry<G> {
	getCode() { return [""]; }
	getSize(): V3 { return [0, 0, 0]; }

	translate: vectorTransform<G> = vectorTransformCurryable("translate")(this);
	rotate   : vectorTransform<G> = vectorTransformCurryable("rotate")(this);
	mirror   : vectorTransform<G> = vectorTransformCurryable("mirror")(this);
	scale    : vectorTransform<G> = vectorTransformCurryable("scale")(this);

	union:        booleanTransform<G> = (g) => booleanTransformCurryable("union")([ this, ...ensureGeometryList(g) ]);
	difference:   booleanTransform<G> = (g) => booleanTransformCurryable("difference")([this, ...ensureGeometryList(g)]);
	intersection: booleanTransform<G> = (g) => booleanTransformCurryable("intersection")([this, ...ensureGeometryList(g)]);

	linear_extrude: Geometry<G>['linear_extrude'] = (h, o?) => new LinearExtrude(h, o ?? {}, [this]);

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
class BaseGeometry3D extends BaseGeometry<V3> {
}
class BaseGeometry2D extends BaseGeometry<V2> {
}

// TODO think this through some more, can we have it both ways?
// Is there a way to make G be V2 if it only contains 2D children, but 3D if it contains any 3D children??
class ParentGeometry<G extends V2|V3> extends BaseGeometry<G> {
	children: Geometry<G>[];
	constructor(children: Geometry<G>|Geometry<G>[]) {
		super();
		this.children = ensureGeometryList(children);
	}
	indentChildCode(): string[] {
		return this.children.flatMap(g => g.getCode().map(l => "  " + l))
	}
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
	let layers_closed = layers.map(l => {
		return vEquals(l[0], l.slice(-1)[0]) ? l : [...l, l[0]]
	});
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


export interface turtle {
	getPath: () => V2[];
	// jump: (v:V2) => turtle;
	north: (n:number) => turtle;
	south: (n:number) => turtle;
	east:  (n:number) => turtle;
	west:  (n:number) => turtle;
	// chamfer: (n:number) => turtle;
}

export class Turtle implements turtle {
	path: V2[];
	pen = {
		x: 0,
		y: 0,
	};
	pending_operation: null|{
		chamfer?: number,
	} = null;
	constructor(startingPoint: V2 = [0,0]) {
		this.path = [startingPoint];
		this.pen.x = startingPoint[0];
		this.pen.y = startingPoint[1];
	}

	// // Sets the turtle to an exact position without drawing a path
	// jump(v:V2) {
	// 	this.pen.x = v[0];
	// 	this.pen.y = v[1];
	// 	return this;
	// }
	// Moves the turtle in the positive Y direction
	north(n:number) {
		this.pen.y += n;
		this.stepTurtle();
		return this;
	}
	// Moves the turtle in the negative Y direction
	south(n:number) {
		this.pen.y -= n;
		this.stepTurtle();
		return this;
	}
	// Moves the turtle in the positive X direction
	east(n:number) {
		this.pen.x += n;
		this.stepTurtle();
		return this;
	}
	// Moves the turtle in the negative X direction
	west(n:number) {
		this.pen.x -= n;
		this.stepTurtle();
		return this;
	}
	chamfer(n:number) {
		this.pending_operation = {chamfer: n}
		return this;
	}

	stepTurtle() {
		let penPoint: V2 = [ this.pen.x, this.pen.y ];
		if (this.pending_operation?.chamfer) {
			let chamfer = this.pending_operation.chamfer;
			let midPoint = this.path.pop();
			let startPoint = this.path.pop();
			if (midPoint && startPoint) {
				let newPoints = chamferPoints([startPoint, midPoint, penPoint], chamfer);
				this.path.push(startPoint);
				this.path.push(...newPoints);
				this.path.push(penPoint);
				this.pending_operation = null;
			} else {
				console.warn("Too few points in turtle path to chamfer?");
			}
		} else {
			this.path.push(penPoint);
		}
	}
	getPath() {
		return this.path;
	}

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
const booleanTransformCurryable = (t: string) => (g: Geometry3D[]) : Geometry3D => {
	return new BooleanTransform(t, g);
}

export const union = booleanTransformCurryable("union");
export const difference = booleanTransformCurryable("difference");
export const intersection = booleanTransformCurryable("intersection");

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

export function V2toString(v: V2): string {
	return `[${v[0]}, ${v[1]}]`;
}
export function V3toString(v: V3): string {
	return `[${v[0]}, ${v[1]}, ${v[2]}]`;
}
export function V2or3toString(v: V2|V3): string {
	return v.length == 2 ? V2toString(v) : V3toString(v);
}
export function vEquals(v1: V2|V3, v2: V2|V3): boolean {
	return v1.length === v2.length &&
		v1[0] == v2[0] &&
		v1[1] == v2[1] &&
		v1[2] == v2[2]
}

export function setZ(v: V2|V3, z: number): V3 {
	return [v[0], v[1], z];
}

export function ensureGeometryList(g: Geometry3D|Geometry3D[]): Geometry3D[] {
	return "getCode" in g ? [g] : g;
}

export const sum = (a: Array<number>) => a.reduce((cum, v) => cum + v); // TODO probably don't keep this.

export function draw_at_points(points: Array<V2|V3>, children: Geometry<any>|Geometry<any>[]): Geometry<V2|V3> {
	return union(points.map(p => translate(p, children)));
}

// Given a list of points, map each point to a "thruple" containing the previous, current and next point. Wraps around to to the end/beginning of the list for first/last points.
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

// Given 3 points, chamfer the middle point and return two points that would replace it.
function chamferPoints(ps: [V2, V2, V2], chamfer:number): [V2, V2] {
	let pointSet = ps.map(p => ({x: p[0], y: p[1], a: [2]}));
	let midPoint = pointSet[1];
	let theta1 = Math.atan((pointSet[0].y - midPoint.y) / (pointSet[0].x - midPoint.x))
	let theta2 = Math.atan((pointSet[2].y - midPoint.y) / (pointSet[2].x - midPoint.x))
	return [
		[
			midPoint.x + chamfer*Math.cos(theta1) * Math.sign(pointSet[0].x - midPoint.x),
			midPoint.y + chamfer*Math.sin(theta1),
		],
		[
			midPoint.x + chamfer*Math.cos(theta2) * Math.sign(pointSet[2].x - midPoint.x),
			midPoint.y + chamfer*Math.sin(theta2),
		],
	];
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
