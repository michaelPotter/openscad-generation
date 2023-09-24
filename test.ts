'use strict';

type vectorTransform = (v: V3) => Geometry3D
type booleanTransform = (g:Geometry3D|Geometry3D[]) => Geometry3D

interface Geometry3D {
	getCode: () => string[];
	getSize: () => V3;

	translate: vectorTransform;
	rotate: vectorTransform;
	mirror: vectorTransform;

	union: booleanTransform;
	difference: booleanTransform;
	intersection: booleanTransform;

	highlight : () => Geometry3D;

	up    : (n: number) => Geometry3D;
	down  : (n: number) => Geometry3D;
	left  : (n: number) => Geometry3D;
	right : (n: number) => Geometry3D;
	fwd   : (n: number) => Geometry3D;
	back  : (n: number) => Geometry3D;

	serialize: () => string;
}

type V3 = [number, number, number];
type V2 = [number, number];

class BaseGeometry3D implements Geometry3D {
	getCode() { return [""]; }
	getSize(): V3 { return [0, 0, 0]; }

	translate = vectorTransformCurryable("translate")(this);
	rotate = vectorTransformCurryable("rotate")(this);
	mirror = vectorTransformCurryable("mirror")(this);

	union:        booleanTransform = (g) => booleanTransformCurryable("union")([ this, ...ensureGeometryList(g) ]);
	difference:   booleanTransform = (g) => booleanTransformCurryable("difference")([this, ...ensureGeometryList(g)]);
	intersection: booleanTransform = (g) => booleanTransformCurryable("intersection")([this, ...ensureGeometryList(g)]);

	highlight: () => Geometry3D = () => newHighlight(this);

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

class ParentGeometry extends BaseGeometry3D {
	children: Geometry3D[];
	constructor(children: Geometry3D|Geometry3D[]) {
		super();
		this.children = ensureGeometryList(children);
	}
}

////////////////////////////////////////////////////////////////////////
//                              GEOMETRY                              //
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
//                             TRANSFORMS                             //
////////////////////////////////////////////////////////////////////////

class VectorTransform extends ParentGeometry {
	transform: string;
	v: V3;
	constructor(transform: string, v: V3, g: Geometry3D|Geometry3D[]) {
		super(g);
		this.transform = transform;
		this.v = v;
	}
	getCode() { return [
		`${this.transform}(${V3toString(this.v)}) {`,
		 ...this.children.flatMap(g => g.getCode().map(l => "  " + l)),
		`}`,
	]}
}

const vectorTransformCurryable =
	(t: string) =>
		(g: Geometry3D|Geometry3D[]) =>
			(v: V3): Geometry3D =>
				new VectorTransform(t, v, g)
const basicTransform = (t: string) => (v: V3, g: Geometry3D|Geometry3D[]): Geometry3D => vectorTransformCurryable(t)(g)(v);
const translate = basicTransform("translate");
const rotate = basicTransform("rotate");
const mirror = basicTransform("mirror");

class BooleanTransform extends ParentGeometry {
	t: string;
	constructor(t: string, g: Geometry3D[]) {
		super(g);
		this.t = t;
	}
	getCode() { return [
		`${this.t}() {`,
		...this.children.flatMap(g => g.getCode().map(l => "  " + l)),
		`}`,
	]}
}
const booleanTransformCurryable = (t: string) => (g: Geometry3D[]) : Geometry3D => {
	return new BooleanTransform(t, g);
}

const union = booleanTransformCurryable("union");
const difference = booleanTransformCurryable("difference");
const intersection = booleanTransformCurryable("intersection");

class Highlight extends ParentGeometry implements Geometry3D {
	constructor(g: Geometry3D) {
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

function V3toString(v: V3): string {
	return `[${v[0]}, ${v[1]}, ${v[2]}]`;
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
console.log(dumpster().serialize());

// console.log(g.getCode().join('\n'))  // TODO DELETE ME
// console.log(g2.getCode().join('\n'))  // TODO DELETE ME
