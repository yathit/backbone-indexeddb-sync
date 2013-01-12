/**
 * @fileoverview Sync backbone model.
 *
 * User: kyawtun
 * Date: 12/1/13
 */


CachedModel = Backbone.Model.extend({

});

/**
 * Sub class should override this method to return unique identifier of
 * the model instance. By default, this take value of 'id' attribute.
 * @return {string} The key to store in database.
 */
CachedModel.prototype.getKey = function() {
  return this.get('id');
};


/**
 * return etag.
 * @return {string} etag.
 */
CachedModel.prototype.getEtag = function() {
  return this.get('etag');
};


/**
 * Sub class should override this to return valid store name.
 * @type {string}
 */
CachedModel.prototype.getStoreName = function() {
  return this.constructor.name || 'model-store-name';
};


/**
 * If inline key is used, the model data must have a unique key in its key path.
 * @final
 * @type {boolean}
 */
CachedModel.prototype.inlineKey = false;


/**
 * Override Model.sync function for caching in client side database.
 * @param {string} method
 * @param {!Object} model
 * @param {Object=} options
 * @override
 */
CachedModel.prototype.sync = function (method, model, options) {
  var store_name = model.getStoreName();
  var key = model.getKey();
  var etag = model.getEtag();
  if (method == 'read') {
    var df = options ? options : $.Deferred();
    $.db.get(store_name, key).then(function(data) {
      if (data) {
        // cached data available, send this first
        df.success(data);
        // check changes to server
        $.ajax({
          url: model.url(),
          method: 'GET',
          headers: 'If-None-Match: ' + etag,
          success: function(data) {
            // if model has changes, update to model and the database.
            if (data) {
              model.set(data);
              $.db.put(store_name, data, model.inlineKey ? undefined : key);
            }
          },
          error: function(e) {
            df.error(e);
          }
        });
      } else {
        // no cache, load from server.
        $.ajax({
          url: model.url(),
          method: 'GET',
          success: function(data) {
            df.success(data);
            $.db.put(store_name, data, model.inlineKey ? undefined : key);
          },
          error: function(e) {
            df.error(e);
          }
        });
      }
    }, function(e) {
      throw e;
    });
    return df;
  } else if (method == 'update') {
    var df = options ? options : $.Deferred();
    $.ajax({
      url: model.url(),
      method: 'PUT',
      headers: 'If-Match : ' + etag,
      success: function(data) {
        df.success(data);
        $.db.put(store_name, data, model.inlineKey ? undefined : key);
      },
      error: function(e) {
        df.error(e);
      }
    });
    return df;
  } else if (method == 'create') {
    var df = Backbone.sync(method, model, options);
    df.success = function(data) {
      $.db.add(store_name, data, model.inlineKey ? undefined : key)
          .fail(function(e) {
            throw e;
          });
    };
    return df;
  } else if (method == 'delete') {
    var df = Backbone.sync(method, model, options);
    df.success = function(data) {
      $.db.clear(store_name, data, model.inlineKey ? undefined : key);
    };
    return df;
  } else {
    var e = new Error(method);
    e.name = 'NotSupportedError';
    throw e;
  }
};