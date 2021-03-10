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
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  var height = $(window).height() - $("#footer").outerHeight(true)
    window.onresize = function() {
        height = $(window).height() - $("#footer").outerHeight(true)
        var swindow = height - $("#menu_header").height()
        $("#campaign-list-col").height(swindow)
        $("#campaign-list").height(swindow - $("#campaign-list-header").height() - 20)
        $("#menu-pane").height(swindow)
        var upperBlock = $("#details-header").outerHeight(true) +  $("#report-content-header").outerHeight(true) + 50
        $("#report-content").height(swindow - upperBlock)
    }
    var swindow = height - $("#menu_header").height()
    $("#campaign-list-col").height(swindow)
    $("#campaign-list").height(swindow - $("#campaign-list-header").height() - 20)
    $("#menu-pane").height(swindow)
    var upperBlock = $("#details-header").outerHeight(true) +  $("#report-content-header").outerHeight(true) + 50
    $("#report-content").height(swindow - upperBlock)

    campaignList = JSON.parse(window.campaigns)
    //var campaign = campaignList[0]
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
      //createDetailedReport(res.fullReport)
      createFullReport(res.fullReport)
      var batchReport = res.summaryReport
      var timeOffset = new Date().getTimezoneOffset()*60000;
      var timestamp = campaign.creationTime - timeOffset
      var createdDate = new Date (timestamp)
      var createdDateStr = createdDate.toISOString()
      createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
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
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}
function onloaded(){
   //alert("onloaded")
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

    //var updatedDateStr = updatedDate.toLocaleDateString("en-US")
    //updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
    var cost = (item.hasOwnProperty('cost')) ? item.cost : "0.000"
    var segmentCount = (item.hasOwnProperty('segmentCount')) ? item.segmentCount : "-"
    if (item.messageStatus == "SendingFailed" || item.messageStatus == "DeliveryFailed")
      html += "<div class='row col-lg-12 error small_font'>"
    else
      html += "<div class='row col-lg-12 small_font'>"
    //html += `<div class="col-sm-1 hasborder">${item.id}</div>`
    //html += `<div class="col-sm-2 hasborder">${formatPhoneNumber(item.from)}</div>`
    html += `<div class="col-sm-2 hasborder">${formatPhoneNumber(item.to[0])}</div>`

    html += `<div class="col-sm-3 hasborder">${updatedDateStr}</div>`
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
    html += `<div class="col-sm-3 hasborder">${errorDes}</div>`
    html += `<div class="col-sm-1 hasborder">$${cost}</div>`
    html += `<div class="col-sm-1 hasborder">${segmentCount}</div>`
    html += "</div>"
  }
  $("#report-content").html(html)
  //return fromNumber
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

function plotBatchReport(params){
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
      title: 'Campaign',
      width: 240,
      height: 150,
      colors: ['#f04b3b', '#2f95a5', '#ffffff'],
      backgroundColor: 'transparent'
    };


    var elm = `campaign-result`
    var element = document.getElementById(elm)
    var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}


function createDetailedReport(fullReports){
  var i = 0
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var tabledata = []
  for (var item of fullReports){
      i++
      var date = new Date(item.lastModifiedTime)
      var timestamp = date.getTime() - timeOffset
      var updatedDate = new Date (timestamp)
      var updatedDateStr = updatedDate.toISOString()
      updatedDateStr = updatedDateStr.replace("T", " ").substring(0, 19)

      var cost = (item.hasOwnProperty('cost')) ? item.cost : "0.000"
      var segmentCount = (item.hasOwnProperty('segmentCount')) ? item.segmentCount : "-"
      var errorCode = "-"
      var errorDes = "-"
      if (item.hasOwnProperty('errorCode')){
        errorCode = item.errorCode
        for (var key of Object.keys(errorCodes)){
          if (key == errorCode)
            errorDes = errorCodes[key]
        }
      }
      var item = {
        "Index": i,
        "To": formatPhoneNumber(item.to[0]),
        "LastUpdate": updatedDateStr,
        "Status": item.messageStatus,
        "FailedReason": errorDes,
        "Cost": cost,
        "Segment": segmentCount
      }
      tabledata.push(item)
    }
    var table = new Tabulator("#report-content", {
      data:tabledata, //assign data to table
      //autoColumns:true, //create columns from data field names
      layout:"fitColumns",      //fit columns to width of table
      responsiveLayout:"hide",  //hide columns that dont fit on the table
      tooltips:true,            //show tool tips on cells
      addRowPos:"top",          //when adding a new row, add it to the top of the table
      history:true,             //allow undo and redo actions on the table
      //pagination:"local",       //paginate the data
      //paginationSize:7,         //allow 7 rows per page of data
      movableColumns:true,      //allow column order to be changed
      resizableRows:true,       //allow row order to be changed
      initialSort:[             //set the initial sort order of the data
          {column:"Last Seen", dir:"asc"},
      ],
      columns:[                 //define the table columns
          {title:"#", field:"Index", width:15},
          {title:"To", field:"To", width:135, sorter:"number"},
          {title:"Last update", field:"LastUpdate", width:200, editor:false, sorter:"date"},
          {title:"Status", field:"Status", hozAlign:"center", width:100, editor:false, sorter:"number"},
          {title:"Failed reason", field:"FailedReason", hozAlign:"center", width:250, editor:false},
          {title:"Cost", field:"Cost", width:80,  hozAlign:"center"},
          {title:"Segment", field:"Segment", width:80, sorter:"number", hozAlign:"center", editor:false},
      ],
    });
}
