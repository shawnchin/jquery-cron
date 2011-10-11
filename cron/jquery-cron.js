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
        url_set : undefined,
        onChange: undefined, // callback function each time value changes
        extraValues: undefined
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
    var days = ["Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday", "Sunday"];
    for (var i = 0; i < days.length; i++) {
        str_opt_dow += "<option value='"+i+"'>" + days[i] + "</option>\n"; 
    }

    // options for period
    var str_opt_period = "";
    var periods = ["minute", "hour", "day", "week", "month",/* "year"*/];
   
    
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
        "minute" : /^(\*\s){4}\*$/,               // "* * * * *"
        "hour"   : /^\d{1,2}\s(\*\s){3}\*$/,      // "? * * * *"
        "day"    : /^(\d{1,2}\s){2}(\*\s){2}\*$/, // "? ? * * *"
        "week"   : /^(\d{1,2}\s){2}(\*\s){2}\d{1,2}$/, // "? ? * * ?"
        "month"  : /^(\d{1,2}\s){3}\*\s\*$/, // "? ? ? * *"
        "year"   : /^(\d{1,2}\s){4}\*$/ // "? ? ? ? *"
    };

    // ------------------ internal functions ---------------
    function defined(obj) {
        if (typeof obj == "undefined") { return false; }
        else { return true; }
    }

    function getCronType(cron_str) {
        // check format of initial cron value
        var valid_cron = /^((\d{1,2}|\*)\s){4}(\d{1,2}|\*)$/
        if (typeof cron_str != "string" || !valid_cron.test(cron_str)) {
            $.error("cron: invalid initial value");
            return undefined;
        }
        // check actual cron values
        var d = cron_str.split(" ");
        //            mm, hh, DD, MM, DOW
        var minval = [ 0,  0,  1,  1,  0];
        var maxval = [59, 23, 31, 12,  6];
        for (var i = 0; i < d.length; i++) {
            if (d[i] == "*") continue;
            var v = parseInt(d[i]);
            if (defined(v) && v <= maxval[i] && v >= minval[i]) continue;

            $.error("cron: invalid value found (col "+(i+1)+") in " + o.initial);
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
        if( findExtraValueIndex(o) >=0) {return false;}
        if (!defined(getCronType(o.initial))) { return true; }
        return false;
    }

    function getCurrentValue(c) {
    	
        var b = c.data("block");
  
        var min = hour = day = month = dow = "*";
        
        var select=b["period"].find("select");
        var sel=select.val();
        var extraVal = select.data("newVal");
        if (extraVal)
        	sel=extraVal;
        select.removeData("newVal");
        switch (sel) {
        	
        	case "hour":
                min = b["mins"].find("select").val();
                break;

            case "day":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                break;

            case "week":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                dow  =  b["dow"].find("select").val();
                break;

            case "month":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                break;

            case "year":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                month = b["month"].find("select").val();
                break;
            default:	
            	var opts= c.data('options');
            	 if(opts.extraValues)
        		 {
	            	 for (var i = 0; i < opts.extraValues.length; i++) {	
	                 	if(	opts.extraValues[i][0] == sel)
	                 		return opts.extraValues[i][1];
	                 }
        		 }
        		break;
        }
        return [min, hour, day, month, dow].join(" ");
    }
    
    function findExtraValueIndex(o)
    {
   //   linspect(o.extraValues);
       if(o.extraValues)
     	{
	            for (var i = 0; i < o.extraValues.length; i++) 
	            {	
		            if (o.initial == o.extraValues[i][1])
	         		{
		            		return i;
	         		}
	            }
     	}
       return -1;
    	
    }

    // -------------------  PUBLIC METHODS -----------------

    var methods = {
        init : function(options) {
   
            // init options
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
            
            //extra vals
            var extraVal=null;
            var extraValIndx = findExtraValueIndex(o);
            if(extraValIndx>=0)
            	extraVal=o.extraValues[extraValIndx];
          
            if(o.extraValues)
        	{
	            for (var i = 0; i < o.extraValues.length; i++) 
	            {
	            	var newVal=o.extraValues[i][0];
	            	if(jQuery.inArray(newVal,periods) == -1)
	            		periods.push(newVal);
	            	
	            	//TODO FIXME this will build up forever
	            	toDisplay[newVal]=new Array();
	            }
        	}
            str_opt_period ="";
            for (var i = 0; i < periods.length; i++) 
            {
            	var selected='';
            	
            	if (i == extraValIndx)
            		{
            	//	log(i +" : "+extraValIndx);
            	//	selected="selected='selected'";
            		}
                str_opt_period += "<option value='"+periods[i]+"' "+selected+">" + periods[i] + "</option>\n";  
            }
            
            
        	
            // ---- define select boxes in the right order -----
           // str_opt_period="";
            var block = []
            block["period"] = $("<span class='cron-period'>"
                    + "Every <select name='cron-period'>" + str_opt_period 
                    + "</select> </span>")
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
  
            
          
         
            return methods["value"].call(this, o.initial, extraVal); // set initial value
           // else return this;
        },

        value : function(cron_str, extraVal) {
        	var t;
        	// when no args, act as getter
            if (!cron_str) { return getCurrentValue(this); }

            if (extraVal )
            	t=extraVal[0];
            else t = getCronType(cron_str);
            
           // log(t);
            if (!defined(t)) { return false; }

            var block = this.data("block");
            var d = cron_str.split(" ");
            var v = {
                "mins"  : d[0],
                "hour"  : d[1],
                "dom"   : d[2],
                "month" : d[3],
                "dow"   : d[4]
            };

         //   linspect(t);
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
          //  log(extraVal[0]);
            if( extraVal )
            	t = extraVal[0];
           
           // log(t);
            // trigger change event
            var select=block["period"].find("select");
            select.val(t).gentleSelect("update");
           
            if(extraVal)//this was needed as the onchange events didn't respect the new vals immediately
            	select.data('newVal',t)
        	else select.removeData('newVal');
            
            var e = jQuery.Event("change");
            select.trigger(e);

            return this;
        }

    };

    var event_handlers = {
        periodChanged : function() {
            var root = $(this).data("root");
            var block = root.data("block");
            var b = toDisplay[$(this).val()];
            
            root.find("span.cron-block").hide(); // first, hide all blocks      
            if(b)
        	{
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
