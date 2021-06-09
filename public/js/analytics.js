var timeOffset = 0
var analyticsData = undefined
var failureData = undefined
var pageToken = undefined
var pollingTimer = undefined

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

  var past90Days = new Date().getTime() - (86400000 * 90)

  $( "#fromdatepicker" ).datepicker('setDate', new Date(past90Days));
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
  $("#processing").show()
  $("#options-bar").hide()
  $("#by_direction").html("")
  $("#by_status").html("")
  $("#by_cost").html("")
  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#total-by-direction").html(readingAni)
  $("#total-by-cost").html(readingAni)
  $("#total-by-status").html(readingAni)
  $("#downloads").hide()
  var url = "create-messaging-analytics"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      $("#total-title").html(`Messaging statistics between ${$("#fromdatepicker").val()} and ${$("#todatepicker").val()}`)
      pollingTimer = window.setTimeout(function(){
          pollAnalyticsResult()
      },3000)
    }else if (res.status == "error"){
      $("#processing").hide()
      $("#by_direction").html("")
      _alert(res.message)
    }else{
      $("#processing").hide()
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

function pollAnalyticsResult(){
  var url = "poll-analytics-result"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      $("#options-bar").show()
      analyticsData = res.result
      failureData = res.failureAnalysis
      if (res.result.task != "Initiated")
        displayAnalytics()
      if (res.result.task == "Processing"){
        pollingTimer = window.setTimeout(function(){
          pollAnalyticsResult()
        },5000)
      }else{
        if (res.result.task == "Completed")
          $("#downloads").show()
        $("#processing").hide()
      }
    }else{
      $("#processing").hide()
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

var mode = "graphics"
function switchDisplayMode(){
  if (mode == "graphics"){
    $("#mode-icon").attr("src", "./img/graph.png")
    $("#mode-label").html(" Graphics view")
    mode = "table"
  }else{
    $("#mode-icon").attr("src", "./img/table.png")
    $("#mode-label").html(" Table view")
    mode = "graphics"
  }
  displayAnalytics()
}

function displayAnalytics(){
  if (mode == "graphics"){
    displayAnalyticsTotal()
  }else{
    displayAnalyticsTotalTable()
  }
  if ($("#display").val() == "failure-analytics"){
    $("#sub-category").hide()
    $("#graphs").hide()
    $("#failure-category").show()
    $("#failure-analytics").show()
    //displayFailedAnalytics(0)
    displayFailedAnalyticsDetails()
  }else{
    $("#sub-category").show()
    $("#graphs").show()
    $("#failure-category").hide()
    $("#failure-analytics").hide()
    displayAnalyticsType()
  }
}

function displayAnalyticsType(){
  var type = $("#analytics-type").val()
  var breakout = $("#display").val()
  if (mode == "graphics"){
    if (type == "message-count"){
      displayMessageDirection(breakout)
    }else if (type == "message-status"){
      displayMessageStatus(breakout)
    }else if (type == "message-cost"){
      displayMessageCost(breakout)
    }
  }else { // table
    if (type == "message-count"){
      displayMessageDirectionTable(breakout)
    }else if (type == "message-status"){
      displayMessageStatusTable(breakout)
    }else if (type == "message-cost"){
      displayMessageCostTable(breakout)
    }
  }
}

function displayAnalyticsTotal(){
  var direction_params = [[ 'Direction', '# messages', { role: "style" } ]];
  var status_params = [[ 'Status', '# messages', { role: "style" } ]];
  var cost_params = [[ 'Cost', 'USD', { role: "style" } ]];

  var item = [ "Outbound", analyticsData.outboundCount, '#178006' ]
  direction_params.push(item)
  item = [ "Inbound", analyticsData.inboundCount, '#1126ba']
  direction_params.push(item)

  item = [ "Total", analyticsData.outboundCount + analyticsData.inboundCount, '#03918f' ]
  direction_params.push(item)

  item = ["Succeeded", analyticsData.deliveredCount, "#0770a8"]
  status_params.push(item)
  item = ["Failed", analyticsData.sendingFailedCount + analyticsData.deliveryFailedCount, '#f04b3b']
  status_params.push(item)
  //item = ["Delivery failed", analyticsData.deliveryFailedCount, 'brown']
  //status_params.push(item)

  item = ["Outbound", parseFloat(analyticsData.sentMsgCost.toFixed(2)), '#178006']
  cost_params.push(item)
  item = ["Inbound", parseFloat(analyticsData.receivedMsgCost.toFixed(2)), '#1126ba']
  cost_params.push(item)

  item = ["Total", parseFloat(analyticsData.sentMsgCost.toFixed(2)) + parseFloat(analyticsData.receivedMsgCost.toFixed(2)), '#03918f']
  cost_params.push(item)

  drawColumnChart(direction_params, "total-by-direction", '# Messages by direction', "# Messages")
  drawColumnChart(cost_params, "total-by-cost", 'Cost by direction (USD)', "Cost")
  drawColumnChart(status_params, "total-by-status", '# Outbound messages by status', "# Messages")
}

function displayAnalyticsTotalTable(){
  var byDirection = `<div class='analytics-header'># Messages by direction</div><table class='analytics-table'>`
  byDirection += "<tr><td class='table-label'>Direction</td><td class='table-label'># Messages</td></tr>"
  byDirection += `<tr><td class='table-label'>Inbound</td><td>${formatNumber(analyticsData.inboundCount)}</td></tr>`
  byDirection += `<tr><td class='table-label'>Outbound</td><td>${formatNumber(analyticsData.outboundCount)}</td></tr>`
  byDirection += `<tr><td class='table-label'>Total</td><td>${formatNumber(analyticsData.outboundCount + analyticsData.inboundCount)}</td></tr></table>`

  var byStatus = `<div class='analytics-header'># Messages by status</div><table class='analytics-table'>`
  byStatus += "<tr><td class='table-label'>Status</td><td class='table-label'># Messages</td></tr>"
  byStatus += `<tr><td class='table-label'>Delivered</td><td>${formatNumber(analyticsData.deliveredCount)}</td></tr>`
  byStatus += `<tr><td class='table-label'>Sending failed</td><td class='bad-data'>${formatNumber(analyticsData.sendingFailedCount)}</td></tr>`
  byStatus += `<tr><td class='table-label'>Delivery failed</td><td class='bad-data'>${formatNumber(analyticsData.deliveryFailedCount)}</td></tr>`
  var totalFailed = analyticsData.deliveryFailedCount + analyticsData.sendingFailedCount
  byStatus += `<tr><td class='table-label'>Total failed</td><td class='bad-data'>${formatNumber(totalFailed)}</td></tr></table>`

  var byCost = `<div class='analytics-header'>Cost by direction</div><table class='analytics-table'>`
  byCost += "<tr><td class='table-label'>Direction</td><td class='table-label'>USD</td></tr>"
  var totalCost = analyticsData.sentMsgCost + analyticsData.receivedMsgCost
  byCost += `<tr><td class='table-label'>Inbound</td><td>${formatNumber(analyticsData.receivedMsgCost.toFixed(2))}</td></tr>`
  byCost += `<tr><td class='table-label'>Outbound</td><td>${formatNumber(analyticsData.sentMsgCost.toFixed(2))}</td></tr>`
  byCost += `<tr><td class='table-label'>Total</td><td>${formatNumber(totalCost.toFixed(2))}</td></tr></table>`

  $("#total-by-direction").html(byDirection)
  $("#total-by-cost").html(byCost)
  $("#total-by-status").html(byStatus)
}

function writeTitle(type, title){
  $(`#${type}`).html(title)
}

function formatFloatNumber(number){
  if (number >= 100.0)
    return number.toFixed(0)
  else if (number >= 10)
    return number.toFixed(1)
  else
    return number.toFixed(2)
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
function convertMonth(month){
  var year_month = month.split("-")
  var monthStr = months[parseInt(year_month[1])-1]
  monthStr += ` ${year_month[0].substring(2, 4)}`
  return monthStr
}

function showRateInfo(type){
  var infoText = [
    "<p>High response rate is the good health of your interactive text messaging with your customers. It would help prevent mobile carriers from blocking \
    your text messages. Especially, when you start using your High Volume SMS phone number for the first time, as high response rate would help warm up your service phone number reputation.</p>\
    <br><b>Best practices to increase and maintain high response rate:</b>\
    <ul><li>Start your text messaging campaign by sending a brief message to ask if your customers would like to learn more about your sale or promo. \
    E.g. 'Reply YES for more info'. Treat this as an opt-in or opt-out choice from a recipient.</li>\
    <li>Break a lengthy text message into multi-section messages, then send a breif message with response choices to receive the next messages.</li>\
    <li>If you send text messages to your customers repeatedly over a long period of time without requesting for response, send a survey message to \
    the customers periodically, to ask if they still want to receive your text messages.</li></ul>",
    "<p>The delivery rate indicates the percentage of your messages successfully delivered to your targeted recipients. The higher delivery rate the better, because it means your messages could reach most of your targeted recipients!</p>\
    <br><b>Here is a few tips for how to increase the delivery rate:</b>\
    <ul><li>Make sure your recipient phone number is in a correct format (E.164) with a country code followed by the area code and the local number without space, bracket or hyphen symbols.</li>\
    <li>Remove landline and invalid phone numbers from your recipient list as much as you can.</li>\
    <li>Download your campaign's report, copy the recipient phone number from any failed messages and remove them from your recipient list after sending every campaign.</li>\
    <li>Regularly, read opted-out numbers and remove them from your recipient list.</li>\
    <li>Follow the guidelines and best practices to avoid your messages get blocked as spam content.</li></ul>",
    "<p>Cost efficiency rate is calculated from the cost of successfully delivered messages and the cost of undeliverable messages. Keeping the cost \
    efficiency at a high rate will help you maximize the value of your text messaging spending.</p>\
    <br><b>Here is a few tips for how to increase cost efficiency rate:</b>\
    <ul><li>Regularly, read opted-out numbers and remove them from your recipient list.</li>\
    <li>Follow the guidelines and best practices to avoid your messages get blocked as spam content.</li>\
    <li>Learn from your previous campaigns to avoid or to minimize the numbers of 'DeliveryFailed' incidents by modifying your message content if the message was flagged as spam content, or removing those recipients' phone number from the recipient list of your next campaigns.</li></ul>"
  ]
  var title = [
    "Response rate",
    "Delivery rate",
    "Cost efficiency",
  ]
  _alert(infoText[type], title[type])
}

function displayMessageDirection(breakout){
  var colors = ['#178006','#1126ba']
  var color = ['#178006']
  if (breakout == "monthly"){
    var monthlyData = analyticsData.months
    var direction_params = [['Month', 'Outbound', 'Inbound']]
    var response_params = [['Month', 'Response rate']];
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      var item = [ convertMonth(m.month), m.outboundCount, m.inboundCount ]
      direction_params.push(item)
      var rate = 0.0
      if (m.outboundCount > 0)
        rate = (m.inboundCount / m.outboundCount) * 100
      item = [convertMonth(m.month), parseFloat(formatFloatNumber(rate))]
      response_params.push(item)
    }
    writeTitle('statistics-title', '# Messages by direction (per month)')
    drawComboChart(direction_params, "statistics", 'Messages by direction (per month)', 'Messages', 'Month', colors)
    writeTitle('analysis-title', 'Response rate (per month).<a class="info-link" href="#" onclick="showRateInfo(0);return false;" style="float:right"> Increase and maintain high response rate.</a>')
    drawComboChart(response_params, "analysis", 'Response rate (per month)', '%', 'Month', color)
  }else if (breakout == "bynumber"){
    var serviceNumberData = analyticsData.phoneNumbers
    var direction_params = [[ 'Service Number', 'Outbound', 'Inbound' ]];
    var response_params = [['Month', 'Response rate']];
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      var item = [ serviceNumber, m.outboundCount, m.inboundCount ]
      direction_params.push(item)
      var rate = 0.0
      if (m.outboundCount > 0)
        rate = (m.inboundCount / m.outboundCount) * 100
      item = [serviceNumber, parseFloat(formatFloatNumber(rate))]
      response_params.push(item)
    }
    writeTitle('statistics-title', '# Messages by direction (per service number)')
    drawComboChart(direction_params, "statistics", 'Messages by direction (per service number)', 'Messages', 'Phone Number', colors)
    writeTitle('analysis-title', 'Response rate (per service number).<a href="#" onclick="showRateInfo(0);return false;" style="float:right"> Increase and maintain high response rate.</a>')
    drawComboChart(response_params, "analysis", 'Response rate (per service number)', '%', 'Phone Number', color)
  }
}

function displayMessageDirectionTable(breakout){
  writeTitle('analysis-title', '')
  var byDirection = "<table class='analytics-table'>"
  var dHeader = ""
  var dReceived = "<tr><td class='table-label'>Inbound messages</td>"
  var dSent = "<tr><td class='table-label'>Outbound messages</td>"
  var dTotal = "<tr><td class='table-label'>Total messages</td>"
  var dRate = "<tr><td class='table-label'>Response rate</td>"

  if (breakout == "monthly"){
    dHeader = "<tr><td class='table-label'>Month</td>"
    var monthlyData = analyticsData.months
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      dHeader += `<td class='table-data'>${convertMonth(m.month)}</td>`
      // direction
      dReceived += `<td>${m.inboundCount}</td>`
      dSent += `<td>${m.outboundCount}</td>`
      dTotal += `<td>${m.outboundCount + m.inboundCount}</td>`
      var rate = 0.0
      if (m.outboundCount > 0)
        rate = (m.inboundCount / m.outboundCount) * 100
      dRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Messages by direction (per month)')
  }else if (breakout == "bynumber"){
    var dHeader = "<tr><td class='table-label'>Service Number</td>"
    var serviceNumberData = analyticsData.phoneNumbers
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      dHeader += `<td class='table-data'>${serviceNumber}</td>`
      // direction
      dReceived += `<td>${m.inboundCount}</td>`
      dSent += `<td>${m.outboundCount}</td>`
      dTotal += `<td>${m.outboundCount + m.inboundCount}</td>`
      var rate = 0.0
      if (m.outboundCount > 0)
        rate = (m.inboundCount / m.outboundCount) * 100
      dRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Messages by direction (per service number)')
  }

  byDirection += `${dHeader}</tr>`
  byDirection += `${dReceived}</tr>`
  byDirection += `${dSent}</tr>`
  byDirection += `${dTotal}</tr>`
  byDirection += `${dRate}</tr>`
  byDirection += "</table>"

  $("#statistics").html(byDirection)
  $("#analysis").html("")
}

function displayMessageStatus(breakout){
  var colors = ['#0770a8', '#f04b3b']
  var color = ['#178006']
  if (breakout == "monthly"){
    var monthlyData = analyticsData.months
    var status_params = [['Month', 'Delivered', 'Failed']]
    var efficiency_params = [['Month', 'Delivery rate']];
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      var item = [convertMonth(m.month), m.deliveredCount, m.deliveryFailedCount + m.sendingFailedCount]
      status_params.push(item)
      var rate = 0.0
      var total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
      if (total > 0)
        rate = (m.deliveredCount / total) * 100
      item = [convertMonth(m.month), parseFloat(formatFloatNumber(rate))]
      efficiency_params.push(item)
    }
    writeTitle('statistics-title', '# Outbound messages by status (per month)')
    drawComboChart(status_params, "statistics", 'Outbound messages by status (per month)', 'Messages', 'Month', colors)
    writeTitle('analysis-title', 'Delivery rate (per month) <a href="#" onclick="showRateInfo(1);return false;">&#9432;</a>')
    drawComboChart(efficiency_params, "analysis", 'Delivery rate (per month)', '%', 'Month', color)
  }else if (breakout == "bynumber"){
    var serviceNumberData = analyticsData.phoneNumbers
    var status_params = [[ 'Service Number', 'Delivered', 'Failed' ]];
    var efficiency_params = [['service Number', 'Delivery rate']];
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      var item = [ serviceNumber, m.deliveredCount, m.deliveryFailedCount + m.sendingFailedCount ]
      status_params.push(item)
      var rate = 0.0
      var total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
      if (total > 0)
        rate = (m.deliveredCount / total) * 100
      item = [serviceNumber, parseFloat(formatFloatNumber(rate))]
      efficiency_params.push(item)
    }
    writeTitle('statistics-title', '# Outbound messages by status (per service number)')
    drawComboChart(status_params, "statistics", 'Outbound messages by status (per service number)', 'Messages', 'Phone Number', colors)
    writeTitle('analysis-title', 'Delivery rate (per service number) <a href="#" onclick="showRateInfo(1);return false;">&#9432;</a>')
    drawComboChart(efficiency_params, "analysis", 'Delivery rate (per service number)', '%', 'Phone Number', color)
  }
}

function displayMessageStatusTable(breakout){
  writeTitle('analysis-title', '')
  var dHeader = ""
  var byStatus = "<table class='analytics-table'>"
  var sSucceeded = "<tr><td class='table-label'>Delivered</td>"
  var sFailed = "<tr><td class='table-label'>Failed</td>"
  var sSuccessRate = "<tr><td class='table-label'>Delivery rate</td>"

  if (breakout == "monthly"){
    dHeader = "<tr><td class='table-label'>Month</td>"
    var monthlyData = analyticsData.months
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      dHeader += `<td class='table-data'>${convertMonth(m.month)}</td>`
      sSucceeded += `<td>${m.deliveredCount}</td>`
      var totalFailedCount = m.sendingFailedCount + m.deliveryFailedCount
      sFailed += `<td class='bad-data'>${totalFailedCount}</td>`
      var total = m.deliveredCount + totalFailedCount
      var rate = (m.deliveredCount / total) * 100
      sSuccessRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Outbound messages by status (per month)')
  }else if (breakout == "bynumber"){
    dHeader = "<tr><td class='table-label'>Service Number</td>"
    var serviceNumberData = analyticsData.phoneNumbers
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      dHeader += `<td class='table-data'>${serviceNumber}</td>`
      sSucceeded += `<td>${m.deliveredCount}</td>`
      var totalFailedCount = m.sendingFailedCount + m.deliveryFailedCount
      sFailed += `<td class='bad-data'>${totalFailedCount}</td>`
      var total = m.deliveredCount + totalFailedCount
      var rate = (m.deliveredCount / total) * 100
      sSuccessRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Outbound messages by status (per service number)')
  }

  byStatus += `${dHeader}</tr>`
  byStatus += `${sSucceeded}</tr>`
  byStatus += `${sFailed}</tr>`
  byStatus += `${sSuccessRate}</tr>`
  byStatus += "</table>"

  $("#statistics").html(byStatus)
  $("#analysis").html("")
}

function displayMessageCost(breakout){
  var colors = ['#178006','red','#1126ba']
  var color = ['#178006']
  if (breakout == "monthly"){
    var monthlyData = analyticsData.months
    var cost_params = [['Month', 'Outbound success', 'Outbound failure', 'Inbound']];
    var efficiency_params = [['Month', 'Efficiency rate']];
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      var item = [convertMonth(m.month), parseFloat(formatFloatNumber(m.deliveredMsgCost)), parseFloat(formatFloatNumber(m.failedMsgCost)), parseFloat(formatFloatNumber(m.receivedMsgCost))]
      cost_params.push(item)
      var rate = 0.0
      var totalCost = m.deliveredMsgCost + m.failedMsgCost
      if (totalCost > 0.0)
        rate = (m.deliveredMsgCost / totalCost) * 100
      rate = parseFloat(rate.toFixed(1))
      var item = [convertMonth(m.month), rate]
      efficiency_params.push(item)
    }
    writeTitle('statistics-title', 'Cost by direction (per month)')
    drawComboChart(cost_params, "statistics", 'Cost by direction (per month)', 'USD', 'Month', colors)
    writeTitle('analysis-title', 'Outbound messaging cost efficiency (per month) <a href="#" onclick="showRateInfo(2);return false;">&#9432;</a>')
    drawComboChart(efficiency_params, "analysis", 'Outbound messaging cost efficiency (per month)', '%', 'Month', color)
  }else if (breakout == "bynumber"){
    var serviceNumberData = analyticsData.phoneNumbers
    var cost_params = [[ 'Service Number', 'Outbound success', 'Outbound failure', 'Inbound']];
    var efficiency_params = [[ 'Service Number', 'Efficiency rate' ]];
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      var item = [ serviceNumber, parseFloat(formatFloatNumber(m.deliveredMsgCost)), parseFloat(formatFloatNumber(m.failedMsgCost)), parseFloat(formatFloatNumber(m.receivedMsgCost))]
      cost_params.push(item)
      var rate = 0.0
      var totalCost = m.deliveredMsgCost + m.failedMsgCost
      if (totalCost > 0.0)
        rate = (m.deliveredMsgCost / totalCost) * 100
      rate = parseFloat(rate.toFixed(1))
      var item = [serviceNumber, rate]
      efficiency_params.push(item)
    }
    writeTitle('statistics-title', 'Cost by direction (per service number)')
    drawComboChart(cost_params, "statistics", 'Cost by direction (per service number)', 'USD', 'Phone Number', colors)
    writeTitle('analysis-title', 'Outbound messaging cost efficiency (per service number) <a href="#" onclick="showRateInfo(2);return false;">&#9432;</a>')
    drawComboChart(efficiency_params, "analysis", 'Outbound messaging cost efficiency (per service number)', '%', 'Phone Number', color)
  }
}

function displayMessageCostTable(breakout){
  var dHeader = ""
  var byCost = "<table class='analytics-table'>"
  var cInbound = "<tr><td class='table-label'>Cost of inbound messages</td>"
  var cOutbound = "<tr><td class='table-label'>Cost of outbound messages</td>"
  var cTotal = "<tr><td class='table-label'>Total Cost</td>"

  var byCostEfficiency = "<table class='analytics-table'>"
  var eOutboundDelivered = "<tr><td class='table-label'>Cost of succeeded outbound messages</td>"
  var eOutboundFailed = "<tr><td class='table-label'>Cost of failed outbound messages</td>"
  var eRate = "<tr><td class='table-label'>Efficiency rate</td>"

  if (breakout == "monthly"){
    dHeader = "<tr><td class='table-label'>Month</td>"
    var monthlyData = analyticsData.months
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      dHeader += `<td class='table-data'>${convertMonth(m.month)}</td>`
      cInbound += `<td>${formatFloatNumber(m.receivedMsgCost)}</td>`
      var deliveryCost = m.deliveredMsgCost + m.failedMsgCost
      cOutbound += `<td>${formatFloatNumber(deliveryCost)}</td>`
      var totalCost = deliveryCost + m.receivedMsgCost
      cTotal += `<td>${formatFloatNumber(totalCost)}</td>`

      eOutboundDelivered += `<td>${formatFloatNumber(m.deliveredMsgCost)}</td>`
      eOutboundFailed += `<td class='bad-data'>${formatFloatNumber(m.failedMsgCost)}</td>`
      var rate = (m.deliveredMsgCost / deliveryCost) * 100
      eRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', 'Cost by direction (USD per month)')
    writeTitle('analysis-title', 'Outbound messaging cost efficiency (per month)')
  }else if (breakout == "bynumber"){
    dHeader = "<tr><td class='table-label'>Service Number</td>"
    var serviceNumberData = analyticsData.phoneNumbers
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      dHeader += `<td class='table-data'>${serviceNumber}</td>`
      cInbound += `<td>${formatFloatNumber(m.receivedMsgCost)}</td>`
      var deliveryCost = m.deliveredMsgCost + m.failedMsgCost
      cOutbound += `<td>${formatFloatNumber(deliveryCost)}</td>`
      var totalCost = deliveryCost + m.receivedMsgCost
      cTotal += `<td>${formatFloatNumber(totalCost)}</td>`

      eOutboundDelivered += `<td>${formatFloatNumber(m.deliveredMsgCost)}</td>`
      eOutboundFailed += `<td class='bad-data'>${formatFloatNumber(m.failedMsgCost)}</td>`
      var rate = (m.deliveredMsgCost / deliveryCost) * 100
      eRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', 'Cost by direction (USD per service number)')
    writeTitle('analysis-title', 'Outbound messaging cost efficiency (per service number)')
  }

  byCost += `${dHeader}</tr>`
  byCost += `${cInbound}</tr>`
  byCost += `${cOutbound}</tr>`
  byCost += `${cTotal}</tr>`

  byCost += "</table>"

  byCostEfficiency += `${dHeader}</tr>`
  byCostEfficiency += `${eOutboundDelivered}</tr>`
  byCostEfficiency += `${eOutboundFailed}</tr>`
  byCostEfficiency += `${eRate}</tr>`

  $("#statistics").html(byCost)
  $("#analysis").html(byCostEfficiency)
}

function displayFailedAnalyticsDetails(){
  var type = $("#failure-types").val()
  var message = ""
  if (type == "spam"){
    message = "<div class='breakout'>Suspected spam content</div>"
    message += `<p class='block_space'>Wireless carriers use different spam content filter solutions, mainly handled by machine learning algorithms. \
    Some carriers are stricter than others. If the message is innocuous and it is still get blocked by a carrier, it is likely that the number is flagged \
    as a spam number due to other types of violations.`
    var warning = ` Some of the wireless carriers of your recipients rejected your messages. You should revise the messages or remove these recipients \
    from the recipient list to avoid sending spam content to these numbers, which would decrease your service number reputation and eventually get blocked \
    by the carriers.</p>`

    var subMsg = ""
    failureData.contents = []
    for (var s of failureData.contents){
      if (s.spamMsgCount > 0){
        subMsg  += `<p class="spam-message">${s.message}</p>`
        var rate = (s.spamMsgCount/(s.acceptedMsgCount+s.spamMsgCount)) * 100
        var spamNumbers = s.spamMsgNumbers.join(';')
        var ratio = s.spamMsgCount / s.spamMsgNumbers.length
        subMsg += `<div>${s.spamMsgCount} / ${s.spamMsgNumbers.length}. Ratio:${ratio.toFixed(2)}</div>`
        subMsg += `<div># Rejected/Passed: ${formatNumber(s.spamMsgCount)}/${formatNumber(s.acceptedMsgCount)} => Rejected rate: ${rate.toFixed(2)} % - <a href="#" onclick="copyNumbersToClipboard('${spamNumbers}')">Copy recipient phone numbers</a></div>`
      }
    }
    if (subMsg != ""){
      message += warning
      message += "<div class='failed-content-list'>"
      message += subMsg
      message += "</div>"
    }else{
      message += "</p>"
    }

    displayFailedAnalytics(0)
  }else if (type == "rejected-content"){
    message = "<div class='breakout'>Rejected content</div>"
    message += `<p class='block_space'>Wireless carriers rejected delivering your messages to their subscriber. You should correct the message or remove the recipient from the recipient list to improve the cost efficiency.</p>`
    message += "<div class='failed-content-list'>"

    for (var s of failureData.contents){
      if (s.rejectedMsgCount > 0){
        message  += `<p class="spam-message">${s.message}</p>`
        var rate = (s.rejectedMsgCount/(s.acceptedMsgCount+s.rejectedMsgCount)) * 100
        var rejectedNumbers = s.rejectedMsgNumbers.join(';')
        message += `<div># Rejected/Passed: ${formatNumber(s.rejectedMsgCount)}/${formatNumber(s.acceptedMsgCount)} => Rejected rate: ${rate.toFixed(2)} % - <a href="#" onclick="copyNumbersToClipboard('${rejectedNumbers}')">Copy recipient phone numbers</a></div>`
      }
    }
    message += "</div>"
    displayFailedAnalytics(1)
  }else if (type == "invalid-number"){
    message = "<div class='breakout'>Invalid recipient numbers</div>"
    message += `<p class='block_space'>Mobile carriers could not deliver your messages to these recipients. You should correct the numbers or remove them from the recipient list to improve the cost efficiency.</p>`

    var numbers = failureData.invalidNumbers.join(';')
    message += `<div>Ratio: ${failureData.invalidNumberCount/failureData.invalidNumbers.length}</div>`
    message += `<div>There are ${formatNumber(failureData.invalidNumbers.length)} invalid numbers. - <a href="#" onclick="copyNumbersToClipboard('${numbers}')">Copy recipient invalid numbers</a></div>`
    displayFailedAnalytics(2)
  }else if (type == "optout-number"){
    message = "<div class='breakout'>Opted out recipients</div>"
    message += `<p class='block_space'>Sending a text message to opted-out recipients is violating text messaging compliance laws and as a consequence, mobile \
    carrier will block your message. Keep sending text messages to an opted out recipient will trigger the recipient's mobile carriers to flag your phone number \
    permanently.</p>`
    if (failureData.optoutCount > 0){
      for (var item of failureData.optoutNumbers){
        var numbers = item.recipientNumbers.join(';')
        message += `<p>There are ${formatNumber(item.recipientNumbers.length)} recipients who have opted out from this service number <b>${formatPhoneNumber(item.senderNumber, false)}</b>. You must remove them from \
        the recipient list to avoid your phone number getting blocked by their wireless carrier. <a href="#" onclick="copyNumbersToClipboard('${numbers}')">Copy opted-out recipient phone numbers.</a></p>`
        //message += `<div>Ratio: ${failureData.optoutCount/failureData.optoutNumbers.length}</div>`
      }
    }else{
      message += `<p class='block_space'>Congratulations! There is no 'optout' violation within this time period.</p>`
    }
    displayFailedAnalytics(3)
  }else if (type == "blocked-number"){
    message = "<div class='breakout'>Blocked service numbers</div>"
    message += "<p class='block_space'>The folloing service number(s) was blocked by carriers due to spam content violation.</p>"
    // list service number and recipient numbers
    displayFailedAnalytics(4)
  }else if (type == "rejected-number"){
    message = "<div class='breakout'>Rejected phone numbers</div>"
    message += `<p class='block_space'>We detected these phone numbers either are invalid or do not exist. You should correct the numbers or remove them from the recipient list to improve the outbound throughput rate.</p>`
    //message += `<p class='failed-content-list'>${failureData.rejectedNumbers.join("\n")}</p>`
    var numbers = analyticsData.sendingFailedNumbers.join(';')
    message += `<div>Ratio: ${analyticsData.sendingFailedCount/analyticsData.sendingFailedNumbers.length}</div>`
    message += `<div>There are ${formatNumber(analyticsData.sendingFailedNumbers.length)} invalid numbers - <a href="#" onclick="copyNumbersToClipboard('${numbers}')">Copy recipient rejected phone numbers</a></div>`
    displayFailedAnalytics(5)
  }else if (type == "other-reason"){
    message = "<div class='breakout'>Other unknown reasons</div>"
    //message += `<p class='failed-content-list'>${failureData.unknownNumbers.join("\n")}</p>`
    var numbers = failureData.otherErrorNumbers.join(';')
    message += `<div>Ratio: ${failureData.otherErrorCount/failureData.otherErrorNumbers.length}</div>`
    message += `<div>There are ${formatNumber(failureData.otherErrorNumbers.length)} recipient phone numbers. <a href="#" onclick="copyNumbersToClipboard('${numbers}')">Copy recipient phone numbers</a></div>`
    displayFailedAnalytics(6)
  }
  $("#text-column").html(message)
}

function copyNumbersToClipboard (numbers) {
    var numbersArr = numbers.split(";")
    var dummy = document.createElement("textarea")
    document.body.appendChild(dummy)
    var text = ""
    for (var number of numbersArr){
      text += `${number}\n`
    }
    dummy.value = text
    dummy.select()
    document.execCommand("copy")
    document.body.removeChild(dummy)
}

function displayFailedAnalytics(slice){
  console.log(failureData)
  var spamMsgCount = 0
  var rejectedMsgCount = 0
  for (var s of failureData.contents){
    spamMsgCount += s.spamMsgCount
    rejectedMsgCount += s.rejectedMsgCount
  }

  if (mode == "graphics"){
    var error_params = [['Error Type', '# Count']];

    var item = [ "Spam Content", spamMsgCount]
    error_params.push(item)

    item = [ "Rejected content", rejectedMsgCount]
    error_params.push(item)

    item = [ "Invalid Number", failureData.invalidNumberCount]
    error_params.push(item)

    item = [ "Optout Recipient", failureData.optoutCount]
    error_params.push(item)

    item = [ "Blocked Number", failureData.blacklistedCount]
    error_params.push(item)

    item = ["Rejected Number", analyticsData.sendingFailedCount]
    error_params.push(item)

    item = ["Others", failureData.otherErrorCount]
    error_params.push(item)
    console.log(spamMsgCount + rejectedMsgCount + failureData.invalidNumberCount + failureData.optoutCount + failureData.blacklistedCount + analyticsData.sendingFailedCount + failureData.otherErrorCount)
    var colors = {0:{color: '#3f3445'}, 1:{color: '#e88c02'}, 2:{color: '#ab6305'}, 3:{color: '#cc040e'}, 4:{color: 'red'}, 5:{color: '#0748a3'}, 6:{color: 'gray'}, 7:{color: '#59730a'}}
    drawPieChart(error_params, "graph-column", '', colors, slice)
  }else{
    var errorData = `<div class='breakout'>Error by types</div><table class='analytics-table'>`
    errorData += `<tr><td class='table-label'>Error Type</td><td class=''># Incidents</td></tr>`
    errorData += `<tr><td class='table-label'>Spam content</td><td class='table-data'>${formatNumber(spamMsgCount)}</td></tr>`
    errorData += `<tr><td class='table-label'>Rejected content</td><td class='table-data'>${formatNumber(rejectedMsgCount)}</td></tr>`
    errorData += `<tr><td class='table-label'>Invalid number</td><td class='table-data'>${formatNumber(failureData.invalidNumberCount)}</td></tr>`
    errorData += `<tr><td class='table-label'>Optout recipient</td><td class='table-data'>${formatNumber(failureData.optoutCount)}</td></tr>`
    errorData += `<tr><td class='table-label'>Blocked number</td><td class='table-data'>${formatNumber(failureData.blacklistedCount)}</td></tr>`
    errorData += `<tr><td class='table-label'>Rejected number</td><td class='table-data'>${formatNumber(analyticsData.sendingFailedCount)}</td></tr>`
    errorData += `<tr><td class='table-label'>Other reason</td><td class='table-data'>${formatNumber(failureData.otherErrorCount)}</td></tr>`
    var total = spamMsgCount + rejectedMsgCount + failureData.invalidNumberCount
    total += failureData.optoutCount + failureData.blacklistedCount + analyticsData.sendingFailedCount + failureData.otherErrorCount
    errorData += `<tr><td class='table-label'>Total</td><td class='table-data'>${formatNumber(total)}</td></tr>`
    errorData += "</table>"
    $("#graph-column").html(errorData)

  }
  //drawKeywords(failureData[1].keywords)
  //displayFailedAnalyticsDetails()
}

function drawKeywords(keywords){
  $("#my_canvas").show()
  alert(keywords)
  var fakeKeywords = ["https","urgent","best","click","send","reply","confirm","security"]
  var list = []
  for (var item of fakeKeywords){
      var kw = []
      kw.push(item)
      kw.push(3)
      list.push(kw)
  }
  alert(JSON.stringify(list))
  var options = {
    list : list,
    gridSize: 5,
    weightFactor: 2,
    fontFamily: 'Finger Paint, cursive, sans-serif',
    //hover: function(item) {alert(item[0] + ':' + item[1]);},
    //click: function(item) {alert(item[0] + ':' + item[1]);},
    //click : function(item) { window.open(item[2]) },
    //fontCSS: 'https://fonts.googleapis.com/css?family=Finger+Paint',
    backgroundColor: '#ffffff'
  }
  WordCloud(document.getElementById('my_canvas'), options );
  //WordCloud(document.getElementById('my_canvas'), { list: list } );
}

function displayFailedAnalytics_old(){

  /*
  var error_params = [['Error Type', '# Count', { role: "style" } ]];
  //alert(error_params)
  var item = [ "Spam Content", analyticsData.outboundFailureTypes.content.count, '#e88c02' ]
  error_params.push(item)
  item = [ "Invalid Number", analyticsData.outboundFailureTypes.invalidRecipientNumbers.length, '#ab6305']
  error_params.push(item)
  item = [ "Opted-Out Number", analyticsData.outboundFailureTypes.optoutNumbers.length, '#cc040e' ]
  error_params.push(item)
  item = [ "Blocked Number", analyticsData.outboundFailureTypes.blockedSenderNumbers.length, '#ab6305' ]
  error_params.push(item)
  item = ["Others", analyticsData.outboundFailureTypes.others.count + analyticsData.sendingFailedCount, "#0748a3"]
  error_params.push(item)

  writeTitle("statistics-title", "Outbound failure by reason")
  var block = `<div class='row col-lg-12'>`
  block += "<div class='col-lg-4' id='graph-column'></div>"
  block += "<div class='col-lg-8' id='text-column'></div>"
  block += '</div>'
  $("#statistics").html(block)
  */
  //drawColumnChart(error_params, "graph-column", '', "")
  var error_params = [['Error Type', '# Count']];
  //alert(error_params)
  var item = [ "Spam Content", analyticsData.outboundFailureTypes.content.count]
  error_params.push(item)
  item = [ "Invalid Number", analyticsData.outboundFailureTypes.invalidRecipientNumbers.length]
  error_params.push(item)
  item = [ "Opted-Out Number", analyticsData.outboundFailureTypes.optoutNumbers.length]
  error_params.push(item)
  item = [ "Blocked Number", analyticsData.outboundFailureTypes.blockedSenderNumbers.length]
  error_params.push(item)
  item = ["Others", analyticsData.outboundFailureTypes.others.count + analyticsData.sendingFailedCount]
  error_params.push(item)
  var colors = {0:{color: '#e88c02'}, 1:{color: '#ab6305'}, 2:{color: '#cc040e'}, 3:{color: '#ab6305'}, 4:{color: '#0748a3'}}
  drawPieChart(error_params, "graph-column", '', colors)
  /*
  var selectedType = $("#failure-types").val()
  var message = ""
  if (selectedType == "spam"){
    message = "<div class='breakout'>Suspected spam content</div>"
    for (var c of analyticsData.outboundFailureTypes.content.messages){
      message += `<div class='block_space'>${c}</div>`
    }
  }else if (selectedType == "invalid-number"){
    message = "<div class='breakout'>Invalid recipient numbers</div>"
    for (var c of analyticsData.outboundFailureTypes.invalidRecipientNumbers){
      message += `<div>${c}</div>`
    }
  }else if (selectedType == "optedout-number"){
    message = "<div class='breakout'>Opted out numbers</div>"
    for (var c of analyticsData.outboundFailureTypes.optoutNumbers){
      message += `<div class='block_space'>${c}</div>`
    }
  }else if (selectedType == "blocked-number"){
    message = "<div class='breakout'>Blocked service numbers</div>"
    for (var c of analyticsData.outboundFailureTypes.blockedSenderNumbers){
      message += `<div class='block_space'>${c}</div>`
    }
  }else if (selectedType == "others"){
    message = "<div class='breakout'>Other unknown numbers</div>"
    for (var c of analyticsData.outboundFailureTypes.others.messages){
      message += `<div class='block_space'>${c}</div>`
    }
  }
  $("#text-column").html(message)
  */
  $("#analysis-title").html("")
  $("#analysis").html("")
}

function drawComboChart(params, graph, title, vTitle, hTitle, colors, format){
  var data = google.visualization.arrayToDataTable(params);
  var view = new google.visualization.DataView(data);
  var columns = [];
  for (var i = 0; i <= colors.length; i++) {
      if (i > 0) {
          columns.push(i);
          columns.push({
              calc: "stringify",
              sourceColumn: i,
              type: "string",
              role: "annotation"
          });

      } else {
          columns.push(i);
      }
  }

  view.setColumns(columns);
  var options = {
          //title : title,
          width: "100%",
          height: 220,
          //vAxis: {minValue: 0, title: `${vTitle}`},{vAxis: {format:'#%'}
          //hAxis: {title: `${hTitle}`, format: 0},
          vAxis: { minValue: 0, title: `${vTitle}` },
          //hAxis: {format: 0},
          seriesType: 'bars',
          bar: {groupWidth: "60%"},
          legend: { position: "top" },
          colors: colors //['#2280c9','#2f95a5', '#f04b3b']
          //series: {3: {type: 'line'}}
        };

  var chart = new google.visualization.ComboChart(document.getElementById(graph));
  chart.draw(view, options);
}

function drawColumnChart(params, graph, title, vTitle){
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
      title: title,
      vAxis: {minValue: 0, title: `${vTitle}`},
      //hAxis: {format: 0},
      width: 360,
      height: 220,
      bar: {groupWidth: "90%"},
      legend: { position: "none" },
    };

    var chart = new google.visualization.ColumnChart(document.getElementById(graph));
    chart.draw(view, options);
    /*
    google.visualization.events.addListener(chart, 'select', selectHandler);
    function selectHandler() {
      var selection = chart.getSelection();

      var selectedType = -1
      for (var i = 0; i < selection.length; i++) {
        var item = selection[i];
        if (item.row != null) {
          selectedType = item.row
        }
      }
      var message = ""
      if (selectedType == 0){
        message = "<div>Suspected spam content</div>"
        for (var c of analyticsData.outboundFailureTypes.content.messages){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 1){
        message = "<div>Invalid recipient numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.invalidRecipientNumbers){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 2){
        message = "<div>Blocked service numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.blockedSenderNumbers){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 3){
        message = "<div>Opted out numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.optoutNumbers){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 4){
        message = "<div>Other unknown numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.others.messages){
          message += `<div>${c}</div>`
        }
      }
      $("#text-column").html(message)
    }
    */
}

function drawPieChart(params, graph, title, colors, slice){
  var data = google.visualization.arrayToDataTable(params);
  //var view = new google.visualization.DataView(data);
  var slices = {}
  slices[slice] = {offset: 0.4}

  var options = {
    title: title,
    width: 320,
    height: 320,
    slices: colors,
    backgroundColor: 'transparent',
    chartArea:{left:0,top:20,bottom:0,width:'100%',height:'100%'},
    legend: {
      position: "right",
      maxLines: 2,
      textStyle: {
        fontSize: 10

      }
    },
    pieSliceText: 'value',
    //pieStartAngle: 90,
    //pieHole: 0.5,
    sliceVisibilityThreshold: 0.00001,
    slices: slices
  };

  var element = document.getElementById(graph)
  var chart = new google.visualization.PieChart(element);
  chart.draw(data, options);
  /*
  google.visualization.events.addListener(chart, 'select', selectHandler);
  function selectHandler() {
    //alert(chart.getSelection()[0])
    var selection = chart.getSelection();
    var selectedType = -1
    for (var i = 0; i < selection.length; i++) {
      var item = selection[i];
      if (item.row != null) {
        selectedType = item.row
      }
    }
    var message = ""
    if (selectedType == 0){
      message = "<div class='breakout'>Suspected spam content</div>"
      for (var c of analyticsData.outboundFailureTypes.content.messages){
        message += `<div class='block_space'>${c}</div>`
      }
    }else if (selectedType == 1){
      message = "<div class='breakout'>Invalid recipient numbers</div>"
      message += `<p class='block_space'>Mobile carriers could not deliver your messages to these recipients. You should correct the numbers or remove them from the recipient list to improve the cost efficiency.</p>`
    }else if (selectedType == 2){
      message = "<div class='breakout'>Opted out recipients</div>"
      message += `<p class='block_space'>These recipients have opted out from your campaign. Sending messages to opted-out recipients is violating the CTIA regulation and as a result, mobile carrier may block your service number permanently. You must remove them from the recipient list to avoid getting low sending reputation and panelty.</p>`
    }else if (selectedType == 3){
      message = "<div class='breakout'>Blocked service numbers</div>"
      for (var c of analyticsData.outboundFailureTypes.blockedSenderNumbers){
        message += `<div class='block_space'>${c}</div>`
      }
    }else if (selectedType == 4){
      message = "<div class='breakout'>Rejected phone numbers</div>"
      message += `<p class='block_space'>We detected these phone numbers either are invalid or do not exist. You should correct the numbers or remove them from the recipient list to improve the sending efficiency.</p>`
    }else if (selectedType == 5){
      message = "<div class='breakout'>Other unknown numbers</div>"
      for (var c of analyticsData.outboundFailureTypes.others.messages){
        message += `<div class='block_space'>${c}</div>`
      }
    }

    $("#text-column").html(message)
  }
  */
}

function drawScatterChart(params, graph, title, vTitle, hTitle) {
    var data = google.visualization.arrayToDataTable(params);
    var options = {
      title: title,
      width: "100%",
      height: 220,
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


function downloadAnalytics(){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "download-analytics?timeOffset=" + timeOffset
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

// TBD
/*
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
  var direction_params = [['Day', 'Inbound', 'Outbound']]
  var status_params = [['Day', 'Delivered', 'DeliveryFailed', 'SendingFailed']]
  var cost_params = [['Day', 'Inbound', 'Outbound']]

  for (var m of weekDays) {
    var item = [ m.wd, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [m.wd, m.deliveredCount, m.deliveryFailedCount, m.sendingFailedCount ]
    status_params.push(item)
    item = [m.wd, parseFloat(m.receivedMsgCost.toFixed(2)), parseFloat(m.sentMsgCost.toFixed(2))]
    cost_params.push(item)
  }

  var colors = ['#1126ba', '#178006']
  drawComboChart(direction_params, "by_direction", 'Week day messages by direction', 'Messages', 'Day', colors)
  //colors = ['#178006', '#f04b3b', '#1126ba']
  drawComboChart(cost_params, "by_cost", 'Week day messaging cost', 'USD', 'Day', colors)
  colors = ['green', '#f04b3b', 'brown']
  drawComboChart(status_params, "by_status", 'Week day Message by status', 'Messages', 'Day', colors)

  //
  drawScatterChart(direction_params, "by_direction", 'Day messages by direction', 'Messages', 'Day of Week')
  drawScatterChart(cost_params, "by_cost", 'Day messaging cost', 'USD', 'Day of Week')
  drawScatterChart(status_params, "by_status", 'Day Message by status', 'Messages', 'Day of Week')
  //
}


function displayAnalyticsTotalPie(){
  var direction_params = [];
  var arr = [ 'Direction', '# messages' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Status', '# messages' ];
  status_params.push(arr);
  var cost_params = [];
  arr = [ 'Cost', 'USD' ];
  cost_params.push(arr);

  var item = [ "Inbound", analyticsData.inboundCount ]
  direction_params.push(item)
  item = [ "Outbound", analyticsData.outboundCount ]
  direction_params.push(item)

  item = ["Delivered", analyticsData.deliveredCount]
  status_params.push(item)
  item = ["Sending failed", analyticsData.sendingFailedCount]
  status_params.push(item)
  item = ["Delivery failed", analyticsData.deliveryFailedCount]
  status_params.push(item)

  item = ["Inbound", parseFloat(analyticsData.receivedMsgCost.toFixed(2))]
  cost_params.push(item)
  item = ["Outbound", parseFloat(analyticsData.sentMsgCost.toFixed(2))]
  cost_params.push(item)

  //var colors = {0:{color: '#2280c9'}, 1:{color: '#2f95a5'}}

  //var colors = {0:{color: '#1126ba', offset: 0.2}, 1:{color: '#178006'}}
  //drawPieChart(direction_params, "total-by-direction", '# Messages by direction', colors)
  var color = ['#1126ba', '#178006']
  drawColumnChart(direction_params, "total-by-direction", '# Messages by direction', "# Messages", "Direction", colors)
  drawPieChart(cost_params, "total-by-cost", 'Cost by direction (USD)', colors)
  colors = {0:{color: 'green'}, 1:{color: '#f04b3b', offset: 0.2}, 2: {color: 'brown', offset: 0.3}}
  drawPieChart(status_params, "total-by-status", '# Message by status', colors)
}

function displayAnalyticsByMonths(){
  var monthlyData = analyticsData.months
  var direction_params = [['Month', 'Inbound', 'Outbound']]
  var status_params = [['Month', 'Delivered', 'DeliveryFailed', 'SendingFailed']]
  //var cost_params = [['Month', 'Delivered Cost', 'Failed Cost', 'Received Message Cost']];
  var cost_params = [['Month', 'Inbound Cost', 'Outbound Cost']];

  //for (var m of monthlyData) {
  for (var i=monthlyData.length-1; i>=0; i--) {
    var m =  monthlyData[i]
    var item = [ m.month, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [m.month, m.deliveredCount, m.deliveryFailedCount, m.sendingFailedCount]
    status_params.push(item)
    item = [m.month, parseFloat(m.receivedMsgCost.toFixed(2)), parseFloat(m.deliveredMsgCost.toFixed(2)) + parseFloat(m.failedMsgCost.toFixed(2))]
    cost_params.push(item)
  }
  var colors = ['#1126ba', '#178006']
  drawComboChart(direction_params, "by_direction", 'Monthly messages by direction', 'Messages', 'Month', colors)
  colors = ['#1126ba', '#178006']
  drawComboChart(cost_params, "by_cost", 'Monthly messaging cost', 'USD', 'Month', colors)
  colors = ['#178006', '#f04b3b', 'brown']
  drawComboChart(status_params, "by_status", 'Monthly Message by status', 'Messages', 'Month', colors)
}

function displayAnalyticsByNumbers(){
  var serviceNumberData = analyticsData.phoneNumbers
  var direction_params = [];
  var arr = [ 'Service Number', 'Inbound', 'Outbound' ];
  direction_params.push(arr);
  var status_params = [];
  arr = [ 'Service Number', 'Delivered', 'DeliveryFailed', 'SendingFailed' ];
  status_params.push(arr);
  var cost_params = [];
  var arr = [ 'Service Number', 'Inbound Cost', 'Outbound Cost' ];
  cost_params.push(arr);
  for (var m of serviceNumberData) {
    var serviceNumber = formatPhoneNumber(m.number,false)
    var item = [ serviceNumber, m.inboundCount, m.outboundCount ]
    direction_params.push(item)
    item = [serviceNumber, m.deliveredCount, m.deliveryFailedCount, m.sendingFailedCount]
    status_params.push(item)
    item = [serviceNumber, parseFloat(m.receivedMsgCost.toFixed(2)), parseFloat(m.deliveredMsgCost.toFixed(2)) + parseFloat(m.failedMsgCost.toFixed(2))]
    cost_params.push(item)
  }

  var colors = ['#1126ba', '#178006']
  drawComboChart(direction_params, "by_direction", '# messages by direction', 'Messages', 'Phone Number', colors)
  colors = ['#1126ba', '#178006']
  drawComboChart(cost_params, "by_cost", 'Messaging cost', 'USD', 'Phone Number', colors)
  colors = ['#178006', '#f04b3b', 'brown']
  drawComboChart(status_params, "by_status", '# message by status', 'Messages', 'Phone Number', colors)
}

*/

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

/*
function displayMessageCost(breakout){
  var colors = ['#178006','#1126ba']
  var color = ['#178006']
  if (breakout == "monthly"){
    var monthlyData = analyticsData.months
    var cost_params = [['Month', 'Outbound', 'Inbound']];
    var efficiency_params = [['Month', 'Efficient rate']];
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      var item = [m.month, parseFloat(m.deliveredMsgCost.toFixed(2)) + parseFloat(m.failedMsgCost.toFixed(2)), parseFloat(m.receivedMsgCost.toFixed(2))]
      cost_params.push(item)
      var rate = (m.deliveredMsgCost / (m.deliveredMsgCost + m.failedMsgCost)) * 100
      rate = parseFloat(rate.toFixed(1))
      var item = [m.month, rate]
      efficiency_params.push(item)
    }
    drawComboChart(cost_params, "by_direction", 'Cost by direction (per month)', 'USD', 'Month', colors)
    drawComboChart(efficiency_params, "by_status", 'Messaging cost efficiency (per month)', '%', 'Month', color)
  }else if (breakout == "bynumber"){
    var serviceNumberData = analyticsData.phoneNumbers
    var cost_params = [[ 'Service Number', 'Inbound', 'Outbound' ]];
    var efficiency_params = [[ 'Service Number', 'Efficient rate' ]];
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      var item = [ serviceNumber, parseFloat(m.deliveredMsgCost.toFixed(2)) + parseFloat(m.failedMsgCost.toFixed(2)), parseFloat(m.receivedMsgCost.toFixed(2))]
      cost_params.push(item)
      var rate = (m.deliveredMsgCost / (m.deliveredMsgCost + m.failedMsgCost)) * 100
      rate = parseFloat(rate.toFixed(1))
      var item = [serviceNumber, rate]
      efficiency_params.push(item)
    }
    drawComboChart(cost_params, "by_direction", 'Cost by direction (per service number)', 'USD', 'Phone Number', colors)
    drawComboChart(efficiency_params, "by_status", 'Messaging cost efficiency (per service number)', '%', 'Phone Number', color)
  }
}
*/
/*
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
      item = ["Contains links", m.hasURL]
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
*/

/*
function displayAnalytics(){
  displayAnalyticsTotal()
  displayAnalyticsType()
  return
  //var mode = $("#display-mode").val()
  var display = $("#display").val()
  if (mode == "graphics"){
    displayAnalyticsTotal()
    if (display == "monthly")
      //displayAnalyticsByMonths()
      displayAnalyticsType()
    else if (display == "bynumber")
      //displayAnalyticsByNumbers()
      displayAnalyticsType()

    else if (display == "hourly")
      displayAnalyticsByHours()
    else if (display == "weekdays")
      displayAnalyticsByWeekDays()
    else if (display == "bysegment")
      displayAnalyticsBySegments()

    else if (display == "failure-analytics"){
      // change types
      //displayAnalyticsType()
      displayFailedAnalytics()
    }
  }else{
    displayAnalyticsTotalTable()
    if (display == "monthly")
      displayAnalyticsByMonthsTable()
    else if (display == "bynumber")
      displayAnalyticsByNumbersTable()
    else if (display == "failure-analytics")
        displayFailedAnalytics()

    else if (display == "hourly")
      displayAnalyticsByHours()
    else if (display == "weekdays")
      displayAnalyticsByWeekDays()
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
  //for (var m of monthlyData) {
  for (var i=monthlyData.length-1; i>=0; i--) {
    var m =  monthlyData[i]
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

function displayAnalyticsByMonthsTable(){
  var byDirection = "<div class='analytics-header'>Monthly messages by direction</div><table class='analytics-table'>"
  var dHeader = "<tr><td class='table-label'>Month</td>"
  var dReceived = "<tr><td class='table-label'>Inbound</td>"
  var dSent = "<tr><td class='table-label'>Outbound</td>"
  var dTotal = "<tr><td class='table-label'>Total</td>"

  var byStatus = "<div class='analytics-header'>Monthly messages by status</div><table class='analytics-table'>"
  var sDelivered = "<tr><td class='table-label'>Delivered</td>"
  var sDeliveryFailed = "<tr><td class='table-label'>Delivery failed</td>"
  var sSentFailed = "<tr><td class='table-label'>Sending failed</td>"

  var byCost = "<div class='analytics-header'>Cost by month</div><table class='analytics-table'>"
  var cHeader = "<tr><td class='table-label'>Month</td>"
  var cReceived = "<tr><td class='table-label'>Received Cost</td>"
  var cDelivered = "<tr><td class='table-label'>Delivered Cost</td>"
  var cFailed = "<tr><td class='table-label'>Failed Cost</td>"
  var cTotal = "<tr><td class='table-label'>Total Cost</td>"

  var monthlyData = analyticsData.months
  for (var i=monthlyData.length-1; i>=0; i--) {
    var m =  monthlyData[i]
    dHeader += `<td class='table-data'>${m.month}</td>`
    // direction
    dReceived += `<td>${m.inboundCount}</td>`
    dSent += `<td>${m.outboundCount}</td>`
    dTotal += `<td>${m.outboundCount + m.inboundCount}</td>`
    // status
    sDelivered += `<td>${m.deliveredCount}</td>`
    sDeliveryFailed += `<td class='bad-data'>${m.deliveryFailedCount}</td>`
    sSentFailed += `<td class='bad-data'>${m.sendingFailedCount}</td>`
    // cost
    cDelivered += `<td>${m.deliveredMsgCost.toFixed(2)}</td>`
    cFailed += `<td class='bad-data'>${m.failedMsgCost.toFixed(2)}</td>`
    cReceived += `<td>${m.receivedMsgCost.toFixed(2)}</td>`
    var totalCost = m.deliveredMsgCost + m.failedMsgCost + m.receivedMsgCost
    cTotal += `<td>${parseFloat(totalCost.toFixed(2))}</td>`
  }
  byDirection += `${dHeader}</tr>`
  byDirection += `${dReceived}</tr>`
  byDirection += `${dSent}</tr>`
  byDirection += `${dTotal}</tr>`
  byDirection += "</table>"

  byStatus += `${dHeader}</tr>`
  byStatus += `${sDelivered}</tr>`
  byStatus += `${sDeliveryFailed}</tr>`
  byStatus += `${sSentFailed}</tr>`
  byStatus += "</table>"

  byCost += `${dHeader}</tr>`
  byCost += `${cDelivered}</tr>`
  byCost += `${cFailed}</tr>`
  byCost += `${cReceived}</tr>`
  byCost += `${cTotal}</tr>`
  byCost += "</table>"

  $("#statistics").html(byDirection)
  $("#analysis").html(byCost)
}

function displayAnalyticsByNumbersTable(){
  var byDirection = "<div class='analytics-header'># messages by direction</div><table class='analytics-table'>"
  var dHeader = "<tr><td class='table-label'>Phone number</td>"
  var dReceived = "<tr><td class='table-label'>Inbound</td>"
  var dSent = "<tr><td class='table-label'>Outbound</td>"

  var byStatus = "<div class='analytics-header'>Service messages by status</div><table class='analytics-table'>"
  var sDelivered = "<tr><td class='table-label'>Delivered</td>"
  var sDeliveryFailed = "<tr><td class='table-label'>Delivery failed</td>"
  var sSentFailed = "<tr><td class='table-label'>Sending failed</td>"

  var byCost = "<div class='analytics-header'>Cost by phone number</div><table class='analytics-table'>"
  var cReceived = "<tr><td class='table-label'>Received Cost</td>"
  var cDelivered = "<tr><td class='table-label'>Delivered Cost</td>"
  var cFailed = "<tr><td class='table-label'>Failed Cost</td>"

  var serviceNumberData = analyticsData.phoneNumbers
  for (var n of serviceNumberData) {
    var serviceNumber = formatPhoneNumber(n.number,false)
    dHeader += `<td class='table-data'>${serviceNumber}</td>`
    // direction
    dReceived += `<td class='table-data'>${n.inboundCount}</td>`
    dSent += `<td class='table-data'>${n.outboundCount}</td>`
    // status
    sDelivered += `<td class='table-data'>${n.deliveredCount}</td>`
    sDeliveryFailed += `<td class='bad-data'>${n.deliveryFailedCount}</td>`
    sSentFailed += `<td class='bad-data'>${n.sendingFailedCount}</td>`
    // cost
    cDelivered += `<td>${n.deliveredMsgCost.toFixed(2)}</td>`
    cFailed += `<td class='bad-data'>${n.failedMsgCost.toFixed(2)}</td>`
    cReceived += `<td>${n.receivedMsgCost.toFixed(2)}</td>`
  }
  byDirection += `${dHeader}</tr>`
  byDirection += `${dReceived}</tr>`
  byDirection += `${dSent}</tr>`
  byDirection += "</table>"

  byStatus += `${dHeader}</tr>`
  byStatus += `${sDelivered}</tr>`
  byStatus += `${sDeliveryFailed}</tr>`
  byStatus += `${sSentFailed}</tr>`
  byStatus += "</table>"

  byCost += `${dHeader}</tr>`
  byCost += `${cDelivered}</tr>`
  byCost += `${cFailed}</tr>`
  byCost += `${cReceived}</tr>`
  byCost += "</table>"

  $("#by_direction").html(byDirection)
  $("#by_cost").html(byCost)
  $("#by_status").html(byStatus)
}
*/
