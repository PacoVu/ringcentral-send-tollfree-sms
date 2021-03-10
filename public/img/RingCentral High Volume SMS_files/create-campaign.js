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
var loaded = 0

/*
window.onload = function init(){
  //google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  //google.charts.setOnLoadCallback(onloaded);

  var height = $(window).height() - 80;
    window.onresize = function() {
        height = $(window).height() - 80;
        var swindow = height - $("#menu_header").height()
        $("#control-block").height(swindow)
        $("#creation-pane").height(swindow)
        $("#menu-pane").height(swindow) // menu-pane
    }
    var swindow = height - $("#menu_header").height()
    $("#control-block").height(swindow)
    $("#creation-pane").height(swindow)
    $("#menu-pane").height(swindow) // menu-pane

    $("#campain-new").addClass("active");
}

function onloaded(){
  loaded++
  if (loaded == 3){
     // prevent loading multiple times
    var jsonObj = JSON.parse(window.batchResult)
    if (jsonObj.status == "Processing" && jsonObj.id != ""){
      pendingBatch = true
      currentBatchId = jsonObj.id
      isPolling = false // force to start polling
      startPollingResult(true)
    }else{
      //showBlock("vote-report")
      //readVoteResult()
      //alert(window.batchResult)
      if (window.batchType == "vote"){
        //pendingBatch = true
        currentBatchId = jsonObj.id
        isPolling = false // force to start polling
        showBlock("vote-report")
        readVoteResult()
      }else{
        currentBatchId = jsonObj.id
        isPolling = false // force to start polling
        showBlock("report")
        readReport()
        //$("#control-block").hide()
      }

    }
  }
}
*/
function hidePopover(elm){
  setTimeout(function () {
    elm.popover('hide');
  }, 2000);
}

function enableManualInput(elm){
  if (elm.checked){
    $("#manual-input").show()
    $("#csv-option").css("visibility","hidden")
    $("#to-number-column").hide()
    $("#columns").hide()
    // check name and from number
    if (checkCampainNameField() == false){
      return
    }
    if (checkFromField() == false){
      return
    }
    nextView("next")
  }else{
    $("#csv-option").css("visibility","visible")
    $("#columns").show()
    $("#to-number-column").show()
    $("#manual-input").hide()
  }
}

function updatePreview(field){
  if (field == "title"){
    $("#preview-campain-name").html($('#campaign-name').val())
  }else if (field == "from"){
    $("#preview-from-number").html(formatPhoneNumber($('#from-number').val()))
  }else if (field == "response"){
    var text = ""
    for (var i=1; i<4; i++){
      text = $(`#command_${i}`).val()
      if (text != "")
        break
    }
    //var text = $('#command_1').val()
    if (text == "")
      $("#response-sample").hide()
    else
      $("#response-sample").show()
    $("#response-sample").html(text)
  }else if (field == "reply"){
    $("#reply-sample").html("")
    var text = ""
    var i = 1
    for (i=1; i<4; i++){
      text = $(`#reply-${i}`).val()
      if (text != "")
        break
    }
    //var text = $('#reply-1').val()
    if (text == "")
      $("#reply-sample").hide()
    else
      $("#reply-sample").show()

    if ($("#reply-sample").html() == ""){
        var response = $(`#command_${i}`).val()
        $("#response-sample").html(response)
    }
    $("#reply-sample").html(text)
    //alert($("#response-sample").html())

  }
}


var currentBlock = 1
function createNewCampaign(){
  $("#history").hide()
  $("#create").show()
  currentBlock = 1
  //$("#block_0").hide()
  $("#sms-form").show()
  showBlock("preview")
  //$("#progess-block").hide()
  //$("#preview-block").show()
  $("#submit").hide()
  $("#prevBtn").css("display", "none")
}
function resetSentCampaign(){
  currentBlock = 1
  //$("#block_0").show()
  resetCampaignInput()
  resetCampaignPreview()

  $('#block_1').show()
  $('#block_2').hide()
  $('#block_3').hide()
  $("#sms-form").hide()
  //showBlock("preview")
  $("#submit").hide()
  $("#prevBtn").css("display", "none")
  $("#nextBtn").css("display", "inline")
  // reset all fields
}
function resetCampaignInput(){
  $("#campaign-name").val("")
  $("#enable-manual-input").prop('checked', false)
  $("#recipients").val("")
  $("#to-number-column").val("")
  $("#attachment").val("")
  $("#message").val("")
}

function resetCampaignPreview(){
  $("#preview-campain-name").html("N/A")
  $("#preview-from-number").html("N/A")
  $("#preview-recipients").html("0")
  $("#charcount").html("SMS length: 0 char.")
  $("#sample").html("")
  //$("#preview-response-options").html("No response")
  $("#preview-reply-options").html("No auto-reply")
  $("#estimated_cost").html("$0.000 USD *")
}

function nextView(direction){
  var newBlock = currentBlock
  if (direction == "next")
    newBlock++
  else if(direction == "prev")
    newBlock--
  else{
    // cancel
    resetSentCampaign()
    $('#create').hide()
    $('#history').show()
    return
  }
  var view = `block_${newBlock}`
  //alert(view)
  switch (view) {
    case 'block_1':

      $('#block_2').hide()
      $("#prevBtn").css("display", "none")
      $("#nextBtn").css("display", "inline")
      // don't hide when come back
      //if($("#submit").is(":visible"))
      //  $("#submit").hide()
      break;
    case 'block_2':
      if (checkCampainNameField() == false){
        var pop = $('#campaign-name')
        pop.popover('show');
        hidePopover(pop)
        return
      }
      if (checkFromField() == false){
        var pop = $('#from-number')
        pop.popover('show');
        hidePopover(pop)
        return
      }
      var check = $("#enable-manual-input").is(":checked")
      //if (check != 'on' && !checkAttachmentField()){
      if (!check && !checkAttachmentField()){
        var pop =$('#attachment')
        pop.popover('show');
        hidePopover(pop)
        return
      }
      // set preview
      //$("#preview-campain-name").html($('#campaign-name').val())
      //$("#preview-from-number").html(formatPhoneNumber($('#from-number').val()))
      //$("#preview-recipients").html(totalRecipients + " recipients")
      //
      // don't uncheck once set.
      //$("#expect_response").prop('checked', false);
      $('#block_1').hide()
      $('#block_3').hide()
      $("#review-block").show()
      $("#prevBtn").css("display", "inline")
      //var check = $("#expect-response").is(":checked")
      //alert(check)
      if ($("#expect-response").is(":checked"))
        $("#nextBtn").show()
        //$("#nextBtn").css("display", "inline")
      else
        $("#nextBtn").hide()
      $("#submit").show()
      break;
    case 'block_3':
      if ($("#enable-manual-input").is(":checked")){
        var text = checkToNumberField()
        if (text != ""){
          var pop = $('#recipients')
          pop.popover('show');
          hidePopover(pop)
          return
        }
      }else{
        var text = checkToField()
        if (text != ""){
          //`Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`
          var pop = $('#to-number-column')
          //pop.popover().setContent(text)
          pop.popover('show');
          hidePopover(pop)
          return
          //return alert(`Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`)
        }
      }

      if (!checkMessageField()){
        var pop = $('#message')
        pop.popover('show');
        hidePopover(pop)
        return //alert("Please enter a message!")
      }
      $("#nextBtn").css("display", "none")
      //disableSubmitBtn(true)
      $('#block_2').hide()
      break;
    default:

      return
  }
  currentBlock = newBlock
  $(`#${view}`).show()
}

function showAutoReply(elm, index){
  if (elm.checked){
    $(`#reply-${index}`).show()
  }else{
    $(`#reply-${index}`).val("")
    $(`#reply-${index}`).hide()
  }
  updatePreview("reply")
}
// don't need this
function setAutoReply(elm){
  if (elm.checked){
    $("#auto-reply-block").show()
    $("#preview-reply-options").html("Enable auto-reply")
    //$("#reply-sample").show()
    updatePreview("reply")
  }else{
    $("#auto-reply-block").hide()
    $("#preview-reply-options").html("No auto-reply")
    //$("#reply-sample").hide()
    updatePreview('reply')
    //disableSubmitBtn(false)
  }
}

function enableExpectingResponse(elm){
  if (elm.checked){
    $("#recipient-response-block").show()
    if ($("#enable-manual-input").is(":checked")){
      var text = checkToNumberField()
      if (text != ""){
        return
      }
    }else{
      var text = checkToField()
      if (text != ""){
        return
      }
    }

    if (!checkMessageField()){
      return
    }
    //$("#preview-response-options").html("Expecting recipient's response")
    nextView("next")
  }else{
    $("#recipient-response-block").hide()
    //$("#preview-response-options").html("No response")
    $("#nextBtn").hide()
    // clear sample response and auto reply
    for (var i=1; i<4; i++){
      $(`#command_${i}`).val("")
      $(`#reply-${i}`).val("")
      $(`#reply-${i}`).hide()
      $(`#reply-${i}-enabler`).prop('checked', false)
    }
    $('#allow-correction').prop('checked', false)
    updatePreview('response')
    updatePreview('reply')
  }
}
// manual input
function readFieldRecipients(elm){
  var dN = $(elm).val().trim()
  totalRecipients = dN.split("\n").length
  $("#preview-recipients").html(totalRecipients + " recipients")
  calculateEstimatedCost()
}
// template file input
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
      $("#preview-recipients").html(totalRecipients + " recipients")
      //$("#preview-recipients").html(totalRecipients + " recipients")
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
    $("#preview-recipients").html(totalRecipients + " recipient")
    totalMessageSegments = 0
    calculateEstimatedCost()
    $("#columns").html("-")
    $("#columns").hide()
  }
}
function estimateCost(){
  var elm = $("#attachment").prop('files');
  readFileRecipients(null, elm[0])
}
// cost estimation
function calculateEstimatedCost(){
  var estimatedCost = totalMessageSegments * SMS_COST
  //var msg = `Send a total of ${totalMessageSegments} messages to ${totalRecipients} recipients. Your estimated cost will be $${estimatedCost.toFixed(3)} USD *.`
  var msg = `$${estimatedCost.toFixed(3)} USD *.`
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
  $("#columns").show()
  var html = "|&nbsp;"
  for (var col of columns)
    html += `<a href="javascript:addToMessage('${col}')">${col}</a>&nbsp;|&nbsp;`
  $("#columns").html(html)
}

function checkPos(){
  var pos = 0;
  var el = document.getElementById("message")
  if("selectionStart" in el) {
     pos = el.selectionStart;
  } else if("selection" in document) {
     el.focus();
     var Sel = document.selection.createRange();
     var SelLength = document.selection.createRange().text.length;
     Sel.moveStart("character", -el.value.length);
     pos = Sel.text.length - SelLength;
  }
  return pos;
}

function addToMessage(template){
  var insertPos = checkPos()
  //var msg = $("#message").val() + `{${template}}`
  var msg = $("#message").val()
  var headMsg = msg.substring(0, insertPos).trim()
  var trailMsg = msg.substring(insertPos, msg.length)
  if (insertPos == msg.length)
    headMsg += ` {${template}}`
  else
    headMsg += ` {${template}} `
  msg = headMsg + trailMsg

  $("#message").val(msg)
  $("#message").focus()
  updateSampleMessage()
}

function addOptoutInstruction(elm){
  var msg = $("#message").val()
  if (elm.checked){
    msg += "\n\nReply STOP to opt-out."
  }else {
    msg = msg.replace("\n\nReply STOP to opt-out.", "")
  }
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

  var sample = msg.replace(/\r?\n/g, "<br>")
  sample = qaTextMessage(sample)
  if (sample.length){
    $("#sample").show()
    $("#sample").html(sample)
  }else{
    $("#sample").hide()
  }
  if (sample.length > 0){
    disableSubmitBtn(false)
    $("#expect-response").prop('checked', false);
  }

  $("#charcount").html("SMS length: " + msg.length + " chars.")

  totalMessageSegments = 1
  if (msg.length > SMS_MAX_LEN){
    totalMessageSegments = msg.length / SMS_SEGMENT_LEN
    totalMessageSegments = Math.ceil(totalMessageSegments)
  }
  totalMessageSegments *= totalRecipients
  calculateEstimatedCost()
}
function isUpperCase(str) {
  return str === str.toUpperCase();
}
function qaTextMessage(msg){
  //var sample = ""

  if (isUpperCase(msg)){
    msg = `<span class='caplock_warning'>${msg}</span>`
    $("#caplock_warning").show()
  }else{
    $("#caplock_warning").hide()
  }
  /*
  var sUrls = ["https://", "http://"]
  var sLinks = ["bit.ly/","tinyurl.com/","ow.ly/"]
  for (var url of sUrl){
    var urlIndex = msg.indexOf(url)
    if (urlIndex >= 0){
    for (var link of sLinks){
      var index = msg.indexOf(url)
      if (index >= 0){
        var temp = msg.substring(index, msg.length-1)
        var endIndex = temp.indexOf(" ")
        var unsafeLink = msg.substr(index, endIndex)
        msg = msg.replace(unsafeLink, `<span class='unsafe_link_warning'>${unsafeLink}</span`)
      }
    }
  }
  */
  var tempMsg = msg.toLowerCase()
  /*
  bit.ly
  - goo.gl
  - tinyurl.com
  - Tiny.cc
  - bc.vc
  - budurl.com
  - Clicky.me
  - is.gd
  - lc.chat
  - soo.gd
  - s2r.co
  */
  var index = tempMsg.indexOf("https://bit.ly/")
  if (index >= 0){
    var temp = tempMsg.substring(index, tempMsg.length-1)
    var endIndex = temp.indexOf(" ")
    var unsafeLink = msg.substr(index, endIndex)
    //var re = new RegExp(unsafeLink, 'g');
    msg = msg.replace(unsafeLink, `<span class='unsafe_link_warning'>${unsafeLink}</span>`, "g")
    $("#unsafe_link_warning").show()
  }else{
    $("#unsafe_link_warning").hide()
  }
  return msg
}
function disableSubmitBtn(flag){
  $("#submit").prop('disabled', flag);
}

function isAllReady() {
  var ready = true
  if (checkCampainNameField() == false){
    return false
  }
  if (checkFromField() == false){
    return false
  }
  if ($("#enable-manual-input").is(":checked")){
    if (!checkAttachmentField()){
      return false
    }
    if (checkToField() != ""){
      return false
    }
  }else{
    if (checkToNumberField() != "")
      return false
  }

  if (!checkMessageField()){
    return false
  }
  if ($("#expect-response").is(":checked")){
    if (!checkCommandFields()){
      return false
    }
  }
  if ($("#auto-reply").is(":checked")){
    if (!checkAutoReplyFields())
      return false
  }
  return true
}

// submit form using ajax seems not enforce required inputs
function checkFromField(){
  if ($("#from-number").val() == ""){
    $("#from-number").focus()
    return false
  }
  return true
}

function checkToField(){
  var toNumberColumnName = $("#to-number-column").val()
  if (toNumberColumnName == ""){
    //alert(`Please specify the column name for recipient phone number.`)
    $("#to-number-column").focus()
    return "Please specify the column name for recipient phone number."
    //return false
  }
  for (var key of Object.keys(csvColumnIndex)){
    if (key == toNumberColumnName){
      return ""
    }
  }
  //alert(`Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`)
  $("#to-number-column").focus()
  return `Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`
  //return false
}

function checkToNumberField(){
  var toNumbers = $("#recipients").val()
  if (toNumbers == ""){
    $("#recipient").focus()
    return "Please enter recipient phone number."
  }
  return ""
}

function checkCampainNameField(){
  if ($("#campaign-name").val() == ""){
    $("#campaign-name").focus()
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

function checkCommandFields(){
  var hasCommand = false
  var temp = $("#command_1").val().trim()
  if (temp != ""){
    if (temp.indexOf(" ") >= 0){
      alert("Support a single word response only!")
      $("#command_1").focus()
      return false
    }else
      hasCommand = true
  }

  temp = $("#command_2").val().trim()
  if (temp != ""){
    if (temp.indexOf(" ") >= 0){
      alert("Support a single word response only!")
      $("#command_2").focus()
      return false
    }else
      hasCommand = true
  }

  temp = $("#command_3").val().trim()
  if (temp != ""){
    if (temp.indexOf(" ") >= 0){
      alert("Support a single word response only!")
      $("#command_3").focus()
      return false
    }else
      hasCommand = true
  }
  if (!hasCommand){
    alert("Please enter at least one response option!")
    $("#command_1").focus()
  }
  return hasCommand
}

function checkAutoReplyFields(){
  var ready = false
  if ($("#reply_1").val().trim() != ""){
    ready = true
  }
  if ($("#reply_2").val().trim() != ""){
    ready = true
  }
  if ($("#reply_3").val().trim() != ""){
    ready = true
  }
  return ready
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
  if (checkCampainNameField() == false){
    return alert("Please provide a campaign name!")
  }
  if ($("#enable-manual-input").is(":checked")){
    if (checkFromField() == false){
      return alert("Please select a 'from' number!")
    }
  }else{
    if (checkToField() != ""){
      return
      //return alert(`Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`)
    }
    if (!checkAttachmentField()){
      return alert("Please select a .csv file!")
    }
  }
  if (!checkMessageField()){
    return alert("Please enter a message!")
  }
  if ($("#expect-response").is(":checked")){
    if (!checkCommandFields()){
      return //alert("Please enter at least one response option!")
    }
    for (var i = 1; i < 4; i++){
      var id = `#reply-${i}-enabler`
      if ($(`${id}`).is(":checked")){
        id = `#reply-${i}`
        if ($(`${id}`).val() == "")
          return alert(`Please provide auto-reply message for option ${i}!`)
      }
    }
  }
  /*
  if ($("#auto-reply").is(":checked")){
    if (!checkAutoReplyFields())
      return alert("Please provide auto-reply message(s)!")
  }
  */

  //return alert("All Passed")
  /*
  $("#result_block").hide()
  $("#report_block").hide()
  $("#vote_report_block").hide()
  */
  //showBlock("result")
  var form = $("#sms-form");
  var formData = new FormData(form[0]);

  $.ajax({
      url: "/sendhvmessages",
      type: 'POST',
      data: formData,
      success: function (res) {
          if (res.status == "ok"){
            pendingBatch = true
            currentBatchId = res.result.id
            resetSentCampaign()
            showBlock("result")
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
