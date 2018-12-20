// Released under MIT License by Luigi Mori. January 2013.

var panwstatsdb = panwstatsdb || {};

panwstatsdb.StatsDb = function(serial) {
	this.serial = serial;

	this.map60mcache = {};
};
panwstatsdb.StatsDb.prototype.open = function() {
	return panwstatsdb.openDB();
};
panwstatsdb.StatsDb.prototype.add = function(ostore, value) {
	var promise = new RSVP.Promise();
	
	value.serial = this.serial;
	value.date = new Date().getTime();

	var trans = panwstatsdb.db.transaction([ostore], "readwrite");
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
	// do nothing, it will be deleted with other data
};
panwstatsdb.StatsDb.prototype.getLastElements = function(ostore, n) {
	var res = [];
	var promise = new RSVP.Promise();
	var trans = panwstatsdb.db.transaction(ostore);
	var self = this;
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
			if (cursor.value.serial !== self.serial) {
				cursor.continue();
				return;
			}

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
	var self = this;

	var promise = new RSVP.Promise();
	var trans = panwstatsdb.db.transaction(ostore);
	trans.onerror = function(event) {
		console.error("Error in gl60 transaction to "+ostore);
	};
	var objectStore = trans.objectStore(ostore);
	
	var now = new Date().getTime();
	var nv = 0;

	var idx = objectStore.index('date');
	var req = idx.openCursor(window.IDBKeyRange.bound(now-(3600*1000), now, true, true), 'prev'/*window.webkitIDBCursor.PREV*/);
	req.onerror = function(err) {
		promise.reject("Error in opening cursor on "+ostore+": "+err);
	};
	req.onsuccess = function(event) {
		var cursor = event.target.result;
		if (cursor) {
			if (cursor.value.serial != self.serial) {
				cursor.continue();
				return;
			}

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

// global state
panwstatsdb.db = undefined;

panwstatsdb.openDB = function() {
	if (panwstatsdb.db) {
		// already open
		var p = new RSVP.Promise();
		p.resolve();
		return p;
	}

	var promise = new RSVP.Promise();
	var req = window.indexedDB.open('panwachrome', 1);

	req.onsuccess = function(event) {
		panwstatsdb.db = event.target.result;

		promise.resolve();
	};
	req.onerror = function(event) {
		promise.reject(event.error);
	};
	req.onupgradeneeded = function(event) {
		console.log("onupgradeneeded");
		panwstatsdb.db = event.target.result;

		console.log('init db');

		var osIFS = panwstatsdb.db.createObjectStore("ifs", { autoIncrement: true });
		osIFS.createIndex('date', 'date', { unique: false });

		var osDP = panwstatsdb.db.createObjectStore("dp", { autoIncrement: true });
		osDP.createIndex('date', 'date', { unique: false });

		var osCP = panwstatsdb.db.createObjectStore("cp", { autoIncrement: true });
		osCP.createIndex('date', 'date', { unique: false });

		var osSessionInfo = panwstatsdb.db.createObjectStore("sessioninfo", { autoIncrement: true });
		osSessionInfo.createIndex('date', 'date', { unique: false });

		var osCounters = panwstatsdb.db.createObjectStore("counters", { autoIncrement: true });
		osCounters.createIndex('date', 'date', { unique: false });

		promise.resolve();
	};

	return promise;
}

panwstatsdb.deleteAll = function() {
	window.indexedDB.deleteDatabase('panwachrome');
};
