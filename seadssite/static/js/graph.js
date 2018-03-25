"use strict";

var c3 = require('c3');

var HOUR_SECONDS = 60 * 60;
var DAY_SECONDS = HOUR_SECONDS * 24;

var GREEN = '#60B044';
var YELLOW = '#F6C600';
var ORANGE = '#F97600';
var RED = '#FF0000';


function post_data_to_server(label) {
    console.log("Sending " + JSON.stringify(label));

    var post = new XMLHttpRequest();

    // device ID is 3rd entry in url seperatered by a '/'
    var pathArray = window.location.pathname.split('/');
    var deviceId = pathArray[2];
    var url = "http://db.sead.systems:8080/" + deviceId + "/label";
    var params = JSON.stringify({data: label});
    post.open("POST", url, true);

    post.setRequestHeader("Content-type", "text/plain");
    post.setRequestHeader("Content-length", params.length);
    post.setRequestHeader("Connection", "close");

    post.onreadystatechange = function () {
        if (post.readyState == XMLHttpRequest.DONE) {
            if (post.status == 200) { //200 OK
                console.log("Response:");
                console.log(post.responseText);
            } else {
                console.log("it broke");
            }
        }
    }
    post.send(params);
}

// Returns an array of api calls for all non solar panels
function non_solar_urls(start, end, gran) {
    var urls = [];
    for (var key in device_info) {
        if (!device_info[key].solar) {
            urls.push(create_url(start, end, gran, key));
        }
    }
    return urls;
}


function create_url(start, end, gran, panel) {
    if (gran) {
        var granularity = gran;
    } else {
        var num_nodes = 150;
        var granularity = Math.ceil((end - start) / num_nodes);
    }

    // device ID is 3rd entry in url seperatered by a '/'
    var pathArray = window.location.pathname.split('/');
    var deviceId = pathArray[2];

    return "http://db.sead.systems:8080/" + deviceId + "?start_time=" + start + "&end_time="
        + end + "&list_format=energy&type=P&device=" + panel + "&granularity=" + granularity;
}

// Pull data for the last hour every minute
function live_data() {
    var end = Math.floor(Date.now() / 1000);
    var start = end - HOUR_SECONDS;
    pick_date(start, end);
}

function end_live_data() {
    if (JSON.parse($("#live-button").attr("aria-pressed"))) {
        $("#live-button").attr("aria-pressed", false);
        $("#live-button").button("toggle");
    }
    clearInterval(liveTimer);
    liveTimer = null;
}

// Generate urls for all panels and generates chart
function pick_date(start, end) {
    var gran = 0;
    var urls = [];
    var panels = [];
    for (var key in device_info) {
        panels.push(key);
    }
    for (var i = 0; i < panels.length; i++) {
        urls[i] = create_url(start, end, gran, panels[i]);
    }
    fetch_aggregate(urls, generate_chart, true, panels);
}

function fetch_aggregate(urls, callback, separate, panels) {
    if (!separate) separate = false;
    var responses = [];
    var splitUrl = urls[0].split("=");
    var gran = splitUrl[6];

    var onCompleted = function () {
        for (var i = 0; i < urls.length; i++) {
            if (responses[i] == null) return;
        }
        if (separate) {
            if (callback == generate_chart) {
                callback(responses, gran, panels);
            } else {
                callback(responses);
            }
        } else {
            var dat = JSON.parse(responses[0]).data;
            for (var i = 1; i < responses.length; i++) {
                var new_dat = JSON.parse(responses[i]).data;
                for (var j = 0; j < dat.length; j++) {
                    dat[j].energy = +dat[j].energy + +new_dat[j].energy;
                }
            }
            callback({data: dat});
        }
    };

    var onFailed = function () {
        console.log(urls);
        console.log("it broked");
    };

    for (var i = 0; i < urls.length; i++) {
        responses[i] = null;
    }
    for (var i = 0; i < urls.length; i++) {
        var request = new XMLHttpRequest();
        request.seads_index = i;
        request.onreadystatechange = function () {
            if (this.readyState == XMLHttpRequest.DONE) {
                if (this.status == 200) { //200 OK
                    if (responses[this.seads_index] == null) {
                        responses[this.seads_index] = this.responseText;
                        onCompleted();
                    }
                } else {
                    onFailed();
                }
            }
        };

        request.open("GET", urls[i], true);
        request.send();
    }
}

function fetch_bar_graph(url) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState == XMLHttpRequest.DONE) {
            if (request.status == 200) { //200 OK
                generate_bar_graph(JSON.parse(request.responseText));
            } else {
                console.log("it broke");
            }
        }
    };

    request.open("GET", url, true);
    request.send();
}


function generate_pie_graph(responses) {
    var data = [];
    var res = [];
    for (var i = 0; i < responses.length; i++) {
        if (typeof (res[i] = JSON.parse(responses[i]).data[0]) != 'undefined') {
            data[i] = ['Panel' + (i + 1), res[i].energy];
        } else {
            data = [];
            break;
        }
    }
    c3.generate({
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
        bindto: '#pie',
        data: {
            // iris data from R
            columns: data,
            type: 'pie',
            colors: {
                Panel1: '#1f77b4',
                Panel2: '#FFC51E',
                Panel3: '#FF5B1E'
            },
            empty: {label: {text: "No Data Available"}},
        },
        pie: {
            label: {
                format: function (value, ratio, id) {
                    return Math.round(value * 100) / 100 + " kW";
                }
            }
        }
    });
}

function generate_bar_graph(data) {
    c3.generate({
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 70,
        },
        bindto: '#bar',
        data: {
            x: 'x',
            xFormat: '%Y-%m-%d %H:%M:%S',
            columns: [
                ['x'].concat(data.data.map(function (x) {
                    return x.time;
                })),
                ['energy'].concat(data.data.map(function (x) {
                    return Math.round(x.energy * 100) / 100
                }))
            ],
            type: 'bar',
            empty: {label: {text: "No Data Available"}},
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    // displays day of week
                    format: '%a'
                }
            },
            y: {
                tick: {
                    format: function (d) {
                        return d + " kWh";
                    }
                }
            }
        },
        bar: {
            width: {
                ratio: 0.5 // this makes bar width 50% of length between ticks
            }
            // or
            //width: 100 // this makes bar width 100px
        }
    });
}

function generate_gauge(data) {
    if (typeof data.data[0] != 'undefined') {
        var max = 0;
        var length = data.data.length;
        for (var i = 0; i < length; i++) {
            var t = Math.round((data.data[0].energy * 360) * 1000) / 1000;
            if (t > max) {
                max = t;
            }
        }
        var gauge = c3.generate({
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            bindto: '#gauge',
            data: {
                columns: [
                    ['data'].concat(Math.round((data.data[0].energy * 360) * 1000) / 1000)
                ],
                type: 'gauge',
                empty: {label: {text: "No Data Available"}},
            },
            gauge: {
                label: {
                    format: function (value, ratio) {
                        return value;
                    },
                    show: true // to turn off the min/max labels.
                },
                min: 0, // 0 is default, //can handle negative min e.g. vacuum / voltage / current flow / rate of change
                max: max, // 100 is default
                units: ' kW',
                width: 50 // for adjusting arc thickness
            },
            color: {
                pattern: [GREEN, YELLOW, ORANGE, RED], // the three color levels for the percentage values.
                threshold: {
                    //unit: 'value', // percentage is default
                    //max: 200, // 100 is default
                    values: [max * 0.25, max * 0.5, max * 0.75, max]
                }
            },
            size: {
                height: 200
            }
        });
    } else {
        var gauge = c3.generate({
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            bindto: '#gauge',
            data: {
                columns: ['error', 0],
                type: 'gauge',
            },
            gauge: {
                label: {
                    format: function (value, ratio) {
                        return "0";
                    },
                    show: true // to turn off the min/max labels.
                },
                min: 0, // 0 is default, //can handle negative min e.g. vacuum / voltage / current flow / rate of change
                max: 2, // 100 is default
                width: 50 // for adjusting arc thickness
            },
            color: {
                pattern: [GREEN, YELLOW, ORANGE, RED], // the three color levels for the percentage values.
                threshold: {
                    //unit: 'value', // percentage is default
                    //max: 200, // 100 is default
                    values: [.05, 1, 1.5, 2]
                }
            },
            size: {
                height: 200
            }
        });

    }
}

var chart = null;

function generate_chart(responses, gran, panels) {
    var res = [];
    var data = [];
    for (var i = 0; i < responses.length; i++) {
        res[i] = JSON.parse(responses[i]);
        data[i + 1] = [panels[i]].concat(res[i].data.map(function (x) {
            var power = ((x.energy * 1000) * (3600 / gran));
            return Math.round(power * 1000) / 1000;
        }));
        if (i == 0) {
            data[0] = ['x'].concat(res[0].data.map(function (x) {
                return x.time;
            }));
        }
    }
    if (chart == null) {
        chart = c3.generate({
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 50,
            },
            bindto: '#chart',
            data: {
                x: 'x',
                xFormat: '%Y-%m-%d %H:%M:%S',
                columns: data,
                types: {
                    Panel1: 'area',
                    Panel2: 'area',
                    Panel3: 'area',
                    PowerS: 'area',
                },
                colors: {
                    Panel1: '#1f77b4',
                    Panel2: '#FFC51E',
                    Panel3: '#FF5B1E',
                    PowerS: '#2ca02c'
                },
                empty: {label: {text: "No Data Available"}},
            },
            legend: {
                show: true,
                position: 'inset',
                inset: {
                    anchor: 'top-right',
                }
            },
            zoom: {
                enabled: true,
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%m-%d %H:%M'
                    }
                },
                y: {
                    label: {
                        text: 'watts',
                        position: 'outer-middle'
                    },
                }
            },
            point: {
                r: 1.5
            }
        });
    } else {
        chart.load({
            columns: data
        });

    }

    /*-- Deselect points when dragging on graph --*/
    $("#chart").mousedown(function () {
        chart.unselect(['energy']);
    });
}

// Generates chart of data for any appliances selected
function generate_appliance_chart() {
    var data = [];
    $('#appliances .active').each(function () {
        // Random data points for now
        data.push([$(this).attr('id'), Math.floor(Math.random() * 20), Math.floor(Math.random() * 20), Math.floor(Math.random() * 20)]);
    });
    var chart = c3.generate({
        bindto: '#chart2',
        data: {
            columns: data,
            types: {
                data1: 'area',
                data2: 'area-spline'
            },
            empty: {label: {text: "No Data Available"}},
        }
    });
}

var liveTimer;
$(function () {
    var start = moment().subtract(7, 'days');
    var end = moment();

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
        start = Math.floor(start / 1000);
        end = Math.floor(end / 1000);
        console.log(start + " to " + end);
        console.log(moment.unix(start).format("MM/DD/YYYY h:mm") + " to " + moment.unix(end).format("MM/DD/YYYY h:mm"));
        pick_date(start, end);
    }

    $('#reportrange').daterangepicker({
        startDate: start,
        endDate: end,
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);
    cb(start, end);
});