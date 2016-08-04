/*! Released under MIT License by Luigi Mori. January 2013. */

var panwxmlapi = panwxmlapi || {};

panwxmlapi.requestTimeout = 5000;
panwxmlapi.maxRunningReq = 2;

panwxmlapi.queues = {};

panwxmlapi.setupCookieRemover = function() {
	chrome.webRequest.onBeforeSendHeaders.addListener(
		function(details) {
        	for (var i = 0; i < details.requestHeaders.length; ++i) {
        		if (details.requestHeaders[i].name === 'Cookie') {
              		details.requestHeaders.splice(i, 1);
              		break;
            	}
          	}

			return {requestHeaders: details.requestHeaders};
		},
		{
			urls: ['*://*/api/?key=*'],
			tabId: -1
		},
		[
			"blocking",
			"requestHeaders"
		]
	);
	chrome.webRequest.onHeadersReceived.addListener(
		function(details) {
        	for (var i = 0; i < details.responseHeaders.length; ++i) {
        		if (details.responseHeaders[i].name === 'Set-Cookie') {
              		details.responseHeaders.splice(i, 1);
              		break;
            	}
          	}

			return {responseHeaders: details.responseHeaders};
		},
		{
			urls: ['*://*/api/?key=*'],
			tabId: -1
		},
		[
			"blocking",
			"responseHeaders"
		]
	);
};
panwxmlapi.getResult = function(data) {
	var $r = $(data).find("response");
	if (typeof $r == "undefined") {
		return "Invalid response from device: missing <response>";
	}
	var status = $r.attr("status");
	if (typeof status != "string") {
		return "Invalid response from device: missing status";
	}
	if (status != "success") {
		var msg = $r.find("result").find("msg").text();
		return "Request failed ("+msg+")";
	}

	return $r.find("result");
};
panwxmlapi.keygen = function(username, password, address, port, proto) {
	var promise = new RSVP.Promise();

	$.ajax({
		type: "GET",
		url: proto+"://"+address+":"+port+"/api/",
		data: { type: 'keygen', user: username, password: password },
		dataType: "xml",
		timeout: panwxmlapi.requestTimeout
	})
	.done(function(data) {
		var $r = panwxmlapi.getResult(data);
		if (typeof $r != "object") {
			promise.reject($r);
			return;
		}
		var key = $r.find("key").text();
		console.log("Keygen: "+key);
		promise.resolve(key);
	})
	.fail(function(jqXHR, textStatus) { console.log("Keygen error: "+jqXHR.statusText); promise.reject(textStatus); });

	return promise;
};
panwxmlapi._sendCmdFromQueue = function(event) {
	var queue = panwxmlapi.queues[event.detail];
	if(queue.numrunning >= panwxmlapi.maxRunningReq) {
		return;
	}
	if(queue.queue.length === 0) {
		return;
	}

	queue.numrunning = queue.numrunning + 1;
	var request = queue.queue.shift();
	$.ajax({
		type: "GET",
		url: request.proto+"://"+request.address+":"+request.port+"/api/",
		// data: { key: request.key, type: request.type, cmd: request.cmd },
		data: "key="+request.key+"&"+request.data,
		dataType: "xml",
		timeout: panwxmlapi.requestTimeout
	})
	.done(function(data) {
		queue.numrunning = queue.numrunning - 1;
		queue.triggerDetach("update", { detail: event.detail });

		var $r = panwxmlapi.getResult(data);
		if (typeof $r != "object") {
			request.promise.reject($r);
			return;
		}
		request.promise.resolve($r);
	})
	.fail(function(jqXHR, textStatus) {
		queue.numrunning = queue.numrunning - 1;
		queue.triggerDetach("update", { detail: event.detail });

		console.log("XML API cmd error: "+jqXHR.statusText);
		request.promise.reject(textStatus);
	});
};
panwxmlapi.sendOpCmd = function(cmd, key, address, port, proto) {
	var qkey = address+":"+port;
	var promise = new RSVP.Promise();

	if(typeof panwxmlapi.queues[qkey] == "undefined") {
		panwxmlapi.queues[qkey] = { queue: [], numrunning: 0 };
		RSVP.EventTarget.mixin(panwxmlapi.queues[qkey]);
		panwxmlapi.queues[qkey].on("update", panwxmlapi._sendCmdFromQueue);
	}
	panwxmlapi.queues[qkey].queue.push({ data: "type=op&cmd="+encodeURIComponent(cmd),
		key: key,
		address: address,
		port: port,
		proto: proto,
		promise: promise
	});
	panwxmlapi.queues[qkey].triggerDetach("update", { detail: qkey });

	return promise;
};
panwxmlapi.sendConfigCmd = function(action, xpath, key, address, port, proto) {
	var qkey = address+":"+port;
	var promise = new RSVP.Promise();

	if(typeof panwxmlapi.queues[qkey] == "undefined") {
		panwxmlapi.queues[qkey] = { queue: [], numrunning: 0 };
		RSVP.EventTarget.mixin(panwxmlapi.queues[qkey]);
		panwxmlapi.queues[qkey].on("update", panwxmlapi._sendCmdFromQueue);
	}
	panwxmlapi.queues[qkey].queue.push({ data: "type=config&action="+action+"&xpath="+encodeURIComponent(xpath),
		key: key,
		address: address,
		port: port,
		proto: proto,
		promise: promise
	});
	panwxmlapi.queues[qkey].triggerDetach("update", { detail: qkey });

	return promise;
};
panwxmlapi.getIfsCounters = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd("<show><counter><interface>all</interface></counter></show>", key, address, port, proto);
};
panwxmlapi.getCounterGlobal = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><counter><global></global></counter></show>', key, address, port, proto);
};
panwxmlapi.getSessionInfo = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><session><info></info></session></show>', key, address, port, proto);
};
panwxmlapi.getInterfaceAll = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><interface>all</interface></show>', key, address, port, proto);
};
panwxmlapi.getDPResources = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><running><resource-monitor></resource-monitor></running></show>', key, address, port, proto);
};
panwxmlapi.getCPResources = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><system><resources></resources></system></show>', key, address, port, proto);
};
panwxmlapi.getDPResources = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><running><resource-monitor></resource-monitor></running></show>', key, address, port, proto);
};
panwxmlapi.getJobs = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd('<show><jobs><all></all></jobs></show>', key, address, port, proto);
};
panwxmlapi.getSessionStateCount = function(key, address, port, proto, state) {
	return panwxmlapi.sendOpCmd("<show><session><all><filter><state>"+state+"</state><count>yes</count></filter></all></session></show>", key, address, port, proto);
};
panwxmlapi.getSessionApplicationCount = function(key, address, port, proto, application) {
	return panwxmlapi.sendOpCmd("<show><session><all><filter><application>"+application+"</application><count>yes</count></filter></all></session></show>", key, address, port, proto);
};
panwxmlapi.getSessionDecryptCount = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd("<show><session><all><filter><ssl-decrypt>yes</ssl-decrypt><count>yes</count></filter></all></session></show>", key, address, port, proto);
};
panwxmlapi.getSessionVsysCount = function(key, address, port, proto, vsysname) {
	return panwxmlapi.sendOpCmd("<show><session><all><filter><vsys-name>"+vsysname+"</vsys-name><count>yes</count></filter></all></session></show>", key, address, port, proto);
};
panwxmlapi.getHardwareInterfaceErrors = function(key, address, port, proto) {
	return panwxmlapi.sendOpCmd("<show><system><state><filter>sys.s1.p*.detail</filter></state></system></show>",
		key, address, port, proto);
};
panwxmlapi.getVsysList = function(key, address, port, proto) {
	return panwxmlapi.sendConfigCmd("get", "/config/devices/entry[@name='localhost.localdomain']/vsys/entry/@name",
		key, address, port, proto);
};
