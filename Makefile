run-d:
	echo test.ts | entr -cs 'ts-node ./test.ts | tee test.scad'
