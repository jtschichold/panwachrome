/* Released under MIT License by Luigi Mori. January 2013 */

(function(d,w,u) {
	var refreshInterval;

	var removeDevice = function(serial) {
		var $tr = $(this).parent().parent();
		var serial = $tr.attr('data-dserial');
		backgroundPage.panachrome.delMonitored(serial);
	};
	var openDeviceStats = function() {
		var $tr = $(this).parent();
		var serial = $tr.attr('data-dserial');
		w.location.href = chrome.extension.getURL("stats.html")+"?d="+serial;
	};
	var createDeviceRow = function(j, deviceinfo) {
		var newrow, chostname, cserial, caddress, ctools, cstatus, ihtml;
		var $table = $('#device-table');

		var desc = "";
		if(backgroundPage.panachrome.monitored[deviceinfo[1]].polling) {
			desc = "Monitored";
			if(typeof backgroundPage.panachrome.monitored[deviceinfo[1]].pendingJobs != "undefined") {
				var pj = Object.keys(backgroundPage.panachrome.monitored[deviceinfo[1]].pendingJobs).length;
				if(pj > 0) desc = desc + ", " + pj + " pending Jobs";
			}
		} else {
			desc = "Not monitored";
		}

		var lastpoll = "N/A";
		if(backgroundPage.panachrome.monitored[deviceinfo[1]].lastPoll) 
			lastpoll = backgroundPage.panachrome.monitored[deviceinfo[1]].lastPoll.toLocaleString();
		
		ihtml = [];
		ihtml.push('<tr data-dserial="'+deviceinfo[1]+'">');
		ihtml.push('<td class="device-table-link">'+deviceinfo[0]+'</td>');
		ihtml.push('<td class="device-table-link">'+deviceinfo[1]+'</td>');
		ihtml.push('<td class="device-table-link">'+deviceinfo[2]+'</td>');
		ihtml.push('<td>'+desc+'</td>');
		ihtml.push('<td>'+lastpoll+'</td>')
		ihtml.push('<td class="device-table-tools"><a href="#" class="device-table-delete">remove</a></td>');

		$table.append(ihtml.join(''));
	};
	var createMessageRow = function(msg) {
		var $table = $('#device-table');
		$table.append('<tr><td>'+msg+'</td></tr>');
	};
	var displayTabInfo  = function() {
		var $table = $('#device-table');
		$table.empty();
		$table.html('<tr id="device-table-header"><th>Name</th><th>Serial</th><th>Address</th><th>Status</th><th>Last Poll</th><th>&nbsp;</th>');
		chrome.extension.sendRequest({cmd: 'getmonitored'}, function(response) {
			if(response.hasOwnProperty('result')) {
				if (response.result.length === 0) {
					createMessageRow("No monitored devices");
					return;
				}
				for(var j = 0; j < response.result.length; j++) {
					createDeviceRow(j, response.result[j]);
				}
			}
		});
	};
	
	var backgroundPage = chrome.extension.getBackgroundPage();
	backgroundPage.panachrome.monitored.on("add", displayTabInfo);
	backgroundPage.panachrome.monitored.on("delete", displayTabInfo);
	w.addEventListener("beforeunload", function() {
		backgroundPage.panachrome.monitored.off("add", displayTabInfo);
		backgroundPage.panachrome.monitored.off("delete", displayTabInfo);

		clearInterval(refreshInterval);

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
	});
	
	displayTabInfo();
	refreshInterval = setInterval(displayTabInfo, 30*1000);

	$('#device-table').on('click', '.device-table-link', openDeviceStats);
	$('#device-table').on('click', '.device-table-delete', removeDevice);
})(document,window);
