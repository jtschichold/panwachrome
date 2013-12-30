/* Released under MIT License by Luigi Mori. January 2013 */

var panachrome = panachrome || {};

// config handlers
panachrome.config = {};
panachrome.readConfig = function() {
	var cval = parseInt(localStorage.getItem('notifTimeout'), 10);
	panachrome.config.notifTimeout = (isNaN(cval) ? 5 : cval);

	cval = parseInt(localStorage.getItem('trackingInterval'), 10);
	panachrome.config.trackingInterval = (isNaN(cval) ? 30 : cval);

	cval = parseInt(localStorage.getItem('pollingDefault'), 10);
	panachrome.config.pollingDefault = (isNaN(cval) ? 1 : cval);

	cval = parseInt(localStorage.getItem('jobsTrackingInterval'), 10);
	panachrome.config.jobsTrackingInterval = (isNaN(cval) ? 30 : cval);

	cval = parseInt(localStorage.getItem('ifsTrackingInterval'), 10);
	panachrome.config.ifsTrackingInterval = (isNaN(cval) ? 5 : cval);

	cval = parseInt(localStorage.getItem('requestTimeout'), 10);
	panachrome.config.requestTimeout = (isNaN(cval) ? 5 : cval);
	panwxmlapi.requestTimeout = panachrome.config.requestTimeout*1000;

	cval = parseInt(localStorage.getItem('maxRunningReq'), 10);
	panachrome.config.maxRunningReq = (isNaN(cval) ? 2 : cval);
	panwxmlapi.maxRunningReq = panachrome.config.maxRunningReq;

	cval = JSON.parse(localStorage.getItem('filteredJobs'));
	panachrome.config.filteredJobs = cval || [];
};

// messages to user
panachrome.filterJobClicked = function(nid, buttonidx) {
	if (nid.slice(0, 3) != "Job")
		return;

	var jobtype = nid.split("@")[2];
	for (var i = 0; i < panachrome.config.filteredJobs.length; i++) {
		if (panachrome.config.filteredJobs[i] == jobtype)
			return;
	}

	panachrome.config.filteredJobs.push(jobtype);

	localStorage.setItem('filteredJobs', JSON.stringify(panachrome.config.filteredJobs));
};
panachrome.notificationCloseOnTimeout = function(nid) {
	setTimeout(function() { 
		chrome.notifications.clear(nid, function() {}); 
	}, panachrome.config.notifTimeout*1000);
};
panachrome.error = function(e) {
	var n = webkitNotifications.createNotification("images/icon_paper_128.png", "Error", e);
	n.show();
	setTimeout(function() { n.cancel(); }, panachrome.config.notifTimeout*1000);
};
panachrome.info = function(e) {
	var n = webkitNotifications.createNotification("images/icon_paper_128.png", "Info", e);
	n.show();
	setTimeout(function() { n.cancel(); }, panachrome.config.notifTimeout*1000);
};
panachrome.showJob = function(jobid, jobtype, jobresult) {
	for (var i = 0; i < panachrome.config.filteredJobs.length; i++) {
		if (panachrome.config.filteredJobs[i] == jobtype)
			return;
	}

	chrome.notifications.create("Job@"+jobid+"@"+jobtype, {
		title: 'Job '+jobid,
		type: 'basic',
		iconUrl: "images/icon_paper_128.png",
		message: "Job "+jobid+" ("+jobtype+") finished: "+jobresult,
		priority: 0,
		buttons: [{
			title: 'Don\'t show this job again'
		}]
	},
	panachrome.notificationCloseOnTimeout);
};

// monitoring part
panachrome.monitored = {};
panachrome.mDevice = function(address, port, proto) {
	this.address = address;
	this.port = port;
	this.proto = proto;
	this.interfaces = { hw: {}, ifnet: {} };
};
panachrome.initDeviceSystemInfo = function(mdevice) {
	panwxmlapi.getInterfaceAll(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
		.then(function($result) {
			mdevice.lastPoll = new Date();

			var $ifnetentries = $result.children("ifnet").children("entry");
			$ifnetentries.each(function() {
				var hi = {};
				var n;
				$(this).children().each(function() {
					if($(this).prop('tagName') == 'name') {
						n = $(this).text();
					} else {
						hi[$(this).prop('tagName')] = $(this).text();
					}
				});
				mdevice.interfaces.ifnet[n] = hi;
			});
			var $hwentries = $result.children("hw").children("entry");
			$hwentries.each(function() {
				var hi = {};
				var n;
				$(this).children().each(function() {
					if($(this).prop('tagName') == 'name') {
						n = $(this).text();
					} else {
						hi[$(this).prop('tagName')] = $(this).text();
					}
				});
				mdevice.interfaces.hw[n] = hi;
			});
		}, function(err) {
			console.log("Error: initDeviceSystemInfo: "+err);
		});
};

panachrome.cpCpure = /Cpu\(s\)\:\W+([0-9]+\.[0-9]+)\%us,\W+([0-9]+\.[0-9]+)\%sy,\W+([0-9]+\.[0-9]+)\%ni,\W+([0-9]+\.[0-9]+)\%id,\W+([0-9]+.[0-9]+)\%wa,\W+([0-9]+\.[0-9]+)\%hi,\W+([0-9]+\.[0-9]+)\%si,\W+([0-9]+\.[0-9]+)\%st/;
panachrome.cpMemre = /Mem:\W+[0-9]+k\W+total,\W+([0-9]+)k\W+used,\W+([0-9]+)k\W+free\W+([0-9]+)k\W+buffers[\s\S]*\W+([0-9]+)k\W+cached/;
panachrome.cpSwapre = /Swap:\W+[0-9]+k\W+total,\W+([0-9]+)k\W+used,\W+([0-9]+)k\W+free/;
panachrome.cpCpuLoadAvgre = /load average: (\d+\.\d+)/;

panachrome.cpMonitorFactory = function(mdevice) {
	return (function() {
		if (!mdevice.polling) {
			return;
		}
		panwxmlapi.getCPResources(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
			.then(function($result) {
				mdevice.lastPoll = new Date();

				var o2store = { cpu: {}, memory: {}, swap: {} };
				var topoutput = $result.text();
				
				var rem = topoutput.match(panachrome.cpCpure);
				if(rem === null) {
					console.log("Error matching cp resources with cpu re");
				} else {
					o2store.cpu.us = rem[1];
					o2store.cpu.sy = rem[2];
					o2store.cpu.ni = rem[3];
					o2store.cpu.id = rem[4];
					o2store.cpu.wa = rem[5];
					o2store.cpu.hi = rem[6];
					o2store.cpu.si = rem[7];
					o2store.cpu.st = rem[8];
				}
				
				rem = topoutput.match(panachrome.cpMemre);
				if(rem === null) {
					console.log('Error in matching the CP result with MEMre');
				} else {
					// Mem: 1034604k total, 1008448k used, 26156k free, 41868k buffers
					// Swap: 2008084k total, 485268k used, 1522816k free, 109572k ...
					// thanks JFG for the correct formula
					var u = parseInt(rem[1], 10);
					var f = parseInt(rem[2], 10);
					var b = parseInt(rem[3], 10);
					var c = parseInt(rem[4], 10);
					o2store.memory.used = ""+(u-b-c);
					o2store.memory.free = ""+(f+b+c);
				}
				
				rem = topoutput.match(panachrome.cpSwapre);
				if(rem === null) {
					console.log('Error in matching the CP result with SWAPre');
				} else {
					// Swap: 2008084k total, 485268k used, 1522816k free, 109572k ...
					o2store.swap.used = rem[1];
					o2store.swap.free = rem[2];
				}

				rem = topoutput.match(panachrome.cpCpuLoadAvgre);
				if(rem === null) {
					console.log('Error in matching CP result with CpuLoadAvg re');
				} else {
					o2store.loadavg1m = rem[1];
				}
				
				mdevice.statsdb.add("cp", o2store)
					.then(function(msg) {
						mdevice.triggerDetach("cp:update");
					})
					.then(null, function(err) {
						console.log("Error saving sessioninfo for device "+mdevice.serial+": "+err);
					});
			})
			.then(null, function(err) {
				console.log("Error in tracking cp on device "+mdevice.serial+": "+err);
			});
	});
};
panachrome.updateCpView = function(mdevice) {
	mdevice.statsdb.getLastElements("cp", 1)
		.then(function(res) {
			if(res.length === 0) {
				return;
			}

			mdevice.cpView = res[0];
			mdevice.triggerDetach("cpview:update");
		})
		.then(null, function(err) {
			console.log("Error getting last elements from cp: "+err);
		});	
};

/*
- sotto seconds > core c'e' un entry per ogni secondo e per ogni entry c'e' un member per ogni core
- sotto seconds > wqe c'e' un entry per ogni voce con name (flow_lookup, ...) e load
- sotto seconds > res c'e' un entry per ogni voce con name (sessions, packet_buffer, ...), un lastn ed un member per ogni secondo

- sotto minute > core c'e' un entry per ogni minuto e per ogni entry ci sono due member per core, max e avg (dovrebbero andare due a due)
- sotto minute > res c'e' un entry per ogni voce con name (sessions, ...), un lastn con un member per ogni voce

- XXX there is a bug in XML API, only the dp0 stats can be retrieved
*/
panachrome.dpMonitorFactory = function(mdevice) {
	return (function() {
		if (!mdevice.polling) {
			return;
		}
		panwxmlapi.getDPResources(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
			.then(function($result) {
				mdevice.lastPoll = new Date();

				var o2store = {};

				$dps = $result.find('data-processors:first');

				if($dps.length == 0) {
					// pre-5.0.9 API, only DP0 is dumped
					o2store.dp0 = {};

					$result.children().each(function() {
						var $t = $(this);
						var co = {};

						if(this.tagName == 'second') {
							co.core = [];
							$t.children('core').children('entry').each(function() {
								co.core.push(P.childrenTextToArray($(this), "member"));
							});

							co.wqe = [];
							$t.children('wqe').children('entry').each(function() {
								co.wqe.push(P.childrenToObect($(this)));
							});

							co.res = [];
							$t.children('res').children('entry').each(function() {
								var tco = {};
								tco.name = $(this).children('name').text();
								tco.lastn = P.childrenTextToArray($(this).children('lastn:first'), 'member');
								co.res.push(tco);
							});
						} else {
							co.core = [];
							$t.children('core').children('entry').each(function() {
								co.core.push(P.childrenTextToArray($(this), "member"));
							});

							co.res = [];
							$t.children('res').children('entry').each(function() {
								var tco = {};
								tco.name = $(this).children('name').text();
								tco.lastn = P.childrenTextToArray($(this).children('lastn:first'), 'member');
								co.res.push(tco);
							});
						}
						o2store.dp0[this.tagName] = co;
					});
				} else {
					mdevice.sysdefs.numDPs = $dps.children().length; // update numDPs, should be dynamic for Condor

					$dps.children().each(function() {
						var cdpo = {};

						$(this).children().each(function() {
							var $t = $(this);
							var co = {};

							var $cla = $t.children('cpu-load-average').children('entry');
							var tcla = P.arrayOfArray($cla.length);
							$cla.each(function() {
								var coreid = +$(this).children('coreid').text();
								var value = $(this).children('value').text().split(',');
								tcla[coreid] = value;
							});

							var $clm = $t.children('cpu-load-maximum').children('entry');
							var tclm = P.arrayOfArray($clm.length);
							$clm.each(function() {
								var coreid = +$(this).children('coreid').text();
								var value = $(this).children('value').text().split(',');
								tclm[coreid] = value;
							});

							if(tclm.length != tcla.length) {
								conse.log("Different number of cores in resource monitor: "+tclm.length+" "+tcla.length);
								return;
							}

							co.core = [];
							for (var ct = 0; ct < tcla[0].length; ct++) {
								var tstats = [];
								for (var cc = 0; cc < tcla.length; cc++) {
									tstats.push(tcla[cc][ct]);
									if(this.tagName != 'second')
										tstats.push(tclm[cc][ct]);
								}
								co.core.push(tstats);
							}

							co.res = [];
							$t.children('resource-utilization').children('entry').each(function() {
								var tco = {};
								tco.name = $(this).children('name').text();
								tco.lastn = $(this).children('value').text().split(',');
								co.res.push(tco);
							});

							cdpo[this.tagName] = co;						
						});

						o2store[this.tagName] = cdpo;
					});
				}
				
				mdevice.statsdb.add("dp", o2store)
					.then(function(msg) {
						mdevice.triggerDetach("dp:update");
					})
					.then(null, function(err) {
						console.log("Error saving dp for device "+mdevice.serial+": "+err);
					});
			})
			.then(null, function(err) {
				console.log("Error in tracking dp on device "+mdevice.serial+": "+err);
			});
	});
};
panachrome.updateDpView = function(mdevice) {
	mdevice.statsdb.getLastElements("dp", 1)
		.then(function(res) {
			if(res.length === 0) {
				return;
			}

			mdevice.dpView = res[0];
			mdevice.triggerDetach("dpview:update");
		})
		.then(null, function(err) {
			console.log("Error getting last elements from dp: "+err);
		});
};

panachrome.updateHwIfDetailsView = function(mdevice) {
	if(!mdevice.polling)
		return;
	if(mdevice.hwifdetailsView && mdevice.hwifdetailsView.inPolling)
		return;

	mdevice.hwifdetailsView = { inPolling: true };

	panwxmlapi.getHardwareInterfaceErrors(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
		.then(function($result) {
			var toks, vals, cif;

			mdevice.hwifdetailsView.hwifs = {};

			var ifs = $result.text().split('\n');
			for(var j = 0; j < ifs.length; j++) {
				if (ifs[j].length == 0)
					continue;
				cif = {};
				toks = ifs[j].split("{");
				vals = toks[1].replace(/[\'{},]/g, '').replace(/^\s+|\s+$/g, '').replace(/\:\s/g,':').split(" ");
				for(var k = 0; k < vals.length; k++) {
					var t = vals[k].split(":");
					if (t.length != 2)
						continue;
					cif[t[0]] = parseInt(t[1]);
				}
				console.log(cif);
				mdevice.hwifdetailsView.hwifs["p"+(j+1)] = cif;
			}
			mdevice.hwifdetailsView.lastPoll = new Date();
			mdevice.hwifdetailsView.inPolling = false;
			mdevice.triggerDetach('hwifdetailsview:update');
		})
		.then(null, function(err) {
			console.log("Error in retrieving hardware interface errors for "+mdevice.serial+": "+err);
			mdevice.hwifdetailsView.lastPoll = new Date();
			mdevice.hwifdetailsView.inPolling = false;
			mdevice.triggerDetach('hwifdetailsview:update');
		});
};
panachrome.updateSessionPerVsysView = function(mdevice) {
	if(!mdevice.polling)
		return;
	if(mdevice.sessionPerVsysView && mdevice.sessionPerVsysView.inPolling)
		return;

	mdevice.sessionPerVsysView = { numVsyses: 0, perVsys: [], inPolling: true };

	panwxmlapi.getVsysList(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
		.then(function($result) {
			var $entries = $result.find('entry');
			mdevice.sessionPerVsysView.numVsyses = $entries.length;

			$entries.each(function(i) {
				var vsysname = $(this).attr('name');
				panwxmlapi.getSessionVsysCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, vsysname)
					.then(function($result) {
						var count = $.map($result.find('member'), function(x, i) { return +x.textContent; });
						mdevice.sessionPerVsysView.perVsys.push({ name: vsysname, total: count });
						mdevice.sessionPerVsysView.lastPoll = new Date();
						if (mdevice.sessionPerVsysView.perVsys.length == mdevice.sessionPerVsysView.numVsyses) {
							mdevice.sessionPerVsysView.inPolling = false;
							mdevice.triggerDetach("sessionpervsysview:update");
						}
					})
					.then(null, function(err) {
						console.log("Error in retrieving per vsys session count "+mdevice.serial+": "+err);
						mdevice.sessionPerVsysView.perVsys.push({ name: vsysname, total: '--' });
						mdevice.sessionPerVsysView.lastPoll = new Date();
						if (mdevice.sessionPerVsysView.perVsys.length == mdevice.sessionPerVsysView.numVsyses) {
							mdevice.sessionPerVsysView.inPolling = false;
							mdevice.triggerDetach("sessionpervsysview:update");
						}
					});
			});
		})
		.then(null, function(err) {
			console.log("Error in retrieving vsys list "+mdevice.serial+": "+err);
			mdevice.sessionPerVsysView.lastPoll = new Date();
			mdevice.sessionPerVsysView.inPolling = false;
			mdevice.triggerDetach("sessionpervsysview:update");
		});
};
panachrome.updateSessionAdvancedView = function(mdevice) {
	if(!mdevice.polling)
		return;

	mdevice.sessionAdvancedView = { maxNumStats: 9, numStats: 0 };

	panwxmlapi.getSessionStateCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "active")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.active = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session state active "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionStateCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "closed")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.closed = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session state closed "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionStateCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "closing")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.closing = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session state closing "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionStateCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "discard")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.discard = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session state discard "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionStateCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "initial")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.initial = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session state initial "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionStateCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "opening")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.opening = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session state opening "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionDecryptCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.decrypt = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session decrypt "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionApplicationCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "unknown-tcp")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.unknowntcp = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session unknown-tcp "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
	panwxmlapi.getSessionApplicationCount(mdevice.key, mdevice.address, mdevice.port, mdevice.proto, "unknown-udp")
		.then(function($result) {
			mdevice.lastPoll = new Date();

			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			mdevice.sessionAdvancedView.unknownudp = $.map($result.find('member'), function(x, i) { return +x.textContent; });

			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		})
		.then(null, function(err) {
			console.log("Error in retrieving session unknown-udp "+mdevice.serial+": "+err);
			mdevice.sessionAdvancedView.numStats = mdevice.sessionAdvancedView.numStats+1;
			mdevice.sessionAdvancedView.lastPoll = new Date();
			if(mdevice.sessionAdvancedView.numStats == mdevice.sessionAdvancedView.maxNumStats) {
				mdevice.triggerDetach("sessionadvancedview:update");
			}
		});
};

panachrome.sessioninfoMonitorFactory = function(mdevice) {
	return (function() {
		if (!mdevice.polling) {
			return;
		}
		panwxmlapi.getSessionInfo(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
			.then(function($result) {
				mdevice.lastPoll = new Date();

				var o2store = P.childrenToObect($result, ["pps", "num-max", "num-active", "num-mcast",
													"num-udp", "num-icmp", "num-predict", "num-bcast",
													"num-installed", "num-tcp", "cps", "kbps"]);

				mdevice.statsdb.add("sessioninfo", o2store)
					.then(function(msg) {
						mdevice.triggerDetach("sessioninfo:update");
					})
					.then(null, function(err) {
						console.log("Error saving sessioninfo for device "+mdevice.serial+": "+err);
					});
			})
			.then(null, function(err) {
				console.log("Error in tracking sessioninfo on device "+mdevice.serial+": "+err);
			});
	});
};
panachrome.updateSessionInfoView = function(mdevice) {
	mdevice.statsdb.getLastElements("sessioninfo", 1)
		.then(function(res) {
			if(res.length === 0) {
				return;
			}

			mdevice.sessioninfoView = res[0];
			mdevice.triggerDetach("sessioninfoview:update");
		})
		.then(null, function(err) {
			console.log("Error getting last elements from sessioninfo: "+err);
		});	
};

panachrome.ifsMonitorFactory = function(mdevice) {
	return (function() {		
		if (!mdevice.polling) {
			return;
		}
		panwxmlapi.getIfsCounters(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
			.then(function($result) {
				mdevice.lastPoll = new Date();

				var r1 = { ifnet: {}, hw: {} };
				var r1date = new Date().getTime();
				var o2store = { ifnet: [], hw: [] };
				
				
/*
    <entry>
      <neighpend>0</neighpend>
      <ifwderrors>0</ifwderrors>
      <ierrors>0</ierrors>
      <macspoof>0</macspoof>
      <pod>0</pod>
      <flowstate>0</flowstate>
      <ipspoof>0</ipspoof>
      <teardrop>0</teardrop>
      <ibytes>0</ibytes>
      <noarp>0</noarp>
      <noroute>0</noroute>
      <noneigh>0</noneigh>
      <nomac>0</nomac>
      <l2_encap>0</l2_encap>
      <zonechange>0</zonechange>
      <obytes>0</obytes>
      <land>0</land>
      <name>ethernet1/1</name>
      <icmp_frag>0</icmp_frag>
      <ipackets>0</ipackets>
      <opackets>0</opackets>
      <l2_decap>0</l2_decap>
      <idrops>0</idrops>
    </entry>
*/

				var $ifnetentries = $result.children('ifnet').children('entry');
				$ifnetentries.each(function() {
					var $t = $(this);
					var i = {};
					var n;
					$t.children().each(function() {
						var tn = $(this).prop('tagName');
						if (tn == 'name') {
							n = $(this).text();
						} else {
							i[tn] = $(this).text();
						}
					});
					r1.ifnet[n] = i;
				});

/*
    <entry>
      <obytes>0</obytes>
      <name>vlan</name>
      <idrops>0</idrops>
      <ipackets>0</ipackets>
      <opackets>0</opackets>
      <ierrors>0</ierrors>
      <ibytes>0</ibytes>
      <port>
        <tx-unicast>1297374</tx-unicast>
        <tx-multicast>17965</tx-multicast>
        <rx-broadcast>0</rx-broadcast>
        <rx-unicast>53720</rx-unicast>
        <rx-multicast>0</rx-multicast>
        <rx-bytes>23446659</rx-bytes>
        <tx-broadcast>1222508</tx-broadcast>
        <tx-bytes>95601583</tx-bytes>
      </port>
    </entry>
	XXX: exclude "port"
*/
				var $hwentries = $result.children('hw').children('entry');
				$hwentries.each(function() {
					var $t = $(this);
					var i = {};
					var n;
					$t.children().each(function() {
						var tn = $(this).prop('tagName');
						if (tn == 'name') {
							n = $(this).text();
							return;
						} 
						if(tn == "port") {
							return;
						}
						i[tn] = $(this).text();
					});
					r1.hw[n] = i;
				});
				
				/* 2nd call to get the rate */
				setTimeout(function() {
					panwxmlapi.getIfsCounters(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
						.then(function($res2) {
							mdevice.lastPoll = new Date();

							var dt = ((new Date().getTime())-r1date);
							
							// ifnet
							var $ifnetentries = $res2.children('ifnet').children('entry');
							$ifnetentries.each(function() {
								var $t = $(this);
								var i = {};
								$t.children().each(function() {
									var tn = $(this).prop('tagName');
									if (tn == 'name') {
										i.name = $(this).text();
									} else {
										i[tn] = {};
										i[tn].value = $(this).text();
										i[tn].rate = 0;
									}
								});
								if(typeof r1.ifnet[i.name] != "undefined") {
									for(var p in i) {
										if(p == "name") continue;
										if(typeof r1.ifnet[i.name][p] == "undefined") continue;
										i[p].rate = (i[p].value-r1.ifnet[i.name][p])*1000/dt;
									}
								}
								o2store.ifnet.push(i);
							});
							// hw
							var $hwentries = $res2.children('hw').children('entry');
							$hwentries.each(function() {
								var $t = $(this);
								var i = {};
								$t.children().each(function() {
									var tn = $(this).prop('tagName');
									if (tn == 'name') {
										i.name = $(this).text();
										return;
									}
									if (tn == 'port') {
										// XXX
										return;
									}
									i[tn] = {};
									i[tn].value = $(this).text();
									i[tn].rate = 0;
								});
								if(typeof r1.hw[i.name] != "undefined") {
									for(var p in i) {
										if(p == "name") continue;
										if(typeof r1.hw[i.name][p] == "undefined") continue;
										i[p].rate = (i[p].value-r1.hw[i.name][p])*1000/dt;
									}
								}
								o2store.hw.push(i);
							});
							
							mdevice.statsdb.add("ifs", o2store)
								.then(function(msg) {
									mdevice.triggerDetach("ifs:update");
								})
								.then(null, function(err) {
									console.log("Error saving ifs for device "+mdevice.serial+": "+err);
								});
						})
						.then(null, function(err) {
							console.log("Error in tracking ifs on device "+mdevice.serial+": "+err);
						});
				}, panachrome.config.ifsTrackingInterval*1000);
			})
			.then(null, function(err) {
				console.log("Error in tracking ifs on device "+mdevice.serial+": "+err);
			});
	});
};
panachrome.updateIfsView = function(mdevice) {
	mdevice.statsdb.getLastElements("ifs", 1)
		.then(function(res) {
			if(res.length === 0) {
				return;
			}

			mdevice.ifsView = res[0];
			mdevice.triggerDetach("ifsview:update");
		})
		.then(null, function(err) {
			console.log("Error getting last elements from ifs: "+err);
		});
};
panachrome.countersMonitorFactory = function(mdevice) {
/*
      <entry>
        <category>packet</category>
        <severity>info</severity>
        <value>1</value>
        <rate>0</rate>
        <aspect>resource</aspect>
        <desc>Packets entered module flow stage ctrl</desc>
        <id>919</id>
        <name>pkt_flow_ctrl</name>
      </entry>
*/
	return (function() {
		if (!mdevice.polling) {
			return;
		}
		panwxmlapi.getCounterGlobal(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
			.then(function($result) {
				mdevice.lastPoll = new Date();

				var o2store = { counters: [] };
				var $entries = $result.find("global").find("counters").find("entry");
				$entries.each(function() {
					var c = {};
					var $t = $(this);
					c.name = $t.find("name").text();
					c.category = $t.find("category").text();
					c.severity = $t.find("severity").text();
					c.aspect = $t.find("aspect").text();
					c.value = $t.find("value").text();
					c.rate = $t.find("rate").text();
					o2store.counters.push(c);
				});

				mdevice.statsdb.add("counters", o2store)
					.then(function(msg) {
						mdevice.triggerDetach("counters:update");
					})
					.then(null, function(err) {
						console.log("Error saving counters for device "+mdevice.serial+": "+err);
					});
			})
			.then(null, function(err) {
				console.log("Error in tracking counters on device "+mdevice.serial+": "+err);
			});
	});
};
panachrome.updateCountersView = function(mdevice) {
	mdevice.statsdb.getLastElements("counters", 1)
		.then(function(res) {
			var j, k, oldres, cc, oldcc;

			if(res.length === 0) {
				return;
			}

			if(typeof mdevice.countersView == "undefined") {
				mdevice.countersView = res[0];
				for(j = 0; j < mdevice.countersView.counters.length; j++) {
					cc = mdevice.countersView.counters[j];
					cc.valuechange = "**";
					cc.ratechange = "**";
					cc.value = parseInt(cc.value, 10);
					cc.rate = parseInt(cc.rate, 10);
				}
			} else {
				oldres = mdevice.countersView;
				mdevice.countersView = res[0];
				for(j = 0; j < mdevice.countersView.counters.length; j++) {
					cc = mdevice.countersView.counters[j];
					cc.value = parseInt(cc.value, 10);
					cc.rate = parseInt(cc.rate, 10);
					for(k = 0; k < oldres.counters.length; k++) {
						if(typeof oldres.counters[k] == "undefined") {
							continue;
						}
						if(cc.name == oldres.counters[k].name) {
							cc.valuechange = (cc.value - oldres.counters[k].value)/(mdevice.countersView.date - oldres.date);
							cc.ratechange = (cc.rate - oldres.counters[k].rate)/(mdevice.countersView.date - oldres.date);
							delete oldres.counters[k];
							break;
						}
					}
					if(typeof cc.valuechange == "undefined") {
						cc.valuechange = "**";
						cc.ratechange = "**";
					}
				}
				for(j = 0; j < oldres.counters.length; j++) {
					if(typeof oldres.counters[j] != "undefined") {
						oldres.counters[j].valuechange = "--";
						oldres.counters[j].ratechange = "--";
						mdevice.countersView.counters.push(oldres.counters[j]);
					}
				}
			}
			mdevice.triggerDetach("countersview:update");
		})
		.then(null, function(err) {
			console.log("Error getting last elements from counters: "+err);
		});
};

panachrome.jobsMonitorFactory = function(mdevice) {
	return (function() {
		if (!mdevice.polling) {
			return;
		}
		panwxmlapi.getJobs(mdevice.key, mdevice.address, mdevice.port, mdevice.proto)
			.then(function($result) {
				mdevice.lastPoll = new Date();

				mdevice.pendingJobs = mdevice.pendingJobs || {};
				mdevice.lastJobId = mdevice.lastJobId || -1;
				var lji = -1;

				$result.children('job').each(function(idx) {
					var $t = $(this);
					var s = $t.children('status:first').text();
					var id = parseInt($t.children('id:first').text(), 10);
					
					if(idx === 0) lji = id;

					if(s != 'FIN') {
						mdevice.pendingJobs[id] = s;

						return;
					}
					if(typeof mdevice.pendingJobs[id] != "undefined") {
						var r = $t.children('result:first').text();
						var t = $t.children('type:first').text();
						panachrome.showJob(id, t, r);
						delete mdevice.pendingJobs[id];

						return;
					}
					if(mdevice.lastJobId == -1) return;
					if(id > mdevice.lastJobId) {
						var r = $t.children('result:first').text();
						var t = $t.children('type:first').text();
						panachrome.showJob(id, t, r);

						return;						
					}
				});
				mdevice.lastJobId = lji;
			})
			.then(null, function(err) {
				console.log("Error in tracking jobs on device "+mdevice.serial+": "+err);
			});
	});
};

panachrome.initDeviceMonitors = function(mdevice) {
	mdevice.polling = false;
	if(panachrome.config.pollingDefault == 1) {
		mdevice.polling = true;
	}
	
	mdevice.countersMonitor = panachrome.countersMonitorFactory(mdevice);
	mdevice.ifsMonitor = panachrome.ifsMonitorFactory(mdevice);
	mdevice.sessioninfoMonitor = panachrome.sessioninfoMonitorFactory(mdevice);
	mdevice.cpMonitor = panachrome.cpMonitorFactory(mdevice);
	mdevice.dpMonitor = panachrome.dpMonitorFactory(mdevice);
	mdevice.jobsMonitor = panachrome.jobsMonitorFactory(mdevice);
	
	// create the intervals and call the monitors
	mdevice.pollers = [];
	mdevice.pollers.push(setInterval(mdevice.countersMonitor, panachrome.config.trackingInterval*1000));
	setTimeout(mdevice.countersMonitor, 0);
	mdevice.pollers.push(setInterval(mdevice.ifsMonitor, panachrome.config.trackingInterval*1000));
	setTimeout(mdevice.ifsMonitor, 0);
	mdevice.pollers.push(setInterval(mdevice.sessioninfoMonitor, panachrome.config.trackingInterval*1000));
	setTimeout(mdevice.sessioninfoMonitor, 0);
	
	// resources tracked at 2x the tracking interval. No special reason.
	mdevice.pollers.push(setInterval(mdevice.cpMonitor, panachrome.config.trackingInterval*2*1000));
	setTimeout(mdevice.cpMonitor, 0);
	mdevice.pollers.push(setInterval(mdevice.dpMonitor, panachrome.config.trackingInterval*2*1000));
	setTimeout(mdevice.dpMonitor, 0);

	mdevice.pollers.push(setInterval(mdevice.jobsMonitor, panachrome.config.jobsTrackingInterval*1000));
	setTimeout(mdevice.jobsMonitor, 0);
	
	mdevice.on("counters:update", function() {
		panachrome.updateCountersView(mdevice);
	});
	mdevice.on("ifs:update", function() {
		panachrome.updateIfsView(mdevice);
	});
	mdevice.on("sessioninfo:update", function() {
		panachrome.updateSessionInfoView(mdevice);
	});
	mdevice.on("cp:update", function() {
		panachrome.updateCpView(mdevice);
	});
	mdevice.on("dp:update", function() {
		panachrome.updateDpView(mdevice);
	});
};

panachrome.getNumMonitored = function() {
	var res = 0;
	var cm;
	for(var cs in panachrome.monitored) {
		cm = panachrome.monitored[cs];
		if (!(cm instanceof panachrome.mDevice)) {
			continue;
		}
		res = res+1;
	}

	return res;
};
panachrome.getMonitoredByAddress = function(address, port, proto) {
	var res;
	for(var cs in panachrome.monitored) {
		res = panachrome.monitored[cs];
		if (!(res instanceof panachrome.mDevice)) {
			continue;
		}
		if(res.address == address && res.port == port && res.proto == proto) {
			return res;
		}
	}
};
panachrome.delMonitored = function(serial) {
	var entry;
	for(var cs in panachrome.monitored) {
		entry = panachrome.monitored[cs];
		if(entry.serial == serial) {
			delete panachrome.monitored[serial];
			
			for(var j = 0; j < entry.pollers.length; j++) {
				clearInterval(entry.pollers[j]);
			}
			
			// shutdown the db
			if (typeof entry.statsdb != "undefined") {
				entry.statsdb.shutdown();
			}
			
			panachrome.monitored.triggerDetach("delete", { detail: serial });
			
			entry = null;
		}
	}
};
panachrome.addMonitored = function(address, port, username, password, proto) {
	var candidate = new panachrome.mDevice(address, port, proto);
	var promise = new RSVP.Promise();
	
	panwxmlapi.keygen(username, password, address, port, proto)
		.then(function(key) {
			candidate.key = key;
			return panwxmlapi.sendOpCmd("<show><system><info></info></system></show>", key, address, port, proto);
		})
		.then(function($ssi) {
			var serial = $ssi.find("system").find("serial").text();
			var hostname = $ssi.find("system").find("hostname").text();
			var model = $ssi.find("system").find("model").text();
			var swversion = $ssi.find("system").find("sw-version").text();
			var multivsys = $ssi.find("system").find("multi-vsys").text();
			if ((typeof serial != "string") || (serial.length > 12) || (serial.length < 11)) {
				promise.reject("Invalid response from device, serial: "+serial);
				return;
			}
			if (typeof hostname == "undefined") {
				hostname = "@"+serial;
			}
			if (typeof model == "undefined") {
				model = "PA-UNKNOWN";
			}
			if (typeof swversion == "undefined") {
				swversion = "UNKNOWN";
			}
			candidate.serial = serial;
			candidate.hostname = hostname;
			candidate.model = model;
			candidate.swversion = swversion;
			candidate.multivsys = (multivsys == "off" ? false : true);

			// default 1 DP, with pre-5.0.9 only DP0 was retrieved even on PA-5Ks. If post-5.0.9 numDPs is automatically updated 
			// by DP resource monitor
			candidate.sysdefs = { numDPs: 1 }; 

			// console.log(candidate);

			if (typeof panachrome.monitored[serial] != "undefined") {
				promise.reject("Device "+serial+" is already monitored");
				return;
			}
			
			// create the db for the stats history
			candidate.statsdb = new panwstatsdb.StatsDb(serial);
			candidate.statsdb.open()
				.then(function() {
					RSVP.EventTarget.mixin(candidate);
					
					panachrome.initDeviceSystemInfo(candidate);
					
					panachrome.initDeviceMonitors(candidate);
								
					panachrome.monitored[serial] = candidate;
					panachrome.monitored.triggerDetach("add", { detail: serial });
					
					promise.resolve("Device "+serial+" added to the monitor list");
				})
				.then(null, function(msg) {
					promise.reject(msg);
				});			
		})		
		.then(null, function(err) {
			promise.reject(err);
		});
		
	return promise;
};
panachrome.alreadyMonitoredByURL = function(url) {
	var duri = URI(url);
	var address = duri.hostname();
	var port = duri.port();
	var proto = duri.protocol();
	if (port === "") {
		if(proto == "https") 
			port = "443";
		else if(proto == "http")
			port = "80";
	}
	for (var cs in panachrome.monitored) {
		var cd = panachrome.monitored[cs];
		if (!(cd instanceof panachrome.mDevice)) {
			continue;
		}
		if(cd.address == address && cd.proto == proto && cd.port == port) {
			return true;
		}
	}
	return false;
};

panachrome.closeMonitoredViews = function(event) {
	var views = chrome.extension.getViews();
	for(var j = 0; j < views.length; j++) {
		if(views[j].location.href.indexOf("stats.html?d="+event.detail) != -1) {
			views[j].close();
		}
	}
};
panachrome.browserActionClicked = function(tab) {
	chrome.tabs.create({url: chrome.extension.getURL("monitorlist.html"), active:true});
};
panachrome.updateBrowserActionBadge = function() {
	chrome.browserAction.setBadgeText({ text: ""+panachrome.getNumMonitored() });
};

panachrome.install = function(details) {
	console.log("Install");
	
	// options
	if(localStorage.getItem('notifTimeout') == null) localStorage.setItem('notifTimeout', '5');
	if(localStorage.getItem('trackingInterval') == null) localStorage.setItem('trackingInterval', '30');
	if(localStorage.getItem('requestTimeout') == null) localStorage.setItem('requestTimeout', '5');
	if(localStorage.getItem('maxRunningReq') == null) localStorage.setItem('maxRunningReq', '2');
	if(localStorage.getItem('ifsTrackingInterval') == null) localStorage.setItem('ifsTrackingInterval', '5');
	if(localStorage.getItem('jobsTrackingInterval') == null) localStorage.setItem('jobsTrackingInterval', '30');
	if(localStorage.getItem('pollingDefault') == null) localStorage.setItem('pollingDefault', '1');
	if(localStorage.getItem('filteredJobs') == null) localStorage.setItem('filteredJobs', "[]");
};
panachrome.startup = function() {
	panwstatsdb.deleteAll();
};

// setup
panachrome.setup = function() {
	var onrequest = function(request, sender, sendResponse) {
		if(request.cmd == "getmonitored") {
			var res = [];
			for (var cs in panachrome.monitored) {
				var cd = panachrome.monitored[cs];
				if (cd instanceof panachrome.mDevice) {
					res.push([cd.hostname, cd.serial, cd.proto+"://"+cd.address+":"+cd.port]);
				}
			}
			sendResponse({ result: res });
			return;
		}
		if(request.cmd == "isalreadymonitored") {
			sendResponse({ result: panachrome.alreadyMonitoredByURL(sender.tab.url) });
		}
		if(request.cmd == "readconfig") {
			panachrome.readConfig();
			return;
		}
		if(request.cmd == 'add') {
			if(panachrome.alreadyMonitoredByURL(sender.tab.url)) {
				return;
			}
			var duri = URI(sender.tab.url);
			var port = duri.port();
			port = (port === "") ? 443 : port;
			panachrome.addMonitored(duri.hostname(), port, request.user, request.password, duri.protocol())
				.then(panachrome.info, panachrome.error);
		}
	};
	
	// init the background page
	panachrome.readConfig();
	RSVP.EventTarget.mixin(panachrome.monitored);
	chrome.runtime.onStartup.addListener(panachrome.startup);
	chrome.runtime.onInstalled.addListener(panachrome.install);
	chrome.extension.onRequest.addListener(onrequest);
	chrome.notifications.onButtonClicked.addListener(panachrome.filterJobClicked);

	// setup browseraction stuff
	chrome.browserAction.setBadgeText({ text: "0" });
	chrome.browserAction.setBadgeBackgroundColor({ color: "#9db93f" });
	chrome.browserAction.onClicked.addListener(panachrome.browserActionClicked);
	panachrome.monitored.on("add", panachrome.updateBrowserActionBadge);
	panachrome.monitored.on("delete", panachrome.updateBrowserActionBadge);
	panachrome.monitored.on("delete", panachrome.closeMonitoredViews);
};

panachrome.setup();
