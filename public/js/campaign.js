var errorCodes = {}
errorCodes["SMS-UP-410"] = "Destination number invalid, unallocated, or does not support this kind of messaging."
errorCodes["SMS-UP-430"] = "Spam content detected by SMS gateway."
errorCodes["SMS-UP-431"] = "Number blacklisted due to spam."
errorCodes["SMS-UP-500"] = "General SMS gateway error. Upstream is malfunctioning."
errorCodes["SMS-CAR-104"] = "Carrier has not reported delivery status."
errorCodes["SMS-CAR-199"] = "Carrier reports unknown message status."
errorCodes["SMS-CAR-400"] = "Carrier does not support this kind of messaging."
errorCodes["SMS-CAR-411"] = "Destination number invalid, unallocated, or does not support this kind of messaging."
errorCodes["SMS-CAR-412"] = "Destination subscriber unavailable."
errorCodes["SMS-CAR-413"] = "Destination subscriber opted out."
errorCodes["SMS-CAR-430"] = "Spam content detected by mobile carrier."
errorCodes["SMS-CAR-431"] = "Message rejected by carrier with no specific reason."
errorCodes["SMS-CAR-432"] = "Message is too long."
errorCodes["SMS-CAR-433"] = "Message is malformed for the carrier."
errorCodes["SMS-CAR-450"] = "P2P messaging volume violation."
errorCodes["SMS-CAR-460"] = "Destination rejected short code messaging."
errorCodes["SMS-CAR-500"] = "Carrier reported general service failure."
errorCodes["SMS-RC-500"] = "General/Unknown internal RingCentral error."
errorCodes["SMS-RC-501"] = "RingCentral is sending a bad upstream API call."
errorCodes["SMS-RC-503"] = "RingCentral provisioning error. Phone number is incorrectly provisioned by RingCentral in upstream."
errorCodes["SMS-NO-ERROR"] = "Sent successfullly."
var campaignList = []
function init(){
  var height = $(window).height() - 150;
    window.onresize = function() {
        height = $(window).height() - 150;
        var swindow = height - $("#menu_header").height()
        swindow -= $("#content_header").height()
        $("#list").height(swindow)
    }
    var swindow = height - $("#menu_header").height()
    swindow -= $("#content_header").height()
    $("#list").height(swindow)

    campaignList = JSON.parse(window.campaigns)
}

function readCampaign(){
  var batchId = $("#campaigns").val()
  var campaign = campaignList.find(o => o.batchId === batchId)
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var timestamp = campaign.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
  var url = `read_campaign?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      //createDetailedReport(res.fullReport)
      var serviceNumber = createFullReport(res.fullReport)
      var batchReport = res.result
      var timeOffset = new Date().getTimezoneOffset()*60000;
      var timestamp = campaign.creationTime - timeOffset
      var createdDate = new Date (timestamp)
      var createdDateStr = createdDate.toISOString()
      createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
      var report = "<div><div>Creation date and time: " + createdDateStr + "</div>"
      report += `<div>Service phone number: ${serviceNumber}</div>`
      /*
      for (var key of Object.keys(res.result)){
        if (key == "totalCost")
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.result[key].toFixed(3) + " USD</div>"
        else
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.result[key] + "</div>"
      }
      */
      report += `<div>Queued #: ${batchReport.queuedCount}</div>`
      report += `<div>Sent #: ${batchReport.sentCount}</div>`
      report += `<div>Delivered #: ${batchReport.deliveredCount}</div>`
      report += `<div>Unreached #: ${batchReport.unreachableCount}</div>`
      report += `<div>Total cost: ${batchReport.totalCost.toFixed(3)} USD</div>`

      report += "</div>"
      $("#report").html(report)
      $("#downloads").show()
      //$("#download_json").css('display', 'block');
      //$("#download_csv").css('display', 'block');
      //$("#campaign-report").css('display', 'block');
      $("#campaign-report").show()
      /*
      $("#campaign-title").html(campaign.campaignName)
      var report = `<div>`
      report += `<div class="info-line"><img class="icon" src="../img/creation-date.png"></img> ${createdDateStr}</div>`
      report += `<div class="info-line"><img class="icon" src="../img/sender.png"></img> ${formatPhoneNumber(campaign.serviceNumber)}</div>`
      report += `<div class="info-line"><img class="icon" src="../img/recipient.png"></img> ${campaign.totalCount} recipients </div>`

      report += `<div class="info-line"><img class="icon" src="../img/cost.png"></img> USD ${batchReport.totalCost.toFixed(3)}</div>`
      var msg = (campaign.message.length > 50) ? campaign.message.substring(0, 50) : campaign.message
      report += `<p class="info-line"><img class="icon" src="../img/message.png"></img> ${msg}</p>`

      report += "</div>"
      $("#campaign-details").html(report)
      var params = [];
      var arr = ['Results', '#', { role: "style" } ];
      params.push(arr);
      var item = ["Pending", batchReport.queuedCount, "#f04b3b"];
      params.push(item);
      item = ["Delivered", batchReport.deliveredCount, "#2f95a5"]
      params.push(item);
      item = ["Sending Failed", batchReport.sendingFailedCount, "white"]
      params.push(item);
      item = ["Delivery Failed", batchReport.deliveryFailedCount, "white"]
      params.push(item);

      plotBatchReport(params)

      $("#downloads").show()
      //$("#download_json").css('display', 'block');
      //$("#download_csv").css('display', 'block');
      //$("#campaign-report").css('display', 'block');
      $("#campaign-report").show()
      //createFullReport(res.fullReport)
      */
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}
/*
function readCampaign(){
  var batchId = $("#campaigns").val()
  var timeOffset = new Date().getTimezoneOffset()*60000;

  var url = `read_campaign?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var fromNumber = createFullReport(res.fullReport)
      var timestamp = res.result.creationTime - timeOffset
      var createdDate = new Date (timestamp)
      var createdDateStr = createdDate.toISOString()
      createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
      var report = "<div><div>Creation date and time: " + createdDateStr + "</div>"
      report += `<div>Sent from phone number: ${res.result.serviceNumber}</div>`
      for (var key of Object.keys(res.result)){
        if (key == "Total_Cost")
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.result[key].toFixed(3) + " USD</div>"
        else
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.result[key] + "</div>"
      }
      report += "</div>"
      $("#report").html(report)
      $("#downloads").show()
      //$("#download_json").css('display', 'block');
      //$("#download_csv").css('display', 'block');
      //$("#campaign-report").css('display', 'block');
      $("#campaign-report").show()
      //createFullReport(res.fullReport)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}
*/
function createFullReport(fullReports){
  var html = ""
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var fromNumber = ""
  for (var item of fullReports){
    /*
    var date = new Date(item.creationTime)
    var timestamp = date.getTime() - timeOffset
    var createdDate = new Date (timestamp)
    var createdDateStr = createdDate.toLocaleDateString("en-US")
    createdDateStr += " " + createdDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
    */
    if (fromNumber == "")
      fromNumber = formatPhoneNumber(item.from)
    var date = new Date(item.lastModifiedTime)
    var timestamp = date.getTime() - timeOffset
    var updatedDate = new Date (timestamp)
    var updatedDateStr = updatedDate.toISOString()
    updatedDateStr = updatedDateStr.replace("T", " ").substring(0, 19)

    //var updatedDateStr = updatedDate.toLocaleDateString("en-US")
    //updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
    var cost = (item.hasOwnProperty('cost')) ? item.cost : "0.000"
    var segmentCount = (item.hasOwnProperty('segmentCount')) ? item.segmentCount : "-"
    if (item.messageStatus == "SendingFailed" || item.messageStatus == "DeliveryFailed")
      html += "<div class='row col-xs-12 error small_font'>"
    else
      html += "<div class='row col-xs-12 small_font'>"
    //html += `<div class="col-sm-1 hasborder">${item.id}</div>`
    //html += `<div class="col-sm-2 hasborder">${formatPhoneNumber(item.from)}</div>`
    html += `<div class="col-sm-2 hasborder">${formatPhoneNumber(item.to[0])}</div>`

    html += `<div class="col-sm-2 hasborder">${updatedDateStr}</div>`
    html += `<div class="col-sm-2 hasborder">${item.messageStatus}</div>`
    var errorCode = "-"
    var errorDes = "-"
    if (item.hasOwnProperty('errorCode')){
      errorCode = item.errorCode
      for (var key of Object.keys(errorCodes)){
        if (key == errorCode)
          errorDes = errorCodes[key]
      }
    }
    //html += `<div class="col-sm-2 hasborder" title="${errorDes}">${errorCode}</div>`
    html += `<div class="col-sm-4 hasborder">${errorDes}</div>`
    html += `<div class="col-sm-1 hasborder">$${cost}</div>`
    html += `<div class="col-sm-1 hasborder">${segmentCount}</div>`
    html += "</div>"
  }
  $("#list").html(html)
  return fromNumber
}
function downloadReport(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "downloadbatchreport?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}
