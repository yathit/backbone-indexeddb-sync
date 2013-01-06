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
ydn.gapi.Client = function(service_format) {
  this.fmt = service_format;

  var me = this;

  /**
   * Copy properties from schema to class prototype properties.
   */
  var copySchema = function(clazz, schema) {
    clazz.prototype.name = schema.id;
    clazz.prototype.kind = schema.properties.kind.default;
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
            if (me.logLevel <= 300) {
              console.log('Entry ' + this.name + ' ' + args.id + ' constructed.');
            }
          },
          url: function() {
            return this.selfLink;
          },
          toJSON: function() {
            return {title: this.get('title')};
          }
        }
    );

    copySchema(Entry, entry_schema);

    Feed = Backbone.Collection.extend({
      model: Entry,
      url:  function() {
        return '/' + resource.servicePath + resource.methods.list.path;
      },
      storeName: function() {
        return this.name + ':' + this.data.id;
      },
      getParameters: function() {

      },
      /**
       *
       * @param {string} method
       * @param {!Backbone.Collection} model
       * @param {Object=} options
       */
      sync: function (method, model, options) {
        if (method == 'read') {
          Feed.client.get(model);
          var req = {
            path: model.url(),
            method: 'GET'
          };
          req.callback = function (result) {
            console.log(result);
            if (result.items.length > 0) {
              $.db.put(model.name, result.items);
            }
            options.success(result);
          };
          console.log('sending request ' + JSON.stringify(req));
          gapi.client.request(req)
        }
      }
    });

    copySchema(Feed, schema);
    Feed.Entry = Entry;

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
          var request = gapi.client[service_format.name][client_name][mth](args);
          request.execute(function (resp) {
            console.log(resp);
            var cnt = 0;
            var out = [];
            if (resp.items) {
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

//      console.log(schema.id +
//          (constructor.Entry ? '' : '.Entry') +
//          (instance_prop ? '->' : '.') + method);

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
 * @type {number}
 */
ydn.gapi.Client.prototype.logLevel = 300;






