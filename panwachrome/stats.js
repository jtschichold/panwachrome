/*! Released under MIT License by Luigi Mori. January 2013 */

(function(d,w,u) {
	var mdevice;
	var backgroundPage;
	var eventproxy, viewcache;
	var $w;
	var $d;
	var $containermenu;
	var $containermenutool;
	var $main;
	var cdownStart;
	var cdownRAFID;
		
	var itformatter = function(v, axis) {
		var d = 1;
		if (typeof axis != "undefined") {
			d = axis.tickDecimals;
		}
		
		var cs, s = ['', 'K', 'M', 'G', 'T'];
		
		if (v === 0)
			return "0 ";
		if (v < 1)
			return "< 1 ";
		cs = 0;
		while (v >= 1000 && cs < s.length) {
			v = v/1000;
			cs = cs+1;
		}
		
		return v.toFixed(d)+" "+s[cs];
	};
	var percentformatter = function(v, axis) {
		var d = 1;
		if (typeof axis != "undefined") {
			d = axis.tickDecimals;
		}

		if (isNaN(v)) {
			return '--';
		}

		return v.toFixed(d)+"%";
	};
	var numformatter = function(v) {
		var res = [];

		v = v+"";
		while(v.length >= 3) {
			res.unshift(v.slice(-3));
			v = v.slice(0, -3);
		}
		if(v.length > 0) {
			res.unshift(v);
		}
		return res.join(' ');
	};
	
	var rdeltas = {
		'second': 1000,
		'minute': 60*1000,
		'hour': 3600*1000,
		'day': 24*3600*1000,
		'week': 7*24*3600*1000
	};

	var updateSessionsHistoryChart = function() {
		var i, j, dpname, res, lastn, data;
		var values = [];
		var rsel = $('#stats-sessions-hchart-tbar').children('.stats-hchart-rsel').attr('data-range');
		if(typeof rsel == "undefined" || rsel === "") {
			rsel = "second";
		}

		var rdelta = rdeltas[rsel];
		var rname = "session (maximum)";
		if(rsel == 'second') {
			rname = 'session';
		}
		for(j = 0; j < mdevice.sysdefs.numDPs; j++) {
			lastn = null;
			dpname = numDpToDpName(j);
			res = mdevice.dpView[dpname][rsel].res;
			for(i = 0; i < res.length; i++) {
				if(res[i].name == rname) {
					lastn = res[i].lastn;
					break;
				}
			}
			if (!lastn) continue;

			data = [];
			for(i = 0; i < lastn.length; i++) {
				data.push([mdevice.dpView.date-rdelta*i, lastn[i]])
			}
			values.push({ label: dpname+' max', data: data });
		}
		$.plot($("#stats-sessions-hchart"), values, {
			series: { lines: { show: true, fill: true }, points: { show: false } },
			legend: { position: 'nw' },
			yaxis: { tickFormatter: percentformatter, tickDecimals: 0, minTickSize: 1, min: 0, max: 100 },
			xaxis: { timezone: "browser", mode: "time" },
			colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)", "rgb(190, 164, 94)", "rgb(185, 190, 155)", "rgb(139, 157, 190)"]
		});
	};
	var updateSessionsCpsChart = function() {
		mdevice.statsdb.mapLast60Minutes("sessioninfo", function(item) {
			return [item.date, item.cps];
		}, "cps")
		.then(function(values) {
			$.plot($("#stats-sessions-cps"), [values], {
				series: { lines: { show: true, fill: true }, points: { show: false } },
				yaxis: { min: 0, tickDecimals: 0, minTickSize: 1 },
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			});
		},
		function(err) {
			console.error("updateSessionsCpsChart: "+err);
		});
	};
	var updateSessionsDenyChart = function() {
		mdevice.statsdb.mapLast60Minutes("counters", function(item) {
			for(var j = 0; j < item.counters.length; j++) {
				if(item.counters[j].name == "flow_policy_deny") {
					return [item.date, item.counters[j].rate];
				}
			}
			return [item.date, 0];
		}, "flow_policy_deny.rate")
		.then(function(values) {
			$.plot($("#stats-sessions-deny"), [values], {
				series: { lines: { show: true, fill: true }, points: { show: false } },
				yaxis: { min: 0, tickDecimals: 0, minTickSize: 1 },
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			});
		},
		function(err) {
			console.error("updateSessionsDenyChart: "+err);
		});
	};
	var sessionsCurrentTableContents = function() {
		var ihtml = [];

		ihtml.push('<td><div class="stats-label">Active</div><div class="stats-figure chartable" data-aname="num-active">'+numformatter(mdevice.sessioninfoView['num-active'])+'</div></td>');
		ihtml.push('<td><div class="stats-label">TCP</div><div class="stats-figure chartable" data-aname="num-tcp">'+numformatter(mdevice.sessioninfoView['num-tcp'])+'</div></td>');
		ihtml.push('<td><div class="stats-label">UDP</div><div class="stats-figure chartable" data-aname="num-udp">'+numformatter(mdevice.sessioninfoView['num-udp'])+'</div></td>');
		ihtml.push('<td><div class="stats-label">ICMP</div><div class="stats-figure chartable" data-aname="num-icmp">'+numformatter(mdevice.sessioninfoView['num-icmp'])+'</div></td>');
		ihtml.push('<td><div class="stats-label">Bcast</div><div class="stats-figure chartable" data-aname="num-icmp">'+numformatter(mdevice.sessioninfoView['num-bcast'])+'</div></td>');
		ihtml.push('<td><div class="stats-label">Mcast</div><div class="stats-figure chartable" data-aname="num-icmp">'+numformatter(mdevice.sessioninfoView['num-mcast'])+'</div></td>');

		return ihtml.join('');
	};
	var sessionAdvancedTableContents = function() {
		var ihtml = [];

		var ssv = mdevice.sessionAdvancedView;

		ihtml.push("<tr>");
		ihtml.push('<td><div class="stats-label">active</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.active)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">closed</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.closed)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">closing</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.closing)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">discard</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.discard)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">initial</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.initial)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">opening</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.opening)) : "--")+'</div></td>');
		ihtml.push("</tr>");
		ihtml.push("<tr>");
		ihtml.push('<td><div class="stats-label">decrypt</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.decrypt)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">unknown-tcp</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.unknowntcp)) : "--")+'</div></td>');
		ihtml.push('<td><div class="stats-label">unknown-udp</div><div class="stats-figure">'+(ssv ? numformatter(P.sumArray(ssv.unknownudp)) : "--")+'</div></td>');
		ihtml.push('<td></td>');
		ihtml.push('<td></td>');
		ihtml.push('<td></td>');
		ihtml.push("</tr>");

		return ihtml.join('');
	};
	var sessionPerVsysTableContents = function() {
		var ihtml = [];
		var spv = mdevice.sessionPerVsysView;

		var row = [];
		for(var j = 0; j < spv.perVsys.length; j++) {
			row.push('<td><div class="stats-label">'+spv.perVsys[j].name+'</div><div class="stats-figure">'+numformatter(P.sumArray(spv.perVsys[j].total))+'</div></td>');
			if(row.length == 6) {
				ihtml.push('<tr>'+row.join('')+'</tr>');
				row = [];
			}
		}
		if(row.length != 0) {
			ihtml.push('<tr>'+row.join('')+P.arrayOf(6-row.length, function(j) { return '<td></td>'; })+'</tr>');
		}

		return ihtml.join('');
	};
	var refreshSessionStates = function() {
		var $ssr = $("#stats-sessions-refresh");
		if ($ssr.hasClass("fa-spin")) 
			return;
		$ssr.addClass("fa-spin");
		backgroundPage.panachrome.updateSessionAdvancedView(mdevice);
	};
	var refreshSessionPerVsys = function() {
		var $spvr = $("#stats-sessions-pervsys-refresh");
		if ($spvr.hasClass("fa-spin"))
			return;
		$spvr.addClass("fa-spin");
		backgroundPage.panachrome.updateSessionPerVsysView(mdevice);
	};
	var updateSessionAdvancedStats = function() {
		var tc;
		if (mdevice.sessionAdvancedView) {
			$("#stats-sessions-states-lastpoll").text(mdevice.sessionAdvancedView.lastPoll.toLocaleString());
			tc = sessionAdvancedTableContents();
		} else {
			tc = "<tr><td><i>Click the refresh icon to retrieve these stats</i></td></tr>";			
		}
		$('#stats-sessions-advanced tbody').empty().html(tc);
		
		var $ssr = $("#stats-sessions-refresh");
		$ssr.removeClass("fa-spin");
	};
	var updateSessionPerVsysStats = function() {
		var tc;

		if(mdevice.sessionPerVsysView && mdevice.sessionPerVsysView.inPolling) {
			$("#stats-sessions-pervsys-refresh").addClass("fa-spin");
			return;
		}

		if (mdevice.sessionPerVsysView && mdevice.sessionPerVsysView.lastPoll) {
			$("#stats-sessions-pervsys-lastpoll").text(mdevice.sessionPerVsysView.lastPoll.toLocaleString());
			tc = sessionPerVsysTableContents();
		} else {
			tc = "<tr><td><i>Click the refresh icon to retrieve these stats</i></td></tr>";
		}
		$("#stats-sessions-pervsys tbody").empty().html(tc);
		$("#stats-sessions-pervsys-refresh").removeClass("fa-spin");
	};
	var updateSessions = function(event) {
		if(event.type == "dpview:update") {
			updateSessionsHistoryChart();
		}
		if(event.type == "sessioninfoview:update") {
			var t = sessionsCurrentTableContents();
			$('#stats-sessions-current tbody').empty().html(t);
			updateSessionsCpsChart();
		}
		if(event.type == "countersview:update") {
			updateSessionsDenyChart();
		}
	};
	var changeRangeSelectionSessions = function() {
		var $t = $(this);
		if($t.hasClass('stats-hchart-rsel')) {
			return;
		}
		$t.parent().children('span').removeClass('stats-hchart-rsel');
		$t.addClass('stats-hchart-rsel');
		updateSessionsHistoryChart();
	};
	var showTCSessionsCurrent = function() {
		$containermenu.removeClass('containermenu-show');

		var $t = $(this);
		var aname = $t.attr('data-aname');
		var title = $t.prev('div').text();
		
		$('#tc-title').text(title+" sessions - last 60 minutes");
		$('#tc-overlay').show();

		mdevice.statsdb.mapLast60Minutes("sessioninfo", function(item) {
			return [item.date, item[aname]];
		}, aname)
		.then(function(values) {
			$.plot($("#tc-chart"), [values], {
				series: { lines: { show: true, fill: true }, points: { show: false } },
				yaxis: { tickDecimals: 0, minTickSize: 1, min: 0 },
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			});
		},
		function(err) {
			console.error("showTCSessionInfo: "+err);
		});
	};
	var displaySessions = function() {
		var ihtml;

		$('#main').html('<div id="mainheader">Sessions</div>');

		ihtml = [];
		ihtml.push('<div class="mainsection"><span class="sectiontitle">CURRENT</span></div>');
		ihtml.push('<table id="stats-sessions-current"><tbody>');
		ihtml.push(sessionsCurrentTableContents());
		ihtml.push('</tbody></table>');
		$('#main').append(ihtml.join(''));

		ihtml = [];
		ihtml.push('<div class="mainsection"><span class="sectiontitle">SESSION TABLE USAGE</span></div>');
		ihtml.push('<div id="stats-sessions-hchart-tbar" class="stats-hchart-tbar">last <span class="stats-hchart-rsel" data-range="second">60s</span> <span data-range="minute">60m</span> <span data-range="hour">24h</span> <span data-range="day">7d</span> <span data-range="week">13w</span></div>');
		ihtml.push('<div id="stats-sessions-hchart" class="stats-hchart-full"></div>');
		$('#main').append(ihtml.join(''));
		$('#stats-sessions-hchart-tbar').on('click', 'span', changeRangeSelectionSessions);
		updateSessionsHistoryChart();
		
		ihtml = [];
		ihtml.push('<div class="stats-col1">');
		ihtml.push('<div class="mainsection"><span class="sectiontitle">CPS</span></div>');
		ihtml.push('<div id="stats-sessions-cps"></div>');
		ihtml.push('</div>');
		$('#main').append(ihtml.join(''));
		updateSessionsCpsChart();
		
		ihtml = [];
		ihtml.push('<div class="stats-col2">');
		ihtml.push('<div class="mainsection"><span class="sectiontitle">POLICY DENY RATE</span></div>');
		ihtml.push('<div id="stats-sessions-deny"></div>');
		ihtml.push('</div>');
		$('#main').append(ihtml.join(''));
		updateSessionsDenyChart();

		$('#main').append('<div style="display: block; clear: both;"></div>');

		ihtml = [];
		ihtml.push('<div class="mainsection"><span class="sectiontitle"><i class="fa fa-flask"></i> ADVANCED STATS</span></div>');
		ihtml.push('<div>last poll <span id="stats-sessions-states-lastpoll">--</span> (<i id="stats-sessions-refresh" title="refresh" class="fa fa-refresh"></i>)</div>');
		ihtml.push('<table id="stats-sessions-advanced"><tbody>');
		ihtml.push('</tbody></table>');
		$('#main').append(ihtml.join(''));
		updateSessionAdvancedStats();

		if (mdevice.multivsys) {
			ihtml = [];
			ihtml.push('<div class="mainsection"><span class="sectiontitle"><i class="fa fa-flask"></i> PER-VSYS</span></div>');
			ihtml.push('<div>last poll <span id="stats-sessions-pervsys-lastpoll">--</span> (<i id="stats-sessions-pervsys-refresh" title="refresh" class="fa fa-refresh"></i>)</div>');
			ihtml.push('<table id="stats-sessions-pervsys"><tbody>');
			ihtml.push('</tbody></table>');
			$('#main').append(ihtml.join(''));
			updateSessionPerVsysStats();
		}

		$('#stats-sessions-refresh').on('click', refreshSessionStates);
		$('#stats-sessions-current').on('click', '.chartable', showTCSessionsCurrent);

		eventproxy.on("dpview:update", updateSessions);
		eventproxy.on("countersview:update", updateSessions);
		eventproxy.on("sessioninfoview:update", updateSessions);
		eventproxy.on("sessionadvancedview:update", updateSessionAdvancedStats);

		if (mdevice.multivsys) {
			$('#stats-sessions-pervsys-refresh').on('click', refreshSessionPerVsys);
			eventproxy.on("sessionpervsysview:update", updateSessionPerVsysStats);
		}
	};

	// Resources
	var resourcesMpcpuTableFields = [
		['user', 'us'],
		['hw irq', 'hi'],
		['nice', 'ni'],
		['sw irq', 'si'],
		['steal', 'st'],
		['system', 'sy'],
		['io wait', 'wa']
	];
	var updateResourcesMpcpuTable = function() {
		var $mpcharts = $("#stats-resources-mpcpu .piechart");

		for(var j = 0; j < resourcesMpcpuTableFields.length; j++) {
			var $cc = $mpcharts.filter('*[data-aname="'+resourcesMpcpuTableFields[j][1]+'"]');
			$cc.data('easyPieChart').update(+mdevice.cpView.cpu[resourcesMpcpuTableFields[j][1]]);
			$cc.children('.stats-figure').text(percentformatter(+mdevice.cpView.cpu[resourcesMpcpuTableFields[j][1]]));
		}
	};
	var resourcesMpcpuTableContents = function() {
		var ihtml = [];

		for(var j = 0; j < resourcesMpcpuTableFields.length; j++) {
			ihtml.push('<td><div class="stats-label">'+resourcesMpcpuTableFields[j][0]+'</div><div class="piechart chartable" data-percent="0" data-aname="'+resourcesMpcpuTableFields[j][1]+'"><div class="stats-figure">0%</div></div></td>');
		}

		return ihtml.join('');
	};
	var updateResourcesMpmemory = function() {
		var memusage = (parseInt(mdevice.cpView.memory.used, 10)*100)/(parseInt(mdevice.cpView.memory.free, 10)+parseInt(mdevice.cpView.memory.used, 10));
		var swapusage = (parseInt(mdevice.cpView.swap.used, 10)*100)/(parseInt(mdevice.cpView.swap.free, 10)+parseInt(mdevice.cpView.swap.used, 10));

		var $memory = $('#stats-resources-mpmemory .piechart[data-aname="memory"]');
		var $swap = $('#stats-resources-mpmemory .piechart[data-aname="swap"]');
		$memory.data('easyPieChart').update(Math.round(memusage));
		$memory.find('.stats-figure').text(percentformatter(memusage));
		$swap.data('easyPieChart').update(Math.round(swapusage));
		$swap.find('.stats-figure').text(percentformatter(swapusage));
	};
	var numDpToDpName = function(numdp) {
		var t = [];

		for(var x in mdevice.dpView) {
			if(typeof mdevice.dpView[x] == 'object') {
				t.push(x);
			}
		}
		t.sort();
		return t[numdp];
	};
	var updateResourcesDpcpuTable = function(numdp) {
		var $dpcharts = $('#stats-resources-dpcpu'+numDpToDpName(numdp)+' .dppiechart');
		var numcores = mdevice.dpView[numDpToDpName(numdp)].second.core[0].length;
		var dpvalues = P.arrayOfArray($dpcharts.length);
		var cpc = 48/$dpcharts.length;

		for(var j = 0; j < 48; j++) {
			if(j < numcores) {
				dpvalues[Math.floor(j/cpc)].push(mdevice.dpView[numDpToDpName(numdp)].second.core[0][j]);
			} else {
				dpvalues[Math.floor(j/cpc)].push(Number.NaN);
			}
		}
		for(var j = 0; j < $dpcharts.length; j++) {
			$dpcharts.eq(j).data('easyPieChart').update(dpvalues[j]);
		}
	};
	var resourcesDpcpuTableContents = function(numdp) {
		var ihtml = [];
		var numcores = mdevice.dpView[numDpToDpName(numdp)].second.core[0].length;

		ihtml.push('<td><div class="stats-label">core 0-11</div><div class="dppiechart chartable" data-percent="0,0,0,0,0,0,0,0" data-aname="'+numDpToDpName(numdp)+'.core0"></div></td>');
		ihtml.push('<td><div class="stats-label'+(numcores > 12 ? '': ' stats-disabled')+'">core 12-23</div><div class="dppiechart chartable" data-percent="0,0,0,0,0,0,0,0" data-aname="dp'+numDpToDpName(numdp)+'.core8"></div></td>');
		ihtml.push('<td><div class="stats-label'+(numcores > 24 ? '': ' stats-disabled')+'">core 24-35</div><div class="dppiechart chartable" data-percent="0,0,0,0,0,0,0,0" data-aname="dp'+numDpToDpName(numdp)+'.core16"></div></td>');
		ihtml.push('<td><div class="stats-label'+(numcores > 36 ? '': ' stats-disabled')+'">core 36-47</div><div class="dppiechart chartable" data-percent="0,0,0,0,0,0,0,0" data-aname="dp'+numDpToDpName(numdp)+'.core31"></div></td>');

		return ihtml.join('');
	};
	var updateResourcesMpCpuLoadAvg = function() {
		mdevice.statsdb.mapLast60Minutes("cp", function(item) {
			return [item.date, parseFloat(item.loadavg1m)];
		}, "cps")
		.then(function(values) {
			$.plot($("#stats-resources-mpcpuchart"), [values], {
				series: { lines: { show: true, fill: true }, points: { show: false } },
				yaxis: { min: 0, tickDecimals: 0, minTickSize: 1 },
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			});
		},
		function(err) {
			console.error("updateResourcesMpCpuLoadAvg: "+err);
		});
	};
	var updateResourcesDpLoadHistoryChart = function(numdp) {
		var j;
		var values = [];
		var rsel = $('#stats-resources-'+numDpToDpName(numdp)+'load-hchart-tbar').children('.stats-hchart-rsel').attr('data-range');
		if(typeof rsel == "undefined" || rsel === "") {
			rsel = "second";
		}

		var rdelta = rdeltas[rsel];
		var core = mdevice.dpView[numDpToDpName(numdp)][rsel].core;

		if(rsel == 'second') {
			var lastn;

			values.push([]);
			for(j = 0; j < core.length; j++) {
				values[0].push([mdevice.dpView.date-rdelta*j, Math.max.apply(null, core[j])]);
			}
		} else {
			values.push({ label: 'max', data: []});
			values.push({ label: 'avg max', data: []});

			for(j = 0; j < core.length; j++) {
				values[0].data.push([mdevice.dpView.date-rdelta*j, Math.max.apply(null, core[j])]);
				values[1].data.push([mdevice.dpView.date-rdelta*j, P.camelMax(core[j])]);
			}
		}
		$.plot($("#stats-resources-"+numDpToDpName(numdp)+"load"), values, {
			series: { lines: { show: true, fill: true }, points: { show: false } },
			legend: { position: 'nw' },
			yaxis: { tickFormatter: percentformatter, tickDecimals: 0, minTickSize: 1, min: 0, max: 100 },
			xaxis: { timezone: "browser", mode: "time" },
			colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
		});
	};
	var updateResourcesDpResHistoryChart = function(numdp) {
		var reslastn, j, data;
		var values = [];
		var rsel = $('#stats-resources-'+numDpToDpName(numdp)+'res-hchart-tbar').children('.stats-hchart-rsel').attr('data-range');
		if(typeof rsel == "undefined" || rsel === "") {
			rsel = "second";
		}

		var rdelta = rdeltas[rsel];
		var res = mdevice.dpView[numDpToDpName(numdp)][rsel].res;
		var reslastn = {};

		if(rsel == 'second') {
			for(j = 0; j < res.length; j++) {
				if(res[j].name == "packet buffer") {
					reslastn['pb'] = res[j].lastn;
					continue;
				}
				if(res[j].name == "packet descriptor") {
					reslastn['pd'] = res[j].lastn;
					continue;
				}
				if(res[j].name == "packet descriptor (on-chip)") {
					reslastn['pd oc'] = res[j].lastn;
					continue;
				}
				if(res[j].name == 'sw tags descriptor') {
					reslastn['std'] = res[j].lastn;
					continue;
				}
			}
		} else {
			for(j = 0; j < res.length; j++) {
				if(res[j].name == "packet buffer (maximum)") {
					reslastn['pb'] = res[j].lastn;
					continue;
				}
				if(res[j].name == "packet descriptor (maximum)") {
					reslastn['pd'] = res[j].lastn;
					continue;
				}
				if(res[j].name == "packet descriptor (on-chip) (maximum)") {
					reslastn['pd oc'] = res[j].lastn;
					continue;
				}
				if(res[j].name == 'sw tags descriptor (maximum)') {
					reslastn['std'] = res[j].lastn;
					continue;
				}
			}
		}

		for(var resstat in reslastn) {
			data = [];
			for(j = 0; j < reslastn[resstat]; j++) 
				data.push([mdevice.dpView.date-rdelta*j, reslastn[resstat][j]]);
			values.push({ label: resstat, data: data });
		}
		$.plot($("#stats-resources-"+numDpToDpName(numdp)+"res"), values, {
			series: { lines: { show: true, fill: true }, points: { show: false } },
			legend: { position: 'nw' },
			yaxis: { tickFormatter: percentformatter, tickDecimals: 0, minTickSize: 1, min: 0, max: 100 },
			xaxis: { timezone: "browser", mode: "time" },
			colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
		});
	};
	var updateResources = function() {
		updateResourcesMpcpuTable();

		updateResourcesMpmemory();

		updateResourcesMpCpuLoadAvg();
		for(var j = 0; j < mdevice.sysdefs.numDPs; j++) {
			updateResourcesDpcpuTable(j);
			updateResourcesDpLoadHistoryChart(j);
			updateResourcesDpResHistoryChart(j);
		}
	};
	var changeRangeSelectionResourcesDpLoad = function() {
		var $t = $(this);
		var numdp = parseInt($t.parent().attr('data-numdp'), 10);
		if($t.hasClass('stats-hchart-rsel')) {
			return;
		}
		$t.parent().children('span').removeClass('stats-hchart-rsel');
		$t.addClass('stats-hchart-rsel');
		updateResourcesDpLoadHistoryChart(numdp);
	};
	var changeRangeSelectionResourcesDpRes = function() {
		var $t = $(this);
		var numdp = parseInt($t.parent().attr('data-numdp'), 10);
		if($t.hasClass('stats-hchart-rsel')) {
			return;
		}
		$t.parent().children('span').removeClass('stats-hchart-rsel');
		$t.addClass('stats-hchart-rsel');
		updateResourcesDpResHistoryChart(numdp);
	};
	var showTCResourcesMpCpu = function() {
		$containermenu.removeClass('containermenu-show');

		var $t = $(this);
		var aname = $t.attr('data-aname');
		var title = "MP "+aname;
		
		$('#tc-title').text(title+" - last 60 minutes");
		$('#tc-overlay').show();

		mdevice.statsdb.mapLast60Minutes("cp", function(item) {
			return [item.date, item.cpu[aname]];
		}, aname)
		.then(function(values) { 
			$.plot($("#tc-chart"), [values], { 
				series: { lines: { show: true, fill: true }, points: { show: false } }, 
				yaxis: { tickDecimals: 0, minTickSize: 1, min: 0, max: 100, tickFormatter: percentformatter }, 
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"] 
			}); 
		}, 
		function(err) { 
			console.error("showTCSessionInfo: "+err); 
		});
	};
	var showTCResourcesMpMemory = function() {
		$containermenu.removeClass('containermenu-show');

		var $t = $(this);
		var aname = $t.attr('data-aname');
		var title = "MP "+aname;
		
		$('#tc-title').text(title+" - last 60 minutes");
		$('#tc-overlay').show();

		mdevice.statsdb.mapLast60Minutes("cp", function(item) {
			return [item.date, (parseInt(item[aname].used, 10)*100)/(parseInt(item[aname].free, 10)+parseInt(item[aname].used, 10))];
		}, aname)
		.then(function(values) {
			$.plot($("#tc-chart"), [values], {
				series: { lines: { show: true, fill: true }, points: { show: false } },
				yaxis: { tickDecimals: 0, minTickSize: 1, min: 0, max: 100, tickFormatter: percentformatter },
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			});
		},
		function(err) {
			console.error("showTCSessionInfo: "+err); 
		});
	};
	var updateTCResourcesDpCore = function(dp) {
		var numcores = mdevice.dpView[dp].second.core[0].length; // get it from the dpView directly to support unknonw platforms
		var range = $('#tc-hchart-tbar').children('.stats-hchart-rsel').attr('data-range');
		if(typeof range == "undefined" || range === "") {
			range = "second";
		}

		var values = P.arrayOf(numcores, function(n) { return { label: "core"+n, data: [] }; });
		var core = mdevice.dpView[dp][range].core;
		var rdelta = rdeltas[range];

		if(range == 'second') {
			for(var j = 0; j < core.length; j++) {
				for(var k = 0; k < numcores; k++) {
					values[k].data.push([mdevice.dpView.date-rdelta*j, core[j][k]]);
				}
			}			
		} else {
			for(var j = 0; j < core.length; j++) {
				for(var k = 0; k < numcores; k++) {
					values[k].data.push([mdevice.dpView.date-rdelta*j, core[j][k*2+1]]);
				}
			}
		}

		panhorizon.phplot($("#tc-chart div.tc-dpcore"), values);
	};
	var changeRangeSelectionTCResourcesDpCore = function(e) {
		var $t = $(this);
		var dp = $t.parent().attr('data-dp');
		if($t.hasClass('stats-hchart-rsel')) {
			return;
		}
		$t.parent().children('span').removeClass('stats-hchart-rsel');
		$t.addClass('stats-hchart-rsel');

		updateTCResourcesDpCore(dp);

		e.stopPropagation();
	};
	var showTCResourcesDpCore = function() {
		$containermenu.removeClass('containermenu-show');

		var $t = $(this);
		var aname = $t.attr('data-aname').split('.');
		var title = aname[0]+" max per core";
		var ihtml = [];
		var numcores = mdevice.dpView[aname[0]].second.core[0].length;

		$('#tc-title').text(title);
		$('#tc-overlay').show();

		$("#tc-chart").height("auto"); // height should be auto to accomodate charts and tbar
		ihtml.push('<div data-dp="'+aname[0]+'" id="tc-hchart-tbar" class="stats-hchart-tbar">last <span class="stats-hchart-rsel" data-range="second">60s</span> <span data-range="minute">60m</span> <span data-range="hour">24h</span> <span data-range="day">7d</span> <span data-range="week">13w</span></div>');
		for(var j = 0; j < numcores; j++) { ihtml.push('<div class="tc-dpcore"></div>'); }
		$('#tc-chart').html(ihtml.join(''));
		$('#tc-hchart-tbar').on('click', 'span', changeRangeSelectionTCResourcesDpCore);

		updateTCResourcesDpCore(aname[0]);

		// the height of the TC is known only after the panhorizon call
		fixTCHeight(); 
	};
	var displayResources = function() {
		var ihtml, dpname;

		$('#main').html('<div id="mainheader">Resources</div>');

		ihtml = [];
		ihtml.push('<div class="mainsection"><span class="sectiontitle">MP CPU USAGE</span></div>');
		ihtml.push('<table id="stats-resources-mpcpu"><tbody><tr>');
		ihtml.push(resourcesMpcpuTableContents());
		ihtml.push('</tr></tbody></table>');
		$('#main').append(ihtml.join(''));
		$('#stats-resources-mpcpu').on('click', '.chartable', showTCResourcesMpCpu);

		ihtml = [];
		ihtml.push('<div class="stats-col1-30">');
		ihtml.push('<div class="mainsection"><span class="sectiontitle">MP MEMORY USAGE</span></div>');
		ihtml.push('<table id="stats-resources-mpmemory"><tbody>');
		ihtml.push('<tr>');
		ihtml.push('<td><div class="stats-label">Memory</div><div class="piechart chartable" data-percent="0" data-aname="memory"><div class="stats-figure">0%</div></div></td>');
		ihtml.push('<td><div class="stats-label">Swap</div><div class="piechart chartable" data-percent="0" data-aname="swap"><div class="stats-figure">0%</div></div></td>');
		ihtml.push('</tr>');
		ihtml.push('</tbody></table>');
		ihtml.push('</div>');
		$('#main').append(ihtml.join(''));
		$('#stats-resources-mpmemory').on('click', '.chartable', showTCResourcesMpMemory);

		ihtml = [];
		ihtml.push('<div class="stats-col2-70">');
		ihtml.push('<div class="mainsection"><span class="sectiontitle">MP CPU LOAD LAST 60 MINUTES</span></div>');
		ihtml.push('<div id="stats-resources-mpcpuchart"></div>');
		ihtml.push('</div>');
		$('#main').append(ihtml.join(''));
		updateResourcesMpCpuLoadAvg();

		$('#main').append('<div style="display: block; clear: both;"></div>');

		for(var j = 0; j < mdevice.sysdefs.numDPs; j++) {
			ihtml = [];
			dpname = numDpToDpName(j);

			ihtml.push('<div class="mainsection"><span class="sectiontitle">'+dpname.toUpperCase()+' CORES LOAD</span></div>');
			ihtml.push('<table id="stats-resources-dpcpu'+dpname+'" class="stats-resources-dpcpu"><tbody><tr>');
			ihtml.push(resourcesDpcpuTableContents(j));
			ihtml.push('</tr></tbody></table>');
			$('#main').append(ihtml.join(''));

			ihtml = [];
			ihtml.push('<div class="stats-col1">');
			ihtml.push('<div class="mainsection"><span class="sectiontitle">'+dpname.toUpperCase()+' LOAD HISTORY</span></div>');
			ihtml.push('<div data-numdp="'+j+'" id="stats-resources-'+dpname+'load-hchart-tbar" class="stats-hchart-tbar">last <span class="stats-hchart-rsel" data-range="second">60s</span> <span data-range="minute">60m</span> <span data-range="hour">24h</span> <span data-range="day">7d</span> <span data-range="week">13w</span></div>');		
			ihtml.push('<div class="stats-hchart-half" id="stats-resources-'+dpname+'load"></div>');
			ihtml.push('</div>');
			$('#main').append(ihtml.join(''));
			updateResourcesDpLoadHistoryChart(j);
			$('#stats-resources-'+dpname+'load-hchart-tbar').on('click', 'span', changeRangeSelectionResourcesDpLoad);


			ihtml = [];
			ihtml.push('<div class="stats-col2">');
			ihtml.push('<div class="mainsection"><span class="sectiontitle">'+dpname.toUpperCase()+' RESOURCES HISTORY</span></div>');
			ihtml.push('<div data-numdp="'+j+'" id="stats-resources-'+dpname+'res-hchart-tbar" class="stats-hchart-tbar">last <span class="stats-hchart-rsel" data-range="second">60s</span> <span data-range="minute">60m</span> <span data-range="hour">24h</span> <span data-range="day">7d</span> <span data-range="week">13w</span></div>');		
			ihtml.push('<div class="stats-hchart-half" id="stats-resources-'+dpname+'res"></div>');
			ihtml.push('</div>');
			$('#main').append(ihtml.join(''));
			updateResourcesDpResHistoryChart(j);
			$('#stats-resources-'+dpname+'res-hchart-tbar').on('click', 'span', changeRangeSelectionResourcesDpRes);

			$('#main').append('<div style="display: block; clear: both;"></div>');
		}
		$('.stats-resources-dpcpu').on('click', '.chartable', showTCResourcesDpCore);

		$('.piechart').easyPieChart({
        	trackColor: "#ebeee6",
        	barColor: "rgb(83,94,114)",
        	scaleColor: "#ebeee6",
        	animate: false
    	});
    	updateResourcesMpmemory();
    	updateResourcesMpcpuTable();

		$('.dppiechart').easyPieChart({
        	trackColor: "#ebeee6",
        	barColor: "rgb(83,94,114)",
        	scaleColor: "#ebeee6",
        	disabledTrackColor: "#f8f8f8",
        	animate: false,
        	size: 200
    	});
    	for(var j = 0; j < mdevice.sysdefs.numDPs; j++) {
    		updateResourcesDpcpuTable(j);
    	}

		eventproxy.on("dpview:update", updateResources);
		eventproxy.on("cpview:update", updateResources);
	};
	
	// Traffic
	var refreshHwIfDetails = function(evt) {
		console.log("refreshHwIfDetails");
		evt.stopPropagation();

		backgroundPage.panachrome.updateHwIfDetailsView(mdevice);
		$('#hwifdetails-refresh').addClass('fa-spin');
	};
	var updateHwIfDetails = function() {
		if ($('#tc-overlay').is(':hidden'))
			return;
		if ($('#tc-chart').attr('data-type') != 'hwifdetails')
			return;
		var hwifidx = +$('#tc-chart').attr('data-params');

		if (typeof mdevice.hwifdetailsView == 'undefined')
			return;

		$('#hwifdetails-lastpoll').text(mdevice.hwifdetailsView.lastPoll.toLocaleString());

		var ihtml = [];
		if(mdevice.hwifdetailsView.hwifs.hasOwnProperty("p"+hwifidx)) {
			for(var prop in mdevice.hwifdetailsView.hwifs["p"+hwifidx]) {
				if(!mdevice.hwifdetailsView.hwifs["p"+hwifidx].hasOwnProperty(prop))
					continue;
				ihtml.push('<tr><td>'+prop+'</td><td>'+numformatter(mdevice.hwifdetailsView.hwifs["p"+hwifidx][prop])+'</td></tr>');
			}
		}
		if(ihtml.length == 0) {
			ihtml.push("<tr><td><i>No detailed hardware counters for this interface</i></td></tr>")
		}

		$("#hwifdetails-table tbody").empty().html(ihtml.join(''));

		if (mdevice.hwifdetailsView.inPolling) {
			$('#hwifdetails-refresh').addClass('fa-spin');
		} else {
			$('#hwifdetails-refresh').removeClass('fa-spin');
		}
	};
	var showHwIfDetails = function() {
		$containermenu.removeClass('containermenu-show');

		var $this = $(this);
		var hwifidx = $this.attr('data-hwifidx');

		$('#tc-title').html('<i class="fa fa-flask"></i> ethernet1/'+hwifidx+' hardware details');
		$('#tc-overlay').show();

		var ihtml = [];
		ihtml.push('<div>last poll: <span id="hwifdetails-lastpoll">--</span>  (<i id="hwifdetails-refresh" class="fa fa-refresh"></i>)</div>');
		ihtml.push('<table id="hwifdetails-table"><tbody></tbody></table>');
		$('#tc-chart').html(ihtml.join(''));
		$('#tc-chart').attr('data-type', 'hwifdetails');
		$('#tc-chart').attr('data-params', ''+hwifidx);

		updateHwIfDetails();

		$('#hwifdetails-refresh').on('click', refreshHwIfDetails);
	};
	var ifsHwTableContents = function() {
		var ihtml = [];
		if(typeof mdevice.ifsView != "undefined") {
			for(var j = 0; j < mdevice.ifsView.hw.length; j++) {
				var cc = mdevice.ifsView.hw[j];
				// this is for the PA-7050, strange unnamed ifs
				if (typeof cc.name == 'undefined') continue;
				var ifinfo = mdevice.interfaces.hw[cc.name] || {state: '--', mode: '--', duplex: '--', speed: '--'}; // XXX sometime ifinfo is undefined (ifs changed due to commit)
				var mode = ifinfo.mode || "--"; // in 4.1 .mode not supported
				ihtml.push('<tr><td rowspan="2">'+cc.name+'</td><td rowspan="2">'+ifinfo.state+'/'+mode+'/'+ifinfo.duplex+'/'+ifinfo.speed+(cc.name[0] == 'e' ? (' <i class="hwifdetails fa fa-gears" data-hwifidx="'+(j+1)+'"></i>') : '')+'</td><td class="noborder chartable" data-aname="hw.ibytes.rate"> RX '+itformatter(cc.ibytes.rate*8)+'bps</td><td class="noborder chartable" data-aname="hw.ipackets.rate"> RX '+itformatter(cc.ipackets.rate)+'pps</td><td rowspan="2" class="chartable" data-aname="hw.ierrors.rate">'+itformatter(cc.ierrors.rate)+'pps</td><td rowspan="2" class="chartable" data-aname="hw.idrops.rate">'+itformatter(cc.idrops.rate)+'pps</td></tr>');
				ihtml.push('<tr><td class="chartable" data-aname="hw.obytes.rate"> TX '+itformatter(cc.obytes.rate*8)+'bps</td><td class="chartable" data-aname="hw.opackets.rate"> TX '+itformatter(cc.opackets.rate)+'pps</td></tr>');
			}
		} else {
			ihtml.push('<tr><td>No data yet</td></tr>');
		}
		
		return ihtml.join('');
	};
	var ifsIfnetTableContents = function() {
		var ihtml = [];
		if(typeof mdevice.ifsView != "undefined") {
			for(var j = 0; j < mdevice.ifsView.ifnet.length; j++) {
				var cc = mdevice.ifsView.ifnet[j];
				var ifinfo = mdevice.interfaces.ifnet[cc.name];
				if(typeof ifinfo == "undefined") {
					console.error("Unknown if: "+cc.name);
					continue;
				}
				ihtml.push('<tr><td rowspan="2">'+cc.name+'</td><td rowspan="2">vsys'+ifinfo.vsys+'/'+ifinfo.zone+'</td><td class="noborder chartable" data-aname="ifnet.ibytes.rate"> RX '+itformatter(cc.ibytes.rate*8)+'bps</td><td class="noborder chartable" data-aname="ifnet.ipackets.rate"> RX '+itformatter(cc.ipackets.rate)+'pps</td><td rowspan="2" class="chartable" data-aname="ifnet.ierrors.rate">'+itformatter(cc.ierrors.rate)+'pps</td><td rowspan="2" class="chartable" data-aname="ifnet.idrops.rate">'+itformatter(cc.idrops.rate)+'pps</td></tr>');
				ihtml.push('<tr><td class="chartable" data-aname="ifnet.obytes.rate"> TX '+itformatter(cc.obytes.rate*8)+'bps</td><td class="chartable" data-aname="ifnet.opackets.rate"> TX '+itformatter(cc.opackets.rate)+'pps</td></tr>');
			}
		} else {
			ihtml.push('<tr><td>No data yet</td></tr>');
		}
		
		return ihtml.join('');
	};
	var showTCIfs = function() {
		$containermenu.removeClass('containermenu-show');

		var $t = $(this);
		var $tr = $t.parent();
		
		if($tr.children('td').length == 2) {
			$tr = $tr.prev();
		}
		
		var name = $tr.find("td:first").text();
		var aname = $t.attr('data-aname').split('.');
		
		var vmodifier = P.identity;
		if(aname[1] == 'ibytes' || aname[1] == 'obytes') {
			vmodifier = P.mul8;
		}
		
		$('#tc-title').text(name+"."+aname[1]+"."+aname[2]+" - last 60 minutes");
		$('#tc-overlay').show();

		mdevice.statsdb.mapLast60Minutes("ifs", function(item) {
			for(var j = 0; j < item[aname[0]].length; j++) {
				if(item[aname[0]][j].name == name) {
					return [item.date, vmodifier(item[aname[0]][j][aname[1]][aname[2]])];
				}
			}
		}, name+"."+aname[1]+"."+aname[2])
		.then(function(values) { 
			$.plot($("#tc-chart"), [values], { 
				series: { lines: { show: true, fill: true }, points: { show: false } }, 
				yaxis: { tickFormatter: itformatter, tickDecimals: 1, minTickSize: 100 }, 
				xaxis: { timezone: "browser", mode: "time" }, 
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			}); 
		}, 
		function(err) { 
			console.error("showTCIfs: "+err); 
		});
	};
	var updateIfsCharts = function() {
		var hwbps = { label: 'hw bps', data: [] };
		var ifsbps = { label: 'lg bps', data: [] };
		var dpbps = { label: 'dp bps', data: [] };

		var hwpps = { label: 'hw pps', data: [] };
		var ifspps = { label: 'lg pps', data: [] };
		var dppps = { label: 'dp pps', data: [] };

		mdevice.statsdb.eachLast60Minutes("ifs", function(item) {
			var bsum = 0;
			var bhwsum = 0;

			var psum = 0;
			var phwsum = 0;

			for(var j = 0; j < item.ifnet.length; j++) {
				bsum = bsum+item.ifnet[j].ibytes.rate*8;
				psum = psum+item.ifnet[j].ipackets.rate;
			}
			for(j = 0; j < item.hw.length; j++) {
				// strange unnamed PA-7050 hw ifs
				if(typeof item.hw[j].name == 'undefined') continue;
				bhwsum = bhwsum+item.hw[j].ibytes.rate*8;
				phwsum = phwsum+item.hw[j].ipackets.rate;
			}

			ifsbps.data.push([item.date, bsum]);
			hwbps.data.push([item.date, bhwsum]);
			ifspps.data.push([item.date, psum]);
			hwpps.data.push([item.date, phwsum]);
		})
		.then(function() {
			return mdevice.statsdb.eachLast60Minutes("sessioninfo", function(item) {
				dpbps.data.push([item.date, item.kbps*1000]);
				dppps.data.push([item.date, item.pps]);
			});	
		})
		.then(function(nc) {
			// $("#stats-ifs-bpschart").empty();
			$.plot($("#stats-ifs-bpschart"), [hwbps, ifsbps, dpbps], { 
				series: { lines: { show: true, fill: true }, points: { show: false } },
				legend: { position: 'nw' },
				yaxis: { tickFormatter: itformatter, tickDecimals: 1, minTickSize: 100 }, 
				xaxis: { timezone: "browser", mode: "time" }, 
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			}); 
			// $("#stats-ifs-ppschart").empty();
			$.plot($("#stats-ifs-ppschart"), [hwpps, ifspps, dppps], { 
				series: { lines: { show: true, fill: true }, points: { show: false } }, 
				legend: { position: 'nw' },
				yaxis: { tickFormatter: itformatter, tickDecimals: 1, minTickSize: 100 }, 
				xaxis: { timezone: "browser", mode: "time" }, 
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"]
			}); 
		}, 
		function(err) { 
			console.error("updateIfsBpsChart: "+err); 
		});
	};
	var updateIfs = function(event) {
		var t = ifsHwTableContents();
		$('#stats-ifs-hw tbody').empty().html(t);
		t = ifsIfnetTableContents();
		$('#stats-ifs-ifnet tbody').empty().html(t);
		updateIfsCharts();
	};
	var displayIfs = function() {
		$('#main').html('<div id="mainheader">Interfaces</div>');

		$('#main').append('<div class="mainsection"><span class="sectiontitle">LAST 60 MINUTES</span></div>');
		var ihtml = [];
		// bps chart
		ihtml.push('<div id="stats-ifs-bpschart"></div>');
		// pps chart
		ihtml.push('<div id="stats-ifs-ppschart"></div>');
		ihtml.push('<div style="clear: both"></div>');
		$('#main').append(ihtml.join(''));
		updateIfsCharts();

		// hardware interfaces
		$('#main').append('<div class="mainsection"><span class="sectiontitle">HARDWARE</span></div>');
		ihtml = [];
		ihtml.push('<table id="stats-ifs-hw"><thead><tr><th width="15%">Name</th><th width="25%">Info</th><th width="15%">Bitrate</th><th width="15%">Packets</th><th width="15%">Errors</th><th width="15%">Drops</th></tr></thead>');
		ihtml.push('<tbody>');
		ihtml.push(ifsHwTableContents());
		ihtml.push('</tbody');
		ihtml.push('</table>');
		$('#main').append(ihtml.join(''));

		// logical interfaces		
		$('#main').append('<div class="mainsection"><span class="sectiontitle">LOGICAL</span></div>');
		ihtml = [];
		ihtml.push('<table id="stats-ifs-ifnet"><thead><tr><th width="15%">Name</th><th width="25%">Info</th><th width="15%">Bitrate</th><th width="15%">Packets</th><th width="15%">Errors</th><th width="15%">Drops</th></tr></thead>');
		ihtml.push('<tbody>');
		ihtml.push(ifsIfnetTableContents());
		ihtml.push('</tbody');
		ihtml.push('</table>');
		$('#main').append(ihtml.join(''));
		
		$('#stats-ifs-hw').on('click', '.chartable', showTCIfs);
		$('#stats-ifs-hw').on('click', '.hwifdetails', showHwIfDetails);
		$('#stats-ifs-ifnet').on('click', '.chartable', showTCIfs);

		eventproxy.on("sessioninfoview:update", updateIfs);
		eventproxy.on("ifsview:update", updateIfs);
		eventproxy.on("hwifdetailsview:update", updateHwIfDetails);
	};
	
	// Counters
	var showTCCounterGlobal = function() {
		$containermenu.removeClass('containermenu-show');

		var $t = $(this);
		var $tr = $t.parent();
		var name = $tr.find("td:first").text();
		var aname = $t.attr('data-aname');
		
		$('#tc-title').text(name+"."+aname+" - last 60 minutes");
		$('#tc-overlay').show();

		mdevice.statsdb.mapLast60Minutes("counters", function(item) {
			for(var j = 0; j < item.counters.length; j++) {
				if(item.counters[j].name == name) {
					return [item.date, item.counters[j][aname]];
				}
			}
		}, name+"."+aname)
		.then(function(values) { 
			$.plot($("#tc-chart"), [values], { 
				series: { lines: { show: true }, points: { show: true } },
				yaxis: { tickDecimals: 0, minTickSize: 1 }, 
				xaxis: { timezone: "browser", mode: "time" },
				colors: ["rgb(246, 212, 122)", "rgb(167, 172, 140)", "rgb(83, 94, 114)"] 
			}); 
		}, 
		function(err) { 
			console.error("showTCCounterGlobal: "+err); 
		});
	};
	var countersSeverities = ['info', 'warn', 'error', 'drop'];
	var countersSorters = {
		name: function(a,b) {
			return a.name.localeCompare(b.name);
		},
		category: function(a,b) {
			return a.category.localeCompare(b.category);
		},
		severity: function(a, b) {
			var res;

			var sa = countersSeverities.indexOf(a.severity);
			var sb = countersSeverities.indexOf(b.severity);

			res = sa-sb;
			if(res === 0) {
				res = a.category.localeCompare(b.category);
			}

			return res;
		},
		aspect: function(a,b) {
			return a.aspect.localeCompare(b.aspect);
		},
		value: function(a,b) {
			return a.value-b.value;
		},
		rate: function(a,b) {
			return a.rate-b.rate;
		}
	};
	var countersTableContents = function() {
		var ihtml = [];
		if(typeof mdevice.countersView != "undefined") {
			var sattr = $('#stats-counters').attr('data-sort');
			if (!sattr) sattr = 'severity';
			var sdir = +$('#stats-counters').attr('data-sort-asc');
			if (!sdir) sdir = "0";
			var mycounters = mdevice.countersView.counters.slice(0); // copy the array

			var sf = countersSorters[sattr];
			if (sdir == 0) {
				mycounters.sort(function(a,b) { return -1*sf(a,b); });
			} else {
				mycounters.sort(sf);
			}

			for(var j = 0; j < mycounters.length; j++) {
				var cc = mycounters[j];
				var vcclass = "value-not-changed";
				if (typeof cc.valuechange == "number") {
					if(cc.valuechange === 0) 
						vcclass = "value-not-changed";
					else if(cc.valuechange < 0)
						vcclass = "value-changed-down";
					else {
						vcclass = "value-changed-up";
					}
				}
				var rcclass = "value-not-changed";
				if (typeof cc.ratechange == "number") {
					if(cc.ratechange === 0) 
						rcclass = "value-not-changed";
					else if(cc.ratechange < 0)
						rcclass = "value-changed-down";
					else {
						rcclass = "value-changed-up";
					}
				}
				ihtml.push('<tr data-search="'+cc.name+cc.category+cc.severity+cc.aspect+'"><td>'+cc.name+'</td><td>'+cc.category+'</td><td>'+cc.severity+'</td><td>'+cc.aspect+'</td><td class="chartable" data-aname="value"><span class="'+vcclass+'">'+numformatter(cc.value)+'</span></td><td class="chartable" data-aname="rate"><span class="'+rcclass+'">'+numformatter(cc.rate)+'</span></td></tr>');
			}

			mycounters = null;
		} else {
			ihtml.push('<tr><td>No data yet</td></tr>');
		}
		
		return ihtml.join('');
	};
	var changeCounterTableSort = function() {
		var $t = $(this);
		var sattr = $t.attr('data-sattr');
		var csattr = $('#stats-counters').attr('data-sort');
		var csasc = +$('#stats-counters').attr('data-sort-asc');

		if (sattr == csattr) {
			if (csasc == 0) {
				$('#stats-counters').attr('data-sort-asc', '1');
				csasc = 1;
			} else {
				$('#stats-counters').attr('data-sort-asc', '0');
				csasc = 0;
			}
		} else {
			$('#stats-counters').attr('data-sort', sattr);
			$('#stats-counters').attr('data-sort-asc', '0');
			csasc = 0;
		}

		$('#stats-counters-headers th').each(function() {
			if($(this).attr('data-sattr') == sattr) {
				var $i = $(this).children('i').attr('class', 'fa');
				if(csasc == 0) {
					$i.addClass('fa-sort-desc');
				} else {
					$i.addClass('fa-sort-asc');
				}
			} else {
				$(this).children('i').attr('class', 'fa').addClass('fa-unsorted');
			}
		});

		updateCounterGlobal();
	};
	var filterCounterGlobal = function() {
		var filter = $("#stats-counters-search-input").val().toLowerCase();
		$("#stats-counters tbody tr").each(function() {
			$t = $(this);
			if($t.attr("data-search").indexOf(filter) == -1) {
				$t.hide();
			} else {
				$t.show();
			}
		});
	};
	var updateCounterGlobal = function() {
		$('#stats-counters tbody').html(countersTableContents());
		filterCounterGlobal();
	};
	var displayCounterGlobal = function() {
		$('#main').html('<div id="mainheader">Counter Global</div>');
		$('#main').append('<div class="mainsection"><span class="sectiontitle">COUNTERS</span></div>');
		var ihtml = [];
		ihtml.push('<table id="stats-counters" data-sort="severity" data-sort-asc="0">');
		ihtml.push('<thead>');
		ihtml.push('<tr><td colspan="6" id="stats-counters-search"><i class="fa fa-search"></i><input id="stats-counters-search-input" type="text" size="31"></input></td></tr>');
		ihtml.push('<tr id="stats-counters-headers">');
			ihtml.push('<th id="stats-counters-hname" data-sattr="name">Name <i class="fa fa-unsorted"></i></th>');
			ihtml.push('<th id="stats-counters-hcategory" data-sattr="category">Category <i class="fa fa-unsorted"></i></th>');
			ihtml.push('<th id="stats-counters-hseverity" data-sattr="severity">Severity <i class="fa fa-sort-desc"></i></th>');
			ihtml.push('<th id="stats-counters-haspect" data-sattr="aspect">Aspect <i class="fa fa-unsorted"></i></th>');
			ihtml.push('<th id="stats-counters-hvalue" data-sattr="value">Value <i class="fa fa-unsorted"></i></th>');
			ihtml.push('<th id="stats-counters-hrate" data-sattr="rate">Rate <i class="fa fa-unsorted"></i></th>');
		ihtml.push('</tr>'); 
		ihtml.push('</thead>');
		ihtml.push('<tbody>');
		ihtml.push(countersTableContents());
		ihtml.push('</tbody');
		ihtml.push('</table>');
		$('#main').append(ihtml.join(''));

		$('#stats-counters-headers th').on('click', changeCounterTableSort);
		$("#stats-counters-search-input").on("keyup", filterCounterGlobal)
		$('#stats-counters').on('click', '.chartable', showTCCounterGlobal);
		eventproxy.on("countersview:update", updateCounterGlobal);
	};

	/* manage hashes */
	var hashes = {
		'ifs': displayIfs,
		'counters': displayCounterGlobal,
		'sessions': displaySessions,
		'resources': displayResources
	};
	var showSection = function(hash) {
		var displayf;

		if(hash === "") {
			hash = "ifs";
		}
		if(hashes.hasOwnProperty(hash)) {
			displayf = hashes[hash];
		} else {
			displayf = displayIfs;
		}

		cleanEventProxy();
		cleanPlots();

		$('#main').empty();
		displayf();
		positionMenuBar();
	};

	var cleanPlots = function() {
		// clean plots
		$('canvas.overlay').parent().each(function() {
			var p = $(this).data("plot");
			if(p !== null && typeof p != "undefined") {
				p.shutdown();
			}
			$(this).data("plot", null);
		});
	};
	var restartCountdown = function() {
		cdownStart = +new Date;
	};
	var cdownRender = function() {
		if(backgroundPage == null) return;
		
		requestAnimationFrame(cdownRender);

		var now = +new Date;
		var dt = now - cdownStart;
		var ds = backgroundPage.panachrome.config.trackingInterval / 28;
		var np = dt/(ds*1000);
		if(np > 28) np = 28;
		if($('#stats-cdown-bar').height() == np) return;

		$('#stats-cdown-bar').height(np);
	};
	var positionMenuBar = function() {
		if($main == null) return;
		
		$containermenutool.css("left", ($main.offset().left - $w.scrollLeft()) - ($containermenutool.width() + 10) + "px");
		$containermenutool.css("top", $main.offset().top + 20 + "px");
		$containermenu.css("left", ($main.offset().left - $w.scrollLeft()) - ($containermenutool.width() + 10) + "px");
		$containermenu.css("top", $main.offset().top + 20 + "px");
	};
	var fixTCHeight = function() {
		if($('#tc-overlay').is(':hidden')) return;

		var $tcw = $('#tc-chart-wrap');
		var $tcc = $('#tc-container');
		var ch = $tcw.height();
		var delta = ($tcc.offset().top - $w.scrollTop()) + $tcc.height() - w.innerHeight + 20 /* padding */ + 5 /* something */;

		if(delta > 0) {
			$tcw.height($tcw.height() - delta);
		} else {
			$tcw.height(Math.min($tcw.height()-delta, $('#tc-chart').height()));
		}
	};
	var displayError = function(msg) {
		$('#main').html('<div id="mainheader">'+msg+'</div>');
	};

	var cleanEventProxy = function() {
		eventproxy.off("countersview:update");
		eventproxy.off("dpview:update");
		eventproxy.off("cpview:update");
		eventproxy.off("ifsview:update");
		eventproxy.off("sessioninfoview:update");
		eventproxy.off("sessionadvancedview:update");
		eventproxy.off("sessionpervsysview:update");
		eventproxy.off("hwifdetailsview:update");
	};
	var initEventProxy = function() {
		// setup the event proxy
		// local objects register to the proxy to clean the relationship 
		// between background window and this one		
		eventproxy = {};
		RSVP.EventTarget.mixin(eventproxy);
		viewcache = {};
	};
	var deviceUpdateHandler = function(event) {
		// clean view cache for event type
		if(viewcache.hasOwnProperty(event.type)) {
			delete viewcache[event.type];
		}
		viewcache[event.type] = {};

		eventproxy.trigger(event.type, event.detail);
		if(event.type == "ifsview:update") {
			restartCountdown();			
		}

		checkAndDisplayWaiting();

		// move menu bar in case scrollbar has appeared
		positionMenuBar();
	};
	var checkAndDisplayWaiting = function() {
		var components = [];

		if(typeof mdevice.cpView == "undefined") components.push("cp");
		if(typeof mdevice.dpView == "undefined") components.push("dp");
		if(typeof mdevice.countersView == "undefined") components.push("counters");
		if(typeof mdevice.ifsView == "undefined") components.push("ifs");
		if(typeof mdevice.sessioninfoView == "undefined") components.push("sessions");

		if(components.length === 0) {
			$('#loading-overlay').hide();
			return;
		}

		// show the waiting message
		$('#loading-message').text('Waiting for data from '+mdevice.hostname+' {'+components.join(',')+'}');
		$('#loading-overlay').show();
	};

	var setup = function() {
		$w = $(w); $d = $(d); $containermenu = $('#containermenu'); $main = $('#main');
		$containermenutool = $('#containermenu-tool');
		
		// check the url
		var params = URI.parseQuery(URI(d.location.href).query());
		if (typeof params.d == "undefined") {
			displayError("Serial not found");
			return;
		}

		initEventProxy();

		// hook the device and panachrome
		backgroundPage = chrome.extension.getBackgroundPage();
		mdevice = backgroundPage.panachrome.monitored[params.d];
		if (typeof mdevice == "undefined") {
			displayError("Device "+params.d+" not found");
			return;
		}
		mdevice.on("countersview:update", deviceUpdateHandler);
		mdevice.on("ifsview:update", deviceUpdateHandler);
		mdevice.on("sessioninfoview:update", deviceUpdateHandler);
		mdevice.on("dpview:update", deviceUpdateHandler);
		mdevice.on("cpview:update", deviceUpdateHandler);
		mdevice.on("sessionadvancedview:update", deviceUpdateHandler);
		mdevice.on("sessionpervsysview:update", deviceUpdateHandler);
		mdevice.on("hwifdetailsview:update", deviceUpdateHandler);
		$(w).bind('beforeunload', function() {
			cancelAnimationFrame(cdownRAFID);

			mdevice.off('countersview:update', deviceUpdateHandler);
			mdevice.off('ifsview:update', deviceUpdateHandler);
			mdevice.off('sessioninfoview:update', deviceUpdateHandler);
			mdevice.off('dpview:update', deviceUpdateHandler);
			mdevice.off('cpview:update', deviceUpdateHandler);
			mdevice.off("sessionadvancedview:update", deviceUpdateHandler);
			mdevice.off("sessionpervsysview:update", deviceUpdateHandler);
			mdevice.off("hwifdetailsview:update", deviceUpdateHandler);
			cleanEventProxy();
			eventproxy = null;
			RSVP.shutdown();
			
			// help the GC here
			// since we are in the same context of the backgroundPage
			// we should help GC to try avoid memory leaks
			mdevice = null;
			backgroundPage = null;
			$(d).empty();

			Object.keys($.cache).map(function(centry) {
				if(typeof centry.handle  == "undefined") return;

				Object.keys(centry.events, function(e) {
					$.event.remove(centry.handle.elem, e);
				});
			});

			$.cache = {};
			$.fragments = {};
			$main = null;
		});
		
		// bind events on the page
		$containermenutool.bind('click', function() {
			$containermenu.addClass('containermenu-show');
		});
		$containermenu.click(function() {
			$containermenu.removeClass('containermenu-show');
		});
		$w.bind('hashchange', function() {
			$containermenu.removeClass('containermenu-show');
			showSection(URI(d.location.href).fragment());
		});
		$('#tc-overlay').on('click', function() {
			console.log("tc-overlay click");

			$('#tc-chart canvas.base').parent().each(function() {
				var p = $(this).data('plot');
				if(p) {
					console.log("shutdown"); 
					p.shutdown();
					$(this).data('plot', null);
				}
			});
			$('#tc-chart').attr('style','');
			$('#tc-chart-wrap').attr('style','');
			$('#tc-chart').empty();
			$('#tc-chart').removeAttr('data-type');
			$('#tc-chart').removeAttr('data-params');

			$(this).hide();
		});
		
		// show the right section in #main
		showSection(URI(d.location.href).fragment());

		// setup the container menu
		$containermenutool.height($containermenu.height()); // we don't know the height initially
		positionMenuBar(); // position the containermenu near #main
		$w.resize(positionMenuBar); // and do it when the window changes
		$w.resize($.throttle(100, fixTCHeight));
		$w.scroll($.throttle(20, positionMenuBar));
		
		// change the title
		$('#panwheader span').text('Pan(w)achrome - Statistics for '+mdevice.hostname+' ['+mdevice.serial+']');
		
		cdownStart = +new Date;
		$('#stats-cdown-container').html('<div id="stats-cdown-bar"></div>');
		cdownRAFID = requestAnimationFrame(cdownRender);

		checkAndDisplayWaiting();
	};
	
	$(d).ready(setup());
})(document,window);