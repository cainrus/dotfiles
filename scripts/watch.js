#!/usr/bin/env node
var exec = require('child_process').exec;
var m30 = 1000 * 60 * 30;

function iteration(){
	console.log(`interval: ${m30}ms`);
    var cmd = './start.js';
    exec(cmd, function(error, stdout, stderr) {
	    if (error) console.log(error, stderr);
	    console.log(stdout);
    });
};

setInterval(iteration, m30);

iteration();