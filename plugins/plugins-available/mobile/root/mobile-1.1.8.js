/* create the jquery mobile object */
jQuery(document).bind("mobileinit", function(){
    jQuery.mobile.page.prototype.options.backBtnText      = "back";
    jQuery.mobile.page.prototype.options.addBackBtn       = true;

    // theme?
    var theme = readCookie('thruk_mtheme');
    if(theme != undefined) {
        set_theme(theme);
    } else {
        set_theme('d');
    }

});

/* initialize all events */
jQuery(document).ready(function(e){
    /* refresh button on start page */
    jQuery("#refresh").bind( "vclick", function(event, ui) {
        refresh_host_status(true);
        refresh_service_status(true);
        return false;
    });

    /* bind option theme button */
    jQuery("A.theme_button").bind("vclick", function(event, ui) {
        var now         = new Date();
        var expires     = new Date(now.getTime() + (10*365*86400*1000)); // let the cookie expire in 10 years
        document.cookie = "thruk_mtheme=" + this.dataset.theme + "; path=/; expires=" + expires.toGMTString() + ";";
        window.location.reload();
    });

    /* bind full client button */
    jQuery("A#full_client_link").bind("vclick", function(event, ui) {
        document.cookie = "thruk_mobile=0; path=/;";
        window.location.assign(url_prefix + 'thruk/');
    });

    /* Options */
    jQuery('#options').bind('pageshow', function(event, info){
        page_options();
    });

    /* Last Alerts */
    jQuery('#last_alerts').bind('pageshow', function(event, info){
        page_alerts();
    });

    /* Last Notifications */
    jQuery('#last_notification').bind('pageshow', function(event, info){
        page_notifications();
    });

    /* Services List */
    jQuery('#services_list').bind('pageshow', function(event, info){
        page_services_list();
    });

    /* Hosts List */
    jQuery('#hosts_list').bind('pageshow', function(event, data){
        page_hosts_list();
    });

    /* Host */
    jQuery('#host').bind('pageshow', function(event, data){
        page_host();
    });

    /* Service */
    jQuery('#service').bind('pageshow', function(event, data){
        page_service();
    });

    /* Home */
    jQuery('#home').bind('pageshow', function(event, data){
        page_home();
    });

    /* set selected backends for options page */
    jQuery('.backend_checkbox').bind('change', function(event){
        var backend = event.target.name;
        if(event.target.checked) {
            current_backend_states[backend] = 0;
        } else {
            current_backend_states[backend] = 2;
        }
    });
    jQuery('#options_save').bind('vclick', function(event){
        var serialized = "";
        for(var key in current_backend_states){
            state = 2;
            if(jQuery("#backend_"+key).attr("checked")) {
                state = 0;
            }
            serialized += '&'+key+'='+state;
        };
        serialized = serialized.substring(1);
        document.cookie = "thruk_backends="+serialized+ "; path=/;";
    });

    /* refresh problems */
    jQuery('#problems').bind('pageshow', function(event, data){
        page_problems();
    });

    /* refresh list of hosts */
    jQuery('#hosts').bind('pageshow', function(event, data){
        page_hosts();
    });

    /* refresh list of services */
    jQuery('#services').bind('pageshow', function(event, data){
        page_services();
    });

    /* initialize numbers */
    refresh_host_status();
    refresh_service_status();

    /* hide notice about fullscreen mode */
    if(window.navigator.standalone == true) {
        jQuery('#fullscreenteaser').hide();
    }
});


/* send debug output to firebug console */
function debug(str) {
    if (window.console != undefined) {
        console.debug(str);
    }
}

/* return host status text */
function get_host_status(host) {
    if(host.has_been_checked == 0) { return("PENDING"); }
    if(host.state == 0) { return("UP"); }
    if(host.state == 1) { return("DOWN"); }
    if(host.state == 2) { return("UNREACHABLE"); }
}

/* return host status class */
function get_host_class(host) {
    if(host.has_been_checked == 0) { return("hostPENDING"); }
    return(get_host_class_for_state(host.state));
}

/* return host status class */
function get_host_class_for_state(state) {
    if(state == 0) { return("hostUP"); }
    if(state == 1) { return("hostDOWN"); }
    if(state == 2) { return("hostUNREACHABLE"); }
    if(state == 3) { return("hostPENDING"); }
}

/* return service status text */
function get_service_status(service) {
    if(service.has_been_checked == 0) { return("PENDING"); }
    if(service.state == 0) { return("OK"); }
    if(service.state == 1) { return("WARNING"); }
    if(service.state == 2) { return("CRITICAL"); }
    if(service.state == 3) { return("UNKNOWN"); }
}

/* return service status class */
function get_service_class(service) {
    if(service.has_been_checked == 0) { return("servicePENDING"); }
    return(get_service_class_for_state(service.state));
}

/* return service status class */
function get_service_class_for_state(state) {
    if(state == 0) { return("serviceOK"); }
    if(state == 1) { return("serviceWARNING"); }
    if(state == 2) { return("serviceCRITICAL"); }
    if(state == 3) { return("serviceUNKNOWN"); }
    if(state == 4) { return("servicePENDING"); }
    alert('unknown state' +  state);
}

function unixtime() {
    var d = new Date();
    return(d.getTime());
}

/* set theme */
function set_theme(theme) {
    jQuery.mobile.page.prototype.options.backBtnTheme     = theme;
    jQuery.mobile.page.prototype.options.headerTheme      = theme;
    jQuery.mobile.page.prototype.options.contentTheme     = theme;
    jQuery.mobile.page.prototype.options.footerTheme      = theme;

    jQuery.mobile.listview.prototype.options.headerTheme  = theme;
    jQuery.mobile.listview.prototype.options.theme        = theme;
    jQuery.mobile.listview.prototype.options.dividerTheme = theme;

    jQuery.mobile.listview.prototype.options.splitTheme   = theme;
    jQuery.mobile.listview.prototype.options.countTheme   = theme;
    jQuery.mobile.listview.prototype.options.filterTheme  = theme;
}

/* set hosts status */
var last_host_refresh = 0;
var unhandled_host_problems = 0;
function refresh_host_status(force, update_backends) {
    if(force           == undefined) { force           = false; }
    if(update_backends == undefined) { update_backends = false; }
    var date = new Date;
    var now  = parseInt(date.getTime() / 1000);
    if(force == false && now < last_host_refresh + 15) {
        return false;
    }
    last_host_refresh = now;

    ['up', 'down', 'unreachable', 'pending', 'down_and_unhandled', 'unreachable_and_unhandled', 'unhandled' ].forEach(function(el){
        jQuery('.hosts_'+el+'_panel').hide();
    });

    jQuery.get('mobile.cgi', { data: 'host_stats', _:unixtime() },
        function(data, textStatus, XMLHttpRequest) {
            extract_data(data);
            data = data.data;
            ['up', 'down', 'unreachable', 'pending', 'total', 'down_and_unhandled', 'unreachable_and_unhandled'].forEach(function(el){
                var val = eval("data."+el);
                jQuery('.hosts_'+el).text(val)
                if(val > 0) { jQuery('.hosts_'+el+'_panel').show(); }
            });
            unhandled_host_problems = data.down_and_unhandled + data.unreachable_and_unhandled;
            jQuery('.hosts_unhandled').text('Host:' + unhandled_host_problems);
            jQuery('.hosts_unhandled_panel').hide();
            if(unhandled_host_problems > 0) {
                jQuery('.hosts_unhandled_panel').show();
            }
            if(update_backends) {
                refresh_backends();
            }
            if(unhandled_service_problems + unhandled_host_problems > 0) {
                jQuery('.no_problems').hide();
            } else {
                jQuery('.no_problems').show();
            }
        },
    'json');
}

/* set service status */
var last_service_refresh = 0;
var unhandled_service_problems = 0;
function refresh_service_status(force) {
    if(force == undefined) { force = false; }
    var date = new Date;
    var now  = parseInt(date.getTime() / 1000);
    if(force == false && now < last_service_refresh + 15) {
        return false;
    }
    last_service_refresh = now;

    ['ok', 'warning', 'critical', 'unknown', 'pending', 'unhandled', 'critical_and_unhandled', 'unknown_and_unhandled'].forEach(function(el){
        jQuery('.services_'+el+'_panel').hide();
    });
    jQuery.get('mobile.cgi', { data: 'service_stats', _:unixtime() },
        function(data, textStatus, XMLHttpRequest) {
            extract_data(data);
            data = data.data;
            ['ok', 'warning', 'critical', 'unknown', 'pending', 'total', 'critical_and_unhandled', 'unknown_and_unhandled'].forEach(function(el){
                var val = eval("data."+el);
                jQuery('.services_'+el).text(val)
                if(val > 0) { jQuery('.services_'+el+'_panel').show(); }
            });
            unhandled_service_problems = data.critical_and_unhandled + data.unknown_and_unhandled;
            jQuery('.services_unhandled').text('Service:' + unhandled_service_problems);
            jQuery('.services_unhandled_panel').hide();
            if(unhandled_service_problems > 0) {
                jQuery('.services_unhandled_panel').show();
            }
            if(unhandled_service_problems + unhandled_host_problems > 0) {
                jQuery('.no_problems').hide();
            } else {
                jQuery('.no_problems').show();
            }
        },
    'json');
}

function refresh_backends() {
    if(current_backend_states != undefined) {
        number=0;
        for(var key in current_backend_states){
            number++;
            if(current_backend_states[key].state == 0 || current_backend_states[key].state == 1) {
                jQuery("#backend_"+key).attr("checked",true).checkboxradio("refresh");
            }
            if(current_backend_states[key].state == 1) {
                jQuery("#b_lab_"+key).addClass('hostDOWN');
            }
        };
        if(number > 1) {
            jQuery('#backend_chooser').show();
        }
    } else {
        jQuery('#backend_chooser').hide();
    }
}


/* set concetion status from data connection */
function extract_data(data) {
    current_backend_states = data.connection_status;
    return;
}

/* Options Page */
function page_options() {
    jQuery('.waiting').show();
    if(current_backend_states == undefined) {
        refresh_host_status(true, true);
    } else {
        refresh_backends();
    }
    jQuery('.waiting').hide();
}

/* Alert List Page */
function page_alerts(page) {
    page = list_pager_init(page, 'alerts_list');
    jQuery.get('mobile.cgi', {
            data: 'alerts'
        },
        function(data, textStatus, XMLHttpRequest) {
            list_pager_data(page, data, 'alerts_list', function() { page_alerts(++page); }, function(entry) {
                var listitem = '';
                if(entry.service_description) {
                    listitem = '<li class="'+get_service_class_for_state(entry.state)+'">';
                } else {
                    listitem = '<li class="'+get_host_class_for_state(entry.state)+'">';
                }
                var message = entry.message.substring(13);
                message = message.replace(entry.type+':', '');
                if(message.length > 60) {
                    message = message.substring(0,60) + '...';
                }
                listitem += '<span class="logdate">' + entry.formated_time + '<\/span>';
                listitem += '<span class="logtype">' + entry.type + '<\/span>';
                listitem += '<br><span class="logmsg">' + message + '<\/span><\/li>';
                jQuery('#alerts_list').append(listitem);
            });
        },
        'json'
    );
}

/* Notifications Page */
function page_notifications(page) {
    page = list_pager_init(page, 'notification_list');
    jQuery.get('mobile.cgi', {
            data: 'notifications'
        },
        function(data, textStatus, XMLHttpRequest) {
            list_pager_data(page, data, 'notification_list', function() { page_notifications(++page); }, function(entry) {
                if(entry.service_description) {
                    jQuery('#notification_list').append('<li class="'+get_service_class_for_state(entry.state)+'"><span class="date">' + entry.formated_time + '</span><br>' + entry.host_name+' - '+ entry.service_description +'</li>');
                } else {
                    jQuery('#notification_list').append('<li class="'+get_host_class_for_state(entry.state)+'"><span class="date">' + entry.formated_time + '</span><br>' + entry.host_name+'</li>');
                }
            });
        },
        'json'
    );
}

/* Services List Page */
function page_services_list(page) {
    page       = list_pager_init(page, 'services_list_data');
    var params = get_params();
    jQuery.get('mobile.cgi', {
            data:               'services',
            servicestatustypes: params['servicestatustypes'],
            serviceprops:       params['serviceprops'],
            hoststatustypes:    params['hoststatustypes'],
            page:               page,
            _:                  unixtime()
        },
        function(data, textStatus, XMLHttpRequest) {
            list_pager_data(page, data, 'services_list_data', function() { page_services_list(++page); }, function(entry) {
                jQuery('#services_list_data').append('<li class="'+get_service_class(entry)+'"><a href="#service?host='+entry.host_name+'&service='+entry.description+'" data-ajax="false">' + entry.host_name+' - '+ entry.description +'</a></li>');
            });
        },
        'json'
    );
}

/* Hosts List Page */
function page_hosts_list(page) {
    page       = list_pager_init(page, 'hosts_list_data');
    var params = get_params();
    jQuery.get('mobile.cgi', {
            data:           'hosts',
            hoststatustypes: params['hoststatustypes'],
            hostprops:       params['hostprops'],
            page:            page,
            _:               unixtime()
        },
        function(data, textStatus, XMLHttpRequest) {
            list_pager_data(page, data, 'hosts_list_data', function() { page_hosts_list(++page); }, function(entry) {
                jQuery('#hosts_list_data').append('<li class="'+get_host_class(entry)+'"><a href="#host?host='+entry.name+'" data-ajax="false">' + entry.name +'</a></li>');
            });
        },
        'json'
    );
}

/* Host Page */
function page_host() {
    var params = get_params();
    hide_common_extinfo('host');
    jQuery.get('mobile.cgi', {
            data: 'hosts',
            host: params['host'],
            _:    unixtime()
        },
        function(data, textStatus, XMLHttpRequest) {
            var host = show_common_extinfo('host', data);
            if(host != undefined) {
                jQuery('#host_name').text(host.name);
                jQuery('#host_state').removeClass().text(get_host_status(host)).addClass(get_host_class(host));
                jQuery('#host_referer').val('mobile.cgi#host?host='+host.name);
                show_common_acks_n_downtimes('host', host, data.comments_by_host[host.name]);
            }
        },
        'json'
    );
}

/* Service Page */
function page_service() {
    hide_common_extinfo('service');
    var params = get_params();
    jQuery.get('mobile.cgi', {
            data: 'services',
            host: params['host'],
            service: params['service'],
            _:unixtime()
        },
        function(data, textStatus, XMLHttpRequest) {
            var service = show_common_extinfo('service', data);
            if(service != undefined) {
                jQuery('#service_name').html(service.host_name + '<br>' + service.description);
                jQuery('#service_state').removeClass().text(get_service_status(service)).addClass(get_service_class(service));
                jQuery('#service_referer').val('mobile.cgi#service?host='+service.host_name+'&service='+service.description);
                show_common_acks_n_downtimes('service', service, data.comments_by_host_service[service.host_name][service.description]);
            }
        },
        'json'
    );
}

/* Home Page */
function page_home() {
    refresh_host_status();
    refresh_service_status();
}

/* Problems Page */
function page_problems() {
    refresh_host_status();
    refresh_service_status();
    jQuery('DIV#problems UL.hosts_by_status_list').listview('refresh');
    jQuery('DIV#problems UL.services_by_status_list').listview('refresh');
}

/* Hosts Page */
function page_hosts() {
    refresh_host_status();
    jQuery('DIV#hosts .hosts_by_status_list').listview('refresh');
}

/* Services Page */
function page_services() {
    refresh_service_status();
    jQuery('DIV#services .services_by_status_list').listview('refresh');
}

/* get cookie value */
function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

/* return parameter from url */
function get_params() {
    var str    = document.location.hash;
    str        = str.replace(/#+.*\?/, '');
    var params = {};
    jQuery(str.split('&')).each(function(x, s) {
        p = s.split('=');
        params[p[0]] = p[1];
    });
    return(params);
}

/* initialize list */
function list_pager_init(page, list) {
    if(page == undefined) { page = 1; }
    if(page == 1) {
        jQuery('#'+list).children().remove();
    } else {
        jQuery('.more').remove();
    }
    jQuery.mobile.showPageLoadingMsg();
    jQuery('#'+list).listview('refresh');
    return page;
}

/* paged list items */
function list_pager_data(page, data, list, more_callback, row_callback) {
    extract_data(data);
    if(page == 1) {
        jQuery('#'+list).children().remove();
    } else {
        jQuery('.more').remove();
    }
    jQuery.mobile.hidePageLoadingMsg();
    jQuery.each(data.data, function(index, entry) {
        row_callback(entry);
    });
    if(data.more != undefined) {
        jQuery('#'+list).append('<li data-icon="false" class="more"><a href="#">more...</a></li>');
        jQuery('.more').bind('vclick', more_callback);
    }
    jQuery('#'+list).listview('refresh');
}

// hide elements from extinfo pages
function hide_common_extinfo(typ) {
    jQuery.mobile.showPageLoadingMsg();
    ['attempt', 'name', 'state', 'duration', 'exec_time', 'last_check', 'next_check', 'check_type', 'plugin_output', 'current_notification_number'].forEach(function(el){
        jQuery('#'+typ+'_'+el).text('');
    });
    ['ack_form', 'acknowledged', 'downtime'].forEach(function(el){
        jQuery('.'+typ+'_'+el).hide();
    });
}

// show common elements from extinfo pages
function show_common_extinfo(typ, data, comments) {
    extract_data(data);
    jQuery.mobile.hidePageLoadingMsg();
    var obj = data.data[0];
    if(obj != undefined) {
        var state_type = "SOFT";
        if(obj.state_type == 1) { state_type = "HARD"; }
        jQuery('#'+typ+'_attempt').text(obj.current_attempt + '/' + obj.max_check_attempts + '  (' + state_type + ' state)');
        jQuery('#'+typ+'_duration').text(obj.duration);
        jQuery('#'+typ+'_exec_time').text(Math.round(obj.execution_time*1000)/1000 + 's');
        if(obj.last_check > 0) {
            jQuery('#'+typ+'_last_check').text(obj.format_last_check);
        } else {
            jQuery('#'+typ+'_last_check').text('never');
        }
        if(obj.next_check > 0) {
            jQuery('#'+typ+'_next_check').text(obj.format_next_check);
        } else {
            jQuery('#'+typ+'_next_check').text('N/A');
        }
        if(obj.check_type == 0) {
            jQuery('#'+typ+'_check_type').text('ACTIVE');
        } else {
            jQuery('#'+typ+'_check_type').text('PASSIVE');
        }
        jQuery('#'+typ+'_plugin_output').text(obj.plugin_output);
        jQuery('#'+typ+'_current_notification_number').text(obj.current_notification_number);
        if(obj.acknowledged == 0 && obj.state > 0) {
            jQuery('.'+typ+'_ack_form').show();
        }
        return obj;
    }
    return undefined;
}

function show_common_acks_n_downtimes(typ, obj, comments) {
    // Acknowledgements
    if(obj.acknowledged == 1) {
        var txt = '';
        jQuery('.'+typ+'_acknowledged').show();
        jQuery(comments).each(function(nr, com) {
            if(com.entry_type == 4) {
                txt = com.author + ': ' + com.comment + '<br>';
            }
        });
        jQuery('#'+typ+'_ack').html('<img src="' + url_prefix + 'thruk/plugins/mobile/img/ack.gif" alt="acknowledged"> ' + txt);
    }
    if(typ == 'host') {
        jQuery('#selected_hosts').val(obj.name);
    }
    if(typ == 'service') {
        jQuery('#selected_services').val(obj.host_name+';'+obj.description);
    }
    // Downtimes
    if(obj.scheduled_downtime_depth > 0) {
        jQuery('.'+typ+'_downtime').show();
        var txt = '';
        jQuery(comments).each(function(nr, com) {
            if(com.entry_type == 2) {
                txt = com.author + ': ' + com.comment + '<br>';
            }
        });
        jQuery('#'+typ+'_downtime').html('<img src="' + url_prefix + 'thruk/plugins/mobile/img/downtime.gif" alt="acknowledged"> ' + txt);
    }
}
