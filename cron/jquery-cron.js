/*
 * jQuery gentleSelect plugin
 * Forked from: http://shawnchin.github.com/jquery-cron
 * To: https://github.com/Gidgidonihah/jquery-cron
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
 /*jshint laxbreak:true */
(function($) {

    var defaults = {
        initial : "* * * * *",
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
		multiFrequency: false,
		frequencyOpts : {
			1:"once",
			2:"twice",
			3:"three times",
			4:"four times"
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
    for (var r = 0; r < 24; r++) {
        var q = (r < 12) ? "am" : "pm";
		var k = (r > 12) ? r-12 : r;
		if(k === 0){ k = 12; }
        str_opt_hid += "<option value='"+r+"'>" + k + q + "</option>\n";
    }

    // options for days of month
    var str_opt_dom = "";
    for (var l = 1; l < 32; l++) {
		var suffix;

        if (l === 1 || l === 21 || l === 31) { suffix = "st"; }
        else if (l === 2 || l === 22) { suffix = "nd"; }
        else if (l === 3 || l === 23) { suffix = "rd"; }
        else { suffix = "th"; }
        str_opt_dom += "<option value='"+l+"'>" + l + suffix + "</option>\n";
    }

    // options for months
    var str_opt_month = "";
    var months = ["January", "February", "March", "April",
                  "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    for (var m = 0; m < months.length; m++) {
        str_opt_month += "<option value='"+(m+1)+"'>" + months[m] + "</option>\n";
    }

    // options for day of week
    var str_opt_dow = "";
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"];
    for (var n = 0; n < days.length; n++) {
        str_opt_dow += "<option value='"+n+"'>" + days[n] + "</option>\n";
    }

    // options for period
    var str_opt_period = "";
    var periods = ["minute", "hour", "day", "week", "month", "year"];
    for (var p = 0; p < periods.length; p++) {
        str_opt_period += "<option value='"+periods[p]+"'>" + periods[p] + "</option>\n";
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
        "minute" : /^(\*\s){4}\*$/,							// "* * * * *"
        "hour"   : /^^[\d\,]+\s(\*\s){3}\*$/,				// "? * * * *"
        "day"    : /^(\d{1,2}\s)[\d\,]+\s(\*\s){2}\*$/,		// "? ? * * *"
        "week"   : /^(\d{1,2}\s){2}(\*\s){2}[\d\,]+$/,		// "? ? * * ?"
        "month"  : /^(\d{1,2}\s){2}[\d\,]+(\s\*){2}$/,		// "? ? ? * *"
        "year"   : /^(\d{1,2}\s){3}[\d\,]+\s\*$/			// "? ? ? ? *"
    };

    // ------------------ internal functions ---------------
    function defined(obj) {
        if (typeof obj === "undefined") { return false; }
        else { return true; }
    }

    function undefinedOrObject(obj) {
        return (!defined(obj) || typeof obj === "object");
    }

    function getCronType(cron_str) {
        // check format of initial cron value
        var valid_cron = /^([\d\,\*]+\s){4}[\d\,\*]+$/;
        if (typeof cron_str !== "string" || !valid_cron.test(cron_str)) {
            $.error("cron: invalid initial value");
            return undefined;
        }

        // check actual cron values
        var d = cron_str.split(" ");

        //            mm, hh, DD, MM, DOW
        var minval = [ 0,  0,  1,  1,  0];
        var maxval = [59, 23, 31, 12,  6];
		var v;

        for (var i = 0; i < d.length; i++) {
            if (d[i] === "*"){ continue; }
			if (d[i].indexOf(',') >= 0){
				var x = d[i].split(',');
				var invalid = false;
				for (var q = 0; q < x.length; q++) {
					v = parseInt(x[q], 10);
					if (defined(v) && v <= maxval[i] && v >= minval[i]){ continue; }
					invalid = true;
				}
				if(!invalid){ continue; }
			}else{
				v = parseInt(d[i], 10);
				if (defined(v) && v <= maxval[i] && v >= minval[i]){ continue; }
			}

            $.error("cron: invalid value found (col "+(i+1)+")");
            return undefined;
        }

        // determine combination
        for (var t in combinations) {
            if (combinations[t].test(cron_str)) { return t; }
        }

        // unknown combination
        $.error("cron: valid but unsupported cron format. sorry.");
        return undefined;
    }

    function hasError(c, o) {
        if (!defined(getCronType(o.initial))) { return true; }
        if (!undefinedOrObject(o.customValues)) { return true; }
        return false;
    }

    function getCurrentValue(c) {
        var b = c.data("block");
        var selectedPeriod = b.period.find("select").val();
		var min, hour, day, month, dow;

        min = hour = day = month = dow = "*";

        switch (selectedPeriod) {
            case "minute":
                break;

            case "hour":
				min = getValue(b.mins.find("select"));
                break;

            case "day":
				min = getValue(b.time.find("select.cron-time-min"));
				hour = getValue(b.time.find("select.cron-time-hour"));
                break;

            case "week":
				min = getValue(b.time.find("select.cron-time-min"));
				hour = getValue(b.time.find("select.cron-time-hour"));
				dow = getValue(b.dow.find("select"));
                break;

            case "month":
				min = getValue(b.time.find("select.cron-time-min"));
				hour = getValue(b.time.find("select.cron-time-hour"));
				day = getValue(b.dom.find("select"));
                break;

            case "year":
				min = getValue(b.time.find("select.cron-time-min"));
				hour = getValue(b.time.find("select.cron-time-hour"));
				day = getValue(b.dom.find("select"));
				month = getValue(b.month.find("select"));
                break;

            default:
                // we assume this only happens when customValues is set
                return selectedPeriod;
        }
        return [min, hour, day, month, dow].join(" ");
    }

	function getValue(items){
		var value;

		if(items.length > 1){
			value = [];
			items.each(function(i, item){
				value.push($(item).val());
			});
			return value.join(',');
		}else{
			return items.val();
		}
	}

	function updateSelectLists(elements, value){
		$.each(elements, function(i, select){
			$(select).val(value[i])
				.gentleSelect('update');
		});
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
                timeMinuteOpts : $.extend({}, defaults.timeMinuteOpts, eo, options.timeMinuteOpts),
				multiFrequency : (options.multiFrequency ? options.multiFrequency : defaults.multiFrequency),
				frequencyOpts  : (options.frequencyOpts ? options.frequencyOpts : defaults.frequencyOpts)
            });

            // error checking
            if (hasError(this, o)) { return this; }

            // ---- define select boxes in the right order -----

            var block = [], custom_periods = "", cv = o.customValues;
            if (defined(cv)) { // prepend custom values if specified
                for (var key in cv) {
					if (cv.hasOwnProperty(key)) {
						custom_periods += "<option value='" + cv[key] + "'>" + key + "</option>\n";
					}
                }
            }

			if(o.multiFrequency){
				// Build select for frequency
				var str_opt_frequency = "";
				for (var i in o.frequencyOpts){
					if (o.frequencyOpts.hasOwnProperty(i)) {
						str_opt_frequency += "<option value='"+i+"'>" + o.frequencyOpts[i] + "</option>\n";
					}
				}

				block.frequency = $("<span class='cron-frequency'>"
						+ "<select name='cron-frequency'>"
						+ str_opt_frequency + "</select> per </span>")
					.appendTo(this)
					.find("select")
						.bind("change.cron", event_handlers.frequencyChanged)
						.data("root", this)
						.gentleSelect(eo)
						.end();
			}

            block.period = $("<span class='cron-period'>"
                    + "<select name='cron-period'>" + custom_periods
                    + str_opt_period + "</select> </span>")
                .appendTo(this)
                .find("select")
                    .bind("change.cron", event_handlers.periodChanged)
                    .data("root", this)
                    .gentleSelect(eo)
                    .end();

            block.dom = $("<span class='cron-block cron-block-dom'>"
                    + " on the <select name='cron-dom'>" + str_opt_dom
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.domOpts)
                    .data("root", this)
                    .end();

            block.month = $("<span class='cron-block cron-block-month'>"
                    + " of <select name='cron-month'>" + str_opt_month
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.monthOpts)
                    .data("root", this)
                    .end();

            block.mins = $("<span class='cron-block cron-block-mins'>"
                    + " at <select name='cron-mins'>" + str_opt_mih
                    + "</select> minutes past the hour </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.minuteOpts)
                    .data("root", this)
                    .end();

            block.dow = $("<span class='cron-block cron-block-dow'>"
                    + " on <select name='cron-dow'>" + str_opt_dow
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this)
                .find("select")
                    .gentleSelect(o.dowOpts)
                    .data("root", this)
                    .end();

            block.time = $("<span class='cron-block cron-block-time'>"
                    + " at <select name='cron-time-min' class='cron-time-min'>" + str_opt_mih
					+ "</select> minutes past <select name='cron-time-hour' class='cron-time-hour'>" + str_opt_hid
                    + "</select></span>")
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

            block.controls = $("<span class='cron-controls'>&laquo; save "
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

            return methods.value.call(this, o.initial); // set initial value
        },
        value : function(cron_str) {
            // when no args, act as getter
            if (!cron_str) { return getCurrentValue(this); }

            var t = getCronType(cron_str);
            if (!defined(t)) { return false; }

            var block = this.data("block");
			var options = this.data("options");
            var d = cron_str.split(" ");
            var v = {
                "mins"  : d[0],
                "hour"  : d[1],
                "dom"   : d[2],
                "month" : d[3],
                "dow"   : d[4]
            };

			var multi_test_loc = {
				"minute"	: '',
				"hour"		: {value:v.mins, name:'mins'},
				"day"		: {value:v.hour, name:'hour'},
				"week"		: {value:v.dow, name:'dow'},
				"month"		: {value:v.dom, name:'dom'},
				"year"		: {value:v.month, name:'month'}
			};

            // trigger change event
            block.period.find("select")
                .val(t)
                .gentleSelect("update")
                .trigger("change");

			if(options.multiFrequency){
				var multi = multi_test_loc[t].value.replace(/(^,)|(,$)/g, "");
				if(multi.indexOf(',') >= 0){
					var multi_vals = multi.split(',');

					v[multi_test_loc[t].name] = multi_vals;

					block.frequency
						.find('select')
							.val(multi_vals.length)
							.gentleSelect("update")
							.triggerHandler('change');
				}
			}

            // update appropriate select boxes
            var targets = toDisplay[t];
            for (var i = 0; i < targets.length; i++) {
                var tgt = targets[i];
                if (tgt === "time") {
					updateSelectLists(block[tgt].find("select.cron-time-hour"), v.hour);
					updateSelectLists(block[tgt].find("select.cron-time-min"), v.mins);
                } else {
					updateSelectLists(block[tgt].find("select"), v[tgt]);
                }
            }

            return this;
        }
    };

	var xevent_handlers = {};

    var event_handlers = {
        frequencyChanged : function() {
            var $self = $(this),
				root = $self.data("root"),
				frequency = $self.val(),
				opt, tmp_block, tmp_source, tmp_source_html,
				options, spanClass;

			// todo: disable minute for frequency > 1

			root.find('.frequency-block').remove(); // remove any clones

			if(frequency > 0){
				opt = root.data("options");

				switch(root.find('select[name="cron-period"]').val()){
					case 'minute':
						return; // no need to do anything here. Go ahead and return. This shouldn't even be allowed.
					case 'hour':
						tmp_source = root.find('select[name="cron-mins"]').first();
						options = opt.minuteOpts;
						spanClass = 'mins';
						break;
					case 'day':
						tmp_source = root.find('select[name="cron-time-hour"]').first();
						options = opt.timeHourOpts;
						spanClass = 'hour';
						break;
					case 'week':
						tmp_source = root.find('select[name="cron-dow"]').first();
						options = opt.dowOpts;
						spanClass = 'dow';
						break;
					case 'month':
						tmp_source = root.find('select[name="cron-dom"]').first();
						options = opt.domOpts;
						spanClass = 'dom';
						break;
					case 'year':
						tmp_source = root.find('select[name="cron-month"]').first();
						options = opt.monthOpts;
						spanClass = 'month';
						break;
				}
				tmp_block = $('<span class="frequency-block" />').insertAfter(tmp_source);
				tmp_source_html = tmp_source.clone().wrap('<div>').parent().html();

				for(var i=frequency; i>1; i--){
					$(
						'<span class="cron-block cron-block-'+spanClass+'">'
						+ (i === 2 ? ' and ' : ', ')
						+ tmp_source.clone().wrap('<div>').parent().html()
						+ "</span>"
					)
					.appendTo(tmp_block)
					.find("select")
						.data("root", root)
						.bind("change.cron-callback", event_handlers.somethingChanged)
						.gentleSelect(options)
						.end();
				}
			}
			return true;
        },
		periodChanged : function() {
            var root = $(this).data("root");
            var block = root.data("block"),
                opt = root.data("options");
            var period = $(this).val();
            root.find("span.cron-block").hide(); // first, hide all blocks
			root.find('.frequency-block').remove(); // remove any clones

            if (toDisplay.hasOwnProperty(period)) { // not custom value
                var b = toDisplay[$(this).val()];
                for (var i = 0; i < b.length; i++) {
                    block[b[i]].show();
                }
            }

			root.find('select[name="cron-frequency"]').first().trigger('change.cron');
        },

        somethingChanged : function() {
            var root = $(this).data("root");

            // if AJAX url defined, show "save"/"reset" button
            if (defined(root.data("options").url_set)) {
                if (methods.value.call(root) !== root.data("current_value")) { // if changed
                    root.addClass("cron-changed");
                    root.data("block").controls.fadeIn();
                } else { // values manually reverted
                    root.removeClass("cron-changed");
                    root.data("block").controls.fadeOut();
                }
            } else {
                root.data("block").controls.hide();
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
                    if (cron_str === methods.value.call(root)) {
                        root.removeClass("cron-changed");
                        root.data("block").controls.fadeOut();
                    }
                },
                error : function() {
                    window.alert("An error occured when submitting your request.");
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

}(jQuery));
