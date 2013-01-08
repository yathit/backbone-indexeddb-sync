/**
 * @fileoverview Provides synchronization between client database and Google API services.
 */

'use strict';

var ydn = ydn || {};
ydn.gapi = ydn.gapi || {};

/**
 * Create a new GData API service.
 * @param {!Object} service_format
 * @constructor
 */
ydn.gapi.BackboneClient = function(service_format) {

  var client = this;

  /**
   * Define class prototype properties and method for GData Feed and Entry.
   */
  var prototypeGData = function(clazz, schema, resource) {
    clazz.prototype.name = schema.id;
    clazz.prototype.kind = schema.properties.kind.default;

    /**
     * Return gapi js client request arguments array for given method.
     * @param {string} method
     * @return {Array}
     */
    clazz.prototype.getClientParams = function(method) {
      var out = [];
      var parameters = resource.methods[method].parameterOrder;
      for (var i = 0; i < parameters.length; i++) {
        var value = this.getParam(parameters[i]);
        if (value == null) {
          var e = new Error(this + ' parameter: ' + parameters[i]);
          e.name = 'NotFoundError';
          throw e;
        } else {
          out.push(value);
        }
      }
      return out;
    };

    /**
     * Return REST client request arguments object for given method.
     * @param {string} method
     * @return {{}}
     */
    clazz.prototype.getReqParams = function(method) {
      var parameters = resource.methods[method].parameters;
      var out = {};
      for (var param in parameters) {
        if (resource.methods[method].parameterOrder.indexOf(param) >= 0) {
          continue;
        }
        var value = this.getParam(param);
        if (value != null) { // Note that undefined == null.
          if (parameters[param].type == "string") {
            out[param] = value + '';
          } else {
            out[param] = value;
          }
        }
      }
      return out;
    };

    /**
     * Backbone.sync override.
     * @param {string} method
     * @param {!Backbone.Collection} model
     * @param {Object=} options
     */
    clazz.prototype.sync = function (method, model, options) {
      if (method == 'read') {
        var params = model.getReqParams('get');
        var args = {
          path: this.getPath(),
          method: 'GET',
          params: params,
          headers: {
            'If-None-Match': this.get('etag'),
            'If-Modified-Since': this.get('updated')
          }
        };
        if (client.logLevel <= 500) {
          console.log('sending request ' + JSON.stringify(args));
        }
        args.callback = function (result) {
          if (client.logLevel <= 500) {
            var msg = result ? '' : '. No change in server.';
            console.log('receiving GET request ' + msg);
            if (client.logLevel <= 300) {
              console.log(result);
            }
          }
          if (result) {
            if (model instanceof Backbone.Collection) {
              // update child models.
              //clazz.client.list(model.getClientParams('list'));
            }
          }
          options.success(result);
        };

        gapi.client.request(args);
      } else if (method == 'update') {
        var params = model.getReqParams('update');
        var json = model.toJSON();
        var args = {
          path: this.getPath(),
          method: 'PUT',
          params: params,
          body:  JSON.stringify(json),
          headers: {
            'If-Match': this.get('etag')
          }
        };
        if (client.logLevel <= 400) {
          console.log('sending request ' + JSON.stringify(args));
        }
        args.callback = function (result) {
          if (client.logLevel <= 400) {
            var msg = result ? '' : '. No change in server.';
            console.log('receiving request ' + JSON.stringify(result) + msg);
          }
          if (result) {
            $.db.put(model.getStoreName(), json).then(function(id) {
              if (client.logLevel <= 400) {
                console.log(model.name + ' ' + id + ' saved.');
              }
            }, function(e) {
              if (client.logLevel <= 500) {
                console.log('Error saving ' + model.name + ' ' + id);
              }
              throw e;
            });
          }
          options.success(result);
        };

        gapi.client.request(args);
      }
    };

    /**
     * @return {string}
     */
    clazz.prototype.toString = function() {
      return clazz.kind + ':' + this.get('id');
    };

  };

  /**
   * Create a new GData Feed.
   * The feed is a Backbone.Collection and its items are Backbone.Model.
   * @param schema
   * @param entry_schema
   * @param resource
   * @return {!Backbone.Collection}
   */
  var newFeed = function(schema, entry_schema, resource) {

    var Entry, Feed;

    Entry = Backbone.Model.extend(
        {
          initialize: function(args) {
            // copy attributes to this model
            _.defaults(this.args);
            if (client.logLevel <= 300) {
              console.log('Entry ' + this.name + ' ' + args.id + ' constructed.');
            }
          },
          toJSON: function() {
            return {title: this.get('title')};
          }
        }
    );

    Feed = Backbone.Collection.extend({
      model: Entry,
      initialize: function(args) {
        if (client.logLevel <= 300) {
          console.log('Feed ' + this.name + ' constructed.');
        }
      },
      url:  function() {
        return '/' + resource.servicePath + resource.methods.list.path;
      }

    });

    prototypeGData(Entry, entry_schema, resource);

    prototypeGData(Feed, schema, resource);


    /**
     * Get parameter value.
     * The value is also search from the feed URI.
     * @param {string} param_name
     * @return {*}
     */
    Entry.prototype.getParam = function(param_name) {
      var value = this.get(param_name);
      if (!(value != null)) {
        var path = this.get('selfLink'); // always refer to selfLink ?
        if (path) {
          // here 'get' method is use. it is assume that path value is same for all methods.
          var s = resource.methods.get.path.replace('{' + param_name + '}', '(\\w+)');
          s = s.replace(/{\w+}/, '\\w+');
          var reg = new RegExp(s);
          var m = path.match(reg);
          if (m) {
            value = m[1];
          }
        }
      }
      return value;
    };

    /**
     * Get parameter value.
     * The value is also search from the feed URI.
     * @param {string} param_name
     * @return {*}
     */
    Feed.prototype.getParam = function(param_name) {
      return this[param_name];
    };


    /**
     * Return path in REST request arguments.
     * @return {string}
     */
    Entry.prototype.getPath = function() {
      var re = new RegExp(resource.methods.get.path.replace(/{\w+}/g, '\\w+'));
      return service_format.basePath + this.url().match(re)[0];
    };

    /**
     * Return path in REST request arguments.
     * @return {string}
     */
    Feed.prototype.getPath = function() {
      var path = resource.methods.list.path.replace(/{\w+}/, this.id);
      return service_format.basePath + path;
    };

    /**
     * Return client database store name of this class.
     * @return {string}
     */
    Entry.prototype.getStoreName = function() {
      return 'entry';
    };

    /**
     * Return client database store name of this class.
     * @return {string}
     */
    Feed.prototype.getStoreName = function() {
      return 'feed';
    };

    /**
     * Return feed URI or selfLink.
     * @return {string}
     */
    Entry.prototype.url = function() {
      return this.get('selfLink');
    };

    /**
     * Return feed URI or selfLink.
     * @return {string}
     */
    Feed.prototype.url = function() {
      return this.selfLink;
    };

    Feed.Entry = Entry;
    Entry.Feed = Feed;


    var client_name = schema.id.toLowerCase();

    // create static instance creation methods from resource
    Feed.client = {};
    Entry.client = {};
    for (var method in resource.methods) {
      var res = resource.methods[method];
      var constructor;
      var instance_prop = false;
      if (res.response && res.response['$ref'] == schema.id) {
        if (res.request && res.request['$ref'] == schema.id) {
          instance_prop = true;
        }
        constructor = Feed;
      } else if (res.response && res.response['$ref'] == entry_schema.id) {
        if (res.request && res.request['$ref'] == entry_schema.id) {
          instance_prop = true;
        }
        constructor = Entry;
      } else {
        continue;
      }

      // define static method mth
      var createRest = function(mth) {
        return function (callback, args) {
          if (client.logLevel <= 300) {
            console.log('Sending request for ' + service_format.name + '.' + client_name +
              '.' + mth);
          }
          var request = gapi.client[service_format.name][client_name][mth](args);
          request.execute(function (resp) {
            if (client.logLevel <= 300) {
              console.log('Receiving request for ' + service_format.name + '.' + client_name +
                '.' + mth);
              if (client.logLevel <= 100) {
                console.log(resp);
              }
            }
            var cnt = 0;
            var out = [];
            if (resp.items) {
              if (client.logLevel <= 300) {
                console.log(resp.items.length + ' ' + resp.items[0].kind + ' received.');
              }
              for (var i = 0; i < resp.items.length; i++) {
                var item = resp.items[i];
                if (item.kind == Feed.prototype.kind) {
                  out.push(new Feed(resp.items[i]));
                } else if (item.kind == Entry.prototype.kind) {
                  out.push(new Entry(resp.items[i]));
                }
              }
            }
            if (resp.result && resp.result.id) {
              if (client.logLevel <= 300) {
                console.log('A ' + resp.result.kind + ':' + resp.result.id + ' received.');
              }
              delete resp.result.items;
              if (resp.result.kind == Feed.prototype.kind) {
                out = new Feed(out);
                out.id = resp.result.id;
              } else if (resp.result.kind == Entry.prototype.kind) {
                out = new Entry(resp.result);
              }
            }
            callback(out);
          });
        };
      };

      if (client.logLevel <= 200) {
        console.log(schema.id +
            (constructor.Entry ? '' : '.Entry') +
            (instance_prop ? '->' : '.') + method);
      }

      if (instance_prop) {
        constructor.prototype[method] = createRest(method);
      } else {
        constructor.client[method] = createRest(method);
      }
    }

    return Feed;
  };

  // Create classes
  for (var id in service_format.schemas) {
    var schema = service_format.schemas[id];
    var entry_id = id.substr(0, id.length - 1); // remove 's'
    var entry_schema = service_format.schemas[entry_id];
    var resource = service_format.resources[id.toLowerCase()];
    if (resource && entry_schema) {
      var Feed = newFeed(schema, entry_schema, resource);
      this[id] = Feed;
      this[entry_id] = Feed.Entry;
    }
  }
};


/**
 * Logging level.
 * Change this level as necessary.
 * Predefined level are: 'ALL' (0) 'FINEST' (300), 'FINER' (ALL), 'FINE' (500),
 * 'CONFIG' (700), 'INFO' (800), 'WARNING', (900)
 * @type {number}
 */
ydn.gapi.BackboneClient.prototype.logLevel = 0;






