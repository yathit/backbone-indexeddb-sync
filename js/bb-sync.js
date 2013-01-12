/**
 * @fileoverview Sync backbone model.
 *
 * User: kyawtun
 * Date: 12/1/13
 */


CachedModel = Backbone.Model.extend({

});


/**
 * The name of attribute of model for store name.
 * @const
 * @type {string}
 */
CachedModel.attStoreName = 'name';

/**
 * The name of attribute of model for key.
 * @const
 * @type {string}
 */
CachedModel.attKey = 'id';


/**
 * The name of attribute of model for etag.
 * @const
 * @type {string}
 */
CachedModel.attEtag = 'etag';


/**
 * @final
 * @type {string}
 */
CachedModel.prototype.name = 'store-name';


/**
 * If inline key is used, the model data must have a unique key in its key path.
 * @final
 * @type {boolean}
 */
CachedModel.prototype.inlineKey = false;


/**
 * Override Model.sync function for caching in client side database. It is
 * assumed that model data has unique identifier 'id' and class name 'name'
 * attributes. Class name 'name' is assumed as store name and 'id' as key.
 * The attributes can be changed.
 * @param {string} method
 * @param {!Object} model
 * @param {Object=} options
 * @override
 */
CachedModel.prototype.sync = function (method, model, options) {
  if (method == 'read') {
    var df = options ? options : $.Deferred();
    var store_name = model.get(CachedModel.attStoreName);
    var key = model.get(CachedModel.attKey);
    var etag = model.get(CachedModel.attEtag);
    $.db.get(store_name, key).then(function(data) {
      if (data) {
        // cached data available, send this first
        df.success(data);
        // check changes to server
        $.ajax({
          url: model.url(),
          method: 'GET',
          headers: 'If-None-Match: ' + model.get(model.attEtag),
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
  } else {
    Backbone.sync(method, model, options);
  }
};