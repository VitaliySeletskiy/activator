/*
 Copyright (C) 2014 Typesafe, Inc <http://typesafe.com>
 */
define([
  "commons/websocket",
  './open/open',
  './templates/templates',
  './working/working',
  // 'commons/ajax',
  'widgets/modals/modals'
  // 'css!./home'
],function(
  websocket,
  open,
  templates,
  working,
  // fs,
  modals
) {

  var failedDueToNoTypesafeProperties = false;
  var failedDueToNoSubscriptionId = false;

  var sbtEventStream = websocket.subscribe('type','sbt');
  var subTypeEventStream = function(subType) {
    return sbtEventStream.matchOnAttribute('subType',subType);
  };

  subTypeEventStream("DetachedEvent").each(function(message) {
    var event = message.event;

    var name = event.serialized.$type;

    if (name === "com.typesafe.rp.protocol.SubscriptionIdEvent") {
      debug && console.log("SubscriptionIdEvent: ", event.serialized);
      if (!event.serialized.fileExists)
        failedDueToNoTypesafeProperties = true;
      else if (!event.serialized.subscriptionId)
        failedDueToNoSubscriptionId = true;
    }
  });

  subTypeEventStream("BuildFailedToLoad").each(function (e) {
    var warning = null;

    if (failedDueToNoTypesafeProperties) {
      warning = "If you are creating Typesafe Reactive Platform project you must add a '<code>typesafe.properties</code>' file in the '<code>&lt;template&gt;/project</code>' folder.</p><p>The file must contain your subscription ID in the format '<code>typesafe.subscription=&lt;YOUR ID&gt;</code>'<br/>To get a free trial subscription ID visit: <a href='https://typesafe.com/account/id'>https://typesafe.com/account/id</a><p>";
    } else if (failedDueToNoSubscriptionId) {
      warning = "If you are creating Typesafe Reactive Platform project, <code>project/typesafe.properties</code> must  contain your subscription ID in the format '<code>typesafe.subscription=&lt;YOUR ID&gt;</code>'<br/>To get a free trial subscription ID visit: <a href='https://typesafe.com/account/id'>https://typesafe.com/account/id</a><p>";
    }

    if (warning) {
      var warningNode = $("<article/>").html(warning)[0];
      modals.show({
        shape: "large",
        title: "Could not load project",
        body: warningNode,
        cancel: "Return",
        onCancel: function() {
          $('#working, #open, #new').toggle();
        }
      });
    }
  });

  var SharedState = {
    working: ko.observable(false)
  };

  var State = {
    open: open.render(SharedState),
    templates: templates.render(SharedState),
    working: working.render(SharedState),
    modals: modals.render()
  };

  return {
    render: function() {
      ko.applyBindings(State);
    }
  }
});
