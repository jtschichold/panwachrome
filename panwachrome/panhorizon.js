/* Released under MIT License by Luigi Mori. January 2013 */
/* this is a pathetic hack to generate an horizon chart using flot */
/* XXX should be redesigned to become something serious */

var panhorizon = panhorizon || {};

panhorizon.phplot = function($divs, values, options) {
	var convertData = function(od, ns, max, label) {
		var result;

		result = P.arrayOf(ns, function() { return { data: [] }; });
		for(var i = 0; i < od.length; i++) {
			var tv = parseInt(od[i][1]);
			/*if(tv == "0") tv = Math.floor(Math.random() * 101);*/ // XXX used for testing
			for(var k = 0; k < ns; k++) {
				var v2p = Math.min(tv, max);
				result[k].data.push([od[i][0], v2p]);
				tv = tv - v2p;
			}
		}
		result[0].label = label;

		return result;
	};

	options = options || {};
	var eheight = options.maxElementHeight || 50;
	var cv;
	var nvalues, nseries, maxserie;
	var theight = 0;

	nseries = 4;
	maxserie = 25;

	if(values.length === 0) return;
	console.assert((values.length <= $divs.length));

	// draw the first with the grid and axes (I know, this is pathetic)
	cv = values.length-1;
	nvalues = convertData(values[cv].data, nseries, maxserie, values[cv].label);
	var $d = $divs.eq(cv).addClass('horizonflot').height(eheight);
	var p = $.plot($d, nvalues, {
		grid: { show: true, margin: 0, borderWidth: 0, minBorderMargin: 0 },
		series: { lines: { show: true, fill: 1, lineWidth: 0 }, 
		points: { show: false } },
		yaxis: { show: false, tickDecimals: 0, minTickSize: 1, min: 0, max: maxserie },
		xaxis: { show: true, tickColor: "rgba(255, 255, 255, 0)", timezone: "browser", mode: "time" },
		legend: { position: 'nw', showColorBox: false }, 
		colors: ["#bdd7e7", "#6baed6", "#3182bd", "#08519c"]
	});
	theight = eheight;
	eheight = eheight - p.getXAxes()[0].box.height;

	// the additional series without grid
	for(cv = cv-1; cv >= 0; cv--) {
		nvalues = convertData(values[cv].data, nseries, maxserie, values[cv].label);

		var $d = $divs.eq(cv).addClass('horizonflot').height(eheight);
		$.plot($d, nvalues, {
			grid: { show: false },
			series: { lines: { show: true, fill: 1, lineWidth: 0 }, 
			points: { show: false } },
			yaxis: { show: false, tickDecimals: 0, minTickSize: 1, min: 0, max: maxserie },
			xaxis: { show: false, timezone: "browser", mode: "time" },
			legend: { position: 'nw', showColorBox: false }, 
			colors: ["#bdd7e7", "#6baed6", "#3182bd", "#08519c"]
		});
		theight = theight + eheight;
	}
};