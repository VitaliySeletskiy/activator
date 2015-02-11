/*
 Copyright (C) 2013 Typesafe, Inc <http://typesafe.com>
 */
define(function() {

  // jQuery extensions
  var urlChange = ko.observable(window.location.hash);
  window.addEventListener("hashchange", function(e) {
    setTimeout(function() {
      urlChange(window.location.hash);
    },10);
  });


  $.fn.scrollReveal = function(){
    $("<a href='#'>&nbsp;</a>").insertAfter(this).focus().remove();
  }

  $.fn.clickOut = function(callback, context){
    return this.each(function(){
      context = context || this;
      var _this = this;
      // SetTimeout to prevent evt propagation conflicts
      setTimeout(function f(){
        $(document).click(function(e){
          if (!$(_this).has(e.target).length){
            $(document).unbind("click", f);
            callback.call(context, e);
          }
        });
      }, 10);
    });
  }

  $(document.body).on("click", ".dropdown:not(.dropdownNoEvent)",function(e){
    $(this).toggleClass("opened");
  }).on("click", ".dropdown dd.prevent",function(e){
    e.stopPropagation();
  });

  // Custom ko bindings

  // -------------
  // Main difference between INCLUDE and INSERT:
  // include uses its own applybinding, while insert inherits from the current one
  // -------------

  ko.bindingHandlers.include = {
    init: function(elem, valueAccessor) {
      return { controlsDescendantBindings: true };
    },
    update: function(elem, valueAccessor) {
      var inc = ko.utils.unwrapObservable(valueAccessor());
      // Virtual element are followed by a comment (nodeType = 8) <!-- /ko -->
      if (elem.nextSibling.nodeType !== 8 && elem.parentNode){
        elem.parentNode.replaceChild(inc, elem.nextSibling);
      } else if (elem.nextSibling) {
        elem.parentNode.insertBefore(inc, elem.nextSibling);
      } else {
        elem.parentNode.appendChild(inc);
      }
    }
  }
  ko.virtualElements.allowedBindings.include = true;

  ko.bindingHandlers.insert = {
    init: function(elem, valueAccessor) {
    },
    update: function(elem, valueAccessor) {
      ko.virtualElements.emptyNode(elem);
      if (typeof valueAccessor() === 'string'){
        elem.parentNode.innerHTML = valueAccessor();
      } else {
        elem.parentNode.insertBefore(valueAccessor(), elem.nextSibling);
      }
    }
  }
  ko.virtualElements.allowedBindings.insert = true;
  // -------------

  // toggle Booleans from binding
  ko.bindingHandlers.toggle = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var val = valueAccessor();
      ko.applyBindingsToNode(element, { click: function() {
        val(!val());
      } });
    },
    update: function() {}
  };

  ko.bindingHandlers.switchButton = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var val = valueAccessor();
      ko.applyBindingsToNode(element, { css: { 'active': val }, toggle: val });
    },
    update: function() {}
  };

  // add active class on link if in url
  ko.bindingHandlers.isActiveUrl = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var url = valueAccessor();
      var isActive = ko.computed(function() {
        return (urlChange()+"/").indexOf(url+"/") === 0;
      });
      ko.applyBindingsToNode(element, { css: {'active': isActive} });
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    }
  }

  ko.bindingHandlers.isExactUrl = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var url = valueAccessor();
      var isActive = ko.computed(function() {
        return urlChange() === url;
      });
      ko.applyBindingsToNode(element, { css: {'active': isActive} });
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    }
  }

  // Just pass a function in the template, to call it
  ko.bindingHandlers.exec = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      valueAccessor()(element, allBindings, viewModel, bindingContext);
    }
  };
  // Log
  ko.bindingHandlers.log = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      debug && console.log("LOG FROM HTML:",valueAccessor());
    }
  };

  ko.bindingHandlers.href = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var url = valueAccessor();
      ko.applyBindingsToNode(element, { attr: {'href': url} });
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    }
  }

  ko.bindingHandlers.memorizeLinks = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var url = valueAccessor();
      var link = ko.observable(url);
      ko.applyBindingsToNode(element, { attr: {'href': link} });
      urlChange.subscribe(function(cu) {
        if (cu.indexOf(url) === 0) {
          link(cu);
        }
      });
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    }
  }

  ko.bindingHandlers.memoScroll = (function(){
    var memos = {}
    return {
      init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        element.addEventListener('scroll', function(e) {
          var memo = valueAccessor();
          memos[memo] = [element.scrollLeft,element.scrollTop];
        });
      },
      update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var memo = valueAccessor();
        if (!memos[memo]) {
          memos[memo] = [0,0];
        }

        setTimeout(function() {
          debug && console.log(memo, memos[memo])
          element.scrollLeft = memos[memo][0];
          element.scrollTop  = memos[memo][1];
        }, 10);// Wait for everything to be displayed
      }
    }
  }());

  ko.bindingHandlers.logScroll = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var memo = valueAccessor();
      if (!memo()) {
        memo('stick');
      }
      setTimeout(function() {
        if (memo() === 'stick'){
          element.scrollTop = 999999;
        } else {
          element.scrollTop = memo();
        }
      }, 100);

      // When an element is added to the node, we reactualise the scroll.
      // This is more efficient than anything else since this callback is
      // removed when the element is gone.
      element.addEventListener("DOMNodeInserted", function() {
        if (memo() === 'stick'){
          element.scrollTop = 999999;
        }
      }, true);

      element.addEventListener('scroll', function(e) {
        if ((element.scrollTop + element.offsetHeight) > (element.scrollHeight - 20)) { // 20 is the error margin
          memo('stick');
        } else {
          memo(element.scrollTop);
        }
      },true);
    }
  }

  ko.bindingHandlers.logEach = (function(){

    // Creates a function for child elements
    // that will create a dom object, and bind it to the model
    function createHandler(element) {
      var tpl = $(element.innerHTML);
      var timer, buffer, lastTime = 0;

      function getDomBuffer(){
        if (!buffer){
          buffer = document.createDocumentFragment();
        }
        return buffer;
      }

      function append(dom){
        // Append every log to the dom buffer
        getDomBuffer().appendChild(dom);

        var now = new Date();
        if (now - lastTime > 60) {
          applyBuffer(now);
        } else {
          window.clearTimeout(timer);
          timer = setTimeout(function() {
            applyBuffer(now);
          }, 100);
        }
      }

      function applyBuffer(now){
        lastTime = now;
        element.appendChild(getDomBuffer());
        buffer = null;
      }

      return function(item) {
        var dom = tpl.clone()[0];
        ko.applyBindings(item, dom);
        append(dom);
      }

    }

    return {
      init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var logs = valueAccessor();

        var renderItem = createHandler(element);
        element.innerHTML = "";

        // Display logs on start
        logs().forEach(renderItem);

        // Display logs on "push"
        var subscription = logs.subscribe(function(changes) {
          changes.forEach(function(c) {
            if (c.status === "added") {
              renderItem(c.value);
            // We are assuming here that all deletion are sequetial from first index
            } else if (c.status === "deleted" && element.firstChild) {
              element.removeChild(element.firstChild);
            }
          });
        }, null, "arrayChange");

        // Cleanup
        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
          subscription.dispose();
        });

        // thank you knockout, but we got the bindings from now on (see how createHandler applyBindings itself)
        return { controlsDescendantBindings: true };
      }
    }
  }());

  // This allows to style SVG in css (including css transition and animations)
  var svgcache = {};
  ko.bindingHandlers.svg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var url = valueAccessor();
      $(element)
        .attr({
          width: "18px", // putting default small value,
          height: "18px" // to avoid cranky blinking
        });
      if (svgcache[url]){
        $(element).replaceWith(svgcache[url].clone());
      } else {
        $.get(url, function(data) {
          svgcache[url] = $(document.adoptNode(data.querySelector('svg')));
          $(element).replaceWith(svgcache[url].clone());
        }, 'xml');
      }
    }
  }

  // Try to avoid the dom to be solicited on every messages, by looking for sequences:
  // when the server pushes 50 lines at once in the webscoket, it comes as 50 events
  // we buffer those sequences by listening all events that occur in less than 20ms.
  ko.buffer = function() {
    var timer, bufferArray = [];
    return function(item, callback) {
      bufferArray.push(item);
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = setTimeout(function() {
        callback(bufferArray);
        bufferArray = [];
        timer = null;
      }, 20);
    }
  }

  // Format micro-seconds in ms and s
  function roundDecimal(n) {
    return Math.round(n*10)/10;
  }
  ko.bindingHandlers.formatTime = {
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var value = valueAccessor();
      if      (value === 0) element.innerText = "0–"
      else if (value > 60e6) element.innerText = roundDecimal(value/60e6)+" min"
      else if (value > 10e5) element.innerText = roundDecimal(value/10e5)+" s"
      else if (value > 10e2) element.innerText = roundDecimal(value/10e2)+" ms"
      else                   element.innerText = roundDecimal(value)     +" µs"
    }
  }

  ko.bindingHandlers.formatDate = {
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var value = valueAccessor();
      var date = new Date(value);
      element.innerText = [date.getHours(),date.getMinutes(),date.getSeconds(),date.getUTCMilliseconds()].join(":");
    }
  }


  ko.bindingHandlers.format = {
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var __ = valueAccessor(), formatter = __[0], value = __[1];
      element.innerText = formatter(value);
    }
  }

  ko.bindingHandlers.tooltip = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var value = valueAccessor();

      $(element).on("mouseenter", function(e){
        var v = ko.isObservable(value)?value():value;
        if (!v) return;
        var tooltip = $("<span class='tooltip'></span>").text(v);
        $(document.body).append(tooltip);
        $(tooltip).css({
          top: (e.pageY + 10) + "px",
          left: (e.pageX + 10) + "px"
        });

        $(this).on("mousemove.tooltip", function(e) {
          $(tooltip).css({
            top: (e.pageY + 10) + "px",
            left: (e.pageX + 10) + "px"
          });
          if (ko.isObservable(value) && !value()) {
            $(this).trigger("mouseleave.tooltip");
          }
        });

        $(this).on("mouseleave.tooltip", function() {
          $(this).off("mousemove.tooltip mouseup.tooltip");
          tooltip.remove();
        });
      });
    }
  }

  // Utility functions
  ko.domRemoved = function(target, callback) {
    return setTimeout(function() {
      return target.addEventListener("DOMNodeRemovedFromDocument", function(e) {
        return callback(e);
      });
    }, 0);
    // the setTimeout here is needed because browsers call this event
    // when we append nodes from a document fragment (build in knockout).
    // Since most nodes are in a fragment when we bind them therefore,
    // we call the "remove" event right after binding if we don't delay
  }

  ko.doOnChange = function(ob, fn) {
    fn(ob());
    return ob.subscribe(fn);
  }

  ko.bindhtml = function(html, model) {
    var dom = $(html)[0];
    ko.applyBindings(model, dom);
    return dom;
  }

  ko.once = function(observable, callback) {
    var subscription = observable.subscribe(function(newValue) {
      callback(newValue);
      subscription.dispose();
    });
  }

  ko.tpl = function(tag, attrs, children){
    var element = document.createElement(tag);
    if (typeof children === "string") {
      element.appendChild(document.createTextNode(children));
    } else {
      children.forEach(function(child){
        if (!!child) element.appendChild(child);
      });
    }
    ko.applyBindingsToNode(element, attrs);
    return element;
  }

});
