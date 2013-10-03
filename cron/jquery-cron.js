/*
 * jQuery gentleSelect plugin (version 0.1.4)
 * http://shawnchin.github.com/jquery-cron
 *
 * forked and modified by Khalid Salomao
 * https://github.com/khalidsalomao/jquery-cron
 * new features: multiples intervals and multiples time selections
 *
 * Copyright (c) 2010-2013 Shawn Chin.
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Requires:
 * - jQuery
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
(function ($) {
    'use strict';
    var defaults = {
        initial: "* * * * *",
        minuteOpts: {
            minWidth: 100, // only applies if columns and itemWidth not set
            itemWidth: 30,
            columns: 4,
            rows: undefined,
            title: "Minutes Past the Hour",
            prompt: "every minute"
        },
        timeHourOpts: {
            minWidth: 100, // only applies if columns and itemWidth not set
            itemWidth: 20,
            columns: 2,
            rows: undefined,
            title: "Time: Hour",
            prompt: "every hour"
        },
        domOpts: {
            minWidth: 100, // only applies if columns and itemWidth not set
            itemWidth: 30,
            columns: undefined,
            rows: 10,
            title: "Day of Month",
            prompt: "every day"
        },
        monthOpts: {
            minWidth: 100, // only applies if columns and itemWidth not set
            itemWidth: 100,
            columns: 2,
            rows: undefined,
            title: undefined,
            prompt: "every month"
        },
        dowOpts: {
            minWidth: 100, // only applies if columns and itemWidth not set
            itemWidth: undefined,
            columns: undefined,
            rows: undefined,
            title: undefined,
            prompt: "every day"
        },
        timeMinuteOpts: {
            minWidth: 100, // only applies if columns and itemWidth not set
            itemWidth: 20,
            columns: 4,
            rows: undefined,
            title: "Time: Minute",
            prompt: "every minute"
        },
        effectOpts: {
            openSpeed: 400,
            closeSpeed: 400,
            openEffect: "slide",
            closeEffect: "slide",
            hideOnMouseOut: true
        },
        url_set: undefined,
        customValues: undefined,
        onChange: undefined, // callback function each time value changes
        useGentleSelect: false,
        allowIntervalExpression: true // allow additional interval configuration like: "*/5 * * * *"
    };

    // -------  build some static data -------

    var i, j, len;
    // options for minutes in an hour
    var str_opt_mih = "";
    for (i = 0; i < 60; i++) {
        j = (i < 10) ? "0" : "";
        str_opt_mih += "<option value='" + i + "'>" + j + i + "</option>\n";
    }

    // options for hours in a day
    var str_opt_hid = "";
    for (i = 0; i < 24; i++) {
        j = (i < 10) ? "0" : "";
        str_opt_hid += "<option value='" + i + "'>" + j + i + "</option>\n";
    }

    // options for days of month
    var suffix, str_opt_dom = "";
    for (i = 1; i < 32; i++) {
        if (i === 1 || i === 21 || i === 31) { suffix = "st"; }
        else if (i === 2 || i === 22) { suffix = "nd"; }
        else if (i === 3 || i === 23) { suffix = "rd"; }
        else { suffix = "th"; }
        str_opt_dom += "<option value='" + i + "'>" + i + suffix + "</option>\n";
    }

    // options for months
    var str_opt_month = "";
    var months = ["January", "February", "March", "April",
                  "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    for (i = 0, len = months.length; i < len; i++) {
        str_opt_month += "<option value='" + (i + 1) + "'>" + months[i] + "</option>\n";
    }

    // options for day of week
    var str_opt_dow = "";
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"];
    for (i = 0, len = days.length; i < len; i++) {
        str_opt_dow += "<option value='" + i + "'>" + days[i] + "</option>\n";
    }

    // options for period
    var str_opt_period = "";
    var periods = ["minute", "hour", "day", "week", "month", "year"];
    for (i = 0, len = periods.length; i < len; i++) {
        str_opt_period += "<option value='" + periods[i] + "'>" + periods[i] + "</option>\n";
    }

    // display matrix
    var toDisplay = {
        "minute": ["interval"],
        "hour": ["interval", "mins"],
        "day": ["interval", "time"],
        "week": ["dow", "time"],
        "month": ["interval", "dom", "time"],
        "year": ["dom", "month", "time"]
    };

    var indexToField = ["minute", "hour", "day", "month", "week"];

    var combinations = {
        "minute": /^(\*\s){4}\*$/,      // "* * * * *"
        "hour": /^.\s(\*\s){3}\*$/,     // "? * * * *"
        "day": /^(.\s){2}(\*\s){2}\*$/, // "? ? * * *"
        "week": /^(.\s){2}(\*\s){2}.$/, // "? ? * * ?"
        "month": /^(.\s){3}\*\s\*$/,    // "? ? ? * *"
        "year": /^(.\s){4}\*$/          // "? ? ? ? *"
    };

    // ------------------ internal functions ---------------

    function fullCronParser(cron_str) {
        // 0. internal variables
        var j, v, parts,
            cleanedCron = [],
            singleRegex = /^((\*(\/\d+)?)|(\d+(,\d+)*))$/,
            item = {
                valid: false,
                cron_str: cron_str
            };

        // 1. split cron string
        if (!cron_str) { return item; }
        parts = $.trim(cron_str).split(" ");
        // 2. sanity check
        if (parts.length != 5) {
            return item;
        }
        // 3. validate and parse repeat time
        for (j = 0; j < parts.length; j++) {
            v = parts[j];
            // validate part
            if (!singleRegex.test(v)) {
                return item;
            }

            // repeat time
            if (v.indexOf('/') > 0) {                
                // save repeat time values
                item.repeatTime = v.split('/')[1];
                item.repeatTimePos = j;
                // replace the value by a placeholder
                v = '*';
            }
            // set value
            if (v.indexOf(',') > 0) {
                item[indexToField[j]] = v.split(',');
            } else {

                item[indexToField[j]] = [v];
            }
            // prepare a cleaned cron string for geting cron type on phase 4
            if (v === "*") {
                cleanedCron.push('*');
            } else {
                cleanedCron.push('x');
            }
        }

        // 4. get main cron type
        if (item.repeatTime) {
            item.cron_type = indexToField[item.repeatTimePos];
            item.valid = true;
        } else {
            v = cleanedCron.join(' ');
            for (j in combinations) {
                if (combinations[j].test(v)) {
                    item.cron_type = j;
                    item.valid = true;
                    break;
                }
            }
        }

        return item;
    }

    function getCurrentValue(c) {
        var b = c.data("block");
        var min, hour, day, month, dow;
        min = hour = day = month = dow = "*";
        // prepare period repeat time
        var repeatTime = b["period"].find("input.cron-period-repeat").val();
        if (!repeatTime) { repeatTime = 1; }

        // prepare period
        var selectedPeriod = b["period"].find("select").val();
        switch (selectedPeriod) {
            case "minute":
                if (repeatTime > 1) { min += "/" + repeatTime; }
                break;

            case "hour":
                min = b["mins"].find("select").val();
                if (repeatTime > 1) { hour += "/" + repeatTime; }
                break;

            case "day":
                min = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                if (repeatTime > 1) { day += "/" + repeatTime; }
                break;

            case "week":
                min = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                dow = b["dow"].find("select").val();
                //if (repeatTime > 1) { dow += "/" + repeatTime; }
                break;

            case "month":
                min = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day = b["dom"].find("select").val();
                if (repeatTime > 1) { month += "/" + repeatTime; }
                break;

            case "year":
                min = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day = b["dom"].find("select").val();
                month = b["month"].find("select").val();

                break;

            default:
                // we assume this only happens when customValues is set
                return selectedPeriod;
        }
        // treat not selected values
        if (!min) { min = "*"; }
        if (!hour) { hour = "*"; }
        if (!day) { day = "*"; }
        if (!month) { month = "*"; }
        if (!dow) { dow = "*"; }
        // create cron string
        return [min, hour, day, month, dow].join(" ");
    }

    // -------------------  PUBLIC METHODS -----------------

    var methods = {
        init: function (opts) {

            // init options
            var options = opts || {}; /* default to empty obj */
            var o = $.extend([], defaults, options);
            var eo = $.extend({}, defaults.effectOpts, options.effectOpts);
            $.extend(o, {
                minuteOpts: $.extend({}, defaults.minuteOpts, eo, options.minuteOpts),
                domOpts: $.extend({}, defaults.domOpts, eo, options.domOpts),
                monthOpts: $.extend({}, defaults.monthOpts, eo, options.monthOpts),
                dowOpts: $.extend({}, defaults.dowOpts, eo, options.dowOpts),
                timeHourOpts: $.extend({}, defaults.timeHourOpts, eo, options.timeHourOpts),
                timeMinuteOpts: $.extend({}, defaults.timeMinuteOpts, eo, options.timeMinuteOpts)
            });

            // parse cron string
            var parsed = fullCronParser(o.initial);
            // error checking
            if (!parsed.valid) { return this; }

            // ---- define select boxes in the right order -----

            // create main cron period
            var htmlText, block = [], custom_periods = "", cv = o.customValues;
            if (cv) { // prepend custom values if specified
                for (var key in cv) {
                    custom_periods += "<option value='" + cv[key] + "'>" + key + "</option>\n";
                }
            }

            htmlText = "<span class='cron-period'>Every ";
            if (o.allowIntervalExpression) {
                htmlText += "<input type='number' class='cron-period-repeat' min='1' max='10000' style='width:32px;' step='1' value='1'/> ";                
            }
            htmlText += "<select name='cron-period'>" + custom_periods + str_opt_period + "</select> </span>";
            
            block["period"] = $(htmlText).appendTo(this).data("root", this);

            // configure interval field
            block["interval"] = block["period"].find("input.cron-period-repeat");
            block["interval"].bind("change.cron", event_handlers.periodChanged).data("root", this);
            var select = block["period"].find("select");
            select.bind("change.cron", event_handlers.periodChanged)
                  .data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(eo); }

            // create day of month
            htmlText = "<span class='cron-block cron-block-dom'> on the <select name='cron-dom' multiple>" + str_opt_dom + "</select> </span>";
            block["dom"] = $(htmlText)
                .appendTo(this)
                .data("root", this);

            select = block["dom"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.domOpts); }

            // create month
            htmlText = "<span class='cron-block cron-block-month'> of <select name='cron-month' multiple>" + str_opt_month + "</select> </span>";
            block["month"] = $(htmlText)
                .appendTo(this)
                .data("root", this);

            select = block["month"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.monthOpts); }

            // create minutes
            htmlText = "<span class='cron-block cron-block-mins'> at <select name='cron-mins' multiple>" + str_opt_mih + "</select> minutes past the hour </span>";
            block["mins"] = $(htmlText)
                .appendTo(this)
                .data("root", this);

            select = block["mins"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.minuteOpts); }

            // create day of week
            htmlText = "<span class='cron-block cron-block-dow'> on <select name='cron-dow' multiple>" + str_opt_dow + "</select> </span>";
            block["dow"] = $(htmlText)
                .appendTo(this)
                .data("root", this);

            select = block["dow"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.dowOpts); }

            // create hour and minutes
            htmlText = "<span class='cron-block cron-block-time'> at ";
            htmlText =+ "<select name='cron-time-hour' class='cron-time-hour' multiple>" + str_opt_hid;
            htmlText =+ "</select>:<select name='cron-time-min' class='cron-time-min' multiple>" + str_opt_mih;
            htmlText =+ "</select> </span>";
            block["time"] = $(htmlText)
                .appendTo(this)
                .data("root", this);

            select = block["time"].find("select.cron-time-hour").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.timeHourOpts); }
            select = block["time"].find("select.cron-time-min").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.timeMinuteOpts); }

            this.find("input.cron-period-repeat").bind("change.cron-callback", event_handlers.somethingChanged);
            this.find("select").bind("change.cron-callback", event_handlers.somethingChanged);
            this.data("options", o).data("block", block); // store options and block pointer
            this.data("current_value", o.initial); // remember base value to detect changes

            return methods["value"].call(this, o.initial); // set initial value
        },

        value: function (cron_str) {
            // when no args, act as getter
            if (!cron_str) { return getCurrentValue(this); }

            // parse cron string
            var parsed = fullCronParser(cron_str);
            var t = parsed.cron_type;
            if (!parsed.valid) { return this; }

            var block = this.data("block");

            // get parsed values
            var v = {
                "mins": parsed.minute,
                "hour": parsed.hour,
                "dom": parsed.day,
                "month": parsed.month,
                "dow": parsed.week
            };
            // is gentleSelect enabled
            var useGentleSelect = this.data('options').useGentleSelect;

            // update appropriate select boxes
            var tgt, btgt,
                targets = toDisplay[t];
            for (i = 0, len = targets.length; i < len; i++) {
                tgt = targets[i];
                if (tgt == "time") {
                    btgt = block[tgt].find("select.cron-time-hour").val(v["hour"]);
                    if (useGentleSelect) { btgt.gentleSelect("update"); }

                    btgt = block[tgt].find("select.cron-time-min").val(v["mins"]);
                    if (useGentleSelect) { btgt.gentleSelect("update"); }
                } else if (tgt == "interval") {
                    continue;
                } else {
                    btgt = block[tgt].find("select").val(v[tgt]);
                    if (useGentleSelect) { btgt.gentleSelect("update"); }
                }
            }

            // set repeat time
            if (parsed.repeatTime) {
                block["period"].find("input.cron-period-repeat").val(parsed.repeatTime);
            } else {
                block["period"].find("input.cron-period-repeat").val(1);
            }

            // trigger change event
            var bp = block["period"].find("select").val(t);
            if (useGentleSelect) { bp.gentleSelect("update"); }
            bp.trigger("change");

            return this;
        }

    };

    var event_handlers = {
        periodChanged: function () {
            var b,
                root = $(this).data("root"),
                block = root.data("block"),
                period = $(this).val();
            // deal with change on period repeat field
            if (this.className === "cron-period-repeat") {
                period = block["period"].find("select").val();
            }
            // update display
            root.find("span.cron-block").hide(); // first, hide all blocks
            block["interval"].hide();
            if (toDisplay.hasOwnProperty(period)) { // not custom value
                b = toDisplay[period];
                for (i = 0, len = b.length; i < len; i++) {
                    block[b[i]].show();
                }
            }
        },

        somethingChanged: function () {
            var root = $(this).data("root"),
            // chain in user defined event handler, if specified
                oc = root.data("options").onChange;
            if (oc && $.isFunction(oc)) {
                oc.call(root);
            }
        }
    };

    $.fn.cron = function (method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.cron');
        }
    };

})(jQuery);
