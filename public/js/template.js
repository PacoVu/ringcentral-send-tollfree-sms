var currentBatchId = ""
var pendingBatch = false
var isPolling = false
const SMS_COST = 0.007
const SMS_SEGMENT_LEN = 153
const SMS_MAX_LEN = 160
var totalRecipients = 0
var totalMessageSegments = 0
var sampleRow = null
var csvColumnIndex = {}
const MASK = "#!#"

window.onload = function init(){
  var jsonObj = JSON.parse(window.batchResult)
  if (jsonObj.status == "Processing" && jsonObj.id != ""){
    pendingBatch = true
    currentBatchId = jsonObj.id
    isPolling = false // force to start polling
    //switchPollResult()
    startPollingResult(true)
    //pollResult()
  }

  else{
    $("#control_block").hide()
  }

}

function readFileRecipients(elm, f){
  var file = null
  if (f != null)
    file = f
  else
    file = elm.files[0]

  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      var recipientsFromFile = e.target.result.trim().split("\r\n")
      var header = recipientsFromFile[0]
      var columns = header.trim().split(",")
      displayColumns(columns)
      for (var i=0; i<columns.length; i++){
        csvColumnIndex[columns[i]] = i
      }
      var message = $("#message").val()

      totalRecipients = recipientsFromFile.length - 1
      if (recipientsFromFile.length >= 1){
        var row = recipientsFromFile[1]
        // need to detect double quotes from each col in a sample row
        row = detectAndHandleCommas(row)
        sampleRow = row.trim().split(",")
      }
      /*
      for (var i=1; i<recipientsFromFile.length; i++){
        var row = recipientsFromFile[i]
        // need to detect double quotes from each col in a sample row
        row = detectAndHandleCommas(row)
        var columns = row.trim().split(",")
        if (i == 1){
          sampleRow = columns
          break
        }
      }
      */
    };
  }else{
    totalRecipients = 0
    totalMessageSegments = 0
    calculateEstimatedCost()
    $("#columns").html("-")
  }
}
function estimateCost(){
  var elm = $("#attachment").prop('files');
  readFileRecipients(null, elm[0])
}
// cost estimation
function calculateEstimatedCost(){
  var estimatedCost = totalMessageSegments * SMS_COST
  var msg = `You are about to send a total of ${totalMessageSegments} messages to ${totalRecipients} recipients.<br/>Your estimated cost will be $${estimatedCost.toFixed(3)} USD *.`
  if (totalMessageSegments == 0)
    msg = "$0.000 USD *."
  $("#estimated_cost").html(msg)
}

function detectAndHandleCommas(row){
  var startPos = 0
  var endPos = 0
  while (startPos >= 0){
    startPos = row.indexOf('"', endPos)
    if (startPos > 0){
      endPos = row.indexOf('"', startPos+1)
      if (endPos >= 0){
        var colText = row.substring(startPos, endPos+1)
        var count = colText.split(",").length - 1
        var maskedText = colText.replace(/,/g, MASK);
        endPos = endPos + (2 * count)
        row = row.replace(colText, maskedText)
      }
      endPos = endPos+2
      if (endPos >= row.length)
        startPos = -1
    }
  }
  return row
}
/// cost estimation ends
function displayColumns(columns){
  var html = "|&nbsp;"
  for (var col of columns)
    html += `<a href="javascript:addToMessage('${col}')">${col}</a>&nbsp;|&nbsp;`
  $("#columns").html(html)
}
function addToMessage(template){
  var msg = $("#message").val() + `{${template}}`
  $("#message").val(msg)
  $("#message").focus()
  updateSampleMessage()
}

function updateSampleMessage(){
  var msg = $("#message").val()
  let re = new RegExp('/\{([^}]+)\}/g');
  var arr = msg.match(/{([^}]*)}/g)
  if (arr){
    for (var pattern of arr){
      for (var key of Object.keys(csvColumnIndex)){
        var k = `{${key}}`
        if (k == pattern){
          var text = sampleRow[csvColumnIndex[key]].replaceAll('"', '')
          text = text.replaceAll(MASK, ',')
          msg = msg.replace(pattern, text)
        }
      }
    }
  }
  $("#sample").html(msg)
  $("#charcount").html("SMS length: " + msg.length + " chars.")

  totalMessageSegments = 1
  if (msg.length > SMS_MAX_LEN){
    totalMessageSegments = msg.length / SMS_SEGMENT_LEN
    totalMessageSegments = Math.ceil(totalMessageSegments)
  }
  totalMessageSegments *= totalRecipients
  calculateEstimatedCost()
}

// submit form using ajax seems not enforce required inputs
function checkFromField(){
  if ($("#from_number").val() == null){
    $("#from_number").focus()
    return false
  }
  return true
}
function checkToField(){
  var toNumberColumnName = $("#to-number-column").val()
  if (toNumberColumnName == "")
    return false
  for (var key of Object.keys(csvColumnIndex)){
    if (key == toNumberColumnName){
      return true
    }
  }
  $("#to-number-column").focus()
  return false
}
function checkCampainNameField(){
  if ($("#campaign_name").val() == ""){
    $("#campaign_name").focus()
    return false
  }
  return true
}
function checkAttachmentField(){
  if ($("#attachment").val() == ""){
    $("#attachment").focus()
    return false
  }
  return true
}
function checkMessageField(){
  if ($("#message").val() == ""){
    $("#message").focus()
    return false
  }
  return true
}


function sendBatchMessage(e) {
  e.preventDefault();
  if (pendingBatch){
    var r = confirm("You have a pending batch. Do you want to send a new batch before the previous batch completed?");
    if (r == true) {
      // cancel polling
      //if (isPolling)
      //  switchPollResult()
      startPollingResult(false)
      pendingBatch = false
      canSendMessages()
    }
  }else{
    canSendMessages()
  }
}

function canSendMessages() {
  $("#result_block").hide()

  if (checkCampainNameField() == false){
    return alert("Please provide a campaign name.")
  }
  if (checkFromField() == false){
    return alert("Please select a 'from' number.")
  }
  if (!checkToField()){
    return alert(`Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`)
  }
  if (!checkAttachmentField()){
    return alert("Please select a .csv file.")
  }
  if (!checkMessageField()){
    return alert("Please enter a message.")
  }

  var form = $("#sms-form");
  var formData = new FormData(form[0]);
  $.ajax({
      url: "/sendhighvolumemessage-advance",
      type: 'POST',
      data: formData,
      success: function (res) {
          if (res.status == "ok"){
            pendingBatch = true
            //isPolling = false // force to start polling
            currentBatchId = res.result.id
            //switchPollResult()
            startPollingResult(true)
            parseResultResponse(res)
          }else if (res.status == "failed"){
            alert(res.message)
            window.location.href = "login"
          }else{
            alert(res.message)
          }
      },
      cache: false,
      contentType: false,
      processData: false
  });
}
