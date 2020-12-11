
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
}


function readCampaign(){
  var valArr = $("#campaigns").val().split("/")
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var date = new Date(valArr[1])
  var timestamp = date.getTime() - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toLocaleDateString("en-US")
  createdDateStr += " " + createdDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
  var url = `read_campaign?batchId=${valArr[0]}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var report = "<div><div>Creation Time: " + createdDateStr + "</div>"
      for (var key of Object.keys(res.result)){
        if (key == "Total_Cost")
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.result[key].toFixed(3) + " USD</div>"
        else
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.result[key] + "</div>"
      }
      report += "</div>"
      $("#report").html(report)
      $("#download_json").css('display', 'block');
      $("#download_csv").css('display', 'block');
      $("#campaign-report").css('display', 'block');
      createFullReport(res.fullReport)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}
function createFullReport(fullReports){
  var html = ""
  var timeOffset = new Date().getTimezoneOffset()*60000;
  for (var item of fullReports){
    var date = new Date(item.creationTime)
    var timestamp = date.getTime() - timeOffset
    var createdDate = new Date (timestamp)
    var createdDateStr = createdDate.toLocaleDateString("en-US")
    createdDateStr += " " + createdDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
    date = new Date(item.lastModifiedTime)
    var timestamp = date.getTime() - timeOffset
    var updatedDate = new Date (timestamp)
    var updatedDateStr = createdDate.toLocaleDateString("en-US")
    updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
    var cost = (item.hasOwnProperty('cost')) ? item.cost : "0.000"
    var segmentCount = (item.hasOwnProperty('segmentCount')) ? item.segmentCount : "-"
    if (item.messageStatus == "SendingFailed")
      html += "<div class='row col-xs-12 error'>"
    else
      html += "<div class='row col-xs-12'>"
    html += `<div class="col-sm-1 hasborder">${item.id}</div>`
    html += `<div class="col-sm-2 hasborder">${formatPhoneNumber(item.from)}</div>`
    html += `<div class="col-sm-2 hasborder">${formatPhoneNumber(item.to[0])}</div>`

    html += `<div class="col-sm-2 hasborder">${updatedDateStr}</div>`
    html += `<div class="col-sm-2 hasborder">${item.messageStatus}</div>`
    html += `<div class="col-sm-2 hasborder">$${cost}</div>`
    html += `<div class="col-sm-1 hasborder">${segmentCount}</div>`
    html += "</div>"
  }

  $("#list").html(html)
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
