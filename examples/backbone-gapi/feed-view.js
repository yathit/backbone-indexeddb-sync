/**
 * @fileoverview About this file.
 *
 * User: kyawtun
 * Date: 5/1/13
 */

FeedView = Backbone.View.extend({

  tagName: "div",

  className: "ydn_gapi_feed",

  events: {

  },

  initialize: function() {
    this.listenTo(this.model, "change", this.render);
  },

  template: _.template('<span><%= title %></span>'),

  render: function() {
    var data = this.model.toJSON();
    this.$el.html(this.template(data));
    return this;
  }

});