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
var loaded = 0
var campaignList = []
function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});

  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "campaign-log"
  $(`#${mainMenuItem}`).addClass("active")
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  $("#campaign-list-col").height(swindow)
  $("#campaign-list").height(swindow - $("#campaign-list-header").height() - 20)
  $("#menu-pane").height(swindow)
  var upperBlock = $("#details-header").outerHeight(true) +  $("#report-content-header").outerHeight(true) + 50
  $("#report-content").height(swindow - upperBlock)
}

function onloaded(){
  loaded++
  if (loaded == 2){
    loaded = 4
    readCampaigns()
  }
}

function readCampaigns(){
  var url = "/read-campaigns"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      //alert(JSON.stringify(res))
      campaignList = res.campaigns
      if (campaignList.length != 0){
        $("#content-col").show()
        listAllCampaigns()
        setElementsHeight()
      }
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

//<div class="campaign-item" onclick="readCampaign(this, '<%- item.batchId %>')"><%= item.campaignName %></div>
function listAllCampaigns(){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var html = ""
  for (var item of campaignList) {
    html += `<div id="${item.batchId}" class="campaign-item" onclick="readCampaign(this, '${item.batchId}')">${item.campaignName}</div>`
  }
  $("#campaign-list").html(html)

  var batchId = campaignList[0].batchId
  readCampaign($(`#${batchId}`), batchId)
}

var currentSelectedItem = undefined
function readCampaign(elm, batchId){
  var campaign = campaignList.find(o => o.batchId === batchId)
  if (currentSelectedItem != undefined){
    $(currentSelectedItem).removeClass("active");
  }
  $(elm).addClass("active");
  currentSelectedItem = elm
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var timestamp = campaign.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
  var url = `read-campaign-details?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      createFullReport(res.fullReport)
      var batchReport = res.summaryReport
      var timeOffset = new Date().getTimezoneOffset()*60000;
      var timestamp = campaign.creationTime - timeOffset
      var createdDate = new Date (timestamp)
      var createdDateStr = createdDate.toISOString()
      createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
      //$("#campaign-title").html("Selected campaign: <p>" + campaign.campaignName + "</p>")
      //var label = (selectedBatchId == "") ? "Recent campaign " : "Selected campaign "
      var title = `<label class="label-input">Selected campaign: </label><span>${campaign.campaignName}</span>&nbsp;&nbsp;&nbsp;`
      title += `<a href="javascript:downloadBatchReport('${campaign.campaignName}')">Download report</a>&nbsp;&nbsp;|&nbsp;&nbsp;`
      title += `<a href="javascript:deleteCampaignResult('${campaign.batchId}')">Delete campaign</a></div>`
      $("#campaign-title").html( title )
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
      var arr = ['Results', '#'];
      params.push(arr);

      var item = ["Pending", batchReport.queuedCount];
      params.push(item);
      item = ["Sent", batchReport.sentCount]
      params.push(item);
      item = ["Delivered", batchReport.deliveredCount]
      params.push(item);
      item = ["Sending Failed", batchReport.sendingFailedCount]
      params.push(item);
      item = ["Delivery Failed", batchReport.deliveryFailedCount]
      params.push(item);
      plotBatchReport(params)
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

function createFullReport(fullReports){
  var html = ""
  var timeOffset = new Date().getTimezoneOffset()*60000;

  for (var item of fullReports){

    var date = new Date(item.lastModifiedTime)
    var timestamp = date.getTime() - timeOffset
    var updatedDate = new Date (timestamp)
    var updatedDateStr = updatedDate.toISOString()
    updatedDateStr = updatedDateStr.replace("T", " ").substring(0, 19)

    var cost = (item.hasOwnProperty('cost')) ? item.cost : "0.000"
    var segmentCount = (item.hasOwnProperty('segmentCount')) ? item.segmentCount : "-"
    if (item.messageStatus == "SendingFailed" || item.messageStatus == "DeliveryFailed")
      html += "<div class='row col-lg-12 error small_font'>"
    else
      html += "<div class='row col-lg-12 small_font'>"
    html += `<div class="col-lg-2 hasborder">${formatPhoneNumber(item.to[0], true)}</div>`

    html += `<div class="col-lg-3 hasborder">${updatedDateStr}</div>`
    html += `<div class="col-lg-2 hasborder">${item.messageStatus}</div>`
    var errorCode = "-"
    var errorDes = "-"
    if (item.hasOwnProperty('errorCode')){
      errorCode = item.errorCode
      for (var key of Object.keys(errorCodes)){
        if (key == errorCode)
          errorDes = errorCodes[key]
      }
    }
    html += `<div class="col-lg-3 hasborder">${errorDes}</div>`
    html += `<div class="col-lg-1 hasborder">$${cost}</div>`
    html += `<div class="col-lg-1 hasborder">${segmentCount}</div>`
    html += "</div>"
  }
  $("#report-content").html(html)
}

function downloadBatchReport(name){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = `download-batch-report?campaign_name=${encodeURIComponent(name)}&timeOffset=${timeOffset}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      window.location.href = res.message
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

function deleteCampaignResult(batchId){
  var url = `delete-campaign-result?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      _alert("Campaign result is deleted.", "Information")
      campaignList = res.campaigns
      if (campaignList.length == 0)
        ;//createNewCampaign()
      listAllCampaigns()
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

function plotBatchReport(params){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    var options = {
      title: 'Campaign report',
      width: 265,
      height: 150,
      slices: {0: {color: '#ffffff'}, 1:{color: '#2280c9'}, 2:{color: '#2f95a5'}, 3: {color: '#f04b3b'}, 4: {color: '#6e0206'}},
      backgroundColor: 'transparent',
      legend: {
        position: "right"
      },
      pieSliceText: 'value'
    };

    var elm = `campaign-result`
    var element = document.getElementById(elm)
    var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}
