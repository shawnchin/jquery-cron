# jQuery plugin: cron

jquery-cron is a [jQuery] plugin for 
presenting a simplified interface for users to specify cron entries.

Check out the [jquery-cron] website for more information.

This plugin was developed to fulfil the requirements that arose
from the [BBotUI Project].
As such, while we do try to make the implementation as generic
as possible, we dare not claim this plugin to be as flexible
as one would expect a sensible jQuery plugin to be.

There is much to be done on the flexibility and robustness front, 
and we welcome contributions and bug fixes. Feel free to fork 
and send us pull requests!

## Dependencies

 * [jQuery]
 * [jquery-gentleSelect]

## Usage

To use this plugin, one simply needs to load [jQuery], [jquery-gentleSelect] 
and the JS/CSS scripts for jquery-cron, then attach it an empty `<DIV>`
on DOM ready:

    $(document).ready(function() {
        $('#selector').cron();
    });
    </script>

For more options, see the [jquery-cron] website.


## Others

Copyright (c) 2010, Shawn Chin.

This project is licensed under the [MIT license].

 [jQuery]: http://jquery.com "jQuery"
 [jquery-cron]: http://shawnchin.github.com/jquery-cron "jquery-cron"
 [BBotUI Project]: https://github.com/shawnchin/bbotui "BBotUI project"
 [jquery-gentleSelect]: http://shawnchin.github.com/jquery-gentleSelect "jquery-gentleSelect"
 [MIT License]: http://www.opensource.org/licenses/mit-license.php "MIT License"
