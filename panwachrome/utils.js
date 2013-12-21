// Released under MIT License by Luigi Mori. January 2013.

var P = P || {};

P.identity = function(x) { return x; };

P.mul8 = function(x) { return x*8; };

P.objectGoTo = function(a, o) {
	if(typeof a == "string") {
		a = a.split('.');
	}
	for(var j = 0; j < a.length; j++) {
		o = o[a[j]];
		if(typeof o == "undefined") {
			return null;
		}
	}
	
	return o;
};

P.childrenToObect = function($x, pnames) {
	var o = {};
	var tn;
	pnames = pnames || [];
	
	$x.children().each(function() {
		tn = $(this).prop('tagName');
		if (pnames.length === 0 || pnames.indexOf(tn) != -1) {
			o[tn] = $(this).text();
		}
	});
	
	return o;
};

P.childrenTextToArray = function($x, pname) {
	pname = pname || "*";
	var res = [];

	$x.children().each(function() {
		res.push($(this).text());
	});

	return res;
};

P.camelMax = function(array) {
	var max = -Infinity;

	for(var j = 0; j < array.length; j = j+2) {
		if(array[j] > max) max = array[j];
	}

	return max;
};

P.arrayOf = function(n, c) {
	var r = [];
	for(var j = 0; j < n; j++) r.push(c(j));
	return r;
};
P.arrayOfArray = function(n) {
	return P.arrayOf(n, function(n) { return Array.prototype.constructor(); });
};

P.sumArray = function(a) {
	return a.reduce(function(p,c) { return p+c; }, 0);
};

// add to RSVP
RSVP.EventTarget.triggerDetach = function(eventName, options) {
	var self = this;
	setTimeout(function() { self.trigger(eventName, options); }, 0);
};
RSVP.EventTarget.mixin = function(object) {
	object.on = this.on;
	object.off = this.off;
	object.trigger = this.trigger;
	object.triggerDetach = this.triggerDetach;
	
	return object;
};
