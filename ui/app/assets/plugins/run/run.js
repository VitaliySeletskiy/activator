/*
 Copyright (C) 2014 Typesafe, Inc <http://typesafe.com>
 */
define([
  "main/plugins",
  "services/sbt",
  "services/monitoring/monitoringSolutions",
  "services/inspect/connection",
  'widgets/echoInstaller/echoInstaller',
  "widgets/layout/layout",
  "text!./run.html",
  "css!./run",
  "css!widgets/buttons/switch",
  "css!widgets/buttons/button",
  "css!widgets/menu/menu",
  "css!widgets/buttons/select"
], function(
  plugins,
  sbt,
  monitoringSolutions,
  connection,
  echoInstaller,
  layout,
  tpl
) {

  var subplugin = ko.observable();
  var currentPlugin;
  var inspects = ko.observable();
  var sbtExecCommand = function(cmd){
    sbt.tasks.requestExecution(cmd);
  }
  var mainRunAction = function() {
    if (sbt.tasks.pendingTasks.run()){
      sbt.tasks.actions.kill("run");
    } else {
      if (sbt.app.settings.automaticResetInspect()) {
        connection.reset();
      }
      sbt.tasks.actions.run();
    }
  }
  var mainRunName = ko.computed(function() {
    return sbt.tasks.pendingTasks.run()?"Stop":"Run";
  });

  var toggleInspect = function() {
    var toActivate = monitoringSolutions.inspectActivated() ? monitoringSolutions.NO_MONITORING : monitoringSolutions.INSPECT;
    monitoringSolutions.monitoringSolution(toActivate);
  }

  monitoringSolutions.monitoringSolution.subscribe(function(solution) {
    if (!monitoringSolutions.inspectActivated() && window.location.hash.indexOf("#run/system") != 0) {
      window.location.hash = "run/system";
    }
    if(monitoringSolutions.inspectActivated()) {
      sbt.tasks.actions.kill();
      echoInstaller(function() {});
    } else {
      sbt.tasks.actions.kill();
    }
  });

  var State = {
    subplugin: subplugin,
    sbtExecCommand: sbtExecCommand,
    inspects: inspects,
    sbt: sbt,
    stats: connection.stats,
    rerunOnBuild: sbt.app.settings.rerunOnBuild,
    automaticResetInspect: sbt.app.settings.automaticResetInspect,
    showLogDebug: sbt.app.settings.showLogDebug,
    monitoringSolutions: monitoringSolutions,
    inspectActivated: monitoringSolutions.inspectActivated,
    toggleInspect: toggleInspect,
    mainRunAction: mainRunAction,
    mainRunName: mainRunName,
    customCommands: sbt.app.customCommands
  }

  // Subplugins titles
  var subPlugins = {
    system:         "Stdout",
    actors:         "Actors",
    requests:       "Requests",
    deviations:     "Deviations"
  }

  return {
    render: function(url) {
      layout.renderPlugin(ko.bindhtml(tpl, State))
    },
    route: plugins.route('run', function(url, breadcrumb, plugin) {
      subplugin(plugin.render());
      currentPlugin = plugin;
      breadcrumb([['run/', "Run"],['run/'+url.parameters[0], subPlugins[url.parameters[0]]]]);
    }, "run/system"),

    keyboard: function(key, meta, e) {
      if (currentPlugin.keyboard) {
        currentPlugin.keyboard(key, meta, e);
      };
    }
  }
});
