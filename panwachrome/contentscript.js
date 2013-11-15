// Released under MIT License by Luigi Mori. January 2013.

(function() {
var trySSO = function() {
	if(document.querySelector('#login_form') == null) return;
	if(document.querySelector("input[name='user']") == null) return;
	if(document.querySelector("input[name='passwd']") == null) return;
	
	if(document.body.innerHTML.indexOf('__LOGIN_PAGE_FOR_PANORAMA_BACKWARD_COMPATIBILITY__') != -1) {
		console.log('palo alto login page');
		document.querySelector('#login_form').addEventListener('submit', function() {
			if(confirm('Add to Pan(w)achrome ?')) {
				var uname = document.querySelector("input[name='user']").value;
				var passwd = document.querySelector("input[name='passwd']").value;
			
				chrome.extension.sendRequest({cmd: 'add', user: uname, password: passwd});
			}
			
			return true;
		});
		return true;
	}
	
	return false;
};

trySSO();
})();