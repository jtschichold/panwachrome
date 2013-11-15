// Released under MIT License by Luigi Mori. January 2013.

var panwstatsdb = panwstatsdb || {};

panwstatsdb.StatsDb = function(serial) {
	this.dbname = serial;

	this.map60mcache = {};
};
panwstatsdb.StatsDb.prototype.open = function() {
	var promise = new RSVP.Promise();
	var self = this;
	var req = window.webkitIndexedDB.open(this.dbname);
	req.onsuccess = function(event) {
		self.db = event.target.result;
		console.log("db-version:"+self.db.version);
		if (self.db.version != "1") {
			var nreq = self.db.setVersion("1");
			nreq.onsuccess = function(event) {
				console.log('init db ostore');
				self.db.createObjectStore("ifs", { keyPath: "date" });
				self.db.createObjectStore("dp", { keyPath: "date" });
				self.db.createObjectStore("cp", { keyPath: "date" });
				self.db.createObjectStore("sessioninfo", { keyPath: "date" });
				self.db.createObjectStore("counters", { keyPath: "date" });
				promise.resolve();
			};
			nreq.onerror = function(event) {
				promise.reject(event.error);
			};
		} else {
			promise.resolve();
		}
	};
	req.onerror = function(event) {
		promise.reject(event.error);
	};
	req.onupgradeneeded = function(event) {
		console.log("onupgradeneeded");
		self.db = event.target.result;
		console.log('init db ostore');
		self.db.createObjectStore("ifs", { keyPath: "date" });
		self.db.createObjectStore("dp", { keyPath: "date" });
		self.db.createObjectStore("cp", { keyPath: "date" });
		self.db.createObjectStore("sessioninfo", { keyPath: "date" });
		self.db.createObjectStore("counters", { keyPath: "date" });
		promise.resolve();
	};
	
	return promise;
};
panwstatsdb.StatsDb.prototype.add = function(ostore, value) {
	var promise = new RSVP.Promise();
	
	value.date = new Date().getTime();
	var trans = this.db.transaction([ostore], "readwrite");
	trans.onerror = function(event) {
		console.error("Error in add transaction to "+ostore);
		promise.reject("Error in transaction to "+ostore);
	};
	var objstore = trans.objectStore(ostore);
	var req = objstore.add(value);
	req.onerror = function(event) {
		promise.reject("Error adding object to "+ostore);
	};
	req.onsuccess = function(event) {
		promise.resolve("Successfully added new object to "+ostore);
	};

	// flush cache
	delete this.map60mcache[ostore];
	this.map60mcache[ostore] = {};

	return promise;
};
panwstatsdb.StatsDb.prototype.shutdown = function() {
	this.db.close();
	var req = window.webkitIndexedDB.deleteDatabase(this.dbname);
	req.onblocked = function(event) {
		console.log("shutdown onblocked: "+event);
	};
	req.onerror = function(event) {
		console.log("shutdown onerror: "+event);
	};
};
panwstatsdb.StatsDb.prototype.getLastElements = function(ostore, n) {
	var res = [];
	var promise = new RSVP.Promise();
	var trans = this.db.transaction(ostore);
	trans.onerror = function(event) {
		console.error("Error in gle transaction to "+ostore);
	};
	var objectStore = trans.objectStore(ostore);
	
	var req = objectStore.openCursor(null, 'prev' /* window.webkitIDBCursor.PREV */);
	req.onerror = function(err) {
		promise.reject("Error in opening cursor on "+ostore+": "+err);
	};
	req.onsuccess = function(event) {
		var cursor = event.target.result;
		if (cursor) {
			res.push(cursor.value);
			if (res.length == n) {
				promise.resolve(res);
				return;
			}
			cursor.continue();
		} else {
			promise.resolve(res);
		}
	};
	return promise;
};
panwstatsdb.StatsDb.prototype.eachLast60Minutes = function(ostore, callback) {
	var promise = new RSVP.Promise();
	var trans = this.db.transaction(ostore);
	trans.onerror = function(event) {
		console.error("Error in gl60 transaction to "+ostore);
	};
	var objectStore = trans.objectStore(ostore);
	
	var now = new Date().getTime();
	var nv = 0;
	var req = objectStore.openCursor(window.webkitIDBKeyRange.bound(now-(3600*1000), now, true, true), 'prev'/*window.webkitIDBCursor.PREV*/);
	req.onerror = function(err) {
		promise.reject("Error in opening cursor on "+ostore+": "+err);
	};
	req.onsuccess = function(event) {
		var cursor = event.target.result;
		if (cursor) {
			callback(cursor.value);
			nv = nv+1;
			cursor.continue();
		} else {
			promise.resolve(nv);
		}
	};
	return promise;
};
panwstatsdb.StatsDb.prototype.mapLast60Minutes = function(ostore, callback, label) {
	var result = [];
	var promise = new RSVP.Promise();
	var self = this;

	if(typeof label != "undefined") {
		if(typeof this.map60mcache[ostore] != "undefined") {
			if(typeof this.map60mcache[ostore][label] != "undefined") {
				promise.resolve(this.map60mcache[ostore][label]);

				return promise;
			}
		}
	}

	this.eachLast60Minutes(ostore, function(e) {
		result.push(callback(e));
	})
	.then(function(n) {
		if(typeof label != "undefined") {
			self.map60mcache[ostore] = self.map60mcache[ostore] || {};
			self.map60mcache[ostore][label] = result;
		}

		promise.resolve(result);
	}, function(err) {
		promise.reject(err);
	});

	return promise;
};
panwstatsdb.deleteAll = function() {
	var req = window.webkitIndexedDB.webkitGetDatabaseNames();
	req.onsuccess = function(event) {
		var res = event.target.result;
		for(var j = 0; j < res.length; j++) {
			console.log("deleting "+res[j]);
			var reqdd = window.webkitIndexedDB.deleteDatabase(res[j]);
			reqdd.onsuccess = function(event) {
				console.log("database deleted: "+j);
			};
			reqdd.onerror = function(event) {
				console.log("onerror"); console.log(event);
			};
			reqdd.onblocked = function(event) {
				console.log("onblocked: "+j);
			};
		}
	};
};
