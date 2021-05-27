var timeOffset = 0
var analyticsData = undefined
var pageToken = undefined

function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "analytics"
  $(`#${mainMenuItem}`).addClass("active")

  timeOffset = new Date().getTimezoneOffset()*60000;

  $( "#fromdatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});

  var past30Days = new Date().getTime() - (86400000 * 30)

  $( "#fromdatepicker" ).datepicker('setDate', new Date(past30Days));
  $( "#todatepicker" ).datepicker('setDate', new Date());
}

function onloaded(){

}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  $("#message-col").height(swindow)
  $("#menu-pane").height(swindow)
  $("#control-list-col").height(swindow)

}

function readMessageStore(token){
  var dateFromStr = ""
  var timestamp = new Date().getTime()
  var dateToStr = new Date(timestamp).toISOString()
  var tempDate = new Date($("#fromdatepicker").val() + "T00:00:00.001Z")
  var tempTime = tempDate.getTime()
  dateFromStr = new Date(tempTime).toISOString()

  tempDate = new Date($("#todatepicker").val() + "T23:59:59.999Z")
  tempTime = tempDate.getTime()
  dateToStr = new Date(tempTime).toISOString()

  var configs = {}
  configs['dateFrom'] = dateFromStr
  configs['dateTo'] = dateToStr
  configs['timeOffset'] = timeOffset
  if (token){
    configs['pageToken'] = token
    pageToken = token
  }

  var fromNumber = $('#my-numbers').val()
  configs['phoneNumbers'] = `["${fromNumber}"]`

  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#by_direction").html(readingAni)
  $("#by_status").html("")
  $("#by_cost").html("")
  var url = "create-messaging-analytics"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      analyticsData = res.result
      displayAnalytics()
    }else if (res.status == "error"){
      $("#by_direction").html("")
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}

function displayAnalytics(){
  var mode = $("#display-mode").val()
  var display = $("#display").val()
  if (mode == "graphics"){
    displayAnalyticsTotal()
    if (display == "monthly")
      displayAnalyticsByMonths()
    else if (display == "hourly")
      displayAnalyticsByHours()
    else if (display == "weekdays")
      displayAnalyticsByWeekDays()
    else if (display == "bynumber")
      displayAnalyticsByNumbers()
    else if (display == "bysegment")
      displayAnalyticsBySegments()
    else if (display == "delivery_failure")
      displayDeliveryFailedAnalytics()
  }else{
    displayAnalyticsTotalTable()
    if (display == "monthly")
      displayAnalyticsByMonthsTable()
    else if (display == "hourly")
      displayAnalyticsByHours()
    else if (display == "weekdays")
      displayAnalyticsByWeekDays()
    else if (display == "bynumber")
      displayAnalyticsByNumbersTable()
    else if (display == "bysegment")
      displayAnalyticsBySegmentsTable()
  }
}

function displayAnalyticsByMonthsTable(){
  var byDirection = `<h2>Monthly messages by direction</h2><table class='analytics-table'>`
  var dHeader = "<tr><td width='140'>Month</td>"
  var received = "<tr><td width='140'>Received</td>"
  var sent = "<tr><td width='140'>Sent</td>"

  var byStatus = `<h2>Monthly messages by status</h2><table class='analytics-table'>`
  var dHeader = "<tr><td width='140'>Month</td>"
  var sDelivered = "<tr><td width='150'>Delivered</td>"
  var sSentFailed = "<tr><td width='150'>Sent failed</td>"
  var sDeliveryFailed = "<tr><td width='150'>Delivery failed</td>"

  var byCost = `<h2>Monthly messaging cost</h2><table class='analytics-table'>`
  var cReceived = "<tr><td width='140'>Received</td>"
  var cSent = "<tr><td width='140'>Sent</td>"

  var monthlyData = analyticsData.months
  for (var m of monthlyData) {
    dHeader += `<td width='120'>${m.month}</td>`
    // direction
    received += `<td>${m.inboundCount}</td>`
    sent += `<td>${m.outboundCount}</td>`
    // status
    sDelivered += `<td>${m.deliveredCount}</td>`
    sSentFailed += `<td>${m.sendingFailedCount}</td>`
    sDeliveryFailed += `<td>${m.deliveryFailedCount}</td>`
    // cost
    cReceived += `<td>${m.receivedMsgCost.toFixed(2)}</td>`
    cSent += `<td>${m.sentMsgCost.toFixed(2)}</td>`
  }
  byDirection += `${dHeader}</tr>`
  byDirection += `${received}</tr>`
  byDirection += `${sent}</tr>`
  byDirection += "</table>"

  byStatus += `${dHeader}</tr>`
  byStatus += `${sDelivered}</tr>`
  byStatus += `${sSentFailed}</tr>`
  byStatus += `${sDeliveryFailed}</tr>`
  byStatus += "</table>"

  byCost += `${dHeader}</tr>`
  byCost += `${cReceived}</tr>`
  byCost += `${cSent}</tr>`
  byCost += "</table>"

  $("#by_direction").html(byDirection)
  $("#by_cost").html(byCost)
  $("#by_status").html(byStatus)
}

function displayAnalyticsByHours(){
  var roundTheClock = analyticsData.roundTheClock
  var direction_params = [];
  var arr = [ 'Hour', 'Received', 'Sent' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Hour', 'Delivered', 'SendingFailed', 'DeliveryFailed' ];
  status_params.push(arr);
  var cost_params = [];
  var arr = [ 'Hour', 'Received', 'Sent' ];
  cost_params.push(arr);
  for (var m of roundTheClock) {
    var item = [ m.hour, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [m.hour, m.deliveredCount, m.sendingFailedCount, m.deliveryFailedCount]
    status_params.push(item)
    item = [m.hour, m.receivedMsgCost, m.sentMsgCost]
    cost_params.push(item)
  }

  drawScatterChart(direction_params, "by_direction", 'Hourly messages by direction', 'Messages', '24-Hour')
  drawScatterChart(cost_params, "by_cost", 'Hourly messaging cost', 'USD', '24-Hour')
  drawScatterChart(status_params, "by_status", 'Hourly Message by status', 'Messages', '24-Hour')
}

function displayAnalyticsBySegments(){
  var segments = analyticsData.segmentCounts
  var direction_params = [];
  var arr = [ 'Segment', 'Received', 'Sent' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Segment', 'Delivered', 'SendingFailed', 'DeliveryFailed' ];
  status_params.push(arr);
  var cost_params = [];
  var arr = [ 'Segment', 'Received', 'Sent' ];
  cost_params.push(arr);
  for (var m of segments) {
    var item = [ m.count, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [m.count, m.deliveredCount, m.sendingFailedCount, m.deliveryFailedCount]
    status_params.push(item)
    item = [m.count, m.receivedMsgCost, m.sentMsgCost]
    cost_params.push(item)
  }

  drawComboChart(direction_params, "by_direction", 'Message segments by direction', 'Messages', 'Segment Count')
  drawComboChart(cost_params, "by_cost", 'Messaging cost', 'USD', 'Segment Count')
  drawComboChart(status_params, "by_status", 'Message by status', 'Messages', 'Segment Count')
}

function displayAnalyticsByWeekDays(){
  var weekDays = analyticsData.weekDays
  var direction_params = [];
  var arr = [ 'Day', 'Received', 'Sent' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Day', 'Delivered', 'SendingFailed', 'DeliveryFailed' ];
  status_params.push(arr);
  var cost_params = [];
  var arr = [ 'Day', 'Received', 'Sent' ];
  cost_params.push(arr);
  for (var m of weekDays) {
    var item = [ m.wd, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [m.wd, m.deliveredCount, m.sendingFailedCount, m.deliveryFailedCount]
    status_params.push(item)
    item = [m.wd, m.receivedMsgCost, m.sentMsgCost]
    cost_params.push(item)
  }

  drawScatterChart(direction_params, "by_direction", 'Day messages by direction', 'Messages', 'Day of Week')
  drawScatterChart(cost_params, "by_cost", 'Day messaging cost', 'USD', 'Day of Week')
  drawScatterChart(status_params, "by_status", 'Day Message by status', 'Messages', 'Day of Week')
}

function displayAnalyticsByMonths(){
  var monthlyData = analyticsData.months
  var direction_params = [];
  var arr = [ 'Month', 'Received', 'Sent' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Month', 'Delivered', 'SendingFailed', 'DeliveryFailed' ];
  status_params.push(arr);
  var cost_params = [];
  var arr = [ 'Month', 'Received', 'Sent' ];
  cost_params.push(arr);
  //for (var m of monthlyData) {
  for (var i=monthlyData.length; i>=0; --i) {
    var m =  monthlyData[i]
    var item = [ m.month, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [m.month, m.deliveredCount, m.sendingFailedCount, m.deliveryFailedCount]
    status_params.push(item)
    item = [m.month, m.receivedMsgCost, m.sentMsgCost]
    cost_params.push(item)
  }
  drawComboChart(direction_params, "by_direction", 'Monthly messages by direction', 'Messages', 'Month')
  drawComboChart(status_params, "by_status", 'Monthly Message by status', 'Messages', 'Month')
  drawComboChart(cost_params, "by_cost", 'Monthly messaging cost', 'USD', 'Month')
}

function displayAnalyticsByNumbers(){
  var serviceNumberData = analyticsData.phoneNumbers
  var direction_params = [];
  var arr = [ 'Service Number', 'Received', 'Sent' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Service Number', 'Delivered', 'SendingFailed', 'DeliveryFailed' ];
  status_params.push(arr);
  var cost_params = [];
  var arr = [ 'Service Number', 'Received', 'Sent' ];
  cost_params.push(arr);
  for (var m of serviceNumberData) {
    var serviceNumber = formatPhoneNumber(m.number,false)
    var item = [ serviceNumber, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [serviceNumber, m.deliveredCount, m.sendingFailedCount, m.deliveryFailedCount]
    status_params.push(item)
    item = [serviceNumber, m.receivedMsgCost, m.sentMsgCost]
    cost_params.push(item)
  }
  drawComboChart(direction_params, "by_direction", 'Service messages by direction', 'Messages', 'Phone Number')
  drawComboChart(status_params, "by_status", 'Service Message by status', 'Messages', 'Phone Number')
  drawComboChart(cost_params, "by_cost", 'service messaging cost', 'USD', 'Phone Number')
}

function displayAnalyticsByNumbersTable(){
  var byDirection = `<h2>Service messages by direction</h2><table class='analytics-table'>`
  var dHeader = "<tr><td width='140'>Phone number</td>"
  var received = "<tr><td width='140'>Received</td>"
  var sent = "<tr><td width='140'>Sent</td>"

  var byStatus = `<h2>Service messages by status</h2><table class='analytics-table'>`
  var sDelivered = "<tr><td width='150'>Delivered</td>"
  var sSentFailed = "<tr><td width='150'>Sent failed</td>"
  var sDeliveryFailed = "<tr><td width='150'>Delivery failed</td>"

  var byCost = `<h2>Messages cost by phone number</h2><table class='analytics-table'>`
  var cReceived = "<tr><td width='140'>Received</td>"
  var cSent = "<tr><td width='140'>Sent</td>"

  var serviceNumberData = analyticsData.phoneNumbers
  for (var n of serviceNumberData) {
    var serviceNumber = formatPhoneNumber(n.number,false)
    dHeader += `<td width='120'>${serviceNumber}</td>`
    // direction
    received += `<td>${n.inboundCount}</td>`
    sent += `<td>${n.outboundCount}</td>`
    // status
    sDelivered += `<td>${n.deliveredCount}</td>`
    sSentFailed += `<td>${n.sendingFailedCount}</td>`
    sDeliveryFailed += `<td>${n.deliveryFailedCount}</td>`
    // cost
    cReceived += `<td>${n.receivedMsgCost.toFixed(2)}</td>`
    cSent += `<td>${n.sentMsgCost.toFixed(2)}</td>`
  }
  byDirection += `${dHeader}</tr>`
  byDirection += `${received}</tr>`
  byDirection += `${sent}</tr>`
  byDirection += "</table>"

  byStatus += `${dHeader}</tr>`
  byStatus += `${sDelivered}</tr>`
  byStatus += `${sSentFailed}</tr>`
  byStatus += `${sDeliveryFailed}</tr>`
  byStatus += "</table>"

  byCost += `${dHeader}</tr>`
  byCost += `${cReceived}</tr>`
  byCost += `${cSent}</tr>`
  byCost += "</table>"

  $("#by_direction").html(byDirection)
  $("#by_cost").html(byCost)
  $("#by_status").html(byStatus)
}

function displayAnalyticsTotal(){
  var direction_params = [];
  var arr = [ 'Direction', '#' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Status', '#' ];
  status_params.push(arr);
  var cost_params = [];
  arr = [ 'Cost', 'USD' ];
  cost_params.push(arr);

  var item = [ "Received", analyticsData.inboundCount ]
  direction_params.push(item)
  item = [ "Sent", analyticsData.outboundCount ]
  direction_params.push(item)

  item = ["Delivered", analyticsData.deliveredCount]
  status_params.push(item)
  item = ["Sending failed", analyticsData.sendingFailedCount]
  status_params.push(item)
  item = ["Delivery failed", analyticsData.deliveryFailedCount]
  status_params.push(item)

  item = ["Received", analyticsData.receivedMsgCost]
  cost_params.push(item)
  item = ["Sent", analyticsData.sentMsgCost]
  cost_params.push(item)

  drawPieChart(direction_params, "total-by-direction", 'Service messages by direction')
  drawPieChart(status_params, "total-by-status", 'Service Message by status')
  drawPieChart(cost_params, "total-by-cost", 'Service messaging cost (USD)')
}

function displayAnalyticsTotalTable(){
  var byDirection = `<h2>Total messages by direction</h2><table class='analytics-table'>`
  var received = "<tr><td width='140'>Received</td>"
  var sent = "<tr><td width='140'>Sent</td>"

  var byStatus = `<h2>Total messages by status</h2><table class='analytics-table'>`
  var dHeader = "<tr><td width='140'></td>"
  var sDelivered = "<tr><td width='150'>Delivered</td>"
  var sSentFailed = "<tr><td width='150'>Sent failed</td>"
  var sDeliveryFailed = "<tr><td width='150'>Delivery failed</td>"

  var byCost = `<h2>Total messaging cost</h2><table class='analytics-table'>`
  var cReceived = "<tr><td width='140'>Received</td>"
  var cSent = "<tr><td width='140'>Sent</td>"

  // direction
  dHeader += `<td width='120'>Total</td>`
  received += `<td>${analyticsData.inboundCount}</td>`
  sent += `<td>${analyticsData.outboundCount}</td>`
  // status
  sDelivered += `<td>${analyticsData.deliveredCount}</td>`
  sSentFailed += `<td>${analyticsData.sendingFailedCount}</td>`
  sDeliveryFailed += `<td>${analyticsData.deliveryFailedCount}</td>`
  // cost
  cReceived += `<td>${analyticsData.receivedMsgCost.toFixed(2)}</td>`
  cSent += `<td>${analyticsData.sentMsgCost.toFixed(2)}</td>`

  byDirection += `${dHeader}</tr>`
  byDirection += `${received}</tr>`
  byDirection += `${sent}</tr>`
  byDirection += "</table>"

  byStatus += `${dHeader}</tr>`
  byStatus += `${sDelivered}</tr>`
  byStatus += `${sSentFailed}</tr>`
  byStatus += `${sDeliveryFailed}</tr>`
  byStatus += "</table>"

  byCost += `${dHeader}</tr>`
  byCost += `${cReceived}</tr>`
  byCost += `${cSent}</tr>`
  byCost += "</table>"

  $("#by_direction").html(byDirection)
  $("#by_cost").html(byCost)
  $("#by_status").html(byStatus)
}

function displayDeliveryFailedAnalytics(){
  var errorCode = $("#errors").val()
  var failures = analyticsData.deliveryFailures
  var spam_params = [];
  arr = [ 'Spam', 'Cause' ];
  spam_params.push(arr);
  var invalid_params = [];
  arr = [ 'Invalid', 'Type'];
  invalid_params.push(arr);

  for (var m of failures) {
    if (m.code == "SMS-CAR-430" || m.code == "SMS-UP-430"){
      var item = ["Has phone number", m.hasPhoneNumber]
      spam_params.push(item)
      item = ["Has URL", m.hasURL]
      spam_params.push(item)
      item = ["Too long", m.segmented]
      spam_params.push(item)
    }else if (m.code == "SMS-UP-420" || m.code == "SMS-CAR-411" || m.code == "SMS-CAR-412"){
      var item = ['Invalid', m.invalidNumbers.length]
      invalid_params.push(item)
      item = ['Missing counttry code', m.noCountryCode.length]
      invalid_params.push(item)
    }else if (m.code == "SMS-CAR-413"){

    }

  }

  drawPieChart(spam_params, "by_direction", 'Failure by reason', 'Messages', 'Content Type')
  drawPieChart(invalid_params, "by_cost", 'Failure by reason', 'Messages', 'Content Type')
  $("#by_status").html("")
}

function drawComboChart(params, graph, title, vTitle, hTitle){
  var data = google.visualization.arrayToDataTable(params);
  var options = {
          title : title,
          width: "100%",
          height: 250,
          vAxis: {title: `${vTitle}`},
          hAxis: {title: `${hTitle}`, format: 0},
          seriesType: 'bars',
          colors:['#2280c9','#2f95a5', '#f04b3b']
          //series: {3: {type: 'line'}}
        };

  var chart = new google.visualization.ComboChart(document.getElementById(graph));
  chart.draw(data, options);
}

function drawPieChart(params, graph, title){
  var data = google.visualization.arrayToDataTable(params);
  var view = new google.visualization.DataView(data);
  var options = {
    title: title,
    width: 400,
    height: 240,
    slices: {0:{color: '#2280c9'}, 1:{color: '#2f95a5'}, 2: {color: '#f04b3b'}, 3: {color: '#6e0206'}},
    backgroundColor: 'transparent',
    legend: {
      position: "right"
    },
    pieSliceText: 'value'
  };
  var element = document.getElementById(graph)
  var chart = new google.visualization.PieChart(element);
  chart.draw(data, options);
}

function drawScatterChart(params, graph, title, vTitle, hTitle) {
    var data = google.visualization.arrayToDataTable(params);
    var options = {
      title: title,
      width: "100%",
      height: 250,
      vAxis: {title: `${vTitle}`, minValue: 0},
      hAxis: {title: `${hTitle}`, minValue: 0, maxValue: 23, format: 0},
      viewWindow: {minValue: 0, maxValue: 23},
      pointShape: { type: 'triangle', rotation: 180 },
      colors:['#2280c9','#2f95a5', '#f04b3b'],
      legend: {
        position: "right"
      }
    };

    var element = document.getElementById(graph)
    var chart = new google.visualization.LineChart(element);
    chart.draw(data, options);
}

/*
function drawGauge(row, params){
  var data = google.visualization.arrayToDataTable(params);
  var options = {
    title: params[0][0],
    width: 400, height: 200,
    redFrom: 90, redTo: 100,
    yellowFrom:75, yellowTo: 90,
    minorTicks: 5
  };
  var element = document.getElementById('first-row')
  var chart = new google.visualization.Gauge(element);
  chart.draw(data, options);
}

function drawColumnChart(row, params){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
                    { calc: "stringify",
                       sourceColumn: 1,
                       type: "string",
                       role: "annotation"
                    },
                    2]);

    var options = {
      title: params[0][0],
      vAxis: {minValue: 0},
      width: "100%",
      height: 300,
      bar: {groupWidth: "90%"},
      legend: { position: "none" },
    };

    var element = document.createElement('div')
    $(element).addClass("col-sm-3")
    $("#"+row).append(element)
    var chart = new google.visualization.ColumnChart(element);
    chart.draw(view, options);
}

function drawBarChart(row, params){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
                    { calc: "stringify",
                       sourceColumn: 1,
                       type: "string",
                       role: "annotation"
                    },
                    2]);

    var options = {
      title: params[0][0],
      vAxis: {minValue: 0},
      width: "100%",
      height: 200,
      bar: {groupWidth: "90%"},
      legend: { position: "none" },
    };

    var element = document.getElementById(row)
    var chart = new google.visualization.BarChart(element);
    chart.draw(view, options);
}

function drawScatterChart(params, title) {
    var data = google.visualization.arrayToDataTable(params);
    var options = {
      title: title,
      //width: "100%",
      height: 300,
      vAxis: {title: 'Month', minValue: 0, gridlines: { count: 23 }},
      hAxis: {title: '24-Hour', minValue: 0, maxValue: 23},
      viewWindow: {minValue: 0, maxValue: 23},
      //pointShape: 'diamond',

      pointShape: { type: 'triangle', rotation: 180 },
      legend: 'none',
    };

    var element = document.createElement('div')
    $(element).addClass("col-sm-3")
    $("#"+row).append(element)
    var chart = new google.visualization.LineChart(element);
    chart.draw(data, options);
    //var chart = new google.visualization.ScatterChart(element);
    //chart.draw(data, options);
    //var chart = new google.charts.Scatter(element);
    //chart.draw(data, google.charts.Scatter.convertOptions(options));
}
*/
function downloadMessageStore(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "download-hv-message-store?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}

function logout(){
  window.location.href = "index?n=1"
}
