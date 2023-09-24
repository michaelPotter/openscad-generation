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

	union:        booleanTransform<G>;
	difference:   booleanTransform<G>;
	intersection: booleanTransform<G>;

	highlight : () => Geometry<G>;

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

	union:        booleanTransform<G> = (g) => booleanTransformCurryable("union")([ this, ...ensureGeometryList(g) ]);
	difference:   booleanTransform<G> = (g) => booleanTransformCurryable("difference")([this, ...ensureGeometryList(g)]);
	intersection: booleanTransform<G> = (g) => booleanTransformCurryable("intersection")([this, ...ensureGeometryList(g)]);

	highlight: () => Geometry<G> = () => newHighlight(this);

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
				`height=${this.height}, ` +
				`convexity=${this.opts.convexity}, ` +
				`twist=${this.opts.twist}, ` +
				`slices=${this.opts.slices}, ` +
				`scale=${this.opts.scale}, ` +
				`$fn=${this.opts.fn} ` +
				`) {`,
				 ...this.indentChildCode(),
				'}',
			];
	}
}

////////////////////////////////////////////////////////////////////////
//                               PATHS                                //
////////////////////////////////////////////////////////////////////////

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
const newHighlight = (g: Geometry3D): Geometry3D => {
	return new Highlight(g);
}

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
	let wheel = cylinder({h:3,r:8, center:true}).rotate([90,0,0])
	return union([
		cube([60,20,10], {center:true}),
		cube([30,20,20], {center:true}).up(10).right(5),
		wheel.translate([-20, -15, 0]),
		wheel.translate([-20, 15, 0]),
	]);
};
// console.log(car().serialize());

function dumpster() : Geometry3D {
	return importFile("/home/mlpotter/Downloads/prints/1_18_scale_Garbage_Dumpster_2940197/files/dtg_dumpster.stl");
}
// console.log(dumpster().serialize());

function test_2d() : Geometry<V2> {
	return square([10, 10]).difference(circle({r:5}));
}
console.log(test_2d().serialize());

// console.log(g.getCode().join('\n'))  // TODO DELETE ME
// console.log(g2.getCode().join('\n'))  // TODO DELETE ME
