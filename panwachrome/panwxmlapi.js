// Released under MIT License by Luigi Mori. January 2013.

var panwxmlapi = panwxmlapi || {};

panwxmlapi.requestTimeout = 5000;
panwxmlapi.maxRunningReq = 2;

panwxmlapi.queues = {};

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
		data: "key="+request.key+"&type="+request.type+"&cmd="+encodeURIComponent(request.cmd),
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
panwxmlapi.sendCmd = function(type, cmd, key, address, port, proto) {
	var qkey = address+":"+port;
	var promise = new RSVP.Promise();
	
	if(typeof panwxmlapi.queues[qkey] == "undefined") {
		panwxmlapi.queues[qkey] = { queue: [], numrunning: 0 };
		RSVP.EventTarget.mixin(panwxmlapi.queues[qkey]);
		panwxmlapi.queues[qkey].on("update", panwxmlapi._sendCmdFromQueue);
	}
	panwxmlapi.queues[qkey].queue.push({ type: type, cmd: cmd, key: key, address: address, port: port, proto: proto, promise: promise });
	panwxmlapi.queues[qkey].triggerDetach("update", { detail: qkey });

	return promise;
};
panwxmlapi.getIfsCounters = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", "<show><counter><interface>all</interface></counter></show>", key, address, port, proto);
};
panwxmlapi.getCounterGlobal = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><counter><global></global></counter></show>', key, address, port, proto);
};
panwxmlapi.getSessionInfo = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><session><info></info></session></show>', key, address, port, proto);
};
panwxmlapi.getInterfaceAll = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><interface>all</interface></show>', key, address, port, proto);
};
panwxmlapi.getDPResources = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><running><resource-monitor></resource-monitor></running></show>', key, address, port, proto);
};
panwxmlapi.getCPResources = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><system><resources></resources></system></show>', key, address, port, proto);
};
panwxmlapi.getDPResources = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><running><resource-monitor></resource-monitor></running></show>', key, address, port, proto);
};
panwxmlapi.getJobs = function(key, address, port, proto) {
	return panwxmlapi.sendCmd("op", '<show><jobs><all></all></jobs></show>', key, address, port, proto);
};
panwxmlapi.getSessionStateCount = function(key, address, port, proto, state) {
	return panwxmlapi.sendCmd("op", "<show><session><all><filter><state>"+state+"</state><count>yes</count></filter></all></session></show>", key, address, port, proto);
};
