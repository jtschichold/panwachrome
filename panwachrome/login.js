// Released under MIT License by Luigi Mori. January 2013.

(function(d,w,u) {
	var params;
	var backgroundPage;
	var msg;
	var form;
	
	var displayMessage = function(m) {
		msg.innerHTML = m;
		msg.style.display = "block";
		form.style.display = "none";
	};
	var displayError = function(e) {
		msg.innerHTML = "Error: "+e+" <a href=\"#\" id=\"loginretry\">Retry</a>";
		msg.style.display = "block";
		d.querySelector("#loginretry").addEventListener('click', function() { d.location.reload(); });
		form.style.display = "none";
	};
	var addMonitoredDevice = function() {
		var u = d.querySelector('#username').value;
		var p = d.querySelector('#password').value;
		
		displayMessage("Checking credentials...");
		var promise = backgroundPage.panachrome.addMonitored(params.a, params.dp, u, p, params.p);
		promise.then(function(m) {
			var md = backgroundPage.panachrome.getMonitoredByAddress(params.a, params.dp, params.p);
			displayMessage(m+'. <a href="'+chrome.extension.getURL('stats.html')+'?d='+md.serial+'">Show</a>');
		}, function(err) {
			displayError(err);			
		});
	};
	var setup = function() {
		params = URI.parseQuery(URI(d.location.href).query());
		if(params.dp == "") {
			if(params.p == "http") {
				params.dp = "80";
			} else if(params.p == "https") {
				params.dp = "443";
			}
		}
		
		backgroundPage = chrome.extension.getBackgroundPage();
		
		msg = d.querySelector("#loginmessage");
		form = d.querySelector("#loginform");
		
		d.querySelector("#loginhost").textContent = "Credentials for XML API on device "+params.p+"://"+params.a+":"+params.dp;
		d.querySelector('#loginbtn').addEventListener('click', addMonitoredDevice);
	};
	
	setup();
})(document,window);
