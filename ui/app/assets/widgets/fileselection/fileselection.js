/*
 Copyright (C) 2013 Typesafe, Inc <http://typesafe.com>
 */
define(['css!./fileselection.css', 'text!./fileselection.html', 'webjars!knockout', 'commons/widget', 'commons/utils'], function(css, template, ko, Widget, utils) {

  function browse(location) {
    return $.ajax({
      url: '/api/local/browse',
      type: 'GET',
      dataType: 'json',
      data: {
        location: location
      }
    });
  };

  function browseRoots() {
    return $.ajax({
        url: '/api/local/browseRoots',
        type: 'GET',
        dataType: 'json'
    });
  };

  // File model...
  function File(config) {
    var self = this;
    self.name = config.name || config.humanLocation;
    self.location = config.location;
    self.humanLocation = config.humanLocation;
    self.isDirectory = config.isDirectory;
    self.isFile = !config.isDirectory;
    self.highlighted = ko.observable(false);
    self.cancelable = config.cancelable || false;
  };

  // Function for filtering...
  function fileIsHighlighted(file) {
    return file.highlighted();
  };
  function noop() {}

  var FileSelection = utils.Class(Widget, {
    id: 'file-selection-widget',
    template: template,
    init: function(config) {
      var cfg = config || {};
      var self = this;
      // TODO - Allow context...
      self.selectText = config.selectText || 'Select this File/Directory';
      self.onSelect = config.onSelect || noop;
      self.onCancel = config.onCancel || noop;
      self.showFiles = ko.observable(cfg.showFiles || false);
      self.shownDirectory = ko.observable(cfg.initialDir || '');
      self.currentFiles = ko.observableArray([]);
      self.currentHighlight = ko.computed(function() {
        return $.grep(self.currentFiles(), fileIsHighlighted)[0];
      });
      self.hasCurrentHighlight = ko.computed(function() {
        if(self.currentHighlight()) {
          return true;
        }
        return false;
      });
      self.currentViewFiles = ko.computed(function() {
        var showFiles = self.showFiles();
        return $.grep(self.currentFiles(), function(file){
          if(file.isDirectory || showFiles) {
            return true;
          }
          return false;
        });
      });
      self.title = ko.observable(cfg.title || "Select a file")
      if(cfg.initialDir) {
        this.load(cfg.initialDir);
      } else {
        this.loadRoots();
      }

      var timer;
      console.log(config.dom);
      $(config.dom)
        .on("click", ".directories li", function(e){
          e.preventDefault();
          var it = this;
          var context = ko.contextFor(it);
          // Double click
          if (timer) {
            clearTimeout(timer);
            timer = false;
            if(context.$data.location) {
              self.onSelect(context.$data.location);
            }
            return false;
          }
          // Simple click
          timer = setTimeout(function() {
            timer = false;
            //retrieve the context
            if(context.$data.location) {
              self.load(context.$data.location);
            } else {
              // TODO - Only on windows.
              self.loadRoots();
            }
          },200);
          return false;
       });

      self.renderTo(config.dom)
    },
    chooseCurrent: function() {
      var self = this;
      self.onSelect(self.shownDirectory());
    },
    gotoParent: function() {
      var self = this;
      self.load("/" + self.shownDirectory().split("/").slice(1,-1).join("/"));
    },
    highlight: function(file) {
      $.each($.grep(this.currentFiles(), fileIsHighlighted), function(idx, item) {
        item.highlighted(false);
      });
      file.highlighted(true);
    },
    loadRoots: function(dir) {
      var self = this;
      browseRoots().done(function(values) {
          self.currentFiles($.map(values, function(config) {
              return new File(config);
          }));
      }).error(function() {
        alert('Failed to load file system roots.');
      });
    },
    load: function(dir) {
      var self = this;
      browse(dir).done(function(values) {
        self.shownDirectory(dir);
        var fileConfigs = [];
        fileConfigs.push.apply(fileConfigs, values.children || []);
        fileConfigs.sort(function(fileConfig1, fileConfig2) {
          if (fileConfig1.name.toLowerCase() < fileConfig2.name.toLowerCase())
            return -1;
          if (fileConfig1.name.toLowerCase() > fileConfig2.name.toLowerCase())
            return 1;
          return 0;
        });
        self.currentFiles($.map(fileConfigs, function(config) {
          return new File(config);
        }));
      }).error(function() {
        alert('Failed to load directory listing for: ' + dir);
      });
    },
    select: function() {
      var currentFile = this.currentHighlight();
      if(currentFile) {
        this.onSelect(currentFile.location);
      } else {
        this.onSelect(this.shownDirectory());
      }
    },
    cancel: function() {
      this.onCancel();
    }
  });
  return FileSelection;
});
