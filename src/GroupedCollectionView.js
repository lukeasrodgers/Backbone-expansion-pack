GroupedCollectionView = CollectionView.extend({
  group_header_template: '<li class="grouped-collectionview-header"><%= name %><ul id="<%= id %>"></ul></li>',
  initialize: function(options) {
    this.grouped_child_views = {};
    this.on('after:initialize_child_views', this.group_if_active, this);
    this.collection.on('change', this.maybe_adjust_grouping, this);
    this.grouped_view_map = {};
    this.multi_grouping = options.multi_grouping || this.multi_grouping || true;
    CollectionView.prototype.initialize.apply(this, arguments);
  },
  group_if_active: function() {
    if (this.grouping_active()) {
      this.group_child_views();
    }
  },
  /**
   * @param {Object|string} group either a {name: string, fn: Function} object or
   * a {string} name of the group
   */
  group_child_views: function(group) {
    if (!group && !this.groups) {
      return;
    }
    else {
      if (typeof group === 'string') {
        group = this.find_group(group);
      }
      else {
        group = this.groups[0];
      }
    }
    if (!this.multi_grouping) {
      this.clear_grouping(group);
    }

    if (_.keys(this.grouped_child_views).length) {
      this.grouped_child_views = this.apply_grouping(group, this.grouped_child_views);
    }
    else {
      this.grouped_child_views = this.apply_grouping(group, this.child_views);
    }
    group.active = true;
  },
  apply_grouping: function(group, child_views) {
    if (this.already_grouped(child_views)) {
      return _.reduce(child_views, function(acc, sub_child, key) {
        acc[key] = this.apply_grouping(group, sub_child);
        return acc;
      }, {}, this);
    }
    else {
      return _(child_views).groupBy(group.fn);
    }
  },
  already_grouped: function(x) {
    return _.isArray(_(x).values()[0]);
  },
  grouping_active: function() {
    if (!this.groups || !this.groups.length) {
      return false;
    }
    else {
      return _(this.groups).any(function(group) {
        return group.active;
      });
    }
  },
  render: function() {
    if (!this.grouping_active()) {
      return CollectionView.prototype.render.apply(this, arguments);
    }
    else {
      return this.grouped_render();
    }
  },
  active_group: function() {
    return _(this.groups).detect(function(group) {
      return group.active;
    });
  },
  active_groups: function() {
    return _(this.groups).select(function(group) {
      return group.active;
    });
  },
  toggle_group: function(group_name) {
    var group = this.find_group(group_name);
    if (group.active) {
      this.clear_grouping(group);
    }
    else {
      this.group_child_views(group_name);
    }
    this.render();
  },
  grouped_render: function() {
    $(this.el).html(JST[this.template](this.collection));
    _.each(this.grouped_child_views, function(group, key) {
      this.recursive_grouped_rendering(group, key);
    }, this);
    this.rendered = true;
    return this;
  },
  recursive_grouped_rendering: function(group, key, parent_group_css_id_selector) {
    if (this.already_grouped(group)) {
      _.each(group, function(subgroup, subkey) {
        var group_css_id_selector = this.append_group_header(group, key, parent_group_css_id_selector);
        this.recursive_grouped_rendering(subgroup, subkey, group_css_id_selector);
      }, this);
    }
    else {
      var group_css_id_selector = this.append_group_header(group, key, parent_group_css_id_selector);
      _.each(group, function(child_view) {
        this.append_to_group(group_css_id_selector, child_view.view);
      }, this);
    }
  },
  clear_grouping: function(group) {
    this.grouped_child_views = {};
    if (group) {
      group.active = false;
    }
  },
  reset: function() {
    var active_group = this.active_group();
    this.grouped_view_map = {};
    this.clear_grouping(active_group);
    CollectionView.prototype.reset.apply(this, arguments);
  },
  /**
   * @param {Array.<Object>} group
   * @return {string} group id css selector
   */
  append_group_header: function(group, key, parent_group_css_id_selector) {
    var tpl = _.template(this.group_header_template);
    var group_css_id_selector = this.generate_css_id_selector_for_group(group, key);
    var selector = (parent_group_css_id_selector) ? parent_group_css_id_selector : this.list_selector;
    this.$(selector).append(tpl({
      name: this.name_for_group(group, key),
      id: group_css_id_selector.substr(1)
    }));
    return group_css_id_selector;
  },
  append_to_group: function(group_css_id_selector, view) {
    view.delegateEvents();
    this.$(group_css_id_selector).append(view.render().el);
  },
  swap_to_group: function(group_css_id_selector, view) {
    var $el = view.$el.detach();
    this.$(group_css_id_selector).append($el);
  },
  /**
   * Provides a sane default, but you will probably want to override
   * this method.
   * @param {Object} group
   * @param {string} group_name
   * @return {string}
   */
  name_for_group: function(group, group_name) {
    var len = (group.length !== undefined) ? group.length : _.keys(group).length;
    return group_name + '('+ len +')';
  },
  /**
   * css id selector to target a group
   * some simple transformations:
   * switch whitespace to hyphen, remove some punctuation, toLowerCase()
   * e.g 'namE for group: id' => 'name-for-group-1'
   * override at will, just make sure it returns a string of form '#...'
   * @param {Array.<Object>}
   * @return {string}
   */
  generate_css_id_selector_for_group: function(group, key) {
    var id = '#' + _.uniqueId(this.name_for_group(group, key).replace(/\s/g, '-').toLowerCase().replace(/[():\+\.]/g,'') + '-');
    this.grouped_view_map[key] = id;
    return id;
  },
  get_css_id_selector_for_group: function(key) {
    return this.grouped_view_map[key];
  },
  /**
   * @param {string} group_name
   */
  find_group: function(group_name) {
    return _(this.groups).detect(function(g) { return g.name === group_name; });
  },
  append: function(view) {
    if (!this.grouping_active()) {
      CollectionView.prototype.append.apply(this, arguments);
    }
    else {
      var target_group_key = this.determine_group_for_view(view);
      var group_css_id_selector = this.get_css_id_selector_for_group(target_group_key);
      this.append_to_group(group_css_id_selector, view);
    }
  },
  /**
   * Returns the result of applying grouping function to this view.
   * This is effectively the key of the appropriate group, which we can use
   * to retrieve its CSS selector. Note that this returns the group the view
   * *should* be in, not necessarily the one it currently *is* in.
   * @param {Backbone.View} view
   */
  determine_group_for_view: function(view) {
    return this.active_group().fn({view:view});
  },
  maybe_adjust_grouping: function(model, options) {
    if (!this.grouping_active()) {
      return;
    }
    var changes = options.changes;
    var should_move = _(this.active_groups()).any(function(active_group) {
      return active_group.update_grouping && active_group.update_grouping(changes);
    });
    if (should_move) {
      this.move_grouped_view(model);
    }
  },
  /**
   * Will return the child_view and current containing group
   * for a given model. Note that this returns the group the view
   * is *actually* in, not necessarily the group it *should* be in.
   * TODO make this faster
   * @param {Backbone.Moel}
   */
  find_grouping_for: function(model) {
    var grouped_child_view,
        containing_group_key;
    _(this.grouped_child_views).each(function(group, key) {
      var contains = this.recursive_group_finding(model, group, [+key]);
      if (contains) {
        containing_group_keys = contains.group_keys;
        grouped_child_view = contains.child_view;
      }
      return contains;
    }, this);
    return {child_view: grouped_child_view, group_keys: containing_group_keys};
  },
  /**
   * @param {Object} group
   * @param {Array} keys
   * @return {{child_view: Object, group_keys: Array}}
   */
  recursive_group_finding: function(model, group, keys) {
    if (this.already_grouped(group)) {
      return _(group).detect(function(sub_group, k) {
        var tracked_keys = keys.push(+k);
        return this.recursive_group_finding(model, sub_group, tracked_keys);
      }, this);
    }
    else {
      var contains = _(group).detect(function(child_view) {
        return child_view.view.model === model;
      });
      var ret;
      if (contains) {
        ret = {
          child_view: contains,
          group_keys: keys
        };
      }
      return ret;
    }
  },
  move_grouped_view: function(model) {
    // figure out what group model is in
    var current_grouping = this.find_grouping_for(model);
    console.log(current_grouping);
    var current_group_keys = current_grouping.group_keys;
    var grouped_view = current_grouping.child_view;
    // figure out what group it should be in
    var target_group_key = this.determine_group_for_view(grouped_view.view);
    // if they are not the same, move it
    if (current_group_keys !== target_group_key) {
      var child_view_group = this.find_group_by_keys(current_group_keys);
      child_view_group = _(child_view_group).without(grouped_view);
      this.grouped_child_views[target_group_key].push(grouped_view);
      var css_selector = this.get_css_id_selector_for_group(target_group_key);
      this.swap_to_group(css_selector, grouped_view.view);
    }
  },
  find_group_by_keys: function(keys) {
    var obj = this.grouped_child_views;
    for (var k in keys) {
      obj = obj[keys[k]];
    }
    return obj;
  }
});
