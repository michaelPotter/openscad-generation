import * as scad from './src/scad';
import {
	Geometry,
	sum,
	AnnotatedPath,
    tweakPath,
    union,
    polyhedronByLayers,
    setZ,
    text,
    difference,
    Polygon,
} from './src/scad';
// Object.assign(global, scad);

function sharpeningJig() {
	const INCH = 25.4;
	let top_lengths = [50,30];
	let bot_lengths = [38,40];
	let sep_min_width = 4;
	let fence_height = 5;

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
	let turtlePath = new scad.Turtle([0,1])
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

	// turtlePath = new scad.Turtle([0,1])
	// 	.north(5)
	// 	.east(5)
	// 	.south(5)
	// 	.west(5)
	// 	.getPath()


	path = turtlePath;
	scad.printScadCode(scad.comment(JSON.stringify(path)))
	scad.printScadCode(scad.comment(path.length.toString()))

	// path = [[0,0], [0,10], [10,10], [10,0]];

	let t = (t:string) => text(t + " mm", {"halign":"center"})
		.right(base_size[0]/2)
		.linear_extrude(0.3)
		.back(5)
		.mirror([0,0,1])
		.up(0.01);

	return difference([
		polyhedronByLayers([
			path.map(p => setZ(p, 0)).reverse(),
			path.map(p => setZ(p, base_size[0])).reverse(),
		]),
		// new Polygon(path).linear_extrude(2*INCH),
		t(top_lengths[0].toString()).rotate([0,-90,0]),
		t(bot_lengths[0].toString()).rotate([0,90,0]).right(base_size[2]).up(base_size[0]),
		t(top_lengths[1].toString()).rotate([0,0,180]).rotate([0,-90,0]).up(base_size[0]).back(base_size[1]),
		t(bot_lengths[1].toString()).rotate([0,0,180]).rotate([0,90,0]).right(base_size[2]).back(base_size[1]),
		// draw_at_points(path, sphere({r:0.5, fn:32})).color("red").translate([0,0,1]),
		// comment(JSON.stringify(profile.slice(0, 3), null, 2)),
		// comment(JSON.stringify(path.slice(0, 4), null, 2)),
		// comment(JSON.stringify(turtlePath, null, 2)),
	])
}

scad.printScadCode(sharpeningJig());
