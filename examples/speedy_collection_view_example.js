(function(exports) {

  var collection = new Backbone.Collection(window.data);
  JST = {};
  JST.child_tpl = _.template('<h3>id: <%= id %></h3><div>name: <%= name %></div><form class="foo"><input name="name" /><input type="submit" /></form>');
  var MyModelView = SpeedyCollectionModelView.extend({
    template: 'child_tpl',
    initialize: function() {
      SpeedyCollectionModelView.prototype.initialize.call(this);
      // TODO this won't work
      this.model.on('change', this.render, this);
      this.on('submit', this.submit, this);
    },
    submit: function(e) {
      e.preventDefault();
      console.log('submitted', e);
    }
  });

  JST.coll_tpl = _.template('<ul id="list"></ul>');
  var MyColView = SpeedyCollectionView.extend({
    template: 'coll_tpl',
    list_selector: '#list',
    child_view_constructor: MyModelView,
    events: {
      'submit form': 'model_submit'
    },
    model_submit: function(e) {
      var view = this.view_for_event(e);
      view.trigger('submit', e);
    }
  });

  var init = function() {
    var coll_view = new MyColView({
      collection: collection,
      el: '#coll_view'
    });
    coll_view.render();
  };


  exports.init = init;

}(window));

$(document).ready(function() {
  window.init();
});
