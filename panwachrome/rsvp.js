(function(exports) {
  "use strict";
  var browserGlobal = (typeof window !== 'undefined') ? window : {};

  var MutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
  var RSVP, async;
  var queue = [];
  var observer, qelement;

  var setup = function() {
    observer = new MutationObserver(function() {
      var toProcess = queue.slice();
      queue = [];

      toProcess.forEach(function(tuple) {
        var callback = tuple[0], binding = tuple[1];
        callback.call(binding);
      });
    });

    qelement = document.createElement('div');
    observer.observe(qelement, { attributes: true });

    async = function(callback, binding) {
      queue.push([callback, binding]);
      qelement.setAttribute('drainQueue', 'drainQueue');
    };
  };
  var shutdown = function() {
    observer.disconnect();
    observer = null;
    queue = [];
    // XXX qelement.parentNode.removeChild(qelement);
  };

  var Event = function(type, options) {
    this.type = type;

    for (var option in options) {
      if (!options.hasOwnProperty(option)) { continue; }

      this[option] = options[option];
    }
  };

  var indexOf = function(callbacks, callback) {
    for (var i=0, l=callbacks.length; i<l; i++) {
      if (callbacks[i][0] === callback) { return i; }
    }

    return -1;
  };

  var callbacksFor = function(object) {
    var callbacks = object._promiseCallbacks;

    if (!callbacks) {
      callbacks = object._promiseCallbacks = {};
    }

    return callbacks;
  };

  var EventTarget = {
    mixin: function(object) {
      object.on = this.on;
      object.off = this.off;
      object.trigger = this.trigger;
      return object;
    },

    on: function(eventNames, callback, binding) {
      var allCallbacks = callbacksFor(this), callbacks, eventName;
      eventNames = eventNames.split(/\s+/);
      binding = binding || this;

      while (eventName = eventNames.shift()) {
        callbacks = allCallbacks[eventName];

        if (!callbacks) {
          callbacks = allCallbacks[eventName] = [];
        }

        if (indexOf(callbacks, callback) === -1) {
          callbacks.push([callback, binding]);
        }
      }
    },

    off: function(eventNames, callback) {
      var allCallbacks = callbacksFor(this), callbacks, eventName, index;
      eventNames = eventNames.split(/\s+/);

      while (eventName = eventNames.shift()) {
        if (!callback) {
          allCallbacks[eventName] = [];
          continue;
        }

        callbacks = allCallbacks[eventName];

        index = indexOf(callbacks, callback);

        if (index !== -1) { callbacks.splice(index, 1); }
      }
    },

    trigger: function(eventName, options) {
      var allCallbacks = callbacksFor(this),
          callbacks, callbackTuple, callback, binding, event;

      if (callbacks = allCallbacks[eventName]) {
        for (var i=0, l=callbacks.length; i<l; i++) {
          callbackTuple = callbacks[i];
          callback = callbackTuple[0];
          binding = callbackTuple[1];

          if (typeof options !== 'object') {
            options = { detail: options };
          }

          event = new Event(eventName, options);
          callback.call(binding, event);
        }
      }
    }
  };

  var Promise = function() {
    this.on('promise:resolved', function(event) {
      this.trigger('success', { detail: event.detail });
    }, this);

    this.on('promise:failed', function(event) {
      this.trigger('error', { detail: event.detail });
    }, this);
  };

  var noop = function() {};

  var invokeCallback = function(type, promise, callback, event) {
    var value, error;

    if (callback) {
      try {
        value = callback(event.detail);
      } catch(e) {
        error = e;
      }
    } else {
      value = event.detail;
    }

    if (value instanceof Promise) {
      value.then(function(value) {
        promise.resolve(value);
      }, function(error) {
        promise.reject(error);
      });
    } else if (callback && value) {
      promise.resolve(value);
    } else if (error) {
      promise.reject(error);
    } else {
      promise[type](value);
    }
  };

  Promise.prototype = {
    then: function(done, fail) {
      var thenPromise = new Promise();

      if (this.isResolved) {
        RSVP.async(function() {
          invokeCallback('resolve', thenPromise, done, { detail: this.resolvedValue });
        }, this);
      }

      if (this.isRejected) {
        RSVP.async(function() {
          invokeCallback('reject', thenPromise, fail, { detail: this.rejectedValue });
        }, this);
      }

      this.on('promise:resolved', function(event) {
        invokeCallback('resolve', thenPromise, done, event);
      });

      this.on('promise:failed', function(event) {
        invokeCallback('reject', thenPromise, fail, event);
      });

      return thenPromise;
    },

    resolve: function(value) {
      resolve(this, value);

      this.resolve = noop;
      this.reject = noop;
    },

    reject: function(value) {
      reject(this, value);

      this.resolve = noop;
      this.reject = noop;
    }
  };

  function resolve(promise, value) {
    RSVP.async(function() {
      promise.trigger('promise:resolved', { detail: value });
      promise.isResolved = true;
      promise.resolvedValue = value;
    });
  }

  function reject(promise, value) {
    RSVP.async(function() {
      promise.trigger('promise:failed', { detail: value });
      promise.isRejected = true;
      promise.rejectedValue = value;
    });
  }

  EventTarget.mixin(Promise.prototype);

  setup();

  RSVP = { async: async, Promise: Promise, Event: Event, EventTarget: EventTarget, shutdown: shutdown };
  exports.RSVP = RSVP;
})(window);
