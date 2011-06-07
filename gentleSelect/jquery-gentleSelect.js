/*
 * jQuery gentleSelect plugin
 * http://shawnchin.github.com/jquery-gentleSelect
 *
 * Copyright (c) 2010 Shawn Chin. 
 * Licensed under the MIT license.
 * 
 * Usage:
 *  (JS)
 *
 *  $('#myselect').gentleSelect(); // default. single column
 * 
 * $('#myselect').gentleSelect({ // 3 columns, 150px wide each
 *    itemWidth : 150,
 *    columns   : 3,
 * });
 * 
 *  (HTML)
 *  <select id='myselect'><options> .... </options></select>
 *
 */
(function($) {
    
    var defaults = {
        minWidth  : 100, // only applies if columns and itemWidth not set
        itemWidth : undefined,
        columns   : undefined,
        rows      : undefined,
        title     : undefined,
        openSpeed       : 400,
        closeSpeed      : 400,
        openEffect      : "slide",
        closeEffect     : "slide",
        hideOnMouseOut  : true
    }

    function defined(obj) {
        if (typeof obj == "undefined") { return false; }
        else { return true; }
    }

    function hasError(c, o) {
        if (c.attr("multiple") == true) {
            $.error("Sorry, gentleSelect does not work with multiple=true yet");
            return true;
        }
        if (defined(o.columns) && defined(o.rows)) {
            $.error("gentleSelect: You cannot supply both 'rows' and 'columns'");
            return true;
        }
        if (defined(o.columns) && !defined(o.itemWidth)) {
            $.error("gentleSelect: itemWidth must be supplied if 'columns' is specified");
            return true;
        }
        if (defined(o.rows) && !defined(o.itemWidth)) {
            $.error("gentleSelect: itemWidth must be supplied if 'rows' is specified");
            return true;
        }
        if (!defined(o.openSpeed) || typeof o.openSpeed != "number" && 
                (typeof o.openSpeed == "string" && (o.openSpeed != "slow" && o.openSpeed != "fast"))) { 
            $.error("gentleSelect: openSpeed must be an integer or \"slow\" or \"fast\"");
            return true;
        }
        if (!defined(o.closeSpeed) || typeof o.closeSpeed != "number" && 
                (typeof o.closeSpeed == "string" && (o.closeSpeed != "slow" && o.closeSpeed != "fast"))) { 
            $.error("gentleSelect: closeSpeed must be an integer or \"slow\" or \"fast\"");
            return true;
        }
        if (!defined(o.openEffect) || (o.openEffect != "fade" && o.openEffect != "slide")) {
            $.error("gentleSelect: openEffect must be either 'fade' or 'slide'!");
            return true;
        }
        if (!defined(o.closeEffect)|| (o.closeEffect != "fade" && o.closeEffect != "slide")) {
            $.error("gentleSelect: closeEffect must be either 'fade' or 'slide'!");
            return true;
        }
        if (!defined(o.hideOnMouseOut) || (typeof o.hideOnMouseOut != "boolean")) {
            $.error("gentleSelect: hideOnMouseOut must be supplied and either \"true\" or \"false\"!");
            return true;
        }
        return false;
    }

    var methods = {
        init : function(options) {
            var o = $.extend({}, defaults, options);

            if (hasError(this, o)) { return this; }; // check for errors
            this.hide(); // hide original select box
            
            // initialise <span> to replace select box
            var label = $("<span class='gentleselect-label'>" + this.find(":selected").text() + "</span>")
                .insertBefore(this)
                .bind("mouseenter.gentleselect", event_handlers.labelHoverIn)
                .bind("mouseleave.gentleselect", event_handlers.labelHoverOut)
                .bind("click.gentleselect", event_handlers.labelClick)
                .data("root", this);
            this.data("label", label)
                .data("options", o);
            
            // generate list of options
            var ul = $("<ul></ul>");
            this.find("option").each(function() { 
                var li = $("<li>" + $(this).text() + "</li>")
                    .data("value", $(this).attr("value"))
                    .data("name", $(this).text())
                    .appendTo(ul);
                if ($(this).attr("selected")) { li.addClass("selected"); } 
            });

            // build dialog box
            var dialog = $("<div class='gentleselect-dialog'></div>")
                .append(ul)
                .insertAfter(label)
                .bind("click.gentleselect", event_handlers.dialogClick)
                .bind("mouseleave.gentleselect", event_handlers.dialogHoverOut)
                .data("label", label)
                .data("root", this);
            this.data("dialog", dialog);

            // if to be displayed in columns
            if (defined(o.columns) || defined(o.rows)) {

                // Update CSS
                ul.css("float", "left")
                    .find("li").width(o.itemWidth).css("float","left");
                    
                var f = ul.find("li:first");
                var actualWidth = o.itemWidth 
                    + parseInt(f.css("padding-left")) 
                    + parseInt(f.css("padding-right"));
                var elemCount = ul.find("li").length;
                if (defined(o.columns)) {
                    var cols = parseInt(o.columns);
                    var rows = Math.ceil(elemCount / cols);
                } else {
                    var rows = parseInt(o.rows);
                    var cols = Math.ceil(elemCount / rows);
                }
                dialog.width(actualWidth * cols);

                // add padding
                for (var i = 0; i < (rows * cols) - elemCount; i++) {
                    $("<li style='float:left' class='gentleselect-dummy'><span>&nbsp;</span></li>").appendTo(ul);
                }

                // reorder elements
                var ptr = [];
                var idx = 0;
                ul.find("li").each(function() {
                    if (idx < rows) { 
                        ptr[idx] = $(this); 
                    } else {
                        var p = idx % rows;
                        $(this).insertAfter(ptr[p]);
                        ptr[p] = $(this);
                    }
                    idx++;
                });
            } else if (typeof o.minWidth == "number") {
                dialog.css("min-width", o.minWidth);
            }

            if (defined(o.title)) {
                $("<div class='gentleselect-title'>" + o.title + "</div>").prependTo(dialog);
            }

            // ESC key should hide all dialog boxes
            $(document).bind("keyup.gentleselect", event_handlers.keyUp);

            return this;
        },

        // if select box was updated externally, we need to bring everything
        // else up to speed.
        update : function() {
            var root = this;
            var v = this.val(); // current value of select box
            this.data("dialog").find("li").each(function() {
                if ($(this).data("value") == v) {
                    $(this).addClass("selected");
                    root.data("label").text($(this).data("name"));
                } else {
                    $(this).removeClass("selected");
                };
            });
            return this;
        }
    };

    var event_handlers = {

        labelHoverIn : function() { 
            $(this).addClass('gentleselect-label-highlight'); 
        },

        labelHoverOut : function() { 
            $(this).removeClass('gentleselect-label-highlight'); 
        },

        labelClick : function() {
            var pos = $(this).position();
            var root = $(this).data("root");
            var opts = root.data("options");
            var dialog = root.data("dialog")
                .css("top", pos.top + root.height())
                .css("left", pos.left + 1);
            if (opts.openEffect == "fade") {
                dialog.fadeIn(opts.openSpeed);
            } else {
                dialog.slideDown(opts.openSpeed);
            }
        },
    
        dialogHoverOut : function() {
            if ($(this).data("root").data("options").hideOnMouseOut) {
                $(this).hide();
            }
        },

        dialogClick : function(e) {
            var clicked = $(e.target);
            var opts = $(this).data("root").data("options");
            if (opts.closeEffect == "fade") {
                $(this).fadeOut(opts.closeSpeed);
            } else {
                $(this).slideUp(opts.closeSpeed);
            }

            if (clicked.is("li") && !clicked.hasClass("gentleselect-dummy")) {
                var value = clicked.data("value");
                var name = clicked.data("name");
                var label = $(this).data("label")
                    .text(name); // update label

                // update selected li
                $(this).find("li.selected").removeClass("selected");
                clicked.addClass("selected");
                // update actual selectbox
                var actual = $(this).data("root").val(value).trigger("change");
                
            }
        },

        keyUp : function(e) {
            if (e.keyCode == 27 ) { // ESC
                $(".gentleselect-dialog").hide();
            }
        }
    };

    $.fn.gentleSelect = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.gentleSelect' );
        }   
    };


})(jQuery);
