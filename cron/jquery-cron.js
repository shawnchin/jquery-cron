/*
 * jQuery gentleSelect plugin
 * http://shawnchin.github.com/jquery-cron
 *
 * Copyright (c) 2010 Shawn Chin. 
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * 
 * Requires:
 * - jQuery
 * - jQuery gentleSelect plugin 
 *
 * Usage:
 *  (JS)
 *
 *  // initialise like this
 *  var c = $('#cron').cron({
 *    initial: '9 10 * * *', # Initial value. default = "* * * * *"
 *    url_set: '/set/', # POST expecting {"cron": "12 10 * * 6"}
 *  });
 * 
 *  // you can update values later 
 *  c.cron("value", "1 2 3 4 *");
 *
 * // you can also get the current value using the "value" option
 * alert(c.cron("value"));
 *
 *  (HTML)
 *  <div id='cron'></div>
 *
 * Notes:
 * At this stage, we only support a subset of possible cron options. 
 * For example, each cron entry can only be digits or "*", no commas
 * to denote multiple entries. We also limit the allowed combinations:
 * - Every minute : * * * * *
 * - Every hour   : ? * * * *
 * - Every day    : ? ? * * *
 * - Every week   : ? ? * * ?
 * - Every month  : ? ? ? * *
 * - Every year   : ? ? ? ? *
 */
(function($) {
    
    var defaults = {
        enableSeconds: false,
        initial: "* * * * *",
        minuteOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 30,
            columns   : 4,
            rows      : undefined,
            title     : "Minutes Past the Hour"
        },
        timeHourOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 20,
            columns   : 2,
            rows      : undefined,
            title     : "Time: Hour"
        },
        domOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 30,
            columns   : undefined,
            rows      : 10,
            title     : "Day of Month"
        },
        monthOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 100,
            columns   : 2,
            rows      : undefined,
            title     : undefined
        },
        dowOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : undefined,
            columns   : undefined,
            rows      : undefined,
            title     : undefined
        },
        timeMinuteOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 20,
            columns   : 4,
            rows      : undefined,
            title     : "Time: Minute"
        },
        effectOpts : {
            openSpeed      : 400,
            closeSpeed     : 400,
            openEffect     : "slide",
            closeEffect    : "slide",
            hideOnMouseOut : true
        },
        url_set : undefined,
        customValues : undefined,
        onChange: undefined // callback function each time value changes
    };
    
    // -------  build some static data -------
    
    // options for minutes in an hour
    var str_opt_mih = "";
    for (var i = 0; i < 60; i++) {
        var j = (i < 10)? "0":"";
        str_opt_mih += "<option value='"+i+"'>" + j +  i + "</option>\n"; 
    }

    // options for hours in a day
    var str_opt_hid = "";
    for (var i = 0; i < 24; i++) { 
        var j = (i < 10)? "0":"";
        str_opt_hid += "<option value='"+i+"'>" + j + i + "</option>\n"; 
    }

    // options for days of month
    var str_opt_dom = "";
    for (var i = 1; i < 32; i++) {
        if (i == 1 || i == 21) { var suffix = "st"; } 
        else if (i == 2 || i == 22) { var suffix = "nd"; } 
        else if (i == 3 || i == 23) { var suffix = "rd"; } 
        else { var suffix = "th"; }
        str_opt_dom += "<option value='"+i+"'>" + i + suffix + "</option>\n"; 
    }

    // options for months
    var str_opt_month = "";
    var months = ["January", "February", "March", "April",
                  "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    for (var i = 0; i < months.length; i++) {
        str_opt_month += "<option value='"+(i+1)+"'>" + months[i] + "</option>\n"; 
    }
    
    // options for day of week
    var str_opt_dow = "";
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"];
    for (var i = 0; i < days.length; i++) {
        str_opt_dow += "<option value='"+i+"'>" + days[i] + "</option>\n"; 
    }

    // options for period
    var str_opt_period = "";
    var periods = ["minute", "hour", "day", "week", "month", "year"];
    for (var i = 0; i < periods.length; i++) {
        str_opt_period += "<option value='"+periods[i]+"'>" + periods[i] + "</option>\n"; 
    }
    
    // display matrix
    var toDisplay = {
        "minute" : [],
        "hour"   : ["mins"],
        "day"    : ["time"],
        "week"   : ["dow", "time"],
        "month"  : ["dom", "time"],
        "year"   : ["dom", "month", "time"]
    };
    
    var combinations = {
        "minute": /^(\*\s){2}(\*|\?)\s\*\s(\*|\?)$/,        // "* * */? * */?"
        "hour"  : /^(\d{1,2}\s)\*\s(\*|\?)\s\*\s(\*|\?)$/,  // "1 * */? * */?"
        "day"   : /^(\d{1,2}\s){2}(\*|\?)\s\*\s(\*|\?)$/,   // "1 1 */? * */?"
        "week"  : /^(\d{1,2}\s){2}(\*|\?)\s\*\s\d{1,2}$/,   // "1 1 */? * 1"
        "month" : /^(\d{1,2}\s){3}\*\s(\*|\?)$/,            // "1 1 1   * */?"
        "year"  : /^(\d{1,2}\s){4}(\*|\?)$/                 // "1 1 1   1 */?"
    };

    var combinationsSeconds = {
        "second": /^(\*\s){3}(\*|\?)\s\*\s(\*|\?)$/,           // "* * * */? * */?"
        "minute": /^\d{1,2}\s(\*\s){2}(\*|\?)\s\*\s(\*|\?)$/,  // "1 * * */? * */?"
        "hour"  : /^(\d{1,2}\s){2}\*\s(\*|\?)\s\*\s(\*|\?)$/,  // "1 1 * */? * */?"
        "day"   : /^(\d{1,2}\s){3}(\*|\?)\s\*\s(\*|\?)$/,      // "1 1 1 */? * */?"
        "week"  : /^(\d{1,2}\s){3}(\*|\?)\s\*\s\d{1,2}$/,      // "1 1 1 */? * 1"
        "month" : /^(\d{1,2}\s){4}\*\s(\*|\?)$/,               // "1 1 1 1   * */?"
        "year"  : /^(\d{1,2}\s){5}(\*|\?)$/                    // "1 1 1 1   1 */?"
    };

    // ------------------ internal functions ---------------
    function defined(obj) {
        if (typeof obj == "undefined") { return false; }
        else { return true; }
    }

    function undefinedOrObject(obj) {
        return (!defined(obj) || typeof obj == "object")
    }
    
    function getCronType(cron_str, enableSeconds) {
        // check format of initial cron value
        var valid_cron = enableSeconds ? /^((\d{1,2}|\*)\s){3}((\d{1,2}|\*|\?)\s)((\d{1,2}|\*)\s)((\d{1,2}|\*|\?))$/ : /^((\d{1,2}|\*)\s){2}((\d{1,2}|\*|\?)\s)((\d{1,2}|\*)\s)((\d{1,2}|\*|\?))$/;
        if (typeof cron_str != "string" || !valid_cron.test(cron_str)) {
            $.error("cron: invalid initial value");
            return undefined;
        }
        // check actual cron values
        var d = cron_str.split(" ");
        //            mm, hh, DD, MM, DOW
        var minval = enableSeconds ? [0, 0, 0, 1, 1, 0] : [0, 0, 1, 1, 0];
        var maxval = enableSeconds ? [59, 59, 23, 31, 12,  6] : [59, 23, 31, 12, 6];
        for (var i = 0; i < d.length; i++) {
            if (d[i] == "*" || d[i] == "?") continue;
            var v = parseInt(d[i]);
            if (defined(v) && v <= maxval[i] && v >= minval[i]) continue;

            $.error("cron: invalid value found (col "+(i+1)+") in " + o.initial);
            return undefined;
        }

        // determine combination
        var validCombinations = enableSeconds ? combinationsSeconds : combinations;
        for (var t in validCombinations) {
            if (validCombinations[t].test(cron_str)) { return t; }
        }

        // unknown combination
        $.error("cron: valid but unsupported cron format. sorry.");
        return undefined;
    }

    function hasError(c, o) {
        if (!defined(getCronType(o.initial, o.enableSeconds))) { return true; }
        if (!undefinedOrObject(o.customValues)) { return true; }
        return false;
    }

    function getCurrentValue(c) {
        var b = c.data("block");
        var second = min = hour = day = month = dow = "*";
        var selectedPeriod = b["period"].find("select").val();
        switch (selectedPeriod) {
            case "minute":
                dow = "?";
                break;
                
            case "hour":
                second = 0;
                min = b["mins"].find("select").val();
                dow = "?";
                break;

            case "day":
                second = 0;
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                dow = "?";
                break;

            case "week":
                second = 0;
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                dow  =  b["dow"].find("select").val();
                day = "?";
                break;

            case "month":
                second = 0;
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                dow = "?";
                break;

            case "year":
                second = 0;
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                month = b["month"].find("select").val();
                dow = "?";
                break;

            default:
                // we assume this only happens when customValues is set
                return selectedPeriod;
        }
        if (c.data("options").enableSeconds)
            return [second, min, hour, day, month, dow].join(" ");
        return [min, hour, day, month, dow].join(" ");
    }

    // -------------------  PUBLIC METHODS -----------------

    var methods = {
        init : function(opts) {
            
            // init options
            var options = opts ? opts : {}; /* default to empty obj */
            var o = $.extend([], defaults, options);
            var eo = $.extend({}, defaults.effectOpts, options.effectOpts);
            $.extend(o, {
                minuteOpts     : $.extend({}, defaults.minuteOpts, eo, options.minuteOpts), 
                domOpts        : $.extend({}, defaults.domOpts, eo, options.domOpts), 
                monthOpts      : $.extend({}, defaults.monthOpts, eo, options.monthOpts), 
                dowOpts        : $.extend({}, defaults.dowOpts, eo, options.dowOpts), 
                timeHourOpts   : $.extend({}, defaults.timeHourOpts, eo, options.timeHourOpts), 
                timeMinuteOpts : $.extend({}, defaults.timeMinuteOpts, eo, options.timeMinuteOpts)
            });
           
            // error checking
            if (hasError(this, o)) { return this; }

            // ---- define select boxes in the right order -----

            var block = [], custom_periods = "", cv = o.customValues;
            if (defined(cv)) { // prepend custom values if specified
                for (var key in cv) {
                    custom_periods += "<option value='" + cv[key] + "'>" + key + "</option>\n";
                }
            }
            block["period"] = $("<span class='cron-period'>"
                    + "Every <select name='cron-period'>" + custom_periods 
                    + str_opt_period + "</select> </span>")
                .appendTo(this)                               
                .find("select")
                    .bind("change.cron", event_handlers.periodChanged)
                    .data("root", this)
                    .gentleSelect(eo)
                    .end();
            
            block["dom"] = $("<span class='cron-block cron-block-dom'>"
                    + " on the <select name='cron-dom'>" + str_opt_dom 
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.domOpts)
                    .data("root", this)
                    .end();

            block["month"] = $("<span class='cron-block cron-block-month'>"
                    + " of <select name='cron-month'>" + str_opt_month 
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.monthOpts)
                    .data("root", this)
                    .end();

            block["mins"] = $("<span class='cron-block cron-block-mins'>"
                    + " at <select name='cron-mins'>" + str_opt_mih 
                    + "</select> minutes past the hour </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.minuteOpts)
                    .data("root", this)
                    .end();

            block["dow"] = $("<span class='cron-block cron-block-dow'>"
                    + " on <select name='cron-dow'>" + str_opt_dow
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.dowOpts)
                    .data("root", this)
                    .end();

            block["time"] = $("<span class='cron-block cron-block-time'>"
                    + " at <select name='cron-time-hour' class='cron-time-hour'>" + str_opt_hid
                    + "</select>:<select name='cron-time-min' class='cron-time-min'>" + str_opt_mih
                    + " </span>")
                .appendTo(this)
                .data("root", this)
                .find("select.cron-time-hour")
                    .gentleSelect(o.timeHourOpts)
                    .data("root", this)
                    .end()
                .find("select.cron-time-min")
                    .gentleSelect(o.timeMinuteOpts)
                    .data("root", this)
                    .end();

            block["controls"] = $("<span class='cron-controls'>&laquo; save "
                    + "<span class='cron-button cron-button-save'></span>"
                    + " </span>")
                .appendTo(this)
                .data("root", this)
                .find("span.cron-button-save")
                    .bind("click.cron", event_handlers.saveClicked)
                    .data("root", this)
                    .end();

            this.find("select").bind("change.cron-callback", event_handlers.somethingChanged);
            this.data("options", o).data("block", block); // store options and block pointer
            this.data("current_value", o.initial); // remember base value to detect changes
            
            return methods["value"].call(this, o.initial); // set initial value
        },

        value : function(cron_str) {
            // when no args, act as getter
            if (!cron_str) { return getCurrentValue(this); }

            var opts = this.data("options");

            var t = getCronType(cron_str, opts.enableSeconds);
            if (!defined(t)) { return false; }

            var block = this.data("block");
            var d = cron_str.split(" ");
            var v = {};
            if (opts.enableSeconds)
                v = {
                    "secs"  : d[0],
                    "mins"  : d[1],
                    "hour"  : d[2],
                    "dom"   : d[3],
                    "month" : d[4],
                    "dow"   : d[5]
                };
            else
                v = {
                    "mins": d[0],
                    "hour": d[1],
                    "dom": d[2],
                    "month": d[3],
                    "dow": d[4]
                };

            // update appropriate select boxes
            var targets = toDisplay[t];
            for (var i = 0; i < targets.length; i++) {
                var tgt = targets[i];
                if (tgt == "time") {
                    block[tgt]
                        .find("select.cron-time-hour")
                            .val(v["hour"]).gentleSelect("update")
                            .end()
                        .find("select.cron-time-min")
                            .val(v["mins"]).gentleSelect("update")
                        .end();
                } else {;
                    block[tgt].find("select").val(v[tgt]).gentleSelect("update");
                }
            }
            
            // trigger change event
            block["period"].find("select")
                .val(t)
                .gentleSelect("update")
                .trigger("change");

            return this;
        }
    };

    var event_handlers = {
        periodChanged : function() {
            var root = $(this).data("root");
            var block = root.data("block"),
                opt = root.data("options");
            var period = $(this).val();
            root.find("span.cron-block").hide(); // first, hide all blocks
            if (toDisplay.hasOwnProperty(period)) { // not custom value
                var b = toDisplay[$(this).val()];
                for (var i = 0; i < b.length; i++) {
                    block[b[i]].show();
                }
            }
        },

        somethingChanged : function() {
            root = $(this).data("root");
            // if AJAX url defined, show "save"/"reset" button
            if (defined(root.data("options").url_set)) {
                if (methods.value.call(root) != root.data("current_value")) { // if changed
                    root.addClass("cron-changed");
                    root.data("block")["controls"].fadeIn();
                } else { // values manually reverted
                    root.removeClass("cron-changed");
                    root.data("block")["controls"].fadeOut();
                }
            } else {
                root.data("block")["controls"].hide();
            }

            // chain in user defined event handler, if specified
            var oc = root.data("options").onChange;
            if (defined(oc) && $.isFunction(oc)) {
                oc.call(root);
            }
        },

        saveClicked : function() {
            var btn  = $(this);
            var root = btn.data("root");
            var cron_str = methods.value.call(root);

            if (btn.hasClass("cron-loading")) { return; } // in progress
            btn.addClass("cron-loading");

            $.ajax({
                type : "POST",
                url  : root.data("options").url_set,
                data : { "cron" : cron_str },
                success : function() {
                    root.data("current_value", cron_str);
                    btn.removeClass("cron-loading");
                    // data changed since "save" clicked?
                    if (cron_str == methods.value.call(root)) {
                        root.removeClass("cron-changed");
                        root.data("block").controls.fadeOut();
                    }                    
                },
                error : function() {
                    alert("An error occured when submitting your request. Try again?");
                    btn.removeClass("cron-loading");
                }
            });
        }
    };

    $.fn.cron = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.cron' );
        }   
    };

})(jQuery);
