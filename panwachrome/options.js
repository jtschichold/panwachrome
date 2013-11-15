// Copyright 2010 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/* Jan 2013. Extended for my own purposes. Released under MIT License. Luigi Mori */ 

"use strict";

var panachrome_options = {
	isInt: function(n) {
		return typeof n === 'string' && parseFloat(n) == parseInt(n) && !isNaN(n);
	},
	
  saveCheckbox: function (id) {
    if (document.getElementById(id).checked) {
      localStorage.setItem(id, '1');
    } else {
      localStorage.setItem(id, '0');
    }
  },
  
  loadCheckbox: function (id) {
    document.getElementById(id).checked = localStorage.getItem(id);
  },

  saveTextbox: function (id) {
    localStorage.setItem(id, document.getElementById(id).value);
  },

  loadTextbox: function (id) {
    document.getElementById(id).value = localStorage.getItem(id) || '';
  },

  saveIntTextbox: function (id) {
	if (panachrome_options.isInt(document.getElementById(id).value)) {
		panachrome_options.saveTextbox(id);
	}
  },
  
  validate: function() {
	var t, ti;
	
	t = document.getElementById('notifTimeout').value;
	if(!panachrome_options.isInt(t) || parseInt(t) < 0) 
		return 0;
		
  ti = document.getElementById('trackingInterval').value;
  if(!panachrome_options.isInt(ti) || parseInt(ti) < 0) 
    return 0;
  ti = parseInt(ti, 10);
  if(ti < 5) return 0;

  t = document.getElementById('jobsTrackingInterval').value;
  if(!panachrome_options.isInt(t) || parseInt(t) < 0) 
    return 0;
  t = parseInt(t, 10);
  if(t < 10) return 0;

  t = document.getElementById('ifsTrackingInterval').value;
  if(!panachrome_options.isInt(t) || parseInt(t) < 0) 
    return 0;
  t = parseInt(t, 10);
  if(t >= (ti-1)) return 0;

  t = document.getElementById('requestTimeout').value;
  if(!panachrome_options.isInt(t) || parseInt(t) < 0) 
    return 0;
  t = parseInt(t, 10);
  if(t >= ti) return 0;

	return 1;
  },

  save: function () {
    panachrome_options.saveIntTextbox('notifTimeout');
    panachrome_options.saveIntTextbox('trackingInterval');
    panachrome_options.saveIntTextbox('requestTimeout');
    panachrome_options.saveIntTextbox('jobsTrackingInterval');
    panachrome_options.saveIntTextbox('ifsTrackingInterval');
  },

  load: function () {
    panachrome_options.loadTextbox('notifTimeout');
    panachrome_options.loadTextbox('trackingInterval');
    panachrome_options.loadTextbox('requestTimeout');
    panachrome_options.loadTextbox('ifsTrackingInterval');
    panachrome_options.loadTextbox('jobsTrackingInterval');
  },

  reset: function () {
    localStorage.clear();
    panachrome_options.load();
  },

  init: function () {
    panachrome_options.load();
  }
};

panachrome_options.init();

var saveButton = document.getElementById("save-button");
saveButton.onclick = function() {
	if(!panachrome_options.validate()) {
    alert("Invalid config");
    return;
  }
		
	panachrome_options.save();
	chrome.tabs.getSelected(null, function(tab) {
		chrome.tabs.remove(tab.id);
	});
	chrome.extension.sendRequest({cmd: 'readconfig'});
};
var resetButton = document.getElementById("reset-button");
resetButton.onclick = panachrome_options.init;

