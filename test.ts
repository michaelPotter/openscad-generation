'use strict';

type V3 = [number, number, number];
type V2 = [number, number];
type Path = V2[];

type vectorTransform<G extends V2|V3> = (v: V2|V3) => Geometry<G>
type booleanTransform<G extends V2|V3> = (g:Geometry<G>|Geometry<G>[]) => Geometry<G>

interface Geometry<G extends V2|V3> {
	getCode: () => string[];
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

interface Geometry2D extends Geometry<V2> {
}
interface Geometry3D extends Geometry<V2> {
}

class BaseGeometry<G extends V2|V3> implements Geometry<G> {
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

type CubeOpts = {center:boolean};
class Cube extends BaseGeometry3D implements Geometry3D {
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

function cube(size: V3, opts?: CubeOpts): Geometry3D {
	return new Cube(size, opts);
}

interface SphereOpts { d?:number , r?:number , fn?:number; }
class Sphere extends BaseGeometry3D {
	params: Required<SphereOpts>;
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
			fn: opts.fn ?? 0,
		}
	}
	getCode() {
		return [`sphere(d=${this.params.d}, $fn=${this.params.fn});`];
	}
}
function sphere(opts: SphereOpts): Geometry3D {
	return new Sphere(opts);
}

interface CylinderOpts { d?:number, r?:number, h: number, fn?:number, center?:boolean }
class Cylinder extends BaseGeometry3D {
	opts: Required<CylinderOpts>;
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
			fn: opts.fn ?? 0,
			center: opts.center ?? false,
		}
	}
	getCode() {
		return [`cylinder(d=${this.opts.d}, h=${this.opts.h}, center=${this.opts.center}, $fn=${this.opts.fn});`];
	}
}
function cylinder(opts: CylinderOpts): Geometry3D {
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
function importFile(path: string) {
	return new ImportedGeometry(path);
}

////////////////////////////////////////////////////////////////////////
//                            2D GEOMETRY                             //
////////////////////////////////////////////////////////////////////////

type SquareOpts = {center:boolean};
class Square extends BaseGeometry2D implements Geometry2D {
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
function square(size: V2, opts?: SquareOpts): Geometry2D {
	return new Square(size, opts);
}

type CircleOpts = {d?:number, r?:number, fn?:number};
class Circle extends BaseGeometry2D implements Geometry2D {
	params: Required<CircleOpts>;
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
			fn: opts.fn ?? 0,
		}
	}
	getCode() {
		return [`circle(d=${this.params.d}, $fn=${this.params.fn});`];
	}
}
function circle(opts: CircleOpts): Geometry2D {
	return new Circle(opts);
}

type LinearExtrudeOpts = {
	center?: boolean,
	convexity?: number,
	twist?: number,
	slices?: number,
	scale?: number,
	fn?: number,
}
class LinearExtrude extends ParentGeometry<V3> {
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
function linearExtrude(height: number, opts={}, children: Geometry2D|Geometry2D[]) {
	return new LinearExtrude(height, opts, children);
}

class Polygon extends BaseGeometry2D {
	points: Array<V2>;
	constructor(points: Array<V2>) {
		super();
		this.points = points;
	}
	getCode(): string[] {
		return [`polygon(${JSON.stringify(this.points)});`];
	}
}
function polygon(points: V2[]) {
	return new Polygon(points);
}

////////////////////////////////////////////////////////////////////////
//                               PATHS                                //
////////////////////////////////////////////////////////////////////////

type PathAnnotation = {
	chamfer?: number;
}

type AnnotatedPath = Array<[ number, number, PathAnnotation ]>;
function tweakPath(path: AnnotatedPath): V2[] {
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


interface turtle {
	getPath: () => V2[];
	jump: (v:V2) => turtle;
	north: (n:number) => turtle;
	south: (n:number) => turtle;
	east:  (n:number) => turtle;
	west:  (n:number) => turtle;
	// chamfer: (n:number) => turtle;
}

class Turtle implements turtle {
	path: V2[] = [[0,0]];
	pen = {
		x: 0,
		y: 0,
	};
	pending_operation: null|{
		chamfer?: number,
	} = null;
	constructor() {
	}

	// Sets the turtle to an exact position
	jump(v:V2) {
		this.pen.x = v[0];
		this.pen.y = v[1];
		return this;
	}
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
const translate = basicTransform("translate");
const rotate = basicTransform("rotate");
const mirror = basicTransform("mirror");
const scale = basicTransform("scale");

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

const union = booleanTransformCurryable("union");
const difference = booleanTransformCurryable("difference");
const intersection = booleanTransformCurryable("intersection");

class Highlight<G extends V2|V3> extends ParentGeometry<G> implements Geometry<G> {
	constructor(g: Geometry<G>) {
		super(g);
	}
	getCode() {
		return [ "#", ...this.children.flatMap(c => c.getCode()) ];
	}
}
const highlight = (g: Geometry3D): Geometry3D => {
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
const color = (c: string, g: Geometry3D): Geometry3D => {
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

const text = <G extends V2|V3>(t:string|string[]) => new TextNode<G>(t);
const comment = <G extends V2|V3>(t:string|string[]) => {
	let textList = typeof t === "object" ? t : [t]
	return new TextNode<G>(textList.flatMap(t => t.split("\n").map(t => "// " + t)))
};


////////////////////////////////////////////////////////////////////////
//                               UTILS                                //
////////////////////////////////////////////////////////////////////////

function V2toString(v: V2): string {
	return `[${v[0]}, ${v[1]}]`;
}
function V3toString(v: V3): string {
	return `[${v[0]}, ${v[1]}, ${v[2]}]`;
}
function V2or3toString(v: V2|V3): string {
	return v.length == 2 ? V2toString(v) : V3toString(v);
}

function ensureGeometryList(g: Geometry3D|Geometry3D[]): Geometry3D[] {
	return "getCode" in g ? [g] : g;
}

const sum = (a: Array<number>) => a.reduce((cum, v) => cum + v); // TODO probably don't keep this.

function draw_at_points(points: Array<V2|V3>, children: Geometry<any>|Geometry<any>[]): Geometry<V2|V3> {
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
	console.log(`// midPoint: `, midPoint)  // TODO DELETE ME
	console.log(`// theta1 / Math.PI: `, theta1 / Math.PI)  // TODO DELETE ME
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

////////////////////////////////////////////////////////////////////////
//                              testing                               //
////////////////////////////////////////////////////////////////////////

function basic_test() {
let g = rotate([0, 0, 45],  translate(
	[0, 10, 5],
	[
		cube([2, 3, 4]),
		cube([4, 3, 2]),
	]
));

let g2 = cube([2,3,4])
	.union(cube([4, 3, 2]))
	.translate([0, 10, 5])
	.rotate([0, 0, 45]);


let sphere_d = 40;
let cyl_d = 20;
let cut_cyl = cylinder({d:cyl_d, h:sphere_d + 10, fn:32}).down(sphere_d/ 2 + 5);
let logo =
	sphere({d:sphere_d, fn:32})
		.difference([
			cut_cyl,
			cut_cyl.rotate([90, 0, 0]).highlight(),
			cut_cyl.rotate([0, 90, 0]),
		]);

console.log(logo.serialize())  // TODO DELETE ME
}

function car() : Geometry3D {
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
// console.log(car().serialize());

function dumpster() : Geometry3D {
	return importFile("/home/mlpotter/Downloads/prints/1_18_scale_Garbage_Dumpster_2940197/files/dtg_dumpster.stl");
}
// console.log(dumpster().serialize());

function test_2d() : Geometry<any> {
	return (
		// linearExtrude(5, {twist:180, center: true}, 
		square([10, 10])
			.difference(circle({r:5}))
			.linear_extrude(4)
		// )
	)
	;
}
// console.log(test_2d().serialize());
function sharpeningJig() : Geometry<any> {
	const INCH = 25.4;
	let lengths = [50, 40, 38, 30];
	let top_lengths = [50,30];
	let bot_lengths = [38,40];
	let sep_min_width = 4;
	let fence_height = 10;

	let base_len = Math.max(sum(top_lengths), sum(bot_lengths)) + sep_min_width;
	// Full size of the thing
	let base_size = [2*INCH, base_len, 3];
	let top_fence_width = base_len - sum(top_lengths);
	let bot_fence_width = base_len - sum(bot_lengths);

	let fence_inset = 1;

	let profile: AnnotatedPath = [
		[fence_height,                  0                         , {}] ,
		[fence_height,                  top_lengths[0]            , {chamfer: 1}] ,
		[0,                             top_lengths[0]            , {chamfer: 1}] ,
		[0,                             base_len - top_lengths[1] , {}] ,
		[fence_height,                  base_len - top_lengths[1] , {}] ,
		[fence_height,                  base_len                  , {}] ,
		[fence_height + base_size[2],   base_len                  , {}] ,
		[fence_height + base_size[2],   base_len - bot_lengths[1] , {}] ,
		[2*fence_height + base_size[2], base_len - bot_lengths[1] , {}] ,
		[2*fence_height + base_size[2], bot_lengths[0]            , {}] ,
		[fence_height + base_size[2],   bot_lengths[0]            , {}] ,
		[fence_height + base_size[2],   0                         , {}] ,
	];

	let path = tweakPath(profile);


	let main_chamfer = 1;
	let inset_chamfer = 0.2;
	let edge_chamfer = 0.2;
	let turtlePath = new Turtle()
		.jump([0,1])
		.north(top_lengths[0] - fence_inset - 1)
		// fence inset
		.chamfer(inset_chamfer).east(fence_inset)
		.chamfer(inset_chamfer).north(fence_inset)
		.chamfer(inset_chamfer).west(fence_inset)
		// top fence
		.west(fence_height)
		.chamfer(main_chamfer).north(top_fence_width)
		.chamfer(main_chamfer).east(fence_height)
		// fence inset
		.east(fence_inset)
		.chamfer(inset_chamfer).north(fence_inset)
		.chamfer(inset_chamfer).west(fence_inset)
		// north top bed
		.chamfer(inset_chamfer).north(top_lengths[1] - fence_inset)
		.chamfer(edge_chamfer).east(base_size[2])
		.chamfer(edge_chamfer).south(bot_lengths[1] - fence_inset)
		.chamfer(inset_chamfer).west(fence_inset)
		.chamfer(inset_chamfer).south(fence_inset)
		.chamfer(inset_chamfer).east(fence_inset)
		// bot fence
		.east(fence_height)
		.chamfer(main_chamfer).south(bot_fence_width)
		.chamfer(main_chamfer).west(fence_height)
		.west(fence_inset)
		.chamfer(inset_chamfer).south(fence_inset)
		.chamfer(inset_chamfer).east(fence_inset)
		.chamfer(inset_chamfer).south(bot_lengths[0] - fence_inset)
		.chamfer(edge_chamfer).west(base_size[2])
		.chamfer(edge_chamfer).north(1)
		.getPath();

	// turtlePath = new Turtle()
	// 	.fwd(5)
	// 	.chamfer(1).right(5)
	// 	.getPath();

	path = turtlePath;

	return union([
		new Polygon(path),
		// draw_at_points(path, sphere({r:0.5, fn:32})).color("red").translate([0,0,1]),
		// comment(JSON.stringify(profile.slice(0, 3), null, 2)),
		// comment(JSON.stringify(path.slice(0, 4), null, 2)),
		comment(JSON.stringify(turtlePath, null, 2)),
	])
}
console.log(sharpeningJig().serialize());

// console.log(g.getCode().join('\n'))  // TODO DELETE ME
// console.log(g2.getCode().join('\n'))  // TODO DELETE ME
